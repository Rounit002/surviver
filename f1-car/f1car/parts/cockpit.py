"""Driver environment: padded cockpit rim, seat, headrest, helmet with visor, steering wheel
with display, and the titanium halo."""
import math

import bmesh
from mathutils import Matrix, Vector

from ..utils import geo

PART = "Cockpit"

HELMET_C = Vector((0.16, 0.0, 0.705))


def build_rim_padding(ctx):
    """Soft padding following the cockpit opening (a swept tube along the rim)."""
    from .chassis import COCKPIT, FUSELAGE
    keys = [dict(x=x, zb=zb, zt=zt, hw=hw, n=n) for x, zb, zt, hw, n in COCKPIT]
    fun = geo.pchip([r[0] for r in sorted(FUSELAGE)], [r[2] for r in sorted(FUSELAGE)])
    # rim path: walk around the cutter's outline at the height where it meets the fuselage top
    pts = []
    xs = geo.linspace(0.82, -0.17, 40)
    kx = sorted(keys, key=lambda k: k["x"])
    hwf = geo.pchip([k["x"] for k in kx], [k["hw"] for k in kx])
    for x in xs:
        pts.append((x, hwf(x) * 0.985, fun(x) - 0.004))
    left = pts
    right = [(x, -y, z) for x, y, z in pts[::-1]]
    path = left + right + [left[0]]
    bm = geo.tube_path(path, 0.014, count=10, cap=False)
    # close the loop cosmetically by welding duplicates
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    return ctx.add_bm(PART, "Cockpit_RimPadding", bm, ["foam"], angle=70)


def build_seat(ctx):
    seat = geo.loft(geo.section_rings([
        dict(x=0.44, zb=0.30, zt=0.36, hw=0.15, n=2.6),
        dict(x=0.14, zb=0.30, zt=0.40, hw=0.18, n=3.0),
        dict(x=-0.06, zb=0.30, zt=0.40, hw=0.18, n=3.0)], ring_points=28, per_segment=3))
    ctx.add_bm(PART, "Seat_Base", seat, ["fabric"], angle=60)
    back = geo.box((-0.05, 0, 0.56), (0.07, 0.30, 0.36))
    ob = ctx.add_bm(PART, "Seat_Back", back, ["fabric"], angle=60)
    ctx.add_bevel(ob, 0.025, 3, 40)
    # headrest wings
    for s in (1, -1):
        hb = geo.box((0.06, s * 0.155, 0.72), (0.20, 0.05, 0.19))
        ob = ctx.add_bm(PART, "Headrest_%s" % ("L" if s > 0 else "R"), hb, ["foam_red"], angle=60)
        ctx.add_bevel(ob, 0.018, 4, 40)
    hb = geo.box((-0.04, 0, 0.72), (0.06, 0.24, 0.16))
    ob = ctx.add_bm(PART, "Headrest_Back", hb, ["foam"], angle=60)
    ctx.add_bevel(ob, 0.02, 4, 40)


def build_driver(ctx):
    # torso / shoulders (race suit)
    torso = geo.ellipsoid((-0.02, 0, 0.53), (0.13, 0.20, 0.23), 32, 16)
    ctx.add_bm(PART, "Driver_Torso", torso, ["fabric"], angle=60)
    # helmet
    bm = geo.ellipsoid(tuple(HELMET_C), (0.158, 0.118, 0.135), 48, 24)
    # elongated shell: pull the front-lower quadrant forward into a chin bar
    for v in bm.verts:
        d = v.co - HELMET_C
        if d.x > 0 and d.z < 0.02:
            k = geo.smoothstep(0.0, 0.10, d.x) * geo.smoothstep(0.02, -0.09, d.z)
            v.co.x += 0.040 * k
            v.co.y *= 1.0 - 0.10 * k
    for f in bm.faces:
        c = f.calc_center_median() - HELMET_C
        if c.x > 0.05 and -0.040 < c.z < 0.050 and abs(c.y) < 0.098:
            f.material_index = 1
    helmet = ctx.add_bm(PART, "Driver_Helmet", bm, ["helmet", "visor"], angle=70)
    ctx.add_bevel(helmet, 0.002, 2, 50)
    # helmet-visor surround tear-off strip
    strip = geo.ellipsoid(tuple(HELMET_C + Vector((0.002, 0, 0.062))), (0.158, 0.119, 0.008), 40, 6)
    ctx.add_bm(PART, "Helmet_Strip", strip, ["black_gloss"], angle=60)
    # chin bar / base collar
    collar = geo.ellipsoid(tuple(HELMET_C + Vector((0.01, 0, -0.10))), (0.09, 0.09, 0.05), 24, 10)
    ctx.add_bm(PART, "Driver_Collar", collar, ["fabric"], angle=60)
    # arms reaching for the wheel
    for s in (1, -1):
        arm = geo.strut((0.05, s * 0.19, 0.50), (0.60, s * 0.115, 0.535), 0.045, 0.045, 0.034, 0.034)
        ctx.add_bm(PART, "Driver_Arm_%s" % ("L" if s > 0 else "R"), arm, ["fabric"], angle=60)
        glove = geo.ellipsoid((0.66, s * 0.130, 0.54), (0.055, 0.045, 0.045), 20, 10)
        ctx.add_bm(PART, "Driver_Glove_%s" % ("L" if s > 0 else "R"), glove, ["black_gloss"], angle=60)


