"""Semantic analysis: scopes, undefined names, unused imports/variables, signatures."""
import ast
import builtins

from .symbol_table import build_symbol_table, iter_tables

BUILTINS = set(dir(builtins)) | {"__name__", "__file__", "__doc__", "__builtins__", "__spec__",
                                 "__package__", "__loader__", "__path__", "__class__"}


def _functions(tree):
    out = []
    for n in ast.walk(tree):
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)):
            a = n.args
            params = [x.arg for x in a.posonlyargs + a.args + a.kwonlyargs]
            ann = {x.arg: ast.unparse(x.annotation) for x in a.posonlyargs + a.args + a.kwonlyargs if x.annotation}
            out.append({"name": n.name, "lineno": n.lineno, "params": params, "annotations": ann,
                        "returns": ast.unparse(n.returns) if n.returns else None,
                        "decorators": [ast.unparse(d) for d in n.decorator_list]})
    return out


def _all_names(tree):
    """Names listed in a literal ``__all__``."""
    names = set()
    for n in ast.walk(tree):
        if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "__all__" for t in n.targets):
            if isinstance(n.value, (ast.List, ast.Tuple)):
                names |= {e.value for e in n.value.elts if isinstance(e, ast.Constant) and isinstance(e.value, str)}
    return names


def analyze_semantics(tree, code):
    table = build_symbol_table(code)
    star_import = any(isinstance(n, ast.ImportFrom) and any(a.name == "*" for a in n.names) for n in ast.walk(tree))
    module_defined = {s["name"] for s in table["symbols"]
                      if set(s["flags"]) & {"assigned", "imported", "namespace", "param"}}
    issues = {"undefined_names": [], "unused_variables": [], "unused_imports": []}

    # undefined names (only where detectable)
    if not star_import:
        lines = {}
        for n in ast.walk(tree):
            if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Load):
                lines.setdefault(n.id, n.lineno)
        for t in iter_tables(table):
            for s in t["symbols"]:
                f = set(s["flags"])
                resolves_global = ("global" in f or (t["type"] == "module" and not f & {"assigned", "imported", "namespace"}))
                if "referenced" in f and resolves_global and s["name"] not in module_defined \
                        and s["name"] not in BUILTINS and "free" not in f:
                    issues["undefined_names"].append({"name": s["name"], "scope": t["name"],
                                                      "lineno": lines.get(s["name"])})
    # unused variables (function scopes)
    for t in iter_tables(table):
        if t["type"] != "function":
            continue
        for s in t["symbols"]:
            f = set(s["flags"])
            if "assigned" in f and "referenced" not in f and not f & {"param", "imported", "namespace", "global", "free"} \
                    and not s["name"].startswith("_"):
                issues["unused_variables"].append({"name": s["name"], "scope": t["name"], "lineno": t["lineno"]})
    # unused imports (AST based, usage anywhere in the file counts)
    used = {n.id for n in ast.walk(tree) if isinstance(n, ast.Name)} | _all_names(tree)
    for n in ast.walk(tree):
        if isinstance(n, (ast.Import, ast.ImportFrom)):
            if isinstance(n, ast.ImportFrom) and n.module == "__future__":
                continue
            for a in n.names:
                bound = a.asname or a.name.split(".")[0]
                if a.name != "*" and bound not in used:
                    issues["unused_imports"].append({"name": bound, "lineno": n.lineno})
    classes = [{"name": n.name, "lineno": n.lineno,
                "methods": [m.name for m in n.body if isinstance(m, (ast.FunctionDef, ast.AsyncFunctionDef))]}
               for n in ast.walk(tree) if isinstance(n, ast.ClassDef)]
    return {"symbol_table": table, "functions": _functions(tree), "classes": classes, **issues}
