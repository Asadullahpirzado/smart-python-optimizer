"""Static auxiliary-space estimation."""
import ast

from optimization.common import FUNC, LOOPS, COMPS
from .time_complexity import Cx, ONE, LINEAR, LOGN, cx_max, TimeAnalyzer
from .call_graph import callee_name

ALLOC_CALLS = {"list", "tuple", "set", "frozenset", "dict", "sorted", "reversed", "bytearray"}
GROW = {"append", "add", "extend", "insert", "appendleft", "update"}


class SpaceAnalyzer:
    def __init__(self, tree, ta: TimeAnalyzer):
        self.tree, self.ta, self.space = tree, ta, {}
        for name in ta.costs:
            self.space[name] = ONE
        for _ in range(2):
            for name, fn in ta.funcs.items():
                self.space[name] = self.function_space(name, fn)
        self.module_space = self.stmts(tree.body, ONE, None, None)

    def alloc(self, e, fn, own):
        if isinstance(e, COMPS):
            size = ONE
            for g in e.generators:
                size = size * self.ta.iter_cx(g.iter)
            inner = e.elt if not isinstance(e, ast.DictComp) else e.value
            return size * self.alloc(inner, fn, own)
        c = ONE
        if isinstance(e, ast.Call):
            n = callee_name(e)
            if isinstance(e.func, ast.Name) and e.func.id in ALLOC_CALLS:
                c = LINEAR
            elif isinstance(e.func, ast.Attribute) and e.func.attr in ("copy", "split", "splitlines", "keys", "values", "items"):
                c = LINEAR if e.func.attr in ("copy", "split", "splitlines") else ONE
            elif n in self.space and n != own:
                c = self.space[n]
        elif isinstance(e, ast.Subscript) and isinstance(e.slice, ast.Slice):
            c = LINEAR
        elif isinstance(e, ast.BinOp) and isinstance(e.op, ast.Mult) and isinstance(e.left, (ast.List, ast.Tuple)):
            c = LINEAR
        for ch in ast.iter_child_nodes(e):
            if isinstance(ch, ast.expr):
                c = c + self.alloc(ch, fn, own)
        return c

    def stmts(self, body, factor, fn, own):
        return cx_max([self.stmt(s, factor, fn, own) for s in body])

    def stmt(self, st, factor, fn, own):
        if isinstance(st, (ast.For, ast.AsyncFor)):
            f = factor * self.ta.iter_cx(st.iter)
            return self.alloc(st.iter, fn, own) + self.stmts(st.body, f, fn, own) + self.stmts(st.orelse, factor, fn, own)
        if isinstance(st, ast.While):
            return self.stmts(st.body, factor * self.ta.while_cx(st), fn, own)
        if isinstance(st, ast.If):
            return self.stmts(st.body, factor, fn, own) + self.stmts(st.orelse, factor, fn, own)
        if isinstance(st, ast.Try):
            return cx_max([self.stmts(st.body, factor, fn, own)] + [self.stmts(h.body, factor, fn, own) for h in st.handlers])
        if isinstance(st, (ast.With, ast.AsyncWith)):
            return self.stmts(st.body, factor, fn, own)
        if isinstance(st, FUNC + (ast.ClassDef,)):
            return ONE
        c = ONE
        for ch in ast.iter_child_nodes(st):
            if isinstance(ch, ast.expr):
                c = c + self.alloc(ch, fn, own)
        grows = any(isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr in GROW for n in ast.walk(st)) \
            or (isinstance(st, ast.Assign) and any(isinstance(t, ast.Subscript) for t in st.targets))
        if grows and factor.key() != ONE.key():
            c = c + factor
        return c

    def function_space(self, name, fn):
        aux = self.stmts(fn.body, ONE, fn, name)
        if name in self.ta.recurrence or name in self.ta.manual:
            rec = self.ta.recurrence.get(name, "")
            if "T(n/" in rec or "n/2" in rec:
                return aux + LOGN
            return aux * LINEAR if aux.key() != ONE.key() else LINEAR
        return aux

    def overall(self):
        return cx_max(list(self.space.values()) + [self.module_space])


def complexity_report(tree):
    ta = TimeAnalyzer(tree)
    sa = SpaceAnalyzer(tree, ta)
    functions = []
    for name, fn in ta.funcs.items():
        functions.append({"name": name, "lineno": fn.lineno, "time": str(ta.costs[name]), "space": str(sa.space[name]),
                          "recurrence": ta.recurrence.get(name) or ta.notes.get(name),
                          "manual": name in ta.manual})
    functions.sort(key=lambda f: f["lineno"])
    t, s = ta.overall(), sa.overall()
    sizes = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]
    return {"functions": functions, "module_time": str(ta.module_cost), "module_space": str(sa.module_space),
            "time": str(t), "space": str(s), "_time_cx": t, "_space_cx": s}
