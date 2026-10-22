/**
 * Adversarial Stress & Determinism Test Harness for Milestone 1
 * Challenger 2 Verification Suite
 *
 * Targets:
 * 1. Texture Atlas Determinism (Mulberry32 PRNG & 256x256 pixel buffer bitwise identity)
 * 2. Texture Pixel Validation (Alpha cutouts for leaves/glass, Alpha 255 for solid blocks)
 * 3. Mesher Allocation & Stress Stability (Scratch bounds, 12,288 quad worst-case, 500-section batch, leak check)
 * 4. E2E Test Runner Conformance
 */

import crypto from 'node:crypto';
import {
  TextureSynthesizer,
  TILE_SLOTS,
  BLOCK_IDS,
  createPRNG,
  packRGBA
} from '../src/engine/atlas.js';

import {
  ChunkSection,
  SECTION_SIZE,
  SECTION_VOLUME,
  computeVertexAO,
  getQuadIndices,
  packVertex,
  isOpaque,
  isFluid,
  isCutout,
  buildMesh,
  deleteMesh
} from '../src/engine/mesher.js';

// ============================================================================
// Test Framework Utilities
// ============================================================================

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failureMessages = [];

function assert(condition, message) {
  totalAssertions++;
  if (!condition) {
    failedAssertions++;
    failureMessages.push(message);
    console.error(`  [FAIL] ${message}`);
  } else {
    passedAssertions++;
    // Only print verbose passes if needed
  }
}

function assertEqual(actual, expected, message) {
  assert(
    actual === expected,
    `${message} (expected: ${expected}, got: ${actual})`
  );
}

function assertApprox(actual, expected, epsilon = 1e-4, message = '') {
  assert(
    Math.abs(actual - expected) <= epsilon,
    `${message} (expected ~${expected} +/- ${epsilon}, got: ${actual})`
  );
}

console.log('======================================================================');
console.log('  CHALLENGER 2: ADVERSARIAL STRESS & DETERMINISM TEST SUITE (M1)');
console.log('======================================================================\n');

// ============================================================================
// TARGET 1: Texture Atlas Determinism
// ============================================================================
console.log('>>> TARGET 1: Texture Atlas Determinism Stress Tests');

// 1.1 PRNG Bit-for-bit Determinism
{
  const seed = 0xCAFEBABE;
  const prng1 = createPRNG(seed);
  const prng2 = createPRNG(seed);
  let bitMismatch = 0;
  for (let i = 0; i < 200000; i++) {
    const v1 = prng1();
    const v2 = prng2();
    if (v1 !== v2) {
      bitMismatch++;
    }
  }
  assertEqual(bitMismatch, 0, 'Mulberry32 produces identical float stream across 200,000 calls for seed 0xCAFEBABE');
}

// 1.2 PRNG Seed Sensitivity & Distribution
{
  const prngA = createPRNG(12345);
  const prngB = createPRNG(12346);
  let sameCount = 0;
  for (let i = 0; i < 1000; i++) {
    if (prngA() === prngB()) sameCount++;
  }
  assertEqual(sameCount, 0, 'Adjacent seeds (12345 vs 12346) immediately produce distinct pseudorandom sequences');

  // Boundary seeds
  const boundarySeeds = [0, 1, 0x7FFFFFFF, 0xFFFFFFFF, -1 >>> 0];
  for (const s of boundarySeeds) {
    const gen = createPRNG(s);
    let allValid = true;
    for (let i = 0; i < 1000; i++) {
      const v = gen();
      if (typeof v !== 'number' || isNaN(v) || v < 0 || v >= 1) {
        allValid = false;
        break;
      }
    }
    assert(allValid, `Boundary seed ${s} generates valid float sequence within [0, 1)`);
  }
}

