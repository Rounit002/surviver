"""Entry point. Run inside Blender:

    blender -b --factory-startup -P build.py -- [options]

Options
    --quality draft|preview|final     render preset (config.RENDER.presets)
    --camera NAME [NAME...]           camera presets to render (config.CAMERAS) or 'all'
    --out DIR                         output directory (default ./renders)
    --parts a,b,c                     only build these parts (dev speed-up)
    --skip a,b                        skip these parts
    --no-render                       build + save only
    --blend PATH                      save the .blend here (default ./exports/f1car.blend)
    --glb PATH                        also export a glTF binary
    --anim turntable|wheels|showcase  render an animation instead of stills
    --frames N                        animation length
    --cpu                             force CPU rendering
"""
import argparse
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import bpy  # noqa: E402


def parse():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--quality", default="preview")
    p.add_argument("--camera", nargs="*", default=None)
    p.add_argument("--out", default=os.path.join(HERE, "renders"))
    p.add_argument("--parts", default=None)
    p.add_argument("--skip", default=None)
    p.add_argument("--no-render", action="store_true")
    p.add_argument("--blend", default=os.path.join(HERE, "exports", "f1car.blend"))
    p.add_argument("--glb", default=None)
    p.add_argument("--anim", default=None)
    p.add_argument("--frames", type=int, default=240)
    p.add_argument("--cpu", action="store_true")
    p.add_argument("--samples", type=int, default=None)
    p.add_argument("--tag", default="")
    return p.parse_args(argv)


def main():
    args = parse()
    t0 = time.time()
    from f1car import scene_builder
    scene = scene_builder.build_scene(
        only=args.parts.split(",") if args.parts else None,
        skip=args.skip.split(",") if args.skip else None,
    )
    print("[build] scene built in %.1fs" % (time.time() - t0))
    os.makedirs(os.path.dirname(args.blend), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=args.blend)
    if args.glb:
        scene_builder.export_glb(args.glb)
    if args.no_render:
        return
    from f1car import render, animation
    from f1car.config import CAMERAS, DEFAULT_CAMERA
    dev = render.setup_cycles(scene, args.quality, gpu=not args.cpu, samples=args.samples)
    print("[render] device:", dev)
    os.makedirs(args.out, exist_ok=True)
    if args.anim:
        cam_name = (args.camera or [DEFAULT_CAMERA])[0]
        scene.camera = bpy.data.objects["CAM_" + cam_name]
        animation.setup(args.anim, scene, args.frames, camera_name=cam_name)
        render.render_animation(scene, os.path.join(args.out, args.anim), 1, args.frames)
        return
    names = args.camera or [DEFAULT_CAMERA]
    if names == ["all"]:
        names = list(CAMERAS)
    for name in names:
        t1 = time.time()
        scene.camera = bpy.data.objects["CAM_" + name]
        path = os.path.join(args.out, "%s%s_%s.png" % (args.tag, name, args.quality))
        render.render_still(scene, path)
        print("[render] %s -> %s (%.1fs)" % (name, path, time.time() - t1))


main()
