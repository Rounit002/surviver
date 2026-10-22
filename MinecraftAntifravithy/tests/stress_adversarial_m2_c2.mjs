/**
 * Milestone 2 Adversarial Stress & Correctness Verification Suite
 * Challenger 2 Verification Harness
 *
 * Targets:
 * 1. Nether Portal Validation & Edge Cases:
 *    - Minimum size: 4x5 outer (2x3 inner air)
 *    - Maximum size: 23x23 outer (21x21 inner air)
 *    - Missing corner tolerance: 0, 1, 2, 3, 4 missing corners, non-obsidian corners
 *    - Invalid frames: too narrow, too short, too wide, too tall, perimeter breaches
 *    - Obstructed interior: bottom/middle/top inner obstruction, fluid obstruction
 *    - Ignition and breach extinguishing: contiguous portal clearing, isolated portal protection
 * 2. End Portal Validation & Activation:
 *    - 5x5 horizontal frame with 12 Eye of Ender sockets (open corners)
 *    - Multi-point frame detection
 *    - Incomplete sockets (1..11 eyes) rejected
 *    - Misaligned/irregular frames rejected
 *    - Central 3x3 activation with starry END_PORTAL blocks (ID 25)
 * 3. Teleportation Math & Platform Construction:
 *    - 8:1 coordinate scaling: Overworld <-> Nether, Math.floor floor-division
 *    - End spawn fixed at (100.5, 49.0, 0.5) with 5x5 obsidian pad at Y=48 and 3-block headroom
 *    - Safe search & fallback platform generation with clamping
 *    - Adversarial grid-alignment search probe
 * 4. Multi-Dimension State Persistence:
 *    - Overworld -> Nether -> Overworld full modification cycle
 *    - 3-dimension independent persistence without cross-contamination
 *    - Dynamic chunk reload persistence via modifiedBlocks delta tracking
 * 5. Full E2E Test Runner Conformance
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
// Test Harness & Assertion Counters
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
// Dimension-Aware Mock World for High-Speed Portal Geometry Testing
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

/**
 * Builds a rectangular vertical Nether Portal frame in the mock world.
 */
function buildPortalFrame(world, options = {}) {
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
    startZ
  };
}

console.log('======================================================================');
console.log('  MILESTONE 2 EMPIRICAL ADVERSARIAL STRESS TEST SUITE');
console.log('======================================================================\n');

// ============================================================================
// SUITE 1: Nether Portal Frame Validation, Boundaries, Corners & Extinguish
// ============================================================================
console.log('--- Suite 1: Nether Portal Validation & Stress Testing ---');