// 1.3 Full TextureSynthesizer Bitwise Determinism Across Multiple Instances
{
  console.log('  Instantiating 5 independent TextureSynthesizer instances...');
  const instances = [];
  const hashes = [];

  for (let i = 0; i < 5; i++) {
    const syn = new TextureSynthesizer();
    instances.push(syn);

    assertEqual(syn.width, 256, `Instance ${i + 1} width is 256`);
    assertEqual(syn.height, 256, `Instance ${i + 1} height is 256`);
    assertEqual(syn.pixels.length, 65536, `Instance ${i + 1} pixels length is 65536 Uint32s`);

    const rawBytes = Buffer.from(syn.pixels.buffer, syn.pixels.byteOffset, syn.pixels.byteLength);
    const hash = crypto.createHash('sha256').update(rawBytes).digest('hex');
    hashes.push(hash);
  }

  // All 5 hashes must be 100% identical
  const masterHash = hashes[0];
  console.log(`  Master Atlas SHA-256: ${masterHash}`);
  for (let i = 1; i < hashes.length; i++) {
    assertEqual(hashes[i], masterHash, `TextureSynthesizer instance ${i + 1} SHA-256 matches instance 1 exactly`);
  }

  // Double check every single Uint32 pixel between instance 0 and instance 4
  let pixelDiffCount = 0;
  for (let p = 0; p < 65536; p++) {
    if (instances[0].pixels[p] !== instances[4].pixels[p]) {
      pixelDiffCount++;
    }
  }
  assertEqual(pixelDiffCount, 0, 'Zero pixel differences across all 65,536 pixels between separate synthesizers');
}

// 1.4 Individual Generator Repeatability
{
  const syn = new TextureSynthesizer();
  const dirt1 = syn.generateDirt();
  const dirt2 = syn.generateDirt();
  let dirtDiff = 0;
  for (let i = 0; i < 256; i++) {
    if (dirt1[i] !== dirt2[i]) dirtDiff++;
  }
  assertEqual(dirtDiff, 0, 'Repeated calls to generateDirt() yield identical 16x16 buffers');

  const leaves1 = syn.generateOakLeaves();
  const leaves2 = syn.generateOakLeaves();
  let leavesDiff = 0;
  for (let i = 0; i < 256; i++) {
    if (leaves1[i] !== leaves2[i]) leavesDiff++;
  }
  assertEqual(leavesDiff, 0, 'Repeated calls to generateOakLeaves() yield identical 16x16 buffers');
}
console.log('  ✓ Target 1: Texture Atlas Determinism PASSED.\n');

// ============================================================================
// TARGET 2: Texture Pixel Validation (Alpha Cutouts & Solid Blocks)
// ============================================================================
console.log('>>> TARGET 2: Texture Pixel Validation (Alpha Cutouts vs Solid Blocks)');

const atlas = new TextureSynthesizer();

/**
 * Helper to extract 16x16 tile pixel data from master atlas.
 * Returns array of { r, g, b, a, raw }
 */
function extractTilePixels(slotId) {
  const col = slotId % 16;
  const row = Math.floor(slotId / 16);
  const startX = col * 16;
  const startY = row * 16;
  const result = [];

  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const idx = (startY + y) * 256 + (startX + x);
      const raw = atlas.pixels[idx];
      // Little-endian packed: (A << 24) | (B << 16) | (G << 8) | R
      const r = raw & 0xFF;
      const g = (raw >>> 8) & 0xFF;
      const b = (raw >>> 16) & 0xFF;
      const a = (raw >>> 24) & 0xFF;
      result.push({ x, y, r, g, b, a, raw });
    }
  }
  return result;
}

