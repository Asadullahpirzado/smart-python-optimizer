"""Duplicate-detection recommendations."""
from .pattern_detection import detect_nested_loops


def detect(scope):
    return [r for r in detect_nested_loops(scope) if r["kind"] == "duplicate_detection"]
