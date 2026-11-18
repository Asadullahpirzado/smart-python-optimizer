"""Worklist-based data-flow analyses over the IR control-flow graph."""
import ast
import operator
from collections import defaultdict, deque

from compiler.intermediate_representation import is_var

NAC = object()  # "not a constant" in the constant-propagation lattice


def _reach(cfg):
    return cfg.reachable()


def _use_def(block):
    use, define = set(), set()
    for ins in block.instrs:
        for u in ins.uses():
            if u not in define:
                use.add(u)
        define.update(ins.dsts)
    return use, define


def liveness(cfg, always_live=frozenset()):
    """Backward may-analysis: variable live at block entry/exit (worklist fixed point)."""
    reach = _reach(cfg)
    ud = {b: _use_def(cfg.blocks[b]) for b in reach}
    live_in = {b: set() for b in reach}
    live_out = {b: set() for b in reach}
    work = deque(reversed(cfg.rpo()))
    queued = set(work)
    while work:
        b = work.popleft()
        queued.discard(b)
        out = set(always_live)
        for s, _ in cfg.succ[b]:
            if s in reach:
                out |= live_in[s]
        new_in = ud[b][0] | (out - ud[b][1])
        live_out[b] = out
        if new_in != live_in[b]:
            live_in[b] = new_in
            for p in cfg.pred[b]:
                if p in reach and p not in queued:
                    work.append(p)
                    queued.add(p)
    return live_in, live_out


def live_after_each(block, live_out):
    """List of live sets after every instruction of the block."""
    live, res = set(live_out), [None] * len(block.instrs)
    for i in range(len(block.instrs) - 1, -1, -1):
        res[i] = set(live)
        ins = block.instrs[i]
        live -= set(ins.dsts)
        live |= set(ins.uses())
    return res


def reaching_definitions(cfg):
    reach = _reach(cfg)
    sites = defaultdict(set)  # var -> {(block, idx)}
    gen, kill = {}, {}
    for b in reach:
        g = {}
        for i, ins in enumerate(cfg.blocks[b].instrs):
            for d in ins.dsts:
                if not d.startswith("$"):
                    g[d] = (b, i)
                    sites[d].add((b, i))
        gen[b] = g
    for b in reach:
        kill[b] = {v for v in gen[b]}
    rin = {b: set() for b in reach}
    rout = {b: set((v, s) for v, s in gen[b].items()) for b in reach}
    work = deque(cfg.rpo())
    while work:
        b = work.popleft()
        new_in = set()
        for p in cfg.pred[b]:
            if p in reach:
                new_in |= rout[p]
        rin[b] = new_in
        new_out = {x for x in new_in if x[0] not in kill[b]} | {(v, s) for v, s in gen[b].items()}
        if new_out != rout[b]:
            rout[b] = new_out
            work.extend(s for s, _ in cfg.succ[b] if s in reach)
    return rin


def available_expressions(cfg):
    reach = _reach(cfg)
    universe, gen_kill = set(), {}
    for b in reach:
        for ins in cfg.blocks[b].instrs:
            if ins.op == "bin" and not any(d in ins.args for d in ins.dsts):
                universe.add((ins.sym, ins.args[0], ins.args[1]))
    for b in reach:
        avail_gen, killed_vars = set(), set()
        for ins in cfg.blocks[b].instrs:
            if ins.op == "bin":
                e = (ins.sym, ins.args[0], ins.args[1])
                if e in universe:
                    avail_gen.add(e)
            for d in ins.dsts:
                killed_vars.add(d)
                avail_gen = {e for e in avail_gen if d not in e[1:]}
        gen_kill[b] = (avail_gen, killed_vars)
    ain = {b: set(universe) for b in reach}
    ain[cfg.entry] = set()
    aout = {b: set(universe) for b in reach}
    work = deque(cfg.rpo())
    while work:
        b = work.popleft()
        if b != cfg.entry:
            ps = [aout[p] for p in cfg.pred[b] if p in reach]
            ain[b] = set.intersection(*ps) if ps else set()
        g, kv = gen_kill[b]
        new_out = {e for e in ain[b] if not (set(e[1:]) & kv)} | g
        if new_out != aout[b]:
            aout[b] = new_out
            work.extend(s for s, _ in cfg.succ[b] if s in reach)
    return ain