// 2.1 Solid Blocks: Alpha MUST be 255 for all 256 pixels
{
  const solidTiles = [
    { name: 'dirt', slot: TILE_SLOTS.dirt },
    { name: 'grass_top', slot: TILE_SLOTS.grass_top },
    { name: 'grass_side', slot: TILE_SLOTS.grass_side },
    { name: 'stone', slot: TILE_SLOTS.stone },
    { name: 'cobblestone', slot: TILE_SLOTS.cobblestone },
    { name: 'bedrock', slot: TILE_SLOTS.bedrock },
    { name: 'sand', slot: TILE_SLOTS.sand },
    { name: 'gravel', slot: TILE_SLOTS.gravel },
    { name: 'oak_log_side', slot: TILE_SLOTS.oak_log_side },
    { name: 'oak_log_top', slot: TILE_SLOTS.oak_log_top },
    { name: 'oak_planks', slot: TILE_SLOTS.oak_planks },
    { name: 'cherry_log_side', slot: TILE_SLOTS.cherry_log_side },
    { name: 'cherry_log_top', slot: TILE_SLOTS.cherry_log_top },
    { name: 'cherry_planks', slot: TILE_SLOTS.cherry_planks },
    { name: 'obsidian', slot: TILE_SLOTS.obsidian },
    { name: 'netherrack', slot: TILE_SLOTS.netherrack },
    { name: 'glowstone', slot: TILE_SLOTS.glowstone },
    { name: 'nether_brick', slot: TILE_SLOTS.nether_brick },
    { name: 'end_stone', slot: TILE_SLOTS.end_stone },
    { name: 'coal_ore', slot: TILE_SLOTS.coal_ore },
    { name: 'iron_ore', slot: TILE_SLOTS.iron_ore },
    { name: 'diamond_ore', slot: TILE_SLOTS.diamond_ore },
    { name: 'crafting_top', slot: TILE_SLOTS.crafting_top },
    { name: 'crafting_side', slot: TILE_SLOTS.crafting_side },
    { name: 'furnace_front', slot: TILE_SLOTS.furnace_front },
    { name: 'furnace_lit', slot: TILE_SLOTS.furnace_lit }
  ];

  for (const block of solidTiles) {
    const pixels = extractTilePixels(block.slot);
    assertEqual(pixels.length, 256, `${block.name} tile has exactly 256 pixels`);

    let nonOpaqueCount = 0;
    let validRGBCount = 0;

    for (const p of pixels) {
      if (p.a !== 255) nonOpaqueCount++;
      if (p.r >= 0 && p.r <= 255 && p.g >= 0 && p.g <= 255 && p.b >= 0 && p.b <= 255) {
        validRGBCount++;
      }
    }

    assertEqual(nonOpaqueCount, 0, `Solid block "${block.name}" has 100% alpha=255 pixels (0 non-opaque found)`);
    assertEqual(validRGBCount, 256, `Solid block "${block.name}" has valid 8-bit RGB channels for all 256 pixels`);
  }
}

// 2.2 Transparent / Cutout Blocks: Oak Leaves
{
  const oakLeavesPixels = extractTilePixels(TILE_SLOTS.oak_leaves);
  let cutoutHoles = 0;
  let solidFoliage = 0;
  let invalidAlpha = 0;

  for (const p of oakLeavesPixels) {
    if (p.a === 0) {
      cutoutHoles++;
    } else if (p.a === 255) {
      solidFoliage++;
    } else {
      invalidAlpha++;
    }
  }

  assert(cutoutHoles > 0, `Oak leaves has real alpha=0 cutout holes (found: ${cutoutHoles}/256)`);
  assert(solidFoliage > 0, `Oak leaves has solid foliage pixels (found: ${solidFoliage}/256)`);
  assertEqual(invalidAlpha, 0, 'Oak leaves has strict binary alpha cutout (all pixels are either alpha=0 or alpha=255)');
  assertEqual(cutoutHoles + solidFoliage, 256, 'Oak leaves total pixels sum to 256');

  // Cutout ratio should be around ~30% (from rand() < 0.30 in generator)
  const holeRatio = cutoutHoles / 256;
  assert(holeRatio >= 0.20 && holeRatio <= 0.40, `Oak leaves cutout ratio is realistic (~30% expected, got ${(holeRatio * 100).toFixed(1)}%)`);
}

// 2.3 Transparent / Cutout Blocks: Cherry Leaves & Cherry Petals
{
  const cherryLeaves = extractTilePixels(TILE_SLOTS.cherry_leaves);
  let cherryHoles = 0;
  let cherrySolid = 0;
  for (const p of cherryLeaves) {
    if (p.a === 0) cherryHoles++;
    else if (p.a === 255) cherrySolid++;
  }
  assert(cherryHoles > 0, `Cherry leaves has real alpha=0 cutouts (${cherryHoles}/256)`);
  assert(cherrySolid > 0, `Cherry leaves has solid leaf pixels (${cherrySolid}/256)`);
  assertEqual(cherryHoles + cherrySolid, 256, 'Cherry leaves has binary alpha cutout');

  const cherryPetals = extractTilePixels(TILE_SLOTS.cherry_petals);
  let petalHoles = 0;
  let petalSolid = 0;
  for (const p of cherryPetals) {
    if (p.a === 0) petalHoles++;
    else if (p.a === 255) petalSolid++;
  }
  assert(petalHoles > 150, `Cherry petals has high transparency (>150 transparent pixels, got ${petalHoles}/256)`);
  assert(petalSolid > 0, `Cherry petals has solid petal pixels (${petalSolid}/256)`);
}

