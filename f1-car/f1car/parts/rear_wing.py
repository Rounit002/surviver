"""Rear wing: mainplane, DRS flap with actuator pod, beam wing, louvred end-plates and pylon."""
import math

from mathutils import Matrix, Vector

from ..config import CAR
from ..utils import geo

PART = "RearWing"
YMAX = 0.470


def _stations(x_le, z_le, chord, alpha, n=25, camber_lift=0.0, chord_taper=0.0):
    out = []
    for i in range(n):
        y = YMAX * (2 * i / (n - 1) - 1)
        ay = abs(y) / YMAX
        # slight spoon in the middle of the mainplane for the classic rear-wing look
        spoon = -0.012 * (1 - ay * ay) * camber_lift
        out.append(dict(y=y, x_le=x_le, z_le=z_le + spoon, chord=chord * (1 - chord_taper * ay),
                        alpha=alpha + 2.0 * ay, thick=1.0))
    return out


def build_elements(ctx):
    prof_main = geo.naca_profile(thickness=0.12, camber=0.07, camber_pos=0.40, points=24)
    prof_flap = geo.naca_profile(thickness=0.085, camber=0.085, camber_pos=0.42, points=24)
    parts = {
        "Main": (_stations(-2.36, 0.800, 0.300, 13.0, camber_lift=1.0), prof_main),
        "Flap": (_stations(-2.60, 0.905, 0.235, 32.0, chord_taper=0.06), prof_flap),
        "Beam1": (_stations(-2.46, 0.470, 0.175, 9.0, chord_taper=0.15), prof_flap),
        "Beam2": (_stations(-2.57, 0.515, 0.125, 24.0, chord_taper=0.15), prof_flap),
    }
    for name, (sts, prof) in parts.items():
        span = 0.86 if name.startswith("Beam") else 1.0
        for st in sts:
            if name.startswith("Beam"):
                st["y"] *= 0.86
        bm = geo.wing_element(sts, prof, invert=True)
        ctx.add_bm(PART, "RearWing_" + name, bm, ["carbon_gloss"], angle=70)
    # gurney lip on the flap trailing edge
    a = math.radians(32.0 + 2.0)
    te = Vector((-2.60 - 0.235 * math.cos(math.radians(32.0)), 0, 0.905 + 0.235 * math.sin(math.radians(32.0))))
    gurney = geo.box((te.x + 0.002, 0, te.z + 0.006), (0.004, 2 * YMAX - 0.02, 0.022))
    ctx.add_bm(PART, "RearWing_Gurney", gurney, ["accent"], angle=40)


def _endplate_curves():
    xs = [-2.93, -2.85, -2.62, -2.42, -2.33]
    bottom = geo.pchip(xs, [0.700, 0.605, 0.548, 0.556, 0.600])
    top = geo.pchip([-2.93, -2.90, -2.78, -2.55, -2.38, -2.33],
                    [0.985, 1.090, 1.105, 1.075, 1.005, 0.880])
    return bottom, top


def _endplate_warp(p):
    u = geo.clamp((p.z - 0.55) / 0.55)
    p.y += (0.010 * (1 - u) + 0.012 * u * u) * (1 if p.y > 0 else -1)


def build_endplates(ctx):
    bottom, top = _endplate_curves()
    # left plate is built on +Y, then mirrored (the warp sign is handled by construction)
    bm = geo.plate_between(-2.33, -2.93, bottom, top, 0.007, YMAX + 0.005,
                           warp=lambda p: _endplate_warp(p))
    left, right = ctx.add_pair(PART, "RearWing_Endplate", bm, ["body"], angle=60)
    # louvre slots (real holes)
    for ob, s in ((left, 1), (right, -1)):
        cutters = []
        for k, z in enumerate((0.70, 0.79, 0.88, 0.97)):
            c = geo.box((0, 0, 0), (0.15 - 0.012 * k, 0.05, 0.020))
            geo.transform(c, Matrix.Rotation(math.radians(-26), 4, "Y"))
            geo.transform(c, Matrix.Translation((-2.69 + 0.012 * k, s * (YMAX + 0.012), z)))
            cutters.append(c)
        ctx.cut(ob, [geo.merge(*cutters)], solver="EXACT")
        ctx.add_bevel(ob, 0.0018, 2, 40)
    # accent-coloured spine along the top edge of the plate
    acc = geo.plate_between(-2.38, -2.90, lambda x: top(x) - 0.030, top, 0.0078,
                            YMAX + 0.0055, warp=lambda p: _endplate_warp(p), nx=32, nz=4)
    ctx.add_pair(PART, "RearWing_EndplateAccent", acc, ["accent"], angle=50)
    # beam-wing end-plates
    for s in (1, -1):
        y = s * (YMAX * 0.86 + 0.004)
        outline = [(-2.44, 0.43), (-2.44, 0.58), (-2.60, 0.62), (-2.72, 0.60), (-2.70, 0.44)]
        bm3 = geo.plate(outline, 0.005, "XZ", y)
        ctx.add_bm(PART, "BeamWing_Endplate_%s" % ("L" if s > 0 else "R"), bm3, ["carbon_gloss"], angle=50)


def build_pylons(ctx):
    outline = [(-2.40, 0.36), (-2.42, 0.62), (-2.47, 0.80), (-2.60, 0.82), (-2.58, 0.62), (-2.60, 0.36)]
    bm = geo.plate(outline, 0.040, "XZ", 0.0)
    ob = ctx.add_bm(PART, "RearWing_Pylon", bm, ["carbon_matte"], angle=60)
    ctx.add_bevel(ob, 0.006, 2, 40)
    # DRS actuator pod
    pod = geo.ellipsoid((-2.58, 0.0, 0.985), (0.075, 0.020, 0.028), 24, 12)
    ctx.add_bm(PART, "RearWing_DRSPod", pod, ["carbon_matte"], angle=60)


def build(ctx):
    build_elements(ctx)
    build_endplates(ctx)
    build_pylons(ctx)
