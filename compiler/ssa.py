"""Static Single Assignment construction (phi placement + renaming) over the IR CFG."""
from collections import defaultdict

from .intermediate_representation import Instr, is_var


def to_ssa(cfg):
    info = cfg.analyze()
    idom, df = info["idom"], info["frontier"]
    blocks = {b: cfg.blocks[b] for b in idom}
    defsites, nonlocal_vars = defaultdict(set), set()
    for bid, b in blocks.items():
        defined = set()
        for ins in b.instrs:
            for u in ins.uses():
                if u not in defined:
                    nonlocal_vars.add(u)
            for d in ins.dsts:
                defined.add(d)
                defsites[d].add(bid)
    phis = defaultdict(list)  # block -> [var]
    for var, sites in defsites.items():
        if var not in nonlocal_vars or len(sites) < 2:
            continue
        placed, work = set(), list(sites)
        while work:
            n = work.pop()
            for y in df.get(n, ()):
                if y not in placed:
                    placed.add(y)
                    phis[y].append(var)
                    if y not in sites:
                        work.append(y)
    children = defaultdict(list)
    for b, p in idom.items():
        if b != p:
            children[p].append(b)
    counter, stacks = defaultdict(int), defaultdict(list)
    out = {b: {"phis": [], "instrs": []} for b in blocks}

    def new(var):
        counter[var] += 1
        name = f"{var}_{counter[var]}"
        stacks[var].append(name)
        return name

    def cur(var):
        return stacks[var][-1] if stacks[var] else var

    phi_nodes = {(b, v): {"var": v, "dst": None, "args": {}} for b, vs in phis.items() for v in vs}
    todo = [("enter", cfg.entry)]
    while todo:
        kind, *rest = todo.pop()
        if kind == "exit":
            for var in rest[0]:
                stacks[var].pop()
            continue
        bid = rest[0]
        pushed = []
        for var in phis.get(bid, ()):
            node = phi_nodes[(bid, var)]
            node["dst"] = new(var)
            pushed.append(var)
            out[bid]["phis"].append(node)
        for ins in blocks[bid].instrs:
            args = [cur(a) if is_var(a) else a for a in ins.args]
            uses = [cur(u) for u in ins.extra]
            dsts = []
            for d in ins.dsts:
                dsts.append(new(d))
                pushed.append(d)
            text = ins.render(dsts, args)
            if uses:
                text += "   ; uses " + ", ".join(uses)
            out[bid]["instrs"].append(text)
        for s, _ in cfg.succ[bid]:
            for var in phis.get(s, ()):
                phi_nodes[(s, var)]["args"][bid] = cur(var)
        todo.append(("exit", pushed))
        for c in reversed(children[bid]):
            todo.append(("enter", c))
    result, versions = [], defaultdict(int)
    for bid, data in out.items():
        lines = []
        for p in data["phis"]:
            args = ", ".join(f"{p['args'].get(pr, p['var'])} [{cfg.blocks[pr].label}]" for pr in cfg.pred[bid] if pr in idom)
            lines.append(f"{p['dst']} = phi({args})")
        lines.extend(data["instrs"])
        result.append({"block": cfg.blocks[bid].label, "lines": lines})
    return {"blocks": result, "phi_count": sum(len(v) for v in phis.values()),
            "versions": {k: v for k, v in counter.items() if not k.startswith("$")}}
