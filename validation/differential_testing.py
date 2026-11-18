"""Parent-side runner for sandboxed execution (benchmark / differential / property tests)."""
import json
import os
import subprocess
import sys
import tempfile

WORKER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sandbox_worker.py")
MARK = "@@RESULT@@"


def run_in_sandbox(job, timeout=60):
    """Execute a job in an isolated, resource-limited subprocess (no shared state, no stdin, temp cwd)."""
    with tempfile.TemporaryDirectory() as tmp:
        try:
            p = subprocess.run([sys.executable, "-I", WORKER], input=json.dumps(job), capture_output=True, text=True,
                               timeout=timeout, cwd=tmp, env={"PATH": os.environ.get("PATH", ""), "PYTHONHASHSEED": "0"})
        except subprocess.TimeoutExpired:
            return {"error": f"Execution exceeded the {timeout}s time limit and was stopped."}
    for line in reversed(p.stdout.splitlines()):
        if line.startswith(MARK):
            return json.loads(line[len(MARK):])
    return {"error": "The sandboxed process crashed (resource limit or fatal error). " + p.stderr[-200:]}


def run_validation(original, optimized, settings=None, use_hypothesis=True, timeout=90):
    res = run_in_sandbox({"mode": "differential", "original": original, "optimized": optimized,
                          "hypothesis": use_hypothesis, "cpu_s": timeout}, timeout)
    if "error" in res:
        return {"ok": False, "error": res["error"]}
    s = res["script"]
    problems = []
    if not s["stdout_equal"]:
        problems.append("Program output differs")
    if not s["exception_equal"]:
        problems.append(f"Exceptions differ ({s['original_exception']} vs {s['optimized_exception']})")
    if s["global_mismatches"]:
        problems.append("Global values differ: " + ", ".join(s["global_mismatches"][:5]))
    for f in res["functions"]:
        if f["mismatches"]:
            problems.append(f"Function {f['name']}() differs on {f['mismatches'][0]['args']}")
    res["ok"], res["problems"] = not problems, problems
    return res
