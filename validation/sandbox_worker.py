"""Runs untrusted user code in a separate, resource-limited process.
Modes: benchmark, differential. Result is printed as '@@RESULT@@<json>'."""
import contextlib
import copy
import io
import json
import os
import signal
import statistics
import sys
import time
import timeit
import tracemalloc
import types

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Sink(io.StringIO):
    cap = 100_000

    def write(self, s):
        if self.tell() < self.cap:
            return super().write(s)
        return len(s)


class Null:
    def write(self, s):
        return len(s)

    def flush(self):
        pass


class CallTimeout(BaseException):
    pass


def set_limits(job):
    try:
        import resource
        mem = int(job.get("mem_mb", 768)) * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (mem, mem))
        cpu = int(job.get("cpu_s", 60))
        resource.setrlimit(resource.RLIMIT_CPU, (cpu, cpu))
        resource.setrlimit(resource.RLIMIT_FSIZE, (1 << 20, 1 << 20))
    except Exception:
        pass


def alarm(seconds):
    if hasattr(signal, "setitimer"):
        def handler(*_):
            raise CallTimeout()
        signal.signal(signal.SIGALRM, handler)
        signal.setitimer(signal.ITIMER_REAL, seconds)


def disarm():
    if hasattr(signal, "setitimer"):
        signal.setitimer(signal.ITIMER_REAL, 0)


# ---------------------------------------------------------------- benchmark
def measure(run, repeats):
    old = sys.stdout
    sys.stdout = Null()
    try:
        t0 = time.perf_counter()
        result = run()
        dt = max(time.perf_counter() - t0, 1e-7)
        number = max(1, min(2000, int(0.02 / dt)))
        times = [t / number for t in timeit.repeat(run, repeat=repeats, number=number)]
        tracemalloc.start()
        run()
        peak = tracemalloc.get_traced_memory()[1]
        tracemalloc.stop()
    finally:
        sys.stdout = old
    return {"mean_s": statistics.mean(times), "min_s": min(times), "stdev_s": statistics.pstdev(times),
            "number": number, "peak_kb": peak / 1024.0, "result": repr(result)[:80]}


def benchmark(job):
    compiled = compile(job["code"], "<bench>", "exec")
    repeats, entry, rows = int(job.get("repeats", 5)), job.get("entry"), []
    if entry:
        ns = {"__name__": "__main__"}
        old = sys.stdout
        sys.stdout = Null()
        try:
            exec(compiled, ns)
        finally:
            sys.stdout = old
        for size in job.get("sizes") or [10]:
            expr = compile(entry.replace("{n}", str(size)), "<entry>", "eval")
            row = measure(lambda: eval(expr, ns), repeats)
            row["size"] = size
            rows.append(row)
    else:
        row = measure(lambda: exec(compiled, {"__name__": "__main__"}), repeats)
        row["size"] = "script"
        rows.append(row)
    return {"rows": rows}


# -------------------------------------------------------------- differential
SIMPLE = (int, float, str, bool, type(None))


def simple(v, depth=0):
    if isinstance(v, SIMPLE):
        return True
    if depth < 3 and isinstance(v, (list, tuple, set, frozenset)):
        return len(v) < 500 and all(simple(x, depth + 1) for x in v)
    if depth < 3 and isinstance(v, dict):
        return len(v) < 500 and all(simple(k, depth + 1) and simple(x, depth + 1) for k, x in v.items())
    return False


def canon(v):
    if isinstance(v, (set, frozenset)):
        return "set:" + repr(sorted(map(repr, v)))
    return repr(v)


def run_script(code):
    ns, sink, old = {"__name__": "__main__"}, Sink(), sys.stdout
    sys.stdout = sink
    exc = None
    try:
        alarm(float(JOB.get("script_timeout", 10)))
        exec(compile(code, "<script>", "exec"), ns)
    except CallTimeout:
        exc = "Timeout"
    except BaseException as e:
        exc = type(e).__name__
    finally:
        disarm()
        sys.stdout = old
    snap = {k: canon(v) for k, v in ns.items() if not k.startswith("_") and simple(v)}
    return {"ns": ns, "stdout": sink.getvalue(), "exc": exc, "snap": snap}


