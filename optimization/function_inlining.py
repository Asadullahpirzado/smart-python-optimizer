"""Function inlining for tiny single-expression functions."""
import ast
import copy

from .common import FUNC, node_count, stores_in, unparse

SAFE_BUILTINS = {"abs", "min", "max", "len", "int", "float", "round", "bool", "str"}
BAD = (ast.Lambda, ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp, ast.NamedExpr, ast.Yield,
       ast.YieldFrom, ast.Await, ast.Starred)


def candidates(tree, ctx):
    stores = {}
    for n in ast.walk(tree):
        for nm in ([n.name] if isinstance(n, FUNC + (ast.ClassDef,)) else
                   [n.id] if isinstance(n, ast.Name) and isinstance(n.ctx, (ast.Store, ast.Del)) else
                   [(a.asname or a.name.split(".")[0]) for a in n.names] if isinstance(n, (ast.Import, ast.ImportFrom)) else []):
            stores[nm] = stores.get(nm, 0) + 1
    out = {}
    for st in tree.body:
        if not isinstance(st, ast.FunctionDef) or st.decorator_list or stores.get(st.name, 0) != 1 or st.name in ctx.excluded:
            continue
        a = st.args
        if a.posonlyargs or a.kwonlyargs or a.vararg or a.kwarg or a.defaults:
            continue
        body = st.body
        if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant) and isinstance(body[0].value.value, str):
            body = body[1:]
        if len(body) != 1 or not isinstance(body[0], ast.Return) or body[0].value is None:
            continue
        expr = body[0].value
        params = [x.arg for x in a.args]
        if node_count(expr) > ctx.settings["inline_max_nodes"] or any(isinstance(x, BAD) for x in ast.walk(expr)):
            continue
        ok = True
        for x in ast.walk(expr):
            if isinstance(x, ast.Call) and not (isinstance(x.func, ast.Name) and x.func.id in SAFE_BUILTINS and x.func.id not in stores):
                ok = False
            if isinstance(x, ast.Name) and x.id not in params and x.id not in SAFE_BUILTINS:
                ok = False
        if ok:
            out[st.name] = (params, expr)
    return out


class Inliner(ast.NodeTransformer):
    def __init__(self, cands, ctx):
        self.cands, self.ctx, self.count = cands, ctx, 0

    def visit_Call(self, node):
        self.generic_visit(node)
        if not (isinstance(node.func, ast.Name) and node.func.id in self.cands) or node.keywords \
                or any(isinstance(a, ast.Starred) for a in node.args):
            return node
        params, expr = self.cands[node.func.id]
        if len(node.args) != len(params):
            return node
        uses = {p: sum(1 for x in ast.walk(expr) if isinstance(x, ast.Name) and x.id == p) for p in params}
        impure = [any(isinstance(x, (ast.Call, ast.NamedExpr, ast.Await, ast.Yield)) for x in ast.walk(a)) for a in node.args]
        for a, p, imp in zip(node.args, params, impure):
            simple = isinstance(a, (ast.Name, ast.Constant))
            if (not simple and uses[p] != 1) or (imp and len(params) > 1):
                return node
        env = dict(zip(params, node.args))

        class Sub(ast.NodeTransformer):
            def visit_Name(self, n):
                if n.id in env and isinstance(n.ctx, ast.Load):
                    return copy.deepcopy(env[n.id])
                return n

        new = ast.copy_location(Sub().visit(copy.deepcopy(expr)), node)
        self.count += 1
        self.ctx.log("inlining", node, "inline", unparse(node), unparse(new),
                     f"`{node.func.id}` is a tiny side-effect-free function, so its body replaces the call.")
        return new


def run(tree, ctx):
    if ctx.dynamic:
        return 0
    cands = candidates(tree, ctx)
    if not cands:
        return 0
    inl = Inliner(cands, ctx)
    inl.visit(tree)
    return inl.count
