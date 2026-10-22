"""Physically based material library. Every material is a small builder function keyed by
name; parts ask the library for keys (`ctx.mat("carbon_gloss")`) so a re-skin only touches
this file or config.LIVERY."""
import math

import bpy

from . import decals as decal_lib
from .config import LIVERY, hex_rgb

# Blender 3.x -> 4.x Principled BSDF socket renames
_P4 = {
    "Specular": "Specular IOR Level", "Clearcoat": "Coat Weight",
    "Clearcoat Roughness": "Coat Roughness", "Emission": "Emission Color",
    "Transmission": "Transmission Weight", "Sheen": "Sheen Weight",
}


class NB:
    """Tiny node-builder that keeps material code short."""

    def __init__(self, mat):
        mat.use_nodes = True
        self.t = mat.node_tree
        self.t.nodes.clear()
        self.n, self.l = self.t.nodes, self.t.links
        self.mat = mat
        self._y = 0

    def add(self, idname, **props):
        node = self.n.new(idname)
        self._y -= 60
        node.location = (-600 + (len(self.n) % 9) * 190, self._y % 900)
        for k, v in props.items():
            setattr(node, k, v)
        return node

    def put(self, node, key, value):
        try:
            sock = node.inputs[key]
        except KeyError:
            sock = node.inputs[_P4[key]]
        if isinstance(value, bpy.types.NodeSocket):
            self.l.new(value, sock)
        else:
            sock.default_value = value

    # -- math
    def math(self, op, a, b=None, c=None, clamp=False):
        node = self.add("ShaderNodeMath", operation=op, use_clamp=clamp)
        self.put(node, 0, a)
        if b is not None:
            self.put(node, 1, b)
        if c is not None:
            self.put(node, 2, c)
        return node.outputs[0]

    def mad(self, a, mul, add):
        return self.math("ADD", self.math("MULTIPLY", a, mul), add)

    def smooth(self, v, e0, e1):
        node = self.add("ShaderNodeMapRange", interpolation_type="SMOOTHSTEP", clamp=True)
        self.put(node, 0, v)
        self.put(node, 1, e0)
        self.put(node, 2, e1)
        return node.outputs[0]

    def sep(self, vec):
        node = self.add("ShaderNodeSeparateXYZ")
        self.l.new(vec, node.inputs[0])
        return node.outputs[0], node.outputs[1], node.outputs[2]

    def comb(self, x, y, z):
        node = self.add("ShaderNodeCombineXYZ")
        for i, v in enumerate((x, y, z)):
            self.put(node, i, v)
        return node.outputs[0]

    def vmath(self, op, a, b=None):
        node = self.add("ShaderNodeVectorMath", operation=op)
        self.put(node, 0, a)
        if b is not None:
            self.put(node, 1, b)
        return node.outputs[0]

    def dot(self, a, b):
        node = self.add("ShaderNodeVectorMath", operation="DOT_PRODUCT")
        self.put(node, 0, a)
        self.put(node, 1, b)
        return node.outputs["Value"]

    def mixc(self, fac, a, b, blend="MIX"):
        node = self.add("ShaderNodeMixRGB", blend_type=blend)
        self.put(node, "Fac", fac)
        self.put(node, "Color1", a)
        self.put(node, "Color2", b)
        return node.outputs[0]

    def noise(self, vec, scale, detail=2.0, rough=0.5):
        node = self.add("ShaderNodeTexNoise")
        self.l.new(vec, node.inputs["Vector"])
        node.inputs["Scale"].default_value = scale
        node.inputs["Detail"].default_value = detail
        node.inputs["Roughness"].default_value = rough
        return node.outputs["Fac"]

    def voronoi(self, vec, scale, feature="F1"):
        node = self.add("ShaderNodeTexVoronoi", feature=feature)
        self.l.new(vec, node.inputs["Vector"])
        node.inputs["Scale"].default_value = scale
        return node.outputs["Distance"]

    def ramp(self, fac, stops):
        node = self.add("ShaderNodeValToRGB")
        el = node.color_ramp.elements
        while len(el) > 2:
            el.remove(el[-1])
        el[0].position, el[0].color = stops[0]
        el[1].position, el[1].color = stops[1]
        for pos, col in stops[2:]:
            e = el.new(pos)
            e.color = col
        self.l.new(fac, node.inputs["Fac"])
        return node.outputs["Color"]

    def bump(self, height, strength=0.3, distance=0.001, normal=None):
        node = self.add("ShaderNodeBump")
        self.put(node, "Strength", strength)
        self.put(node, "Distance", distance)
        self.l.new(height, node.inputs["Height"])
        if normal is not None:
            self.l.new(normal, node.inputs["Normal"])
        return node.outputs["Normal"]

    def principled(self, **kw):
        node = self.add("ShaderNodeBsdfPrincipled")
        for k, v in kw.items():
            self.put(node, k.replace("_", " ").title().replace("Ior", "IOR"), v)
        return node

    def output(self, shader):
        out = self.add("ShaderNodeOutputMaterial")
        self.l.new(shader, out.inputs["Surface"])
        return out


