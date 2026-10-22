"""Monocoque + nose + engine cover as one continuous lofted fuselage, with the cockpit
opening cut by boolean and the rim softened by a bevel."""
import math

from mathutils import Matrix, Vector

from ..config import CAR
from ..utils import geo

PART = "Chassis"

# x, bottom z, top z, half-width, squareness
FUSELAGE = [
    (2.62, 0.226, 0.284, 0.030, 2.2),
    (2.48, 0.214, 0.306, 0.052, 2.4),
    (2.20, 0.186, 0.338, 0.092, 2.6),
    (1.85, 0.168, 0.408, 0.148, 2.8),
    (1.45, 0.140, 0.488, 0.202, 3.0),
    (1.05, 0.110, 0.548, 0.246, 3.0),
    (0.65, 0.100, 0.574, 0.272, 3.0),
    (0.15, 0.095, 0.580, 0.290, 3.0),
    (-0.30, 0.095, 0.610, 0.284, 3.0),
    (-0.70, 0.095, 0.680, 0.256, 3.0),
    (-1.10, 0.100, 0.665, 0.212, 3.0),
    (-1.60, 0.105, 0.575, 0.152, 2.8),
    (-2.10, 0.125, 0.468, 0.108, 2.6),
    (-2.55, 0.170, 0.400, 0.082, 2.4),
]

# cockpit opening: x, bottom, top, half-width, squareness
COCKPIT = [
    (0.86, 0.44, 0.95, 0.070, 2.2),
    (0.70, 0.36, 0.95, 0.150, 2.6),
    (0.40, 0.30, 0.95, 0.205, 3.0),
    (0.05, 0.30, 0.95, 0.212, 3.0),
    (-0.12, 0.36, 0.95, 0.150, 2.8),
    (-0.19, 0.44, 0.95, 0.070, 2.3),
]


def _keys(rows):
    return [dict(x=x, zb=zb, zt=zt, hw=hw, n=n) for x, zb, zt, hw, n in rows]


def build(ctx):
    rings = geo.section_rings(_keys(FUSELAGE), ring_points=56, per_segment=5)
    bm = geo.loft(rings)
    ob = ctx.add_bm(PART, "Chassis_Fuselage", bm, ["body"], angle=62)
    cut = geo.loft(geo.section_rings(_keys(COCKPIT), ring_points=48, per_segment=5))
    ctx.cut(ob, [cut])
    ctx.cut(ob, [_louvres()])
    ctx.add_bevel(ob, 0.006, 2, 38)
    return ob


def _louvres():
    """Engine-cover cooling gills: angled slots cut into the top surface, both sides."""
    top = geo.pchip(*zip(*[(r[0], r[2]) for r in sorted(FUSELAGE)]))
    boxes = []
    for s in (1, -1):
        for k in range(9):
            x = -0.98 - 0.040 * k
            b = geo.box((0, 0, 0), (0.014, 0.115, 0.07))
            geo.transform(b, Matrix.Rotation(math.radians(-24), 4, "Y"))
            geo.transform(b, Matrix.Translation((x, s * 0.105, top(x) - 0.004)))
            boxes.append(b)
    return geo.merge(*boxes)
