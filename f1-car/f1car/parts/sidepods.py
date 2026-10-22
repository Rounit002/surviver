"""Undercut sidepods with dark cooling inlets and a downwash ramp toward the gearbox."""
import math

from mathutils import Matrix

from ..utils import geo

PART = "Sidepods"

# x, centre y, bottom z, top z, half-width, squareness, top taper
SIDEPOD = [
    (0.96, 0.405, 0.170, 0.480, 0.128, 2.7, 0.10),
    (0.86, 0.405, 0.150, 0.520, 0.145, 2.9, 0.16),
    (0.55, 0.412, 0.125, 0.585, 0.172, 3.0, 0.22),
    (0.15, 0.410, 0.118, 0.592, 0.186, 3.0, 0.26),
    (-0.30, 0.378, 0.118, 0.548, 0.180, 3.0, 0.30),
    (-0.80, 0.322, 0.124, 0.455, 0.160, 3.0, 0.30),
    (-1.28, 0.264, 0.135, 0.365, 0.135, 2.8, 0.25),
    (-1.72, 0.208, 0.152, 0.292, 0.104, 2.6, 0.20),
]


def keys():
    return [dict(x=x, y=y, zb=zb, zt=zt, hw=hw, n=n, taper=t) for x, y, zb, zt, hw, n, t in SIDEPOD]


def _vents():
    zt = geo.pchip(*zip(*[(r[0], r[3]) for r in sorted(SIDEPOD)]))
    y0 = geo.pchip(*zip(*[(r[0], r[1]) for r in sorted(SIDEPOD)]))
    boxes = []
    for k in range(10):
        x = -0.56 - 0.040 * k
        b = geo.box((0, 0, 0), (0.013, 0.095, 0.07))
        geo.transform(b, Matrix.Rotation(math.radians(-26), 4, "Y"))
        geo.transform(b, Matrix.Translation((x, y0(x) + 0.004, zt(x) - 0.006)))
        boxes.append(b)
    return geo.merge(*boxes)


def build(ctx):
    rings = geo.section_rings(keys(), ring_points=48, per_segment=5)
    bm = geo.loft(rings)
    geo.inset_pocket(bm, (1, 0, 0), inset=0.020, depth=0.10, material_index=1)
    left = ctx.add_bm(PART, "Sidepod_L", bm, ["body", "intake_dark"], angle=60)
    ctx.cut(left, [_vents()])
    right = ctx.mirror(left, "Sidepod_R")
    for ob in (left, right):
        ctx.add_bevel(ob, 0.004, 2, 40)
