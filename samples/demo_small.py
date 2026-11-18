"""Small demo exercising many optimizations."""
import os
import math


def square(v):
    return v * v


def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)


def has_duplicates(items):
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            if items[i] == items[j]:
                return True
    return False


def common(data, wanted):
    seen = [1, 2, 3, 4, 5, 6, 7, 8]
    hits = 0
    for x in data:
        if x in seen:
            hits += 1
    return hits


def compute(a: int, b: int, c: int, n: int) -> int:
    total = 0
    for i in range(n):
        total += a * b + c + i * 4
    t = a * b + 10
    u = a * b + 20
    scratch = c * 99
    return total + t + u


x = 10 + 20
y = x * 2
for k in range(4):
    print(k * 3, y)
if False:
    print("never runs")
print(square(7), fib(15), has_duplicates([1, 2, 3, 1]), common(list(range(20)), None))
print(compute(2, 3, 4, 10))
