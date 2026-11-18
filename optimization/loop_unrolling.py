"""Loop unrolling for tiny constant-trip-count range loops."""
import ast
import copy
from collections import Counter

from compiler.intermediate_representation import iter_scopes
from .common import (SCOPE_NODES, COMPS, const_value, make_const, node_count, scope_lists, stores_in, unparse, NOT_CONST)
from .constant_folding import fold_statement
from .constant_propagation import Subst


def const_range(call):
    if not (isinstance(call, ast.Call) and isinstance(call.func, ast.Name) and call.func.id == "range" and not call.keywords
            and 1 <= len(call.args) <= 3):
        return None
    vals = [const_value(a) for a in call.args]
    if any(type(v) is not int for v in vals) or (len(vals) == 3 and vals[2] == 0):
        return None
    return list(range(*vals))


def try_unroll(st, loads, ctx):
    if not (isinstance(st, ast.For) and isinstance(st.target, ast.Name) and not st.orelse):
        return None
    vals = const_range(st.iter)
    s = ctx.settings
    if not vals or len(vals) > s["unroll_max_trip"] or len(st.body) > 3:
        return None
    body_nodes = [x for b in st.body for x in ast.walk(b)]
    if len(body_nodes) > s["unroll_max_nodes"]:
        return None
    if any(isinstance(x, (ast.Break, ast.Continue, ast.Lambda, ast.Yield, ast.YieldFrom, ast.Await) + SCOPE_NODES) for x in body_nodes):
        return None
    var = st.target.id
    if var in ctx.excluded or var in stores_in(ast.Module(body=st.body, type_ignores=[])):
        return None
    out = []
    for v in vals:
        for b in st.body:
            c = copy.deepcopy(b)
            sub = Subst({var: make_const(v)})
            sub.visit(c)
            fold_statement(c)
            out.append(c)
    out.append(ast.copy_location(ast.Assign(targets=[ast.Name(id=var, ctx=ast.Store())], value=make_const(vals[-1])), st))
    ctx.log("loop_unrolling", st, "unroll", f"for {var} in range(...): <{len(st.body)} stmt(s)>",
            f"{len(vals)} copies of the loop body",
            f"The loop runs only {len(vals)} times with a tiny body, so unrolling removes loop-control overhead.")
    return out


def run(tree, ctx):
    if ctx.dynamic:
        return 0
    total = 0
    for scope, _ in iter_scopes(tree):
        loads = Counter(n.id for n in ast.walk(scope) if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Load))
        for lst in scope_lists(scope):
            new, changed = [], False
            for st in lst:
                u = try_unroll(st, loads, ctx)
                if u:
                    new.extend(u)
                    changed = True
                    total += 1
                else:
                    new.append(st)
            if changed:
                lst[:] = new
    return total
