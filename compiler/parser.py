"""Syntax analysis: parse source into an AST and summarise it."""
import ast
import sys
from collections import Counter


class SourceError(Exception):
    def __init__(self, message, lineno=None, col=None):
        super().__init__(message)
        self.message, self.lineno, self.col = message, lineno, col

    def to_dict(self):
        return {"message": self.message, "lineno": self.lineno, "col": self.col}


def parse_source(code):
    sys.setrecursionlimit(max(sys.getrecursionlimit(), 20000))
    if not code or not code.strip():
        raise SourceError("The source code is empty.")
    try:
        return ast.parse(code)
    except SyntaxError as exc:
        raise SourceError(f"Syntax error: {exc.msg}", exc.lineno, exc.offset) from exc
    except (RecursionError, MemoryError):
        raise SourceError("The program is too deeply nested to parse.")
    except ValueError as exc:
        raise SourceError(f"Invalid source: {exc}")


def _label(node):
    extra = ""
    for f in ("name", "id", "attr", "arg"):
        if hasattr(node, f) and isinstance(getattr(node, f), str):
            extra = f" {getattr(node, f)}"
            break
    else:
        if isinstance(node, ast.Constant):
            extra = " " + repr(node.value)[:20]
        elif isinstance(node, (ast.BinOp, ast.UnaryOp, ast.BoolOp, ast.AugAssign)):
            extra = " " + type(node.op).__name__
    return type(node).__name__ + extra


def ast_outline(tree, budget=350, max_depth=5):
    used = [0]

    def build(node, depth):
        used[0] += 1
        item = {"label": _label(node), "line": getattr(node, "lineno", None), "children": []}
        if depth < max_depth:
            for child in ast.iter_child_nodes(node):
                if isinstance(child, (ast.expr_context, ast.operator, ast.cmpop, ast.boolop, ast.unaryop)):
                    continue
                if used[0] >= budget:
                    item["children"].append({"label": "…", "line": None, "children": []})
                    break
                item["children"].append(build(child, depth + 1))
        return item

    return build(tree, 0)


def ast_summary(tree):
    counts = Counter(type(n).__name__ for n in ast.walk(tree))
    structure = {
        "Functions": counts.get("FunctionDef", 0) + counts.get("AsyncFunctionDef", 0),
        "Classes": counts.get("ClassDef", 0),
        "Loops": counts.get("For", 0) + counts.get("While", 0) + counts.get("AsyncFor", 0),
        "Conditionals": counts.get("If", 0) + counts.get("IfExp", 0),
        "Function calls": counts.get("Call", 0),
        "Expressions": sum(v for k, v in counts.items() if k in ("BinOp", "UnaryOp", "BoolOp", "Compare")),
        "Assignments": counts.get("Assign", 0) + counts.get("AugAssign", 0) + counts.get("AnnAssign", 0),
    }
    return {"total_nodes": sum(counts.values()), "structure": structure,
            "node_counts": dict(counts.most_common(25)), "outline": ast_outline(tree)}
