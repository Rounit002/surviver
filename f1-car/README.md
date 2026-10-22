# F1 Car — procedural studio model (Blender 3.6+)

A fictional Formula 1 car ("KESTREL 77") built entirely from Python: lofted carbon
monocoque and bodywork, cambered multi-element wings, real boolean-cut vents, suspension,
halo, cockpit, four complete wheel corners, a PBR material library, a photo studio and a
camera / animation rig. Nothing is a texture fake — the details you see are geometry.

Units are metres. `+X` forward, `+Y` left, `+Z` up, origin on the floor at mid-wheelbase.

## Run

```powershell
.\render.ps1                                              # 1600x900 preview, default camera
.\render.ps1 -Quality final -Camera hero_front34,side_profile   # 4K, 384 samples
.\render.ps1 -Camera all -Quality draft                   # every camera, fast
.\render.ps1 -Anim turntable -Frames 240 -Quality preview # PNG sequence in renders\turntable
.\render.ps1 -NoRender -Glb exports\f1car.glb             # just rebuild the .blend / glTF
```

Set `F1_BLENDER` if Blender is not at `D:\BlenderL\blender.exe`. Raw form:

```
blender -b --factory-startup -P build.py -- --quality final --camera hero_rear34
```

Every run also writes `exports/f1car.blend` (open it in Blender to orbit, edit and
re-render by hand). `--parts a,b` / `--skip a,b` build only some parts (fast iteration).
GPU (CUDA/OptiX) is used when available, CPU otherwise (`--cpu` forces CPU).

## Layout

```
build.py                 CLI entry point
render.ps1               PowerShell wrapper
f1car/
  config.py              ALL tunables: dimensions, livery colours, studio lights, cameras, render presets
  context.py             Ctx: collections, materials, object creation, boolean cut, mirror, bake
  materials.py           PBR library (carbon twill, livery paint, rubber, metals, ...) keyed by name
  decals.py              Livery text (team, numbers, sponsors) rasterised in Blender, projected in shader
  studio.py              Cyclorama, softbox rig, world, camera presets
  render.py              Cycles set-up + still / animation output
  animation.py           Turntable, wheel roll, steering, camera showcase (keyframes on named empties)
  scene_builder.py       Wires it together (+ glTF export)
  utils/geo.py           Loft, revolve, strut, aerofoil, plate, fence ... bmesh helpers
  parts/                 One module per assembly, each exposing build(ctx)
    chassis  sidepods  airbox  floor  front_wing  rear_wing  rear_end
    cockpit  mirrors   wheels  suspension
    __init__.py          REGISTRY: add / remove / reorder parts here
```

In Blender each part lands in its own collection (`F1_FrontWing`, `F1_Wheels`, ...), all
parented under the `F1_CAR` empty, with left/right pairs named `_L` / `_R`.

## Changing things

| I want to…                         | Edit                                                             |
|------------------------------------|------------------------------------------------------------------|
| re-proportion the body             | key-section tables at the top of `parts/chassis.py`, `sidepods.py`, `airbox.py` |
| change wing shapes / element count | `parts/front_wing.py`, `parts/rear_wing.py` (station functions)  |
| recolour the livery                | `config.LIVERY` (+ band positions in `materials.m_body_paint`)   |
| change race number / sponsors      | `decals.DECALS` (text, font, position, size, colour)             |
| swap a material                    | change the key in the part's `add_bm(..., ["key"])`, or edit `materials.py` |
| move / re-tint studio lights       | `config.STUDIO.lights`                                           |
| add a camera                       | one dict in `config.CAMERAS`; use it with `--camera name`        |
| change tyre compound colour        | `LIVERY.tyre_band`; sidewall lettering in `parts/wheels.py`      |
| add a new part                     | new `parts/foo.py` with `build(ctx)`, add `"foo"` to `REGISTRY`  |
| animate                            | keyframe `SPIN_<FL|FR|RL|RR>` (roll), `STEER_FL/FR` (steer), or edit `animation.py` |

Modifiers (bevels) stay live on most objects, so edge softness can be adjusted in Blender.
Booleans (cockpit, vents, wheel-cover slots, end-plate louvres) are baked at build time.

## Realism notes

* **Carbon fibre**: procedural 2x2 twill, tri-planar, 45 degrees, under a smooth clear-coat.
  The weave bump fades with camera distance (`materials.carbon_weave`) so it reads up
  close and never moirés on full-car shots. Matte variant for interior/underfloor.
* **Paint**: pearl base with metallic flake, orange-peel micro-bump, clear-coat, faint
  polish streaks and crevice dirt (ambient-occlusion driven).
* **Tyres**: slick compound with roughness/wear variation, real 3D sidewall lettering,
  compound band, shoulder radius.
* **Studio**: dark cyclorama with polished-resin floor (reflection fades away from the car and
  for near-vertical views), long strip softboxes for crisp highlight lines, warm/cool rim lights.

## Limits

* The fictional livery, sponsors and font choices are placeholders (Windows fonts are used
  when present; Blender's built-in font is the fallback).
* glTF export carries geometry and base PBR values; procedural shaders (weave, livery) do
  not survive export — render in Blender for the full look.

## Web viewer (three.js)

```powershell
& "D:\BlenderL\blender.exe" -b --factory-startup -P export_web.py   # re-export GLB + decal masks
npm --prefix web install                                            # first time only
npm --prefix web run dev                                            # http://127.0.0.1:5177
```

`web/src/materials.js` re-creates the Blender materials by name (livery shader with the same bands
and projected decals, carbon twill, clear-coat, heat-tinted exhaust); `web/src/studio.js` builds the
softbox environment and mirrored floor. Camera presets, accent colours, wheel roll and steering are in `main.js`.
