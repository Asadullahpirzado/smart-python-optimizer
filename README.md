# Smart Python Optimizer

**A compiler-construction project for inspecting Python programs and applying conservative, reviewable source transformations.**

Smart Python Optimizer brings compiler concepts into an interactive web app. Paste or open Python source, inspect the transformations the optimizer can justify, and download the generated code. Separate analysis views expose how the program is tokenized, parsed, represented as control flow, and examined by data-flow and complexity analyses.

> This is an educational compiler and static-analysis workbench, not a general-purpose optimizing compiler. Static checks and selected-input validation cannot prove equivalence for every possible Python program. Always review generated code and test it in your own environment.

## Highlights

- **Conservative optimization pipeline:** constant propagation and folding, copy propagation, common-subexpression elimination, dead-code elimination, loop-invariant code motion, strength reduction, small-loop unrolling, limited function inlining, and optional unused-import removal.
- **Visible, reviewable changes:** inspect pass-by-pass transformation records, warnings, generated output, and downloadable Python source.
- **Compiler analysis:** lexical and semantic information, syntax trees, symbol tables, intermediate representation, control-flow graphs, data-flow summaries, and static single assignment (SSA) views.
- **Algorithm and complexity insights:** pattern-based recommendations, estimated time and space complexity, call graphs, and optional measurements from benchmark runs.
- **Multi-file workflow:** upload Python modules or a project folder, optimize modules independently, and download outputs in a ZIP that keeps their relative paths.
- **Interactive learning tools:** 3D compiler visualizations, a source-aware voice tutor, and an exportable academic report.
- **Local-first app:** the Flask server runs on your machine; no remote AI service is required for analysis or optimization.

## Quick start

Requirements: Python 3.9 or newer.

```bash
git clone https://github.com/Asadullahpirzado/smart-python-optimizer.git
cd smart-python-optimizer
python -m venv .venv
```

Activate the environment, then install and run:

**Windows (Command Prompt):**

```cmd
.venv\Scripts\activate
python -m pip install -r requirements.txt
python app.py
```

**macOS / Linux:**

```bash
source .venv/bin/activate
python -m pip install -r requirements.txt
python app.py
```

Open [http://127.0.0.1:5000](http://127.0.0.1:5000). On Windows, you can alternatively start the app with `run.bat`.

The editor falls back to a plain text area if the Monaco editor CDN is unavailable. Some 2D charts and graph views use bundled libraries when present; run `python download_libs.py` if those views report that a library is missing. Voice availability depends on browser and operating-system speech support.

## Use the optimizer

1. Paste code, open a `.py` file, or choose an example from **Optimize Code**.
2. Select **Optimize code** to run the enabled transformations.
3. Review the summary, validation checks, warnings, and individual changes.
4. Download the generated source and run your normal tests before using it.

Choose **Analyze** to inspect compiler and program-analysis views without optimizing. Multi-file operations are available under **Project tools**. Project mode accepts up to 100 Python files and 8 MB of source per run (with a 3 MB per-file limit).

## Optimization and safety model

The optimizer parses Python into an abstract syntax tree, applies configured passes through a pass manager, generates source, and checks structural properties such as syntax, declarations, signatures, and selected observable calls. A pass that raises an error or produces uncompilable output is rolled back. If final static validation fails, the original source is returned.

Transformations are intentionally conservative in several areas:

- Dynamic name use such as `eval`, `exec`, `locals`, `globals`, and wildcard imports disables name-based passes where static reasoning is unreliable.
- Arithmetic transformations require numeric evidence for relevant values. Treating untyped values as numeric is an opt-in setting because Python operators can be overloaded.
- Algorithmic recommendations are suggestions. Memoization is only applied after explicit approval and a purity check.
- Project files are optimized independently. The tool does not infer types or rewrite APIs across module boundaries.
- Generated source comes from Python's AST unparser, so comments and original formatting may not be preserved.
- Complexity figures are static estimates. Performance claims should come from benchmarks on representative workloads and environments.
- Benchmarks and differential validation execute submitted code in a restricted subprocess, but this is **not a security sandbox**. Do not run untrusted code on a machine with sensitive data; use an isolated container or VM.

Static validation is a safety net, not a formal proof of semantic equivalence. Python behavior can depend on imports, environment, input values, reflection, I/O, concurrency, and other runtime details that static checks may not model. Review the diff and run your project tests.

## Architecture

```text
Browser UI (frontend/) ── HTTP/JSON ── Flask API (app.py)
                                           │
                                           ▼
                                Pipeline orchestration (pipeline.py)
                     ┌─────────────────────┼──────────────────────┐
                     ▼                     ▼                      ▼
              Compiler analysis      Optimization passes    Validation / reports
              compiler/              optimization/          validation/ reports/
                                           │
                                           ▼
                                    Code generation
                                      generator/
```

| Component | Purpose |
| --- | --- |
| `frontend/` | Browser interface, editor, analysis pages, visualizations, and tutor |
| `app.py` | Flask routes for analysis, optimization, benchmarking, project uploads, and reports |
| `pipeline.py` | Orchestrates parsing, analysis, optimization, validation, and result construction |
| `compiler/` | Lexer, parser integration, semantic analysis, IR, CFG, and SSA |
| `optimization/` | AST transformations, data-flow utilities, and pass manager |
| `algorithm_optimizer/`, `analyzer/` | Pattern recommendations, call graph, and complexity analysis |
| `validation/` | Static checks, regression, property-based, and differential validation |
| `generator/`, `reports/` | Generated code, diffs, history, and downloadable reports |
| `tests/`, `samples/` | Test suite and example programs |

## Tests

Run the project test runner:

```bash
python run_tests.py
```

Optional development dependencies for direct pytest and Hypothesis use:

```bash
python -m pip install pytest hypothesis
python -m pytest
```

## Current scope

This project focuses on educational compiler construction and source-level transformations. It does not provide whole-program or cross-module optimization, complete Python type inference, a formal equivalence proof, or guaranteed speedups. Unrolling is limited to small constant ranges; inlining is limited to narrow supported cases. Benchmark results vary by workload and machine.

## Author

**Asadullah** — compiler construction and Python program analysis project.

## License

No license is currently specified. Unless a license is added, standard copyright applies and others do not automatically receive permission to reuse or redistribute the code.
