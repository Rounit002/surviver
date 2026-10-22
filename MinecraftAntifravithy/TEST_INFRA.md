# E2E Test Infrastructure & Methodology Specification

## 1. Test Architecture Overview

The Minecraft Java Edition Pure Browser Voxel Engine test framework is a **zero-dependency, requirement-driven, opaque-box testing harness** engineered to execute natively in standard desktop browsers and headless Node.js runtimes.

```
+-----------------------------------------------------------------------------------------+
|                               TEST EXECUTION RUNNERS                                    |
|   tests/test_runner.html (Browser UI)        tests/test_runner.js (Node.js CLI)         |
+-----------------------------------------------------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
|                               TEST HARNESS (test_harness.js)                            |
|  - Assertion Library (assertEqual, assertApprox, assertArrayApprox, assertThrows)       |
|  - Headless WebGL 2.0 / 1.0 Mock Context (VAO, Shaders, Buffers, Textures, Draw Calls) |
|  - Headless Canvas 2D Mock Context (ImageData, 16x16 Pixel Buffers)                    |
|  - Headless Web Audio API Mock (AudioContext, Oscillators, Filters, Gain, Envelopes)    |
|  - Authoritative Reference Specification Oracle (32 PROJECT.md Features)               |
|  - Dynamic Module Resolver (Hot-loading live src/ modules or falling back to Oracle)   |
+-----------------------------------------------------------------------------------------+
                                             |
         +-------------------+---------------+-------------------+
         |                   |                                   |
         v                   v                                   v
+-----------------+ +-----------------+                 +-----------------+
| TIER 1: FEATURE | | TIER 2: BOUNDS  |                 | TIER 3: PAIRS   |
|   (160 tests)   | |   (26 tests)    |                 |   (11 tests)    |
+-----------------+ +-----------------+                 +-----------------+
         |                   |                                   |
         +-------------------+---------------+-------------------+
                                             |
                                             v
                             +-----------------------------------+
                             | TIER 4: WORKLOAD SCENARIOS        |
                             |   (5 complete gameplay flows)     |
                             +-----------------------------------+
```

---

## 2. Headless Mock Subsystems

Because the game engine is designed for pure browser execution without npm packages or bundlers, `tests/test_harness.js` provides lightweight, conformant mocks of browser graphics and audio primitives:

### 2.1 WebGL 2.0 / 1.0 Mock (`createMockWebGLContext`)
- Simulates WebGL context state machine, depth test, face culling (`CCW`, `BACK`), blend modes.
- Supports shader compilation (`VERTEX_SHADER`, `FRAGMENT_SHADER`), program linking, and uniform reflection.
- Handles buffer allocation (`ARRAY_BUFFER`, `STATIC_DRAW`), Vertex Array Objects (VAOs), integer vertex attribute pointers (`vertexAttribIPointer`), and draw commands (`drawArrays`, `drawElements`).
- Simulates texture creation, `NEAREST` filtering, and 2D texture binding.

### 2.2 Canvas 2D Mock (`createMockCanvas2DContext`)
- Mocks 256x256 atlas rasterization.
- Implements `createImageData`, `getImageData`, and `putImageData` operating on `Uint8ClampedArray` pixel memory.
- Simulates 2D survival HUD drawing operations (`fillRect`, `strokeRect`, `drawImage`, `fillText`).

### 2.3 Web Audio API Mock (`MockAudioContext`)
- Mocks `AudioContext` with `sampleRate = 44100 Hz`.
- Provides mock nodes: `MockGainNode`, `MockOscillatorNode`, `MockBiquadFilterNode`, `MockAudioBufferSourceNode`.
- Mocks parameter automation ramps (`linearRampToValueAtTime`, `exponentialRampToValueAtTime`).

---

## 3. Four-Tier Testing Methodology

The test suite enforces a rigorous 4-tier testing hierarchy matching the `PROJECT.md` Feature Inventory:

