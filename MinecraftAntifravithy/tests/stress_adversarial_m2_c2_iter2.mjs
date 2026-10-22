/**
 * Milestone 2 Iteration 2 Challenger 2 Empirical Adversarial Stress Suite
 * Author: Challenger 2
 *
 * Scopes Tested:
 * 1. BUG-PORTAL-01 Resolution & Consecutive findOrCreateNetherPortal Stress
 * 2. Nether Portal Frame Validation Across Orientations (X and Z) and Dimensions
 * 3. End Portal Frame Activation and Portal Block Filling
 * 4. Consecutive Dimension Switching & Player Position Integrity
 * 5. Bounding Box Intersection Accuracy for Fractional Sub-Unit Boxes
 */

import { BLOCK } from '../src/world/chunk.js';
import {
  validateNetherPortalFrame,
  igniteNetherPortal,
  extinguishNetherPortal,
  scaleCoordinate,
  findOrCreateNetherPortal,
  validateEndPortalFrame,
  activateEndPortal,
  prepareEndSpawnPlatform
} from '../src/world/portals.js';
import { WorldManager, DIMENSION } from '../src/world/world.js';

// ============================================================================
// Assertion Harness
// ============================================================================

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failures = [];
const bugsFound = [];

function assert(condition, message) {
  totalAssertions++;
  if (!condition) {
    failedAssertions++;
    failures.push(message);
    console.error(`  [FAIL] ${message}`);
  } else {
    passedAssertions++;
  }
}

function assertEqual(actual, expected, message) {
  assert(
    actual === expected,
    `${message} (expected: ${expected}, got: ${actual})`
  );
}

function assertTrue(actual, message) {
  assert(actual === true, `${message} (expected true, got: ${actual})`);
}

function assertFalse(actual, message) {
  assert(actual === false, `${message} (expected false, got: ${actual})`);
}

function recordBug(bugId, title, description) {
  bugsFound.push({ bugId, title, description });
  console.warn(`  [BUG DETECTED] ${bugId}: ${title}`);
}

// ============================================================================
// MockWorld for Pure Portal Geometry Tests
// ============================================================================

class MockWorld {
  constructor() {
    this.blocks = new Map();
    this.currentDimension = 0;
  }
  _key(x, y, z, dim = this.currentDimension) {
    return `${dim}:${x},${y},${z}`;
  }
  getBlock(x, y, z, dim = this.currentDimension) {
    return this.blocks.get(this._key(x, y, z, dim)) || BLOCK.AIR;
  }
  setBlock(x, y, z, id, dim = this.currentDimension) {
    this.blocks.set(this._key(x, y, z, dim), id);
  }
  clear() {
    this.blocks.clear();
    this.currentDimension = 0;
  }
}

function buildNetherFrame(world, options = {}) {
  const {
    startX = 10,
    startY = 20,
    startZ = 10,
    outerW = 4,
    outerH = 5,
    axis = 'X',
    hasCorners = true,
    cornerBlock = BLOCK.OBSIDIAN,
    interiorBlock = BLOCK.AIR,
    dimension = 0
  } = options;

  const dx = axis === 'X' ? 1 : 0;
  const dz = axis === 'Z' ? 1 : 0;

  for (let w = 0; w < outerW; w++) {
    for (let h = 0; h < outerH; h++) {
      const bx = startX + dx * w;
      const by = startY + h;
      const bz = startZ + dz * w;

      const isCorner =
        (w === 0 && h === 0) ||
        (w === outerW - 1 && h === 0) ||
        (w === 0 && h === outerH - 1) ||
        (w === outerW - 1 && h === outerH - 1);

      const isBorder =
        w === 0 || w === outerW - 1 || h === 0 || h === outerH - 1;

      if (isCorner) {
        if (hasCorners) {
          world.setBlock(bx, by, bz, cornerBlock, dimension);
        } else {
          world.setBlock(bx, by, bz, BLOCK.AIR, dimension);
        }
      } else if (isBorder) {
        world.setBlock(bx, by, bz, BLOCK.OBSIDIAN, dimension);
      } else {
        world.setBlock(bx, by, bz, interiorBlock, dimension);
      }
    }
  }

  return {
    queryX: startX + dx * 1,
    queryY: startY + 1,
    queryZ: startZ + dz * 1,
    startX,
    startY,
    startZ,
    axis
  };
}

function buildEndFrame(world, cx, cy, cz, options = {}) {
  const { eyeCount = 12, cornerBlock = BLOCK.AIR, dimension = 0 } = options;

  const socketCoords = [
    { x: cx - 1, y: cy, z: cz - 2 },
    { x: cx + 0, y: cy, z: cz - 2 },
    { x: cx + 1, y: cy, z: cz - 2 },
    { x: cx + 2, y: cy, z: cz - 1 },
    { x: cx + 2, y: cy, z: cz + 0 },
    { x: cx + 2, y: cy, z: cz + 1 },
    { x: cx + 1, y: cy, z: cz + 2 },
    { x: cx + 0, y: cy, z: cz + 2 },
    { x: cx - 1, y: cy, z: cz + 2 },
    { x: cx - 2, y: cy, z: cz + 1 },
    { x: cx - 2, y: cy, z: cz + 0 },
    { x: cx - 2, y: cy, z: cz - 1 }
  ];

  for (let i = 0; i < socketCoords.length; i++) {
    const s = socketCoords[i];
    if (i < eyeCount) {
      world.setBlock(s.x, s.y, s.z, BLOCK.END_PORTAL_FRAME, dimension);
    } else {
      world.setBlock(s.x, s.y, s.z, BLOCK.AIR, dimension);
    }
  }

  const corners = [
    { x: cx - 2, z: cz - 2 },
    { x: cx + 2, z: cz - 2 },
    { x: cx - 2, z: cz + 2 },
    { x: cx + 2, z: cz + 2 }
  ];
  for (const c of corners) {
    world.setBlock(c.x, cy, c.z, cornerBlock, dimension);
  }
}

