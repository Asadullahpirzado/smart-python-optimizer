"""Strength reduction: x**2 -> x*x and induction variables for `i * C` inside range loops."""
import ast

from compiler.intermediate_representation import iter_scopes
from .common import (COMPS, SCOPE_NODES, LOOPS, Replacer, const_value, NOT_CONST, make_const, scope_lists, stores_in,
                     terminates, unparse)


class PowToMul(ast.NodeTransformer):
    def __init__(self, numeric, ctx):
        self.numeric, self.ctx = numeric, ctx

    def visit_FunctionDef(self, node):
        return node

    visit_AsyncFunctionDef = visit_ClassDef = visit_FunctionDef

    def visit_BinOp(self, node):
        self.generic_visit(node)
        if isinstance(node.op, ast.Pow) and isinstance(node.right, ast.Constant) and type(node.right.value) is int \
                and node.right.value == 2 and isinstance(node.left, ast.Name) and node.left.id in self.numeric \
                and node.left.id not in self.ctx.excluded:
            new = ast.copy_location(ast.BinOp(left=ast.Name(id=node.left.id, ctx=ast.Load()), op=ast.Mult(),
                                              right=ast.Name(id=node.left.id, ctx=ast.Load())), node)
            self.ctx.log("strength_reduction", node, "pow-to-mul", unparse(node), unparse(new),
                         "Squaring with a multiplication is cheaper than the general power operator.")
            self.count += 1
            return new
        return node

    count = 0


def has_continue(stmts):
    stack = list(stmts)
    while stack:
        n = stack.pop()
        if isinstance(n, ast.Continue):
            return True
        if isinstance(n, LOOPS) or isinstance(n, SCOPE_NODES):
            continue
        stack.extend(ast.iter_child_nodes(n))
    return False


def find_products(node, var, out):
    if isinstance(node, (ast.Lambda,) + COMPS + SCOPE_NODES):
        return
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Mult):
        for a, b in ((node.left, node.right), (node.right, node.left)):
            if isinstance(a, ast.Name) and a.id == var and isinstance(a.ctx, ast.Load) \
                    and isinstance(b, ast.Constant) and type(b.value) is int and b.value >= 2:
                out.append((node, b.value))
                return
    for ch in ast.iter_child_nodes(node):
        find_products(ch, var, out)


def induction(loop, ctx):
    if not (isinstance(loop, ast.For) and isinstance(loop.target, ast.Name)):
        return []
    it = loop.iter
    if not (isinstance(it, ast.Call) and isinstance(it.func, ast.Name) and it.func.id == "range" and not it.keywords
            and 1 <= len(it.args) <= 3 and not any(isinstance(a, ast.Starred) for a in it.args)):
        return []
    var = loop.target.id
    start, step = 0, 1
    if len(it.args) >= 2:
        start = const_value(it.args[0])
    if len(it.args) == 3:
        step = const_value(it.args[2])
    if type(start) is not int or type(step) is not int or step == 0:
        return []
    if var in stores_in(ast.Module(body=loop.body, type_ignores=[])) or var in ctx.excluded or has_continue(loop.body):
        return []
    found = []
    for st in loop.body:
        find_products(st, var, found)
    if not found:
        return []
    by_c = {}
    for node, c in found:
        by_c.setdefault(c, []).append(node)
    inits = []
    for c, nodes in by_c.items():
        sr = ctx.fresh("sr")
        rep = Replacer({id(n) for n in nodes}, sr)
        for i, st in enumerate(loop.body):
            loop.body[i] = rep.visit(st)
        init = ast.copy_location(ast.Assign(targets=[ast.Name(id=sr, ctx=ast.Store())], value=make_const(start * c)), loop)
        inits.append(init)
        if not terminates(loop.body):
            loop.body.append(ast.copy_location(ast.AugAssign(target=ast.Name(id=sr, ctx=ast.Store()), op=ast.Add(),
                                                             value=make_const(step * c)), loop))
        ctx.log("strength_reduction", loop, "induction-variable", f"{var} * {c}  (inside loop)",
                f"{sr} = {start * c}; {sr} += {step * c}",
                f"`{var} * {c}` is replaced by a running value that is updated with a cheap addition each iteration.")
    return inits


def run(tree, ctx):
    total = 0
    for scope, _ in iter_scopes(tree):
        numeric = ctx.numeric_for(scope)
        t = PowToMul(numeric, ctx)
        for st in scope.body:
            t.visit(st)
        total += t.count
        if ctx.dynamic:
            continue
        for lst in scope_lists(scope):
            i = 0
            while i < len(lst):
                if isinstance(lst[i], ast.For):
                    inits = induction(lst[i], ctx)
                    if inits:
                        lst[i:i] = inits
                        i += len(inits)
                        total += len(inits)
                i += 1
    return total
