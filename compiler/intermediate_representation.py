"""Three-address code (TAC) generation. Produces a CFG of basic blocks per scope."""
import ast

from .cfg import CFG

FUNC = (ast.FunctionDef, ast.AsyncFunctionDef)
OPSYM = {ast.Add: "+", ast.Sub: "-", ast.Mult: "*", ast.Div: "/", ast.FloorDiv: "//", ast.Mod: "%", ast.Pow: "**",
         ast.BitAnd: "&", ast.BitOr: "|", ast.BitXor: "^", ast.LShift: "<<", ast.RShift: ">>", ast.MatMult: "@",
         ast.USub: "-", ast.UAdd: "+", ast.Not: "not ", ast.Invert: "~", ast.Eq: "==", ast.NotEq: "!=", ast.Lt: "<",
         ast.LtE: "<=", ast.Gt: ">", ast.GtE: ">=", ast.Is: "is", ast.IsNot: "is not", ast.In: "in", ast.NotIn: "not in"}
CONST_NAMES = {"True", "False", "None"}


def is_var(s):
    return isinstance(s, str) and (s.isidentifier() or s.startswith("$")) and s not in CONST_NAMES


def loaded_names(node):
    out = set()
    for n in ast.walk(node):
        if isinstance(n, ast.Name):
            out.add(n.id)
    return out


def stored_names(node):
    out = set()
    for n in ast.walk(node):
        if isinstance(n, ast.Name) and isinstance(n.ctx, (ast.Store, ast.Del)):
            out.add(n.id)
    return out


class Instr:
    __slots__ = ("op", "dsts", "args", "text", "sym", "lineno", "stmt", "extra", "user", "preds")

    def __init__(self, op, dsts=(), args=(), text="", sym="", lineno=0, stmt=None, extra=(), user=False):
        self.op, self.dsts, self.args, self.text, self.sym = op, list(dsts), list(args), text, sym
        self.lineno, self.stmt, self.extra, self.user, self.preds = lineno, stmt, list(extra), user, None

    def uses(self):
        return [a for a in self.args if is_var(a)] + list(self.extra)

    def render(self, dsts=None, args=None):
        d = dsts if dsts is not None else self.dsts
        a = args if args is not None else self.args
        d0 = d[0] if d else "_"
        op = self.op
        if op == "assign":
            return f"{d0} = {a[0]}"
        if op == "bin":
            return f"{d0} = {a[0]} {self.sym} {a[1]}"
        if op == "un":
            return f"{d0} = {self.sym}{a[0]}"
        if op == "call":
            return f"{d0} = call {self.text}({', '.join(a)})"
        if op == "expr":
            return (f"{d0} = " if d else "") + f"<{self.text}>"
        if op == "store":
            return f"{self.text} = {a[0]}"
        if op == "branch":
            return f"if {a[0]}" if a else "if ?"
        if op == "return":
            return "return" + (f" {a[0]}" if a and a[0] else "")
        if op == "for_next":
            return f"{', '.join(d)} = next({a[0]})"
        if op == "phi":
            return f"{d0} = phi({', '.join(a)})"
        if op in ("def", "import", "param", "del", "raise", "jump", "nop"):
            return (op + " " + (self.text or ", ".join(d))).strip()
        return f"{op} {self.text}".strip()