def rgba(h, a=1.0):
    return hex_rgb(h, a)


def crevice(nb, distance=0.07):
    """1.0 deep in crevices / at panel joins, 0.0 on open surfaces (dirt + wear mask)."""
    ao = nb.add("ShaderNodeAmbientOcclusion", inside=False, samples=6)
    ao.inputs["Distance"].default_value = distance
    return nb.math("SUBTRACT", 1.0, ao.outputs["AO"])


def smudges(nb, vec, amount=0.05):
    """Faint wipe marks / polish streaks that only show as breaks in soft reflections."""
    mp = nb.add("ShaderNodeMapping")
    nb.l.new(vec, mp.inputs["Vector"])
    mp.inputs["Scale"].default_value = (1.3, 11.0, 11.0)
    n = nb.noise(mp.outputs["Vector"], 2.2, 4.0, 0.55)
    return nb.math("MULTIPLY", nb.smooth(n, 0.50, 0.78), amount)


# ------------------------------------------------------------ carbon-fibre twill weave
def _weave(nb, u, v):
    """2x2 twill: returns (height, tone) sockets for planar coords u, v (already scaled)."""
    iu = nb.math("FLOOR", u)
    iv = nb.math("FLOOR", v)
    fu = nb.math("FRACT", u)
    fv = nb.math("FRACT", v)
    k = nb.math("MODULO", nb.math("ADD", nb.math("ADD", iu, iv), 4000.0), 4.0)
    warp_top = nb.math("LESS_THAN", k, 2.0)
    prof_v = nb.math("POWER", nb.math("SINE", nb.math("MULTIPLY", fv, math.pi)), 0.55)
    prof_u = nb.math("POWER", nb.math("SINE", nb.math("MULTIPLY", fu, math.pi)), 0.55)
    weft_top = nb.math("SUBTRACT", 1.0, warp_top)
    h = nb.math("ADD", nb.math("MULTIPLY", prof_v, warp_top), nb.math("MULTIPLY", prof_u, weft_top))
    tone = nb.math("ADD", nb.math("MULTIPLY", warp_top, 0.30), 0.70)
    tone = nb.math("MULTIPLY", tone, nb.mad(h, 0.5, 0.5))
    return h, tone


def carbon_weave(nb, scale=210.0):
    """Tri-planar carbon twill on object coordinates, fading with camera distance so it
    reads up close but never moires on the full-car shots. Returns (height, tone, fade)."""
    tc = nb.add("ShaderNodeTexCoord")
    obj, nrm = tc.outputs["Object"], tc.outputs["Normal"]
    x, y, z = nb.sep(obj)
    nx, ny, nz = nb.sep(nrm)
    wx = nb.math("POWER", nb.math("ABSOLUTE", nx), 6.0)
    wy = nb.math("POWER", nb.math("ABSOLUTE", ny), 6.0)
    wz = nb.math("POWER", nb.math("ABSOLUTE", nz), 6.0)
    tot = nb.math("ADD", nb.math("ADD", wx, wy), nb.math("ADD", wz, 1e-5))
    wx, wy, wz = (nb.math("DIVIDE", w, tot) for w in (wx, wy, wz))
    s = scale
    # rotate 45 degrees inside each projection so the twill runs diagonally
    def plane(a, b):
        p = nb.math("MULTIPLY", nb.math("ADD", a, b), s * 0.7071)
        q = nb.math("MULTIPLY", nb.math("SUBTRACT", a, b), s * 0.7071)
        return _weave(nb, p, q)
    hyz, tyz = plane(y, z)
    hxz, txz = plane(x, z)
    hxy, txy = plane(x, y)
    h = nb.math("ADD", nb.math("ADD", nb.math("MULTIPLY", hyz, wx), nb.math("MULTIPLY", hxz, wy)),
                nb.math("MULTIPLY", hxy, wz))
    t = nb.math("ADD", nb.math("ADD", nb.math("MULTIPLY", tyz, wx), nb.math("MULTIPLY", txz, wy)),
                nb.math("MULTIPLY", txy, wz))
    cam = nb.add("ShaderNodeCameraData")
    dist = cam.outputs["View Distance"]
    fade = nb.math("SUBTRACT", 1.0, nb.smooth(dist, 2.0, 11.0))
    return h, t, fade


