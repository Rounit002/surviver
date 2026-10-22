# Project: Pure Browser-Based 1:1 Minecraft Java Edition Voxel Game

## Architecture
A standalone, zero-asset, high-performance browser voxel game built from scratch using HTML5, WebGL, Canvas 2D, and Web Audio API.

```
+---------------------------------------------------------------------------------------+
|                                    APPLICATION ENTRY                                  |
|                                index.html / src/main.js                               |
+---------------------------------------------------------------------------------------+
                                           |
       +-----------------------------------+-----------------------------------+
       |                                   |                                   |
       v                                   v                                   v
+--------------+                  +-----------------+                 +-----------------+
|   RENDERER   |                  |   GAME STATE    |                 |   AUDIO ENGINE  |
|  (WebGL 3D)  |                  | (World/Physics) |                 |   (Web Audio)   |
+--------------+                  +-----------------+                 +-----------------+
  - Canvas 2D Texture Atlas (16x16) - WorldManager (Overworld/Nether/End) - Procedural FX
  - ChunkSection Meshing (AO/Light) - Voxel Chunk Storage (64KB Uint8Array) - Footsteps/Blocks
  - Frustum Culling & Shaders       - AABB Swept Physics & Step Climb    - Mob Sounds & Roars
  - Camera & Matrix Math (Mat4)     - Amanatides-Woo 3D DDA Raymarch     - Ambient Drones
                                    - Inventory & Crafting Engine
                                    - Procedural Entities (Dragon/Steve)
```