def build_steering(ctx):
    """Rectangular F1-style wheel: carbon rim body, display, grips and rotary switches."""
    pivot = ctx.add_empty(PART, "SteeringWheel_Pivot", location=(0.63, 0, 0.535),
                          rotation=(0, math.radians(20), 0), size=0.1)
    body = geo.box((0, 0, 0), (0.02, 0.27, 0.11))
    ob = ctx.add_bm(PART, "SteeringWheel_Body", body, ["carbon_gloss"], parent=pivot, angle=60)
    ctx.add_bevel(ob, 0.008, 4, 40)
    for s in (1, -1):
        grip = geo.box((0.0, s * 0.14, -0.006), (0.04, 0.05, 0.13))
        ob = ctx.add_bm(PART, "SteeringGrip_%s" % ("L" if s > 0 else "R"), grip, ["rubber"], parent=pivot, angle=60)
        ctx.add_bevel(ob, 0.015, 4, 40)
    disp = geo.box((-0.0115, 0, 0.018), (0.002, 0.100, 0.052))
    bmd = disp
    # UV so the display shader has coordinates
    uv = bmd.loops.layers.uv.new("UVMap")
    for f in bmd.faces:
        for l in f.loops:
            l[uv].uv = ((l.vert.co.y + 0.05) / 0.10, (l.vert.co.z - 0.018 + 0.026) / 0.052)
    ctx.add_bm(PART, "SteeringWheel_Display", bmd, ["display"], parent=pivot, angle=60)
    # rotary switches + buttons
    for i, (y, z, r, mk) in enumerate([(-0.06, -0.030, 0.011, "accent"), (0.06, -0.030, 0.011, "accent"),
                                       (-0.035, -0.040, 0.007, "steel"), (0.035, -0.040, 0.007, "steel"),
                                       (-0.095, 0.02, 0.008, "led_green"), (0.095, 0.02, 0.008, "led_red"),
                                       (-0.095, -0.015, 0.008, "led_blue"), (0.095, -0.015, 0.008, "steel")]):
        cyl = geo.cylinder((-0.010, y, z), (-0.020, y, z), r, segments=20)
        ctx.add_bm(PART, "SteeringButton_%d" % i, cyl, [mk], parent=pivot, angle=50)
    # paddles
    for s in (1, -1):
        pad = geo.box((0.030, s * 0.115, 0.0), (0.006, 0.05, 0.10))
        ob = ctx.add_bm(PART, "Paddle_%s" % ("L" if s > 0 else "R"), pad, ["carbon_gloss"], parent=pivot, angle=60)
        ctx.add_bevel(ob, 0.002, 2, 40)
    # steering column
    col = geo.cylinder((0.60, 0, 0.50), (0.78, 0, 0.44), 0.020, segments=20)
    ctx.add_bm(PART, "SteeringColumn", col, ["alu_anodised"], angle=50)


def build_halo(ctx):
    r = 0.0175
    joint = Vector((0.62, 0.0, 0.868))
    front_base = Vector((0.90, 0.0, 0.585))
    # central pillar
    pillar = geo.tube_path(geo.catmull([front_base, front_base.lerp(joint, 0.5) + Vector((-0.005, 0, 0)), joint], 8),
                           r * 1.15, count=16, radius_fn=lambda t: r * (1.25 - 0.2 * t))
    ctx.add_bm(PART, "Halo_Pillar", pillar, ["titanium"], angle=60)
    for s in (1, -1):
        p = [joint,
             Vector((0.50, s * 0.085, 0.850)),
             Vector((0.30, s * 0.190, 0.800)),
             Vector((0.06, s * 0.245, 0.735)),
             Vector((-0.10, s * 0.258, 0.640)),
             Vector((-0.15, s * 0.255, 0.545))]
        bm = geo.tube_path(geo.catmull(p, 10), r, count=16, radius_fn=lambda t: r * (1.0 + 0.1 * t))
        ctx.add_bm(PART, "Halo_Arm_%s" % ("L" if s > 0 else "R"), bm, ["titanium"], angle=60)
        # mounting boss where it meets the tub
        boss = geo.cylinder((-0.15, s * 0.255, 0.60), (-0.145, s * 0.252, 0.53), 0.030, segments=20)
        ctx.add_bm(PART, "Halo_Mount_%s" % ("L" if s > 0 else "R"), boss, ["carbon_gloss"], angle=50)
    boss = geo.cylinder((0.905, 0, 0.60), (0.895, 0, 0.56), 0.032, segments=20)
    ctx.add_bm(PART, "Halo_FrontMount", boss, ["carbon_gloss"], angle=50)
    # joint fairing
    j = geo.ellipsoid(tuple(joint), (0.03, 0.026, 0.024), 20, 10)
    ctx.add_bm(PART, "Halo_Joint", j, ["titanium"], angle=60)


def build(ctx):
    build_rim_padding(ctx)
    build_seat(ctx)
    build_driver(ctx)
    build_steering(ctx)
    build_halo(ctx)
