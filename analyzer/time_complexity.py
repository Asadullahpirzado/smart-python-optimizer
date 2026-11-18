"""Static time-complexity estimation (structure based) with recurrence / Master-theorem support."""
import ast
import math

from optimization.common import FUNC, LOOPS, COMPS, const_value, NOT_CONST, unparse, terminates
from .call_graph import build_call_graph, sccs, callee_name

SUP = str.maketrans("0123456789n", "⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ")


class Cx:
    __slots__ = ("deg", "log", "exp")

    def __init__(self, deg=0.0, log=0, exp=0):
        self.deg, self.log, self.exp = deg, log, exp

    def key(self):
        return (self.exp, round(self.deg, 4), self.log)

    def __mul__(self, o):
        if self.exp or o.exp:
            return Cx(0, 0, max(self.exp, o.exp))
        return Cx(self.deg + o.deg, self.log + o.log)

    def __add__(self, o):
        return self if self.key() >= o.key() else o

    def __lt__(self, o):
        return self.key() < o.key()

    def __eq__(self, o):
        return self.key() == o.key()

    def __hash__(self):
        return hash(self.key())

    def __str__(self):
        if self.exp:
            return f"O({self.exp}{'n'.translate(SUP)})" if self.exp != 2 else "O(2ⁿ)"
        d, l = self.deg, self.log
        parts = []
        if d:
            if abs(d - round(d)) < 1e-9:
                d = int(round(d))
                parts.append("n" if d == 1 else "n" + str(d).translate(SUP))
            else:
                parts.append(f"n^{d:.2f}")
        if l:
            parts.append("log n" if l == 1 else f"log{str(l).translate(SUP)} n")
        return f"O({' '.join(parts)})" if parts else "O(1)"

    def ops(self, n):
        if self.exp:
            return min(float(self.exp) ** min(n, 60), 1e18)
        return (n ** self.deg) * (math.log2(n) if n > 1 else 1) ** self.log


ONE, LINEAR, NLOGN, LOGN = Cx(), Cx(1), Cx(1, 1), Cx(0, 1)
LINEAR_BUILTINS = {"list", "tuple", "set", "frozenset", "dict", "sum", "min", "max", "any", "all", "sorted_", "bytes", "bytearray"}
LINEAR_METHODS = {"index", "count", "remove", "copy", "extend", "reverse", "join", "split", "insert", "splitlines", "strip_", "replace"}
LIST_MAKERS = {"list", "sorted", "split", "splitlines", "keys", "values"}


def cx_max(items):
    out = ONE
    for i in items:
        out = out + i
    return out


