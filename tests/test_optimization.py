import ast
import time

from pipeline import optimize
from samples_gen import big_program


def opt(src, **s):
    return optimize(src, s or None)["optimized"]


def test_constant_folding_and_propagation():
    out = opt("a = 10\nb = a + 5\nprint(b)\nprint(10 + 20, 5 * 4)\n")
    assert "print(15)" in out and "print(30, 20)" in out


def test_dead_code_elimination():
    out = opt("x = 10\ny = 20\nz = 30\nprint(x)\n")
    assert "y" not in out and "z" not in out and "print(10)" in out


def test_copy_propagation():
    out = opt("def f(a):\n    b = a\n    c = b + 10\n    return c\n")
    assert "b" not in out.replace("return", "") and "a + 10" in out


def test_cse_with_numeric_operands():
    out = opt("def f(x: int, y: int):\n    a = x * y + 10\n    b = x * y + 20\n    return a + b\n")
    assert out.count("x * y") == 1


def test_cse_not_applied_to_unknown_types():
    out = opt("def f(x, y):\n    a = x * y + 10\n    b = x * y + 20\n    return a, b\n")
    assert out.count("x * y") == 2  # lists would be aliased


def test_licm():
    out = opt("def f(a: int, b: int, c: int, n: int):\n    for i in range(n):\n        r = a * b + c\n        print(r + i)\n")
    assert "_licm" in out and out.index("_licm") < out.index("for i")


def test_strength_reduction_induction_variable():
    out = opt("n = int(input())\nfor i in range(n):\n    x = i * 4\n    print(x)\n")
    assert "+= 4" in out


def test_loop_unrolling_keeps_final_loop_variable():
    out = opt("for i in range(3):\n    print(i)\nprint(i)\n")
    assert "for" not in out and "print(2)" in out


def test_inlining():
    out = opt("def sq(v):\n    return v * v\nprint(sq(6))\n")
    assert "print(36)" in out


def test_global_declared_names_are_not_propagated():
    src = "x = 1\ndef bump():\n    global x\n    x += 1\nbump()\nprint(x)\n"
    assert "print(x)" in opt(src)


def test_dynamic_features_disable_name_optimizations():
    src = "x = 5\nexec('x = 7')\nprint(x)\n"
    assert "print(x)" in opt(src)


def test_side_effect_rhs_is_kept():
    out = opt("def f():\n    unused = print('hi')\n    return 1\n")
    assert "print('hi')" in out


def test_unreachable_and_constant_branches():
    out = opt("def f(n):\n    if True:\n        return n\n    print('x')\n")
    assert "print" not in out


def test_optimized_code_always_compiles_and_is_idempotent():
    src = open("samples/demo_small.py").read()
    once = opt(src)
    compile(once, "x", "exec")
    twice = opt(once)
    compile(twice, "x", "exec")


def test_large_input_does_not_fail():
    src = big_program(1600)
    assert len(src.splitlines()) >= 1600
    t = time.time()
    r = optimize(src)
    assert r["static_validation"]["ok"] and time.time() - t < 30
    ast.parse(r["optimized"])


def test_pass_failure_rolls_back(monkeypatch=None):
    from optimization import pass_manager

    original = "x = 1\nprint(x)\n"

    def boom(tree, ctx):
        tree.body.clear()
        raise RuntimeError("boom")
    old = pass_manager.PASS_TABLE
    pass_manager.PASS_TABLE = [("dead_code", boom)]
    try:
        r = optimize(original)
    finally:
        pass_manager.PASS_TABLE = old
    assert r["optimized"] == original
    assert r["passes"]["dead_code"]["rolled_back"] >= 1


def test_ast_backup_clone_preserves_locations_and_is_independent():
    from optimization.pass_manager import _clone_tree

    tree = ast.parse("def f(x):\n    return x + 1\n")
    tree.metadata = {"labels": {"original"}}
    clone = _clone_tree(tree)
    assert ast.dump(clone, include_attributes=True) == ast.dump(tree, include_attributes=True)
    clone.body[0].body.clear()
    clone.metadata["labels"].add("copied")
    assert len(tree.body[0].body) == 1
    assert tree.metadata["labels"] == {"original"}