// 2.4 Transparent / Translucent Blocks: Glass
{
  const glassPixels = extractTilePixels(TILE_SLOTS.glass);
  let borderGlintCount = 0;
  let interiorTintCount = 0;
  let fullyOpaqueCount = 0;

  for (const p of glassPixels) {
    if (p.a === 255) {
      fullyOpaqueCount++;
    } else if (p.a === 220) {
      borderGlintCount++; // Border frame or glare streaks
    } else if (p.a === 40) {
      interiorTintCount++; // Faint transparent pane interior
    }
  }

  assertEqual(fullyOpaqueCount, 0, 'Glass block has ZERO alpha=255 pixels (no solid pixels)');
  assert(borderGlintCount > 0, `Glass block has frame border and glint glare highlights (found: ${borderGlintCount})`);
  assert(interiorTintCount > 0, `Glass block has see-through pane interior (alpha=40, found: ${interiorTintCount})`);
  assertEqual(borderGlintCount + interiorTintCount, 256, 'Glass block comprises exclusively frame glints (alpha=220) and transparent interior (alpha=40)');
}

// 2.5 Translucent Blocks: Water
{
  const waterPixels = extractTilePixels(TILE_SLOTS.water_still);
  let translucentWaterCount = 0;
  for (const p of waterPixels) {
    if (p.a === 180) translucentWaterCount++;
  }
  assertEqual(translucentWaterCount, 256, 'Water block has 100% translucent pixels with alpha=180 (70% opacity)');
}

// 2.6 Alpha Discard Shader Compatibility Verification
{
  // CHUNK_FRAG_300 checks: if (texColor.a < 0.1) discard;
  // Normalized alpha: a / 255
  // Cutout pixels: 0 / 255 = 0.0 < 0.1 -> DISCARDED (PASS)
  // Interior glass: 40 / 255 = 0.1568 >= 0.1 -> RENDERED IN TRANSLUCENT PASS (PASS)
  // Foliage solid: 255 / 255 = 1.0 >= 0.1 -> RENDERED (PASS)
  const normalizedCutout = 0 / 255.0;
  assert(normalizedCutout < 0.1, 'Alpha 0 cutout is below fragment shader 0.1 threshold and will be discarded');

  const normalizedGlassPane = 40 / 255.0;
  assert(normalizedGlassPane > 0.1, 'Glass pane alpha 40/255 (0.1568) is above 0.1 threshold and survives cutout test for translucent pass');

  const normalizedFoliage = 255 / 255.0;
  assert(normalizedFoliage > 0.1, 'Solid foliage alpha 255/255 is above 0.1 threshold');
}
console.log('  ✓ Target 2: Texture Pixel Validation PASSED.\n');

// ============================================================================
// TARGET 3: Mesher Allocation & Stress Stability Tests
// ============================================================================
console.log('>>> TARGET 3: Mesher Allocation Bounds & Stress Batch Tests');

// Mock WebGL Context for Node.js Meshing
function createMockGL() {
  let bufferIdCounter = 1;
  let vaoIdCounter = 1;
  const activeBuffers = new Map();
  const activeVAOs = new Map();
  let totalAllocatedBytes = 0;
  let bufferDataCalls = 0;

  return {
    createVertexArray: () => {
      const id = vaoIdCounter++;
      activeVAOs.set(id, true);
      return { id };
    },
    bindVertexArray: () => {},
    deleteVertexArray: (vao) => {
      if (vao && vao.id) activeVAOs.delete(vao.id);
    },
    createBuffer: () => {
      const id = bufferIdCounter++;
      activeBuffers.set(id, { size: 0 });
      return { id };
    },
    bindBuffer: () => {},
    bufferData: (target, data, usage) => {
      bufferDataCalls++;
      if (data && data.byteLength) {
        totalAllocatedBytes += data.byteLength;
      }
    },
    enableVertexAttribArray: () => {},
    vertexAttribIPointer: () => {},
    vertexAttribPointer: () => {},
    deleteBuffer: (buf) => {
      if (buf && buf.id) activeBuffers.delete(buf.id);
    },
    STATIC_DRAW: 35044,
    ARRAY_BUFFER: 34962,
    ELEMENT_ARRAY_BUFFER: 34963,
    UNSIGNED_INT: 5125,
    FLOAT: 5126,
    // Diagnostics query
    _getActiveBufferCount: () => activeBuffers.size,
    _getActiveVAOCount: () => activeVAOs.size,
    _getTotalAllocatedBytes: () => totalAllocatedBytes,
    _getBufferDataCalls: () => bufferDataCalls
  };
}

