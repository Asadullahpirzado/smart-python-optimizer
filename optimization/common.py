"""Shared helpers, settings and the change log used by every optimization pass."""
import ast
import copy
import math
from dataclasses import dataclass, asdict

FUNC = (ast.FunctionDef, ast.AsyncFunctionDef)
SCOPE_NODES = FUNC + (ast.ClassDef, ast.Lambda)
LOOPS = (ast.For, ast.AsyncFor, ast.While)
COMPS = (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)
DYNAMIC_NAMES = {"eval", "exec", "locals", "globals", "vars"}
NOT_CONST = object()
ARITH = (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv, ast.Mod, ast.Pow)
BITS = (ast.BitAnd, ast.BitOr, ast.BitXor, ast.LShift, ast.RShift)
SAFE_OPS = (ast.Add, ast.Sub, ast.Mult)
NUMERIC_ANN = {"int", "float", "bool", "complex"}
NUM_CALLS = {"len", "int", "float", "abs", "round", "ord"}

PASS_NAMES = ["inlining", "constant_propagation", "constant_folding", "cse", "copy_propagation", "dead_code",
              "loop_unrolling", "licm", "strength_reduction", "unused_imports"]

DEFAULT_SETTINGS = {
    "passes": {k: (k != "unused_imports") for k in PASS_NAMES},
    "iteration_limit": 8,
    "assume_numeric": False,
    "assume_script": True,
    "unroll_max_trip": 4,
    "unroll_max_nodes": 60,
    "inline_max_nodes": 25,
    "apply_recommendations": [],
    "bench_timeout": 30,
    "bench_repeats": 5,
}


def normalize_settings(user=None):
    s = copy.deepcopy(DEFAULT_SETTINGS)
    user = user or {}
    for k, v in user.get("passes", {}).items():
        if k in s["passes"]:
            s["passes"][k] = bool(v)
    for k in ("assume_numeric", "assume_script"):
        if k in user:
            s[k] = bool(user[k])
    for k, lo, hi in (("iteration_limit", 1, 20), ("unroll_max_trip", 1, 16), ("unroll_max_nodes", 5, 300),
                      ("inline_max_nodes", 3, 100), ("bench_timeout", 2, 120), ("bench_repeats", 1, 30)):
        if k in user:
            try:
                s[k] = max(lo, min(hi, int(user[k])))
            except (TypeError, ValueError):
                pass
    if isinstance(user.get("apply_recommendations"), list):
        s["apply_recommendations"] = [str(x) for x in user["apply_recommendations"]][:200]
    return s


@dataclass
class Change:
    pass_name: str
    lineno: int
    kind: str
    before: str
    after: str
    explanation: str
    safety: str = "auto"

    def to_dict(self):
        return asdict(self)


def unparse(node):
    try:
        return ast.unparse(node)
    except Exception:
        return "<?>"


def short(text, n=140):
    text = " ".join(str(text).split())
    return text if len(text) <= n else text[: n - 1] + "…"


# -- name collection ---------------------------------------------------------
def stores_in(node):
    out = set()
    match_types = tuple(getattr(ast, n) for n in ("MatchAs", "MatchStar") if hasattr(ast, n))
    for n in ast.walk(node):
        if isinstance(n, ast.Name) and isinstance(n.ctx, (ast.Store, ast.Del)):
            out.add(n.id)
        elif isinstance(n, FUNC + (ast.ClassDef,)):
            out.add(n.name)
        elif isinstance(n, (ast.Import, ast.ImportFrom)):
            for a in n.names:
                out.add(a.asname or a.name.split(".")[0])
        elif isinstance(n, ast.ExceptHandler) and n.name:
            out.add(n.name)
        elif isinstance(n, (ast.Global, ast.Nonlocal)):
            out.update(n.names)
        elif match_types and isinstance(n, match_types) and n.name:
            out.add(n.name)
        elif hasattr(ast, "MatchMapping") and isinstance(n, ast.MatchMapping) and n.rest:
            out.add(n.rest)
    return out


def loads_all(node):
    """Names that may be read: loads, deletes and augmented-assignment targets."""
    out = set()
    for n in ast.walk(node):
        if isinstance(n, ast.Name):
            if isinstance(n.ctx, (ast.Load, ast.Del)):
                out.add(n.id)
        if isinstance(n, ast.AugAssign) and isinstance(n.target, ast.Name):
            out.add(n.target.id)
    return out


def names_in(node):
    return {n.id for n in ast.walk(node) if isinstance(n, ast.Name)}


def declared_global_nonlocal(tree):
    out = set()
    for n in ast.walk(tree):
        if isinstance(n, (ast.Global, ast.Nonlocal)):
            out.update(n.names)
    return out


def has_dynamic(tree):
    for n in ast.walk(tree):
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id in DYNAMIC_NAMES:
            return True
        if isinstance(n, ast.ImportFrom) and any(a.name == "*" for a in n.names):
            return True
    return False


