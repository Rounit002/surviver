"""Mesh-building helpers (bmesh based). Pure geometry, no scene knowledge."""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector


# ------------------------------------------------------------------ scalar helpers
def lerp(a, b, t):
    return a + (b - a) * t


def clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def smoothstep(e0, e1, x):
    if e0 == e1:
        return 0.0 if x < e0 else 1.0
    t = clamp((x - e0) / (e1 - e0))
    return t * t * (3.0 - 2.0 * t)


def linspace(a, b, n):
    return [a + (b - a) * i / (n - 1) for i in range(n)]


def pchip(xs, ys):
    """Monotone cubic Hermite interpolant (no overshoot between key stations)."""
    n = len(xs)
    if n == 1:
        return lambda x: ys[0]
    h = [xs[i + 1] - xs[i] for i in range(n - 1)]
    d = [(ys[i + 1] - ys[i]) / h[i] for i in range(n - 1)]
    m = [0.0] * n
    if n == 2:
        m = [d[0], d[0]]
    else:
        m[0], m[-1] = d[0], d[-1]
        for i in range(1, n - 1):
            if d[i - 1] * d[i] <= 0:
                m[i] = 0.0
            else:
                w1 = 2 * h[i] + h[i - 1]
                w2 = h[i] + 2 * h[i - 1]
                m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])

    def f(x):
        if x <= xs[0]:
            return ys[0]
        if x >= xs[-1]:
            return ys[-1]
        lo, hi = 0, n - 1
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if xs[mid] <= x:
                lo = mid
            else:
                hi = mid
        t = (x - xs[lo]) / h[lo]
        t2, t3 = t * t, t * t * t
        return ((2 * t3 - 3 * t2 + 1) * ys[lo] + (t3 - 2 * t2 + t) * h[lo] * m[lo]
                + (-2 * t3 + 3 * t2) * ys[lo + 1] + (t3 - t2) * h[lo] * m[lo + 1])

    return f


# ------------------------------------------------------------------- lofted bodies
_SECTION_DEFAULTS = dict(y=0.0, zb=0.0, zt=0.1, hw=0.1, n=2.5, taper=0.0)


def superellipse_ring(y0, z0, hw, ht, hb, n, taper, count):
    """Ring of (y, z) points. `n` is the squareness exponent (2 = ellipse, >3 boxy)."""
    e = 2.0 / n
    pts = []
    for i in range(count):
        t = 2.0 * math.pi * i / count
        c, s = math.cos(t), math.sin(t)
        cy = math.copysign(abs(c) ** e, c)
        sz = math.copysign(abs(s) ** e, s)
        if s >= 0:
            z = z0 + ht * sz
            ys = 1.0 - taper * sz
        else:
            z = z0 + hb * sz
            ys = 1.0
        pts.append((y0 + hw * cy * ys, z))
    return pts


def dense_stations(keys, per_segment=4):
    xs = sorted(k["x"] for k in keys)
    out = []
    for a, b in zip(xs[:-1], xs[1:]):
        for i in range(per_segment):
            out.append(a + (b - a) * i / per_segment)
    out.append(xs[-1])
    return out


def section_rings(keys, stations=None, ring_points=40, per_segment=4):
    """Interpolate key cross-sections (dicts with x, y, zb, zt, hw, n, taper) into rings."""
    keys = sorted(keys, key=lambda k: k["x"])
    kx = [k["x"] for k in keys]
    fn = {p: pchip(kx, [k.get(p, d) for k in keys]) for p, d in _SECTION_DEFAULTS.items()}
    if stations is None:
        stations = dense_stations(keys, per_segment)
    rings = []
    for x in stations:
        zb, zt = fn["zb"](x), fn["zt"](x)
        z0, h = (zb + zt) * 0.5, (zt - zb) * 0.5
        ring = superellipse_ring(fn["y"](x), z0, max(fn["hw"](x), 1e-4), h, h,
                                 max(fn["n"](x), 1.6), fn["taper"](x), ring_points)
        rings.append([Vector((x, y, z)) for y, z in ring])
    return rings


