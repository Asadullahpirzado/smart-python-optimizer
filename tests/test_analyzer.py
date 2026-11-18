import ast

from analyzer.space_complexity import complexity_report
from analyzer.call_graph import call_graph_summary
from algorithm_optimizer.recommendation_engine import recommend


def cx(src):
    return {f["name"]: f for f in complexity_report(ast.parse(src))["functions"]}


def test_loops():
    r = cx("def a(x):\n    for i in x:\n        for j in x:\n            pass\ndef b(x):\n    for i in x:\n        pass\n    for j in x:\n        pass\ndef c(x):\n    return 1\n")
    assert r["a"]["time"] == "O(n²)" and r["b"]["time"] == "O(n)" and r["c"]["time"] == "O(1)"


def test_logarithmic_while():
    assert cx("def f(n):\n    while n > 1:\n        n //= 2\n")["f"]["time"] == "O(log n)"


def test_fibonacci_exponential():
    r = cx("def fib(n):\n    if n < 2:\n        return n\n    return fib(n-1) + fib(n-2)\n")["fib"]
    assert r["time"] == "O(2ⁿ)" and "T(n) = 2T(n-1)" in r["recurrence"]


def test_merge_sort_master_theorem():
    src = '''def ms(a):
    if len(a) <= 1:
        return a
    mid = len(a) // 2
    l = ms(a[:mid])
    r = ms(a[mid:])
    out = []
    i = j = 0
    while i < len(l) and j < len(r):
        if l[i] < r[j]:
            out.append(l[i]); i += 1
        else:
            out.append(r[j]); j += 1
    return out + l[i:] + r[j:]
'''
    r = cx(src)["ms"]
    assert r["time"] == "O(n log n)" and "Master Theorem" in r["recurrence"]


def test_binary_search_is_logarithmic():
    src = "def bs(a, x, lo, hi):\n    if lo > hi:\n        return -1\n    mid = (lo + hi) // 2\n    if a[mid] == x:\n        return mid\n    if a[mid] < x:\n        return bs(a, x, mid + 1, hi)\n    return bs(a, x, lo, mid - 1)\n"
    assert cx(src)["bs"]["time"] == "O(log n)"


def test_space_of_list_building():
    r = cx("def f(n):\n    out = []\n    for i in range(n):\n        out.append(i)\n    return out\n")["f"]
    assert r["space"] == "O(n)"


def test_mutual_recursion_marked_manual():
    r = cx("def a(n):\n    return b(n-1)\ndef b(n):\n    return a(n-1)\n")
    assert r["a"]["manual"]


def test_call_graph_recursion():
    g = call_graph_summary(ast.parse("def f(n):\n    return f(n-1)\ndef g():\n    return f(1)\n"))
    assert g["recursive"] == ["f"]


def test_recommendations():
    kinds = {r["kind"] for r in recommend(ast.parse('''
def f(items, data):
    seen = [1, 2, 3]
    for x in data:
        if x in seen:
            pass
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            if items[i] == items[j]:
                return True
def fib(n):
    return n if n < 2 else fib(n-1) + fib(n-2)
'''))}
    assert {"list_membership", "duplicate_detection", "memoization"} <= kinds
