"""Constant folding and dead code elimination test case.
Evaluates arithmetic reductions, dead branch pruning, and dead stores."""

def compute_constants():
    # Constant expressions folded at compile-time:
    seconds_in_day = 60 * 60 * 24
    pi_approx = 22 / 7
    folded_math = 10 + 20 * 3 - (15 // 3)
    
    # Dead variables (never read) - dead code elimination removes them:
    unused_debug_string = "temporary log message that is not used"
    dead_counter = 100 * 2
    
    # Constant propagation into expressions:
    base = 100
    tax = base * 0.15
    total = base + tax
    
    # Unreachable branch elimination:
    if 2 + 2 == 5:
        print("This branch is unreachable and will be eliminated!")
    else:
        status = "normal"
        
    return total, seconds_in_day, status

if __name__ == "__main__":
    result, day_sec, st = compute_constants()
    print("Result:", result, "Day seconds:", day_sec, "Status:", st)
