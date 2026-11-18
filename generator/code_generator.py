"""Optimized source generation and diffing."""
import ast
import difflib


_BLOCKS = (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)


def generate_code(tree):
    """Readable output: each top-level statement is unparsed separately so PEP 8 blank lines can be added safely."""
    ast.fix_missing_locations(tree)
    out, prev_block = [], False
    for i, st in enumerate(tree.body):
        text = ast.unparse(st)
        block = isinstance(st, _BLOCKS) or isinstance(st, (ast.If, ast.For, ast.While, ast.Try, ast.With))
        if out and (block or prev_block):
            out.append("\n" if isinstance(st, _BLOCKS) or isinstance(tree.body[i - 1], _BLOCKS) else "")
        out.append(text)
        prev_block = block
    return "\n".join(out) + "\n"


def build_diff(before_text, after_text):
    a, b = before_text.splitlines(), after_text.splitlines()
    ops = []
    # Let difflib's popular-line heuristic run on large modules. Disabling it
    # makes repeated boilerplate trigger quadratic work and can freeze the UI.
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=True).get_opcodes():
        if tag != "equal":
            ops.append({"tag": tag, "a": [i1 + 1, i2], "b": [j1 + 1, j2]})
    return ops


def unified(before_text, after_text, n=2):
    return "\n".join(difflib.unified_diff(before_text.splitlines(), after_text.splitlines(), "original", "optimized", lineterm="", n=n))