def m_carbon(name, matte=False, dark=1.0):
    mat = bpy.data.materials.new(name)
    nb = NB(mat)
    h, tone, fade = carbon_weave(nb)
    contrast = nb.math("MULTIPLY", fade, 0.75)
    tone_f = nb.mixc(contrast, (1, 1, 1, 1), nb.ramp(tone, [(0.0, (0.35,) * 3 + (1,)), (1.0, (1.0,) * 4)]))
    base = nb.mixc(1.0, (1, 1, 1, 1), tone_f, blend="MULTIPLY")
    col = nb.mixc(1.0, (0.030 * dark, 0.030 * dark, 0.033 * dark, 1), base, blend="MULTIPLY")
    nrm = nb.bump(h, strength=nb.math("MULTIPLY", fade, 0.55), distance=0.0006)
    # tiny large-scale roughness drift = hand-laid, slightly imperfect surface
    tc = nb.add("ShaderNodeTexCoord")
    drift = nb.noise(tc.outputs["Object"], 6.0, 3.0, 0.6)
    crev = crevice(nb)
    smud = smudges(nb, tc.outputs["Object"], 0.05)
    p = nb.principled(
        base_color=col, metallic=0.0,
        roughness=nb.math("ADD", nb.mad(drift, 0.10, 0.22 if not matte else 0.52), nb.math("MULTIPLY", crev, 0.2)),
        specular=0.22 if matte else 0.5,
        clearcoat=0.0 if matte else 1.0,
        clearcoat_roughness=nb.math("ADD", smud, 0.022),
    )
    nb.put(p, "Normal", nrm)
    nb.output(p.outputs[0])
    return mat


