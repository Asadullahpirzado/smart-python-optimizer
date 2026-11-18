"""Tiny JSON-file persistence for optimization history and full reports."""
import json
import os
import threading
import time
import uuid

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
HIST = os.path.join(ROOT, "history.json")
REPORTS = os.path.join(ROOT, "reports")
_lock = threading.Lock()


def _ensure():
    os.makedirs(REPORTS, exist_ok=True)


def _load():
    try:
        with open(HIST, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return []


def _save(items):
    _ensure()
    tmp = HIST + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(items, f)
    os.replace(tmp, HIST)


def add(report):
    rid = uuid.uuid4().hex[:12]
    report["id"] = rid
    entry = {"id": rid, "ts": time.time(), "filename": report["filename"], "lines": report["lines"]["original"],
             "applied": report["summary"]["applied"], "opportunities": report["summary"]["opportunities"],
             "node_reduction_pct": report["summary"]["node_reduction_pct"], "time_improvement_pct": None,
             "by_pass": report["summary"]["by_pass"], "orig_time": report["complexity"]["original"]["time"],
             "opt_time": report["complexity"]["optimized"]["time"]}
    with _lock:
        _ensure()
        with open(os.path.join(REPORTS, rid + ".json"), "w", encoding="utf-8") as f:
            json.dump(report, f)
        items = _load()
        items.append(entry)
        _save(items[-500:])
    return rid


def get_report(rid):
    if not rid.isalnum():
        return None
    try:
        with open(os.path.join(REPORTS, rid + ".json"), encoding="utf-8") as f:
            return json.load(f)
    except OSError:
        return None


def update_benchmark(rid, bench):
    rep = get_report(rid)
    if rep is None:
        return
    rep["benchmark"] = bench
    with _lock:
        with open(os.path.join(REPORTS, rid + ".json"), "w", encoding="utf-8") as f:
            json.dump(rep, f)
        items = _load()
        for e in items:
            if e["id"] == rid:
                e["time_improvement_pct"] = bench.get("summary", {}).get("avg_time_improvement_pct")
        _save(items)


def history():
    return list(reversed(_load()))


def delete(rid):
    with _lock:
        _save([e for e in _load() if e["id"] != rid])
    try:
        os.remove(os.path.join(REPORTS, rid + ".json"))
    except (OSError, ValueError):
        pass


def clear():
    with _lock:
        for e in _load():
            try:
                os.remove(os.path.join(REPORTS, e["id"] + ".json"))
            except OSError:
                pass
        _save([])


def stats():
    items = _load()
    n = len(items)
    imp = [e["time_improvement_pct"] for e in items if e.get("time_improvement_pct") is not None]
    by_pass = {}
    for e in items:
        for k, v in (e.get("by_pass") or {}).items():
            by_pass[k] = by_pass.get(k, 0) + v
    return {"programs": n, "optimizations": sum(e["applied"] for e in items),
            "avg_node_reduction_pct": round(sum(e["node_reduction_pct"] for e in items) / n, 1) if n else 0,
            "avg_time_improvement_pct": round(sum(imp) / len(imp), 1) if imp else None, "by_pass": by_pass}