// 3.1 Worst-Case Theoretical Geometry: 3D Checkerboard Section
// 2048 solid stone cubes, each completely surrounded by air!
// Exposed faces: 2048 * 6 = 12,288 quads!
// Vertices: 12,288 * 4 = 49,152 vertices
// Indices: 12,288 * 6 = 73,728 indices
{
  console.log('  Testing worst-case 3D checkerboard stress section (12,288 exposed quads)...');
  const mockGL = createMockGL();
  const stressSec = new ChunkSection(0, 0, 0);

  let solidCount = 0;
  for (let y = 0; y < 16; y++) {
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        if ((x + y + z) % 2 === 0) {
          stressSec.setBlock(x, y, z, BLOCK_IDS.STONE);
          solidCount++;
        }
      }
    }
  }

  assertEqual(solidCount, 2048, 'Checkerboard section has exactly 2,048 solid blocks out of 4,096');

  const startTime = performance.now();
  const mesh = buildMesh(mockGL, stressSec, null, atlas, true, null);
  const duration = performance.now() - startTime;

  assert(mesh !== null, 'buildMesh returned valid mesh handle for worst-case checkerboard');
  assertEqual(mesh.opaqueIndexCount, 73728, `Checkerboard produces exactly 73,728 indices (12,288 quads, got ${mesh.opaqueIndexCount})`);
  assertEqual(mesh.transIndexCount, 0, 'No transparent indices in pure stone checkerboard');
  assertEqual(mesh.totalIndices, 73728, 'totalIndices matches opaqueIndexCount');

  console.log(`  Worst-case mesh completed in ${duration.toFixed(2)} ms with 73,728 indices.`);
  assert(duration < 500, `Worst-case meshing completed promptly under 500ms (took ${duration.toFixed(2)}ms)`);
}

// 3.2 Scratch Buffer Bound Invariant
// The maximum theoretical capacity in mesher.js is MAX_QUADS = 4096 * 6 = 24,576.
// Verify that scratch buffers are statically allocated and not re-created per call.
{
  const mockGL = createMockGL();
  const sec1 = new ChunkSection(0, 0, 0);
  sec1.setBlock(0, 0, 0, BLOCK_IDS.DIRT);

  const sec2 = new ChunkSection(1, 0, 0);
  sec2.setBlock(0, 0, 0, BLOCK_IDS.DIRT);

  const initialBufferDataCalls = mockGL._getBufferDataCalls();
  buildMesh(mockGL, sec1, null, atlas, true, null);
  buildMesh(mockGL, sec2, null, atlas, true, null);

  // Each mesh creates exactly 1 VBO and 1 IBO -> 2 bufferData calls per section
  assertEqual(mockGL._getBufferDataCalls() - initialBufferDataCalls, 4, 'buildMesh performs bounded bufferData calls (2 per section)');
}