console.log('======================================================================');
console.log('  MILESTONE 2 ITERATION 2 CHALLENGER 2 EMPIRICAL ADVERSARIAL SUITE');
console.log('======================================================================\n');

// ============================================================================
// SUITE 1: BUG-PORTAL-01 Resolution & Consecutive findOrCreateNetherPortal Stress
// ============================================================================
console.log('--- Suite 1: BUG-PORTAL-01 Resolution & findOrCreateNetherPortal Stress ---');

{
  // 1.1 Empirical Verification of BUG-PORTAL-01 Fix Across Coordinates in Nether (-1)
  const netherTestCoords = [
    { x: 0, y: 64, z: 0, label: 'Origin (0, 64, 0)' },
    { x: 40, y: 64, z: 80, label: 'Original C2 failure point (40, 64, 80)' },
    { x: -125, y: 50, z: -350, label: 'Negative coordinates (-125, 50, -350)' },
    { x: 800, y: 30, z: 1200, label: 'Deep Nether low altitude (800, 30, 1200)' },
    { x: -500, y: 100, z: 500, label: 'Upper Nether high altitude (-500, 100, 500)' },
    { x: 17, y: 64, z: 19, label: 'Odd coordinate alignment (17, 64, 19)' },
    { x: -3, y: 64, z: 5, label: 'Near-zero mixed sign (-3, 64, 5)' }
  ];

  for (const tc of netherTestCoords) {
    const world = new MockWorld();
    world.currentDimension = -1;

    // Call 1: Must create fresh fallback portal
    const res1 = findOrCreateNetherPortal(world, tc.x, tc.y, tc.z, -1);
    assertTrue(res1.created, `First call creates portal at ${tc.label}`);
    assertEqual(res1.x, tc.x + 1.5, `Spawn X centered in inner frame (+1.5) at ${tc.label}`);
    assertEqual(res1.z, tc.z + 0.5, `Spawn Z centered in portal thickness (+0.5) at ${tc.label}`);

    // Call 2: Immediate consecutive call at EXACT same coordinates
    // Prior to fix, BUG-PORTAL-01 returned res2.created === true due to modulo 4 stride blind spot
    const res2 = findOrCreateNetherPortal(world, tc.x, tc.y, tc.z, -1);
    assertFalse(res2.created, `Second call re-discovers existing portal without duplicate at ${tc.label}`);
    assertEqual(res2.x, res1.x, `Second call returns exact portal X at ${tc.label}`);
    assertEqual(res2.z, res1.z, `Second call returns exact portal Z at ${tc.label}`);

    // Call 3: Third consecutive call maintains idempotency
    const res3 = findOrCreateNetherPortal(world, tc.x, tc.y, tc.z, -1);
    assertFalse(res3.created, `Third call re-discovers existing portal at ${tc.label}`);
  }

  // 1.2 Empirical Verification of BUG-PORTAL-01 Fix Across Coordinates in Overworld (0)
  const owTestCoords = [
    { x: 0, y: 64, z: 0, label: 'Overworld Origin (0, 64, 0)' },
    { x: 320, y: 70, z: 640, label: 'Overworld positive coords (320, 70, 640)' },
    { x: -1000, y: 64, z: -2800, label: 'Overworld large negative coords (-1000, 64, -2800)' },
    { x: 15, y: 64, z: 31, label: 'Overworld boundary odd coords (15, 64, 31)' }
  ];

  for (const tc of owTestCoords) {
    const world = new MockWorld();
    world.currentDimension = 0;

    const r1 = findOrCreateNetherPortal(world, tc.x, tc.y, tc.z, 0);
    assertTrue(r1.created, `First call creates portal in Overworld at ${tc.label}`);

    const r2 = findOrCreateNetherPortal(world, tc.x, tc.y, tc.z, 0);
    assertFalse(r2.created, `Second call re-discovers existing portal in Overworld at ${tc.label}`);
    assertEqual(r2.x, r1.x, `Spawn X matches in Overworld at ${tc.label}`);
    assertEqual(r2.z, r1.z, `Spawn Z matches in Overworld at ${tc.label}`);
  }

  // 1.3 Perturbed Target Rediscovery within Search Radius (Nether R=16)
  {
    const world = new MockWorld();
    world.currentDimension = -1;
    const baseX = 100, baseY = 64, baseZ = 100;
    const baseRes = findOrCreateNetherPortal(world, baseX, baseY, baseZ, -1);
    assertTrue(baseRes.created, 'Base portal created in Nether');

    // Test perturbations within search radius 16
    const validOffsets = [
      { dx: 1, dz: 0 },
      { dx: 2, dz: 0 },
      { dx: -1, dz: 0 },
      { dx: 0, dz: 1 },
      { dx: 0, dz: -2 },
      { dx: 3, dz: 3 },
      { dx: -3, dz: -3 },
      { dx: 2, dz: 2 },
      { dx: -2, dz: 1 }
    ];

    for (const offset of validOffsets) {
      const qx = baseX + offset.dx;
      const qz = baseZ + offset.dz;
      const res = findOrCreateNetherPortal(world, qx, baseY, qz, -1);
      assertFalse(
        res.created,
        `Portal rediscovered within local probe radius at offset (${offset.dx}, ${offset.dz})`
      );
    }
  }

  // 1.4 Search Distance Cutoff: Beyond Search Radius MUST Create New Portal
  {
    const world = new MockWorld();
    world.currentDimension = -1;
    const p1 = findOrCreateNetherPortal(world, 0, 64, 0, -1);
    assertTrue(p1.created, 'Portal 1 created at origin');

    // In Nether, search radius is 16. A query at distance 50 must create a second portal
    const p2 = findOrCreateNetherPortal(world, 50, 64, 0, -1);
    assertTrue(p2.created, 'Portal 2 created beyond search radius (distance 50 > 16)');

    // In Overworld, search radius is 128. A query at distance 300 must create a second portal
    world.currentDimension = 0;
    const ow1 = findOrCreateNetherPortal(world, 0, 64, 0, 0);
    assertTrue(ow1.created, 'Overworld portal 1 created at origin');
    const ow2 = findOrCreateNetherPortal(world, 300, 64, 0, 0);
    assertTrue(ow2.created, 'Overworld portal 2 created beyond search radius (distance 300 > 128)');
  }

  // 1.5 Consecutive Calls on WorldManager (Tier 2 Delta Map Lookup)
  {
    const wm = new WorldManager(42);
    // Create portal via WorldManager in Nether
    const r1 = findOrCreateNetherPortal(wm, 16, 64, 16, DIMENSION.NETHER);
    assertTrue(r1.created, 'WorldManager creates Nether portal on first query');

    // WorldManager modifiedBlocks should contain NETHER_PORTAL blocks
    const hasPortalBlocks = Array.from(wm.modifiedBlocks[DIMENSION.NETHER].values()).includes(BLOCK.NETHER_PORTAL);
    assertTrue(hasPortalBlocks, 'WorldManager modifiedBlocks records NETHER_PORTAL blocks');

    // Second call via WorldManager must find it via Tier 1 or Tier 2
    const r2 = findOrCreateNetherPortal(wm, 16, 64, 16, DIMENSION.NETHER);
    assertFalse(r2.created, 'WorldManager re-discovers Nether portal on second query');

    // Slightly shifted query within search radius
    const r3 = findOrCreateNetherPortal(wm, 20, 64, 20, DIMENSION.NETHER);
    assertFalse(r3.created, 'WorldManager re-discovers Nether portal for shifted query (dx=4, dz=4)');
  }

  // 1.6 High-Volume Stress Benchmark (500 Consecutive findOrCreate Queries)
  {
    const world = new MockWorld();
    world.currentDimension = -1;
    const startT = Date.now();
    // First query creates portal
    const initial = findOrCreateNetherPortal(world, 200, 64, 200, -1);
    assertTrue(initial.created, 'Stress initial portal created');

    let allRediscovered = true;
    for (let i = 0; i < 500; i++) {
      // Alternate offsets between -3 and +3
      const dx = (i % 7) - 3;
      const dz = ((i * 3) % 7) - 3;
      const res = findOrCreateNetherPortal(world, 200 + dx, 64, 200 + dz, -1);
      if (res.created !== false) {
        allRediscovered = false;
        break;
      }
    }
    const elapsed = Date.now() - startT;
    assertTrue(allRediscovered, '500 consecutive findOrCreateNetherPortal queries all cleanly re-discovered');
    assert(elapsed < 2000, `500 queries completed within 2000ms (took ${elapsed}ms)`);
  }
}