### Tier 1: Feature Coverage (Isolation)
- **Target**: Every feature from Feature 1 to Feature 32 in `PROJECT.md`.
- **Threshold**: $\ge 5$ distinct, non-facade tests per feature.
- **Coverage**: 32 features $\times$ 5 tests = **160 tests**.
- **Scope**:
  1. WebGL Context & Matrix Engine (Mat4, Vec3, Frustum extraction, AABB intersection).
  2. Procedural 16x16 Texture Atlas (256x256 composite, tile indices, UV mappings).
  3. ChunkSection Meshing & Face Culling (16x16x16 sub-chunks, neighbor air culling).
  4. Smooth Ambient Occlusion & Lighting (AO quad-flip rule, AO curve [0..3], face shading).
  5. Packed Vertex Buffers & Shaders (2 x uint32 packed attributes, 8-byte layout).
  6. 2D/3D Simplex & Perlin Noise Engine (Deterministic PRNG seed, continuous noise, FBM).
  7. Overworld Biomes & 3D Caves (Plains, Forest, Cherry Grove, sea level 62, cave carve-outs).
  8. Procedural Foliage & Trees (Oak straight trunk/canopy, Cherry branching & pink petals).
  9. Nether Cavern Dimension (Y=0/127 dual bedrock, Y=31 lava sea, netherrack, glowstone).
  10. Nether Fortress Generator (Bridge walkway width 5, parapets, vertical stilts).
  11. The End Floating Island & Pillars (Ellipsoidal island, 10 obsidian pillars in radius 42 ring).
  12. Nether Portal Frame & Ignition (4x5 to 23x23 frame, flint & steel ignition, 80 ticks delay, 8:1 scaling).
  13. End Portal Activation & Teleport (12 Eye of Ender sockets, teleport to [100.5, 49, 0.5]).
  14. Cross-Dimension State Manager (Chunk caching across dimensions, persistent modifications).
  15. First-Person Kinematics & Camera (WASD, yaw/pitch look, pitch clamp, sprint, sneak).
  16. Swept AABB Physics & Step Climbing (Decoupled axis sweep, gravity 0.08, 0.6m step climbing).
  17. Creative Flight & Fluid Mechanics (Double-tap space fly toggle, fluid buoyancy, drag).
  18. Amanatides-Woo 3D DDA Raymarch (5.0m reach, grid stepping, exact hit blockPos, placePos).
  19. Block Breaking & Damage Overlays (Hardness table, 10 damage stages, block drop trigger).
  20. Block Placement & Anti-Clipping (Targeted face placement, player AABB collision exclusion).
  21. 45-Slot Java Inventory Data Model (Hotbar 0-8, main 9-35, armor 36-39, offhand 40, crafting 41-45).
  22. Inventory Mouse Drag/Drop State Machine (Left-click pickup/drop/merge, right-click split, shift-click).
  23. 2x2 & 3x3 Crafting Engine (Shapeless logs->planks, shaped 2x2 planks->crafting table, sticks, tools).
  24. Survival Canvas 2D HUD (10 hearts HP, 10 shanks hunger, XP bar, 9 hotbar slots, crosshair).
  25. Procedural Steve Model & Preview (Hierarchical 6-box model, walking limb kinematics, mouse-tracking head).
  26. Enderman Entity & Aggro AI (Box mesh, lookDot > 0.985 stare detection, aggressive sprint, teleport).
  27. Ender Dragon Mesh & Wing Kinematics (Multi-part box mesh, sinusoidal flapping, undulating tail).
  28. Ender Dragon 4-State Flight AI (Circling island -> Diving player -> Swoop recovery -> Perching).
  29. Web Audio Procedural Sound Synthesizer (Filtered noise steps, block placements, break cracks, pops, hurt oof).
  30. Dragon Audio & Dimension Ambient Drones (Detuned sawtooth roar, lowpass swoosh, dimension drones).
  31. Zero-Asset Standalone Browser Bundle (Zero external network requests, zero CDN dependencies).
  32. Full E2E Test Suite Validation (100% pass verification).

### Tier 2: Boundary & Corner Cases
- **Scope**:
  - Coordinate extremes: $X, Z = \pm 30,000,000$ (world border), $Y = 0$, $Y = 255$, $Y < 0$, $Y > 255$.
  - Chunk boundary crossings ($X = -1$, local coordinate masking with negative values).
  - Raycast & vector mathematical edge cases (parallel rays with zero slopes, division by zero, coincident lookAt eye/target).
  - Inventory item stack limits (count = 0, count = 1, count = 64 cap, out-of-bounds slot clicks).
  - Crafting grid edge cases (empty grid, incomplete patterns, mismatched sizes).
  - Nether portal frame dimensions (under-sized 3x5, over-sized 24x24, optional corners).
  - Physics extreme velocities and volume checks.

