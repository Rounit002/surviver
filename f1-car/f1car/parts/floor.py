"""Floor plank with raised edge lip, bargeboards / floor fences and the rear diffuser
(ramp + vertical strakes). The floor is a real surface with thickness, not a texture."""
import math

import bmesh
from mathutils import Vector

from ..utils import geo

PART = "Floor"

OUTLINE = [(1.42, 0.40), (1.15, 0.58), (0.75, 0.70), (0.20, 0.765), (-0.50, 0.755),
           (-1.15, 0.70), (-1.55, 0.585), (-2.00, 0.535), (-2.55, 0.505)]
Z_TOP = 0.052
DIFF_START = -1.50
DIFF_RISE = 0.31
THICK = 0.022


def half_width(x):
    xs = [p[0] for p in OUTLINE][::-1]
    ys = [p[1] for p in OUTLINE][::-1]
    return geo.pchip(xs, ys)(x)


def ramp(x):
    t = geo.clamp((DIFF_START - x) / (DIFF_START - (-2.55)))
    return DIFF_RISE * t ** 1.25


def floor_z(x, u):
    """Top surface height. u in [-1, 1] across the width."""
    edge = geo.smoothstep(0.78, 1.0, abs(u)) ** 1.6
    return Z_TOP + ramp(x) + 0.028 * edge * (1.0 if x > DIFF_START else 0.35)


def build_plank(ctx):
    nx, ny = 90, 30
    xs = geo.linspace(OUTLINE[0][0], OUTLINE[-1][0], nx)
    us = [math.sin(math.pi * (j / (ny - 1) - 0.5)) for j in range(ny)]
    bm = bmesh.new()
    V = [[bm.verts.new((x, half_width(x) * u, floor_z(x, u))) for u in us] for x in xs]
    for i in range(nx - 1):
        for j in range(ny - 1):
            bm.faces.new((V[i][j], V[i][j + 1], V[i + 1][j + 1], V[i + 1][j]))
    bm.normal_update()
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=-THICK)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.material_index = 1 if f.normal.z < -0.3 else 0
    ob = ctx.add_bm(PART, "Floor_Plank", bm, ["carbon_gloss", "carbon_dark"], angle=70)
    ctx.add_bevel(ob, 0.003, 2, 40)
    return ob


def build_diffuser(ctx):
    strake_y = [0.0, 0.115, 0.235, 0.36, 0.475]
    xs = geo.linspace(-1.56, -2.55, 30)
    for k, y in enumerate(strake_y):
        top, bot = [], []
        for x in xs:
            zt = Z_TOP + ramp(x) - THICK * 0.6
            zb = 0.026
            if zt - zb < 0.004:
                continue
            top.append((x, zt))
            bot.append((x, zb))
        outline = top + bot[::-1]
        if y == 0.0:
            bm = geo.plate(outline, 0.008, "XZ", 0.0)
            ctx.add_bm(PART, "Diffuser_Strake_C", bm, ["carbon_matte"], angle=60)
        else:
            bm = geo.plate(outline, 0.006, "XZ", y)
            ctx.add_pair(PART, "Diffuser_Strake%d" % k, bm, ["carbon_matte"], angle=60)
    # roof closing the tunnels' trailing edge (gurney-style lip)
    lip = geo.box((-2.545, 0, Z_TOP + DIFF_RISE + 0.004), (0.014, 1.0, 0.020))
    ctx.add_bm(PART, "Diffuser_Lip", lip, ["carbon_gloss"], angle=60)


def build_vanes(ctx):
    z0 = Z_TOP + 0.002
    # bargeboard cluster ahead of the sidepod inlet
    boards = [
        ([(1.34, 0.30), (1.18, 0.38), (1.02, 0.47), (0.93, 0.57)], [0.10, 0.19, 0.27, 0.31]),
        ([(1.36, 0.42), (1.20, 0.50), (1.05, 0.58), (0.96, 0.67)], [0.07, 0.15, 0.21, 0.24]),
        ([(1.34, 0.54), (1.20, 0.61), (1.06, 0.68), (0.98, 0.735)], [0.04, 0.10, 0.15, 0.16]),
        ([(1.25, 0.20), (1.08, 0.25), (0.95, 0.31)], [0.05, 0.12, 0.18]),
    ]
    for i, (path, hs) in enumerate(boards):
        path = geo.catmull([(x, y, 0) for x, y in path], 6)
        pts = [(p.x, p.y) for p in path]
        n = len(pts)
        heights = [_interp(hs, j / (n - 1)) for j in range(n)]
        bm = geo.vertical_fence(pts, z0, heights, 0.005)
        ctx.add_pair(PART, "Bargeboard%d" % i, bm, ["carbon_gloss"], angle=60, bevel=(0.0012, 1))
    # floor-edge fences
    edge = [
        ([(0.75, 0.705), (0.42, 0.738), (0.10, 0.758), (-0.25, 0.755)], [0.028, 0.05, 0.055, 0.03]),
        ([(0.55, 0.62), (0.25, 0.655), (-0.05, 0.672), (-0.4, 0.668)], [0.02, 0.04, 0.05, 0.03]),
        ([(-0.9, 0.685), (-1.2, 0.655), (-1.45, 0.60)], [0.02, 0.04, 0.05]),
    ]
    for i, (path, hs) in enumerate(edge):
        path = geo.catmull([(x, y, 0) for x, y in path], 6)
        pts = [(p.x, p.y) for p in path]
        n = len(pts)
        heights = [_interp(hs, j / (n - 1)) for j in range(n)]
        bm = geo.vertical_fence(pts, z0 + 0.02, heights, 0.004)
        ctx.add_pair(PART, "FloorFence%d" % i, bm, ["carbon_gloss"], angle=60, bevel=(0.001, 1))


def _interp(vals, t):
    n = len(vals) - 1
    f = t * n
    i = min(int(f), n - 1)
    return vals[i] + (vals[i + 1] - vals[i]) * (f - i)


def build(ctx):
    build_plank(ctx)
    build_diffuser(ctx)
    build_vanes(ctx)