# ------------------------------------------------------------ livery body paint
def m_body_paint(name, root, decals=()):
    mat = bpy.data.materials.new(name)
    nb = NB(mat)
    tc = nb.add("ShaderNodeTexCoord", object=root)
    pos = tc.outputs["Object"]
    x, y, z = nb.sep(pos)
    u = nb.math("SUBTRACT", x, nb.math("MULTIPLY", z, 0.85))     # lines lean forward

    def band(lo, hi, soft=0.0035):
        a = nb.smooth(u, lo - soft, lo + soft)
        b = nb.math("SUBTRACT", 1.0, nb.smooth(u, hi - soft, hi + soft))
        return nb.math("MULTIPLY", a, b)

    fres = nb.add("ShaderNodeLayerWeight")
    fres.inputs["Blend"].default_value = 0.6
    pearl = nb.mixc(fres.outputs["Facing"], rgba(LIVERY.base_edge), rgba(LIVERY.base))
    col = pearl
    orange = rgba(LIVERY.accent)
    white = rgba(LIVERY.white)
    deep = rgba(LIVERY.accent_deep)
    # main sash + white keyline + shadow-side deep tone
    sash = band(-1.12, -0.55)
    tone = nb.mixc(nb.smooth(u, -1.12, -0.55), deep, orange)
    col = nb.mixc(sash, col, tone)
    col = nb.mixc(band(-1.20, -1.165), col, white)
    col = nb.mixc(band(-0.515, -0.500), col, white)
    # rear slash
    col = nb.mixc(band(-1.72, -1.62), col, orange)
    # nose cone
    nose = nb.smooth(u, 1.66, 1.68)
    col = nb.mixc(nose, col, orange)
    col = nb.mixc(band(1.60, 1.625), col, white)
    # printed decals (team name, numbers, sponsors)
    dmask = None
    if decals:
        col, dmask = decal_lib.apply(nb, pos, tc.outputs["Normal"], col, decals)
    # metallic flake
    flake = nb.voronoi(pos, 1400.0)
    fl = nb.smooth(flake, 0.25, 0.05)
    col = nb.mixc(nb.math("MULTIPLY", fl, 0.35), col, (0.55, 0.6, 0.75, 1), blend="ADD")
    # metallic only in dark base; solid vinyl-like orange/white stay dielectric
    paint_mask = nb.math("MAXIMUM", sash, nose)
    if dmask is not None:
        paint_mask = nb.math("MAXIMUM", paint_mask, dmask)
    metal = nb.math("MULTIPLY", nb.math("SUBTRACT", 1.0, paint_mask), 0.55)
    peel = nb.noise(pos, 380.0, 1.0, 0.5)
    nrm = nb.bump(nb.math("ADD", nb.math("MULTIPLY", flake, 0.4), nb.math("MULTIPLY", peel, 0.6)),
                  strength=0.10, distance=0.0004)
    crev = crevice(nb, 0.06)
    col = nb.mixc(nb.math("MULTIPLY", crev, 0.55), col, (0.012, 0.012, 0.013, 1))
    smud = smudges(nb, pos, 0.05)
    p = nb.principled(base_color=col, metallic=metal, roughness=nb.math("ADD", 0.20, nb.math("MULTIPLY", crev, 0.18)),
                      specular=0.5, clearcoat=1.0, clearcoat_roughness=nb.math("ADD", smud, 0.014))
    nb.put(p, "Normal", nrm)
    nb.output(p.outputs[0])
    return mat


def m_solid(name, hexcol, rough=0.22, metal=0.0, coat=1.0, coat_rough=0.02, flake=False):
    mat = bpy.data.materials.new(name)
    nb = NB(mat)
    tc = nb.add("ShaderNodeTexCoord")
    peel = nb.noise(tc.outputs["Object"], 380.0, 1.0, 0.5)
    nrm = nb.bump(peel, strength=0.08, distance=0.0004)
    p = nb.principled(base_color=rgba(hexcol), metallic=metal, roughness=rough,
                      specular=0.5, clearcoat=coat, clearcoat_roughness=coat_rough)
    nb.put(p, "Normal", nrm)
    nb.output(p.outputs[0])
    return mat


def m_metal(name, hexcol, rough=0.30, metal=1.0, aniso=0.0, brushed=True, scale=90.0):
    mat = bpy.data.materials.new(name)
    nb = NB(mat)
    tc = nb.add("ShaderNodeTexCoord")
    obj = tc.outputs["Object"]
    mapping = nb.add("ShaderNodeMapping")
    nb.l.new(obj, mapping.inputs["Vector"])
    mapping.inputs["Scale"].default_value = (1.0, 220.0, 220.0) if brushed else (1, 1, 1)
    fine = nb.noise(mapping.outputs["Vector"], scale, 4.0, 0.7)
    blot = nb.noise(obj, 5.0, 3.0, 0.6)
    nrm = nb.bump(fine, strength=0.08 if brushed else 0.02, distance=0.0003)
    p = nb.principled(base_color=rgba(hexcol), metallic=metal,
                      roughness=nb.mad(blot, 0.12, rough - 0.05), specular=0.5, anisotropic=aniso)
    nb.put(p, "Normal", nrm)
    nb.output(p.outputs[0])
    return mat


def m_rubber(name, sidewall=False):
    mat = bpy.data.materials.new(name)
    nb = NB(mat)
    tc = nb.add("ShaderNodeTexCoord")
    obj = tc.outputs["Object"]
    micro = nb.noise(obj, 700.0, 2.0, 0.6)
    wear = nb.noise(obj, 9.0, 4.0, 0.55)
    nrm = nb.bump(micro, strength=0.12, distance=0.0006)
    base = nb.mixc(nb.smooth(wear, 0.40, 0.80), (0.010, 0.010, 0.011, 1), (0.026, 0.025, 0.024, 1))
    rough = nb.mad(wear, 0.20, 0.70 if not sidewall else 0.78)
    p = nb.principled(base_color=base, metallic=0.0, roughness=rough, specular=0.32, sheen=0.05)
    nb.put(p, "Normal", nrm)
    nb.output(p.outputs[0])
    return mat