// ============================================================================
// SUITE 2: Nether Portal Frame Validation Across Orientations & Dimensions
// ============================================================================
console.log('\n--- Suite 2: Nether Portal Frame Validation Across Orientations & Dimensions ---');

{
  const world = new MockWorld();

  // 2.1 Multi-Size Frame Validation across X and Z axes
  const frameSizes = [
    { outerW: 4, outerH: 5, innerW: 2, innerH: 3, label: 'Minimum 4x5 outer' },
    { outerW: 5, outerH: 6, innerW: 3, innerH: 4, label: 'Medium 5x6 outer' },
    { outerW: 7, outerH: 8, innerW: 5, innerH: 6, label: 'Large 7x8 outer' },
    { outerW: 10, outerH: 12, innerW: 8, innerH: 10, label: 'Extra-large 10x12 outer' },
    { outerW: 16, outerH: 16, innerW: 14, innerH: 14, label: 'Sub-chunk 16x16 outer' },
    { outerW: 23, outerH: 23, innerW: 21, innerH: 21, label: 'Maximum 23x23 outer' }
  ];

  for (const s of frameSizes) {
    // Orientation X
    world.clear();
    const frameX = buildNetherFrame(world, { outerW: s.outerW, outerH: s.outerH, axis: 'X', startX: 10, startY: 20, startZ: 10 });
    const resX = validateNetherPortalFrame(world, frameX.queryX, frameX.queryY, frameX.queryZ);
    assertTrue(resX.valid, `${s.label} along X-axis is valid`);
    assertEqual(resX.axis, 'X', `${s.label} along X-axis reports axis X`);
    assertEqual(resX.innerWidth, s.innerW, `${s.label} along X reports innerWidth ${s.innerW}`);
    assertEqual(resX.innerHeight, s.innerH, `${s.label} along X reports innerHeight ${s.innerH}`);

    // Orientation Z
    world.clear();
    const frameZ = buildNetherFrame(world, { outerW: s.outerW, outerH: s.outerH, axis: 'Z', startX: 10, startY: 20, startZ: 10 });
    const resZ = validateNetherPortalFrame(world, frameZ.queryX, frameZ.queryY, frameZ.queryZ);
    assertTrue(resZ.valid, `${s.label} along Z-axis is valid`);
    assertEqual(resZ.axis, 'Z', `${s.label} along Z-axis reports axis Z`);
    assertEqual(resZ.innerWidth, s.innerW, `${s.label} along Z reports innerWidth ${s.innerW}`);
    assertEqual(resZ.innerHeight, s.innerH, `${s.label} along Z reports innerHeight ${s.innerH}`);
  }

  // 2.2 Boundary Rejections (too small / too large)
  {
    // Too narrow: outer width 3 (inner width 1)
    world.clear();
    const narrow = buildNetherFrame(world, { outerW: 3, outerH: 5, axis: 'X' });
    const resNarrow = validateNetherPortalFrame(world, narrow.queryX, narrow.queryY, narrow.queryZ);
    assertFalse(resNarrow.valid, 'Frame with inner width 1 is rejected');

    // Too short: outer height 4 (inner height 2)
    world.clear();
    const shortF = buildNetherFrame(world, { outerW: 4, outerH: 4, axis: 'X' });
    const resShort = validateNetherPortalFrame(world, shortF.queryX, shortF.queryY, shortF.queryZ);
    assertFalse(resShort.valid, 'Frame with inner height 2 is rejected');

    // Too wide: outer width 24 (inner width 22)
    world.clear();
    const wide = buildNetherFrame(world, { outerW: 24, outerH: 5, axis: 'X' });
    const resWide = validateNetherPortalFrame(world, wide.queryX, wide.queryY, wide.queryZ);
    assertFalse(resWide.valid, 'Frame with inner width 22 is rejected');

    // Too tall: outer height 24 (inner height 22)
    world.clear();
    const tall = buildNetherFrame(world, { outerW: 4, outerH: 24, axis: 'X' });
    const resTall = validateNetherPortalFrame(world, tall.queryX, tall.queryY, tall.queryZ);
    assertFalse(resTall.valid, 'Frame with inner height 22 is rejected');
  }

  // 2.3 Perimeter Breaches
  {
    // Missing bottom border block
    world.clear();
    const frame = buildNetherFrame(world, { outerW: 4, outerH: 5, axis: 'X' });
    world.setBlock(frame.startX + 1, frame.startY, frame.startZ, BLOCK.AIR);
    const resBreachBottom = validateNetherPortalFrame(world, frame.queryX, frame.queryY, frame.queryZ);
    assertFalse(resBreachBottom.valid, 'Frame with breached bottom border is rejected');

    // Missing top border block
    world.clear();
    const frameT = buildNetherFrame(world, { outerW: 4, outerH: 5, axis: 'X' });
    world.setBlock(frameT.startX + 1, frameT.startY + 4, frameT.startZ, BLOCK.AIR);
    const resBreachTop = validateNetherPortalFrame(world, frameT.queryX, frameT.queryY, frameT.queryZ);
    assertFalse(resBreachTop.valid, 'Frame with breached top border is rejected');

    // Missing left pillar block
    world.clear();
    const frameL = buildNetherFrame(world, { outerW: 4, outerH: 5, axis: 'X' });
    world.setBlock(frameL.startX, frameL.startY + 2, frameL.startZ, BLOCK.AIR);
    const resBreachLeft = validateNetherPortalFrame(world, frameL.queryX, frameL.queryY, frameL.queryZ);
    assertFalse(resBreachLeft.valid, 'Frame with breached left pillar is rejected');

    // Missing right pillar block
    world.clear();
    const frameR = buildNetherFrame(world, { outerW: 4, outerH: 5, axis: 'X' });
    world.setBlock(frameR.startX + 3, frameR.startY + 2, frameR.startZ, BLOCK.AIR);
    const resBreachRight = validateNetherPortalFrame(world, frameR.queryX, frameR.queryY, frameR.queryZ);
    assertFalse(resBreachRight.valid, 'Frame with breached right pillar is rejected');
  }

  // 2.4 Missing Corner Tolerance (0, 1, 2, 3, 4 missing corners & non-obsidian corners)
  {
    for (let missingCount = 0; missingCount <= 4; missingCount++) {
      world.clear();
      const frame = buildNetherFrame(world, { outerW: 4, outerH: 5, axis: 'X', hasCorners: true });
      const corners = [
        { x: frame.startX + 0, y: frame.startY + 0, z: frame.startZ },
        { x: frame.startX + 3, y: frame.startY + 0, z: frame.startZ },
        { x: frame.startX + 0, y: frame.startY + 4, z: frame.startZ },
        { x: frame.startX + 3, y: frame.startY + 4, z: frame.startZ }
      ];
      for (let i = 0; i < missingCount; i++) {
        world.setBlock(corners[i].x, corners[i].y, corners[i].z, BLOCK.AIR);
      }
      const res = validateNetherPortalFrame(world, frame.queryX, frame.queryY, frame.queryZ);
      assertTrue(res.valid, `Frame with ${missingCount} missing corner(s) is valid`);
    }

    // Corners replaced with non-obsidian blocks (DIRT, COBBLESTONE)
    world.clear();
    const frameDirtCorners = buildNetherFrame(world, {
      outerW: 4,
      outerH: 5,
      axis: 'X',
      cornerBlock: BLOCK.DIRT
    });
    const resDirt = validateNetherPortalFrame(world, frameDirtCorners.queryX, frameDirtCorners.queryY, frameDirtCorners.queryZ);
    assertTrue(resDirt.valid, 'Frame with DIRT corners is valid');
  }

  // 2.5 Multi-Dimension Support in validateNetherPortalFrame, igniteNetherPortal, extinguishNetherPortal
  {
    world.clear();
    // Build frame strictly in Nether dimension (-1)
    const netherFrame = buildNetherFrame(world, {
      outerW: 4,
      outerH: 5,
      axis: 'X',
      dimension: -1
    });

    // Validating in dimension -1 must succeed
    const resDimNether = validateNetherPortalFrame(world, netherFrame.queryX, netherFrame.queryY, netherFrame.queryZ, -1);
    assertTrue(resDimNether.valid, 'Nether dimension frame validates with dimension: -1');

    // Validating same coordinates in dimension 0 (Overworld) must fail
    const resDimOW = validateNetherPortalFrame(world, netherFrame.queryX, netherFrame.queryY, netherFrame.queryZ, 0);
    assertFalse(resDimOW.valid, 'Nether dimension frame does not leak into Overworld dimension 0');

    // Ignite portal in Nether dimension (-1)
    const ignited = igniteNetherPortal(world, netherFrame.queryX, netherFrame.queryY, netherFrame.queryZ, -1);
    assertTrue(ignited, 'igniteNetherPortal returns true for Nether dimension (-1)');

    // Verify Nether portal blocks exist in Nether (-1)
    assertEqual(
      world.getBlock(netherFrame.queryX, netherFrame.queryY, netherFrame.queryZ, -1),
      BLOCK.NETHER_PORTAL,
      'Portal block created in Nether (-1)'
    );

    // Verify Nether portal blocks do NOT exist in Overworld (0)
    assertEqual(
      world.getBlock(netherFrame.queryX, netherFrame.queryY, netherFrame.queryZ, 0),
      BLOCK.AIR,
      'Overworld (0) contains AIR at same coordinate'
    );

    // Extinguish in Nether (-1)
    extinguishNetherPortal(world, netherFrame.queryX, netherFrame.queryY, netherFrame.queryZ, -1);
    assertEqual(
      world.getBlock(netherFrame.queryX, netherFrame.queryY, netherFrame.queryZ, -1),
      BLOCK.AIR,
      'Extinguished portal block converted to AIR in Nether (-1)'
    );
  }
}

