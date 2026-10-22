"""Gearbox tail: crash structure, rain light, single heat-tinted exhaust, T-cam pod."""
import math

from mathutils import Matrix

from ..utils import geo

PART = "RearEnd"


def build(ctx):
    # crash structure / gearbox tail cap: tapered and slightly lower than the tail
    keys = [dict(x=-2.45, zb=0.175, zt=0.405, hw=0.080, n=2.8),
            dict(x=-2.62, zb=0.200, zt=0.392, hw=0.062, n=3.0),
            dict(x=-2.79, zb=0.232, zt=0.372, hw=0.046, n=3.2)]
    bm = geo.loft(geo.section_rings(keys, ring_points=32, per_segment=4))
    ob = ctx.add_bm(PART, "CrashStructure", bm, ["carbon_matte"], angle=60)
    ctx.add_bevel(ob, 0.005, 2, 40)
    # rain light: slim LED bar set into a black bezel
    bezel = geo.box((-2.788, 0, 0.300), (0.006, 0.062, 0.046))
    ob = ctx.add_bm(PART, "RainLight_Bezel", bezel, ["black_gloss"], angle=40)
    ctx.add_bevel(ob, 0.004, 2, 40)
    led = geo.box((-2.7925, 0, 0.300), (0.004, 0.048, 0.026))
    ctx.add_bm(PART, "RainLight", led, ["led_red"], angle=40)
    # exhaust: hollow tailpipe with a dark bore
    pipe = geo.revolve([(0.046, -2.18), (0.052, -2.30), (0.052, -2.68), (0.050, -2.70),
                        (0.040, -2.70), (0.041, -2.30), (0.038, -2.18)], segments=56, axis="X")
    ctx.add_bm(PART, "Exhaust", pipe, ["inconel"], location=(0, 0, 0.505), angle=55)
    strut_bm = geo.box((-2.30, 0.0, 0.455), (0.16, 0.030, 0.070))
    ctx.add_bm(PART, "Exhaust_Support", strut_bm, ["carbon_matte"], angle=60)
