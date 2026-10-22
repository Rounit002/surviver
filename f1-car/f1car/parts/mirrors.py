"""Wing mirrors on stalks, plus cockpit-side bodywork details (cameras, sensors, winglets)."""
import math

from mathutils import Matrix, Vector

from ..utils import geo

PART = "Mirrors"


def build(ctx):
    # mirror housing: streamlined loft, glass face at the rear
    keys = [dict(x=0.66, y=0.0, zb=-0.030, zt=0.030, hw=0.030, n=2.3),
            dict(x=0.58, y=0.0, zb=-0.038, zt=0.040, hw=0.062, n=2.6),
            dict(x=0.50, y=0.0, zb=-0.040, zt=0.040, hw=0.078, n=2.8),
            dict(x=0.44, y=0.0, zb=-0.038, zt=0.036, hw=0.076, n=3.0)]
    housing = geo.loft(geo.section_rings(keys, ring_points=32, per_segment=4))
    glass = geo.box((0.4395, 0, 0), (0.002, 0.140, 0.070))
    for s in (1, -1):
        h = housing.copy()
        g = glass.copy()
        for bm_ in (h, g):
            geo.transform(bm_, Matrix.Translation((0.0, s * 0.525, 0.665)))
            if s < 0:
                for v in bm_.verts:
                    v.co.y = -v.co.y
                import bmesh
                bmesh.ops.reverse_faces(bm_, faces=bm_.faces)
        side = "L" if s > 0 else "R"
        ob = ctx.add_bm(PART, "Mirror_Housing_" + side, h, ["carbon_gloss"], angle=60)
        ctx.add_bevel(ob, 0.003, 2, 40)
        ctx.add_bm(PART, "Mirror_Glass_" + side, g, ["mirror"], angle=60)
        # stalks (two flattened struts)
        for (x0, y0, z0, x1) in ((0.66, 0.235, 0.575, 0.56), (0.60, 0.245, 0.585, 0.50)):
            st = geo.strut((x0, s * y0, z0), (x1, s * 0.500, 0.640), 0.010, 0.006, 0.008, 0.006, up=(0, 0, 1))
            ctx.add_bm(PART, "Mirror_Stalk_%s_%.0f" % (side, x0 * 100), st, ["carbon_gloss"], angle=60)
        # small winglet on top of housing
        wl = geo.box((0.54, s * 0.525, 0.712), (0.10, 0.11, 0.004))
        ob = ctx.add_bm(PART, "Mirror_Winglet_" + side, wl, ["accent"], angle=40)
        ctx.add_bevel(ob, 0.0015, 1, 40)