// ============================================================================
// SUITE 3: End Portal Frame Activation and Portal Block Filling
// ============================================================================
console.log('\n--- Suite 3: End Portal Frame Activation & Filling ---');

{
  const world = new MockWorld();

  // 3.1 12 Eye of Ender Sockets Requirement
  const cx = 100, cy = 60, cz = 100;
  for (let eyes = 0; eyes <= 11; eyes++) {
    world.clear();
    buildEndFrame(world, cx, cy, cz, { eyeCount: eyes });
    const res = validateEndPortalFrame(world, cx, cy, cz);
    assertFalse(res.valid, `End Portal frame with ${eyes}/12 eyes is invalid`);
  }

  // Exactly 12 eyes
  world.clear();
  buildEndFrame(world, cx, cy, cz, { eyeCount: 12 });
  const res12 = validateEndPortalFrame(world, cx, cy, cz);
  assertTrue(res12.valid, 'End Portal frame with 12/12 eyes is valid');
  assertEqual(res12.centerX, cx, 'Detected center X is correct');
  assertEqual(res12.centerY, cy, 'Detected center Y is correct');
  assertEqual(res12.centerZ, cz, 'Detected center Z is correct');

  // Multi-point detection: querying from frame border rather than center
  const resNorthQuery = validateEndPortalFrame(world, cx, cy, cz - 2);
  assertTrue(resNorthQuery.valid, 'End Portal detected when queried from North frame block');
  assertEqual(resNorthQuery.centerX, cx, 'North query correctly locates center X');
  assertEqual(resNorthQuery.centerZ, cz, 'North query correctly locates center Z');

  // 3.2 End Portal Activation: Central 3x3 Fill
  world.clear();
  buildEndFrame(world, cx, cy, cz, { eyeCount: 12, dimension: 0 });
  const activated = activateEndPortal(world, cx, cy, cz, 0);
  assertTrue(activated, 'activateEndPortal returns true');

  let portalBlockCount = 0;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const b = world.getBlock(cx + dx, cy, cz + dz, 0);
      assertEqual(b, BLOCK.END_PORTAL, `Center (${dx}, ${dz}) is END_PORTAL (ID 25)`);
      portalBlockCount++;
    }
  }
  assertEqual(portalBlockCount, 9, 'Exactly 9 central END_PORTAL blocks generated');

  // Frame blocks remain intact
  assertEqual(world.getBlock(cx, cy, cz - 2, 0), BLOCK.END_PORTAL_FRAME, 'North frame intact');
  assertEqual(world.getBlock(cx + 2, cy, cz, 0), BLOCK.END_PORTAL_FRAME, 'East frame intact');
  assertEqual(world.getBlock(cx, cy, cz + 2, 0), BLOCK.END_PORTAL_FRAME, 'South frame intact');
  assertEqual(world.getBlock(cx - 2, cy, cz, 0), BLOCK.END_PORTAL_FRAME, 'West frame intact');

  // Dimension-aware End Portal validation & activation
  world.clear();
  buildEndFrame(world, cx, cy, cz, { eyeCount: 12, dimension: 1 });
  const valEnd = validateEndPortalFrame(world, cx, cy, cz, 1);
  assertTrue(valEnd.valid, 'End portal validates in dimension 1');
  const valEndOW = validateEndPortalFrame(world, cx, cy, cz, 0);
  assertFalse(valEndOW.valid, 'End portal does not validate in dimension 0 when built in dim 1');

  activateEndPortal(world, cx, cy, cz, 1);
  assertEqual(world.getBlock(cx, cy, cz, 1), BLOCK.END_PORTAL, 'Portal activated in dimension 1');
  assertEqual(world.getBlock(cx, cy, cz, 0), BLOCK.AIR, 'Dimension 0 remains unaffected AIR');
}

