"""Assembles the whole scene: clean file -> car parts -> studio -> lights -> cameras."""
import bpy

from . import decals, parts, studio
from .context import Ctx


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for b in list(coll):
            coll.remove(b)


def build_scene(only=None, skip=None, with_studio=True):
    reset()
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    ctx = Ctx(scene)
    ctx.mats.decals = decals.build_images()
    parts.build_all(ctx, only=only, skip=skip)
    if with_studio:
        studio.build_world(scene)
        studio.build_cyclorama(ctx)
        studio.build_lights(ctx)
        studio.build_cameras(ctx)
    scene.frame_start, scene.frame_end = 1, 240
    scene["f1_ctx_ready"] = True
    scene_builder_ctx.ctx = ctx
    return scene


class scene_builder_ctx:  # holder so animation/tools can reach the live context
    ctx = None


def export_glb(path):
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=False,
                              export_apply=True, export_cameras=False, export_lights=False)
