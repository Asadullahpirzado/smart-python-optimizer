"""Shared AST helpers used by every optimization pass."""
import ast, copy

FUNCS = (ast.FunctionDef, ast.AsyncFunctionDef)
SCOPE_NODES = FUNCS + (ast.ClassDef,)
COMPS = (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)
DYNAMIC = {"eval", "exec", "locals", "globals", "vars", "compile", "__import__", "dir"}
SIMPLE = (ast.Assign, ast.AugAssign, ast.AnnAssign, ast.Expr, ast.Return)


def stored_names(node):
    out = set()
    for n in ast.walk(node):
        if isinstance(n, ast.Name) and isinstance(n.ctx, (ast.Store, ast.Del)): out.add(n.id)
        elif isinstance(n, SCOPE_NODES): out.add(n.name)
        elif isinstance(n, (ast.Import, ast.ImportFrom)):
            for a in n.names: out.add((a.asname or a.name).split(".")[0])
        elif isinstance(n, ast.ExceptHandler) and n.name: out.add(n.name)
        elif isinstance(n, ast.arg): out.add(n.arg)
        elif isinstance(n, (ast.MatchAs, ast.MatchStar)) and n.name: out.add(n.name)
        elif isinstance(n, ast.MatchMapping) and n.rest: out.add(n.rest)
    return out


def loaded_names(node):
    return {n.id for n in ast.walk(node) if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Load)}


def declared_global(tree):
    out = set()
    for n in ast.walk(tree):
        if isinstance(n, (ast.Global, ast.Nonlocal)): out.update(n.names)
    return out


def uses_dynamic(node):
    return any(isinstance(n, ast.Name) and n.id in DYNAMIC for n in ast.walk(node))


def has_walrus(node):
    return any(isinstance(n, ast.NamedExpr) for n in ast.walk(node))


def line1(node, limit=110):
    try:
        s = ast.unparse(node).splitlines()[0]
    except Exception:
        s = type(node).__name__
    return s if len(s) <= limit else s[:limit] + "…"


def walk_own(scope):
    """Nodes belonging to a scope, without entering nested function/class/lambda bodies."""
    stack = list(reversed(getattr(scope, "body", [])))
    while stack:
        n = stack.pop()
        yield n
        if isinstance(n, SCOPE_NODES + (ast.Lambda,)): continue
        stack.extend(reversed(list(ast.iter_child_nodes(n))))


def own_stored(scope):
    out = set()
    if isinstance(scope, FUNCS):
        a = scope.args
        for x in a.posonlyargs + a.args + a.kwonlyargs: out.add(x.arg)
        if a.vararg: out.add(a.vararg.arg)
        if a.kwarg: out.add(a.kwarg.arg)
    for n in walk_own(scope):
        if isinstance(n, ast.Name) and isinstance(n.ctx, (ast.Store, ast.Del)): out.add(n.id)
        elif isinstance(n, SCOPE_NODES): out.add(n.name)
        elif isinstance(n, (ast.Import, ast.ImportFrom)):
            for a in n.names: out.add((a.asname or a.name).split(".")[0])
        elif isinstance(n, ast.ExceptHandler) and n.name: out.add(n.name)
    return out


def child_lists(stmt):
    for f in ("body", "orelse", "finalbody"):
        l = getattr(stmt, f, None)
        if isinstance(l, list) and l and isinstance(l[0], ast.stmt): yield l
    for h in getattr(stmt, "handlers", None) or []: yield h.body
    for c in getattr(stmt, "cases", None) or []: yield c.body


def all_bodies(node):
    for l in child_lists(node):
        yield l
        for s in l: yield from all_bodies(s)


def own_lists(scope):
    def rec(lst):
        yield lst
        for s in list(lst):
            if isinstance(s, SCOPE_NODES): continue
            for l in child_lists(s): yield from rec(l)
    yield from rec(scope.body)


def scopes(tree):
    yield tree
    for n in ast.walk(tree):
        if isinstance(n, FUNCS): yield n