// ============================================================================
// SUITE 4: Consecutive Dimension Switching & Player Position Integrity
// ============================================================================
console.log('\n--- Suite 4: Consecutive Dimension Switching & Position Integrity ---');

{
  // 4.1 Overworld -> Nether -> Overworld Coordinate Transformation
  const wm = new WorldManager(777);

  // Transition OW -> Nether
  const startPos = { x: 80, y: 64, z: 160 };
  const netherPos = await wm.switchDimension(DIMENSION.NETHER, startPos);
  assertEqual(wm.getActiveDimension(), DIMENSION.NETHER, 'Active dimension is Nether');
  // Scaled 80/8 = 10, 160/8 = 20. Portal placed at 10, 64, 20 with spawn at 11.5, 65.0, 20.5
  assertEqual(netherPos.x, 11.5, 'Nether spawn X scaled and centered (+1.5)');
  assertEqual(netherPos.y, 65.0, 'Nether spawn Y on platform (+1.0)');
  assertEqual(netherPos.z, 20.5, 'Nether spawn Z centered (+0.5)');

  // Transition Nether -> Overworld
  const owReturnPos = await wm.switchDimension(DIMENSION.OVERWORLD, netherPos);
  assertEqual(wm.getActiveDimension(), DIMENSION.OVERWORLD, 'Active dimension returned to Overworld');
  // 11 * 8 = 88, 20 * 8 = 160. Overworld portal created/linked
  assert(Number.isFinite(owReturnPos.x), 'Overworld return X is finite number');
  assert(Number.isFinite(owReturnPos.y), 'Overworld return Y is finite number');
  assert(Number.isFinite(owReturnPos.z), 'Overworld return Z is finite number');

  // 4.2 Overworld -> The End Fixed Platform & Dynamic Return Spawn Altitude Across Seeds
  const testSeeds = [1, 42, 9999, 12345, 99999];
  for (const seed of testSeeds) {
    const wmSeed = new WorldManager(seed);

    // Switch to The End
    const endPos = await wmSeed.switchDimension(DIMENSION.THE_END, { x: 50, y: 70, z: -50 });
    assertEqual(endPos.dimension, DIMENSION.THE_END, `Seed ${seed}: dimension is THE_END`);
    assertEqual(endPos.x, 100.5, `Seed ${seed}: End spawn X is exactly 100.5`);
    assertEqual(endPos.y, 49.0, `Seed ${seed}: End spawn Y is exactly 49.0`);
    assertEqual(endPos.z, 0.5, `Seed ${seed}: End spawn Z is exactly 0.5`);

    // Verify obsidian pad at Y=48
    assertEqual(wmSeed.getBlock(100, 48, 0, DIMENSION.THE_END), BLOCK.OBSIDIAN, `Seed ${seed}: pad at Y=48 is OBSIDIAN`);
    // Verify headroom at Y=49, 50, 51
    assertEqual(wmSeed.getBlock(100, 49, 0, DIMENSION.THE_END), BLOCK.AIR, `Seed ${seed}: headroom Y=49 is AIR`);
    assertEqual(wmSeed.getBlock(100, 50, 0, DIMENSION.THE_END), BLOCK.AIR, `Seed ${seed}: headroom Y=50 is AIR`);
    assertEqual(wmSeed.getBlock(100, 51, 0, DIMENSION.THE_END), BLOCK.AIR, `Seed ${seed}: headroom Y=51 is AIR`);

    // Exit fountain switch back to Overworld
    const owPos = await wmSeed.switchDimension(DIMENSION.OVERWORLD, endPos);
    assertEqual(owPos.dimension, DIMENSION.OVERWORLD, `Seed ${seed}: return dimension is OVERWORLD`);
    assertEqual(owPos.x, 0.5, `Seed ${seed}: exit fountain return X is 0.5`);
    assertEqual(owPos.z, 0.5, `Seed ${seed}: exit fountain return Z is 0.5`);

    // Dynamic altitude check: player must be above surfaceY and >= 64.0
    const chunk00 = wmSeed.getChunk(0, 0, DIMENSION.OVERWORLD);
    const surfaceY = (chunk00 && chunk00.heightMap) ? (chunk00.heightMap[0] || 64) : 64;
    const expectedY = Math.max(64.0, surfaceY + 1.0);
    assertEqual(owPos.y, expectedY, `Seed ${seed}: return spawn Y matches dynamic surface + 1.0`);
    assert(owPos.y > surfaceY, `Seed ${seed}: return spawn Y (${owPos.y}) is above terrain surface (${surfaceY})`);

    // Clear headroom: blocks at feet and head in Overworld must NOT be suffocating solid blocks
    const footBlock = wmSeed.getBlock(0, Math.floor(owPos.y), 0, DIMENSION.OVERWORLD);
    const headBlock = wmSeed.getBlock(0, Math.floor(owPos.y + 1), 0, DIMENSION.OVERWORLD);
    assert(
      footBlock === BLOCK.AIR || footBlock === BLOCK.WATER || footBlock === BLOCK.PINK_PETALS || footBlock === BLOCK.TALL_GRASS,
      `Seed ${seed}: foot level block is breathable (${footBlock})`
    );
    assert(
      headBlock === BLOCK.AIR || headBlock === BLOCK.WATER || headBlock === BLOCK.PINK_PETALS || headBlock === BLOCK.TALL_GRASS,
      `Seed ${seed}: head level block is breathable (${headBlock})`
    );
  }

  // 4.3 50 Rapid Consecutive Dimension Transitions Stress
  {
    const wmStress = new WorldManager(1337);
    let curPos = { x: 0.5, y: 65, z: 0.5 };
    let noErrors = true;

    for (let cycle = 0; cycle < 50; cycle++) {
      // Cycle: Overworld -> Nether -> The End -> Overworld
      curPos = await wmStress.switchDimension(DIMENSION.NETHER, curPos);
      if (wmStress.getActiveDimension() !== DIMENSION.NETHER || !Number.isFinite(curPos.x)) {
        noErrors = false; break;
      }
      curPos = await wmStress.switchDimension(DIMENSION.THE_END, curPos);
      if (wmStress.getActiveDimension() !== DIMENSION.THE_END || curPos.x !== 100.5) {
        noErrors = false; break;
      }
      curPos = await wmStress.switchDimension(DIMENSION.OVERWORLD, curPos);
      if (wmStress.getActiveDimension() !== DIMENSION.OVERWORLD || curPos.x !== 0.5) {
        noErrors = false; break;
      }
    }
    assertTrue(noErrors, '50 rapid consecutive dimension switching cycles executed without error or coordinate drift');
  }
}