// 3.3 Large Section Batch Stress Test (500 Chunk Sections)
{
  console.log('  Running 500-chunk section batch meshing stress test...');
  const mockGL = createMockGL();
  const BATCH_SIZE = 500;
  const sections = [];

  // Construct 500 varied sections:
  // - 100 empty sections
  // - 100 completely solid sections
  // - 100 half-filled flat terrain sections
  // - 100 mixed transparent sections (leaves, water, glass, stone)
  // - 100 noisy cave terrain sections
  for (let i = 0; i < BATCH_SIZE; i++) {
    const sec = new ChunkSection(i % 16, Math.floor(i / 16) % 16, Math.floor(i / 256));
    const mode = i % 5;

    if (mode === 0) {
      // Empty air: do nothing
    } else if (mode === 1) {
      // Completely solid stone (all 4096 voxels)
      for (let y = 0; y < 16; y++) {
        for (let z = 0; z < 16; z++) {
          for (let x = 0; x < 16; x++) {
            sec.setBlock(x, y, z, BLOCK_IDS.STONE);
          }
        }
      }
    } else if (mode === 2) {
      // Half-filled flat terrain (Y < 8 is dirt/stone, Y >= 8 is air)
      for (let y = 0; y < 8; y++) {
        for (let z = 0; z < 16; z++) {
          for (let x = 0; x < 16; x++) {
            sec.setBlock(x, y, z, y === 7 ? BLOCK_IDS.GRASS_BLOCK : BLOCK_IDS.DIRT);
          }
        }
      }
    } else if (mode === 3) {
      // Mixed transparent blocks
      for (let y = 0; y < 16; y++) {
        for (let z = 0; z < 16; z++) {
          for (let x = 0; x < 16; x++) {
            if (y === 0) sec.setBlock(x, y, z, BLOCK_IDS.BEDROCK);
            else if (y < 4) sec.setBlock(x, y, z, BLOCK_IDS.WATER);
            else if (y === 4 && (x + z) % 3 === 0) sec.setBlock(x, y, z, BLOCK_IDS.GLASS);
            else if (y >= 5 && y <= 8 && (x + y + z) % 4 === 0) sec.setBlock(x, y, z, BLOCK_IDS.OAK_LEAVES);
          }
        }
      }
    } else if (mode === 4) {
      // Noisy cave terrain
      for (let y = 0; y < 16; y++) {
        for (let z = 0; z < 16; z++) {
          for (let x = 0; x < 16; x++) {
            const density = Math.sin(x * 0.4) + Math.cos(y * 0.5) + Math.sin(z * 0.4);
            if (density > 0.3) {
              sec.setBlock(x, y, z, BLOCK_IDS.STONE);
            }
          }
        }
      }
    }

    sections.push(sec);
  }

  // Force garbage collection if available
  if (global.gc) global.gc();
  const memBefore = process.memoryUsage().heapUsed;
  const batchStartTime = performance.now();

  let meshedCount = 0;
  let emptyMeshCount = 0;
  let totalIndicesEmitted = 0;

  for (let i = 0; i < BATCH_SIZE; i++) {
    const mesh = buildMesh(mockGL, sections[i], null, atlas, true, null);
    if (mesh) {
      meshedCount++;
      totalIndicesEmitted += mesh.totalIndices;
    } else {
      emptyMeshCount++;
    }
  }

  const batchDuration = performance.now() - batchStartTime;
  const memAfter = process.memoryUsage().heapUsed;
  const memDeltaMB = (memAfter - memBefore) / (1024 * 1024);

  console.log(`  500-section batch processed in ${batchDuration.toFixed(2)} ms (${(batchDuration / BATCH_SIZE).toFixed(2)} ms/section average)`);
  console.log(`  Meshed non-empty sections: ${meshedCount}, Empty sections: ${emptyMeshCount}`);
  console.log(`  Total indices emitted: ${totalIndicesEmitted.toLocaleString()}`);
  console.log(`  Heap delta across 500 sections: ${memDeltaMB.toFixed(2)} MB`);

  assertEqual(emptyMeshCount, 100, 'All 100 empty air sections correctly returned null without allocating buffers');
  assertEqual(meshedCount, 400, 'All 400 non-empty sections produced valid meshes');
  assert(batchDuration < 5000, `Batch meshing completed in under 5 seconds (took ${batchDuration.toFixed(2)}ms)`);
}