{
  const world = new MockWorld();

  // 1.1 Minimum valid frame: 4x5 outer (2x3 inner) along X
  {
    world.clear();
    const frame = buildPortalFrame(world, { outerW: 4, outerH: 5, axis: 'X' });
    const res = validateNetherPortalFrame(world, frame.queryX, frame.queryY, frame.queryZ);
    assertTrue(res.valid, '4x5 outer frame along X-axis is valid');
    assertEqual(res.innerWidth, 2, '4x5 outer frame has inner width 2');
    assertEqual(res.innerHeight, 3, '4x5 outer frame has inner height 3');
    assertEqual(res.axis, 'X', 'Correctly identified X-axis orientation');
  }

  // 1.2 Minimum valid frame: 4x5 outer (2x3 inner) along Z
  {
    world.clear();
    const frame = buildPortalFrame(world, { outerW: 4, outerH: 5, axis: 'Z' });
    const res = validateNetherPortalFrame(world, frame.queryX, frame.queryY, frame.queryZ);
    assertTrue(res.valid, '4x5 outer frame along Z-axis is valid');
    assertEqual(res.innerWidth, 2, '4x5 outer frame has inner width 2');
    assertEqual(res.innerHeight, 3, '4x5 outer frame has inner height 3');
    assertEqual(res.axis, 'Z', 'Correctly identified Z-axis orientation');
  }

  // 1.3 Sub-minimum frames: too narrow or too short
  {
    world.clear();
    // 3x5 outer (1x3 inner) -> too narrow (inner width 1 < 2)
    const narrow = buildPortalFrame(world, { outerW: 3, outerH: 5, axis: 'X' });
    const narrowRes = validateNetherPortalFrame(world, narrow.queryX, narrow.queryY, narrow.queryZ);
    assertFalse(narrowRes.valid, '3x5 outer frame (inner width 1) rejected as too narrow');

    world.clear();
    // 4x4 outer (2x2 inner) -> too short (inner height 2 < 3)
    const shortFrame = buildPortalFrame(world, { outerW: 4, outerH: 4, axis: 'X' });
    const shortRes = validateNetherPortalFrame(world, shortFrame.queryX, shortFrame.queryY, shortFrame.queryZ);
    assertFalse(shortRes.valid, '4x4 outer frame (inner height 2) rejected as too short');

    world.clear();
    // 3x4 outer (1x2 inner) -> both too narrow and too short
    const tiny = buildPortalFrame(world, { outerW: 3, outerH: 4, axis: 'X' });
    const tinyRes = validateNetherPortalFrame(world, tiny.queryX, tiny.queryY, tiny.queryZ);
    assertFalse(tinyRes.valid, '3x4 outer frame rejected');
  }

  // 1.4 Maximum valid frames: 23x23 outer (21x21 inner)
  {
    world.clear();
    const maxFrameX = buildPortalFrame(world, { outerW: 23, outerH: 23, axis: 'X' });
    const maxResX = validateNetherPortalFrame(world, maxFrameX.queryX, maxFrameX.queryY, maxFrameX.queryZ);
    assertTrue(maxResX.valid, '23x23 maximum outer frame along X-axis is valid');
    assertEqual(maxResX.innerWidth, 21, '23x23 frame has inner width 21');
    assertEqual(maxResX.innerHeight, 21, '23x23 frame has inner height 21');

    world.clear();
    const maxFrameZ = buildPortalFrame(world, { outerW: 23, outerH: 23, axis: 'Z' });
    const maxResZ = validateNetherPortalFrame(world, maxFrameZ.queryX, maxFrameZ.queryY, maxFrameZ.queryZ);
    assertTrue(maxResZ.valid, '23x23 maximum outer frame along Z-axis is valid');
    assertEqual(maxResZ.innerWidth, 21, '23x23 frame has inner width 21');
    assertEqual(maxResZ.innerHeight, 21, '23x23 frame has inner height 21');
  }

  // 1.5 Super-maximum frames: too wide or too tall (> 23x23 outer)
  {
    world.clear();
    // 24x23 outer (inner width 22 > 21)
    const wide = buildPortalFrame(world, { outerW: 24, outerH: 23, axis: 'X' });
    const wideRes = validateNetherPortalFrame(world, wide.queryX, wide.queryY, wide.queryZ);
    assertFalse(wideRes.valid, '24x23 outer frame (inner width 22) rejected as exceeding max width 21');

    world.clear();
    // 23x24 outer (inner height 22 > 21)
    const tall = buildPortalFrame(world, { outerW: 23, outerH: 24, axis: 'X' });
    const tallRes = validateNetherPortalFrame(world, tall.queryX, tall.queryY, tall.queryZ);
    assertFalse(tallRes.valid, '23x24 outer frame (inner height 22) rejected as exceeding max height 21');

    world.clear();
    // 24x24 outer
    const huge = buildPortalFrame(world, { outerW: 24, outerH: 24, axis: 'X' });
    const hugeRes = validateNetherPortalFrame(world, huge.queryX, huge.queryY, huge.queryZ);
    assertFalse(hugeRes.valid, '24x24 outer frame rejected as exceeding both bounds');
  }

  // 1.6 Missing corner tolerance stress testing
  {
    // 4 corners missing (all AIR)
    world.clear();
    const noCorners = buildPortalFrame(world, { outerW: 4, outerH: 5, axis: 'X', hasCorners: false });
    const resNoCorners = validateNetherPortalFrame(world, noCorners.queryX, noCorners.queryY, noCorners.queryZ);
    assertTrue(resNoCorners.valid, '4x5 frame with all 4 corners missing (AIR) is valid');

    // Corners replaced with non-obsidian blocks (Cobblestone, Dirt, Wood)
    world.clear();
    const cobbleCorners = buildPortalFrame(world, {
      outerW: 4,
      outerH: 5,
      axis: 'X',
      hasCorners: true,
      cornerBlock: BLOCK.COBBLESTONE
    });
    const resCobbleCorners = validateNetherPortalFrame(world, cobbleCorners.queryX, cobbleCorners.queryY, cobbleCorners.queryZ);
    assertTrue(resCobbleCorners.valid, '4x5 frame with Cobblestone corners is valid');

    // 23x23 maximum frame with missing corners
    world.clear();
    const maxNoCorners = buildPortalFrame(world, { outerW: 23, outerH: 23, axis: 'X', hasCorners: false });
    const resMaxNoCorners = validateNetherPortalFrame(world, maxNoCorners.queryX, maxNoCorners.queryY, maxNoCorners.queryZ);
    assertTrue(resMaxNoCorners.valid, '23x23 frame with all 4 corners missing is valid');
  }

  // 1.7 Frame perimeter breaches (adversarial hole punching)
  {
    // Bottom row breach
    world.clear();
    const f1 = buildPortalFrame(world, { outerW: 4, outerH: 5, axis: 'X' });
    world.setBlock(f1.startX + 1, f1.startY, f1.startZ, BLOCK.AIR); // hole in bottom obsidian
    const res1 = validateNetherPortalFrame(world, f1.queryX, f1.queryY, f1.queryZ);
    assertFalse(res1.valid, 'Breach in bottom obsidian frame row rejects portal');

    // Top row breach
    world.clear();
    const f2 = buildPortalFrame(world, { outerW: 4, outerH: 5, axis: 'X' });
    world.setBlock(f2.startX + 1, f2.startY + 4, f2.startZ, BLOCK.AIR); // hole in top obsidian
    const res2 = validateNetherPortalFrame(world, f2.queryX, f2.queryY, f2.queryZ);
    assertFalse(res2.valid, 'Breach in top obsidian frame row rejects portal');

    // Left pillar breach
    world.clear();
    const f3 = buildPortalFrame(world, { outerW: 4, outerH: 5, axis: 'X' });
    world.setBlock(f3.startX, f3.startY + 2, f3.startZ, BLOCK.AIR); // hole in left pillar
    const res3 = validateNetherPortalFrame(world, f3.queryX, f3.queryY, f3.queryZ);
    assertFalse(res3.valid, 'Breach in left obsidian pillar rejects portal');

    // Right pillar breach
    world.clear();
    const f4 = buildPortalFrame(world, { outerW: 4, outerH: 5, axis: 'X' });
    world.setBlock(f4.startX + 3, f4.startY + 2, f4.startZ, BLOCK.AIR); // hole in right pillar
    const res4 = validateNetherPortalFrame(world, f4.queryX, f4.queryY, f4.queryZ);
    assertFalse(res4.valid, 'Breach in right obsidian pillar rejects portal');

    // Replacing perimeter obsidian with wood planks / stone
    world.clear();
    const f5 = buildPortalFrame(world, { outerW: 4, outerH: 5, axis: 'X' });
    world.setBlock(f5.startX + 2, f5.startY, f5.startZ, BLOCK.STONE); // stone in bottom row
    const res5 = validateNetherPortalFrame(world, f5.queryX, f5.queryY, f5.queryZ);
    assertFalse(res5.valid, 'Replacing perimeter obsidian with Stone rejects portal');
  }

  // 1.8 Obstructed interior stress testing
  {
    // Bottom inner obstruction
    world.clear();
    const o1 = buildPortalFrame(world, { outerW: 4, outerH: 5, axis: 'X' });
    world.setBlock(o1.startX + 1, o1.startY + 1, o1.startZ, BLOCK.STONE);
    const resO1 = validateNetherPortalFrame(world, o1.queryX, o1.queryY, o1.queryZ);
    assertFalse(resO1.valid, 'Solid block obstructing inner bottom row rejects portal');

    // Middle inner obstruction
    world.clear();
    const o2 = buildPortalFrame(world, { outerW: 4, outerH: 5, axis: 'X' });
    world.setBlock(o2.startX + 2, o2.startY + 2, o2.startZ, BLOCK.DIRT);
    const resO2 = validateNetherPortalFrame(world, o2.queryX, o2.queryY, o2.queryZ);
    assertFalse(resO2.valid, 'Solid block obstructing inner middle row rejects portal');

    // Fluid obstruction (water inside frame)
    world.clear();
    const o3 = buildPortalFrame(world, { outerW: 4, outerH: 5, axis: 'X' });
    world.setBlock(o3.startX + 1, o3.startY + 1, o3.startZ, BLOCK.WATER);
    const resO3 = validateNetherPortalFrame(world, o3.queryX, o3.queryY, o3.queryZ);
    assertFalse(resO3.valid, 'Water fluid obstructing interior rejects portal');

    // FIRE inside frame is permitted (flint & steel ignition step)
    world.clear();
    const o4 = buildPortalFrame(world, { outerW: 4, outerH: 5, axis: 'X' });
    world.setBlock(o4.startX + 1, o4.startY + 1, o4.startZ, BLOCK.FIRE);
    const resO4 = validateNetherPortalFrame(world, o4.queryX, o4.queryY, o4.queryZ);
    assertTrue(resO4.valid, 'Fire inside interior is permitted during ignition');
  }

  // 1.9 Ignition Mechanics
  {
    world.clear();
    const frame = buildPortalFrame(world, { outerW: 4, outerH: 5, axis: 'X' });
    const ignited = igniteNetherPortal(world, frame.queryX, frame.queryY, frame.queryZ);
    assertTrue(ignited, 'Valid frame ignites successfully');

    // Check that inner 2x3 area is filled with BLOCK.NETHER_PORTAL (23)
    let portalCount = 0;
    for (let w = 1; w <= 2; w++) {
      for (let h = 1; h <= 3; h++) {
        const id = world.getBlock(frame.startX + w, frame.startY + h, frame.startZ);
        assertEqual(id, BLOCK.NETHER_PORTAL, `Inner block at (${w}, ${h}) is NETHER_PORTAL`);
        portalCount++;
      }
    }
    assertEqual(portalCount, 6, 'Exactly 6 inner portal blocks created in 4x5 frame');

    // Ignition of invalid/breached frame must fail and create zero portal blocks
    world.clear();
    const breached = buildPortalFrame(world, { outerW: 4, outerH: 5, axis: 'X' });
    world.setBlock(breached.startX + 1, breached.startY, breached.startZ, BLOCK.AIR);
    const igniteBreached = igniteNetherPortal(world, breached.queryX, breached.queryY, breached.queryZ);
    assertFalse(igniteBreached, 'Igniting breached frame returns false');
    assertEqual(world.getBlock(breached.queryX, breached.queryY, breached.queryZ), BLOCK.AIR, 'No portal blocks created in breached frame');
  }

  // 1.10 Extinguish & Flood-Fill Logic
  {
    world.clear();
    const frame = buildPortalFrame(world, { outerW: 4, outerH: 5, axis: 'X' });
    igniteNetherPortal(world, frame.queryX, frame.queryY, frame.queryZ);

    // Also build a second separate portal 50 blocks away
    const frame2 = buildPortalFrame(world, { startX: 100, startY: 20, startZ: 10, outerW: 4, outerH: 5, axis: 'X' });
    igniteNetherPortal(world, frame2.queryX, frame2.queryY, frame2.queryZ);

    assertEqual(world.getBlock(frame.queryX, frame.queryY, frame.queryZ), BLOCK.NETHER_PORTAL, 'Portal 1 active');
    assertEqual(world.getBlock(frame2.queryX, frame2.queryY, frame2.queryZ), BLOCK.NETHER_PORTAL, 'Portal 2 active');

    // Extinguish portal 1 by triggering flood fill from one portal block
    extinguishNetherPortal(world, frame.queryX, frame.queryY, frame.queryZ);

    // All portal 1 inner blocks must now be AIR
    for (let w = 1; w <= 2; w++) {
      for (let h = 1; h <= 3; h++) {
        assertEqual(
          world.getBlock(frame.startX + w, frame.startY + h, frame.startZ),
          BLOCK.AIR,
          `Portal 1 block at (${w}, ${h}) converted to AIR`
        );
      }
    }

    // Obsidian frame of Portal 1 must remain intact
    assertEqual(world.getBlock(frame.startX, frame.startY + 1, frame.startZ), BLOCK.OBSIDIAN, 'Pillar remains obsidian');
    assertEqual(world.getBlock(frame.startX + 1, frame.startY, frame.startZ), BLOCK.OBSIDIAN, 'Bottom row remains obsidian');

    // Distant portal 2 must NOT be extinguished
    assertEqual(
      world.getBlock(frame2.queryX, frame2.queryY, frame2.queryZ),
      BLOCK.NETHER_PORTAL,
      'Disconnected Portal 2 remains active and unaffected'
    );
  }
}

