"""Smart Python Optimizer – Flask application."""
import io
import os
import pathlib
import time
import threading
import zipfile

from flask import Flask, jsonify, request, render_template, send_file, Response
from werkzeug.exceptions import HTTPException

import pipeline
from analyzer.benchmark import run_benchmark
from compiler.parser import SourceError
from reports import store
from reports.report_generator import to_html, to_markdown
from reports import final_report
from validation.differential_testing import run_validation
from validation.regression_testing import run_regression
from optimization.common import normalize_settings

BASE = os.path.dirname(os.path.abspath(__file__))
MAX_CODE = 3_000_000
_tts_process = None
_tts_lock = threading.Lock()

app = Flask(__name__, template_folder=os.path.join(BASE, "frontend", "templates"),
            static_folder=os.path.join(BASE, "frontend", "static"))
app.config["MAX_CONTENT_LENGTH"] = 12 * 1024 * 1024
app.config["JSON_SORT_KEYS"] = False


def body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ValueError("Request body must be a JSON object.")
    return data


def code_of(data, key="code"):
    code = data.get(key)
    if not isinstance(code, str) or not code.strip():
        raise SourceError("Please provide some Python source code.")
    if len(code) > MAX_CODE:
        raise SourceError("The file is too large (limit 3 MB).")
    return code.replace("\r\n", "\n")


@app.errorhandler(SourceError)
def on_source_error(e):
    return jsonify({"error": e.message, "lineno": e.lineno, "kind": "source"}), 400


@app.errorhandler(413)
def on_large(_):
    return jsonify({"error": "Upload too large."}), 413


@app.errorhandler(HTTPException)
def on_http_error(e):
    return jsonify({"error": e.description, "kind": "http"}), e.code


@app.errorhandler(Exception)
def on_error(e):
    if isinstance(e, ValueError):
        return jsonify({"error": str(e)[:400], "kind": "request"}), 400
    app.logger.exception("Unhandled request error")
    return jsonify({"error": "An unexpected server error occurred.", "kind": "server"}), 500


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/samples")
def samples():
    d = os.path.join(BASE, "samples")
    return jsonify([f for f in sorted(os.listdir(d)) if f.endswith(".py") and not f.startswith("make_")])


@app.get("/api/sample/<name>")
def sample(name):
    path = os.path.join(BASE, "samples", os.path.basename(name))
    if not os.path.isfile(path) or not name.endswith(".py"):
        return jsonify({"error": "Unknown sample"}), 404
    with open(path, encoding="utf-8") as f:
        return jsonify({"name": name, "code": f.read()})


@app.post("/api/analyze")
def api_analyze():
    d = body()
    return jsonify(pipeline.analyze(code_of(d), d.get("settings")))


@app.post("/api/optimize")
def api_optimize():
    d = body()
    t0 = time.perf_counter()
    rep = pipeline.optimize(code_of(d), d.get("settings"), str(d.get("filename") or "untitled.py")[:120])
    rep["elapsed_ms"] = round((time.perf_counter() - t0) * 1000)
    rep["report_id"] = store.add(dict(rep))
    return jsonify(rep)


@app.post("/api/project/optimize")
def api_project_optimize():
    """Optimize a bounded set of uploaded project modules independently."""
    d = body()
    files = d.get("files")
    if not isinstance(files, list) or not files:
        raise ValueError("Choose a Python project folder with at least one .py file.")
    if len(files) > 100:
        raise ValueError("Project uploads are limited to 100 Python files per run.")
    total_chars = sum(len(f.get("code", "")) for f in files if isinstance(f, dict) and isinstance(f.get("code"), str))
    if total_chars > 8_000_000:
        raise ValueError("Project source exceeds the 8 MB total processing limit. Split the project into smaller parts.")
    results = []
    for item in files:
        if not isinstance(item, dict):
            results.append({"filename": "unknown.py", "error": "Invalid project file entry."})
            continue
        name = str(item.get("filename") or "untitled.py").replace("\\", "/")[:300]
        try:
            code = code_of({"code": item.get("code")})
            started = time.perf_counter()
            rep = pipeline.optimize(code, d.get("settings"), name)
            rep["elapsed_ms"] = round((time.perf_counter() - started) * 1000)
            rep["report_id"] = store.add(dict(rep))
            results.append(rep)
        except SourceError as exc:
            results.append({"filename": name, "error": exc.message, "lineno": exc.lineno})
        except Exception as exc:
            app.logger.exception("Project optimization failed for %s", name)
            results.append({"filename": name, "error": f"{type(exc).__name__}: {str(exc)[:240]}"})
    return jsonify({"files": results, "count": len(results), "succeeded": sum("error" not in x for x in results),
                    "failed": sum("error" in x for x in results), "mode": "independent-python-modules"})


@app.post("/api/validate")
def api_validate():
    d = body()
    s = normalize_settings(d.get("settings"))
    res = run_validation(code_of(d, "original"), code_of(d, "optimized"), s, use_hypothesis=bool(d.get("hypothesis", True)),
                         timeout=s["bench_timeout"] * 2)
    return jsonify(res)