def m_matte(name, hexcol, rough=0.75, sheen=0.0, alpha=1.0):
    mat = bpy.data.materials.new(name)
    nb = NB(mat)
    tc = nb.add("ShaderNodeTexCoord")
    grain = nb.noise(tc.outputs["Object"], 500.0, 1.0, 0.5)
    nrm = nb.bump(grain, strength=0.15, distance=0.0005)
    p = nb.principled(base_color=rgba(hexcol, alpha), roughness=rough, specular=0.3, sheen=sheen)
    nb.put(p, "Normal", nrm)
    nb.output(p.outputs[0])
    return mat


def m_emissive(name, hexcol, strength=6.0):
    mat = bpy.data.materials.new(name)
    nb = NB(mat)
    em = nb.add("ShaderNodeEmission")
    em.inputs["Color"].default_value = rgba(hexcol)
    em.inputs["Strength"].default_value = strength
    nb.output(em.outputs[0])
    return mat


def m_glass_visor(name):
    mat = bpy.data.materials.new(name)
    nb = NB(mat)
    p = nb.principled(base_color=(0.008, 0.008, 0.010, 1), metallic=0.9, roughness=0.03,
                      specular=0.6, clearcoat=1.0, clearcoat_roughness=0.0)
    nb.output(p.outputs[0])
    return mat


def m_mirror(name):
    mat = bpy.data.materials.new(name)
    nb = NB(mat)
    p = nb.principled(base_color=(0.82, 0.84, 0.88, 1), metallic=1.0, roughness=0.015)
    nb.output(p.outputs[0])
    return mat


def m_inconel(name):
    """Exhaust: brushed nickel alloy with a heat-tint gradient along the pipe."""
    mat = bpy.data.materials.new(name)
    nb = NB(mat)
    tc = nb.add("ShaderNodeTexCoord")
    gen = tc.outputs["Object"]
    x, y, z = nb.sep(gen)
    # heat tint: silver -> straw -> violet -> blue toward the tail (x negative)
    t = nb.smooth(x, -2.42, -2.62)
    tint = nb.ramp(t, [(0.0, (0.55, 0.55, 0.57, 1)), (0.35, (0.62, 0.48, 0.20, 1)),
                       (0.7, (0.30, 0.14, 0.34, 1)), (1.0, (0.06, 0.10, 0.34, 1))])
    n = nb.noise(gen, 40.0, 3.0, 0.6)
    p = nb.principled(base_color=tint, metallic=1.0, roughness=nb.mad(n, 0.25, 0.28), specular=0.5)
    nb.output(p.outputs[0])
    return mat


def m_fabric(name, hexcol):
    mat = bpy.data.materials.new(name)
    nb = NB(mat)
    tc = nb.add("ShaderNodeTexCoord")
    wave = nb.add("ShaderNodeTexBrick")
    nb.l.new(tc.outputs["Object"], wave.inputs["Vector"])
    wave.inputs["Scale"].default_value = 260.0
    wave.inputs["Mortar Size"].default_value = 0.05
    nrm = nb.bump(wave.outputs["Fac"], strength=0.4, distance=0.0008)
    p = nb.principled(base_color=rgba(hexcol), roughness=0.9, sheen=0.6, specular=0.15)
    nb.put(p, "Normal", nrm)
    nb.output(p.outputs[0])
    return mat