def walk_scope(node):
    """Walk the nodes of one scope without descending into nested functions/classes/lambdas."""
    stack = list(ast.iter_child_nodes(node))
    while stack:
        n = stack.pop()
        yield n
        if not isinstance(n, SCOPE_NODES):
            stack.extend(ast.iter_child_nodes(n))


def scope_lists(scope):
    """All statement lists belonging to one scope (not nested function bodies)."""
    found = []
    root = scope
    stack = [root]
    while stack:
        n = stack.pop()
        for f in ("body", "orelse", "finalbody"):
            v = getattr(n, f, None)
            if isinstance(v, list) and v and isinstance(v[0], ast.stmt):
                found.append(v)
        if hasattr(n, "handlers"):
            stack.extend(n.handlers)
        if hasattr(n, "cases"):
            stack.extend(n.cases)
        for ch in ast.iter_child_nodes(n):
            if isinstance(ch, ast.stmt) and not isinstance(ch, SCOPE_NODES):
                stack.append(ch)
    return found


def terminates(stmts):
    if not stmts:
        return False
    last = stmts[-1]
    if isinstance(last, (ast.Return, ast.Raise, ast.Break, ast.Continue)):
        return True
    if isinstance(last, ast.If):
        return terminates(last.body) and terminates(last.orelse)
    return False


def node_count(node):
    return sum(1 for _ in ast.walk(node))


# -- constants -----------------------------------------------------------------
def const_value(node):
    if isinstance(node, ast.Constant) and type(node.value) in (int, float, bool, str, type(None)):
        return node.value
    if (isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd))
            and isinstance(node.operand, ast.Constant) and type(node.operand.value) in (int, float)):
        v = node.operand.value
        return -v if isinstance(node.op, ast.USub) else v
    return NOT_CONST


def make_const(v):
    if type(v) in (int, float) and (v < 0 or (type(v) is float and math.copysign(1.0, v) < 0)):
        return ast.UnaryOp(op=ast.USub(), operand=ast.Constant(-v))
    return ast.Constant(v)


def foldable(v):
    t = type(v)
    if t is int:
        return v.bit_length() <= 4096
    if t is float:
        return math.isfinite(v)
    if t is str:
        return len(v) <= 200
    return t in (bool, type(None))


# -- numeric type inference -------------------------------------------------------
def is_numeric(e, numeric, assume=False, stored=frozenset()):
    if isinstance(e, ast.Constant):
        return type(e.value) in (int, float, bool)
    if isinstance(e, ast.Name):
        return e.id in numeric or (assume and e.id not in stored)
    if isinstance(e, ast.UnaryOp):
        return isinstance(e.op, (ast.USub, ast.UAdd, ast.Not)) and is_numeric(e.operand, numeric, assume, stored)
    if isinstance(e, ast.BinOp):
        return isinstance(e.op, ARITH + BITS) and is_numeric(e.left, numeric, assume, stored) \
            and is_numeric(e.right, numeric, assume, stored)
    if isinstance(e, ast.IfExp):
        return is_numeric(e.body, numeric, assume, stored) and is_numeric(e.orelse, numeric, assume, stored)
    if isinstance(e, ast.Compare):
        return True
    if isinstance(e, ast.Call) and isinstance(e.func, ast.Name) and e.func.id in NUM_CALLS:
        return True
    return False


def safe_numeric(e, numeric, excluded=frozenset()):
    """Numeric expression built only from + - * (cannot raise for int/float operands)."""
    if isinstance(e, ast.Constant):
        return type(e.value) in (int, float, bool)
    if isinstance(e, ast.Name):
        return e.id in numeric and e.id not in excluded
    if isinstance(e, ast.UnaryOp):
        return isinstance(e.op, (ast.USub, ast.UAdd)) and safe_numeric(e.operand, numeric, excluded)
    if isinstance(e, ast.BinOp):
        return isinstance(e.op, SAFE_OPS) and safe_numeric(e.left, numeric, excluded) and safe_numeric(e.right, numeric, excluded)
    return False


