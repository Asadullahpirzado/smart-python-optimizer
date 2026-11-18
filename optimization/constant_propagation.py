"""Forward propagation engine shared by constant propagation and copy propagation."""
import ast
import copy

from .common import (FUNC, NOT_CONST, const_value, make_const, stores_in, terminates, unparse)
from .constant_folding import fold_statement, fold_expr


class Subst(ast.NodeTransformer):
    """Replace loads of names found in ``env``; respects comprehension / lambda scopes."""

    def __init__(self, env):
        self.env, self.count = env, 0

    def visit_Name(self, node):
        if isinstance(node.ctx, ast.Load) and node.id in self.env:
            self.count += 1
            return ast.copy_location(copy.deepcopy(self.env[node.id]), node)
        return node

    def _scoped(self, node, bound):
        saved = self.env
        self.env = {k: v for k, v in saved.items()
                    if k not in bound and not (isinstance(v, ast.Name) and v.id in bound)}
        self.generic_visit(node)
        self.env = saved
        return node

    def visit_Lambda(self, node):
        a = node.args
        bound = {x.arg for x in a.posonlyargs + a.args + a.kwonlyargs}
        bound |= {x.arg for x in (a.vararg, a.kwarg) if x}
        return self._scoped(node, bound)

    def _comp(self, node):
        bound = set()
        for g in node.generators:
            bound |= stores_in(g.target)
        return self._scoped(node, bound)

    visit_ListComp = visit_SetComp = visit_DictComp = visit_GeneratorExp = _comp


def has_walrus(node):
    return any(isinstance(n, ast.NamedExpr) for n in ast.walk(node))


class Propagator:
    def __init__(self, ctx, mode):
        self.ctx, self.mode, self.total = ctx, mode, 0
        self.pass_name = "constant_propagation" if mode == "const" else "copy_propagation"

    def run(self, tree):
        if self.ctx.dynamic:
            return 0
        self.block(tree.body, {})
        return self.total

    # -- environment helpers -----------------------------------------------------
    def kill(self, env, names):
        for n in names:
            env.pop(n, None)
        if self.mode == "copy" and names:
            for k in [k for k, v in env.items() if isinstance(v, ast.Name) and v.id in names]:
                del env[k]

    def same(self, a, b):
        if self.mode == "copy":
            return isinstance(a, ast.Name) and isinstance(b, ast.Name) and a.id == b.id
        va, vb = const_value(a), const_value(b)
        return va is not NOT_CONST and vb is not NOT_CONST and type(va) is type(vb) and va == vb

    def record(self, env, name, value):
        if name in self.ctx.excluded:
            return
        if self.mode == "const":
            folded, _ = fold_expr(copy.deepcopy(value))
            v = const_value(folded)
            if v is not NOT_CONST and not (isinstance(v, str) and len(v) > 32):
                env[name] = make_const(v)
        elif isinstance(value, ast.Name) and value.id != name and value.id not in self.ctx.excluded:
            env[name] = ast.Name(id=value.id, ctx=ast.Load())

    def explain(self):
        if self.mode == "const":
            return "A reaching definition assigns a known constant, so the variable was replaced by its value."
        return "The variable is a plain copy of another variable that has not changed, so the original was used directly."

    # -- statements ------------------------------------------------------------------
    def block(self, stmts, env):
        for st in stmts:
            self.stmt(st, env)

    def header(self, holder, attr, env, st):
        expr = getattr(holder, attr)
        if has_walrus(expr):
            self.kill(env, stores_in(expr))
            return
        if not env:
            return
        before = unparse(expr)
        s = Subst(env)
        new = s.visit(expr)
        if s.count:
            if self.mode == "const":
                new, _ = fold_expr(new)
            setattr(holder, attr, new)
            self.total += s.count
            self.ctx.log(self.pass_name, st, "propagate", before, unparse(new), self.explain())

    def stmt(self, st, env):
        if isinstance(st, ast.If):
            self.header(st, "test", env, st)
            e1, e2 = dict(env), dict(env)
            self.block(st.body, e1)
            self.block(st.orelse, e2)
            t1, t2 = terminates(st.body), terminates(st.orelse)
            if t1 and t2:
                new = {}
            elif t1:
                new = e2
            elif t2:
                new = e1
            else:
                new = {k: v for k, v in e1.items() if k in e2 and self.same(v, e2[k])}
            env.clear()
            env.update(new)
        elif isinstance(st, ast.While):
            self.kill(env, stores_in(st))
            self.header(st, "test", env, st)
            self.block(st.body, dict(env))
            self.block(st.orelse, dict(env))
        elif isinstance(st, (ast.For, ast.AsyncFor)):
            self.header(st, "iter", env, st)
            self.kill(env, stores_in(st))
            self.block(st.body, dict(env))
            self.block(st.orelse, dict(env))
        elif isinstance(st, (ast.With, ast.AsyncWith)):
            for item in st.items:
                self.header(item, "context_expr", env, st)
            self.kill(env, stores_in(st))
            self.block(st.body, dict(env))
        elif isinstance(st, FUNC + (ast.ClassDef,)):
            self.kill(env, {st.name})
            self.block(st.body, {})
        elif any(isinstance(getattr(st, a, None), list) for a in ("body", "orelse", "finalbody", "handlers", "cases")):
            self.kill(env, stores_in(st))  # Try / Match / unknown compound statements
            for a in ("body", "orelse", "finalbody"):
                if isinstance(getattr(st, a, None), list):
                    self.block(getattr(st, a), dict(env))
            for h in getattr(st, "handlers", []):
                self.block(h.body, dict(env))
            for c in getattr(st, "cases", []):
                self.block(c.body, dict(env))
        else:
            self.simple(st, env)

    def simple(self, st, env):
        walrus = has_walrus(st)
        n = 0
        before = unparse(st) if env else ""
        if env and not walrus:
            s = Subst(env)
            s.visit(st)
            n = s.count
            if n and self.mode == "const":
                fold_statement(st)
        if n:
            self.total += n
            self.ctx.log(self.pass_name, st, "propagate", before, unparse(st), self.explain())
        self.kill(env, stores_in(st))
        if not walrus:
            if isinstance(st, ast.Assign) and len(st.targets) == 1 and isinstance(st.targets[0], ast.Name):
                self.record(env, st.targets[0].id, st.value)
            elif isinstance(st, ast.AnnAssign) and st.value is not None and isinstance(st.target, ast.Name):
                self.record(env, st.target.id, st.value)


def run(tree, ctx):
    return Propagator(ctx, "const").run(tree)
