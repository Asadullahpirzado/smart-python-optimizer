"""Generic inefficiency patterns (repeated work, string building, queue misuse, ...)."""
import ast

from optimization.common import FUNC, LOOPS, COMPS, stores_in, unparse, walk_scope, const_value, NOT_CONST
from analyzer.call_graph import callee_name

LIST_MAKERS = {"list", "sorted", "split", "splitlines"}


def known_lists(scope):
    names = set()
    for n in walk_scope(scope):
        if isinstance(n, ast.Assign) and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name):
            v = n.value
            if isinstance(v, (ast.List, ast.ListComp, ast.Tuple)) or (isinstance(v, ast.Call) and callee_name(v) in LIST_MAKERS) \
                    or (isinstance(v, ast.Call) and isinstance(v.func, ast.Attribute) and v.func.attr in LIST_MAKERS):
                names.add(n.targets[0].id)
    if isinstance(scope, FUNC):
        for a in scope.args.args:
            if a.annotation is not None and unparse(a.annotation).lower().startswith(("list", "tuple")):
                names.add(a.arg)
    return names


def loop_bodies(scope):
    """(loop node, nodes inside loop) for loops and comprehensions of one scope."""
    for n in walk_scope(scope):
        if isinstance(n, LOOPS):
            yield n, [x for b in n.body for x in ast.walk(b)]
        elif isinstance(n, COMPS):
            yield n, list(ast.walk(n))


def rec(kind, node, scope, title, current, suggested, orig, new, why, code, safety="suggested", applicable=False):
    name = scope.name if isinstance(scope, FUNC) else "<module>"
    line = getattr(node, "lineno", 0)
    return {"id": f"{kind}:{name}:{line}", "kind": kind, "title": title, "lineno": line, "function": name,
            "current": current, "suggested": suggested, "original_complexity": orig, "improved_complexity": new,
            "explanation": why, "alternative_code": code, "safety": safety, "applicable": applicable}


def detect_membership(scope, lists):
    out, seen = [], set()
    for loop, nodes in loop_bodies(scope):
        for n in nodes:
            if isinstance(n, ast.Compare):
                for op, comp in zip(n.ops, n.comparators):
                    if not isinstance(op, (ast.In, ast.NotIn)):
                        continue
                    if isinstance(comp, ast.Name) and comp.id in lists and comp.id not in stores_in(loop) and (comp.id, n.lineno) not in seen:
                        seen.add((comp.id, n.lineno))
                        nm = comp.id
                        out.append(rec("list_membership", n, scope, f"Repeated membership test on list `{nm}`",
                                       f"`{unparse(n)}` scans the whole list on every iteration",
                                       f"Build a set once: `{nm}_set = set({nm})` and test against it",
                                       "O(n·m)", "O(n + m)",
                                       "List membership is linear; set membership is O(1) on average. Elements must be hashable, and the set does not keep order or duplicates (only matters if you iterate it).",
                                       f"{nm}_set = set({nm})          # build once, O(m)\n# ...inside the loop:\n{unparse(n).replace(nm, nm + '_set', 1) if nm in unparse(n) else unparse(n)}"))
                    elif isinstance(comp, ast.Call) and isinstance(comp.func, ast.Attribute) and comp.func.attr == "keys" and not comp.args:
                        out.append(rec("dict_keys_membership", n, scope, "Membership test on `.keys()`",
                                       f"`{unparse(n)}`", "Test the dictionary directly: `key in d`", "O(1)", "O(1)",
                                       "`key in d` is idiomatic and avoids creating a keys view.", unparse(n).replace(".keys()", "")))
    return out


def detect_nested_loops(scope):
    out = []
    for loop in [n for n in walk_scope(scope) if isinstance(n, ast.For) and isinstance(n.target, ast.Name)]:
        for inner in [x for b in loop.body for x in ast.walk(b) if isinstance(x, ast.For) and isinstance(x.target, ast.Name)]:
            a, b = loop.target.id, inner.target.id
            for cmp in [x for s in inner.body for x in ast.walk(s) if isinstance(x, ast.Compare)]:
                if len(cmp.ops) != 1 or not isinstance(cmp.ops[0], (ast.Eq,)):
                    continue
                ln = {n.id for n in ast.walk(cmp.left) if isinstance(n, ast.Name)}
                rn = {n.id for n in ast.walk(cmp.comparators[0]) if isinstance(n, ast.Name)}
                idx_loop = isinstance(loop.iter, ast.Call) and callee_name(loop.iter) == "range"
                if idx_loop and isinstance(cmp.left, ast.Subscript) and isinstance(cmp.comparators[0], ast.Subscript) \
                        and unparse(cmp.left.value) == unparse(cmp.comparators[0].value) and {a, b} <= (ln | rn):
                    base = unparse(cmp.left.value)
                    out.append(rec("duplicate_detection", loop, scope, f"Nested-loop duplicate detection on `{base}`",
                                   "Every pair of elements is compared", "Use a set to detect duplicates in one pass", "O(n²)", "O(n)",
                                   "Hash-based lookup finds duplicates in a single pass. Requires hashable elements; use `len(set(x)) != len(x)` for a yes/no answer.",
                                   f"seen = set()\nfor item in {base}:\n    if item in seen:\n        has_duplicate = True\n        break\n    seen.add(item)"))
                elif a in ln | rn and b in ln | rn and a != b:
                    out.append(rec("nested_loop_search", loop, scope, "Nested-loop search / matching",
                                   f"`{unparse(cmp)}` is evaluated for every pair `({a}, {b})`",
                                   "Index one collection in a dict/set, then look up each item of the other", "O(n·m)", "O(n + m)",
                                   "Hash-based lookup replaces the inner scan. Equality must be consistent with hashing; ordering of matches may change.",
                                   f"lookup = {{ {b}_key: {b} for {b} in {unparse(inner.iter)} }}   # choose the compared key\nfor {a} in {unparse(loop.iter)}:\n    match = lookup.get({a}_key)"))
    return out


