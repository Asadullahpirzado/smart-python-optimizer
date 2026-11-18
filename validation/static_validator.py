"""Transformation validation that needs no execution: syntax, API surface and structure checks."""
import ast

from optimization.common import FUNC


def signature_map(tree):
    out = {}
    for n in ast.walk(tree):
        if isinstance(n, FUNC):
            a = n.args
            out.setdefault(n.name, []).append(ast.unparse(a))
        elif isinstance(n, ast.ClassDef):
            out.setdefault("class " + n.name, []).append("")
    return out


def static_validate(original_tree, optimized_code):
    checks = []

    def add(name, ok, detail=""):
        checks.append({"name": name, "ok": bool(ok), "detail": detail})

    try:
        opt = ast.parse(optimized_code)
        compile(opt, "<optimized>", "exec")
        add("Optimized code parses and compiles", True)
    except Exception as exc:
        add("Optimized code parses and compiles", False, str(exc))
        return {"ok": False, "checks": checks}
    a, b = signature_map(original_tree), signature_map(opt)
    missing = sorted(k for k in a if k not in b)
    add("All functions and classes are preserved", not missing, ", ".join(missing))
    changed = sorted(k for k in a if k in b and sorted(a[k]) != sorted(b[k]))
    add("Function signatures are unchanged", not changed, ", ".join(changed))
    glob_a = {n for n in ast.walk(original_tree) if isinstance(n, (ast.Global, ast.Nonlocal))}
    glob_b = {n for n in ast.walk(opt) if isinstance(n, (ast.Global, ast.Nonlocal))}
    add("Global/nonlocal declarations are preserved", len(glob_a) == len(glob_b))
    def reachable_prints(tree):
        """Count print calls outside constant-dead branches and after terminators."""
        count = 0

        class Reachable(ast.NodeVisitor):
            def visit_If(self, node):
                nonlocal count
                self.visit(node.test)
                value = None
                try:
                    value = ast.literal_eval(node.test)
                except (ValueError, TypeError, SyntaxError):
                    pass
                if value is not None or isinstance(node.test, ast.Constant):
                    for statement in (node.body if bool(value) else node.orelse):
                        self.visit(statement)
                else:
                    for statement in node.body + node.orelse:
                        self.visit(statement)

            def visit_While(self, node):
                nonlocal count
                self.visit(node.test)
                value = None
                try:
                    value = ast.literal_eval(node.test)
                except (ValueError, TypeError, SyntaxError):
                    pass
                if not (value is not None or isinstance(node.test, ast.Constant)) or bool(value):
                    for statement in node.body:
                        self.visit(statement)
                for statement in node.orelse:
                    self.visit(statement)

            def visit_Expr(self, node):
                nonlocal count
                for call in ast.walk(node.value):
                    if isinstance(call, ast.Call) and isinstance(call.func, ast.Name) and call.func.id == "print":
                        count += 1

            def visit_FunctionDef(self, node):
                self.visit_body(node.body)

            visit_AsyncFunctionDef = visit_FunctionDef

            def visit_ClassDef(self, node):
                self.visit_body(node.body)

            def visit_body(self, body):
                for statement in body:
                    if isinstance(statement, (ast.Return, ast.Raise, ast.Break, ast.Continue)):
                        self.visit(statement)
                        break
                    self.visit(statement)
                    if isinstance(statement, ast.If):
                        try:
                            value = ast.literal_eval(statement.test)
                        except (ValueError, TypeError, SyntaxError):
                            value = None
                        if isinstance(statement.test, ast.Constant) and bool(value) and any(isinstance(x, ast.Return) for x in statement.body):
                            break

        Reachable().visit(tree)
        return count

    prints_a, prints_b = reachable_prints(original_tree), reachable_prints(opt)
    add("Observable calls (print) are not removed", prints_b >= prints_a,
        "" if prints_b >= prints_a else "some print calls are in code that was unrolled/removed – verify output")
    return {"ok": all(c["ok"] for c in checks), "checks": checks}