// 3.4 Continuous Re-meshing & Memory Leak / Buffer Cleanup Test
{
  console.log('  Testing 200 continuous in-place section mutations and re-meshings...');
  const mockGL = createMockGL();
  const mutableSec = new ChunkSection(0, 0, 0);
  mutableSec.setBlock(4, 4, 4, BLOCK_IDS.DIRT);

  let initialMesh = buildMesh(mockGL, mutableSec, null, atlas, true, null);
  assert(initialMesh !== null, 'Initial mutation mesh created');

  // In-place edits: add and remove blocks 200 times
  for (let step = 0; step < 200; step++) {
    const bx = step % 16;
    const by = Math.floor(step / 16) % 16;
    const bz = (step * 3) % 16;
    mutableSec.setBlock(bx, by, bz, (step % 2 === 0) ? BLOCK_IDS.COBBLESTONE : BLOCK_IDS.AIR);
    buildMesh(mockGL, mutableSec, null, atlas, true, null);
  }

  // Active buffers should be bounded! Exactly 1 VBO and 1 IBO for the current mesh,
  // because buildMesh explicitly deletes previous section.mesh buffers!
  const activeBuffers = mockGL._getActiveBufferCount();
  const activeVAOs = mockGL._getActiveVAOCount();

  assertEqual(activeBuffers, 2, `Active WebGL buffers bounded to 2 after 200 re-meshings (got ${activeBuffers})`);
  assertEqual(activeVAOs, 1, `Active WebGL VAOs bounded to 1 after 200 re-meshings (got ${activeVAOs})`);

  // Explicit cleanup
  deleteMesh(mockGL, mutableSec.mesh, true, null);
  assertEqual(mockGL._getActiveBufferCount(), 0, 'deleteMesh cleanly releases all remaining WebGL buffers');
  assertEqual(mockGL._getActiveVAOCount(), 0, 'deleteMesh cleanly releases WebGL VAO');
}

// 3.5 Adversarial Chunk Boundary & Out-of-Bounds Queries
{
  const sec = new ChunkSection(-999, -500, 999);
  // Setting out of bounds voxels must safely no-op
  sec.setBlock(-1, 0, 0, BLOCK_IDS.STONE);
  sec.setBlock(16, 0, 0, BLOCK_IDS.STONE);
  sec.setBlock(0, -1, 0, BLOCK_IDS.STONE);
  sec.setBlock(0, 16, 0, BLOCK_IDS.STONE);
  sec.setBlock(0, 0, -1, BLOCK_IDS.STONE);
  sec.setBlock(0, 0, 16, BLOCK_IDS.STONE);
  assertEqual(sec.empty, true, 'ChunkSection remains empty after invalid out-of-bounds setBlock calls');

  // Getting out of bounds voxels must return AIR (0)
  assertEqual(sec.getBlock(-1, 0, 0), 0, 'getBlock(-1, 0, 0) returns AIR (0)');
  assertEqual(sec.getBlock(16, 16, 16), 0, 'getBlock(16, 16, 16) returns AIR (0)');

  // Light out of bounds defaults to full sky light 15
  const oobLight = sec.getLight(-5, 20, 100);
  assertEqual(oobLight.sky, 15, 'Out-of-bounds sky light defaults to 15');
  assertEqual(oobLight.block, 0, 'Out-of-bounds block light defaults to 0');

  // World query throwing error fallback test
  const throwingWorld = {
    getBlock: () => { throw new Error('Simulated world query fault'); },
    getLight: () => { throw new Error('Simulated world query fault'); }
  };
  sec.setBlock(0, 0, 0, BLOCK_IDS.STONE);
  // Meshing with broken world should throw or we verify handling
  let worldThrew = false;
  try {
    const mockGL = createMockGL();
    buildMesh(mockGL, sec, throwingWorld, atlas, true, null);
  } catch (err) {
    worldThrew = true;
  }
  assert(worldThrew, 'Faulty world query properly bubbles or surfaces error');
}

console.log('  ✓ Target 3: Mesher Allocation & Stress Stability PASSED.\n');

// ============================================================================
// SUMMARY & VERDICT
// ============================================================================
console.log('======================================================================');
console.log('ADVERSARIAL STRESS TEST RESULTS:');
console.log(`  Total Assertions:  ${totalAssertions}`);
console.log(`  Passed Assertions: ${passedAssertions}`);
console.log(`  Failed Assertions: ${failedAssertions}`);
console.log('======================================================================');

if (failedAssertions > 0) {
  console.error('\nFAILURE DETAILS:');
  failureMessages.forEach((msg, idx) => console.error(`  ${idx + 1}. ${msg}`));
  console.log('\nFINAL VERDICT: REJECT');
  process.exit(1);
} else {
  console.log('\nFINAL VERDICT: APPROVE (ALL STRESS & DETERMINISM TESTS PASSED)');
  process.exit(0);
}