class TimeAnalyzer:
    def __init__(self, tree):
        self.tree = tree
        self.funcs, self.edges = build_call_graph(tree)
        self.costs, self.notes, self.recurrence, self.manual = {}, {}, {}, set()
        self.lists = {}
        self._run()

    # -- helpers ---------------------------------------------------------------
    def list_names(self, fn):
        key = id(fn)
        if key not in self.lists:
            names = set()
            for n in ast.walk(fn):
                if isinstance(n, ast.Assign) and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name):
                    v = n.value
                    if isinstance(v, (ast.List, ast.ListComp)) or (isinstance(v, ast.Call) and callee_name(v) in LIST_MAKERS) \
                            or (isinstance(v, ast.Call) and isinstance(v.func, ast.Attribute) and v.func.attr in LIST_MAKERS):
                        names.add(n.targets[0].id)
            if isinstance(fn, FUNC):
                for a in fn.args.args:
                    if a.annotation is not None and unparse(a.annotation).lower().startswith(("list", "str", "tuple")):
                        names.add(a.arg)
            self.lists[key] = names
        return self.lists[key]

    def iter_cx(self, it):
        if isinstance(it, (ast.List, ast.Tuple, ast.Set, ast.Dict)):
            return ONE
        if isinstance(it, ast.Call):
            name = callee_name(it)
            if name == "range":
                return ONE if all(const_value(a) is not NOT_CONST for a in it.args) else LINEAR
            if name in ("enumerate", "reversed", "zip", "sorted", "list", "iter") and it.args:
                return self.iter_cx(it.args[0])
        return LINEAR

    def while_cx(self, st):
        test_names = {n.id for n in ast.walk(st.test) if isinstance(n, ast.Name)}
        for n in ast.walk(ast.Module(body=st.body, type_ignores=[])):
            tgt = val = op = None
            if isinstance(n, ast.AugAssign) and isinstance(n.target, ast.Name):
                tgt, op, val = n.target.id, n.op, n.value
            elif isinstance(n, ast.Assign) and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name) \
                    and isinstance(n.value, ast.BinOp) and isinstance(n.value.left, ast.Name) and n.value.left.id == n.targets[0].id:
                tgt, op, val = n.targets[0].id, n.value.op, n.value.right
            if tgt in test_names and isinstance(op, (ast.FloorDiv, ast.Mult, ast.RShift, ast.LShift, ast.Div)):
                v = const_value(val)
                if v is not NOT_CONST and type(v) in (int, float) and v >= 2:
                    return LOGN
        return LINEAR

    def member_cx(self, comp, fn):
        if isinstance(comp, ast.Name) and comp.id in self.list_names(fn):
            return LINEAR
        if isinstance(comp, (ast.List, ast.Tuple)) or (isinstance(comp, ast.Call) and callee_name(comp) in ("list", "tuple")):
            return LINEAR
        return ONE

    def call_cx(self, call, fn, own):
        name = callee_name(call)
        if name and fn is not None and name == own:
            return ONE  # self calls are handled by the recurrence solver
        if isinstance(call.func, ast.Name):
            if name == "sorted":
                return NLOGN
            if name in LINEAR_BUILTINS:
                return LINEAR
            if name in self.costs:
                return self.costs[name]
            return ONE
        if isinstance(call.func, ast.Attribute):
            a = call.func.attr
            if a == "sort":
                return NLOGN
            if a == "pop":
                return LINEAR if call.args and const_value(call.args[0]) == 0 else ONE
            if name in self.costs and isinstance(call.func.value, ast.Name) and call.func.value.id in ("self", "cls"):
                return self.costs[name]
            if a in LINEAR_METHODS:
                return LINEAR
        return ONE

    def ecost(self, e, fn, own):
        if isinstance(e, COMPS):
            gens = ONE
            for g in e.generators:
                gens = gens * self.iter_cx(g.iter)
            inner = [e.elt] if not isinstance(e, ast.DictComp) else [e.key, e.value]
            inner += [c for g in e.generators for c in g.ifs]
            return gens * cx_max([self.ecost(x, fn, own) for x in inner]) + cx_max([self.ecost(g.iter, fn, own) for g in e.generators])
        c = ONE
        if isinstance(e, ast.Call):
            c = c + self.call_cx(e, fn, own)
        elif isinstance(e, ast.Compare):
            for op, comp in zip(e.ops, e.comparators):
                if isinstance(op, (ast.In, ast.NotIn)):
                    c = c + self.member_cx(comp, fn)
        elif isinstance(e, ast.Subscript) and isinstance(e.slice, ast.Slice):
            c = c + LINEAR
        elif isinstance(e, ast.BinOp) and isinstance(e.op, ast.Mult) and isinstance(e.left, (ast.List, ast.Tuple)):
            c = c + LINEAR
        if isinstance(e, ast.Lambda):
            return c
        for ch in ast.iter_child_nodes(e):
            if isinstance(ch, ast.expr):
                c = c + self.ecost(ch, fn, own)
        return c

    def stmts(self, body, fn, own):
        return cx_max([self.stmt(s, fn, own) for s in body])

    def stmt(self, st, fn, own):
        if isinstance(st, (ast.For, ast.AsyncFor)):
            return self.iter_cx(st.iter) * self.stmts(st.body, fn, own) + self.ecost(st.iter, fn, own) + self.stmts(st.orelse, fn, own)
        if isinstance(st, ast.While):
            return self.while_cx(st) * (self.stmts(st.body, fn, own) + self.ecost(st.test, fn, own)) + self.stmts(st.orelse, fn, own)
        if isinstance(st, ast.If):
            return self.ecost(st.test, fn, own) + self.stmts(st.body, fn, own) + self.stmts(st.orelse, fn, own)
        if isinstance(st, ast.Try):
            parts = [self.stmts(st.body, fn, own), self.stmts(st.orelse, fn, own), self.stmts(st.finalbody, fn, own)]
            parts += [self.stmts(h.body, fn, own) for h in st.handlers]
            return cx_max(parts)
        if isinstance(st, (ast.With, ast.AsyncWith)):
            return self.stmts(st.body, fn, own)
        if isinstance(st, FUNC + (ast.ClassDef,)):
            return ONE
        c = ONE
        for ch in ast.iter_child_nodes(st):
            if isinstance(ch, ast.expr):
                c = c + self.ecost(ch, fn, own)
        return c

    # -- recurrences --------------------------------------------------------------
    def self_calls(self, fn):
        """(call count along the worst path, in_loop flag, [calls])"""
        calls, in_loop = [], [False]

        def count(body, depth):
            total = 0
            for i, s in enumerate(body):
                if isinstance(s, ast.If):
                    t = self._expr_calls(s.test, calls)
                    b, o, rest = count(s.body, depth), count(s.orelse, depth), count(body[i + 1:], depth)
                    tb, to = terminates(s.body), terminates(s.orelse)
                    if tb and to:
                        return total + t + max(b, o)
                    if tb:
                        return total + t + max(b, o + rest)
                    if to:
                        return total + t + max(o, b + rest)
                    return total + t + max(b, o) + rest
                elif isinstance(s, LOOPS):
                    c = count(s.body, depth + 1)
                    if c:
                        in_loop[0] = True
                    total += c
                elif isinstance(s, ast.Try):
                    total += count(s.body, depth) + count(s.orelse, depth) + count(s.finalbody, depth) + max([count(h.body, depth) for h in s.handlers] or [0])
                elif isinstance(s, (ast.With, ast.AsyncWith)):
                    total += count(s.body, depth)
                elif isinstance(s, FUNC + (ast.ClassDef,)):
                    continue
                else:
                    total += self._expr_calls(s, calls)
            return total

        n = count(fn.body, 0)
        return n, in_loop[0], calls

    def _expr_calls(self, node, calls):
        n = 0
        for x in ast.walk(node):
            if isinstance(x, ast.Call) and callee_name(x) is not None and getattr(self, "_cur", None) == callee_name(x):
                calls.append(x)
                n += 1
        return n

    def reduction(self, fn, calls):
        params = [a.arg for a in fn.args.args if a.arg not in ("self", "cls")]
        mids = set()
        for n in ast.walk(fn):
            if isinstance(n, ast.Assign) and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name) \
                    and isinstance(n.value, ast.BinOp) and isinstance(n.value.op, (ast.FloorDiv, ast.RShift)):
                mids.add(n.targets[0].id)
        kinds = set()
        for c in calls:
            kind = None
            for a in c.args:
                if isinstance(a, ast.BinOp) and isinstance(a.left, ast.Name) and a.left.id in params:
                    v = const_value(a.right)
                    if isinstance(a.op, ast.Sub) and type(v) is int and v >= 1:
                        kind = ("sub", v)
                    elif isinstance(a.op, (ast.FloorDiv, ast.Div)) and type(v) in (int, float) and v >= 2:
                        kind = ("div", v)
                    elif isinstance(a.op, ast.RShift) and type(v) is int and v >= 1:
                        kind = ("div", 2 ** v)
                elif isinstance(a, ast.Name) and a.id in mids:
                    kind = ("div", 2)
                elif isinstance(a, ast.BinOp) and isinstance(a.left, ast.Name) and a.left.id in mids:
                    kind = ("div", 2)
                elif isinstance(a, ast.Subscript) and isinstance(a.slice, ast.Slice):
                    kind = ("div", 2)
                elif isinstance(a, ast.BinOp) and isinstance(a.op, ast.FloorDiv):
                    kind = ("div", 2)  # e.g. (lo + hi) // 2 style midpoints
                if kind:
                    break
            if kind is None:
                return None
            kinds.add(kind[0])
        if len(kinds) != 1:
            return None
        return kinds.pop(), max(1, int(max((self._kv(c, params) for c in calls), default=2)))

    def _kv(self, c, params):
        return 2

    def solve(self, name, fn):
        self._cur = name
        a, in_loop, calls = self.self_calls(fn)
        work = self.stmts(fn.body, fn, name)
        if a == 0:
            return work, None
        if in_loop:
            self.manual.add(name)
            return work * LINEAR, "recursive call inside a loop – requires manual analysis"
        red = self.reduction(fn, calls)
        if red is None:
            self.manual.add(name)
            return work * LINEAR, "unrecognised recursion pattern – requires manual analysis"
        kind, _ = red
        w = str(work)
        if kind == "sub":
            if a == 1:
                return work * LINEAR, f"T(n) = T(n-1) + {w}  →  {work * LINEAR}"
            return Cx(0, 0, a), f"T(n) = {a}T(n-1) + {w}  →  {Cx(0, 0, a)}"
        b = 2
        if a == 0:
            return work, None
        c = math.log(a, b)
        d, k = work.deg, work.log
        if abs(d - c) < 1e-9:
            res = Cx(d, k + 1)
            case = "Case 2"
        elif d < c:
            res = Cx(c, 0)
            case = "Case 1"
        else:
            res = Cx(d, k)
            case = "Case 3"
        return res, f"T(n) = {a}T(n/{b}) + {w}  →  Master Theorem ({case}): {res}"

    def _run(self):
        comps = sccs(self.edges)
        for comp in comps:
            if len(comp) > 1:
                for n in comp:
                    self.costs[n] = LINEAR
                    self.manual.add(n)
                    self.notes[n] = "mutual recursion – requires manual analysis"
                continue
            n = comp[0]
            fn = self.funcs[n]
            cost, rec = self.solve(n, fn)
            self.costs[n] = cost
            if rec:
                self.recurrence[n] = rec
        self._cur = None
        self.module_cost = self.stmts(self.tree.body, None, None)

    def overall(self):
        return cx_max(list(self.costs.values()) + [self.module_cost])


def analyze_time(tree):
    a = TimeAnalyzer(tree)
    return a
