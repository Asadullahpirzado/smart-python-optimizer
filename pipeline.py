"""Orchestration: analysis and optimization pipelines used by the Flask API and tests."""
import ast
import io
import tokenize

from analyzer.call_graph import call_graph_summary
from analyzer.space_complexity import complexity_report
from algorithm_optimizer.recommendation_engine import recommend
from algorithm_optimizer.recursion_optimizer import apply_memoization
from compiler.cfg import CFG
from compiler.intermediate_representation import build_scope_cfg, iter_scopes, scope_name, render_cfg_text
from compiler.lexer import tokenize_source
from compiler.parser import parse_source, ast_summary, SourceError
from compiler.semantic_analyzer import analyze_semantics
from compiler.ssa import to_ssa
from generator.code_generator import generate_code, build_diff, unified
from optimization.common import normalize_settings, node_count, FUNC
from optimization.dataflow import summarize
from optimization.pass_manager import _clone_tree, run_passes
from validation.static_validator import static_validate

SIZES = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]
MAX_SCOPES = 150


def code_stats(code, tree):
    lines = code.splitlines()
    blank = sum(1 for l in lines if not l.strip())
    comment = sum(1 for l in lines if l.strip().startswith("#"))
    counts = {"functions": 0, "classes": 0, "imports": 0, "loops": 0}
    for n in ast.walk(tree):
        if isinstance(n, FUNC):
            counts["functions"] += 1
        elif isinstance(n, ast.ClassDef):
            counts["classes"] += 1
        elif isinstance(n, (ast.Import, ast.ImportFrom)):
            counts["imports"] += 1
        elif isinstance(n, (ast.For, ast.While, ast.AsyncFor)):
            counts["loops"] += 1
    return {"lines": len(lines), "code_lines": len(lines) - blank - comment, "blank": blank, "comments": comment,
            "chars": len(code), "ast_nodes": node_count(tree), **counts}


def growth(cx_a, cx_b):
    return {"sizes": SIZES, "original": [cx_a.ops(n) for n in SIZES], "optimized": [cx_b.ops(n) for n in SIZES]}


def public_complexity(rep):
    return {k: v for k, v in rep.items() if not k.startswith("_")}


def analyze(code, settings=None):
    tree = parse_source(code)
    settings = normalize_settings(settings)
    scopes, cfg_data, ir, df, ssa = list(iter_scopes(tree))[:MAX_SCOPES], {}, [], {}, {}
    for node, _ in scopes:
        name = scope_name(node)
        key = name if name not in cfg_data else f"{name}@{node.lineno}"
        cfg = build_scope_cfg(node)
        info = cfg.analyze()
        cfg_data[key] = {"graph": cfg.to_cytoscape(), "loops": [{"header": cfg.blocks[l["header"]].label,
                         "blocks": [cfg.blocks[b].label for b in l["blocks"]]} for l in info["loops"]],
                         "unreachable": [cfg.blocks[b].label for b in info["unreachable"]],
                         "blocks": len(cfg.blocks), "line": getattr(node, "lineno", 1)}
        ir.append({"scope": key, "text": render_cfg_text(cfg)})
        try:
            df[key] = summarize(cfg)
            ssa[key] = to_ssa(cfg)
        except Exception as exc:
            df[key] = {"blocks": [], "constant_uses": [], "error": str(exc)}
            ssa[key] = {"blocks": [], "phi_count": 0, "versions": {}, "error": str(exc)}
    comp = complexity_report(tree)
    return {"stats": code_stats(code, tree), "tokens": tokenize_source(code), "ast": ast_summary(tree),
            "semantic": analyze_semantics(tree, code), "ir": ir, "cfg": cfg_data, "dataflow": df, "ssa": ssa,
            "algorithms": recommend(tree), "complexity": public_complexity(comp), "call_graph": call_graph_summary(tree),
            "growth": growth(comp["_time_cx"], comp["_time_cx"]), "scope_limit_hit": len(list(iter_scopes(tree))) > MAX_SCOPES}


def optimize(code, settings=None, filename="untitled.py"):
    settings = normalize_settings(settings)
    tree = parse_source(code)
    original_tree = _clone_tree(tree)
    normalized = ast.unparse(original_tree) + "\n"
    comp_before = complexity_report(original_tree)
    recs = recommend(original_tree)
    nodes_before = node_count(original_tree)

    tree, ctx, pass_stats, iterations = run_passes(tree, settings)
    applied_recs = 0
    if settings["apply_recommendations"]:
        applied_recs = apply_memoization(tree, ctx, settings["apply_recommendations"])
    optimized = generate_code(tree)
    static = static_validate(original_tree, optimized)
    warnings = []
    if not static["ok"]:
        warnings.append("Static validation failed – the original code was returned unchanged.")
        optimized, ctx.changes = normalized, []
    opt_tree = ast.parse(optimized)
    comp_after = complexity_report(opt_tree)
    nodes_after = node_count(opt_tree)
    changes = [c.to_dict() for c in ctx.changes]
    by_pass = {}
    for c in changes:
        by_pass[c["pass_name"]] = by_pass.get(c["pass_name"], 0) + 1
    for name, st in pass_stats.items():
        if st["rolled_back"]:
            warnings.append(f"Pass '{name}' failed validation and was rolled back ({st['error']}).")
    sem = analyze_semantics(original_tree, code)
    if sem["unused_imports"]:
        warnings.append(f"{len(sem['unused_imports'])} unused import(s) detected – suggestions only unless the pass is enabled.")
    if sem["undefined_names"]:
        warnings.append(f"{len(sem['undefined_names'])} possibly undefined name(s) detected.")
    if ctx.dynamic:
        warnings.append("Dynamic features (eval/exec/locals/globals/import *) were detected: name-based optimizations were skipped.")
    warnings.append("Comments and original formatting are not preserved (the code is regenerated from the AST).")
    opportunities = len(changes) + len([r for r in recs if r["id"].split(":")[0] and True])
    summary = {"opportunities": opportunities, "applied": len(changes), "suggested": len(recs),
               "by_pass": by_pass, "iterations": iterations, "recommendations_applied": applied_recs,
               "node_reduction_pct": round(100.0 * (nodes_before - nodes_after) / max(nodes_before, 1), 1)}
    return {
        "filename": filename, "original": code, "normalized": normalized, "optimized": optimized,
        "changes": changes, "passes": pass_stats, "recommendations": recs, "summary": summary, "warnings": warnings,
        "diff": build_diff(normalized, optimized), "unified_diff": unified(normalized, optimized),
        "lines": {"original": len(code.splitlines()), "optimized": len(optimized.splitlines()),
                  "normalized": len(normalized.splitlines())},
        "nodes": {"original": nodes_before, "optimized": nodes_after},
        "complexity": {"original": public_complexity(comp_before), "optimized": public_complexity(comp_after),
                       "growth": growth(comp_before["_time_cx"], comp_after["_time_cx"])},
        "static_validation": static, "settings": settings,
        "categories": {"auto": len([c for c in changes if c["safety"] == "auto"]),
                       "suggested": len(recs) + len([c for c in changes if c["safety"] != "auto"]),
                       "manual": len([f for f in comp_before["functions"] if f["manual"]])},
    }
