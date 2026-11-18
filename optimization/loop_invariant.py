"""Loop-invariant code motion (numeric +,-,* expressions only, so hoisting can never raise)."""
import ast
import copy

from compiler.intermediate_representation import iter_scopes
from .common import (COMPS, SCOPE_NODES, Replacer, assign_stmt, names_in, safe_numeric, scope_lists, stores_in, unparse)


def invariant_exprs(node, variant, numeric, excluded, out):
    if isinstance(node, (ast.Lambda,) + COMPS + SCOPE_NODES):
        return
    if isinstance(node, ast.BinOp) and safe_numeric(node, numeric, excluded) and not (names_in(node) & variant) \
            and any(isinstance(x, ast.Name) for x in ast.walk(node)):
        out.append(node)
        return
    for ch in ast.iter_child_nodes(node):
        invariant_exprs(ch, variant, numeric, excluded, out)


def hoist(loop, numeric, ctx):
    variant = stores_in(loop)
    found = []
    for st in loop.body:
        invariant_exprs(st, variant, numeric, ctx.excluded, found)
    groups = {}
    for n in found:
        groups.setdefault(ast.dump(n), []).append(n)
    new = []
    for nodes in groups.values():
        temp = ctx.fresh("licm")
        expr = copy.deepcopy(nodes[0])
        rep = Replacer({id(n) for n in nodes}, temp)
        for i, st in enumerate(loop.body):
            loop.body[i] = rep.visit(st)
        stmt = assign_stmt(temp, expr, loop)
        new.append(stmt)
        ctx.log("licm", loop, "hoist", f"{unparse(expr)}  (inside loop)", f"{unparse(stmt)}  (before loop)",
                "The expression only uses variables that never change inside the loop, so it is computed once before the loop.")
    return new


def run(tree, ctx):
    if ctx.dynamic:
        return 0
    total = 0
    for scope, _ in iter_scopes(tree):
        numeric = ctx.numeric_for(scope)
        for lst in scope_lists(scope):
            i = 0
            while i < len(lst):
                st = lst[i]
                if isinstance(st, (ast.For, ast.While)):
                    new = hoist(st, numeric, ctx)
                    if new:
                        lst[i:i] = new
                        i += len(new)
                        total += len(new)
                i += 1
    return total
