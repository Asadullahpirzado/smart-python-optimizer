"""Runs the test-suite with pytest when installed, otherwise with a minimal built-in runner."""
import importlib
import os
import sys
import traceback

root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, root)
sys.path.insert(0, os.path.join(root, "tests"))
os.chdir(root)
try:
    import pytest
    sys.exit(pytest.main(["-q", "tests"]))
except ImportError:
    pass


class _Raises:
    def __init__(self, exc):
        self.exc = exc

    def __enter__(self):
        return self

    def __exit__(self, t, v, tb):
        self.value = v
        return t is not None and issubclass(t, self.exc)


import inspect
import types

fake = types.ModuleType("pytest")
fake.raises = lambda exc: _Raises(exc)

fixtures = {}

def fixture(*args, **kwargs):
    def dec(fn):
        fixtures[fn.__name__] = fn
        return fn
    if args and callable(args[0]):
        fn = args[0]
        fixtures[fn.__name__] = fn
        return fn
    return dec

class _Mark:
    def parametrize(self, argnames, argvalues):
        def dec(fn):
            fn._pytest_parametrize = (argnames, argvalues)
            return fn
        return dec

class _MonkeyPatch:
    def __init__(self):
        self._undo = []

    def setattr(self, target, name, value):
        old = getattr(target, name)
        self._undo.append((target, name, old))
        setattr(target, name, value)

    def undo(self):
        for target, name, old in reversed(self._undo):
            setattr(target, name, old)
        self._undo.clear()

class _CapLog:
    def __init__(self):
        self.text = ""
    def at_level(self, level):
        import logging
        class _Ctx:
            def __enter__(_s):
                import io
                self._stream = io.StringIO()
                self._handler = logging.StreamHandler(self._stream)
                logging.getLogger().addHandler(self._handler)
                return _s
            def __exit__(_s, *exc):
                logging.getLogger().removeHandler(self._handler)
                self.text = self._stream.getvalue()
        return _Ctx()

fake.fixture = fixture
fake.mark = _Mark()
sys.modules["pytest"] = fake

fixtures["monkeypatch"] = lambda: _MonkeyPatch()
fixtures["caplog"] = lambda: _CapLog()

failed = passed = 0
for fn in sorted(f for f in os.listdir(os.path.join(root, "tests")) if f.startswith("test_")):
    mod = importlib.import_module(fn[:-3])
    # check for module-level fixtures
    for k in dir(mod):
        v = getattr(mod, k)
        if callable(v) and hasattr(v, "__name__") and v.__name__ in fixtures:
            fixtures[v.__name__] = v
            
    for name in dir(mod):
        if name.startswith("test_"):
            fn_obj = getattr(mod, name)
            if not callable(fn_obj):
                continue
            
            sig = inspect.signature(fn_obj)
            param_names = list(sig.parameters.keys())
            
            # Helper to invoke with fixture resolution
            def call_test(**kwargs):
                args = {}
                for p in param_names:
                    if p in kwargs:
                        args[p] = kwargs[p]
                    elif p in fixtures:
                        args[p] = fixtures[p]()
                try:
                    return fn_obj(**args)
                finally:
                    for obj in args.values():
                        if hasattr(obj, "undo") and callable(obj.undo):
                            obj.undo()
            
            if hasattr(fn_obj, "_pytest_parametrize"):
                p_argnames, p_argvalues = fn_obj._pytest_parametrize
                if isinstance(p_argnames, str):
                    p_argnames = [a.strip() for a in p_argnames.split(",")]
                for val in p_argvalues:
                    if not isinstance(val, (list, tuple)) or len(p_argnames) == 1:
                        val = [val]
                    kw = dict(zip(p_argnames, val))
                    try:
                        call_test(**kw)
                        passed += 1
                        print("PASS", fn, f"{name}[{kw}]")
                    except Exception:
                        failed += 1
                        print("FAIL", fn, f"{name}[{kw}]")
                        traceback.print_exc()
            else:
                try:
                    call_test()
                    passed += 1
                    print("PASS", fn, name)
                except Exception:
                    failed += 1
                    print("FAIL", fn, name)
                    traceback.print_exc()

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
