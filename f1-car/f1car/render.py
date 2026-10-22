"""Cycles configuration + still / animation output."""
import bpy

from .config import RENDER


def setup_cycles(scene, quality="preview", gpu=True, samples=None, resolution=None):
    w, h, s = RENDER.presets[quality]
    if resolution:
        w, h = resolution
    scene.render.engine = "CYCLES"
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.resolution_percentage = 100
    cy = scene.cycles
    cy.samples = samples or s
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = 0.01
    cy.use_denoising = True
    try:
        cy.denoiser = "OPENIMAGEDENOISE"
    except Exception:
        pass
    cy.max_bounces = 10
    cy.diffuse_bounces = 3
    cy.glossy_bounces = 6
    cy.transmission_bounces = 4
    cy.transparent_max_bounces = 4
    cy.sample_clamp_indirect = 8.0
    cy.caustics_reflective = False
    cy.caustics_refractive = False
    cy.device = "CPU"
    if gpu:
        try:
            prefs = bpy.context.preferences.addons["cycles"].preferences
            for kind in ("OPTIX", "CUDA", "HIP", "NONE"):
                try:
                    prefs.compute_device_type = kind
                    break
                except Exception:
                    continue
            prefs.get_devices()
            active = [d for d in prefs.devices if d.type != "CPU"]
            for d in prefs.devices:
                d.use = d.type != "CPU"
            if active:
                cy.device = "GPU"
        except Exception as e:  # pragma: no cover
            print("GPU setup failed, using CPU:", e)
    scene.view_settings.view_transform = RENDER.view_transform
    try:
        scene.view_settings.look = RENDER.look
    except Exception:
        pass
    scene.view_settings.exposure = RENDER.exposure
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_depth = "16" if quality == "final" else "8"
    scene.render.film_transparent = False
    scene.render.use_persistent_data = False
    cy.tile_size = 512 if cy.device == "GPU" else 64
    return cy.device


def render_still(scene, path):
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path


def render_animation(scene, folder, start, end):
    scene.frame_start, scene.frame_end = start, end
    scene.render.filepath = folder.rstrip("/\\") + "/frame_"
    bpy.ops.render.render(animation=True)
