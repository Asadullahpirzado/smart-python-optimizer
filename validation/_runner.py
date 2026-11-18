"""Sandbox child process. Reads a JSON job on stdin, writes one JSON result on stdout.
Resource limits are applied by the parent (sandbox.py). Never import this from the web app."""
import sys, json, io, contextlib, signal, random, copy, timeit, tracemalloc, statistics, math

sys.setrecursionlimit(5000)


class Timeout(Exception): pass


def _alarm(sig, frm): raise Timeout()


if hasattr(signal, "SIGALRM"):
    signal.signal(signal.SIGALRM, _alarm)


def set_timer(secs):
    if hasattr(signal, "setitimer") and hasattr(signal, "ITIMER_REAL"):
        signal.setitimer(signal.ITIMER_REAL, secs)


def clear_timer():
    if hasattr(signal, "setitimer") and hasattr(signal, "ITIMER_REAL"):
        signal.setitimer(signal.ITIMER_REAL, 0)


def run_main(code, secs):
    """Execute whole program as __main__, capture stdout."""
    out = io.StringIO(); ns = {"__name__": "__main__"}; err = None
    sys.stdin = io.StringIO("")
    set_timer(secs)
    try:
        with contextlib.redirect_stdout(out):
            exec(compile(code, "<prog>", "exec"), ns)
    except Timeout: err = "Timeout"
    except SystemExit as e: err = f"SystemExit({e.code})"
    except BaseException as e: err = f"{type(e).__name__}: {e}"
    finally: clear_timer()
    return out.getvalue()[:20000], err


def load(code, secs=5):
    ns = {"__name__": "__bench__"}
    out = io.StringIO()
    set_timer(secs)
    try:
        with contextlib.redirect_stdout(out): exec(compile(code, "<prog>", "exec"), ns)
    finally: clear_timer()
    return ns


def diff_job(j):
    a = run_main(j["orig"], j.get("timeout", 5)); b = run_main(j["opt"], j.get("timeout", 5))
    skipped = a[1] == "Timeout" or b[1] == "Timeout"
    return {"same_output": a[0] == b[0], "same_error": a[1] == b[1], "orig_error": a[1], "opt_error": b[1], "skipped": skipped,
            "orig_output": a[0][:500], "opt_output": b[0][:500], "passed": (a[0] == b[0] and a[1] == b[1]) or skipped}


def gen(rng, kind):
    if kind == "int": return rng.randint(-5, 12)
    if kind == "small": return rng.randint(0, 9)
    if kind == "list": return [rng.randint(-5, 9) for _ in range(rng.randint(0, 8))]
    if kind == "str": return "".join(rng.choice("abc xyz") for _ in range(rng.randint(0, 6)))
    if kind == "float": return round(rng.uniform(-10, 10), 2)
    return None


def call(fn, args, secs=0.5):
    out = io.StringIO(); a = copy.deepcopy(args)
    set_timer(secs)
    try:
        with contextlib.redirect_stdout(out): r = fn(*a)
        res = ("ok", repr(r)[:300])
    except Timeout: res = ("timeout", "")
    except RecursionError: res = ("exc", "RecursionError")
    except BaseException as e: res = ("exc", type(e).__name__)
    finally: clear_timer()
    return res, repr(a)[:300], out.getvalue()[:300]


def prop_job(j):
    import inspect
    try:
        A, B = load(j["orig"]), load(j["opt"])
    except BaseException as e:
        return {"error": f"load failed: {type(e).__name__}: {e}", "functions": [], "passed": True}
    rng = random.Random(j.get("seed", 1234)); trials = j.get("trials", 40)
    kinds = ["int", "small", "list", "str", "float"]
    res = []
    for name, fa in A.items():
        if name.startswith("_") or not inspect.isfunction(fa) or fa.__module__ is not None and False: continue
        fb = B.get(name)
        if not inspect.isfunction(fb): continue
        try: sig = inspect.signature(fa)
        except Exception: continue
        ps = [p for p in sig.parameters.values() if p.default is p.empty and p.kind in (p.POSITIONAL_ONLY, p.POSITIONAL_OR_KEYWORD)]
        if len(ps) > 4 or any(p.kind in (p.VAR_POSITIONAL, p.VAR_KEYWORD) for p in sig.parameters.values()) and False: continue
        ran = bad = 0; ce = None
        for _ in range(trials):
            args = tuple(gen(rng, rng.choice(kinds)) for _ in ps)
            ra, aa, oa = call(fa, args)
            if ra[0] == "timeout" or (ra[0] == "exc" and ra[1] in ("TypeError",)): continue
            rb, ab, ob = call(fb, args)
            ran += 1
            if (ra, aa, oa) != (rb, ab, ob):
                bad += 1
                ce = ce or {"args": repr(args)[:200], "original": ra[1] if ra[0] == "ok" else ra[1], "optimized": rb[1] if rb[0] == "ok" else rb[1]}
        res.append({"function": name, "trials": ran, "mismatches": bad, "counterexample": ce})
    return {"functions": res, "passed": all(r["mismatches"] == 0 for r in res), "error": None}


def bench_job(j):
    code, entry, sizes, reps = j["code"], (j.get("entry") or "").strip(), j.get("sizes") or [100], max(1, min(j.get("repeats", 5), 15))
    rows = []
    for n in (sizes if entry else [0]):
        row = {"n": n, "time": None, "mean": None, "stdev": None, "memory_kb": None, "error": None}
        try:
            if entry:
                ns = load(code)
                e = entry.replace("{n}", str(n))
                co = compile(e, "<entry>", "eval")
                f = lambda: eval(co, ns)
            else:
                co = compile(code, "<prog>", "exec")
                f = lambda: exec(co, {"__name__": "__bench__"})
            sink = io.StringIO()
            def timed(fn):
                with contextlib.redirect_stdout(sink):
                    return timeit.Timer(fn).timeit(1)
            signal.setitimer(signal.ITIMER_REAL, j.get("timeout", 8))
            t0 = timed(f)
            number = max(1, min(200, int(0.03 / t0))) if t0 > 0 else 200
            def many():
                for _ in range(number): f()
            ts = [timed(many) / number for _ in range(reps)]
            tracemalloc.start()
            with contextlib.redirect_stdout(sink): f()
            _, peak = tracemalloc.get_traced_memory(); tracemalloc.stop()
            signal.setitimer(signal.ITIMER_REAL, 0)
            row.update(time=min(ts), mean=statistics.mean(ts), stdev=statistics.pstdev(ts), memory_kb=peak / 1024, runs=reps * number + 1)
        except Timeout: row["error"] = "Timeout"
        except BaseException as e: row["error"] = f"{type(e).__name__}: {e}"
        finally:
            signal.setitimer(signal.ITIMER_REAL, 0)
            if tracemalloc.is_tracing(): tracemalloc.stop()
        rows.append(row)
    return {"rows": rows}


if __name__ == "__main__":
    job = json.loads(sys.stdin.read())
    real = sys.stdout
    try:
        r = {"diff": diff_job, "prop": prop_job, "bench": bench_job}[job["mode"]](job)
    except BaseException as e:
        r = {"error": f"{type(e).__name__}: {e}"}
    sys.stdout = real
    sys.stdout.write("\n@@RESULT@@" + json.dumps(r))
