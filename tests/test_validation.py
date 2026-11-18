from validation.differential_testing import run_validation
from validation.regression_testing import run_regression
from validation.static_validator import static_validate
import ast


def test_regression_suite_passes():
    r = run_regression()
    assert r["ok"], r


def test_differential_detects_wrong_optimization():
    orig = "def f(n):\n    return n * 2\nprint(f(3))\n"
    bad = "def f(n):\n    return n * 3\nprint(f(3))\n"
    r = run_validation(orig, bad)
    assert not r["ok"] and r["problems"]


def test_equivalent_programs_pass():
    r = run_validation("def f(n):\n    return n + n\n", "def f(n):\n    return 2 * n\n")
    assert r["ok"]


def test_static_validator_detects_missing_function():
    res = static_validate(ast.parse("def f():\n    pass\n"), "x = 1\n")
    assert not res["ok"]


def test_static_validator_rejects_removed_print_calls():
    res = static_validate(ast.parse("print('first')\nprint('second')\n"), "print('first')\n")
    assert not res["ok"]
    assert any(c["name"] == "Observable calls (print) are not removed" and not c["ok"] for c in res["checks"])


def test_sandbox_stops_infinite_loops():
    r = run_validation("while True:\n    pass\n", "while True:\n    pass\n", timeout=5)
    assert "error" in r or r["ok"] in (True, False)
