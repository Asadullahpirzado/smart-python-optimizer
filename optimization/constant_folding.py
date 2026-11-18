"""Constant folding: evaluate constant expressions at compile time."""
import ast
import operator

from .common import (NOT_CONST, const_value, make_const, foldable, unparse, FUNC, walk_scope)

BIN = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv,
       ast.FloorDiv: operator.floordiv, ast.Mod: operator.mod, ast.Pow: operator.pow, ast.BitAnd: operator.and_,
       ast.BitOr: operator.or_, ast.BitXor: operator.xor, ast.LShift: operator.lshift, ast.RShift: operator.rshift}
CMP = {ast.Eq: operator.eq, ast.NotEq: operator.ne, ast.Lt: operator.lt, ast.LtE: operator.le,
       ast.Gt: operator.gt, ast.GtE: operator.ge}
NUM = (int, float, bool)


def safe_binop(op, a, b):
    t = type(op)
    f = BIN.get(t)
    if f is None:
        return NOT_CONST
    if type(a) in NUM and type(b) in NUM:
        if t in (ast.Div, ast.FloorDiv, ast.Mod) and b == 0:
            return NOT_CONST
        if t is ast.Pow:
            if abs(b) > 64 or (b < 0 and a == 0):
                return NOT_CONST
            if isinstance(a, int) and isinstance(b, int) and b >= 0 and abs(a).bit_length() * b > 4096:
                return NOT_CONST
            if a < 0 and isinstance(b, float) and not b.is_integer():
                return NOT_CONST
        if t in (ast.LShift, ast.RShift, ast.BitAnd, ast.BitOr, ast.BitXor):
            if type(a) is float or type(b) is float:
                return NOT_CONST
            if t in (ast.LShift, ast.RShift) and (b < 0 or b > 1024 or abs(a).bit_length() + b > 4096):
                return NOT_CONST
    elif t is ast.Add and isinstance(a, str) and isinstance(b, str):
        pass
    elif t is ast.Mult and ((isinstance(a, str) and type(b) in (int, bool)) or (isinstance(b, str) and type(a) in (int, bool))):
        n = b if isinstance(a, str) else a
        s = a if isinstance(a, str) else b
        if n > 200 or len(s) * max(n, 0) > 200:
            return NOT_CONST
    else:
        return NOT_CONST
    try:
        r = f(a, b)
    except Exception:
        return NOT_CONST
    return r if foldable(r) else NOT_CONST


class Folder(ast.NodeTransformer):
    def __init__(self):
        self.count = 0

    def _done(self, node, value):
        if value is NOT_CONST:
            return node
        self.count += 1
        return ast.copy_location(make_const(value), node)

    def visit_BinOp(self, node):
        self.generic_visit(node)
        a, b = const_value(node.left), const_value(node.right)
        if a is NOT_CONST or b is NOT_CONST:
            return node
        return self._done(node, safe_binop(node.op, a, b))

    def visit_UnaryOp(self, node):
        self.generic_visit(node)
        if isinstance(node.op, (ast.USub, ast.UAdd)) and isinstance(node.operand, ast.Constant) \
                and type(node.operand.value) in (int, float):
            return node
        v = const_value(node.operand)
        if v is NOT_CONST:
            return node
        try:
            if isinstance(node.op, ast.Not):
                r = not v
            elif isinstance(node.op, ast.USub) and type(v) in NUM:
                r = -v
            elif isinstance(node.op, ast.UAdd) and type(v) in NUM:
                r = +v
            elif isinstance(node.op, ast.Invert) and type(v) in (int, bool):
                r = ~v
            else:
                return node
        except Exception:
            return node
        return self._done(node, r) if foldable(r) else node

    def visit_Compare(self, node):
        self.generic_visit(node)
        vals = [const_value(node.left)] + [const_value(c) for c in node.comparators]
        if any(v is NOT_CONST for v in vals) or not all(type(op) in CMP for op in node.ops):
            return node
        try:
            r = all(CMP[type(op)](vals[i], vals[i + 1]) for i, op in enumerate(node.ops))
        except Exception:
            return node
        return self._done(node, r)

    def visit_BoolOp(self, node):
        self.generic_visit(node)
        values = list(node.values)
        is_and = isinstance(node.op, ast.And)
        while values:
            v = const_value(values[0])
            if v is NOT_CONST:
                break
            if bool(v) == is_and and len(values) > 1:  # `True and x` -> x ; `False or x` -> x
                values.pop(0)
                self.count += 1
                continue
            if bool(v) != is_and:  # short circuit: `False and x` -> False
                self.count += 1
                return ast.copy_location(make_const(v), node)
            break
        if len(values) == 1:
            return values[0]
        node.values = values
        return node

    def visit_IfExp(self, node):
        self.generic_visit(node)
        v = const_value(node.test)
        if v is NOT_CONST:
            return node
        self.count += 1
        return node.body if v else node.orelse


def own_exprs(st):
    """Expression fields that belong to the statement itself (not nested bodies)."""
    if isinstance(st, (ast.If, ast.While)):
        return [("test", st)]
    if isinstance(st, (ast.For, ast.AsyncFor)):
        return [("iter", st)]
    if isinstance(st, (ast.With, ast.AsyncWith)):
        return [("context_expr", it) for it in st.items]
    return []


def fold_statement(st):
    """Fold in place; returns number of folds performed."""
    f = Folder()
    if isinstance(st, (ast.If, ast.While, ast.For, ast.AsyncFor, ast.With, ast.AsyncWith)):
        for attr, holder in own_exprs(st):
            setattr(holder, attr, f.visit(getattr(holder, attr)))
    elif not any(isinstance(getattr(st, a, None), list) and getattr(st, a) and isinstance(getattr(st, a)[0], ast.stmt)
                 for a in ("body", "orelse", "finalbody")):
        f.visit(st)
    return f.count


def fold_expr(expr):
    f = Folder()
    return f.visit(expr), f.count


def run(tree, ctx):
    total = 0
    for st in [n for n in ast.walk(tree) if isinstance(n, ast.stmt) and not isinstance(n, FUNC + (ast.ClassDef, ast.Try))]:
        before = unparse(st) if not isinstance(st, (ast.If, ast.While, ast.For, ast.With)) else None
        if before is None:
            hdr = own_exprs(st)
            before = unparse(getattr(hdr[0][1], hdr[0][0])) if hdr else ""
        n = fold_statement(st)
        if n:
            total += n
            if isinstance(st, (ast.If, ast.While, ast.For, ast.AsyncFor, ast.With, ast.AsyncWith)):
                h = own_exprs(st)[0]
                after = unparse(getattr(h[1], h[0]))
            else:
                after = unparse(st)
            ctx.log("constant_folding", st, "fold", before, after,
                    "Expression contains only compile-time constants, so it was evaluated once during compilation.")
    return total
