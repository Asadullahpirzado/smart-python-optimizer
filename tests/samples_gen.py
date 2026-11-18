def big_program(n_lines=600):
    block = '''def f{i}(a: int, b: int, data):
    base = {i} + 3 * 2
    alias = base
    t = a * b + base
    u = a * b + alias
    s = 0
    for j in range(a):
        s += t * u + j * 4
    seen = [1, 2, 3]
    for d in data:
        if d in seen:
            s += 1
    dead = base * 7
    return s


'''
    parts, i = ["import math\n\n\n"], 0
    while sum(p.count("\n") for p in parts) < n_lines:
        parts.append(block.format(i=i))
        i += 1
    return "".join(parts)