@app.post("/api/benchmark")
def api_benchmark():
    d = body()
    s = normalize_settings(d.get("settings"))
    sizes = [int(x) for x in (d.get("sizes") or []) if str(x).lstrip("-").isdigit()][:8]
    res = run_benchmark(code_of(d, "original"), code_of(d, "optimized"), (d.get("entry") or "").strip() or None, sizes,
                        int(d.get("repeats") or s["bench_repeats"]), s["bench_timeout"])
    if "error" not in res and d.get("report_id"):
        store.update_benchmark(str(d["report_id"]), res)
    return jsonify(res)


@app.get("/api/regression")
def api_regression():
    return jsonify(run_regression())


@app.get("/api/history")
def api_history():
    return jsonify(store.history())


@app.delete("/api/history")
def api_clear():
    store.clear()
    return jsonify({"ok": True})


@app.delete("/api/history/<rid>")
def api_delete(rid):
    store.delete(rid)
    return jsonify({"ok": True})


@app.get("/api/stats")
def api_stats():
    return jsonify(store.stats())


@app.get("/api/report/<rid>")
def api_report(rid):
    rep = store.get_report(rid)
    if rep is None:
        return jsonify({"error": "Report not found"}), 404
    fmt = request.args.get("format", "html")
    name = os.path.splitext(rep["filename"])[0]
    if fmt == "md":
        return Response(to_markdown(rep), mimetype="text/markdown",
                        headers={"Content-Disposition": f"attachment; filename={name}_report.md"})
    if fmt == "json":
        return jsonify(rep)
    html_text = to_html(rep)
    if request.args.get("download"):
        return Response(html_text, mimetype="text/html", headers={"Content-Disposition": f"attachment; filename={name}_report.html"})
    return Response(html_text, mimetype="text/html")


@app.post("/api/final_report")
def api_final_report():
    d = body()
    rep = store.get_report(str(d.get("report_id") or ""))
    if rep is None:
        return jsonify({"error": "Report not found - optimize the file again first."}), 404
    html_text = final_report.build(rep, d)
    return Response(html_text, mimetype="text/html")


@app.post("/api/download_zip")
def api_zip():
    d = body()
    files = d.get("files") or []
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for f in files[:200]:
            raw_name = str(f.get("name", "file.py")).replace("\\", "/")
            parts = pathlib.PurePosixPath(raw_name).parts
            safe_parts = [p for p in parts if p not in ("", ".", "/")]
            if not safe_parts or any(p == ".." for p in parts):
                safe_parts = ["file.py"]
            z.writestr("/".join(safe_parts), str(f.get("code", "")))
    buf.seek(0)
    return send_file(buf, mimetype="application/zip", as_attachment=True, download_name="optimized_files.zip")


@app.route("/api/tts")
def api_tts():
    import hashlib
    import subprocess
    text = (request.args.get("text") or "").strip()[:4000]
    if not text:
        return jsonify({"error": "No text"}), 400
    audio_dir = os.path.join(BASE, "frontend", "static", "audio")
    os.makedirs(audio_dir, exist_ok=True)
    h = hashlib.md5(text.encode("utf-8")).hexdigest()
    out_wav = os.path.join(audio_dir, f"tts_{h}.wav")
    direct = request.args.get("direct", "0") == "1"
    
    ps_script = os.path.join(BASE, "scripts", "tts.ps1")
    if direct:
        try:
            global _tts_process
            with _tts_lock:
                if _tts_process is not None and _tts_process.poll() is None:
                    _tts_process.terminate()
                    try: _tts_process.wait(timeout=1)
                    except subprocess.TimeoutExpired: _tts_process.kill()
                _tts_process = subprocess.Popen(
                    ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps_script, "-text", text],
                    stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
                time.sleep(0.12)
                if _tts_process.poll() is not None:
                    _tts_process = None
                    return jsonify({"error": "Windows speech exited before playback started. Check installed Windows voices."}), 503
            return jsonify({"ok": True, "engine": "windows-sapi"})
        except Exception as exc:
            app.logger.warning("Windows speech could not start: %s", exc)
            return jsonify({"error": "Windows speech could not start."}), 503
            
    if not os.path.exists(out_wav):
        try:
            subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps_script, "-text", text, "-outWav", out_wav],
                           capture_output=True, timeout=8)
        except Exception:
            pass

    if os.path.exists(out_wav):
        return send_file(out_wav, mimetype="audio/wav")
    return jsonify({"error": "TTS failed"}), 500


@app.post("/api/tts/stop")
def api_tts_stop():
    global _tts_process
    import subprocess
    with _tts_lock:
        if _tts_process is not None and _tts_process.poll() is None:
            _tts_process.terminate()
            try: _tts_process.wait(timeout=1)
            except subprocess.TimeoutExpired: _tts_process.kill()
        _tts_process = None
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", 5000)), debug=False, threaded=True)
