"""Run untrusted Python in a separate, resource-limited process (best-effort isolation)."""
import json, os, subprocess, sys, tempfile

RUNNER = os.path.join(os.path.dirname(__file__), "_runner.py")


def _limits(cpu, mem_mb):
    def apply():
        try:
            import resource
            resource.setrlimit(resource.RLIMIT_CPU, (cpu, cpu + 1))
            resource.setrlimit(resource.RLIMIT_AS, (mem_mb * 1024 * 1024, mem_mb * 1024 * 1024))
            resource.setrlimit(resource.RLIMIT_FSIZE, (1024 * 1024, 1024 * 1024))
            resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        except Exception:
            pass
        os.setsid() if hasattr(os, "setsid") else None
    return apply


def run(job, wall=20, cpu=15, mem_mb=1024):
    with tempfile.TemporaryDirectory() as tmp:
        try:
            p = subprocess.run([sys.executable, "-I", RUNNER], input=json.dumps(job), capture_output=True, text=True, timeout=wall,
                               cwd=tmp, env={"PATH": os.environ.get("PATH", ""), "PYTHONHASHSEED": "0"}, preexec_fn=_limits(cpu, mem_mb) if os.name == "posix" else None)
        except subprocess.TimeoutExpired:
            return {"error": f"Sandbox timed out after {wall}s"}
        except Exception as e:
            return {"error": f"Sandbox failed to start: {e}"}
    out = p.stdout.split("@@RESULT@@")
    if len(out) < 2:
        return {"error": "Sandbox produced no result" + (f": {p.stderr.strip()[-200:]}" if p.stderr.strip() else "")}
    try:
        return json.loads(out[-1])
    except Exception:
        return {"error": "Sandbox result could not be parsed"}
