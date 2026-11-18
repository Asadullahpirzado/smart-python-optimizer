"""Common subexpression elimination inside straight-line runs of simple statements."""
import ast
import copy

from compiler.intermediate_representation import iter_scopes
from .common import (COMPS, Replacer, assign_stmt, names_in, node_count, safe_numeric, scope_lists, stores_in, unparse)

SIMPLE = (ast.Assign, ast.AugAssign, ast.AnnAssign, ast.Expr, ast.Return)


def candidates(st, numeric, excluded):
    out, stack = [], [st]
    while stack:
        n = stack.pop()
        if isinstance(n, (ast.Lambda,) + COMPS):
            continue
        if isinstance(n, ast.BinOp) and safe_numeric(n, numeric, excluded) and any(isinstance(x, ast.Name) for x in ast.walk(n)):
            out.append(n)
        stack.extend(ast.iter_child_nodes(n))
    return out


def cse_run(run, numeric, ctx):
    changes = 0
    for _ in range(40):
        occ = {}
        for idx, st in enumerate(run):
            if any(isinstance(x, ast.NamedExpr) for x in ast.walk(st)):
                continue
            for node in candidates(st, numeric, ctx.excluded):
                occ.setdefault(ast.dump(node), []).append((idx, node))
        best = None
        for items in occ.values():
            items.sort(key=lambda t: t[0])
            ops = names_in(items[0][1])
            groups = [[items[0]]]
            for prev, nxt in zip(items, items[1:]):
                if any(stores_in(run[k]) & ops for k in range(prev[0], nxt[0])):
                    groups.append([nxt])
                else:
                    groups[-1].append(nxt)
            for g in groups:
                if len(g) >= 2:
                    size = node_count(g[0][1])
                    if best is None or size > best[0]:
                        best = (size, g)
        if not best:
            break
        g = best[1]
        first = g[0][0]
        temp = ctx.fresh("cse")
        expr = copy.deepcopy(g[0][1])
        before = unparse(run[first])
        rep = Replacer({id(n) for _, n in g}, temp)
        for idx in sorted({i for i, _ in g}):
            run[idx] = rep.visit(run[idx])
        new = assign_stmt(temp, expr, run[first])
        run.insert(first, new)
        ctx.log("cse", run[first + 1], "cse", before, f"{unparse(new)};  {unparse(run[first + 1])}",
                f"`{unparse(expr)}` was computed {len(g)} times with unchanged operands; it is now computed once into `{temp}`.")
        changes += 1
    return changes


def run(tree, ctx):
    if ctx.dynamic:
        return 0
    total = 0
    for scope, _ in iter_scopes(tree):
        numeric = ctx.numeric_for(scope)
        for lst in scope_lists(scope):
            runs, i = [], 0
            while i < len(lst):
                if isinstance(lst[i], SIMPLE):
                    j = i
                    while j < len(lst) and isinstance(lst[j], SIMPLE):
                        j += 1
                    runs.append((i, j))
                    i = j
                else:
                    i += 1
            for i, j in reversed(runs):
                chunk = lst[i:j]
                n = cse_run(chunk, numeric, ctx)
                if n:
                    lst[i:j] = chunk
                    total += n
    return total
