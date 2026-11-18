"""Dead code elimination: constant branches, unreachable code, dead stores (liveness based), unused imports."""
import ast

from compiler.intermediate_representation import build_scope_cfg, iter_scopes
from .common import (FUNC, NOT_CONST, SCOPE_NODES, const_value, is_numeric, loads_all, safe_numeric, scope_lists,
                     terminates, unparse, walk_scope)
from .dataflow import liveness, live_after_each

SPECIAL = (ast.Yield, ast.YieldFrom, ast.Await, ast.Global, ast.Nonlocal)


def special(nodes):
    return any(isinstance(x, SPECIAL) for n in nodes for x in ast.walk(n))


def all_lists(tree):
    out = []
    for n in ast.walk(tree):
        for f in ("body", "orelse", "finalbody"):
            v = getattr(n, f, None)
            if isinstance(v, list) and v and isinstance(v[0], ast.stmt):
                out.append(v)
    return out


def prune_list(lst, ctx):
    out, term, n = [], False, 0
    for i, st in enumerate(lst):
        if term:
            if special([st]):
                out.append(st)
            else:
                ctx.log("dead_code", st, "unreachable", unparse(st), "(removed)",
                        "Control flow never reaches this statement (it follows return/raise/break/continue).")
                n += 1
            continue
        if isinstance(st, ast.If):
            v = const_value(st.test)
            if v is not NOT_CONST:
                chosen, dropped = (st.body, st.orelse) if v else (st.orelse, st.body)
                if not special(dropped):
                    ctx.log("dead_code", st, "constant-branch", f"if {unparse(st.test)}: ...",
                            "(branch inlined)" if chosen else "(removed)",
                            f"The condition is always {bool(v)}, so only one branch can execute.")
                    n += 1
                    out.extend(chosen)
                    term = terminates(chosen)
                    continue
        elif isinstance(st, ast.While):
            v = const_value(st.test)
            if v is not NOT_CONST and not v and not special(st.body):
                ctx.log("dead_code", st, "constant-branch", f"while {unparse(st.test)}: ...", "(removed)",
                        "The loop condition is always False, so the body never runs.")
                n += 1
                out.extend(st.orelse)
                continue
        elif isinstance(st, ast.Expr) and isinstance(st.value, ast.Constant) \
                and type(st.value.value) in (int, float, str, bool, type(None)) \
                and not (i == 0 and isinstance(st.value.value, str)):
            ctx.log("dead_code", st, "no-op", unparse(st), "(removed)", "A bare constant expression has no effect.")
            n += 1
            continue
        out.append(st)
        if isinstance(st, (ast.Return, ast.Raise, ast.Break, ast.Continue)):
            term = True
    if n:
        lst[:] = out or [ast.Pass()]
    return n


def is_pure(e, numeric, ctx):
    assume = ctx.settings.get("assume_numeric", False)
    if isinstance(e, (ast.Constant, ast.Name)):
        return True
    if isinstance(e, (ast.List, ast.Tuple, ast.Set)):
        return all(not isinstance(x, ast.Starred) and is_pure(x, numeric, ctx) for x in e.elts)
    if isinstance(e, ast.Dict):
        return all(k is not None and is_pure(k, numeric, ctx) for k in e.keys) and all(is_pure(v, numeric, ctx) for v in e.values)
    if isinstance(e, (ast.BinOp, ast.UnaryOp)):
        return safe_numeric(e, numeric, ctx.excluded)
    if isinstance(e, ast.Compare):
        return all(is_numeric(x, numeric, assume) for x in [e.left] + e.comparators)
    if isinstance(e, ast.BoolOp):
        return all(is_pure(v, numeric, ctx) for v in e.values)
    if isinstance(e, ast.IfExp):
        return all(is_pure(x, numeric, ctx) for x in (e.test, e.body, e.orelse))
    return False


def dunder_all(tree):
    names = set()
    for n in ast.walk(tree):
        if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "__all__" for t in n.targets) \
                and isinstance(n.value, (ast.List, ast.Tuple)):
            names |= {e.value for e in n.value.elts if isinstance(e, ast.Constant) and isinstance(e.value, str)}
    return names