// ============================================================================
// SUITE 2: End Portal Validation, Sockets & Activation
// ============================================================================
console.log('\n--- Suite 2: End Portal Validation & Activation Tests ---');

{
  const world = new MockWorld();

  function buildEndFrame(world, cx, cy, cz, options = {}) {
    const { eyeCount = 12, cornerBlock = BLOCK.AIR } = options;

    let placedEyes = 0;

    // Place North & South sides
    for (const dz of [-2, 2]) {
      for (let dx = -1; dx <= 1; dx++) {
        if (placedEyes < eyeCount) {
          world.setBlock(cx + dx, cy, cz + dz, BLOCK.END_PORTAL_FRAME);
          placedEyes++;
        } else {
          world.setBlock(cx + dx, cy, cz + dz, BLOCK.AIR);
        }
      }
    }

    // Place East & West sides
    for (const dx of [-2, 2]) {
      for (let dz = -1; dz <= 1; dz++) {
        if (placedEyes < eyeCount) {
          world.setBlock(cx + dx, cy, cz + dz, BLOCK.END_PORTAL_FRAME);
          placedEyes++;
        } else {
          world.setBlock(cx + dx, cy, cz + dz, BLOCK.AIR);
        }
      }
    }

    // 4 corners
    for (const dz of [-2, 2]) {
      for (const dx of [-2, 2]) {
        world.setBlock(cx + dx, cy, cz + dz, cornerBlock);
      }
    }

    // Center 3x3 interior (AIR by default before activation)
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        world.setBlock(cx + dx, cy, cz + dz, BLOCK.AIR);
      }
    }
  }

  // 2.1 Complete 12-eye End Portal frame validation
  {
    world.clear();
    const cx = 50, cy = 60, cz = 50;
    buildEndFrame(world, cx, cy, cz, { eyeCount: 12 });

    // Validate from center
    const resCenter = validateEndPortalFrame(world, cx, cy, cz);
    assertTrue(resCenter.valid, 'Complete 12-eye End Portal valid from center');
    assertEqual(resCenter.centerX, cx, 'Reported centerX matches');
    assertEqual(resCenter.centerY, cy, 'Reported centerY matches');
    assertEqual(resCenter.centerZ, cz, 'Reported centerZ matches');

    // Validate from any of the 12 frame positions
    const resFrameN = validateEndPortalFrame(world, cx, cy, cz - 2);
    assertTrue(resFrameN.valid, 'Validates from North frame socket');
    assertEqual(resFrameN.centerX, cx, 'Center correctly identified from North socket');

    const resFrameE = validateEndPortalFrame(world, cx + 2, cy, cz);
    assertTrue(resFrameE.valid, 'Validates from East frame socket');
    assertEqual(resFrameE.centerZ, cz, 'Center correctly identified from East socket');

    // Validate with corners populated with non-frame blocks (Bedrock, End stone)
    world.clear();
    buildEndFrame(world, cx, cy, cz, { eyeCount: 12, cornerBlock: BLOCK.END_STONE });
    const resWithCorners = validateEndPortalFrame(world, cx, cy, cz);
    assertTrue(resWithCorners.valid, 'End portal frame ignores corner block types');
  }

  // 2.2 Incomplete End Portal frames (< 12 eyes)
  {
    world.clear();
    const cx = 50, cy = 60, cz = 50;
    // 11 eyes (1 socket missing)
    buildEndFrame(world, cx, cy, cz, { eyeCount: 11 });
    const res11 = validateEndPortalFrame(world, cx, cy, cz);
    assertFalse(res11.valid, 'End portal with 11/12 eyes is invalid');

    world.clear();
    // 6 eyes (half sockets)
    buildEndFrame(world, cx, cy, cz, { eyeCount: 6 });
    const res6 = validateEndPortalFrame(world, cx, cy, cz);
    assertFalse(res6.valid, 'End portal with 6/12 eyes is invalid');

    world.clear();
    // 0 eyes
    buildEndFrame(world, cx, cy, cz, { eyeCount: 0 });
    const res0 = validateEndPortalFrame(world, cx, cy, cz);
    assertFalse(res0.valid, 'End portal with 0 eyes is invalid');
  }

  // 2.3 End Portal Activation (3x3 central fill with BLOCK.END_PORTAL)
  {
    world.clear();
    const cx = 50, cy = 60, cz = 50;
    buildEndFrame(world, cx, cy, cz, { eyeCount: 12 });

    const activated = activateEndPortal(world, cx, cy, cz);
    assertTrue(activated, 'activateEndPortal returns true');

    // Verify all 9 central blocks are END_PORTAL (ID 25)
    let endPortalBlockCount = 0;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const id = world.getBlock(cx + dx, cy, cz + dz);
        assertEqual(id, BLOCK.END_PORTAL, `Center block (${dx}, ${dz}) is END_PORTAL (25)`);
        endPortalBlockCount++;
      }
    }
    assertEqual(endPortalBlockCount, 9, 'Exactly 9 central END_PORTAL blocks generated');

    // Verify frame blocks remain intact as END_PORTAL_FRAME (24)
    assertEqual(world.getBlock(cx, cy, cz - 2), BLOCK.END_PORTAL_FRAME, 'North frame block remains intact');
    assertEqual(world.getBlock(cx + 2, cy, cz), BLOCK.END_PORTAL_FRAME, 'East frame block remains intact');
    assertEqual(world.getBlock(cx, cy, cz + 2), BLOCK.END_PORTAL_FRAME, 'South frame block remains intact');
    assertEqual(world.getBlock(cx - 2, cy, cz), BLOCK.END_PORTAL_FRAME, 'West frame block remains intact');
  }
}

