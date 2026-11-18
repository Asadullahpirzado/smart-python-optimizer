"""Data-flow analyses solved with a worklist fixed-point algorithm over the CFG."""
import ast
from collections import deque
from compiler.cfg import analyze

TOP = "NAC"  # not-a-constant


def _solve(cfg, forward, init_in, transfer, meet, info):
    ids = sorted(info["reachable"])
    nxt = info["succ"] if forward else {b: [] for b in ids}
    pred = info["preds"]
    if not forward:
        pred = {b: [t for t in info["succ"][b] if t in info["reachable"]] for b in ids}
    IN = {b: None for b in ids}; OUT = {b: None for b in ids}
    start = cfg.entry.id
    work = deque(ids if forward else reversed(ids))
    steps = 0
    while work and steps < 20000:
        steps += 1
        b = work.popleft()
        ps = [p for p in pred[b] if OUT[p] is not None]
        if forward and b == start: new_in = init_in
        elif ps: new_in = meet([OUT[p] for p in ps])
        else: new_in = init_in if not forward else (OUT[b] if False else init_in)
        new_out = transfer(b, new_in)
        if IN[b] != new_in or OUT[b] != new_out:
            IN[b], OUT[b] = new_in, new_out
            for s in (info["succ"][b] if forward else info["preds"][b]):
                if s in OUT and s not in work: work.append(s)
    return IN, OUT


def liveness(cfg, info):
    blocks = {b.id: b for b in cfg.blocks}

    def transfer(b, out):
        live = set(out)
        for it in reversed(blocks[b].items):
            live = (live - it["defs"]) | it["uses"]
        return frozenset(live)
    IN, OUT = _solve(cfg, False, frozenset(), transfer, lambda xs: frozenset().union(*xs), info)
    # for the backward problem "IN" of the solver is the live-out set and OUT the live-in set
    return {b: {"in": sorted(OUT[b] or []), "out": sorted(IN[b] or [])} for b in IN}


def reaching_definitions(cfg, info):
    blocks = {b.id: b for b in cfg.blocks}
    defs_all = {}
    for b in cfg.blocks:
        for k, it in enumerate(b.items):
            for d in it["defs"]: defs_all.setdefault(d, set()).add((d, b.id, it["line"] or 0))

    def transfer(b, ins):
        cur = set(ins)
        for it in blocks[b].items:
            for d in it["defs"]:
                cur = {x for x in cur if x[0] != d} | {(d, b, it["line"] or 0)}
        return frozenset(cur)
    init = frozenset((p, -1, 0) for p in cfg.params)
    IN, OUT = _solve(cfg, True, init, transfer, lambda xs: frozenset().union(*xs), info)
    fmt = lambda s: sorted(f"{d}@{'param' if bl < 0 else 'L' + str(ln)}" for d, bl, ln in s)
    return {b: {"in": fmt(IN[b] or []), "out": fmt(OUT[b] or [])} for b in IN}


def available_expressions(cfg, info):
    blocks = {b.id: b for b in cfg.blocks}
    universe = set()
    for b in cfg.blocks:
        for it in b.items: universe |= it["exprs"]

    def vars_of(e):
        return {n.id for n in ast.walk(ast.parse(e, mode="eval")) if isinstance(n, ast.Name)}
    vcache = {e: vars_of(e) for e in universe}

    def transfer(b, ins):
        cur = set(ins)
        for it in blocks[b].items:
            cur |= it["exprs"]
            cur = {e for e in cur if not (vcache[e] & it["defs"])}
        return frozenset(cur)
    IN, OUT = _solve(cfg, True, frozenset(), transfer, lambda xs: frozenset.intersection(*xs), info)
    return {b: {"in": sorted(IN[b] or []), "out": sorted(OUT[b] or [])} for b in IN}


def _eval(e, env):
    if isinstance(e, ast.Constant) and isinstance(e.value, (int, float, bool)): return e.value
    if isinstance(e, ast.Name):
        v = env.get(e.id, TOP); return v
    if isinstance(e, ast.UnaryOp) and isinstance(e.op, (ast.USub, ast.UAdd)):
        v = _eval(e.operand, env); return TOP if v == TOP and not isinstance(v, (int, float)) else (-v if isinstance(e.op, ast.USub) else v)
    if isinstance(e, ast.BinOp):
        a, b = _eval(e.left, env), _eval(e.right, env)
        if isinstance(a, str) or isinstance(b, str): return TOP
        try:
            if isinstance(e.op, ast.Add): return a + b
            if isinstance(e.op, ast.Sub): return a - b
            if isinstance(e.op, ast.Mult): return a * b
            if isinstance(e.op, ast.FloorDiv): return a // b
            if isinstance(e.op, ast.Mod): return a % b
        except Exception: return TOP
    return TOP


def constant_propagation(cfg, info):
    blocks = {b.id: b for b in cfg.blocks}

    def transfer(b, ins):
        env = dict(ins)
        for it in blocks[b].items:
            n = it["node"]
            if it["kind"] == "stmt" and isinstance(n, ast.Assign) and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name):
                env[n.targets[0].id] = _eval(n.value, env)
            elif it["kind"] == "stmt" and isinstance(n, ast.AugAssign) and isinstance(n.target, ast.Name):
                env[n.target.id] = _eval(ast.BinOp(ast.Name(n.target.id, ast.Load()), n.op, n.value), env)
            else:
                for d in it["defs"]: env[d] = TOP
        return tuple(sorted(env.items(), key=lambda kv: kv[0]))

    def meet(xs):
        dicts = [dict(x) for x in xs]
        keys = set().union(*dicts)
        out = {}
        for k in keys:
            vals = [d.get(k, TOP) for d in dicts]
            out[k] = vals[0] if all(v == vals[0] and type(v) == type(vals[0]) for v in vals) else TOP
        return tuple(sorted(out.items()))
    IN, OUT = _solve(cfg, True, tuple(), transfer, meet, info)
    return {b: {"in": {k: v for k, v in (IN[b] or ()) if v != TOP}, "out": {k: v for k, v in (OUT[b] or ()) if v != TOP}} for b in IN}


def run_all(cfg):
    info = analyze(cfg)
    return {"function": cfg.name,
            "live_variables": liveness(cfg, info),
            "reaching_definitions": reaching_definitions(cfg, info),
            "available_expressions": available_expressions(cfg, info),
            "constant_propagation": constant_propagation(cfg, info)}