def dead_stores(tree, ctx):
    if ctx.dynamic:
        return 0
    total = 0
    for scope, _ in iter_scopes(tree):
        is_mod = isinstance(scope, ast.Module)
        if is_mod and not ctx.settings.get("assume_script", True):
            continue
        escaping = set(ctx.excluded)
        for n in walk_scope(scope):
            if isinstance(n, SCOPE_NODES):
                escaping |= loads_all(n)
        if is_mod:
            escaping |= dunder_all(tree)
        module_ok = None
        if is_mod:
            all_loads = loads_all(tree)
            store_cnt, assign_cnt = {}, {}
            for n in walk_scope(scope):
                if isinstance(n, ast.Name) and isinstance(n.ctx, (ast.Store, ast.Del)):
                    store_cnt[n.id] = store_cnt.get(n.id, 0) + 1
                if isinstance(n, ast.Assign) and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name):
                    assign_cnt[n.targets[0].id] = assign_cnt.get(n.targets[0].id, 0) + 1
            module_ok = {k for k, v in store_cnt.items() if assign_cnt.get(k) == v and k not in all_loads}
            for n in walk_scope(scope):  # other kinds of stores (imports, defs, ...) also block removal
                if isinstance(n, (ast.Import, ast.ImportFrom) + SCOPE_NODES[:2] + (ast.ExceptHandler,)):
                    module_ok -= {getattr(n, "name", None)} if hasattr(n, "name") else set()
        cfg = build_scope_cfg(scope)
        _, live_out = liveness(cfg)
        dead = {}
        for bid in cfg.reachable():
            blk = cfg.blocks[bid]
            after = live_after_each(blk, live_out[bid])
            for i, ins in enumerate(blk.instrs):
                if ins.user and isinstance(ins.stmt, ast.Assign) and ins.dsts:
                    name = ins.dsts[0]
                    if name not in after[i] and name not in escaping and not (name.startswith("__") and name.endswith("__")) \
                            and (module_ok is None or name in module_ok):
                        dead[id(ins.stmt)] = ins.stmt
        if not dead:
            continue
        numeric = ctx.numeric_for(scope)
        for lst in scope_lists(scope):
            new, changed = [], False
            for st in lst:
                if id(st) in dead:
                    changed = True
                    total += 1
                    name = st.targets[0].id
                    if is_pure(st.value, numeric, ctx):
                        ctx.log("dead_code", st, "dead-store", unparse(st), "(removed)",
                                f"Liveness analysis shows `{name}` is never read after this assignment.")
                    else:
                        repl = ast.copy_location(ast.Expr(value=st.value), st)
                        new.append(repl)
                        ctx.log("dead_code", st, "dead-store", unparse(st), unparse(repl),
                                f"`{name}` is never read, but the right-hand side may have side effects, so only the store was dropped.")
                else:
                    new.append(st)
            if changed:
                lst[:] = new or [ast.Pass()]
    return total


def remove_unused_imports(tree, ctx):
    if ctx.dynamic:
        return 0
    used = {n.id for n in ast.walk(tree) if isinstance(n, ast.Name)} | dunder_all(tree)
    in_try = {id(s) for n in ast.walk(tree) if isinstance(n, ast.Try) for s in ast.walk(n) if isinstance(s, (ast.Import, ast.ImportFrom))}
    total = 0
    for lst in all_lists(tree):
        new, changed = [], False
        for st in lst:
            if isinstance(st, (ast.Import, ast.ImportFrom)) and id(st) not in in_try \
                    and not (isinstance(st, ast.ImportFrom) and st.module == "__future__"):
                keep = [a for a in st.names if a.name == "*" or (a.asname or a.name.split(".")[0]) in used]
                if len(keep) != len(st.names):
                    changed = True
                    total += 1
                    ctx.log("unused_imports", st, "unused-import", unparse(st), unparse(ast.Import(names=keep)) if keep else "(removed)",
                            "The imported name is never referenced in this file.", "suggested")
                    if keep:
                        st.names = keep
                        new.append(st)
                    continue
            new.append(st)
        if changed:
            lst[:] = new or [ast.Pass()]
    return total


def run(tree, ctx):
    n = 0
    for lst in all_lists(tree):
        n += prune_list(lst, ctx)
    n += dead_stores(tree, ctx)
    return n


def run_unused_imports(tree, ctx):
    return remove_unused_imports(tree, ctx)
