"""Call graph, recursion detection and strongly connected components."""
import ast

from optimization.common import FUNC


def collect_functions(tree):
    """name -> FunctionDef (last definition wins; methods are keyed by their bare name)."""
    funcs = {}
    for n in ast.walk(tree):
        if isinstance(n, FUNC):
            funcs[n.name] = n
    return funcs


def callee_name(call):
    f = call.func
    if isinstance(f, ast.Name):
        return f.id
    if isinstance(f, ast.Attribute) and isinstance(f.value, ast.Name) and f.value.id in ("self", "cls"):
        return f.attr
    return None


def build_call_graph(tree):
    funcs = collect_functions(tree)
    edges = {name: set() for name in funcs}
    for name, fn in funcs.items():
        for n in ast.walk(fn):
            if isinstance(n, ast.Call):
                c = callee_name(n)
                if c in funcs:
                    edges[name].add(c)
    return funcs, edges


def sccs(edges):
    index, low, on, stack, out, counter = {}, {}, set(), [], [], [0]
    for root in edges:
        if root in index:
            continue
        work = [(root, iter(edges[root]))]
        index[root] = low[root] = counter[0]; counter[0] += 1
        stack.append(root); on.add(root)
        while work:
            v, it = work[-1]
            for w in it:
                if w not in index:
                    index[w] = low[w] = counter[0]; counter[0] += 1
                    stack.append(w); on.add(w)
                    work.append((w, iter(edges[w])))
                    break
                elif w in on:
                    low[v] = min(low[v], index[w])
            else:
                work.pop()
                if work:
                    low[work[-1][0]] = min(low[work[-1][0]], low[v])
                if low[v] == index[v]:
                    comp = []
                    while True:
                        w = stack.pop(); on.discard(w); comp.append(w)
                        if w == v:
                            break
                    out.append(comp)
    return out  # callees come before callers (reverse topological)


def call_graph_summary(tree):
    funcs, edges = build_call_graph(tree)
    comps = sccs(edges)
    recursive = {n for c in comps for n in c if len(c) > 1 or n in edges[n]}
    return {"nodes": [{"id": n, "recursive": n in recursive, "line": funcs[n].lineno} for n in funcs],
            "edges": [{"from": a, "to": b} for a, bs in edges.items() for b in sorted(bs)],
            "recursive": sorted(recursive), "order": [n for c in comps for n in c]}
