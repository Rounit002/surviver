"""Single source of truth: dimensions, livery palette, studio and render settings.

Edit values here to re-proportion the car, re-colour the livery or change the studio
without touching any modelling code.
"""
import math


def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(h, alpha=1.0):
    """'#RRGGBB' (sRGB) -> linear RGBA tuple for Blender colour sockets."""
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    return (_lin(r), _lin(g), _lin(b), alpha)


# --------------------------------------------------------------------------- car
class CAR:
    wheelbase = 3.60
    front_axle = 1.80
    rear_axle = -1.80

    tyre_radius = 0.360            # 720 mm overall diameter
    rim_radius = 0.2286            # 18 in rim
    front_tyre_width = 0.305
    rear_tyre_width = 0.405
    front_track_half = 0.800       # tyre centre-line, y
    rear_track_half = 0.780

    nose_tip = 2.62
    tail_end = -2.55
    front_wing_le = 2.83
    rear_wing_te = -2.86


# ------------------------------------------------------------------------ livery
class LIVERY:
    team = "KESTREL"
    car_number = "77"
    base = "#06080C"             # obsidian, pearl-shifts to deep blue at grazing angles
    base_edge = "#0B1428"
    accent = "#FF4310"           # ember orange
    accent_deep = "#B81E00"
    white = "#EEEBE4"            # bone white
    gold = "#C9A45A"
    tyre_band = "#E02631"        # soft compound
    caliper = "#D9A21B"
    helmet_base = "#EEEBE4"


# ------------------------------------------------------------------------- studio
class STUDIO:
    floor_radius = 24.0
    wall_radius = 34.0
    wall_height = 18.0
    fillet = 9.0
    world_strength = 0.035
    # Every light is an area light. `look` aims it at a point; `rot` sets Euler rotation
    # directly (used for overhead strips that must stay parallel to the car).
    lights = [
        dict(name="Top_Long_L", loc=(0.2, 1.35, 5.0), size=(9.0, 0.5), power=800, color="#FFFFFF", rot=(0, 0, 0)),
        dict(name="Top_Long_R", loc=(0.2, -1.35, 5.0), size=(9.0, 0.5), power=800, color="#FFFFFF", rot=(0, 0, 0)),
        dict(name="Top_Wide",   loc=(0.0, 0.0, 7.5), size=(12.0, 12.0), power=8, color="#EEF3FF", rot=(0, 0, 0)),
        dict(name="Side_L",     loc=(0.6, 5.4, 1.4), size=(0.9, 2.4), power=900, color="#FFF6EC", look=(0.4, 0, 0.35)),
        dict(name="Side_R",     loc=(0.6, -5.4, 1.4), size=(0.9, 2.4), power=900, color="#EAF1FF", look=(0.4, 0, 0.35)),
        dict(name="Rim_L",      loc=(-6.8, 3.6, 1.7), size=(0.9, 3.0), power=520, color="#FFE2CC", look=(-1.0, 0, 0.5)),
        dict(name="Rim_R",      loc=(-6.8, -3.6, 1.7), size=(0.9, 3.0), power=520, color="#D6E4FF", look=(-1.0, 0, 0.5)),
        dict(name="Front_Soft", loc=(9.0, 0.0, 2.2), size=(4.0, 1.8), power=120, color="#FFFFFF", look=(0.5, 0, 0.4)),
    ]


# ------------------------------------------------------------------------ render
class RENDER:
    presets = {
        # name: (width, height, samples)
        "draft":   (960, 540, 24),
        "preview": (1600, 900, 96),
        "final":   (3840, 2160, 384),
    }
    view_transform = "Filmic"
    look = "Medium High Contrast"
    exposure = 0.25


# ----------------------------------------------------------------------- cameras
# name: dict(loc, target, lens (mm), fstop, focus (point or None -> target))
CAMERAS = {
    "hero_front34":  dict(loc=(8.4, 5.6, 1.15),  target=(0.35, 0.0, 0.42), lens=62,  fstop=5.6),
    "hero_rear34":   dict(loc=(-8.6, 5.4, 1.55), target=(-0.35, 0.0, 0.5), lens=62,  fstop=5.6),
    "side_profile":  dict(loc=(0.0, 15.0, 0.62), target=(0.0, 0.0, 0.5),   lens=105, fstop=8.0),
    "front_low":     dict(loc=(8.0, 0.6, 0.38),  target=(1.6, 0.0, 0.42),  lens=55,  fstop=4.5),
    "rear_low":      dict(loc=(-7.5, -1.5, 0.55), target=(-2.4, 0.0, 0.55), lens=55, fstop=5.0),
    "top":           dict(loc=(0.0, 0.0, 12.0),  target=(0.0, 0.0, 0.0),   lens=90,  fstop=11.0),
    "detail_frontwing": dict(loc=(4.6, 2.1, 0.55), target=(2.6, 0.4, 0.14), lens=85, fstop=3.2),
    "detail_cockpit":   dict(loc=(2.4, 1.6, 1.4),  target=(0.1, 0.0, 0.72), lens=85, fstop=3.5),
    "detail_wheel":     dict(loc=(3.8, 3.1, 0.55), target=(1.8, 0.85, 0.36), lens=85, fstop=3.2),
    "detail_rearwing":  dict(loc=(-5.1, 2.6, 1.3), target=(-2.65, 0.0, 0.85), lens=85, fstop=3.5),
    "detail_diffuser":  dict(loc=(-4.6, -1.4, 0.35), target=(-2.2, 0.0, 0.22), lens=70, fstop=4.0),
    "detail_airbox":    dict(loc=(-0.4, 2.3, 0.95), target=(-0.5, 0.1, 0.78), lens=85, fstop=4.0),
    "detail_sidepod":   dict(loc=(0.3, 3.4, 0.85), target=(0.0, 0.3, 0.42), lens=85, fstop=3.5),
}
DEFAULT_CAMERA = "hero_front34"

DEG = math.pi / 180.0
