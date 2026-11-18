"""Recursive recurrence patterns, Master Theorem analysis, and Memoization.
Demonstrates exponential recurrence O(2^n) detection and LRU cache recommendation."""

def fibonacci(n: int) -> int:
    # Recurrence: T(n) = T(n-1) + T(n-2) + O(1) -> O(2^n) exponential!
    # The recommendation engine suggests applying functools.lru_cache to reduce to O(n).
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

def binary_search(arr: list, target: int, low: int, high: int) -> int:
    # Recurrence: T(n) = T(n/2) + O(1) -> Master Theorem Case 2: O(log n)
    if low > high:
        return -1
    mid = (low + high) // 2
    if arr[mid] == target:
        return mid
    elif arr[mid] > target:
        return binary_search(arr, target, low, mid - 1)
    else:
        return binary_search(arr, target, mid + 1, high)

if __name__ == "__main__":
    print("Fibonacci(12):", fibonacci(12))
    sorted_items = [10, 20, 30, 40, 50, 60, 70, 80]
    print("Binary search for 50:", binary_search(sorted_items, 50, 0, len(sorted_items) - 1))