def is_pure(n):
    """Conservative: expression has no side effects and cannot easily raise."""
    if isinstance(n, (ast.Constant, ast.Name)): return True
    if isinstance(n, (ast.Tuple, ast.List, ast.Set)): return all(is_pure(e) for e in n.elts)
    if isinstance(n, ast.Dict): return all(k is not None and is_pure(k) and is_pure(v) for k, v in zip(n.keys, n.values))
    if isinstance(n, ast.UnaryOp): return is_pure(n.operand)
    if isinstance(n, ast.BoolOp): return all(is_pure(v) for v in n.values)
    if isinstance(n, ast.Compare): return is_pure(n.left) and all(is_pure(c) for c in n.comparators)
    if isinstance(n, ast.BinOp):
        if isinstance(n.op, (ast.Pow, ast.LShift, ast.MatMult)): return False
        if isinstance(n.op, (ast.Div, ast.FloorDiv, ast.Mod)):
            if not (isinstance(n.right, ast.Constant) and isinstance(n.right.value, (int, float)) and n.right.value != 0): return False
        return is_pure(n.left) and is_pure(n.right)
    return False


def simple_expr(n):
    """BinOp/UnaryOp tree whose leaves are only names and constants."""
    if isinstance(n, (ast.Name, ast.Constant)): return True
    if isinstance(n, ast.UnaryOp): return simple_expr(n.operand)
    if isinstance(n, ast.BinOp): return simple_expr(n.left) and simple_expr(n.right)
    return False


def hoistable(n):
    """Like is_pure but restricted to arithmetic/comparison trees of names and constants."""
    return simple_expr(n) or (isinstance(n, ast.Compare) and simple_expr(n.left) and all(simple_expr(c) for c in n.comparators))


def binop_sites(stmt):
    """(BinOp, consumed) pairs in unconditional positions. `consumed` means the value is only read by an operator."""
    out = []
    skip = (ast.BoolOp, ast.IfExp, ast.Lambda, ast.NamedExpr, ast.ClassDef) + COMPS + FUNCS

    def visit(n, consumed):
        if isinstance(n, skip): return
        if isinstance(n, ast.BinOp):
            if simple_expr(n) and not isinstance(n.op, (ast.MatMult,)): out.append((n, consumed))
            visit(n.left, True); visit(n.right, True); return
        if isinstance(n, ast.UnaryOp): visit(n.operand, True); return
        if isinstance(n, ast.Compare):
            visit(n.left, True)
            for c in n.comparators: visit(c, True)
            return
        if isinstance(n, ast.Subscript): visit(n.value, False); visit(n.slice, True); return
        if isinstance(n, ast.FormattedValue): visit(n.value, True); return
        if isinstance(n, ast.AugAssign): visit(n.target, False); visit(n.value, True); return
        for ch in ast.iter_child_nodes(n): visit(ch, False)

    visit(stmt, False)
    return out


def numeric_names(scope):
    """Names in `scope` whose every assignment is provably numeric (immutable) - used to rule out aliasing."""
    pairs, handled, bad = [], set(), set()
    if isinstance(scope, FUNCS):
        a = scope.args
        for x in a.posonlyargs + a.args + a.kwonlyargs: bad.add(x.arg)
        if a.vararg: bad.add(a.vararg.arg)
        if a.kwarg: bad.add(a.kwarg.arg)
    for n in walk_own(scope):
        if isinstance(n, ast.Assign):
            for t in n.targets:
                if isinstance(t, ast.Name): pairs.append((t.id, n.value)); handled.add(id(t))
        elif isinstance(n, ast.AugAssign) and isinstance(n.target, ast.Name):
            pairs.append((n.target.id, ast.BinOp(ast.Name(n.target.id, ast.Load()), n.op, n.value))); handled.add(id(n.target))
        elif isinstance(n, ast.AnnAssign) and isinstance(n.target, ast.Name) and n.value is not None:
            pairs.append((n.target.id, n.value)); handled.add(id(n.target))
        elif isinstance(n, ast.For) and isinstance(n.target, ast.Name) and isinstance(n.iter, ast.Call) \
                and isinstance(n.iter.func, ast.Name) and n.iter.func.id == "range":
            pairs.append((n.target.id, ast.Constant(0))); handled.add(id(n.target))
    for n in walk_own(scope):
        if isinstance(n, ast.Name) and isinstance(n.ctx, (ast.Store, ast.Del)) and id(n) not in handled: bad.add(n.id)
        elif isinstance(n, SCOPE_NODES): bad.add(n.name)
        elif isinstance(n, (ast.Import, ast.ImportFrom)):
            for a in n.names: bad.add((a.asname or a.name).split(".")[0])
        elif isinstance(n, ast.ExceptHandler) and n.name: bad.add(n.name)
    known = {nm for nm, _ in pairs} - bad

    def num(e):
        if isinstance(e, ast.Constant): return isinstance(e.value, (int, float)) and not isinstance(e.value, complex)
        if isinstance(e, ast.Name): return e.id in known
        if isinstance(e, ast.BinOp): return num(e.left) and num(e.right)
        if isinstance(e, ast.UnaryOp): return num(e.operand) and not isinstance(e.op, ast.Not)
        if isinstance(e, ast.Call) and isinstance(e.func, ast.Name): return e.func.id in ("len", "int", "float", "ord", "hash")
        return False

    changed = True
    while changed:
        changed = False
        for nm, e in pairs:
            if nm in known and not num(e): known.discard(nm); changed = True
    return known