def m_helmet(name, root):
    mat = bpy.data.materials.new(name)
    nb = NB(mat)
    tc = nb.add("ShaderNodeTexCoord")
    pos = tc.outputs["Object"]
    x, y, z = nb.sep(pos)
    # diagonal orange flash + thin dark line, world-Z gradient through top
    u = nb.math("ADD", nb.math("MULTIPLY", z, 1.2), nb.math("MULTIPLY", x, 0.9))
    orange = nb.smooth(nb.math("ABSOLUTE", nb.math("SUBTRACT", u, 0.06)), 0.10, 0.09)
    col = nb.mixc(orange, rgba(LIVERY.helmet_base), rgba(LIVERY.accent))
    top = nb.smooth(nb.math("ABSOLUTE", y), 0.020, 0.016)
    col = nb.mixc(nb.math("MULTIPLY", top, nb.smooth(z, 0.0, 0.08)), col, (0.01, 0.01, 0.012, 1))
    p = nb.principled(base_color=col, roughness=0.14, clearcoat=1.0, clearcoat_roughness=0.02)
    nb.output(p.outputs[0])
    return mat


def m_display(name):
    mat = bpy.data.materials.new(name)
    nb = NB(mat)
    tc = nb.add("ShaderNodeTexCoord")
    x, y, z = nb.sep(tc.outputs["UV"])
    seg = nb.math("GREATER_THAN", nb.math("SINE", nb.math("MULTIPLY", x, 60.0)), -0.2)
    bar = nb.smooth(nb.math("ABSOLUTE", nb.math("SUBTRACT", y, 0.75)), 0.10, 0.06)
    lit = nb.math("MULTIPLY", seg, bar)
    col = nb.mixc(lit, (0.01, 0.015, 0.02, 1), (0.10, 0.9, 0.35, 1))
    col = nb.mixc(nb.smooth(y, 0.30, 0.28), col, (1.0, 0.35, 0.05, 1))
    em = nb.add("ShaderNodeEmission")
    nb.l.new(col, em.inputs["Color"])
    em.inputs["Strength"].default_value = 3.5
    nb.output(em.outputs[0])
    return mat


def m_brake_disc(name):
    mat = bpy.data.materials.new(name)
    nb = NB(mat)
    tc = nb.add("ShaderNodeTexCoord")
    x, y, z = nb.sep(tc.outputs["Object"])
    r = nb.math("SQRT", nb.math("ADD", nb.math("MULTIPLY", x, x), nb.math("MULTIPLY", z, z)))
    rings = nb.math("SINE", nb.math("MULTIPLY", r, 900.0))
    nrm = nb.bump(rings, strength=0.15, distance=0.0003)
    heat = nb.smooth(r, 0.10, 0.14)
    col = nb.mixc(heat, (0.045, 0.043, 0.042, 1), (0.10, 0.06, 0.05, 1))
    p = nb.principled(base_color=col, metallic=0.55, roughness=0.42, anisotropic=0.6)
    nb.put(p, "Normal", nrm)
    nb.output(p.outputs[0])
    return mat


def m_studio_floor(name):
    mat = bpy.data.materials.new(name)
    nb = NB(mat)
    tc = nb.add("ShaderNodeTexCoord")
    pos = tc.outputs["Object"]
    x, y, z = nb.sep(pos)
    rad = nb.math("SQRT", nb.math("ADD", nb.math("MULTIPLY", x, x), nb.math("MULTIPLY", y, y)))
    mott = nb.noise(pos, 0.7, 5.0, 0.6)
    fine = nb.noise(pos, 60.0, 4.0, 0.6)
    nrm = nb.bump(fine, strength=0.04, distance=0.002)
    # glossy resin floor that becomes a rougher, lighter cyclorama wall up the fillet
    wall = nb.smooth(z, 0.4, 7.0)
    rough = nb.math("ADD", nb.mad(mott, 0.08, 0.13), nb.math("MULTIPLY", wall, 0.40))
    fall = nb.smooth(rad, 4.0, 22.0)
    base = nb.mixc(fall, (0.016, 0.017, 0.019, 1), (0.004, 0.0045, 0.005, 1))
    base = nb.mixc(wall, base, (0.014, 0.0145, 0.016, 1))
    keep = nb.math("SUBTRACT", 1.0, nb.math("MULTIPLY", nb.smooth(rad, 2.5, 13.0), 0.72))
    # near top-down views: the polished floor stops mirroring the softboxes
    geom = nb.add("ShaderNodeNewGeometry")
    elev = nb.math("ABSOLUTE", nb.dot(geom.outputs["Incoming"], geom.outputs["Normal"]))
    keep = nb.math("MULTIPLY", keep, nb.math("SUBTRACT", 1.0, nb.math("MULTIPLY", nb.smooth(elev, 0.52, 0.90), 0.94)))
    p = nb.principled(base_color=base, roughness=rough,
                      specular=nb.math("MULTIPLY", keep, 0.36), metallic=0.0,
                      clearcoat=nb.math("MULTIPLY", nb.math("MULTIPLY", nb.math("SUBTRACT", 1.0, wall), 0.55), keep),
                      clearcoat_roughness=0.10)
    nb.put(p, "Normal", nrm)
    nb.output(p.outputs[0])
    return mat


