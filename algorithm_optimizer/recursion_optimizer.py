"""Recursion recommendations: memoization / iterative rewrite, plus auto-apply of lru_cache."""
import ast

from analyzer.call_graph import build_call_graph, callee_name
from analyzer.time_complexity import TimeAnalyzer
from optimization.common import FUNC, unparse
from .pattern_detection import rec

PURE_CALLS = {"abs", "min", "max", "len", "int", "float", "range", "sum", "sorted", "str", "bool", "round"}
MEMO_DECOS = ("lru_cache", "cache", "memoize")


def is_pure_function(fn):
    for n in ast.walk(fn):
        if isinstance(n, (ast.Global, ast.Nonlocal, ast.Yield, ast.YieldFrom, ast.Await, ast.Delete)):
            return False
        if isinstance(n, ast.Call):
            nm = callee_name(n)
            if not (isinstance(n.func, ast.Name) and (nm == fn.name or nm in PURE_CALLS)):
                return False
        if isinstance(n, (ast.Attribute,)) and isinstance(n.ctx, ast.Store):
            return False
        if isinstance(n, ast.Subscript) and isinstance(n.ctx, ast.Store):
            return False
    return True


def detect(tree, ta: TimeAnalyzer, methods):
    out = []
    for name, fn in ta.funcs.items():
        if any(any(m in unparse(d) for m in MEMO_DECOS) for d in fn.decorator_list):
            continue
        ta._cur = name
        a, in_loop, calls = ta.self_calls(fn)
        ta._cur = None
        if a >= 2 and not in_loop:
            orig = str(ta.costs[name])
            pure = is_pure_function(fn) and name not in methods and len(fn.args.args) <= 3 and not fn.args.defaults
            out.append(rec("memoization", fn, fn, f"`{name}` solves the same subproblems repeatedly",
                           f"{a} recursive calls per invocation ({orig})", "Memoize with functools.lru_cache (top-down dynamic programming)",
                           orig, "O(n)" if "ⁿ" in orig else "fewer repeated calls",
                           "Caching results by argument turns exponential branching into one computation per distinct input. Arguments must be hashable; the function must be pure.",
                           f"from functools import lru_cache\n\n@lru_cache(maxsize=None)\ndef {name}(...):\n    ...",
                           "suggested", pure))
        elif a == 1 and not in_loop and name not in methods:
            tail = any(isinstance(s, ast.Return) and isinstance(s.value, ast.Call) and callee_name(s.value) == name for s in ast.walk(fn))
            if tail:
                out.append(rec("tail_recursion", fn, fn, f"`{name}` is tail-recursive", "Each call adds a stack frame (O(n) stack)",
                               "Rewrite as a loop (Python does not eliminate tail calls)", "O(n) stack", "O(1) stack",
                               "An iterative version avoids deep recursion and RecursionError for large inputs.",
                               f"def {name}(...):\n    while True:\n        ...  # update arguments instead of recursing", "manual"))
    return out


def apply_memoization(tree, ctx, targets):
    """Decorate approved functions with functools.lru_cache. Returns number applied."""
    n = 0
    names = {t.split(":")[1] for t in targets if t.startswith("memoization:")}
    if not names:
        return 0
    for st in tree.body:
        if isinstance(st, ast.FunctionDef) and st.name in names and not st.decorator_list and is_pure_function(st):
            deco = ast.parse("functools.lru_cache(maxsize=None)", mode="eval").body
            st.decorator_list.append(deco)
            n += 1
            ctx.log("recommendations", st, "memoize", f"def {st.name}(...)", f"@functools.lru_cache(maxsize=None)\ndef {st.name}(...)",
                    "Applied with your approval: repeated recursive subproblems are now cached.", "suggested")
    if n:
        pos = 0
        for i, s in enumerate(tree.body):
            if (isinstance(s, ast.Expr) and isinstance(s.value, ast.Constant) and isinstance(s.value.value, str)) or \
                    (isinstance(s, ast.ImportFrom) and s.module == "__future__"):
                pos = i + 1
        tree.body.insert(pos, ast.parse("import functools").body[0])
    return n