## Code Layout
All source code files live under `d:\SurvierLOL\MinecraftAntifravithy\src\` and the entry file at root `index.html`:
```
d:\SurvierLOL\MinecraftAntifravithy\
├── index.html                   # Standalone browser entry point & UI canvas overlay
├── src/
│   ├── main.js                  # Game initialization, loop, and coordination
│   ├── engine/
│   │   ├── math.js              # Mat4, Vec3, Frustum, AABB math primitives
│   │   ├── webgl.js             # WebGL context initialization & shader compilation
│   │   ├── shaders.js           # GLSL ES 3.00 & 1.00 vertex and fragment shaders
│   │   ├── atlas.js             # 100% procedural 16x16 Canvas 2D texture synthesizer
│   │   ├── mesher.js            # ChunkSection face culling, smooth AO (0-3), and vertex packing
│   │   └── renderer.js          # Master 3D scene renderer, camera, and draw passes
│   ├── world/
│   │   ├── noise.js             # 2D/3D Simplex & Perlin noise with deterministic seed
│   │   ├── chunk.js             # 16x16x16 ChunkSection & ChunkColumn data structures
│   │   ├── generator.js         # Overworld, Nether, and The End terrain generators
│   │   ├── structures.js        # Trees (Oak/Cherry), Nether Fortresses, Obsidian Pillars
│   │   ├── portals.js           # Nether & End portal frame validation, ignition & teleportation
│   │   └── world.js             # Multi-dimension world manager, coordinate conversion, and caching
│   ├── physics/
│   │   ├── aabb.js              # Bounding box collision and intersection testing
│   │   ├── controller.js        # First-person WASD, mouse look, jump, sneak, sprint, fly, swim
│   │   └── raycast.js           # Amanatides-Woo 3D DDA raymarching, block breaking hardness, damage overlay
│   ├── inventory/
│   │   ├── items.js             # Item & block registry, hardness, tools, and attributes
│   │   ├── inventory.js         # 45-slot Java inventory data model & mouse drag/drop state machine
│   │   ├── crafting.js          # 2x2 & 3x3 recipe matcher (shapeless & shaped Java recipes)
│   │   └── hud.js               # Canvas 2D survival HUD (hearts, hunger, xp bar, hotbar, crosshair)
│   ├── entities/
│   │   ├── entity.js            # Base procedural box-mesh entity and bone hierarchy
│   │   ├── steve.js             # Steve model rigging & 3D inventory preview tracking
│   │   ├── enderman.js          # Enderman mob model, aggro stare detection, and teleport AI
│   │   └── dragon.js            # Multi-part Ender Dragon, kinematic wing flapping & 4-state flight AI
│   └── audio/
│       ├── audio.js             # AudioContext manager & procedural white/pink noise buffers
│       └── synth.js             # Procedural sound recipes (footsteps, placement, cracks, pops, hurt, roar, drones)
├── tests/                       # Opaque-box E2E test runner and test suites (Tiers 1-4)
│   ├── test_runner.html         # In-browser test runner interface
│   ├── test_harness.js          # Assertion framework, mock canvas/WebGL harness, and test runner
│   ├── tier1_features.test.js   # >=5 tests per inventoried feature
│   ├── tier2_boundaries.test.js # Boundary value & edge case tests
│   ├── tier3_pairwise.test.js   # Cross-feature interaction tests
│   └── tier4_workloads.test.js  # Real-world gameplay application scenarios
├── TEST_INFRA.md                # E2E Test Suite documentation and methodology
└── TEST_READY.md                # E2E Test Suite publication signal
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | WebGL Context & Matrix Engine | Custom raw WebGL 2.0 / 1.0 setup, Mat4 perspective/lookAt/multiply, Vec3, Frustum extraction | M1 | R1, survey |
| 2 | Procedural 16x16 Texture Atlas | 256x256 Canvas 2D atlas with 100% procedural pixel math for all blocks, tools, items, cracks | M1 | R1, survey |
| 3 | ChunkSection Meshing & Face Culling | 16x16x16 section mesher with neighbor face culling, skipping unexposed interior faces | M1 | R1, survey |
| 4 | Smooth Ambient Occlusion & Lighting | Per-vertex AO (0-3) calculation with diagonal quad-flip rule and directional face shading | M1 | R1, survey |
| 5 | Packed Vertex Buffers & Shaders | 8-byte packed attribute vertex buffers, cutout alpha discard, distance fog, and sunlight ramp | M1 | R1, survey |
| 6 | 2D/3D Simplex & Perlin Noise Engine | Seed-deterministic 2D/3D noise with FBM octaves for elevation, biomes, and 3D caves | M2 | R2, survey |
| 7 | Overworld Biomes & 3D Caves | Beta Plains, Beta Forest, Modern Cherry Grove, 3D noodle cave carve-outs, sea level 62 water | M2 | R2, survey |
| 8 | Procedural Foliage & Trees | Oak trees, branching Cherry Blossom trees with pink petals ground cover, tall grass, flowers | M2 | R2, survey |
| 9 | Nether Cavern Dimension | Dual bedrock ceiling/floor, Y=31 lava oceans, netherrack, glowstone clusters, soul sand | M2 | R2, survey |
| 10 | Nether Fortress Generator | Modular architectural bridges with parapets, deep vertical support stilts, covered corridors | M2 | R2, survey |
| 11 | The End Floating Island & Pillars | Central ellipsoidal End Stone island, 10 obsidian pillars with bedrock tops, bedrock exit fountain | M2 | R2, survey |
| 12 | Nether Portal Frame & Ignition | 4x5 to 23x23 obsidian frame validation, flint & steel ignition, 80-tick delay, 8:1 scaling | M2 | R2, survey |
| 13 | End Portal Activation & Teleport | 5x5 frame with 12 Eye of Ender sockets, instant teleport to (100.5, 49, 0.5) obsidian pad | M2 | R2, survey |
| 14 | Cross-Dimension State Manager | Multi-dimension chunk caching, persistent block modifications, and seamless dimension switching | M2 | R2, survey |
| 15 | First-Person Kinematics & Camera | WASD movement, Pointer Lock mouse look, pitch/yaw clamping, sprinting, sneak speed | M2/M3 | R3, survey |
| 16 | Swept AABB Physics & Step Climbing | Decoupled axis collision (Y->X->Z), gravity, jump, 0.6-block step climbing, sneak edge-clamp | M3 | R3, survey |
| 17 | Creative Flight & Fluid Mechanics | Double-tap space fly toggle, vertical climb/sink, fluid buoyancy, and viscous drag in water/lava | M3 | R3, survey |
| 18 | Amanatides-Woo 3D DDA Raymarch | Fast voxel ray traversal up to 5.0 blocks, face normal detection, exact block coordinate hit | M3 | R3, survey |
| 19 | Block Breaking & Damage Overlays | Accumulated break time hardness table, 10-stage depth-biased crack overlays, item drop trigger | M3 | R3, survey |
| 20 | Block Placement & Anti-Clipping | Targeted face placement, player AABB intersection exclusion check, chunk mesh dirtying | M3 | R3, survey |
| 21 | 45-Slot Java Inventory Data Model | Hotbar (0-8), main inventory (9-35), armor (36-39), off-hand (40), crafting grid (41-45), cursor | M4 | R4, survey |
| 22 | Inventory Mouse Drag/Drop State Machine | Left-click stack transfer, right-click stack splitting, shift-click quick move between sections | M4 | R4, survey |
| 23 | 2x2 & 3x3 Crafting Engine | Shapeless & shaped Java recipe matcher (planks, crafting table, sticks, tools, furnace, etc.) | M4 | R4, survey |
| 24 | Survival Canvas 2D HUD | 10-heart health bar with wobble, 10-shank hunger bar, XP level & bar, 9-slot hotbar, crosshair | M4 | R4, survey |
| 25 | Procedural Steve Model & Preview | 6-box hierarchical Steve model, limb swing kinematics, interactive mouse-tracking inventory preview | M5 | R5, survey |
| 26 | Enderman Entity & Aggro AI | Box-mesh Enderman, line-of-sight staring aggro trigger, aggressive sprint, and random teleportation | M5 | R5, survey |
| 27 | Ender Dragon Mesh & Wing Kinematics | Multi-part box mesh (body, neck, head, wings, tail), sinusoidal bone rotation wing flapping | M5 | R5, survey |
| 28 | Ender Dragon 4-State Flight AI | Autonomous state machine: Circling island -> Diving player -> Swoop recovery -> Perching fountain | M5 | R5, survey |
| 29 | Web Audio Procedural Sound Synthesizer | Zero-asset AudioContext synth with procedural noise buffer: footsteps, place, crack, pop, hurt | M5 | R5, survey |
| 30 | Dragon Audio & Dimension Ambient Drones | Dragon wing swoosh, detuned sawtooth roar, Overworld, Nether, and The End hollow ambient drones | M5 | R5, survey |
| 31 | Zero-Asset Standalone Browser Bundle | Runs 100% locally from static files with 0 external network requests, CDNs, or assets at >=60 FPS | M6 | Acceptance, survey |
| 32 | Full E2E Test Suite Validation | 100% pass across all E2E test tiers (Tiers 1-4) followed by Tier 5 adversarial test hardening | M6 | Final, survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Track | Requirement-driven opaque-box test runner and test cases (Tiers 1-4) publishing TEST_READY.md | none | DONE |
| M1 | WebGL Voxel Rendering Pipeline & Texture Atlas | Custom WebGL context, pure JS math, shaders, 100% procedural 16x16 Canvas 2D atlas, ChunkSection mesher with AO and face culling | none | DONE |
| M2 | Multi-Dimension Voxel World Generation & Portals | Deterministic noise, Overworld (caves/water/cherry grove/trees), Nether (lava sea/fortress), The End (island/pillars/crystals/fountain), portal mechanics | M1 contracts | DONE |
| M3 | First-Person Physics, Voxel Raymarching & Block Interaction | Decoupled AABB collision, 0.6-block step climb, sneak/fly/swim, Amanatides-Woo DDA raymarching, block break hardness/damage overlays, placement | M1, M2 | PLANNED |
| M4 | Survival HUD, Inventory & 2x2/3x3 Crafting Engine | 45-slot Java inventory model, mouse drag/drop state machine, 2x2 & 3x3 recipe matcher, Canvas 2D survival HUD (health/hunger/xp/hotbar) | M1, M3 | PLANNED |
| M5 | Procedural Entities, Mobs & Web Audio Sound Synthesis | Hierarchical box-mesh entities (Steve, Enderman, Ender Dragon wing kinematics & 4-state flight AI), Web Audio procedural sound synth & dimension drones | M1, M2, M3 | PLANNED |
| M6 | Final Integration & E2E Validation | Full game loop integration in index.html, 100% pass on E2E test suite (Tiers 1-4), Tier 5 adversarial hardening | M1, M2, M3, M4, M5, E2E | PLANNED |

