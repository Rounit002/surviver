"""Animation rigs: turntable, wheel roll + steering, camera showcase. Everything is keyframed
on named empties (ORBIT_RIG, SPIN_*, STEER_*), so retiming is a matter of editing keys."""
import math

import bpy

from .config import CAMERAS


def _linear(ob, path="rotation_euler"):
    if ob.animation_data and ob.animation_data.action:
        for fc in ob.animation_data.action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR"


def wheel_roll(scene, frames, speed_kph=120.0):
    fps = scene.render.fps
    v = speed_kph / 3.6
    from .config import CAR
    total_angle = v * (frames / fps) / CAR.tyre_radius
    for tag in ("FL", "FR", "RL", "RR"):
        spin = bpy.data.objects.get("SPIN_" + tag)
        if not spin:
            continue
        sign = -1.0 if tag.endswith("R") else 1.0
        spin.rotation_euler = (0, 0, 0)
        spin.keyframe_insert("rotation_euler", frame=1)
        spin.rotation_euler = (0, sign * total_angle, 0)
        spin.keyframe_insert("rotation_euler", frame=frames)
        _linear(spin)


def steering(scene, frames, amplitude_deg=14.0):
    for tag in ("FL", "FR"):
        st = bpy.data.objects.get("STEER_" + tag)
        if not st:
            continue
        for i, f in enumerate((1, frames // 4, frames * 3 // 4, frames)):
            val = (0, math.sin(math.pi * i / 3 * 1.0) * 0.0, 0)
        keys = [(1, 0.0), (frames // 4, amplitude_deg), (frames * 3 // 4, -amplitude_deg), (frames, 0.0)]
        for f, deg in keys:
            st.rotation_euler = (0, 0, math.radians(deg))
            st.keyframe_insert("rotation_euler", frame=f)


def turntable(scene, frames, camera_name="hero_front34"):
    """Orbit the chosen camera around the car (studio reflections sweep across the paint)."""
    cam = bpy.data.objects["CAM_" + camera_name]
    rig = bpy.data.objects.get("ORBIT_RIG") or bpy.data.objects.new("ORBIT_RIG", None)
    if rig.name not in scene.collection.objects:
        scene.collection.objects.link(rig)
    # re-parent camera under the rig keeping world transform
    mw = cam.matrix_world.copy()
    cam.parent = rig
    cam.matrix_world = mw
    rig.rotation_euler = (0, 0, 0)
    rig.keyframe_insert("rotation_euler", frame=1)
    rig.rotation_euler = (0, 0, math.radians(360.0 * (frames - 1) / frames))
    rig.keyframe_insert("rotation_euler", frame=frames)
    _linear(rig)
    scene.camera = cam


def showcase(scene, frames):
    """Fly one camera through a sequence of the preset shots with eased moves."""
    order = ["hero_front34", "detail_frontwing", "detail_wheel", "side_profile",
             "detail_cockpit", "detail_sidepod", "detail_rearwing", "hero_rear34"]
    cam_data = bpy.data.cameras.new("CAM_showcase")
    cam = bpy.data.objects.new("CAM_showcase", cam_data)
    scene.collection.objects.link(cam)
    tgt = bpy.data.objects.new("TARGET_showcase", None)
    scene.collection.objects.link(tgt)
    con = cam.constraints.new("TRACK_TO")
    con.target, con.track_axis, con.up_axis = tgt, "TRACK_NEGATIVE_Z", "UP_Y"
    cam_data.dof.use_dof = True
    cam_data.dof.focus_object = tgt
    step = max(1, (frames - 1) // (len(order) - 1))
    for i, name in enumerate(order):
        c = CAMERAS[name]
        f = 1 + i * step
        cam.location = c["loc"]
        tgt.location = c["target"]
        cam_data.lens = c["lens"]
        cam_data.dof.aperture_fstop = c["fstop"]
        cam.keyframe_insert("location", frame=f)
        tgt.keyframe_insert("location", frame=f)
        cam_data.keyframe_insert("lens", frame=f)
        cam_data.dof.keyframe_insert("aperture_fstop", frame=f)
    scene.camera = cam


def setup(kind, scene, frames, camera_name="hero_front34"):
    scene.frame_start, scene.frame_end = 1, frames
    if kind == "turntable":
        wheel_roll(scene, frames, 0.0001)
        turntable(scene, frames, camera_name)
    elif kind == "wheels":
        wheel_roll(scene, frames, 90.0)
        steering(scene, frames)
    elif kind == "showcase":
        wheel_roll(scene, frames, 6.0)
        showcase(scene, frames)
    else:
        raise ValueError("unknown animation " + kind)
