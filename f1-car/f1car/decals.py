"""Livery decals (team name, numbers, fictional sponsors).

Text is rasterised *inside Blender* to white-on-transparent masks (Workbench flat render of a
font curve), then projected in the body-paint shader from car-space coordinates. That keeps
graphics razor-sharp at 4K and lets one decal run across several separate body panels.
Edit DECALS to change what is printed where."""
import os
import tempfile

import bpy

from .config import LIVERY, hex_rgb

FONT_BOLD = ["C:/Windows/Fonts/ariblk.ttf", "C:/Windows/Fonts/arialbd.ttf"]
FONT_NUM = ["C:/Windows/Fonts/impact.ttf", "C:/Windows/Fonts/arialbd.ttf"]
FONT_TECH = ["C:/Windows/Fonts/bahnschrift.ttf", "C:/Windows/Fonts/arialbd.ttf"]

W, K, O = LIVERY.white, "#08090B", LIVERY.accent

# key, text, font, shear, plane, centre (x, z) or (x, y) for 'top', width (m),
# colour, sides ('both'|'left'|'right'), max |y| gate (min lateral position), rotation deg
DECALS = [
    dict(key="team_side", text="KESTREL", font=FONT_BOLD, shear=0.22, plane="side",
         center=(0.36, 0.345), width=0.60, color=W, ymin=0.30),
    dict(key="num_airbox", text="77", font=FONT_NUM, shear=0.10, plane="side",
         center=(-0.56, 0.755), width=0.17, color=W, ymin=0.09),
    dict(key="num_nose", text="77", font=FONT_NUM, shear=0.0, plane="top",
         center=(1.98, 0.0), width=0.15, color=K, ymin=0.0),
    dict(key="axiom_cover", text="AXIOM", font=FONT_TECH, shear=0.12, plane="side",
         center=(-1.14, 0.575), width=0.44, color=W, ymin=0.10),
    dict(key="voltrix_pod", text="VOLTRIX", font=FONT_BOLD, shear=0.20, plane="side",
         center=(-1.02, 0.25), width=0.50, color=W, ymin=0.16),
    dict(key="helix_nose", text="HELIX", font=FONT_TECH, shear=0.10, plane="side",
         center=(1.66, 0.28), width=0.26, color=W, ymin=0.05),
    dict(key="team_rw", text="KESTREL", font=FONT_BOLD, shear=0.20, plane="side",
         center=(-2.63, 0.84), width=0.36, color=W, ymin=0.44),
    dict(key="team_fw", text="KESTREL", font=FONT_BOLD, shear=0.20, plane="side",
         center=(2.44, 0.155), width=0.25, color=W, ymin=0.90),
    dict(key="num_rw", text="77", font=FONT_NUM, shear=0.0, plane="side",
         center=(-2.66, 0.68), width=0.10, color=O, ymin=0.44),
]


def _font(paths):
    for p in paths:
        if os.path.exists(p):
            try:
                return bpy.data.fonts.load(p, check_existing=True)
            except Exception:
                continue
    return None


def _text_bounds(text, font, shear):
    scene = bpy.context.scene
    cu = bpy.data.curves.new("_probe", "FONT")
    cu.body, cu.size, cu.shear = text, 1.0, shear
    cu.align_x, cu.align_y = "CENTER", "CENTER"
    if font:
        cu.font = font
    ob = bpy.data.objects.new("_probe", cu)
    scene.collection.objects.link(ob)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    bounds = (min(xs), max(xs), min(ys), max(ys))
    bpy.data.objects.remove(ob)
    bpy.data.curves.remove(cu)
    bpy.data.meshes.remove(me)
    return bounds


