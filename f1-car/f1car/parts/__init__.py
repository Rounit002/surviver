"""Part registry. Each module exposes `build(ctx)`; order matters only for cross-part lookups.
Add/remove/reorder entries to change what the car is made of."""
import importlib

REGISTRY = [
    "chassis",
    "sidepods",
    "airbox",
    "cockpit",
    "mirrors",
    "floor",
    "front_wing",
    "rear_wing",
    "rear_end",
    "wheels",
    "suspension",
]


def build_all(ctx, only=None, skip=None):
    for name in REGISTRY:
        if only and name not in only:
            continue
        if skip and name in skip:
            continue
        mod = importlib.import_module("." + name, __name__)
        mod.build(ctx)