class IRBuilder:
    def __init__(self, name, params=()):
        self.cfg = CFG(name)
        self.cur = self.cfg.new_block()
        self.cfg.entry = self.cur.id
        self.exit = self.cfg.new_block("exit")
        self.cfg.exit = self.exit.id
        self.tmp = 0
        self.loops = []
        self.handlers = []
        if params:
            self.emit("param", dsts=params)

    # -- helpers -----------------------------------------------------------
    def block(self):
        b = self.cfg.new_block()
        for hs in self.handlers:
            for h in hs:
                self.cfg.add_edge(b.id, h, "exc")
        return b

    def emit(self, op, dsts=(), args=(), text="", sym="", node=None, extra=(), user=False):
        ins = Instr(op, dsts, args, text, sym, getattr(node, "lineno", 0), node, extra, user)
        self.cur.instrs.append(ins)
        return ins

    def temp(self):
        self.tmp += 1
        return f"$t{self.tmp}"

    def jump(self, target, kind="seq"):
        self.cfg.add_edge(self.cur.id, target.id if hasattr(target, "id") else target, kind)

    def detach(self):
        self.cur = self.block()

    # -- expressions ---------------------------------------------------------
    def val(self, e):
        if e is None:
            return ""
        if isinstance(e, ast.Constant):
            return repr(e.value)[:30]
        if isinstance(e, ast.Name):
            return e.id
        if isinstance(e, ast.UnaryOp):
            if isinstance(e.op, ast.USub) and isinstance(e.operand, ast.Constant) and isinstance(e.operand.value, (int, float)):
                return repr(-e.operand.value)
            a = self.val(e.operand)
            t = self.temp()
            self.emit("un", [t], [a], sym=OPSYM.get(type(e.op), "?"), node=e)
            return t
        if isinstance(e, ast.BinOp):
            l, r = self.val(e.left), self.val(e.right)
            t = self.temp()
            self.emit("bin", [t], [l, r], sym=OPSYM.get(type(e.op), "?"), node=e)
            return t
        if isinstance(e, ast.Compare) and len(e.ops) == 1:
            l, r = self.val(e.left), self.val(e.comparators[0])
            t = self.temp()
            self.emit("bin", [t], [l, r], sym=OPSYM.get(type(e.ops[0]), "?"), node=e)
            return t
        if isinstance(e, ast.Call) and not any(isinstance(a, ast.Starred) for a in e.args):
            args = [self.val(a) for a in e.args] + [self.val(k.value) for k in e.keywords if k.arg]
            t = self.temp()
            self.emit("call", [t], args, text=ast.unparse(e.func)[:40], node=e, extra=sorted(loaded_names(e.func)))
            return t
        t = self.temp()
        walrus = sorted(n.target.id for n in ast.walk(e) if isinstance(n, ast.NamedExpr))
        self.emit("expr", [t] + walrus, text=ast.unparse(e)[:80], node=e, extra=sorted(loaded_names(e)))
        return t

    # -- statements ----------------------------------------------------------
    def stmts(self, body):
        for st in body:
            if self.handlers:
                nb = self.block()
                self.jump(nb)
                self.cur = nb
            self.stmt(st)

    def assign_name(self, name, value, node, user):
        v = self.val(value)
        last = self.cur.instrs[-1] if self.cur.instrs else None
        if v.startswith("$") and last is not None and last.dsts and last.dsts[0] == v and last.op in ("bin", "un", "call", "expr"):
            last.dsts[0] = name
            last.user, last.stmt, last.lineno = user, node, getattr(node, "lineno", 0)
        else:
            self.emit("assign", [name], [v], node=node, user=user)

    def stmt(self, st):
        if isinstance(st, ast.Assign):
            single = len(st.targets) == 1
            for t in st.targets:
                if isinstance(t, ast.Name):
                    self.assign_name(t.id, st.value, st, user=single)
                elif isinstance(t, (ast.Tuple, ast.List)):
                    v = self.val(st.value)
                    self.emit("assign", sorted(stored_names(t)), [v], node=st)
                    self.cur.instrs[-1].op = "for_next" if False else "assign"
                    self.cur.instrs[-1].text = ast.unparse(t)
                else:
                    v = self.val(st.value)
                    self.emit("store", [], [v], text=ast.unparse(t)[:60], node=st, extra=sorted(loaded_names(t)))
        elif isinstance(st, ast.AnnAssign):
            if st.value is not None:
                if isinstance(st.target, ast.Name):
                    self.assign_name(st.target.id, st.value, st, user=False)
                else:
                    v = self.val(st.value)
                    self.emit("store", [], [v], text=ast.unparse(st.target)[:60], node=st, extra=sorted(loaded_names(st.target)))
        elif isinstance(st, ast.AugAssign):
            if isinstance(st.target, ast.Name):
                v = self.val(st.value)
                self.emit("bin", [st.target.id], [st.target.id, v], sym=OPSYM.get(type(st.op), "?"), node=st)
            else:
                self.emit("expr", [], text=ast.unparse(st)[:80], node=st, extra=sorted(loaded_names(st)))
        elif isinstance(st, ast.Expr):
            self.val(st.value)
        elif isinstance(st, ast.Return):
            v = self.val(st.value)
            self.emit("return", args=[v] if v else [], node=st)
            self.jump(self.exit)
            self.detach()
        elif isinstance(st, ast.Raise):
            self.emit("raise", text=ast.unparse(st)[:50], node=st, extra=sorted(loaded_names(st)))
            if not self.handlers:
                self.jump(self.exit)
            self.detach()
        elif isinstance(st, ast.Break):
            self.emit("jump", text="break", node=st)
            if self.loops:
                self.jump(self.loops[-1][1], "break")
            self.detach()
        elif isinstance(st, ast.Continue):
            self.emit("jump", text="continue", node=st)
            if self.loops:
                self.jump(self.loops[-1][0], "continue")
            self.detach()
        elif isinstance(st, ast.If):
            c = self.val(st.test)
            self.emit("branch", args=[c], node=st)
            cond, then_b, else_b, join = self.cur, self.block(), self.block(), self.block()
            self.jump(then_b, "true")
            self.cfg.add_edge(cond.id, else_b.id, "false")
            self.cur = then_b
            self.stmts(st.body)
            self.jump(join)
            self.cur = else_b
            self.stmts(st.orelse)
            self.jump(join)
            self.cur = join
        elif isinstance(st, (ast.While,)):
            header, body_b, exit_b = self.block(), self.block(), self.block()
            self.jump(header)
            self.cur = header
            c = self.val(st.test)
            self.emit("branch", args=[c], node=st)
            hdr_end = self.cur
            self.cfg.add_edge(hdr_end.id, body_b.id, "true")
            always = isinstance(st.test, ast.Constant) and bool(st.test.value)
            else_b = self.block() if st.orelse else exit_b
            if not always:
                self.cfg.add_edge(hdr_end.id, else_b.id, "false")
            self.loops.append((header, exit_b))
            self.cur = body_b
            self.stmts(st.body)
            self.jump(header, "back")
            self.loops.pop()
            if st.orelse:
                self.cur = else_b
                self.stmts(st.orelse)
                self.jump(exit_b)
            self.cur = exit_b
        elif isinstance(st, (ast.For, ast.AsyncFor)):
            it = self.val(st.iter)
            header, body_b, exit_b = self.block(), self.block(), self.block()
            self.jump(header)
            self.cur = header
            self.emit("for_next", sorted(stored_names(st.target)), [it], node=st)
            self.emit("branch", args=["has_next"], node=st)
            else_b = self.block() if st.orelse else exit_b
            self.cfg.add_edge(header.id, body_b.id, "true")
            self.cfg.add_edge(header.id, else_b.id, "false")
            self.loops.append((header, exit_b))
            self.cur = body_b
            self.stmts(st.body)
            self.jump(header, "back")
            self.loops.pop()
            if st.orelse:
                self.cur = else_b
                self.stmts(st.orelse)
                self.jump(exit_b)
            self.cur = exit_b
        elif isinstance(st, ast.Try) or type(st).__name__ == "TryStar":
            entries = [self.block() for _ in st.handlers]
            fin = self.block() if st.finalbody else None
            after = self.block()
            targets = [e.id for e in entries] + ([fin.id] if fin else [])
            self.handlers.append(targets)
            start = self.block()
            self.jump(start)
            self.cur = start
            self.stmts(st.body)
            self.handlers.pop()
            self.stmts(st.orelse)
            self.jump(fin or after)
            for h, entry in zip(st.handlers, entries):
                self.cur = entry
                if h.name:
                    self.emit("assign", [h.name], ["<exception>"], node=h)
                self.stmts(h.body)
                self.jump(fin or after)
            if fin:
                self.cur = fin
                self.stmts(st.finalbody)
                self.jump(after)
            self.cur = after
        elif isinstance(st, (ast.With, ast.AsyncWith)):
            after = self.block()
            for item in st.items:
                cm = self.val(item.context_expr)
                if item.optional_vars is not None:
                    self.emit("assign", sorted(stored_names(item.optional_vars)), [cm], node=st)
            self.handlers.append([after.id])
            start = self.block()
            self.jump(start)
            self.cur = start
            self.stmts(st.body)
            self.handlers.pop()
            self.jump(after)
            self.cur = after
        elif isinstance(st, (*FUNC, ast.ClassDef)):
            extra = sorted(loaded_names(st))
            self.emit("def", [st.name], text=f"{st.name}", node=st, extra=extra)
        elif isinstance(st, (ast.Import, ast.ImportFrom)):
            names = [a.asname or a.name.split(".")[0] for a in st.names if a.name != "*"]
            self.emit("import", names, text=ast.unparse(st)[:60], node=st)
        elif isinstance(st, ast.Delete):
            self.emit("del", [], text=ast.unparse(st), node=st, extra=sorted(loaded_names(st)))
        elif isinstance(st, ast.Assert):
            self.val(st.test)
        elif isinstance(st, (ast.Global, ast.Nonlocal, ast.Pass)):
            pass
        else:  # match statements and anything unforeseen: opaque, treated as a pure *use* of everything it touches
            names = sorted(loaded_names(st) | {n.name for n in ast.walk(st) if isinstance(getattr(n, "name", None), str)})
            self.emit("expr", [], text=type(st).__name__, node=st, extra=names)

    def finish(self):
        self.jump(self.exit)
        return self.cfg


