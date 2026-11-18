"""Searching-related recommendations (list membership, nested-loop search, dict.keys())."""
from .pattern_detection import detect_membership, detect_nested_loops, known_lists


def detect(scope):
    lists = known_lists(scope)
    return detect_membership(scope, lists) + [r for r in detect_nested_loops(scope) if r["kind"] == "nested_loop_search"]
