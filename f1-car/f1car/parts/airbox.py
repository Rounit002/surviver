"""Roll-hoop airbox with intake, plus a dorsal fin blending into the engine cover."""
from ..utils import geo

PART = "Airbox"

AIRBOX = [
    (-0.14, 0.520, 0.930, 0.115, 2.6),
    (-0.36, 0.550, 0.955, 0.128, 2.8),
    (-0.70, 0.600, 0.900, 0.122, 2.8),
    (-1.05, 0.620, 0.770, 0.095, 2.6),
    (-1.45, 0.560, 0.680, 0.060, 2.4),
    (-1.90, 0.500, 0.585, 0.022, 2.2),
]


def build(ctx):
    keys = [dict(x=x, zb=zb, zt=zt, hw=hw, n=n) for x, zb, zt, hw, n in AIRBOX]
    bm = geo.loft(geo.section_rings(keys, ring_points=40, per_segment=5))
    geo.inset_pocket(bm, (1, 0, 0), inset=0.018, depth=0.16, material_index=1)
    ob = ctx.add_bm(PART, "Airbox", bm, ["body", "intake_dark"], angle=62)
    ctx.add_bevel(ob, 0.004, 2, 40)

    # roof camera pod with twin lenses
    pod = geo.box((-0.44, 0.0, 0.987), (0.10, 0.058, 0.046))
    ob = ctx.add_bm(PART, "AirboxCamPod", pod, ["black_gloss"], angle=60)
    ctx.add_bevel(ob, 0.010, 3, 40)
    for s in (1, -1):
        lens = geo.cylinder((-0.385, s * 0.016, 0.988), (-0.375, s * 0.016, 0.988), 0.013, segments=24)
        ctx.add_bm(PART, "AirboxCamLens_%s" % ("L" if s > 0 else "R"), lens, ["lens"], angle=50)
