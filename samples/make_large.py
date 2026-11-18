"""Generates samples/demo_large.py (600+ lines) – run: python samples/make_large.py"""
import os

HEAD = '"""Large generated stress program (600+ lines)."""\nimport math\n\n\n'
TEMPLATE = '''def block_{i}(n: int, data):
    base = {i} + 3 * 2
    alias = base
    total = 0
    for j in range(n):
        total += base * alias + j * 4
    p = n * base
    q = n * base + {i}
    seen = [1, 2, 3, {i}]
    hits = 0
    for d in data:
        if d in seen:
            hits += 1
    unused = base * 7
    if False:
        print("dead")
    if total > 100000:
        return total
    return total + p + q + hits


def helper_{i}(x):
    return x * x + {i}


def fact_{i}(n):
    return 1 if n <= 1 else n * fact_{i}(n - 1)


'''
tail = ["def main():", "    acc = 0", "    data = list(range(10))"]
parts = [HEAD]
N = 40
for i in range(N):
    parts.append(TEMPLATE.format(i=i))
    tail.append(f"    acc += block_{i}(5, data) + helper_{i}({i}) + fact_{i}(5)")
tail += ["    return acc", "", "", "def fib(n):", "    if n < 2:", "        return n", "    return fib(n - 1) + fib(n - 2)", "",
         "", 'if __name__ == "__main__":', "    print(main(), fib(15))", ""]
code = "".join(parts) + "\n".join(tail)
path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "demo_large.py")
open(path, "w").write(code)
print(len(code.splitlines()), "lines written to", path)