class _Sub(ast.NodeTransformer):
    def __init__(self, mapping, counter):
        self.m, self.c = mapping, counter

    def visit_Name(self, n):
        if isinstance(n.ctx, ast.Load) and n.id in self.m:
            self.c[0] += 1
            return ast.copy_location(copy.deepcopy(self.m[n.id]), n)
        return n

    def _shadow(self, bound):
        return {k: v for k, v in self.m.items() if k not in bound and not (loaded_names(v) & bound)}

    def visit_Lambda(self, n):
        a = n.args
        a.defaults = [self.visit(d) for d in a.defaults]
        a.kw_defaults = [self.visit(d) if d else d for d in a.kw_defaults]
        bound = {x.arg for x in a.posonlyargs + a.args + a.kwonlyargs}
        if a.vararg: bound.add(a.vararg.arg)
        if a.kwarg: bound.add(a.kwarg.arg)
        old, self.m = self.m, self._shadow(bound)
        n.body = self.visit(n.body)
        self.m = old
        return n

    def _comp(self, n):
        gens = n.generators
        gens[0].iter = self.visit(gens[0].iter)
        bound = set()
        for g in gens: bound |= stored_names(g.target)
        old, self.m = self.m, self._shadow(bound)
        for k, g in enumerate(gens):
            if k: g.iter = self.visit(g.iter)
            g.ifs = [self.visit(i) for i in g.ifs]
        if isinstance(n, ast.DictComp):
            n.key, n.value = self.visit(n.key), self.visit(n.value)
        else:
            n.elt = self.visit(n.elt)
        self.m = old
        return n

    visit_ListComp = visit_SetComp = visit_GeneratorExp = visit_DictComp = _comp

    def visit_FunctionDef(self, n): return n
    visit_AsyncFunctionDef = visit_ClassDef = visit_FunctionDef


def substitute(node, mapping, counter=None):
    """Replace Load-context names by expressions (shadowing/capture aware). Mutates and returns node."""
    if not mapping: return node
    return _Sub(mapping, counter if counter is not None else [0]).visit(node)


def count_nodes(n):
    return sum(1 for _ in ast.walk(n))


class Ctx:
    """Collects the change log for one optimization run."""

    def __init__(self, tree, opts=None):
        self.changes, self.warnings, self.opts = [], [], opts or {}
        self.used = {n.id for n in ast.walk(tree) if isinstance(n, ast.Name)} | stored_names(tree)
        self.current = "pass"

    def fresh(self, prefix):
        k = 1
        while f"{prefix}{k}" in self.used: k += 1
        self.used.add(f"{prefix}{k}")
        return f"{prefix}{k}"

    def log(self, node, desc, before="", after="", kind="modified"):
        line = node if isinstance(node, int) else getattr(node, "lineno", 0)
        self.changes.append({"pass": self.current, "line": line, "kind": kind, "description": desc,
                             "before": before, "after": after})