def build_scope_cfg(scope):
    """Build the CFG of a Module or FunctionDef node."""
    if isinstance(scope, ast.Module):
        b = IRBuilder("<module>")
        b.stmts(scope.body)
    else:
        a = scope.args
        params = [x.arg for x in a.posonlyargs + a.args + a.kwonlyargs] + ([a.vararg.arg] if a.vararg else []) + ([a.kwarg.arg] if a.kwarg else [])
        b = IRBuilder(scope.name, params)
        b.stmts(scope.body)
    return b.finish()


def iter_scopes(tree):
    """Yield (node, parent_scope) for the module and every function in it."""
    out = [(tree, None)]
    stack = [(tree, tree)]
    while stack:
        node, scope = stack.pop()
        for child in ast.iter_child_nodes(node):
            if isinstance(child, FUNC):
                out.append((child, scope))
                stack.append((child, child))
            else:
                stack.append((child, scope))
    return out


def scope_name(node):
    return "<module>" if isinstance(node, ast.Module) else node.name


def render_cfg_text(cfg):
    lines = []
    idom = cfg.analyze()["idom"]
    for bid, b in cfg.blocks.items():
        succ = ", ".join(f"{cfg.blocks[t].label}{'' if k == 'seq' else ' [' + k + ']'}" for t, k in cfg.succ[bid])
        lines.append(f"{b.label}:" + ("" if bid in idom else "   ; unreachable"))
        lines.extend("    " + i.render() for i in b.instrs)
        lines.append(f"    -> {succ or '(none)'}")
    return "\n".join(lines)
