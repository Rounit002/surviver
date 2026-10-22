"""Export the car for the browser viewer:

    blender -b --factory-startup -P export_web.py

Writes web/public/models/f1car.glb (geometry + node hierarchy, studio excluded) and
web/public/decals/*.png + decals.json (the same livery masks the Cycles shader uses).
Procedural materials cannot travel through glTF, so web/src/materials.js re-creates them by
material name."""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402

from f1car import decals, scene_builder  # noqa: E402

OUT = os.path.join(HERE, "web", "public")


def main():
    scene = scene_builder.build_scene(with_studio=False)
    os.makedirs(os.path.join(OUT, "models"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "decals"), exist_ok=True)

    specs = []
    for d in decals.DECALS:
        img = bpy.data.images.get("Decal_" + d["key"])
        path = os.path.join(OUT, "decals", d["key"] + ".png")
        img.filepath_raw = path
        img.file_format = "PNG"
        img.save()
        aspect = img.size[1] / img.size[0]
        specs.append(dict(key=d["key"], plane=d["plane"], center=list(d["center"]), width=d["width"],
                          aspect=aspect, color=d["color"], ymin=d["ymin"], url="decals/%s.png" % d["key"]))
    with open(os.path.join(OUT, "decals", "decals.json"), "w") as f:
        json.dump(specs, f, indent=1)

    # export only the car hierarchy
    bpy.ops.object.select_all(action="DESELECT")
    root = bpy.data.objects["F1_CAR"]
    stack = [root]
    while stack:
        o = stack.pop()
        o.select_set(True)
        stack.extend(o.children)
    bpy.context.view_layer.objects.active = root
    glb = os.path.join(OUT, "models", "f1car.glb")
    bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True, export_apply=True,
                              export_cameras=False, export_lights=False, export_extras=False,
                              export_image_format="AUTO", export_texcoords=False, export_yup=True)
    print("[web] wrote", glb, os.path.getsize(glb) // 1024, "KB")


main()
