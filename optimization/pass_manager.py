"""Optimization pass manager: ordering, fixed-point iteration, validation and rollback per pass."""
import ast
import time

from . import (function_inlining, constant_propagation, constant_folding, common_subexpression, copy_propagation,
               dead_code_elimination, loop_invariant, strength_reduction, loop_unrolling)
from .common import Context

PASS_TABLE = [
    ("inlining", function_inlining.run),
    ("constant_propagation", constant_propagation.run),
    ("constant_folding", constant_folding.run),
    ("cse", common_subexpression.run),
    ("copy_propagation", copy_propagation.run),
    ("dead_code", dead_code_elimination.run),
    ("loop_unrolling", loop_unrolling.run),
    ("licm", loop_invariant.run),
    ("strength_reduction", strength_reduction.run),
    ("unused_imports", dead_code_elimination.run_unused_imports),
]


def _clone_tree(value, memo=None):
    """Clone an AST and its mutable containers without copying immutable values."""
    if memo is None:
        memo = {}
    identity = id(value)
    if identity in memo:
        return memo[identity]
    if isinstance(value, ast.AST):
        clone = type(value).__new__(type(value))
        memo[identity] = clone
        for key, child in vars(value).items():
            setattr(clone, key, _clone_tree(child, memo))
        return clone
    if isinstance(value, list):
        clone = []
        memo[identity] = clone
        clone.extend(_clone_tree(child, memo) for child in value)
        return clone
    if isinstance(value, dict):
        clone = {}
        memo[identity] = clone
        clone.update((_clone_tree(key, memo), _clone_tree(child, memo)) for key, child in value.items())
        return clone
    if isinstance(value, set):
        clone = set()
        memo[identity] = clone
        clone.update(_clone_tree(child, memo) for child in value)
        return clone
    if isinstance(value, bytearray):
        clone = bytearray(value)
        memo[identity] = clone
        return clone
    if isinstance(value, tuple):
        clone = tuple(_clone_tree(child, memo) for child in value)
        memo[identity] = clone
        return clone
    return value


def _verify(tree):
    ast.fix_missing_locations(tree)
    compile(tree, "<optimized>", "exec")


def run_passes(tree, settings):
    ctx = Context(tree, settings)
    stats = {name: {"applied": 0, "runs": 0, "rolled_back": 0, "ms": 0.0, "error": None} for name, _ in PASS_TABLE}
    iterations = 0
    dirty = False
    for it in range(settings["iteration_limit"]):
        iterations = it + 1
        total = 0
        for name, fn in PASS_TABLE:
            if not settings["passes"].get(name):
                continue
            if dirty:
                ctx.refresh(tree)
                dirty = False
            backup = _clone_tree(tree)
            mark = len(ctx.changes)
            t0 = time.perf_counter()
            try:
                n = fn(tree, ctx) or 0
                if n:
                    _verify(tree)
            except Exception as exc:  # never let one pass break the whole run
                tree = backup
                del ctx.changes[mark:]
                stats[name]["rolled_back"] += 1
                stats[name]["error"] = f"{type(exc).__name__}: {exc}"[:200]
                n = 0
            st = stats[name]
            st["runs"] += 1
            st["applied"] += n
            st["ms"] += (time.perf_counter() - t0) * 1000
            total += n
            dirty = dirty or bool(n)
        if total == 0:
            break
    if dirty:
        ctx.refresh(tree)
    return tree, ctx, stats, iterations
