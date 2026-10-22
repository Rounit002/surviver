"""Four complete wheel corners: slick tyre, forged rim + aero cover, hub nut, ventilated brake
disc, caliper and brake-duct drum. Hierarchy per corner (so it animates cleanly):

    WHEEL_<c>            empty at the hub, yawed 180 deg on the right side
      STEER_<c>          front: rotate Z to steer
        SPIN_<c>         rotate Y to roll (tyre, rim, cover, nut, disc, lettering)
        (caliper, duct)  fixed to the steering knuckle
"""
import math

import bmesh
from mathutils import Matrix, Vector

import bpy

from ..config import CAR, LIVERY
from ..utils import geo

PART = "Wheels"
BRAND = "VELOX"


# ---------------------------------------------------------------- tyre
def sidewall_a(W, t):
    return W * (0.945 + 0.040 * math.sin(math.pi * t))


def tyre_profile(R, W, rim_r, rs=0.017):
    """Closed (r, axial) profile + per-edge material index (0 tread, 1 sidewall, 2 band)."""
    pts, mi = [], []
    r_start, r_end = rim_r + 0.006, R - rs
    N = 18

    def side(sign):
        p, m = [], []
        for i in range(N + 1):
            t = i / N
            r = r_start + t * (r_end - r_start)
            p.append((r, sign * sidewall_a(W, t)))
            m.append(2 if 0.47 <= (i + 0.5) / N <= 0.58 else 1)
        return p, m

    up, upm = side(+1)
    a1 = sidewall_a(W, 1.0)
    arc = []
    for k in range(1, 7):
        th = (math.pi / 2) * k / 6
        arc.append((r_end + rs * math.sin(th), (a1 - rs) + rs * math.cos(th)))
    aw = a1 - rs
    crown = []
    for k in range(1, 8):
        a = aw - 2 * aw * k / 8
        crown.append((R - 0.0035 * (a / aw) ** 2, a))
    # + side going outward, shoulder, tread across, then - side back inward
    pts += [(rim_r - 0.015, 0.87 * W)] + up
    mi += [1] + upm
    pts += arc
    mi += [0] * len(arc)
    pts += crown
    mi += [0] * len(crown)
    dn, dnm = side(-1)
    arc2 = [(r, -a) for r, a in arc[::-1]]
    pts += arc2 + dn[::-1]
    mi += [0] * len(arc2) + dnm[::-1]
    pts += [(rim_r - 0.015, -0.87 * W)]
    mi += [1]
    return pts, mi


def build_tyre(ctx, name, R, W, parent):
    prof, mi = tyre_profile(R, W, CAR.rim_radius)
    # material_indices[i] belongs to edge i -> i+1
    mi = (mi + [0] * len(prof))[: len(prof)]
    bm = geo.revolve(prof, segments=144, axis="Y", material_indices=mi)
    return ctx.add_bm(PART, name, bm, ["tyre_tread", "tyre_side", "tyre_band"], parent=parent, angle=70)


def build_tyre_text(ctx, name, R, W, parent, front):
    """Sidewall lettering as real (thin) geometry so it catches light."""
    strings = [(BRAND, 0.048, 0.50, 58), ("SOFT", 0.036, 0.36, 132), ("P" if False else "305/720-18" if front else "405/720-18", 0.020, 0.27, -68)]
    bms = []
    dg = bpy.context.evaluated_depsgraph_get()
    for text, size, rfrac, ang in strings:
        cu = bpy.data.curves.new("txt", "FONT")
        cu.body = text
        cu.size = size
        cu.extrude = 0.0005
        cu.align_x = "CENTER"
        cu.align_y = "CENTER"
        cu.resolution_u = 3
        tob = bpy.data.objects.new("txt", cu)
        ctx.scene.collection.objects.link(tob)
        dg.update()
        me = bpy.data.meshes.new_from_object(tob.evaluated_get(dg))
        bpy.data.objects.remove(tob)
        bpy.data.curves.remove(cu)
        r = CAR.rim_radius + rfrac * (R - 0.017 - CAR.rim_radius - 0.006) + 0.006
        t = (r - (CAR.rim_radius + 0.006)) / (R - 0.017 - CAR.rim_radius - 0.006)
        a = sidewall_a(W, t) + 0.00045
        th = math.radians(ang)
        up = Vector((math.sin(th), 0, math.cos(th)))
        nrm = Vector((0, 1, 0))
        right = up.cross(nrm)
        m = Matrix((
            (right.x, up.x, nrm.x, r * math.sin(th)),
            (right.y, up.y, nrm.y, a),
            (right.z, up.z, nrm.z, r * math.cos(th)),
            (0, 0, 0, 1)))
        bm = bmesh.new()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
        bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
        bms.append(bm)
    bm = geo.merge(*bms)
    return ctx.add_bm(PART, name, bm, ["tyre_text"], parent=parent, angle=40)


