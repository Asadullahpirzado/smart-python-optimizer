"""Input generation for property-based testing (Hypothesis when installed, seeded random otherwise).
This module is imported inside the sandbox worker process."""
import inspect
import random
import typing

LIST_HINTS = {"arr", "lst", "nums", "data", "items", "values", "a", "b", "xs", "array", "numbers", "seq", "lst1", "lst2"}
STR_HINTS = {"s", "text", "word", "string", "name", "t"}
INT_HINTS = {"n", "k", "i", "j", "m", "x", "y", "num", "count", "size", "limit", "target", "lo", "hi", "idx"}


def kind_of(param):
    ann = param.annotation
    txt = ann if isinstance(ann, str) else getattr(ann, "__name__", str(ann))
    txt = str(txt).lower()
    if "int" in txt and "list" not in txt:
        return "int"
    if "float" in txt:
        return "float"
    if "bool" in txt:
        return "bool"
    if "str" in txt:
        return "str"
    if "list" in txt or "sequence" in txt or "tuple" in txt:
        return "list"
    if "dict" in txt:
        return "dict"
    n = param.name.lower()
    if n in LIST_HINTS:
        return "list"
    if n in STR_HINTS:
        return "str"
    if n in INT_HINTS:
        return "int"
    return "any"


def rand_value(kind, rng):
    if kind == "any":
        kind = rng.choice(["int", "int", "list", "str"])
    if kind == "int":
        return rng.choice([0, 1, 2, 3, 5, 7, 10, 12, -1, rng.randint(-20, 20)])
    if kind == "float":
        return rng.choice([0.0, 1.5, -2.25, rng.uniform(-10, 10)])
    if kind == "bool":
        return rng.random() < 0.5
    if kind == "str":
        return "".join(rng.choice("abcab ") for _ in range(rng.randint(0, 8)))
    if kind == "list":
        return [rng.randint(-5, 9) for _ in range(rng.randint(0, 8))]
    if kind == "dict":
        return {rng.randint(0, 5): rng.randint(0, 5) for _ in range(rng.randint(0, 4))}
    return None


def usable(fn):
    try:
        sig = inspect.signature(fn)
    except (TypeError, ValueError):
        return None
    params = list(sig.parameters.values())
    if len(params) > 4 or any(p.kind in (p.VAR_POSITIONAL, p.VAR_KEYWORD, p.KEYWORD_ONLY) for p in params):
        return None
    if any(p.default is not p.empty for p in params):
        return None
    return params


def random_cases(params, n, seed):
    rng = random.Random(seed)
    kinds = [kind_of(p) for p in params]
    cases = [tuple(rand_value(k, rng) for k in kinds) for _ in range(n)]
    cases.append(tuple(0 if k in ("int", "any") else rand_value(k, rng) for k in kinds))
    return cases


def hypothesis_strategy(params):
    from hypothesis import strategies as st
    table = {"int": st.integers(-20, 20), "float": st.floats(-100, 100, allow_nan=False, allow_infinity=False),
             "bool": st.booleans(), "str": st.text("abc ", max_size=8), "list": st.lists(st.integers(-5, 9), max_size=8),
             "dict": st.dictionaries(st.integers(0, 5), st.integers(0, 5), max_size=4)}
    parts = []
    for p in params:
        k = kind_of(p)
        parts.append(st.one_of(table["int"], table["list"], table["str"]) if k == "any" else table[k])
    return st.tuples(*parts)


def have_hypothesis():
    try:
        import hypothesis  # noqa
        return True
    except Exception:
        return False