## Interface Contracts

### 1. `Atlas` ↔ `Renderer` / `Mesher`
- `atlas.getTileIndex(name: string): number`
  - Returns integer slot index $(0..255)$ in texture atlas for given block face or item name.
- `atlas.getTexture(): WebGLTexture`
  - Returns compiled `gl.TEXTURE_2D` handle bound with `NEAREST` filtering.

### 2. `World` ↔ `Mesher` / `Renderer`
- `world.getBlock(x: number, y: number, z: number): number`
  - Returns 8-bit integer block ID. Returns 0 (`AIR`) for out-of-bounds or unloaded regions.
- `world.getLight(x: number, y: number, z: number): { sky: number, block: number }`
  - Returns sky light $(0..15)$ and block light $(0..15)$.
- `world.getActiveDimension(): Dimension`
  - Returns `Dimension.OVERWORLD (0)`, `Dimension.NETHER (-1)`, or `Dimension.THE_END (1)`.
- `mesher.buildMesh(gl: WebGLRenderingContext, section: ChunkSection, world: VoxelWorld): MeshHandle`
  - Generates packed vertex buffers `Float32Array` or `Uint32Array` with face culling, AO, and quad-flip.

### 3. `Physics` / `Raycast` ↔ `World`
- `world.getIntersectingBlockAABBs(box: AABB): AABB[]`
  - Returns bounding boxes of all solid, collidable blocks intersecting `box`.
- `raycast.castRay(world: VoxelWorld, eyePos: Vec3, dir: Vec3, maxDist: number = 5.0): RaycastResult`
  - Returns `{ hit: boolean, blockPos: Vec3, placePos: Vec3, normal: Vec3, distance: number, blockId: number }`.

### 4. `Inventory` / `Crafting` ↔ `Game`
- `inventory.getSlot(index: number): ItemStack | null`
- `inventory.setSlot(index: number, stack: ItemStack | null): void`
- `crafting.evaluateRecipe(matrix: (ItemStack | null)[], width: number, height: number): ItemStack | null`
- `inventory.handleSlotClick(slotIdx: number, button: number, shift: boolean): void`

### 5. `AudioSynth` ↔ `Game Events`
- `audio.playSound(name: string, opt?: { blockId?: number, volume?: number, rate?: number }): void`
  - Plays procedural sound: `'footstep'`, `'place'`, `'break_crack'`, `'break_pop'`, `'hurt'`, `'dragon_roar'`, `'dragon_flap'`.
- `audio.setDimensionAmbient(dimension: Dimension): void`
  - Cross-fades ambient multitone synth drone for Overworld, Nether, or The End.