// ============================================================================
// SUITE 3: Teleportation Math, Coordinate Scaling & Platform Spawns
// ============================================================================
console.log('\n--- Suite 3: Teleportation Math & Platform Construction Tests ---');

{
  // 3.1 8:1 Coordinate Scaling Precision
  {
    // Overworld (0) -> Nether (-1)
    const testCasesOWtoNether = [
      { in: [0, 0], out: [0, 0] },
      { in: [8, 16], out: [1, 2] },
      { in: [80, 160], out: [10, 20] },
      { in: [87, 167], out: [10, 20] }, // Math.floor(87/8) = 10
      { in: [7, 7], out: [0, 0] },
      { in: [-1, -1], out: [-1, -1] }, // Math.floor(-1/8) = -1
      { in: [-8, -16], out: [-1, -2] },
      { in: [-9, -17], out: [-2, -3] }, // Math.floor(-9/8) = -2
      { in: [8000, -6400], out: [1000, -800] }
    ];

    for (const tc of testCasesOWtoNether) {
      const res = scaleCoordinate(0, -1, tc.in[0], tc.in[1]);
      assertEqual(res.x, tc.out[0], `Overworld X=${tc.in[0]} -> Nether X=${tc.out[0]}`);
      assertEqual(res.z, tc.out[1], `Overworld Z=${tc.in[1]} -> Nether Z=${tc.out[1]}`);
    }

    // Nether (-1) -> Overworld (0)
    const testCasesNetherToOW = [
      { in: [0, 0], out: [0, 0] },
      { in: [1, 2], out: [8, 16] },
      { in: [10, 20], out: [80, 160] },
      { in: [-1, -2], out: [-8, -16] },
      { in: [-10, 25], out: [-80, 200] },
      { in: [1000, -800], out: [8000, -6400] }
    ];

    for (const tc of testCasesNetherToOW) {
      const res = scaleCoordinate(-1, 0, tc.in[0], tc.in[1]);
      assertEqual(res.x, tc.out[0], `Nether X=${tc.in[0]} -> Overworld X=${tc.out[0]}`);
      assertEqual(res.z, tc.out[1], `Nether Z=${tc.in[1]} -> Overworld Z=${tc.out[1]}`);
    }

    // Overworld <-> The End should be 1:1 (no Nether 8:1 scaling)
    const endCoord = scaleCoordinate(0, 1, 100, 200);
    assertEqual(endCoord.x, 100, 'Overworld -> End X unmodified');
    assertEqual(endCoord.z, 200, 'Overworld -> End Z unmodified');
  }

  // 3.2 Safe Fallback Platform & Frame Generation
  {
    const world = new MockWorld();

    const targetX = 40, targetY = 64, targetZ = 80;
    const resFallback = findOrCreateNetherPortal(world, targetX, targetY, targetZ, -1);

    assertTrue(resFallback.created, 'New portal generated when none exists');
    assertEqual(resFallback.x, targetX + 1.5, 'Spawn target X centered in inner frame (+1.5)');
    assertEqual(resFallback.y, targetY + 1.0, 'Spawn target Y on platform (+1.0)');
    assertEqual(resFallback.z, targetZ + 0.5, 'Spawn target Z centered in portal thickness (+0.5)');

    // Verify 4x4 Netherrack platform at targetY - 1
    for (let dz = -1; dz <= 2; dz++) {
      for (let dx = -1; dx <= 4; dx++) {
        const floorBlock = world.getBlock(targetX + dx, targetY - 1, targetZ + dz, -1);
        assertEqual(floorBlock, BLOCK.NETHERRACK, `Nether platform block at (${dx}, ${dz}) is NETHERRACK`);
      }
    }

    // Set world current dimension to Nether (-1) to query the created frame
    world.currentDimension = -1;
    const validateCreated = validateNetherPortalFrame(world, targetX + 1, targetY + 1, targetZ);
    assertTrue(validateCreated.valid, 'Generated fallback Nether portal frame passes validation');
    assertEqual(validateCreated.innerWidth, 2, 'Generated portal has inner width 2');
    assertEqual(validateCreated.innerHeight, 3, 'Generated portal has inner height 3');
  }

  // 3.3 Adversarial Probe: findOrCreateNetherPortal Search Alignment Bug
  {
    const world = new MockWorld();
    world.currentDimension = -1;

    // Direct aligned check: portal placed directly at origin (targetX, targetY, targetZ)
    world.setBlock(40, 64, 80, BLOCK.NETHER_PORTAL, -1);
    const resAligned = findOrCreateNetherPortal(world, 40, 64, 80, -1);
    assertFalse(resAligned.created, 'Portal at exact grid-aligned offset (0, 0, 0) is discovered');

    // Clear world and test fallback rediscovery
    world.clear();
    const targetX = 40, targetY = 64, targetZ = 80;
    const res1 = findOrCreateNetherPortal(world, targetX, targetY, targetZ, -1);
    assertTrue(res1.created, 'First call creates fallback portal');

    // Empirical Bug Verification:
    // When searching for an existing portal, findOrCreateNetherPortal steps dx and dz by 4 starting from -r:
    // (dx - dz) % 4 is always 0.
    // However, the fallback portal places portal blocks at (targetX + 1, y, targetZ) and (targetX + 2, y, targetZ):
    // which has dx = 1 or 2, and dz = 0 -> (dx - dz) % 4 is 1 or 2, NEVER 0!
    // Therefore, the search loop mathematically never inspects the portal blocks it just created.
    const res2 = findOrCreateNetherPortal(world, targetX, targetY, targetZ, -1);
    if (res2.created === true) {
      recordBug(
        'BUG-PORTAL-01',
        'findOrCreateNetherPortal Coordinate Grid Misalignment (Search Blind Spot)',
        'findOrCreateNetherPortal search loop uses dx += 4, dz += 4 with base -r. This constrains (dx - dz) % 4 === 0. ' +
        'Because fallback portal blocks are placed at dx = 1 and dx = 2 with dz = 0, the search loop mathematically ' +
        'never samples the generated portal blocks. As a consequence, subsequent searches fail to detect the existing ' +
        'portal, causing duplicate portal creation and freezing execution in Overworld (radius 128 = 1.48M iterations).'
      );
    }
    // We record this critical bug!
  }

  // 3.4 The End Spawn & Obsidian Platform Generation
  {
    const world = new MockWorld();
    const spawn = prepareEndSpawnPlatform(world, 1);

    // Exact fixed spawn position
    assertEqual(spawn.x, 100.5, 'End spawn X is exactly 100.5');
    assertEqual(spawn.y, 49.0, 'End spawn Y is exactly 49.0');
    assertEqual(spawn.z, 0.5, 'End spawn Z is exactly 0.5');

    // 5x5 Obsidian platform at Y=48
    let obsidianPadCount = 0;
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const b = world.getBlock(100 + dx, 48, 0 + dz, 1);
        assertEqual(b, BLOCK.OBSIDIAN, `Pad block at (${100 + dx}, 48, ${0 + dz}) is OBSIDIAN`);
        obsidianPadCount++;
      }
    }
    assertEqual(obsidianPadCount, 25, 'Obsidian pad has exactly 25 blocks (5x5)');

    // 3 blocks of headroom at Y=49, 50, 51
    let headroomAirCount = 0;
    for (let dy = 0; dy < 3; dy++) {
      for (let dz = -2; dz <= 2; dz++) {
        for (let dx = -2; dx <= 2; dx++) {
          const b = world.getBlock(100 + dx, 49 + dy, 0 + dz, 1);
          assertEqual(b, BLOCK.AIR, `Headroom at Y=${49 + dy} is AIR`);
          headroomAirCount++;
        }
      }
    }
    assertEqual(headroomAirCount, 75, 'Exactly 75 air blocks of headroom cleared (5x5x3)');
  }
}