def make_mask(spec, px_w=2048):
    """Render one text mask; returns (image, aspect = height/width)."""
    font = _font(spec["font"])
    x0, x1, y0, y1 = _text_bounds(spec["text"], font, spec["shear"])
    tw, th = x1 - x0, y1 - y0
    pad = 0.04
    span_w, span_h = tw * (1 + 2 * pad), th * (1 + 2 * pad)
    px_h = max(64, int(px_w * span_h / span_w))
    scene = bpy.data.scenes.new("_decal_" + spec["key"])
    cu = bpy.data.curves.new("_txt_" + spec["key"], "FONT")
    cu.body, cu.size, cu.shear = spec["text"], 1.0, spec["shear"]
    cu.align_x, cu.align_y = "CENTER", "CENTER"
    if font:
        cu.font = font
    tob = bpy.data.objects.new("_txt_" + spec["key"], cu)
    tob.location = (-(x0 + x1) / 2, -(y0 + y1) / 2, 0)
    scene.collection.objects.link(tob)
    cam_d = bpy.data.cameras.new("_cam")
    cam_d.type = "ORTHO"
    cam_d.ortho_scale = max(span_w, span_h)
    cam = bpy.data.objects.new("_cam", cam_d)
    cam.location = (0, 0, 5)
    scene.collection.objects.link(cam)
    scene.camera = cam
    r = scene.render
    r.engine = "BLENDER_WORKBENCH"
    r.resolution_x, r.resolution_y = px_w, px_h
    r.resolution_percentage = 100
    r.film_transparent = True
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGBA"
    scene.display.shading.light = "FLAT"
    scene.display.shading.color_type = "SINGLE"
    scene.display.shading.single_color = (1.0, 1.0, 1.0)
    scene.display.render_aa = "8"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    path = os.path.join(tempfile.gettempdir(), "f1car_decal_%s.png" % spec["key"])
    r.filepath = path
    bpy.ops.render.render(write_still=True, scene=scene.name)
    img = bpy.data.images.load(path)
    img.name = "Decal_" + spec["key"]
    img.alpha_mode = "STRAIGHT"
    img.pack()
    os.remove(path)
    bpy.data.scenes.remove(scene)
    bpy.data.objects.remove(tob)
    bpy.data.objects.remove(cam)
    bpy.data.curves.remove(cu)
    bpy.data.cameras.remove(cam_d)
    aspect = px_h / px_w
    return img, aspect


def build_images(specs=None):
    """Returns list of dicts: spec + image + aspect."""
    out = []
    for spec in (specs or DECALS):
        img, aspect = make_mask(spec)
        d = dict(spec)
        d["image"], d["aspect"] = img, aspect
        out.append(d)
    return out


def apply(nb, pos, nrm, col, decals):
    """Composite all decals over `col`. Returns (colour, combined_mask)."""
    x, y, z = nb.sep(pos)
    nx, ny, nz = nb.sep(nrm)
    sgn = nb.math("SIGN", y)
    ay = nb.math("ABSOLUTE", y)
    total = None
    for d in decals:
        w = d["width"]
        h = w * d["aspect"]
        cx, cy = d["center"]
        if d["plane"] == "side":
            # u runs toward the rear on the left flank, toward the nose on the right
            u = nb.math("ADD", nb.math("MULTIPLY", nb.math("MULTIPLY", nb.math("SUBTRACT", x, cx), sgn), -1.0 / w), 0.5)
            v = nb.math("ADD", nb.math("MULTIPLY", nb.math("SUBTRACT", z, cy), 1.0 / h), 0.5)
            out_n = nb.math("MULTIPLY", ny, sgn)
            gate = nb.math("MULTIPLY", nb.smooth(out_n, 0.12, 0.38), nb.smooth(ay, d["ymin"] - 0.01, d["ymin"]))
        else:
            u = nb.math("ADD", nb.math("MULTIPLY", nb.math("SUBTRACT", y, cy), -1.0 / w), 0.5)
            v = nb.math("ADD", nb.math("MULTIPLY", nb.math("SUBTRACT", x, cx), 1.0 / h), 0.5)
            gate = nb.smooth(nz, 0.15, 0.4)
        vec = nb.comb(u, v, 0.0)
        tex = nb.add("ShaderNodeTexImage", extension="CLIP", interpolation="Cubic")
        tex.image = d["image"]
        nb.l.new(vec, tex.inputs["Vector"])
        m = nb.math("MULTIPLY", tex.outputs["Alpha"], gate)
        col = nb.mixc(m, col, hex_rgb(d["color"]))
        total = m if total is None else nb.math("MAXIMUM", total, m)
    return col, total