def detect_repeated(scope, lists):
    out, seen = [], set()
    for loop, nodes in loop_bodies(scope):
        changed = stores_in(loop) if not isinstance(loop, COMPS) else set()
        for n in nodes:
            if not isinstance(n, ast.Call):
                continue
            fname = n.func.id if isinstance(n.func, ast.Name) else None
            attr = n.func.attr if isinstance(n.func, ast.Attribute) else None
            arg0 = n.args[0] if n.args else None
            base = n.func.value if isinstance(n.func, ast.Attribute) else None
            if fname == "sorted" and isinstance(arg0, ast.Name) and arg0.id not in changed:
                key = ("repeated_sort", arg0.id)
                if key not in seen:
                    seen.add(key)
                    out.append(rec("repeated_sort", n, scope, f"`sorted({arg0.id})` inside a loop", "The same list is re-sorted every iteration",
                                   "Sort once before the loop", "O(n² log n)", "O(n log n)", "The list is not modified in the loop, so the sorted result never changes.",
                                   f"{arg0.id}_sorted = sorted({arg0.id})\nfor ...:\n    use {arg0.id}_sorted"))
            elif fname in ("min", "max", "sum") and isinstance(arg0, ast.Name) and arg0.id not in changed and len(n.args) == 1:
                key = ("repeated_aggregate", arg0.id, fname)
                if key not in seen:
                    seen.add(key)
                    out.append(rec("repeated_aggregate", n, scope, f"`{fname}({arg0.id})` recomputed in a loop", "A full scan runs on every iteration",
                                   "Compute once before the loop", "O(n²)", "O(n)", "The argument is unchanged inside the loop, so the result is loop-invariant.",
                                   f"{fname}_{arg0.id} = {fname}({arg0.id})\nfor ...:\n    use {fname}_{arg0.id}"))
            elif attr in ("count", "index") and base is not None and isinstance(base, ast.Name):
                key = ("repeated_lookup", base.id, attr)
                if key not in seen:
                    seen.add(key)
                    fix = "collections.Counter" if attr == "count" else "a dict mapping value → index"
                    out.append(rec("repeated_lookup", n, scope, f"`{base.id}.{attr}(...)` inside a loop", f"Each call scans `{base.id}` linearly",
                                   f"Precompute {fix}", "O(n²)", "O(n)", "A single pass builds a lookup table that answers every query in O(1).",
                                   "from collections import Counter\ncounts = Counter(%s)\n# counts[x] replaces %s.count(x)" % (base.id, base.id) if attr == "count"
                                   else f"index_of = {{v: i for i, v in reversed(list(enumerate({base.id})))}}\n# index_of[x] replaces {base.id}.index(x)"))
            elif (attr == "pop" and n.args and const_value(n.args[0]) == 0) or (attr == "insert" and n.args and const_value(n.args[0]) == 0):
                key = ("queue_misuse", unparse(base))
                if key not in seen:
                    seen.add(key)
                    out.append(rec("data_structure_deque", n, scope, "List used as a queue", f"`{unparse(n)}` shifts every element",
                                   "Use collections.deque (popleft / appendleft)", "O(n²)", "O(n)", "Removing from the front of a list is O(n); deque does it in O(1).",
                                   f"from collections import deque\nq = deque({unparse(base)})\nq.popleft()   # O(1)"))
            elif fname in ("min", "max") and isinstance(arg0, ast.Name) and arg0.id in changed and isinstance(loop, ast.While):
                key = ("heap", arg0.id)
                if key not in seen:
                    seen.add(key)
                    out.append(rec("data_structure_heap", n, scope, f"Repeated `{fname}()` over a shrinking list", "Priority extraction by scanning the list",
                                   "Use heapq as a priority queue", "O(n²)", "O(n log n)", "A binary heap extracts the extreme element in O(log n).",
                                   f"import heapq\nheapq.heapify({arg0.id})\nitem = heapq.heappop({arg0.id})"))
    return out


def detect_string_concat(scope):
    out = []
    strs = {n.targets[0].id for n in walk_scope(scope) if isinstance(n, ast.Assign) and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name)
            and isinstance(n.value, ast.Constant) and isinstance(n.value.value, str)}
    for loop, _ in loop_bodies(scope):
        if isinstance(loop, COMPS):
            continue
        for n in [x for b in loop.body for x in ast.walk(b)]:
            if isinstance(n, ast.AugAssign) and isinstance(n.op, ast.Add) and isinstance(n.target, ast.Name) and n.target.id in strs:
                out.append(rec("string_concat", n, scope, f"String `{n.target.id}` built with += in a loop", "Repeated concatenation may copy the string each time",
                               "Collect parts in a list and use ''.join()", "O(n²) worst case", "O(n)", "str.join builds the result once.",
                               f"parts = []\nparts.append(piece)   # inside loop\n{n.target.id} = ''.join(parts)"))
                break
    return out


def detect_sort_for_extreme(scope):
    out = []
    for n in walk_scope(scope):
        if isinstance(n, ast.Subscript) and isinstance(n.value, ast.Call) and callee_name(n.value) == "sorted" and const_value(n.slice) in (0, -1):
            which = "min" if const_value(n.slice) == 0 else "max"
            out.append(rec("sort_for_extreme", n, scope, "Sorting only to read the smallest/largest item", f"`{unparse(n)}`",
                           f"Use {which}(...)", "O(n log n)", "O(n)", f"`{which}()` needs a single pass.",
                           f"{which}({unparse(n.value.args[0]) if n.value.args else '...'})"))
    return out
