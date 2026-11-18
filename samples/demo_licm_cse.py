"""Loop Invariant Code Motion (LICM) and Common Subexpression Elimination (CSE).
Demonstrates hoisting loop-invariant computations and reusing common terms."""

def matrix_process(data: list, scale_a: int, scale_b: int, offset: int) -> int:
    total = 0
    # a * b + offset does not depend on loop variable 'i' -> hoisted before the loop!
    for i in range(len(data)):
        inv_calc = scale_a * scale_b + offset
        total += data[i] + inv_calc

    # Common subexpressions (scale_a * scale_b):
    sub1 = scale_a * scale_b + 10
    sub2 = scale_a * scale_b + 20
    sub3 = scale_a * scale_b + 30
    
    return total + sub1 + sub2 + sub3

if __name__ == "__main__":
    nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    out = matrix_process(nums, 5, 8, 12)
    print("Processed result:", out)
