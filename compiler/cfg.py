"""Control-flow graph with dominators, dominance frontiers and natural loops."""
from collections import defaultdict, deque


class Block:
    __slots__ = ("id", "label", "instrs")

    def __init__(self, bid, label=None):
        self.id, self.label, self.instrs = bid, label or f"B{bid}", []


class CFG:
    def __init__(self, name):
        self.name = name
        self.blocks = {}
        self.succ = defaultdict(list)
        self.pred = defaultdict(list)
        self.entry = None
        self.exit = None
        self._n = 0
        self._cache = None

    def new_block(self, label=None):
        b = Block(self._n, label)
        self.blocks[b.id] = b
        self._n += 1
        return b

    def add_edge(self, a, b, kind="seq"):
        if any(t == b for t, _ in self.succ[a]):
            return
        self.succ[a].append((b, kind))
        self.pred[b].append(a)

    def reachable(self):
        seen, queue = {self.entry}, deque([self.entry])
        while queue:
            n = queue.popleft()
            for m, _ in self.succ[n]:
                if m not in seen:
                    seen.add(m)
                    queue.append(m)
        return seen

    def rpo(self):
        seen, order = {self.entry}, []
        stack = [(self.entry, iter([t for t, _ in self.succ[self.entry]]))]
        while stack:
            n, it = stack[-1]
            for m in it:
                if m not in seen:
                    seen.add(m)
                    stack.append((m, iter([t for t, _ in self.succ[m]])))
                    break
            else:
                stack.pop()
                order.append(n)
        return order[::-1]

    def dominators(self):
        order = self.rpo()
        idx = {b: i for i, b in enumerate(order)}
        idom = {order[0]: order[0]}

        def inter(a, b):
            while a != b:
                while idx[a] > idx[b]:
                    a = idom[a]
                while idx[b] > idx[a]:
                    b = idom[b]
            return a

        changed = True
        while changed:
            changed = False
            for b in order[1:]:
                ps = [p for p in self.pred[b] if p in idom]
                if not ps:
                    continue
                new = ps[0]
                for p in ps[1:]:
                    new = inter(p, new)
                if idom.get(b) != new:
                    idom[b] = new
                    changed = True
        return idom

    @staticmethod
    def dominates(idom, a, b):
        while True:
            if a == b:
                return True
            nxt = idom.get(b)
            if nxt is None or nxt == b:
                return False
            b = nxt

    def frontiers(self, idom):
        df = defaultdict(set)
        for b in idom:
            preds = [p for p in self.pred[b] if p in idom]
            if len(preds) >= 2:
                for p in preds:
                    runner = p
                    while runner != idom[b]:
                        df[runner].add(b)
                        runner = idom[runner]
        return df

    def analyze(self):
        if self._cache:
            return self._cache
        idom = self.dominators()
        back = [(u, v) for u in idom for v, _ in self.succ[u] if v in idom and self.dominates(idom, v, u)]
        loops = []
        for u, v in back:
            body, stack = {v, u}, [u]
            while stack:
                n = stack.pop()
                for p in self.pred[n]:
                    if p in idom and p not in body:
                        body.add(p)
                        stack.append(p)
            loops.append({"header": v, "latch": u, "blocks": sorted(body)})
        reach = set(idom)
        unreachable = [b for b in self.blocks if b not in reach and self.blocks[b].instrs]
        self._cache = {"idom": idom, "back_edges": back, "loops": loops, "unreachable": unreachable,
                       "frontier": self.frontiers(idom)}
        return self._cache

    def to_cytoscape(self, limit=300):
        info = self.analyze()
        header = {l["header"] for l in info["loops"]}
        in_loop = {b for l in info["loops"] for b in l["blocks"]}
        back = set(info["back_edges"])
        nodes, edges, ids = [], [], list(self.blocks)
        keep = set(ids[:limit])
        for bid in ids[:limit]:
            b = self.blocks[bid]
            classes = []
            if bid == self.entry:
                classes.append("entry")
            if bid == self.exit:
                classes.append("exit")
            if bid in info["unreachable"]:
                classes.append("unreachable")
            if bid in header:
                classes.append("loop-header")
            elif bid in in_loop:
                classes.append("loop-body")
            if any(i.op == "branch" for i in b.instrs):
                classes.append("branch")
            body = [i.render() for i in b.instrs]
            nodes.append({"data": {"id": f"b{bid}", "label": b.label + ("\n" + "\n".join(x[:34] for x in body[:5]) if body else ""),
                                   "instrs": body, "idom": self.blocks[info["idom"][bid]].label if bid in info["idom"] else None,
                                   "reachable": bid in info["idom"]}, "classes": " ".join(classes)})
        for a in ids[:limit]:
            for t, kind in self.succ[a]:
                if t in keep:
                    k = "back" if (a, t) in back else kind
                    edges.append({"data": {"id": f"e{a}_{t}", "source": f"b{a}", "target": f"b{t}", "label": "" if k == "seq" else k},
                                  "classes": k})
        return {"nodes": nodes, "edges": edges, "truncated": len(ids) > limit}