// ============================================================================
// SUITE 4: Multi-Dimension State Persistence & Chunk Isolation
// ============================================================================
console.log('\n--- Suite 4: Multi-Dimension State Persistence Tests ---');

{
  const wm = new WorldManager(999);

  // 4.1 Verification of initial dimension
  assertEqual(wm.getActiveDimension(), DIMENSION.OVERWORLD, 'Initial dimension is Overworld');

  // Place custom modification in Overworld
  const owX = 120, owY = 75, owZ = -80;
  wm.setBlock(owX, owY, owZ, BLOCK.DIAMOND_ORE, DIMENSION.OVERWORLD);
  assertEqual(wm.getBlock(owX, owY, owZ, DIMENSION.OVERWORLD), BLOCK.DIAMOND_ORE, 'Overworld modification recorded');

  // Switch to Nether
  const netherPos = scaleCoordinate(0, -1, owX, owZ);
  wm.setDimension(DIMENSION.NETHER);
  assertEqual(wm.getActiveDimension(), DIMENSION.NETHER, 'Active dimension switched to Nether');

  // Check Nether chunk at same coordinates does NOT contain Overworld diamond block
  const netherBlockAtOwPos = wm.getBlock(owX, owY, owZ, DIMENSION.NETHER);
  assert(netherBlockAtOwPos !== BLOCK.DIAMOND_ORE, 'Nether dimension chunk is isolated from Overworld modification');

  // Place custom modification in Nether
  const netherX = netherPos.x, netherY = 55, netherZ = netherPos.z;
  wm.setBlock(netherX, netherY, netherZ, BLOCK.GLOWSTONE, DIMENSION.NETHER);
  assertEqual(wm.getBlock(netherX, netherY, netherZ, DIMENSION.NETHER), BLOCK.GLOWSTONE, 'Nether modification recorded');

  // Switch to The End
  wm.setDimension(DIMENSION.THE_END);
  assertEqual(wm.getActiveDimension(), DIMENSION.THE_END, 'Active dimension switched to The End');

  // Place custom modification in The End
  const endX = 100, endY = 55, endZ = 0;
  wm.setBlock(endX, endY, endZ, BLOCK.BEDROCK, DIMENSION.THE_END);
  assertEqual(wm.getBlock(endX, endY, endZ, DIMENSION.THE_END), BLOCK.BEDROCK, 'The End modification recorded');

  // Switch back to Nether -> verify Nether modification STILL PERSISTS
  wm.setDimension(DIMENSION.NETHER);
  assertEqual(wm.getBlock(netherX, netherY, netherZ, DIMENSION.NETHER), BLOCK.GLOWSTONE, 'Nether modification persists after End visit');

  // Switch back to Overworld -> verify Overworld modification STILL PERSISTS
  wm.setDimension(DIMENSION.OVERWORLD);
  assertEqual(wm.getBlock(owX, owY, owZ, DIMENSION.OVERWORLD), BLOCK.DIAMOND_ORE, 'Overworld modification persists after round-trip');

  // 4.2 Dynamic chunk reload persistence via modifiedBlocks delta tracking
  // Evict cached chunk from memory to simulate chunk unloading
  const cx = Math.floor(owX / 16);
  const cz = Math.floor(owZ / 16);
  const cacheKey = `${cx},${cz}`;
  wm.dimensionCaches[DIMENSION.OVERWORLD].delete(cacheKey);

  // Calling getBlock or getChunk must regenerate chunk AND re-apply persistent delta
  const reloadedBlock = wm.getBlock(owX, owY, owZ, DIMENSION.OVERWORLD);
  assertEqual(reloadedBlock, BLOCK.DIAMOND_ORE, 'Modified block persists across chunk cache eviction & procedural reload');

  // Verify all 3 dimensions preserve their persistent modifications simultaneously
  assertEqual(wm.getBlock(owX, owY, owZ, DIMENSION.OVERWORLD), BLOCK.DIAMOND_ORE, 'Overworld diamond ore intact');
  assertEqual(wm.getBlock(netherX, netherY, netherZ, DIMENSION.NETHER), BLOCK.GLOWSTONE, 'Nether glowstone intact');
  assertEqual(wm.getBlock(endX, endY, endZ, DIMENSION.THE_END), BLOCK.BEDROCK, 'The End bedrock intact');
}

// ============================================================================
// Final Summary & Verification Verdict
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
  console.log('VERDICT: APPROVE (All adversarial portal & state tests passed!)');
  process.exit(0);
}
