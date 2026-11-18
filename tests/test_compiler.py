import ast
import pytest

from compiler.lexer import tokenize_source
from compiler.parser import parse_source, SourceError, ast_summary
from compiler.semantic_analyzer import analyze_semantics
from compiler.intermediate_representation import build_scope_cfg
from compiler.ssa import to_ssa

LOOP = "x = 1\nfor i in range(10):\n    if i % 2:\n        x = x + i\n    else:\n        x = x - 1\nprint(x)\n"


def test_lexer_categories():
    t = tokenize_source("def f(a):\n    return a + 1  # c\n")
    assert t["counts"]["Keywords"] == 2 and t["counts"]["Operators"] == 1 and t["counts"]["Comments"] == 1


def test_syntax_error_reports_line():
    with pytest.raises(SourceError) as e:
        parse_source("x = (1\ny = 2\n")
    assert e.value.lineno


def test_ast_summary_counts():
    s = ast_summary(parse_source(LOOP))
    assert s["structure"]["Loops"] == 1 and s["structure"]["Conditionals"] == 1


def test_semantics_finds_issues():
    code = "import os\ndef f():\n    unused = 1\n    return missing\n"
    s = analyze_semantics(ast.parse(code), code)
    assert [i["name"] for i in s["unused_imports"]] == ["os"]
    assert any(i["name"] == "missing" for i in s["undefined_names"])
    assert any(i["name"] == "unused" for i in s["unused_variables"])


def test_cfg_loop_and_dominators():
    cfg = build_scope_cfg(ast.parse(LOOP))
    info = cfg.analyze()
    assert len(info["loops"]) == 1 and info["back_edges"]


def test_unreachable_block_detected():
    cfg = build_scope_cfg(ast.parse("def f():\n    return 1\n    x = 2\n").body[0])
    assert cfg.analyze()["unreachable"]


def test_ssa_places_phi_at_merge():
    s = to_ssa(build_scope_cfg(ast.parse(LOOP)))
    assert s["phi_count"] >= 2
    assert s["versions"]["x"] >= 3