# ------------------------------------------------------------------ registry
class MaterialLibrary:
    def __init__(self, root):
        self.root = root
        self.decals = []
        self._cache = {}
        c = LIVERY
        self._makers = {
            "carbon_gloss": lambda: m_carbon("Carbon_Gloss"),
            "carbon_matte": lambda: m_carbon("Carbon_Matte", matte=True),
            "carbon_dark": lambda: m_carbon("Carbon_Underside", matte=True, dark=0.6),
            "body": lambda: m_body_paint("Body_Livery", self.root, self.decals),
            "accent": lambda: m_solid("Paint_Ember", c.accent),
            "white": lambda: m_solid("Paint_Bone", c.white, rough=0.25),
            "black_gloss": lambda: m_solid("Paint_PianoBlack", "#040405", rough=0.12),
            "titanium": lambda: m_metal("Titanium", "#6D6F73", rough=0.34, aniso=0.5),
            "steel": lambda: m_metal("Steel", "#B8BBC0", rough=0.26),
            "steel_dark": lambda: m_metal("Steel_Dark", "#2A2C30", rough=0.35),
            "alu_anodised": lambda: m_metal("Alu_Anodised", "#3A3D44", rough=0.38, brushed=False),
            "alu_raw": lambda: m_metal("Alu_Raw", "#C9CBCE", rough=0.22),
            "gold": lambda: m_metal("Caliper_Gold", c.caliper, rough=0.28, brushed=False),
            "caliper": lambda: m_solid("Caliper_Paint", c.caliper, rough=0.28, metal=0.5),
            "wheel_forged": lambda: m_metal("Wheel_Forged", "#1B1B1E", rough=0.30, brushed=False),
            "brake_disc": lambda: m_brake_disc("Brake_Disc"),
            "tyre_tread": lambda: m_rubber("Tyre_Tread"),
            "tyre_side": lambda: m_rubber("Tyre_Sidewall", sidewall=True),
            "tyre_band": lambda: m_matte("Tyre_Band", c.tyre_band, rough=0.55),
            "tyre_text": lambda: m_matte("Tyre_Text", "#F0F0F0", rough=0.6),
            "inconel": lambda: m_inconel("Exhaust_Inconel"),
            "fabric": lambda: m_fabric("Seat_Fabric", "#0C0C0E"),
            "foam": lambda: m_fabric("Padding_Foam", "#16161A"),
            "foam_red": lambda: m_fabric("Padding_Accent", "#7A1508"),
            "visor": lambda: m_glass_visor("Helmet_Visor"),
            "helmet": lambda: m_helmet("Helmet_Paint", self.root),
            "display": lambda: m_display("Steering_Display"),
            "mirror": lambda: m_mirror("Mirror_Glass"),
            "led_red": lambda: m_emissive("LED_Red", "#FF1010", 14.0),
            "led_green": lambda: m_emissive("LED_Green", "#20FF60", 6.0),
            "led_blue": lambda: m_emissive("LED_Blue", "#3070FF", 6.0),
            "rubber": lambda: m_matte("Rubber_Black", "#0B0B0C", rough=0.7),
            "intake_dark": lambda: m_matte("Intake_Dark", "#020203", rough=0.9),
            "decal_white": lambda: m_matte("Decal_White", c.white, rough=0.4),
            "decal_orange": lambda: m_matte("Decal_Orange", c.accent, rough=0.4),
            "lens": lambda: m_glass_visor("Camera_Lens"),
            "studio_floor": lambda: m_studio_floor("Studio_Floor"),
        }

    def get(self, key):
        if key not in self._cache:
            self._cache[key] = self._makers[key]()
        return self._cache[key]

    def keys(self):
        return list(self._makers)