# ---------------------------------------------------------------- rim / cover
def build_rim(ctx, name, W, parent):
    rr = CAR.rim_radius
    Wr = 0.90 * W
    prof = [
        (rr - 0.028, -Wr), (rr + 0.014, -Wr), (rr + 0.014, -Wr + 0.012),
        (rr - 0.004, -Wr + 0.030), (rr - 0.004, Wr - 0.030),
        (rr + 0.014, Wr - 0.012), (rr + 0.014, Wr), (rr - 0.028, Wr),
    ]
    bm = geo.revolve(prof, segments=144, axis="Y")
    return ctx.add_bm(PART, name, bm, ["wheel_forged"], parent=parent, angle=40)


def build_cover(ctx, name, W, parent):
    """Dished aero wheel-cover with a ring of kidney vents, cut with a real boolean."""
    rr = CAR.rim_radius
    a0 = 0.885 * W
    dish = 0.030
    thick = 0.010
    r_in, r_out = 0.052, rr - 0.003

    def face_a(r):
        u = (r - r_in) / (r_out - r_in)
        base = a0 - dish * (1 - u * u)
        if 0.36 < u < 0.42:
            base += 0.0035 * geo.smoothstep(0.36, 0.38, u) * (1 - geo.smoothstep(0.40, 0.42, u))
        if u > 0.93:
            base += 0.006 * geo.smoothstep(0.93, 1.0, u)
        return base

    rs = [r_in + (r_out - r_in) * i / 40 for i in range(41)]
    outer = [(r, face_a(r)) for r in rs]
    inner = [(r, face_a(r) - thick) for r in rs[::-1]]
    bm = geo.revolve(outer + inner, segments=144, axis="Y")
    # kidney vents
    cutters = []
    for k in range(12):
        ang = 2 * math.pi * k / 12
        c = geo.ellipsoid((0, 0, 0), (0.026, 0.06, 0.0105), u=16, v=8)
        # long axis along local X (radial after rotation), depth along Y
        geo.transform(c, Matrix.Translation((0.152, a0 - 0.02, 0)))
        geo.transform(c, Matrix.Rotation(ang, 4, "Y"))
        cutters.append(c)
    cutter = geo.merge(*cutters)
    ob = ctx.add_bm(PART, name, bm, ["wheel_forged"], parent=parent, angle=45)
    ctx.cut(ob, [cutter])
    ctx.add_bevel(ob, 0.0012, 2, 40)
    return ob


def build_hub_nut(ctx, name, W, parent):
    a0 = 0.885 * W - 0.030
    hexa = geo.revolve([(0.0, a0 + 0.030), (0.032, a0 + 0.030), (0.032, a0 - 0.002), (0.0, a0 - 0.002)],
                       segments=6, axis="Y")
    ring = geo.revolve([(0.040, a0 + 0.001), (0.052, a0 + 0.001), (0.052, a0 + 0.006), (0.040, a0 + 0.006)],
                       segments=48, axis="Y")
    o1 = ctx.add_bm(PART, name + "_Nut", hexa, ["steel"], parent=parent, angle=30)
    ctx.add_bevel(o1, 0.002, 2, 30)
    o2 = ctx.add_bm(PART, name + "_NutRing", ring, ["decal_orange"], parent=parent)
    return o1, o2


# ---------------------------------------------------------------- brake system
def build_brake_disc(ctx, name, W, parent):
    a = 0.885 * W - 0.105
    prof = [(0.084, a - 0.014), (0.140, a - 0.014), (0.140, a + 0.014), (0.084, a + 0.014)]
    bm = geo.revolve(prof, segments=96, axis="Y")
    # cross-drilled holes
    cutters = []
    for ring_r, count in ((0.100, 30), (0.122, 36)):
        for k in range(count):
            ang = 2 * math.pi * (k + (0.5 if ring_r > 0.11 else 0)) / count
            c = geo.cylinder((0, a - 0.03, 0), (0, a + 0.03, 0), 0.0032, segments=8)
            geo.transform(c, Matrix.Translation((ring_r, 0, 0)))
            geo.transform(c, Matrix.Rotation(ang, 4, "Y"))
            cutters.append(c)
    ob = ctx.add_bm(PART, name, bm, ["brake_disc"], parent=parent, angle=50)
    ctx.cut(ob, [geo.merge(*cutters)], solver="FAST")
    return ob


def build_caliper(ctx, name, W, parent, flip):
    a = 0.885 * W - 0.105
    bm = geo.box((0, 0, 0), (0.078, 0.062, 0.070))
    geo.transform(bm, Matrix.Translation((0.108, a, 0.0)))
    geo.transform(bm, Matrix.Rotation(math.radians(38), 4, "Y"))
    ob = ctx.add_bm(PART, name, bm, ["caliper"], parent=parent, flip_y=flip)
    ctx.add_bevel(ob, 0.010, 3, 40)
    return ob