def loft(rings, cap_start=True, cap_end=True, closed=True):
    """Skin a list of equally-sized vertex rings into a bmesh."""
    bm = bmesh.new()
    verts = [[bm.verts.new(p) for p in ring] for ring in rings]
    n = len(rings[0])
    for i in range(len(rings) - 1):
        for j in range(n if closed else n - 1):
            a, b = verts[i][j], verts[i][(j + 1) % n]
            c, d = verts[i + 1][(j + 1) % n], verts[i + 1][j]
            bm.faces.new((a, b, c, d))
    if closed:
        if cap_start:
            bm.faces.new(verts[0][::-1])
        if cap_end:
            bm.faces.new(verts[-1])
    bm.normal_update()
    if closed:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def inset_pocket(bm, direction, inset=0.02, depth=0.05, material_index=1):
    """Turn the cap facing `direction` into a recessed pocket (intakes, exhausts)."""
    direction = Vector(direction).normalized()
    face = max(bm.faces, key=lambda f: f.normal.dot(direction))
    res = bmesh.ops.inset_region(bm, faces=[face], thickness=inset, depth=0.0, use_even_offset=True)
    bmesh.ops.translate(bm, verts=list(face.verts), vec=-direction * depth)
    face.material_index = material_index
    for f in res["faces"]:
        f.material_index = 0
    bm.normal_update()
    return face


# ------------------------------------------------------------------- revolve / tubes
def revolve(profile, segments=96, axis="Y", material_indices=None, closed_profile=True):
    """Revolve a closed (r, a) profile about the local axis. r = radius, a = axial position.
    `material_indices[i]` is applied to the faces made from profile edge i -> i+1."""
    bm = bmesh.new()
    ring_verts = []
    for r, a in profile:
        ring = []
        if r < 1e-9:
            if axis == "Y":
                v = bm.verts.new((0.0, a, 0.0))
            elif axis == "X":
                v = bm.verts.new((a, 0.0, 0.0))
            else:
                v = bm.verts.new((0.0, 0.0, a))
            ring = [v] * segments
        else:
            for k in range(segments):
                th = 2 * math.pi * k / segments
                c, s = math.cos(th) * r, math.sin(th) * r
                if axis == "Y":
                    ring.append(bm.verts.new((c, a, s)))
                elif axis == "X":
                    ring.append(bm.verts.new((a, c, s)))
                else:
                    ring.append(bm.verts.new((c, s, a)))
        ring_verts.append(ring)
    npts = len(profile)
    for i in range(npts if closed_profile else npts - 1):
        j = (i + 1) % npts
        mi = material_indices[i] if material_indices else 0
        for k in range(segments):
            k2 = (k + 1) % segments
            vs = [ring_verts[i][k], ring_verts[i][k2], ring_verts[j][k2], ring_verts[j][k]]
            uniq = []
            for v in vs:
                if not uniq or uniq[-1] is not v:
                    uniq.append(v)
            if uniq[0] is uniq[-1]:
                uniq.pop()
            if len(set(uniq)) < 3:
                continue
            try:
                f = bm.faces.new(uniq)
                f.material_index = mi
            except ValueError:
                pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    if closed_profile:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def _frame(direction, up_hint=(0, 0, 1)):
    d = Vector(direction).normalized()
    up = Vector(up_hint)
    if abs(d.dot(up)) > 0.98:
        up = Vector((1, 0, 0))
    side = d.cross(up).normalized()
    up2 = side.cross(d).normalized()
    return d, side, up2


def strut(p0, p1, w0, h0, w1=None, h1=None, up=(0, 0, 1), count=16, cap=True, mid=None):
    """Tapered elliptical tube between two points. w = half-size along the side axis,
    h = half-size along the 'up' axis. Optional `mid` = (t, w, h) extra section."""
    p0, p1 = Vector(p0), Vector(p1)
    w1 = w0 if w1 is None else w1
    h1 = h0 if h1 is None else h1
    d, side, upv = _frame(p1 - p0, up)
    stops = [(0.0, w0, h0)]
    if mid:
        stops.append(mid)
    stops.append((1.0, w1, h1))
    rings = []
    for t, w, h in stops:
        c = p0.lerp(p1, t)
        ring = []
        for i in range(count):
            a = 2 * math.pi * i / count
            ring.append(c + side * (math.cos(a) * w) + upv * (math.sin(a) * h))
        rings.append(ring)
    return loft(rings, cap_start=cap, cap_end=cap)


