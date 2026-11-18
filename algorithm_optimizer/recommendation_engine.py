"""Aggregates all algorithmic recommendations."""
import ast

from analyzer.call_graph import callee_name
from analyzer.time_complexity import TimeAnalyzer
from compiler.intermediate_representation import iter_scopes
from optimization.common import FUNC
from . import pattern_detection as pd, searching_optimizer, duplicate_detection, recursion_optimizer


def recommend(tree):
    ta = TimeAnalyzer(tree)
    methods = {m.name for c in ast.walk(tree) if isinstance(c, ast.ClassDef) for m in c.body if isinstance(m, FUNC)}
    recs = []
    for scope, _ in iter_scopes(tree):
        lists = pd.known_lists(scope)
        recs += pd.detect_membership(scope, lists)
        recs += pd.detect_nested_loops(scope)
        recs += pd.detect_repeated(scope, lists)
        recs += pd.detect_string_concat(scope)
        recs += pd.detect_sort_for_extreme(scope)
    recs += recursion_optimizer.detect(tree, ta, methods)
    seen, out = set(), []
    for r in recs:
        if r["id"] not in seen:
            seen.add(r["id"])
            out.append(r)
    out.sort(key=lambda r: r["lineno"])
    return out
