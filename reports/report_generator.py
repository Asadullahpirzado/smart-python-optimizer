"""Markdown / HTML report rendering."""
import html
import time


def _fmt_bench(b):
    if not b:
        return []
    rows = []
    for r in b.get("rows", []):
        rows.append((r["size"], f"{r['original']['mean_s']*1000:.3f} ms", f"{r['optimized']['mean_s']*1000:.3f} ms",
                     f"{r['time_improvement_pct']:.1f}%", f"{r['original']['peak_kb']:.0f} KB", f"{r['optimized']['peak_kb']:.0f} KB"))
    return rows


def to_markdown(rep):
    s, c = rep["summary"], rep["complexity"]
    out = [f"# Optimization Report – {rep['filename']}", "", f"Generated {time.strftime('%Y-%m-%d %H:%M:%S')}", "",
           "## Summary", f"- Optimization opportunities: {s['opportunities']}", f"- Optimizations applied: {s['applied']}",
           f"- Lines: {rep['lines']['original']} → {rep['lines']['optimized']}",
           f"- AST nodes: {rep['nodes']['original']} → {rep['nodes']['optimized']} ({s['node_reduction_pct']}% fewer)",
           f"- Estimated time complexity: {c['original']['time']} → {c['optimized']['time']}",
           f"- Estimated space complexity: {c['original']['space']} → {c['optimized']['space']}", "",
           "## Applied transformations"]
    for ch in rep["changes"]:
        out += [f"- **{ch['pass_name']}** (line {ch['lineno']}): `{ch['before']}` → `{ch['after']}` – {ch['explanation']}"]
    out += ["", "## Algorithmic recommendations"]
    for r in rep["recommendations"]:
        out += [f"- **{r['title']}** (line {r['lineno']}, {r['original_complexity']} → {r['improved_complexity']}): {r['explanation']}"]
    rows = _fmt_bench(rep.get("benchmark"))
    if rows:
        out += ["", "## Benchmark", "| n | original | optimized | improvement | mem orig | mem opt |", "|---|---|---|---|---|---|"]
        out += ["| " + " | ".join(map(str, r)) + " |" for r in rows]
        out += ["", "Timings are measured with timeit/tracemalloc; complexity figures above are static estimates."]
    out += ["", "## Warnings"] + [f"- {w}" for w in rep["warnings"]]
    return "\n".join(out) + "\n"


def to_html(rep):
    e = html.escape
    s, c = rep["summary"], rep["complexity"]
    cards = "".join(f"<div class='c' style='border-top:4px solid {col}'><b>{e(str(v))}</b><span>{e(k)}</span></div>"
                    for (k, v), col in zip([("Opportunities", s["opportunities"]), ("Applied", s["applied"]),
                                            ("Lines", f"{rep['lines']['original']}→{rep['lines']['optimized']}"),
                                            ("Time", f"{c['original']['time']}→{c['optimized']['time']}"),
                                            ("Space", f"{c['original']['space']}→{c['optimized']['space']}")],
                                           ["#4285F4", "#34D399", "#FB923C", "#A78BFA", "#2DD4BF"]))
    changes = "".join(f"<tr><td>{e(x['pass_name'])}</td><td>{x['lineno']}</td><td><code>{e(x['before'])}</code></td><td><code>{e(x['after'])}</code></td><td>{e(x['explanation'])}</td></tr>" for x in rep["changes"])
    recs = "".join(f"<tr><td>{e(r['title'])}</td><td>{r['lineno']}</td><td>{e(r['original_complexity'])} → {e(r['improved_complexity'])}</td><td>{e(r['explanation'])}</td></tr>" for r in rep["recommendations"])
    bench = "".join("<tr>" + "".join(f"<td>{e(str(x))}</td>" for x in r) + "</tr>" for r in _fmt_bench(rep.get("benchmark")))
    warns = "".join(f"<li>{e(w)}</li>" for w in rep["warnings"])
    return f"""<!doctype html><html><head><meta charset=utf-8><title>Report – {e(rep['filename'])}</title><style>
body{{font-family:Segoe UI,Arial,sans-serif;background:#F8FAFC;color:#25324B;margin:0;padding:32px}}h1{{margin-top:0}}
.g{{display:flex;gap:14px;flex-wrap:wrap}}.c{{background:#fff;border-radius:14px;padding:16px 22px;box-shadow:0 2px 10px #0001;min-width:130px}}
.c b{{display:block;font-size:22px}}.c span{{color:#64748B;font-size:13px}}table{{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px #0001;margin:10px 0 28px}}
td,th{{padding:8px 12px;border-bottom:1px solid #E2E8F0;text-align:left;font-size:13px;vertical-align:top}}th{{background:#EEF2FF}}code{{background:#F1F5F9;padding:1px 5px;border-radius:4px}}</style></head><body>
<h1>Optimization Report – {e(rep['filename'])}</h1><div class=g>{cards}</div>
<h2>Applied transformations</h2><table><tr><th>Pass</th><th>Line</th><th>Before</th><th>After</th><th>Why</th></tr>{changes}</table>
<h2>Algorithmic recommendations</h2><table><tr><th>Pattern</th><th>Line</th><th>Complexity</th><th>Explanation</th></tr>{recs}</table>
{('<h2>Benchmark</h2><table><tr><th>n</th><th>Original</th><th>Optimized</th><th>Improvement</th><th>Mem orig</th><th>Mem opt</th></tr>' + bench + '</table>') if bench else ''}
<h2>Warnings</h2><ul>{warns}</ul></body></html>"""