BIN = {"+": operator.add, "-": operator.sub, "*": operator.mul, "//": operator.floordiv, "%": operator.mod,
       "/": operator.truediv, "==": operator.eq, "!=": operator.ne, "<": operator.lt, "<=": operator.le,
       ">": operator.gt, ">=": operator.ge}


def _lit(s, state):
    if is_var(s):
        return state.get(s, NAC) if s in state else NAC
    try:
        v = ast.literal_eval(s)
        return v if isinstance(v, (int, float, bool, str)) or v is None else NAC
    except Exception:
        return NAC


def _transfer_const(block, state):
    state = dict(state)
    for ins in block.instrs:
        val = NAC
        if ins.op == "assign" and len(ins.dsts) == 1 and not ins.text:
            val = _lit(ins.args[0], state)
        elif ins.op == "bin" and ins.sym in BIN and len(ins.dsts) == 1:
            a, b = _lit(ins.args[0], state), _lit(ins.args[1], state)
            if a is not NAC and b is not NAC and isinstance(a, (int, float)) and isinstance(b, (int, float)):
                try:
                    if not (ins.sym in ("/", "//", "%") and b == 0):
                        val = BIN[ins.sym](a, b)
                except Exception:
                    val = NAC
        for d in ins.dsts:
            if val is not NAC and len(ins.dsts) == 1:
                state[d] = val
            else:
                state.pop(d, None)
    return state


def constant_propagation_analysis(cfg):
    reach = _reach(cfg)
    out = {b: None for b in reach}
    cin = {b: {} for b in reach}
    work = deque(cfg.rpo())
    while work:
        b = work.popleft()
        preds = [out[p] for p in cfg.pred[b] if p in reach and out[p] is not None]
        if b == cfg.entry:
            state = {}
        elif not preds:
            state = {}
        else:
            state = {k: v for k, v in preds[0].items() if all(k in p and p[k] == v and type(p[k]) is type(v) for p in preds[1:])}
        cin[b] = state
        new = _transfer_const(cfg.blocks[b], state)
        if new != out[b]:
            out[b] = new
            work.extend(s for s, _ in cfg.succ[b] if s in reach)
    facts = []
    for b in reach:
        state = dict(cin[b])
        for ins in cfg.blocks[b].instrs:
            for u in ins.args:
                if is_var(u) and not u.startswith("$") and u in state:
                    facts.append({"line": ins.lineno, "var": u, "value": repr(state[u]), "block": cfg.blocks[b].label})
            state = _transfer_const(type("B", (), {"instrs": [ins]}), state)
    return cin, facts


def summarize(cfg, limit=60):
    """JSON-friendly summary of every analysis for the UI."""
    live_in, live_out = liveness(cfg)
    rin = reaching_definitions(cfg)
    ain = available_expressions(cfg)
    cin, facts = constant_propagation_analysis(cfg)
    lab = lambda b: cfg.blocks[b].label
    lines = lambda sites: sorted({cfg.blocks[bb].instrs[ii].lineno for _, (bb, ii) in sites if cfg.blocks[bb].instrs[ii].lineno})
    blocks = []
    for b in cfg.rpo()[:limit]:
        rd = defaultdict(set)
        for v, (bb, ii) in rin[b]:
            ln = cfg.blocks[bb].instrs[ii].lineno
            if ln:
                rd[v].add(ln)
        blocks.append({
            "block": lab(b),
            "live_in": sorted(v for v in live_in[b] if not v.startswith("$")),
            "live_out": sorted(v for v in live_out[b] if not v.startswith("$")),
            "reaching": {v: sorted(l) for v, l in sorted(rd.items())},
            "available": sorted(f"{a} {op} {c}" for op, a, c in ain[b]),
            "constants": {k: repr(v) for k, v in cin[b].items() if not k.startswith("$")},
        })
    return {"blocks": blocks, "constant_uses": facts[:limit * 3], "block_count": len(cfg.rpo())}
