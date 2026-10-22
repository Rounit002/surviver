"""Photo studio: curved cyclorama, polished floor, softbox rig and camera presets."""
import math

import bpy
from mathutils import Vector

from .config import CAMERAS, DEFAULT_CAMERA, STUDIO, hex_rgb
from .utils import geo


def build_cyclorama(ctx):
    """One revolved shell: polished floor -> large fillet -> tall wall (open ceiling).
    Open profile, so the wall is single-sided; normals face the car."""
    S = STUDIO
    r0 = S.wall_radius - S.fillet
    n = 20
    prof = [(0.0, 0.0), (r0, 0.0)]
    for i in range(1, n + 1):
        a = (math.pi / 2) * i / n
        prof.append((r0 + S.fillet * math.sin(a), S.fillet - S.fillet * math.cos(a)))
    prof.append((S.wall_radius, S.wall_height))
    bm = geo.revolve(prof, segments=160, axis="Z", closed_profile=False)
    # face normals inward/up (toward the car)
    for f in bm.faces:
        c = f.calc_center_median()
        if f.normal.dot(-c.to_2d().to_3d() + Vector((0, 0, 1)) * 0.1) < 0 and c.z > 0.5:
            pass
    ob = ctx.add_bm("Studio", "Studio_Cyclorama", bm, ["studio_floor"], parent=ctx.scene_root)
    return ob


def build_lights(ctx):
    lights = {}
    for spec in STUDIO.lights:
        data = bpy.data.lights.new(spec["name"], "AREA")
        data.shape = "RECTANGLE"
        data.size, data.size_y = spec["size"]
        data.energy = spec["power"]
        data.color = hex_rgb(spec["color"])[:3]
        data.spread = math.radians(spec.get("spread", 150))
        ob = bpy.data.objects.new(spec["name"], data)
        ctx.part_collection("Studio").objects.link(ob)
        ob.parent = ctx.scene_root
        ob.location = spec["loc"]
        if "look" in spec:
            look_at(ob, spec["look"])
        else:
            ob.rotation_euler = spec.get("rot", (0, 0, 0))
        lights[spec["name"]] = ob
    return lights


def look_at(ob, target, up="Y"):
    direction = Vector(target) - Vector(ob.location)
    ob.rotation_euler = direction.to_track_quat("-Z", up).to_euler()


def build_world(scene, strength=None):
    world = bpy.data.worlds.new("Studio_World")
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = (0.02, 0.022, 0.028, 1)
    bg.inputs["Strength"].default_value = STUDIO.world_strength if strength is None else strength
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(bg.outputs[0], out.inputs[0])
    scene.world = world
    return world


def build_cameras(ctx):
    """Create one camera per preset in config.CAMERAS, aimed with a Track-To constraint at
    its own target empty (move the empty to re-aim, or change lens/fstop on the camera)."""
    cams = {}
    for name, c in CAMERAS.items():
        cam = bpy.data.cameras.new("CAM_" + name)
        cam.lens = c["lens"]
        cam.sensor_width = 36
        cam.clip_start, cam.clip_end = 0.05, 200
        cam.dof.use_dof = True
        cam.dof.aperture_fstop = c["fstop"]
        ob = bpy.data.objects.new("CAM_" + name, cam)
        ctx.part_collection("Cameras").objects.link(ob)
        ob.parent = ctx.scene_root
        ob.location = c["loc"]
        tgt = ctx.add_empty("Cameras", "TARGET_" + name, parent=ctx.scene_root, location=c["target"], size=0.15)
        cam.dof.focus_object = tgt
        con = ob.constraints.new("TRACK_TO")
        con.target = tgt
        con.track_axis = "TRACK_NEGATIVE_Z"
        con.up_axis = "UP_Y"
        cams[name] = ob
    return cams


def activate_camera(ctx, scene, name):
    cam = ctx.objects.get("CAM_" + name) or bpy.data.objects.get("CAM_" + name)
    scene.camera = cam
    return cam
