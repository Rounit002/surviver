"""Double-wishbone suspension with carbon aerofoil-section arms, push/pull-rods, track rods,
rockers and a rear driveshaft. Defined for the left side and mirrored."""
import math

from mathutils import Matrix, Vector

from ..config import CAR
from ..utils import geo
from .wheels import KP

PART = "Suspension"


def _arm(ctx, name, a, b, w=0.0075, h=0.024, mat="carbon_gloss"):
    """Streamlined arm: thin in Z, long chord in X."""
    bm = geo.strut(a, b, w, h, w, h, up=(1, 0, 0), count=16)
    return ctx.add_pair(PART, name, bm, [mat], angle=60)


def _rod(ctx, name, a, b, r=0.010, mat="carbon_gloss"):
    bm = geo.strut(a, b, r, r, r, r, count=14)
    return ctx.add_pair(PART, name, bm, [mat], angle=60)


def _joint(ctx, name, p, r=0.016):
    bm = geo.ellipsoid(p, (r, r, r), 14, 8)
    return ctx.add_pair(PART, name, bm, ["steel"], angle=60)


def front(ctx):
    y = CAR.front_track_half - KP
    x = CAR.front_axle
    z0 = CAR.tyre_radius
    U = Vector((x, y, z0 + 0.170))
    L = Vector((x, y, z0 - 0.145))
    up_in = [Vector((x + 0.18, 0.110, z0 + 0.010)), Vector((x - 0.20, 0.168, z0 + 0.018))]
    lo_in = [Vector((x + 0.20, 0.105, z0 - 0.140)), Vector((x - 0.25, 0.165, z0 - 0.150))]
    for i, p in enumerate(up_in):
        _arm(ctx, "F_UpperWishbone%d" % i, p, U)
    for i, p in enumerate(lo_in):
        _arm(ctx, "F_LowerWishbone%d" % i, p, L)
    # pushrod: lower outboard -> rocker on top of the nose
    _rod(ctx, "F_Pushrod", L + Vector((0.0, -0.01, 0.04)), Vector((x - 0.02, 0.105, 0.400)), 0.0095)
    # track rod
    _rod(ctx, "F_TrackRod", Vector((x - 0.11, 0.150, z0 - 0.055)), Vector((x - 0.075, y, z0 - 0.08)), 0.0075)
    # rocker / damper housing peeking from the nose
    rocker = geo.box((x - 0.02, 0.0, 0.412), (0.06, 0.20, 0.028))
    ob = ctx.add_bm(PART, "F_Rocker", rocker, ["alu_anodised"], angle=50)
    ctx.add_bevel(ob, 0.006, 3, 40)
    for nm, p in (("U0", U), ("L0", L)):
        _joint(ctx, "F_Ball" + nm, p)


def rear(ctx):
    y = CAR.rear_track_half - KP
    x = CAR.rear_axle
    z0 = CAR.tyre_radius
    U = Vector((x, y, z0 + 0.170))
    L = Vector((x, y, z0 - 0.145))
    up_in = [Vector((x + 0.19, 0.112, z0 + 0.020)), Vector((x - 0.20, 0.118, z0 + 0.005))]
    lo_in = [Vector((x + 0.20, 0.118, z0 - 0.140)), Vector((x - 0.22, 0.125, z0 - 0.145))]
    for i, p in enumerate(up_in):
        _arm(ctx, "R_UpperWishbone%d" % i, p, U)
    for i, p in enumerate(lo_in):
        _arm(ctx, "R_LowerWishbone%d" % i, p, L)
    # pullrod: upright top -> gearbox-mounted rocker
    _rod(ctx, "R_Pullrod", U + Vector((0.0, -0.01, -0.03)), Vector((x + 0.02, 0.105, 0.470)), 0.0095)
    _rod(ctx, "R_ToeLink", Vector((x + 0.12, 0.130, z0 - 0.05)), Vector((x + 0.07, y, z0 - 0.06)), 0.0075)
    # driveshaft + CV boot
    shaft = geo.cylinder((x, 0.10, z0), (x, y + 0.08, z0), 0.020, segments=20)
    ctx.add_pair(PART, "R_Driveshaft", shaft, ["steel"], angle=60)
    boot = geo.revolve([(0.020, 0.0), (0.040, 0.03), (0.042, 0.055), (0.030, 0.09), (0.028, 0.10),
                        (0.022, 0.10), (0.022, 0.0)], segments=24, axis="Y")
    geo.transform(boot, Matrix.Translation((x, y - 0.10, z0)))
    ctx.add_pair(PART, "R_CVBoot", boot, ["rubber"], angle=60)
    for nm, p in (("U0", U), ("L0", L)):
        _joint(ctx, "R_Ball" + nm, p)


def build(ctx):
    front(ctx)
    rear(ctx)
