"""Regression suite: known programs must keep their behaviour after optimization."""
from pipeline import optimize
from .differential_testing import run_validation

CASES = {
    "constants_and_loops": '''
x = 10 + 20
y = x * 2
for i in range(5):
    z = i * 4
    print(z, y)
total = 0
for i in range(3):
    total += i * 2
print(total)
''',
    "functions_and_recursion": '''
def square(v):
    return v * v

def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

def calc(a: int, b: int) -> int:
    t = a * b + 1
    u = a * b + 2
    return t + u

print(square(7), fib(12), calc(3, 4))
''',
    "dead_code_and_branches": '''
def f(n):
    unused = n * 3
    if False:
        print("never")
    k = 5
    if k > 3:
        return n + k
    return 0
    print("unreachable")

print(f(10))
''',
    "loops_with_invariants": '''
def g(a: int, b: int, c: int, n: int):
    out = []
    for i in range(n):
        out.append(a * b + c + i)
    return out

print(g(2, 3, 4, 6))
''',
    "copy_chain": '''
def h(n):
    a = n
    b = a
    c = b + 1
    return c * c

print(h(4))
''',
}


def run_regression(settings=None, use_hypothesis=False):
    results = []
    for name, src in CASES.items():
        opt = optimize(src, settings, name)
        val = run_validation(src, opt["optimized"], settings, use_hypothesis=use_hypothesis)
        results.append({"name": name, "ok": bool(val.get("ok")), "changes": len(opt["changes"]),
                        "problems": val.get("problems") or ([val["error"]] if "error" in val else [])})
    return {"ok": all(r["ok"] for r in results), "cases": results}