def build_duct(ctx, name, W, parent, front, flip):
    """Carbon brake-duct drum behind the disc, with a forward scoop."""
    a = 0.885 * W - 0.150
    prof = [(0.070, a - 0.06), (0.176, a - 0.06), (0.176, a + 0.006), (0.070, a + 0.006)]
    bm = geo.revolve(prof, segments=64, axis="Y")
    ob = ctx.add_bm(PART, name, bm, ["carbon_gloss"], parent=parent, angle=50, flip_y=flip)
    ctx.add_bevel(ob, 0.003, 2, 40)
    if front:
        scoop = geo.box((0.0, a - 0.02, 0.0), (0.05, 0.05, 0.05))
        geo.transform(scoop, Matrix.Translation((0.20, 0.0, 0.0)))
        ob2 = ctx.add_bm(PART, name + "_Scoop", scoop, ["carbon_gloss"], parent=parent, flip_y=flip)
        ctx.add_bevel(ob2, 0.008, 3, 40)
    return ob


def build_upright(ctx, name, parent, front, flip, W):
    """Steering knuckle / upright in kingpin-local coordinates (origin on the kingpin axis)."""
    zl, zu = -0.145, 0.170
    body = geo.strut((0.0, 0.0, zl), (0.0, 0.0, zu), 0.034, 0.030, 0.030, 0.026, up=(1, 0, 0))
    ctx.add_bm(PART, name, body, ["alu_anodised"], parent=parent, angle=60, flip_y=flip)
    hub = geo.cylinder((0.0, 0.0, 0.0), (0.0, KP + 0.150 * 0 + 0.05, 0.0), 0.052, segments=32)
    ob = ctx.add_bm(PART, name + "_Hub", hub, ["alu_anodised"], parent=parent, angle=60, flip_y=flip)
    ctx.add_bevel(ob, 0.003, 2, 40)
    # tie-rod arm and balljoint pucks
    arm = geo.strut((0.0, 0.0, -0.02), (-0.075, 0.0, -0.06), 0.014, 0.012, 0.010, 0.010, up=(0, 1, 0))
    ctx.add_bm(PART, name + "_ArmTR", arm, ["alu_anodised"], parent=parent, angle=60, flip_y=flip)
    for z in (zl, zu):
        ball = geo.ellipsoid((0.0, 0.0, z), (0.018, 0.018, 0.018), 16, 8)
        ctx.add_bm(PART, name + "_Ball%+.2f" % z, ball, ["steel"], parent=parent, flip_y=flip)


# ---------------------------------------------------------------- assembly
KP = 0.10       # kingpin sits this far inboard of the tyre centre-line


def build_corner(ctx, tag, x, y, front):
    R = CAR.tyre_radius
    W = (CAR.front_tyre_width if front else CAR.rear_tyre_width) * 0.5
    right = y < 0
    sgn = -1.0 if right else 1.0
    root = ctx.add_empty(PART, "WHEEL_" + tag, location=(x, y - sgn * KP, R), size=0.2)
    steer = ctx.add_empty(PART, "STEER_" + tag, parent=root, size=0.15)
    hub = ctx.add_empty(PART, "HUB_" + tag, parent=steer, location=(0, sgn * KP, 0), size=0.1)
    frame = ctx.add_empty(PART, "SPINFRAME_" + tag, parent=hub, rotation=(0, 0, math.pi if right else 0), size=0.05)
    spin = ctx.add_empty(PART, "SPIN_" + tag, parent=frame, size=0.25)
    build_tyre(ctx, "Tyre_" + tag, R, W, spin)
    build_tyre_text(ctx, "TyreText_" + tag, R, W, spin, front)
    build_rim(ctx, "Rim_" + tag, W, spin)
    build_cover(ctx, "WheelCover_" + tag, W, spin)
    build_hub_nut(ctx, "HubNut_" + tag, W, spin)
    build_brake_disc(ctx, "BrakeDisc_" + tag, W, spin)
    build_caliper(ctx, "Caliper_" + tag, W, hub, right)
    build_duct(ctx, "BrakeDuct_" + tag, W, hub, front, right)
    build_upright(ctx, "Upright_" + tag, steer, front, right, W)
    return root


def build(ctx):
    fx, rx = CAR.front_axle, CAR.rear_axle
    fy, ry = CAR.front_track_half, CAR.rear_track_half
    build_corner(ctx, "FL", fx, fy, True)
    build_corner(ctx, "FR", fx, -fy, True)
    build_corner(ctx, "RL", rx, ry, False)
    build_corner(ctx, "RR", rx, -ry, False)
