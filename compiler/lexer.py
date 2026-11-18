"""Lexical analysis built on Python's ``tokenize`` module."""
import io
import keyword
import tokenize
from collections import Counter

SPECIAL = set("()[]{},:;.@") | {"->", "...", ":="}
CONSTANT_KW = {"True", "False", "None"}


def categorize(tok):
    t = tok.type
    if t == tokenize.NAME:
        if tok.string in CONSTANT_KW:
            return "Constants"
        return "Keywords" if keyword.iskeyword(tok.string) else "Identifiers"
    if t == tokenize.NUMBER:
        return "Constants"
    if t == tokenize.STRING or tokenize.tok_name.get(t, "").startswith("FSTRING"):
        return "Literals"
    if t == tokenize.OP:
        return "Special symbols" if tok.string in SPECIAL else "Operators"
    return None


def tokenize_source(code, row_limit=400):
    """Return token statistics and the first ``row_limit`` tokens."""
    counts, rows, total, error = Counter(), [], 0, None
    try:
        for tok in tokenize.generate_tokens(io.StringIO(code).readline):
            if tok.type == tokenize.COMMENT:
                counts["Comments"] += 1
                continue
            cat = categorize(tok)
            if cat is None:
                continue
            counts[cat] += 1
            total += 1
            if len(rows) < row_limit:
                rows.append({"line": tok.start[0], "col": tok.start[1], "type": cat, "text": tok.string[:60]})
    except (tokenize.TokenError, IndentationError, SyntaxError) as exc:
        error = str(exc)
    order = ["Keywords", "Identifiers", "Operators", "Constants", "Literals", "Special symbols", "Comments"]
    return {"total": total, "counts": {k: counts.get(k, 0) for k in order}, "rows": rows,
            "truncated": total > row_limit, "error": error}