def call(fn, args, tlimit=1.0):
    sink, old = Sink(), sys.stdout
    sys.stdout = sink
    a = copy.deepcopy(args)
    try:
        alarm(tlimit)
        r = fn(*a)
        out = ("ok", canon(r) if simple(r) else type(r).__name__, canon(a) if simple(a) else "")
    except CallTimeout:
        out = ("timeout", "", "")
    except RecursionError:
        out = ("exc", "RecursionError", "")
    except BaseException as e:
        out = ("exc", type(e).__name__, "")
    finally:
        disarm()
        sys.stdout = old
    return out + (sink.getvalue(),)


def compare_case(fo, fp, args):
    a, b = call(fo, args), call(fp, args)
    if a[0] == "timeout":
        return None
    return None if a == b else {"args": repr(args)[:120], "original": list(a)[:3], "optimized": list(b)[:3]}


def differential(job):
    from validation import property_testing as pt
    o, p = run_script(job["original"]), run_script(job["optimized"])
    res = {"script": {"stdout_equal": o["stdout"] == p["stdout"], "exception_equal": o["exc"] == p["exc"],
                      "original_exception": o["exc"], "optimized_exception": p["exc"],
                      "global_mismatches": [k for k in o["snap"] if k in p["snap"] and o["snap"][k] != p["snap"][k]],
                      "compared_globals": len([k for k in o["snap"] if k in p["snap"]])}}
    if not res["script"]["stdout_equal"]:
        res["script"]["stdout_original"] = o["stdout"][:300]
        res["script"]["stdout_optimized"] = p["stdout"][:300]
    use_h = job.get("hypothesis", True) and pt.have_hypothesis()
    funcs = []
    for name, fo in o["ns"].items():
        fp = p["ns"].get(name)
        if name.startswith("_") or not isinstance(fo, types.FunctionType) or not isinstance(fp, types.FunctionType):
            continue
        params = pt.usable(fo)
        if params is None:
            continue
        entry = {"name": name, "differential_cases": 0, "property_cases": 0, "mismatches": [], "engine": "hypothesis" if use_h else "random"}
        for args in pt.random_cases(params, 25, seed=1234):
            entry["differential_cases"] += 1
            m = compare_case(fo, fp, args)
            if m and len(entry["mismatches"]) < 3:
                entry["mismatches"].append(m)
        if use_h and not entry["mismatches"]:
            try:
                from hypothesis import given, settings, HealthCheck
                found = []

                @settings(max_examples=int(job.get("examples", 40)), deadline=None, database=None, derandomize=True,
                          suppress_health_check=list(HealthCheck))
                @given(pt.hypothesis_strategy(params))
                def prop(args):
                    entry["property_cases"] += 1
                    m = compare_case(fo, fp, args)
                    if m:
                        found.append(m)
                        raise AssertionError("mismatch")
                try:
                    prop()
                except AssertionError:
                    entry["mismatches"] += found[-1:]
            except Exception as exc:
                entry["engine"] = f"hypothesis-error: {type(exc).__name__}"
        elif not use_h:
            for args in pt.random_cases(params, 40, seed=99):
                entry["property_cases"] += 1
                m = compare_case(fo, fp, args)
                if m and len(entry["mismatches"]) < 3:
                    entry["mismatches"].append(m)
        funcs.append(entry)
    res["functions"] = funcs
    res["engine"] = "hypothesis" if use_h else "random"
    return res


JOB = {}


def main():
    global JOB
    JOB = json.loads(sys.stdin.read())
    sys.stdin = open(os.devnull)
    set_limits(JOB)
    sys.path.insert(0, ROOT)
    try:
        res = benchmark(JOB) if JOB["mode"] == "benchmark" else differential(JOB)
    except BaseException as e:
        res = {"error": f"{type(e).__name__}: {e}"[:300]}
    sys.__stdout__.write("\n@@RESULT@@" + json.dumps(res) + "\n")
    sys.__stdout__.flush()


if __name__ == "__main__":
    main()