def compute_numeric(scope, parent_numeric, settings, excluded):
    assume = settings.get("assume_numeric", False)
    stores, recognized, total = {}, {}, {}

    def add(name, entry):
        stores.setdefault(name, []).append(entry)

    def bad(name):
        add(name, ("bad",))

    def rec(name):
        recognized[name] = recognized.get(name, 0) + 1

    if isinstance(scope, FUNC):
        a = scope.args
        for arg in a.posonlyargs + a.args + a.kwonlyargs:
            add(arg.arg, ("param", unparse(arg.annotation) if arg.annotation else None))
        for extra in (a.vararg, a.kwarg):
            if extra:
                bad(extra.arg)
    for n in walk_scope(scope):
        if isinstance(n, ast.Name) and isinstance(n.ctx, (ast.Store, ast.Del)):
            total[n.id] = total.get(n.id, 0) + 1
        if isinstance(n, ast.Assign):
            for t in n.targets:
                if isinstance(t, ast.Name):
                    add(t.id, ("assign", n.value)); rec(t.id)
        elif isinstance(n, ast.AnnAssign) and isinstance(n.target, ast.Name) and n.value is not None:
            add(n.target.id, ("assign", n.value)); rec(n.target.id)
        elif isinstance(n, ast.AugAssign) and isinstance(n.target, ast.Name):
            add(n.target.id, ("aug", n.op, n.value)); rec(n.target.id)
        elif isinstance(n, ast.For) and isinstance(n.target, ast.Name):
            if isinstance(n.iter, ast.Call) and isinstance(n.iter.func, ast.Name) and n.iter.func.id == "range":
                add(n.target.id, ("range",)); rec(n.target.id)
        elif isinstance(n, (FUNC + (ast.ClassDef, ast.Import, ast.ImportFrom, ast.ExceptHandler, ast.Global, ast.Nonlocal))):
            for nm in stores_in(n) if isinstance(n, (ast.Import, ast.ImportFrom, ast.ExceptHandler, ast.Global, ast.Nonlocal)) else {n.name}:
                bad(nm)
    for nm, cnt in total.items():
        if recognized.get(nm, 0) != cnt:
            bad(nm)
    stored = set(stores)
    cand = {n for n, l in stores.items() if n not in excluded and all(e[0] in ("assign", "aug", "range", "param") for e in l)}
    for n in list(cand):
        if any(e[0] == "param" and e[1] not in NUMERIC_ANN for e in stores[n]) and not assume:
            cand.discard(n)
    visible = lambda: cand | {p for p in parent_numeric if p not in stored}
    changed = True
    while changed:
        changed = False
        for n in list(cand):
            for e in stores[n]:
                ok = True
                if e[0] == "assign":
                    ok = is_numeric(e[1], visible(), assume, stored)
                elif e[0] == "aug":
                    ok = isinstance(e[1], ARITH + BITS) and is_numeric(e[2], visible(), assume, stored)
                if not ok:
                    cand.discard(n)
                    changed = True
                    break
    return cand


class Context:
    def __init__(self, tree, settings):
        self.settings = settings
        self.changes = []
        self._tmp = 0
        self.used_names = set()
        self.refresh(tree)

    def refresh(self, tree):
        """Recompute whole-program facts; must be called whenever the tree object changes."""
        self.dynamic = False
        self.excluded = set()
        self._parents = {id(tree): None}
        stack = [(tree, tree)]
        while stack:
            node, scope = stack.pop()
            if isinstance(node, ast.Name):
                self.used_names.add(node.id)
            elif isinstance(node, FUNC + (ast.ClassDef,)):
                self.used_names.add(node.name)
            elif isinstance(node, ast.arguments):
                self.used_names.update(a.arg for a in node.posonlyargs + node.args + node.kwonlyargs)
            if isinstance(node, (ast.Global, ast.Nonlocal)):
                self.excluded.update(node.names)
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in DYNAMIC_NAMES:
                self.dynamic = True
            if isinstance(node, ast.ImportFrom) and any(alias.name == "*" for alias in node.names):
                self.dynamic = True
            for child in ast.iter_child_nodes(node):
                if isinstance(child, FUNC):
                    self._parents[id(child)] = scope
                    stack.append((child, child))
                else:
                    stack.append((child, scope))
        self._numeric = {}

    def numeric_for(self, scope):
        key = id(scope)
        if key not in self._numeric:
            parent = self._parents.get(key)
            pn = self.numeric_for(parent) if parent is not None else set()
            self._numeric[key] = compute_numeric(scope, pn, self.settings, self.excluded)
        return self._numeric[key]

    def stored_names(self, scope):
        s = set()
        for n in walk_scope(scope):
            if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Store):
                s.add(n.id)
        return s

    def fresh(self, prefix):
        while True:
            name = f"_{prefix}{self._tmp}"
            self._tmp += 1
            if name not in self.used_names:
                self.used_names.add(name)
                return name

    def log(self, pass_name, node, kind, before, after, why, safety="auto"):
        line = node if isinstance(node, int) else getattr(node, "lineno", 0)
        self.changes.append(Change(pass_name, line, kind, short(before), short(after), why, safety))


class Replacer(ast.NodeTransformer):
    """Replace nodes (by identity) with a Name load."""

    def __init__(self, ids, name):
        self.ids, self.name = ids, name

    def visit(self, node):
        if id(node) in self.ids:
            return ast.Name(id=self.name, ctx=ast.Load())
        return super().visit(node)


def assign_stmt(name, value, like):
    node = ast.Assign(targets=[ast.Name(id=name, ctx=ast.Store())], value=value)
    return ast.copy_location(node, like)