def tube_path(points, radius, count=12, radius_fn=None, cap=True):
    """Round tube swept along a polyline (used for halo, pipes, rods)."""
    pts = [Vector(p) for p in points]
    rings = []
    prev_side = None
    for i, p in enumerate(pts):
        if i == 0:
            d = pts[1] - pts[0]
        elif i == len(pts) - 1:
            d = pts[-1] - pts[-2]
        else:
            d = (pts[i + 1] - pts[i - 1])
        d = d.normalized()
        up_hint = (0, 0, 1) if abs(d.z) < 0.95 else (1, 0, 0)
        d, side, upv = _frame(d, up_hint)
        r = radius_fn(i / (len(pts) - 1)) if radius_fn else radius
        ring = []
        for k in range(count):
            a = 2 * math.pi * k / count
            ring.append(p + side * (math.cos(a) * r) + upv * (math.sin(a) * r))
        rings.append(ring)
    return loft(rings, cap_start=cap, cap_end=cap)


def catmull(points, samples=8, closed=False):
    """Catmull-Rom spline through Vector points -> denser list of Vectors."""
    P = [Vector(p) for p in points]
    if not closed:
        P = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    out = []
    n = len(P)
    for i in range(1, n - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for s in range(samples):
            t = s / samples
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-2])
    return out


# ------------------------------------------------------------------- primitives
def box(center=(0, 0, 0), size=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = v.co.x * size[0] + center[0]
        v.co.y = v.co.y * size[1] + center[1]
        v.co.z = v.co.z * size[2] + center[2]
    return bm


def cylinder(p0, p1, radius, segments=32, radius1=None, cap=True):
    p0, p1 = Vector(p0), Vector(p1)
    d, side, upv = _frame(p1 - p0)
    r1 = radius if radius1 is None else radius1
    rings = []
    for c, r in ((p0, radius), (p1, r1)):
        rings.append([c + side * math.cos(2 * math.pi * i / segments) * r
                      + upv * math.sin(2 * math.pi * i / segments) * r for i in range(segments)])
    return loft(rings, cap_start=cap, cap_end=cap)


def ellipsoid(center, radii, u=32, v=16):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=1.0)
    for vert in bm.verts:
        vert.co.x = vert.co.x * radii[0] + center[0]
        vert.co.y = vert.co.y * radii[1] + center[1]
        vert.co.z = vert.co.z * radii[2] + center[2]
    return bm


def transform(bm, matrix):
    bmesh.ops.transform(bm, matrix=matrix, verts=bm.verts)
    return bm


def merge(*bms):
    """Join several bmeshes into the first one."""
    base = bms[0]
    for other in bms[1:]:
        me = bpy.data.meshes.new("_tmp_merge")
        other.to_mesh(me)
        other.free()
        base.from_mesh(me)
        bpy.data.meshes.remove(me)
    return base


# ------------------------------------------------------------------- flat plates
def plate(outline, thickness, plane="XZ", offset=0.0, subdivide=0, warp=None, material_index=0):
    """Extrude a 2-D outline into a thin plate.
    plane 'XZ' -> plate faces +/-Y at y=offset, thickness along Y.
    plane 'XY' -> plate faces +/-Z at z=offset, thickness along Z.
    `warp(v)` may bend the (already positioned) vertices, e.g. to curve an end-plate."""
    bm = bmesh.new()
    verts = []
    for a, b in outline:
        if plane == "XZ":
            verts.append(bm.verts.new((a, offset, b)))
        else:
            verts.append(bm.verts.new((a, b, offset)))
    face = bm.faces.new(verts)
    bmesh.ops.triangulate(bm, faces=[face])
    if subdivide:
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=subdivide, use_grid_fill=True)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
    if warp:
        for v in bm.verts:
            warp(v.co)
    bm.normal_update()
    res = bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=thickness)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.material_index = material_index
    return bm


def plate_between(x_start, x_end, bottom, top, thickness, y0, warp=None, nx=56, nz=16, material_index=0):
    """Quad-grid vertical plate spanning bottom(x)..top(x) between two x stations. Unlike
    `plate`, the mesh is a clean structured grid, so warped end-plates shade smoothly."""
    bm = bmesh.new()
    V = []
    for i in range(nx):
        u = 0.5 * (1 - math.cos(math.pi * i / (nx - 1)))
        x = x_start + (x_end - x_start) * u
        zb, zt = bottom(x), top(x)
        col = []
        for j in range(nz):
            t = j / (nz - 1)
            col.append(bm.verts.new(Vector((x, y0, zb + (zt - zb) * t))))
        V.append(col)
    for i in range(nx - 1):
        for j in range(nz - 1):
            bm.faces.new((V[i][j], V[i + 1][j], V[i + 1][j + 1], V[i][j + 1]))
    if warp:
        for v in bm.verts:
            warp(v.co)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=thickness)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.material_index = material_index
    return bm