### Tier 3: Pairwise Cross-Feature Interactions
- **Scope**:
  - Nether portal collision + 80-tick survival timer + 8:1 coordinate scaling + dimension switch.
  - DDA raycast + block breaking timer + block removal + inventory item yield.
  - Sneaking + candidate foot edge probe + AABB ledge clamp (preventing falls).
  - Forward collision + step climbing over 0.5m half-slab obstacle.
  - Block placement raycast + anti-clipping check against player bounding box.
  - Crafting engine + cursor stack state machine (Logs $\to$ Planks $\to$ Crafting Table $\to$ Sticks $\to$ Tools).
  - Enderman aggro stare detection + line-of-sight raycast occlusion by solid walls.
  - Water fluid physics + buoyant drag + swimming posture AABB height transition.
  - Nether fortress bridge elevation + vertical support stilts passing through lava lake.
  - Chunk section meshing + asymmetric ambient occlusion corner quad-flip rule.

### Tier 4: Real-World Gameplay Workloads
- **Scope**:
  - Scenario 1: **"New World Spawn & Survival Progression"** (spawn in Plains $\to$ approach tree $\to$ chop logs $\to$ craft planks $\to$ craft table $\to$ craft wooden pickaxe $\to$ mine stone $\to$ craft stone pickaxe).
  - Scenario 2: **"Nether Expedition & Fortress Raid"** (4x5 obsidian frame $\to$ flint & steel ignition $\to$ 80 ticks delay $\to$ 8:1 scale teleport to Nether $\to$ traverse netherrack $\to$ explore fortress bridge $\to$ harvest nether bricks).
  - Scenario 3: **"The End Gateway & Ender Dragon Slayer"** (activate 12-eye portal $\to$ teleport to (100.5, 49, 0.5) obsidian pad $\to$ dragon circling AI $\to$ dragon dive swoop $\to$ combat damage $\to$ dragon defeat $\to$ activate bedrock exit fountain $\to$ return to Overworld spawn).
  - Scenario 4: **"Creative Builder & High-Altitude Flight"** (double-tap space toggle flight $\to$ ascend to Y=200 $\to$ cross chunk boundaries $\to$ place blocks in air $\to$ dirty mesh regeneration).
  - Scenario 5: **"Full Audio-Visual, Damage & Survival HUD Loop"** (surface footstep audio synthesis $\to$ fall damage $\to$ hurt sound $\to$ HUD heart calculation & wobble).

---

## 4. Execution Commands

### Headless CLI Execution (Node.js)
```bash
# Run entire test suite (all 4 tiers)
node tests/test_runner.js

# Run specific tier
node tests/test_runner.js --tier 1
node tests/test_runner.js --tier 2
node tests/test_runner.js --tier 3
node tests/test_runner.js --tier 4

# Run with regex filter on suite or test name
node tests/test_runner.js --filter "Portal"

# Verbose output showing each test execution and timing
node tests/test_runner.js --verbose

# JSON machine-readable output (suitable for CI/CD pipelines)
node tests/test_runner.js --json
```

### In-Browser Interactive Execution
1. Open `tests/test_runner.html` directly in any modern web browser (Chrome, Firefox, Safari, Edge):
   ```
   file:///d:/SurvierLOL/MinecraftAntifravithy/tests/test_runner.html
   ```
2. The standalone runner immediately executes all 4 test tiers with zero network requests.
3. Features real-time progress bar, tier filter buttons, search filter box, expandable error traces, and JSON report export button.

---

## 5. Pass/Fail Thresholds & Quality Gate
- **Passing Threshold**: 100% of tests must pass (0 failures).
- **Execution Budget**: Total test suite duration must complete under 1000 ms.
- **Independence**: Each test must be completely isolated and self-contained.
- **Integrity**: Zero facade tests; all assertions must test observable behaviors, mathematical invariants, or interface contracts.
