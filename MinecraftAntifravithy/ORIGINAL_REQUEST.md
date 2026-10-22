# Original User Request

## Initial Request — 2026-09-22T20:35:25Z

A pure browser-based, standalone 1:1 Minecraft Java Edition voxel game built from scratch using raw WebGL, Canvas, and Web Audio. Features procedural 16x16 textures, multi-chunk terrain across three dimensions (Overworld with Cherry Blossom and Plains, Nether with lava lakes and fortresses, The End with obsidian pillars and Ender Dragon), AABB physics, DDA raycast block interactions, and a complete survival inventory and 2x2 crafting system with zero external asset downloads or game engines.

Working directory: d:\SurvierLOL\MinecraftAntifravithy
Integrity mode: development

## Requirements

### R1. Custom WebGL Voxel Rendering Pipeline & Procedural Texture Atlas
- Build a custom 3D WebGL renderer without external libraries or game engines.
- Procedurally synthesize all 16x16 pixel textures (dirt, grass top/side, stone, cobblestone, oak wood/planks/leaves, cherry wood/leaves/petals, sand, water, lava, obsidian, netherrack, glowstone, end stone, tools, items, UI elements) onto a runtime dynamic texture atlas using Canvas 2D math.
- Mesh chunks with neighbor face culling, ambient occlusion, and directional lighting to maintain 60 FPS.

### R2. Multi-Dimension Voxel World Generation
Implement procedural chunk-based world generation across three dimensions:
- **Overworld**: Heightmap & 3D noise terrain with biomes (Beta Plains/Forest and Modern Cherry Grove), cave carve-outs, water bodies, and procedural trees.
- **The Nether**: Enclosed cavern world with roof and floor bedrock, vast lava oceans, netherrack terrain, glowstone veins, and Nether Fortress structures.
- **The End**: Void dimension with floating End stone island, obsidian monolith pillars with End Crystals, and dark void sky.
- Include functional dimension portal mechanics (Nether portal frame ignition and End portal frame activation / dimension switcher).

### R3. First-Person Physics, Voxel Raymarching & Block Interaction
- First-person controller with WASD movement, Pointer Lock mouse look, gravity, jumping, sneak/sprint, and creative fly mode.
- Fast Voxel Traversal (DDA) raymarching for pixel-accurate block picking, block breaking with stage damage overlays, and block placement against targeted faces.
- Robust AABB bounding-box collision detection against the voxel grid with step climbing.

### R4. Survival HUD, Inventory & 2x2/3x3 Crafting Engine
- Pixel-perfect survival HUD: 10-heart health bar, 10-shank hunger bar, experience bar, 9-slot hotbar with active selection, and crosshair.
- Full inventory screen (`E` key): 36-slot inventory, armor slots, off-hand slot, 2x2 crafting grid with output slot, and real-time recipe synthesis matching Minecraft Java recipes (e.g., logs -> planks -> crafting table/sticks -> tools).

### R5. Procedural Entities, Mobs & Web Audio Sound Synthesis
- Procedural box-mesh entities: Ender Dragon (with flapping wings and flying flight-path AI over The End), Endermen, and Steve character model in the inventory preview.
- Web Audio API procedural sound synthesizer for footsteps, block placement, block destruction clicks, and ambient drone with zero external audio assets.

## Acceptance Criteria

### Zero-Asset Standalone Execution
- [ ] Loads and runs immediately in modern web browsers from static files in `d:\SurvierLOL\MinecraftAntifravithy` with zero network requests, CDN scripts, or external assets.
- [ ] 100% of textures and audio synthesized procedurally at runtime in code.

### Visual Fidelity & Dimension Accuracy
- [ ] High-frame-rate rendering (>= 60 FPS) with hidden-face culling and chunk management.
- [ ] Overworld exhibits recognizable terrain, water, and cherry blossom biomes.
- [ ] Nether renders lava sea, netherrack terrain, and fortress architecture.
- [ ] The End renders void sky, central island, obsidian pillars, and animated Ender Dragon.

### Mechanics & Playability
- [ ] First-person player movement with collision, jumping, falling, and swimming.
- [ ] Left-click breaks blocks (adds to inventory), right-click places currently selected hotbar block.
- [ ] Inventory screen (`E`) opens with functional 2x2 crafting grid producing correct items.
- [ ] Dimension transitions between Overworld, Nether, and The End work seamlessly.