def vertical_fence(path_xy, z0, heights, thickness=0.004):
    """Thin vertical vane following a 2-D path; `heights` is a per-point list."""
    pts = [Vector((x, y, 0)) for x, y in path_xy]
    bm = bmesh.new()
    left, right = [], []
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        nrm = Vector((-d.y, d.x, 0)) * thickness * 0.5
        left.append((p + nrm, heights[i]))
        right.append((p - nrm, heights[i]))
    bl = [bm.verts.new((p.x, p.y, z0)) for p, h in left]
    tl = [bm.verts.new((p.x, p.y, z0 + h)) for p, h in left]
    br = [bm.verts.new((p.x, p.y, z0)) for p, h in right]
    tr = [bm.verts.new((p.x, p.y, z0 + h)) for p, h in right]
    n = len(pts)
    for i in range(n - 1):
        bm.faces.new((bl[i], bl[i + 1], tl[i + 1], tl[i]))
        bm.faces.new((br[i + 1], br[i], tr[i], tr[i + 1]))
        bm.faces.new((tl[i], tl[i + 1], tr[i + 1], tr[i]))
        bm.faces.new((bl[i + 1], bl[i], br[i], br[i + 1]))
    bm.faces.new((bl[0], tl[0], tr[0], br[0]))
    bm.faces.new((bl[-1], br[-1], tr[-1], tl[-1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


# ------------------------------------------------------------------- aerofoils
def naca_profile(thickness=0.12, camber=0.04, camber_pos=0.4, points=28, te_thickness=0.004):
    """Closed aerofoil ring in chord units: list of (xc, zn). xc 0=LE .. 1=TE. Starts at the
    trailing edge, runs over the upper surface to the LE and back along the lower surface."""
    xs = [0.5 * (1 - math.cos(math.pi * i / points)) for i in range(points + 1)]
    def yt(x):
        return 5 * thickness * (0.2969 * math.sqrt(x) - 0.1260 * x - 0.3516 * x * x
                                + 0.2843 * x ** 3 - 0.1015 * x ** 4) + te_thickness * x
    def yc(x):
        m, p = camber, camber_pos
        if m == 0:
            return 0.0, 0.0
        if x < p:
            return m / p ** 2 * (2 * p * x - x * x), 2 * m / p ** 2 * (p - x)
        return (m / (1 - p) ** 2 * ((1 - 2 * p) + 2 * p * x - x * x),
                2 * m / (1 - p) ** 2 * (p - x))
    upper, lower = [], []
    for x in xs:
        c, dc = yc(x)
        th = math.atan(dc)
        t = yt(x)
        upper.append((x - t * math.sin(th), c + t * math.cos(th)))
        lower.append((x + t * math.sin(th), c - t * math.cos(th)))
    ring = upper[::-1] + lower[1:-1]
    return ring


def wing_element(stations, profile, invert=True, closed_ends=True):
    """Loft an aerofoil along the span.
    stations: list of dicts(y, x_le, z_le, chord, alpha_deg, thick=1.0)
    The chord runs toward -X (car forward = +X). Trailing edge pitched up by alpha.
    `invert` flips camber so the suction side faces the ground (downforce wing)."""
    rings = []
    for st in stations:
        a = math.radians(st["alpha"])
        chord = st["chord"]
        cd = Vector((-math.cos(a), 0.0, math.sin(a)))
        nd = Vector((math.sin(a), 0.0, math.cos(a)))
        le = Vector((st["x_le"], st["y"], st["z_le"]))
        th = st.get("thick", 1.0)
        ring = []
        for xc, zn in profile:
            zn = -zn if invert else zn
            ring.append(le + cd * (chord * xc) + nd * (chord * zn * th))
        rings.append(ring)
    return loft(rings, cap_start=closed_ends, cap_end=closed_ends)
