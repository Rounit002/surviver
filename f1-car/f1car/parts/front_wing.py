"""Four-element front wing: mainplane + three flaps (cambered, twisted, stepped up toward the
end-plates), nose pylons, footplates and sculpted end-plates."""
import math

from mathutils import Vector

from ..config import CAR
from ..utils import geo

PART = "FrontWing"
YMAX = 0.965
N_STATIONS = 49


def _ys():
    return [YMAX * math.sin(math.pi * (i / (N_STATIONS - 1) - 0.5)) / math.sin(math.pi / 2)
            for i in range(N_STATIONS)]


def _te(le, chord, alpha):
    a = math.radians(alpha)
    return Vector((le.x - chord * math.cos(a), le.y, le.z + chord * math.sin(a)))


def element_stations():
    """Returns {name: [station dicts]} for the mainplane and three flaps."""
    ys = _ys()
    out = {"Main": [], "Flap1": [], "Flap2": [], "Flap3": []}
    chords = [0.235, 0.200, 0.165]
    alphas = [15.0, 25.0, 34.0]
    for y in ys:
        ay = abs(y) / YMAX
        cen = 1.0 - geo.smoothstep(0.05, 0.78, abs(y))          # centre section lift
        tip = geo.smoothstep(0.72, 1.0, abs(y))
        le = Vector((CAR.front_wing_le - 0.11 - 0.05 * ay * ay, y, 0.074 + 0.058 * cen + 0.016 * tip))
        chord = 0.335 - 0.045 * ay
        alpha = 4.0 + 3.0 * ay
        st = dict(y=y, x_le=le.x, z_le=le.z, chord=chord, alpha=alpha, thick=1.0)
        out["Main"].append(st)
        prev_le, prev_chord, prev_alpha = le, chord, alpha
        for k, name in enumerate(("Flap1", "Flap2", "Flap3")):
            te = _te(prev_le, prev_chord, prev_alpha)
            fl_le = Vector((te.x + 0.055, y, te.z + 0.026 + 0.010 * ay))
            shrink = 0.78 + 0.22 * geo.smoothstep(0.05, 0.6, abs(y))
            c = chords[k] * shrink
            a = alphas[k] + 7.0 * ay + 6.0 * tip
            out[name].append(dict(y=y, x_le=fl_le.x, z_le=fl_le.z, chord=c, alpha=a,
                                  thick=0.9 if k else 1.0))
            prev_le, prev_chord, prev_alpha = fl_le, c, a
    return out


def build_elements(ctx):
    prof = geo.naca_profile(thickness=0.11, camber=0.055, camber_pos=0.42, points=22)
    prof_flap = geo.naca_profile(thickness=0.085, camber=0.07, camber_pos=0.40, points=22)
    for name, sts in element_stations().items():
        bm = geo.wing_element(sts, prof if name == "Main" else prof_flap, invert=True)
        ob = ctx.add_bm(PART, "FrontWing_" + name, bm, ["carbon_gloss"], angle=70)


def _endplate_curves():
    top = geo.pchip([2.00, 2.03, 2.12, 2.34, 2.58, 2.80, 2.87][::1],
                    [0.230, 0.325, 0.330, 0.275, 0.200, 0.135, 0.090])
    bottom = geo.pchip([2.00, 2.05, 2.87], [0.075, 0.030, 0.030])
    return bottom, top


def build_endplates(ctx):
    def warp(p):
        u = geo.clamp(p.z / 0.33)
        p.y += 0.020 * (1 - u) ** 1.6 - 0.010 * u * u

    bottom, top = _endplate_curves()
    bm = geo.plate_between(2.87, 2.00, bottom, top, 0.006, YMAX + 0.004, warp=warp)
    ctx.add_pair(PART, "FrontWing_Endplate", bm, ["body"], angle=60, bevel=(0.0015, 2))
    # foot plate
    foot = [(2.87, YMAX + 0.004), (2.06, YMAX + 0.004), (2.09, YMAX + 0.058), (2.83, YMAX + 0.070)]
    bmf = geo.plate(foot, 0.0045, "XY", 0.030)
    ctx.add_pair(PART, "FrontWing_Footplate", bmf, ["carbon_gloss"], angle=60, bevel=(0.001, 1))


def build_pylons(ctx):
    for side in (1, -1):
        bm = geo.strut((2.40, side * 0.050, 0.212), (2.57, side * 0.064, 0.150), 0.010, 0.030,
                       0.008, 0.036, up=(1, 0, 0))
        ctx.add_bm(PART, "FrontWing_Pylon_%s" % ("L" if side > 0 else "R"), bm, ["carbon_gloss"], angle=60)


def build(ctx):
    build_elements(ctx)
    build_endplates(ctx)
    build_pylons(ctx)