// ============================================================================
// SUITE 5: Bounding Box Intersection Accuracy for Fractional Sub-Unit Boxes
// ============================================================================
console.log('\n--- Suite 5: Bounding Box Intersection Accuracy for Sub-Unit Boxes ---');

{
  const wm = new WorldManager(101);

  // Setup: Clear an isolated area around (10, 10, 10)
  for (let dy = -2; dy <= 2; dy++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        wm.setBlock(10 + dx, 10 + dy, 10 + dz, BLOCK.AIR, DIMENSION.OVERWORLD);
      }
    }
  }

  // 5.1 Sub-unit box entirely inside a single block
  wm.setBlock(10, 10, 10, BLOCK.STONE, DIMENSION.OVERWORLD);
  const singleBlockBox = {
    minX: 10.2, maxX: 10.8,
    minY: 10.2, maxY: 10.8,
    minZ: 10.2, maxZ: 10.8
  };
  const colliders1 = wm.getIntersectingBlockAABBs(singleBlockBox, DIMENSION.OVERWORLD);
  assertEqual(colliders1.length, 1, 'Sub-unit box inside single block returns exactly 1 collider');
  assertEqual(colliders1[0].minX, 10, 'Collider minX is 10');
  assertEqual(colliders1[0].maxX, 11, 'Collider maxX is 11');
  assertEqual(colliders1[0].minY, 10, 'Collider minY is 10');
  assertEqual(colliders1[0].maxY, 11, 'Collider maxY is 11');
  assertEqual(colliders1[0].minZ, 10, 'Collider minZ is 10');
  assertEqual(colliders1[0].maxZ, 11, 'Collider maxZ is 11');

  // 5.2 Sub-unit box straddling 2 blocks along X axis
  wm.setBlock(11, 10, 10, BLOCK.STONE, DIMENSION.OVERWORLD);
  const twoBlockBox = {
    minX: 10.8, maxX: 11.2,
    minY: 10.2, maxY: 10.8,
    minZ: 10.2, maxZ: 10.8
  };
  const colliders2 = wm.getIntersectingBlockAABBs(twoBlockBox, DIMENSION.OVERWORLD);
  assertEqual(colliders2.length, 2, 'Sub-unit box straddling 2 blocks along X returns exactly 2 colliders');

  // 5.3 Sub-unit box straddling 4 blocks (2x2) at vertical edge
  wm.setBlock(10, 10, 11, BLOCK.STONE, DIMENSION.OVERWORLD);
  wm.setBlock(11, 10, 11, BLOCK.STONE, DIMENSION.OVERWORLD);
  const fourBlockBox = {
    minX: 10.8, maxX: 11.2,
    minY: 10.2, maxY: 10.8,
    minZ: 10.8, maxZ: 11.2
  };
  const colliders4 = wm.getIntersectingBlockAABBs(fourBlockBox, DIMENSION.OVERWORLD);
  assertEqual(colliders4.length, 4, 'Sub-unit box straddling 4 blocks (2x2) returns exactly 4 colliders');

  // 5.4 Sub-unit box straddling 8 blocks (2x2x2) at 3D corner vertex
  for (let dy = 0; dy <= 1; dy++) {
    for (let dz = 0; dz <= 1; dz++) {
      for (let dx = 0; dx <= 1; dx++) {
        wm.setBlock(10 + dx, 10 + dy, 10 + dz, BLOCK.STONE, DIMENSION.OVERWORLD);
      }
    }
  }
  const eightBlockBox = {
    minX: 10.8, maxX: 11.2,
    minY: 10.8, maxY: 11.2,
    minZ: 10.8, maxZ: 11.2
  };
  const colliders8 = wm.getIntersectingBlockAABBs(eightBlockBox, DIMENSION.OVERWORLD);
  assertEqual(colliders8.length, 8, 'Sub-unit box straddling 8 blocks (2x2x2) returns exactly 8 colliders');

  // 5.5 Permeable & Non-Solid Blocks Filtering
  const nonSolidTypes = [
    BLOCK.AIR,
    BLOCK.WATER,
    BLOCK.LAVA,
    BLOCK.FIRE,
    BLOCK.TALL_GRASS,
    BLOCK.PINK_PETALS,
    BLOCK.NETHER_PORTAL,
    BLOCK.END_PORTAL
  ];
  for (const nonSolid of nonSolidTypes) {
    wm.setBlock(20, 20, 20, nonSolid, DIMENSION.OVERWORLD);
    const box = { minX: 20.1, maxX: 20.9, minY: 20.1, maxY: 20.9, minZ: 20.1, maxZ: 20.9 };
    const colliders = wm.getIntersectingBlockAABBs(box, DIMENSION.OVERWORLD);
    assertEqual(colliders.length, 0, `Non-solid block ID ${nonSolid} returns 0 colliders`);
  }

  // 5.6 Degenerate & Zero-Volume Bounding Boxes
  assertEqual(
    wm.getIntersectingBlockAABBs({ minX: 10, maxX: 10, minY: 10, maxY: 10, minZ: 10, maxZ: 10 }).length,
    0,
    'Zero-volume point box returns 0 colliders'
  );
  assertEqual(
    wm.getIntersectingBlockAABBs({ minX: 12, maxX: 10, minY: 10, maxY: 11, minZ: 10, maxZ: 11 }).length,
    0,
    'Inverted minX > maxX box returns 0 colliders'
  );
  assertEqual(
    wm.getIntersectingBlockAABBs({ minX: 10, maxX: 11, minY: 12, maxY: 10, minZ: 10, maxZ: 11 }).length,
    0,
    'Inverted minY > maxY box returns 0 colliders'
  );
  assertEqual(
    wm.getIntersectingBlockAABBs({ minX: 10, maxX: 11, minY: 10, maxY: 11, minZ: 12, maxZ: 10 }).length,
    0,
    'Inverted minZ > maxZ box returns 0 colliders'
  );

  // 5.7 Negative Coordinate Fractional Sub-Unit Precision
  // Block at (-5, 10, -5) occupies [-5, -4] x [10, 11] x [-5, -4]
  wm.setBlock(-5, 10, -5, BLOCK.STONE, DIMENSION.OVERWORLD);
  const negBoxInside = {
    minX: -4.8, maxX: -4.2,
    minY: 10.2, maxY: 10.8,
    minZ: -4.8, maxZ: -4.2
  };
  const negColliders = wm.getIntersectingBlockAABBs(negBoxInside, DIMENSION.OVERWORLD);
  assertEqual(negColliders.length, 1, 'Negative coordinate sub-unit box inside single block returns exactly 1 collider');
  assertEqual(negColliders[0].minX, -5, 'Negative collider minX is -5');
  assertEqual(negColliders[0].maxX, -4, 'Negative collider maxX is -4');
  assertEqual(negColliders[0].minZ, -5, 'Negative collider minZ is -5');
  assertEqual(negColliders[0].maxZ, -4, 'Negative collider maxZ is -4');

  // Straddling across boundary [-0.5, 0.5] (straddles block -1 and block 0)
  wm.setBlock(-1, 10, 0, BLOCK.STONE, DIMENSION.OVERWORLD);
  wm.setBlock(0, 10, 0, BLOCK.STONE, DIMENSION.OVERWORLD);
  const crossZeroBox = {
    minX: -0.5, maxX: 0.5,
    minY: 10.2, maxY: 10.8,
    minZ: 0.2, maxZ: 0.8
  };
  const crossColliders = wm.getIntersectingBlockAABBs(crossZeroBox, DIMENSION.OVERWORLD);
  assertEqual(crossColliders.length, 2, 'Box straddling across x=0 boundary returns exactly 2 colliders (-1 and 0)');
}

// ============================================================================
// Final Summary & Verdict
// ============================================================================
console.log('\n======================================================================');
console.log('  TEST SUMMARY');
console.log('======================================================================');
console.log(`  Total Assertions:  ${totalAssertions}`);
console.log(`  Passed Assertions: ${passedAssertions}`);
console.log(`  Failed Assertions: ${failedAssertions}`);
console.log(`  Bugs Discovered:   ${bugsFound.length}`);
for (const bug of bugsFound) {
  console.log(`    - [${bug.bugId}] ${bug.title}`);
}
console.log('======================================================================\n');

if (bugsFound.length > 0) {
  console.error(`VERDICT: REJECT (${bugsFound.length} bug(s) empirically discovered)`);
  process.exit(1);
} else if (failedAssertions > 0) {
  console.error(`VERDICT: REJECT (${failedAssertions} failure(s) detected)`);
  process.exit(1);
} else {
  console.log('VERDICT: APPROVE (All Milestone 2 Iteration 2 challenger tests passed!)');
  process.exit(0);
}
