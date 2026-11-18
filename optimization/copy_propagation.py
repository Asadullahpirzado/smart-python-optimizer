"""Copy propagation: replace ``b = a`` copies by the original variable."""
from .constant_propagation import Propagator


def run(tree, ctx):
    return Propagator(ctx, "copy").run(tree)
