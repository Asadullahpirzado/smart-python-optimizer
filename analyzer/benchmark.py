"""Benchmark original vs optimized code (timeit + tracemalloc inside the sandbox)."""
from validation.differential_testing import run_in_sandbox


def run_benchmark(original, optimized, entry=None, sizes=None, repeats=5, timeout=30):
    out = {}
    for label, code in (("original", original), ("optimized", optimized)):
        r = run_in_sandbox({"mode": "benchmark", "code": code, "entry": entry or None, "sizes": sizes or [], "repeats": repeats,
                            "cpu_s": timeout + 5}, timeout)
        if "error" in r:
            return {"error": f"{label}: {r['error']}"}
        out[label] = r["rows"]
    rows = []
    for a, b in zip(out["original"], out["optimized"]):
        imp = 100.0 * (a["mean_s"] - b["mean_s"]) / a["mean_s"] if a["mean_s"] > 0 else 0.0
        mem = 100.0 * (a["peak_kb"] - b["peak_kb"]) / a["peak_kb"] if a["peak_kb"] > 0 else 0.0
        rows.append({"size": a["size"], "original": a, "optimized": b, "time_improvement_pct": imp, "memory_improvement_pct": mem,
                     "same_result": a["result"] == b["result"]})
    avg = sum(r["time_improvement_pct"] for r in rows) / len(rows) if rows else 0
    return {"rows": rows, "summary": {"avg_time_improvement_pct": round(avg, 1),
                                      "note": "Measured values; complexity estimates elsewhere are static."}}
