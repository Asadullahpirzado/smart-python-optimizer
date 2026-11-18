"""Symbol table construction using the standard ``symtable`` module."""
import symtable


def _symbol(sym):
    flags = []
    for name, probe in (("param", sym.is_parameter), ("local", sym.is_local), ("global", sym.is_global),
                        ("free", sym.is_free), ("imported", sym.is_imported), ("assigned", sym.is_assigned),
                        ("referenced", sym.is_referenced), ("namespace", sym.is_namespace)):
        try:
            if probe():
                flags.append(name)
        except Exception:
            pass
    return {"name": sym.get_name(), "flags": flags}


def _walk(table):
    return {"name": table.get_name(), "type": str(table.get_type()).replace("SymbolTableType.", "").lower(),
            "lineno": table.get_lineno(),
            "symbols": [_symbol(s) for s in table.get_symbols()],
            "children": [_walk(c) for c in table.get_children()]}


def build_symbol_table(code, filename="<source>"):
    try:
        return _walk(symtable.symtable(code, filename, "exec"))
    except Exception as exc:  # never let analysis views break the pipeline
        return {"name": "top", "type": "module", "lineno": 0, "symbols": [], "children": [], "error": str(exc)}


def iter_tables(table):
    yield table
    for child in table["children"]:
        yield from iter_tables(child)
