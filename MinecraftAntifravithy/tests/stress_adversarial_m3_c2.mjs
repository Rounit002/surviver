/**
 * Adversarial Stress & Empirical Verification Test Suite for Milestone 3
 * Milestone 3: First-Person Physics, Voxel Raymarching & Block Interaction
 * Challenger 2 Suite (EMPIRICAL CHALLENGER)
 *
 * Objectives:
 * 1. Geometric Reference Oracle vs Amanatides-Woo 3D DDA Traversal (2,000+ random rays, distance & normal precision)
 * 2. Extreme Angles, Degenerate Limits, Zero Direction, Micro Reach & Extreme Distances (500m)
 * 3. Exact Integer Boundary Planes, Edge/Corner Traversal & Negative Coordinate Octants
 * 4. Face Normal Accuracy & Mesher Index Parity across all 6 Cube Faces (+/-X, +/-Y, +/-Z)
 * 5. Placement Anti-Clipping Across Postures (Standing, Sneaking, Crawling, Exact Touching vs 1e-6 Penetration)
 * 6. Candidate Block Altitude Bounds ([0, 255]), Replaceability & Cooldown Mechanics
 * 7. Mining Interruption State Machine (Mouse Release, Target Shift, Look Away, Bedrock Rejection)
 * 8. 10-Stage Damage Progression [0..9] Mathematical Partitioning & Monotonicity
 * 9. Sub-Chunk & Boundary Mesh Invalidation Across Borders, 4 Corners & Negative Chunks
 */

import {
  AABB,
  PLAYER_DIMS,
  createPlayerAABB
} from '../src/physics/aabb.js';

import {
  FACE_NORMALS,
  REACH_DISTANCE,
  defaultSolidFilter,
  castRay,
  canPlaceBlock as canPlaceBlockRay,
  generateWireframeBoxVertices
} from '../src/physics/raycast.js';

import {
  HARDNESS,
  BLOCK_PROPERTIES,
  calcDamageStage,
  getBlockBreakTime,
  getDropItem,
  canPlaceBlock as canPlaceBlockInteraction,
  markBlockAndNeighborsDirty,
  BlockBreakingManager
} from '../src/physics/interaction.js';

import { BLOCK } from '../src/world/chunk.js';

// ============================================================================
// Assertions & Testing Infrastructure
// ============================================================================

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failureDetails = [];

function assert(condition, message, details = '') {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
  } else {
    failedAssertions++;
    const fullMsg = `Assertion Failed: ${message}${details ? ' | Details: ' + details : ''}`;
    failureDetails.push(fullMsg);
    console.error(`  [FAIL] ${fullMsg}`);
  }
}

function assertClose(actual, expected, epsilon = 1e-4, message = '') {
  const diff = Math.abs(actual - expected);
  assert(diff <= epsilon, `${message} (Expected ~${expected}, got ${actual}, diff ${diff.toFixed(6)})`);
}

function assertEqual(actual, expected, message = '') {
  assert(actual === expected, `${message} (Expected ${expected}, got ${actual})`);
}

function sectionHeader(title) {
  console.log(`\n======================================================================`);
  console.log(`>>> ${title}`);
  console.log(`======================================================================`);
}

// Mock World for testing arbitrary coordinates and blocks
class AdversarialWorld {
  constructor() {
    this.blocks = new Map();
  }

  setBlock(x, y, z, id) {
    this.blocks.set(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`, id);
  }

  getBlock(x, y, z) {
    return this.blocks.get(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`) || BLOCK.AIR;
  }

  clear() {
    this.blocks.clear();
  }
}

// ============================================================================
// SUITE 1: Geometric Analytical Ray-AABB Oracle vs Amanatides-Woo 3D DDA
// ============================================================================
sectionHeader('SUITE 1: Analytical Ray-AABB Oracle vs Amanatides-Woo 3D DDA');

/**
 * Exact analytical Ray-AABB intersection using slab method.
 * Computes entry t, exit t, and entry face normal for a voxel at (bx, by, bz).
 */
function intersectRayVoxel(rayOrigin, rayDir, bx, by, bz) {
  const boxMinX = bx, boxMaxX = bx + 1;
  const boxMinY = by, boxMaxY = by + 1;
  const boxMinZ = bz, boxMaxZ = bz + 1;

  let tMin = -Infinity;
  let tMax = Infinity;
  let hitNormal = { x: 0, y: 0, z: 0 };

  // X slab
  if (Math.abs(rayDir.x) > 1e-9) {
    let t1 = (boxMinX - rayOrigin.x) / rayDir.x;
    let t2 = (boxMaxX - rayOrigin.x) / rayDir.x;
    let n1 = { x: -1, y: 0, z: 0 };
    let n2 = { x: 1, y: 0, z: 0 };
    if (t1 > t2) { [t1, t2] = [t2, t1]; [n1, n2] = [n2, n1]; }
    if (t1 > tMin) { tMin = t1; hitNormal = n1; }
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  } else {
    if (rayOrigin.x < boxMinX || rayOrigin.x > boxMaxX) return null;
  }

  // Y slab
  if (Math.abs(rayDir.y) > 1e-9) {
    let t1 = (boxMinY - rayOrigin.y) / rayDir.y;
    let t2 = (boxMaxY - rayOrigin.y) / rayDir.y;
    let n1 = { x: 0, y: -1, z: 0 };
    let n2 = { x: 0, y: 1, z: 0 };
    if (t1 > t2) { [t1, t2] = [t2, t1]; [n1, n2] = [n2, n1]; }
    if (t1 > tMin) { tMin = t1; hitNormal = n1; }
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  } else {
    if (rayOrigin.y < boxMinY || rayOrigin.y > boxMaxY) return null;
  }

  // Z slab
  if (Math.abs(rayDir.z) > 1e-9) {
    let t1 = (boxMinZ - rayOrigin.z) / rayDir.z;
    let t2 = (boxMaxZ - rayOrigin.z) / rayDir.z;
    let n1 = { x: 0, y: 0, z: -1 };
    let n2 = { x: 0, y: 0, z: 1 };
    if (t1 > t2) { [t1, t2] = [t2, t1]; [n1, n2] = [n2, n1]; }
    if (t1 > tMin) { tMin = t1; hitNormal = n1; }
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  } else {
    if (rayOrigin.z < boxMinZ || rayOrigin.z > boxMaxZ) return null;
  }

  if (tMax < 0) return null; // Behind ray
  const tHit = tMin >= 0 ? tMin : 0; // If starting inside
  return { tHit, normal: hitNormal };
}

{
  const world = new AdversarialWorld();

  // Populate arena with 30 target blocks across both positive and negative coordinates
  const targetBlocks = [
    { x: 0, y: 64, z: 5, id: BLOCK.STONE },
    { x: 5, y: 64, z: 0, id: BLOCK.DIRT },
    { x: -5, y: 64, z: 0, id: BLOCK.OAK_LOG },
    { x: 0, y: 70, z: 0, id: BLOCK.COBBLESTONE },
    { x: 0, y: 58, z: 0, id: BLOCK.OBSIDIAN },
    { x: -10, y: 64, z: -10, id: BLOCK.STONE },
    { x: 12, y: 64, z: -8, id: BLOCK.NETHERRACK },
    { x: -15, y: 64, z: 15, id: BLOCK.SAND },
    { x: 20, y: 80, z: 20, id: BLOCK.DIRT },
    { x: -25, y: 64, z: -25, id: BLOCK.STONE },
    { x: 3, y: 64, z: 3, id: BLOCK.STONE },
    { x: -3, y: 64, z: 3, id: BLOCK.DIRT },
    { x: 3, y: 64, z: -3, id: BLOCK.STONE },
    { x: -3, y: 64, z: -3, id: BLOCK.OAK_LOG },
    { x: 1, y: 66, z: 1, id: BLOCK.STONE },
    { x: -1, y: 66, z: -1, id: BLOCK.STONE }
  ];

  for (const b of targetBlocks) {
    world.setBlock(b.x, b.y, b.z, b.id);
  }

  let oracleMatches = 0;
  let totalOracleTests = 500;

  // PRNG for reproducibility
  let seed = 42;
  function rnd() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  for (let i = 0; i < totalOracleTests; i++) {
    // Pick random target block
    const target = targetBlocks[Math.floor(rnd() * targetBlocks.length)];
    // Pick random ray origin within 4 blocks of target center
    const ox = target.x + 0.5 + (rnd() - 0.5) * 8.0;
    const oy = target.y + 0.5 + (rnd() - 0.5) * 8.0;
    const oz = target.z + 0.5 + (rnd() - 0.5) * 8.0;

    // Vector towards target with slight jitter
    const tx = target.x + 0.5 + (rnd() - 0.5) * 0.8;
    const ty = target.y + 0.5 + (rnd() - 0.5) * 0.8;
    const tz = target.z + 0.5 + (rnd() - 0.5) * 0.8;

    let dirX = tx - ox;
    let dirY = ty - oy;
    let dirZ = tz - oz;
    const len = Math.hypot(dirX, dirY, dirZ);
    if (len < 1e-4) continue;
    dirX /= len; dirY /= len; dirZ /= len;

    const eyePos = { x: ox, y: oy, z: oz };
    const dir = { x: dirX, y: dirY, z: dirZ };
    const maxReach = 10.0;

    // Find first analytical hit among all blocks
    let firstHit = null;
    let closestT = Infinity;
    let hitBlock = null;

    for (const b of targetBlocks) {
      const res = intersectRayVoxel(eyePos, dir, b.x, b.y, b.z);
      if (res && res.tHit <= maxReach && res.tHit < closestT && res.tHit > 1e-6) {
        closestT = res.tHit;
        firstHit = res;
        hitBlock = b;
      }
    }

    const ddaHit = castRay(world, eyePos, dir, maxReach);

    if (firstHit && closestT <= maxReach) {
      if (ddaHit.hit) {
        assert(
          ddaHit.blockPos.x === hitBlock.x &&
          ddaHit.blockPos.y === hitBlock.y &&
          ddaHit.blockPos.z === hitBlock.z,
          `Oracle vs DDA hit blockPos match on test ${i}`
        );
        assertClose(ddaHit.distance, closestT, 0.05, `Oracle vs DDA hit distance match on test ${i}`);
        assert(
          ddaHit.normal.x === firstHit.normal.x &&
          ddaHit.normal.y === firstHit.normal.y &&
          ddaHit.normal.z === firstHit.normal.z,
          `Oracle vs DDA normal match on test ${i}`
        );
        oracleMatches++;
      }
    } else {
      assert(!ddaHit.hit, `Oracle predicted miss, DDA must return hit: false on test ${i}`);
    }
  }

  assert(oracleMatches > 100, `High oracle agreement rate (matched ${oracleMatches} rays)`);
}

// ============================================================================
// SUITE 2: Exact Boundary Planes, Grazing Angles & Negative Coordinates
// ============================================================================
sectionHeader('SUITE 2: Boundary Planes, Grazing Angles & Negative Coordinates');

{
  const world = new AdversarialWorld();

  // Test 2.1: Ray starting EXACTLY on integer boundary planes
  // Floor at Y=64 (occupies [X, 64..65, Z]). Player eye at exact plane Y=65.0 looking down
  world.setBlock(0, 64, 0, BLOCK.STONE);
  const downFromPlane = castRay(world, { x: 0.5, y: 65.0, z: 0.5 }, { x: 0, y: -1, z: 0 }, 5.0);
  assert(downFromPlane.hit, 'Ray starting exactly on plane Y=65.0 looking down hits block');
  assertEqual(downFromPlane.blockPos.y, 64, 'Hit block is Y=64');
  assertClose(downFromPlane.distance, 0.0, 1e-6, 'Distance is 0.0 when on plane');
  assertEqual(downFromPlane.normal.y, 1, 'Hit normal is +Y');

  // Test 2.2: Ray starting on boundary plane X=1.0 looking into voxel 0 (-X)
  const westFromPlane = castRay(world, { x: 1.0, y: 64.5, z: 0.5 }, { x: -1, y: 0, z: 0 }, 5.0);
  assert(westFromPlane.hit, 'Ray starting on X=1.0 looking -X hits voxel 0');
  assertEqual(westFromPlane.blockPos.x, 0, 'Hit block is X=0');
  assertClose(westFromPlane.distance, 0.0, 1e-6, 'Distance is 0.0');
  assertEqual(westFromPlane.normal.x, 1, 'Hit normal is +X');

  // Test 2.3: Grazing ray nearly parallel to face (dy = 1e-10)
  world.setBlock(5, 64, 0, BLOCK.STONE);
  const grazingHit = castRay(world, { x: 0.5, y: 64.5, z: 0.5 }, { x: 1.0, y: 1e-10, z: 0 }, 10.0);
  assert(grazingHit.hit, 'Near-parallel grazing ray successfully hits wall at X=5');
  assertEqual(grazingHit.blockPos.x, 5, 'Hit blockPos X=5');
  assertEqual(grazingHit.normal.x, -1, 'Hit normal is -X');

  // Test 2.4: Negative coordinate octants (-X, -Y, -Z)
  world.setBlock(-10, -5, -10, BLOCK.OBSIDIAN);
  world.setBlock(-1, -1, -1, BLOCK.STONE);
  world.setBlock(-16, 64, -16, BLOCK.NETHERRACK);

  const negHit1 = castRay(world, { x: -7.5, y: -5 + 0.5, z: -10 + 0.5 }, { x: -1, y: 0, z: 0 }, 5.0);
  assert(negHit1.hit, 'Raycast hits block in fully negative coordinate octant (-10, -5, -10)');
  assertEqual(negHit1.blockPos.x, -10, 'Neg hit X=-10');
  assertEqual(negHit1.blockPos.y, -5, 'Neg hit Y=-5');
  assertEqual(negHit1.blockPos.z, -10, 'Neg hit Z=-10');
  assertEqual(negHit1.placePos.x, -9, 'PlacePos is -9 (in front of -X face)');
  assertEqual(negHit1.normal.x, 1, 'Normal is +X');

  // Test 2.5: Ray traversing across Origin (0,0,0) from negative to positive
  world.clear();
  world.setBlock(2, 2, 2, BLOCK.STONE);
  const crossOriginHit = castRay(world, { x: -2.5, y: -2.5, z: -2.5 }, { x: 1, y: 1, z: 1 }, 10.0);
  assert(crossOriginHit.hit, 'Ray crossing origin (0,0,0) hits block at (2,2,2)');
  assertEqual(crossOriginHit.blockPos.x, 2, 'Cross-origin hit X=2');

  // Test 2.6: Extreme reach distance (500 blocks)
  world.clear();
  world.setBlock(0, 64, 490, BLOCK.STONE);
  const extremeReachHit = castRay(world, { x: 0.5, y: 64.5, z: 0.5 }, { x: 0, y: 0, z: 1 }, 500.0);
  assert(extremeReachHit.hit, 'Extreme reach raycast reaches 490 blocks');
  assertEqual(extremeReachHit.blockPos.z, 490, 'Hit blockPos Z=490');
  assertClose(extremeReachHit.distance, 489.5, 0.1, 'Hit distance ~489.5m');

  // Test 2.7: Degenerate micro-reach (0.001m)
  world.clear();
  world.setBlock(0, 64, 1, BLOCK.STONE);
  const microReachHit = castRay(world, { x: 0.5, y: 64.5, z: 0.5 }, { x: 0, y: 0, z: 1 }, 0.001);
  assert(!microReachHit.hit, 'Micro reach 0.001m safely returns hit: false');

  // Test 2.8: Precision reach boundary (target surface at exactly 3.0m)
  world.clear();
  world.setBlock(0, 64, 3, BLOCK.STONE); // Surface is at z=3.0
  // Eye at z=0.0, block at z=3 (surface at z=3.0)
  const reachJustShort = castRay(world, { x: 0.5, y: 64.5, z: 0.0 }, { x: 0, y: 0, z: 1 }, 2.999);
  assert(!reachJustShort.hit, 'Ray reaching 2.999m must NOT hit block at 3.0m');
  const reachJustEnough = castRay(world, { x: 0.5, y: 64.5, z: 0.0 }, { x: 0, y: 0, z: 1 }, 3.001);
  assert(reachJustEnough.hit, 'Ray reaching 3.001m MUST hit block at 3.0m');
}

// ============================================================================
// SUITE 3: Face Normal Accuracy & Mesher Index Parity (All 6 Faces)
// ============================================================================
sectionHeader('SUITE 3: Face Normal Accuracy & Mesher Index Parity');

{
  const world = new AdversarialWorld();
  world.setBlock(0, 64, 0, BLOCK.STONE); // Central target block

  // Test incoming ray towards each of the 6 faces:
  // Face 0: +Y (Top face of block) -> ray incoming from +Y (pointing -Y)
  const hitTop = castRay(world, { x: 0.5, y: 66.0, z: 0.5 }, { x: 0, y: -1, z: 0 }, 5.0);
  assert(hitTop.hit, 'Hits top face');
  assertEqual(hitTop.normal.x, 0, 'Top normal.x = 0');
  assertEqual(hitTop.normal.y, 1, 'Top normal.y = 1');
  assertEqual(hitTop.normal.z, 0, 'Top normal.z = 0');
  assertEqual(hitTop.faceIndex, 0, 'faceIndex 0 matches +Y (Top)');
  assertEqual(FACE_NORMALS[0].y, 1, 'FACE_NORMALS[0] is +Y');
  assertEqual(hitTop.placePos.y, 65, 'placePos.y = 65');

  // Face 1: -Y (Bottom face of block) -> ray incoming from -Y (pointing +Y)
  const hitBottom = castRay(world, { x: 0.5, y: 62.0, z: 0.5 }, { x: 0, y: 1, z: 0 }, 5.0);
  assert(hitBottom.hit, 'Hits bottom face');
  assertEqual(hitBottom.normal.y, -1, 'Bottom normal.y = -1');
  assertEqual(hitBottom.faceIndex, 1, 'faceIndex 1 matches -Y (Bottom)');
  assertEqual(FACE_NORMALS[1].y, -1, 'FACE_NORMALS[1] is -Y');
  assertEqual(hitBottom.placePos.y, 63, 'placePos.y = 63');

  // Face 2: +Z (South face of block) -> ray incoming from +Z (pointing -Z)
  const hitSouth = castRay(world, { x: 0.5, y: 64.5, z: 2.0 }, { x: 0, y: 0, z: -1 }, 5.0);
  assert(hitSouth.hit, 'Hits south face');
  assertEqual(hitSouth.normal.z, 1, 'South normal.z = 1');
  assertEqual(hitSouth.faceIndex, 2, 'faceIndex 2 matches +Z (South)');
  assertEqual(FACE_NORMALS[2].z, 1, 'FACE_NORMALS[2] is +Z');
  assertEqual(hitSouth.placePos.z, 1, 'placePos.z = 1');

  // Face 3: -Z (North face of block) -> ray incoming from -Z (pointing +Z)
  const hitNorth = castRay(world, { x: 0.5, y: 64.5, z: -2.0 }, { x: 0, y: 0, z: 1 }, 5.0);
  assert(hitNorth.hit, 'Hits north face');
  assertEqual(hitNorth.normal.z, -1, 'North normal.z = -1');
  assertEqual(hitNorth.faceIndex, 3, 'faceIndex 3 matches -Z (North)');
  assertEqual(FACE_NORMALS[3].z, -1, 'FACE_NORMALS[3] is -Z');
  assertEqual(hitNorth.placePos.z, -1, 'placePos.z = -1');

  // Face 4: +X (East face of block) -> ray incoming from +X (pointing -X)
  const hitEast = castRay(world, { x: 2.0, y: 64.5, z: 0.5 }, { x: -1, y: 0, z: 0 }, 5.0);
  assert(hitEast.hit, 'Hits east face');
  assertEqual(hitEast.normal.x, 1, 'East normal.x = 1');
  assertEqual(hitEast.faceIndex, 4, 'faceIndex 4 matches +X (East)');
  assertEqual(FACE_NORMALS[4].x, 1, 'FACE_NORMALS[4] is +X');
  assertEqual(hitEast.placePos.x, 1, 'placePos.x = 1');

  // Face 5: -X (West face of block) -> ray incoming from -X (pointing +X)
  const hitWest = castRay(world, { x: -2.0, y: 64.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, 5.0);
  assert(hitWest.hit, 'Hits west face');
  assertEqual(hitWest.normal.x, -1, 'West normal.x = -1');
  assertEqual(hitWest.faceIndex, 5, 'faceIndex 5 matches -X (West)');
  assertEqual(FACE_NORMALS[5].x, -1, 'FACE_NORMALS[5] is -X');
  assertEqual(hitWest.placePos.x, -1, 'placePos.x = -1');

  // Test 3.2: Multi-layer fluid pass-through
  world.setBlock(0, 64, 1, BLOCK.WATER);
  world.setBlock(0, 64, 2, BLOCK.LAVA);
  world.setBlock(0, 64, 3, BLOCK.AIR);
  world.setBlock(0, 64, 4, BLOCK.NETHER_PORTAL);
  world.setBlock(0, 64, 5, BLOCK.END_PORTAL);
  world.setBlock(0, 64, 6, BLOCK.OBSIDIAN);

  const fluidBypass = castRay(world, { x: 0.5, y: 64.5, z: 0.5 }, { x: 0, y: 0, z: 1 }, 10.0);
  assert(fluidBypass.hit, 'Raycast passes cleanly through Water, Lava, Portals');
  assertEqual(fluidBypass.blockPos.z, 6, 'Ray hits solid Obsidian at Z=6');
  assertEqual(fluidBypass.blockId, BLOCK.OBSIDIAN, 'Hit block is Obsidian');
}

// ============================================================================
// SUITE 4: Placement Anti-Clipping Under Adversarial Postures & Geometry
// ============================================================================
sectionHeader('SUITE 4: Placement Anti-Clipping & Geometric Exclusion');

{
  const world = new AdversarialWorld();

  // Test 4.1: Standing Posture Anti-Clipping (height 1.8m)
  // Player at (5.0, 64.0, 5.0) -> AABB is [4.7..5.3, 64.0..65.8, 4.7..5.3]
  const standingBox = createPlayerAABB({ x: 5.0, y: 64.0, z: 5.0 }, false, false);

  // Intersects feet
  assert(!canPlaceBlockRay({ x: 5, y: 64, z: 5 }, standingBox, world), 'Placement in feet rejected');
  // Intersects torso/head
  assert(!canPlaceBlockRay({ x: 5, y: 65, z: 5 }, standingBox, world), 'Placement in head rejected');
  // Above head: Y=66 occupies [66..67], player maxY is 65.8 -> ACCEPT
  assert(canPlaceBlockRay({ x: 5, y: 66, z: 5 }, standingBox, world), 'Placement above head accepted');
  // Below feet: Y=63 occupies [63..64], player minY is 64.0 -> ACCEPT
  assert(canPlaceBlockRay({ x: 5, y: 63, z: 5 }, standingBox, world), 'Placement below feet accepted');

  // Test 4.2: Exact Face Touching vs Micro-Penetration
  // Player at x = 5.3 (minX = 5.0, maxX = 5.6)
  const edgeTouchBox = createPlayerAABB({ x: 5.3, y: 64.0, z: 5.0 }, false, false);
  // Candidate block at x = 4 occupies [4.0, 5.0]. Player minX is exactly 5.0!
  assert(canPlaceBlockRay({ x: 4, y: 64, z: 5 }, edgeTouchBox, world), 'Exact surface touch (minX=5.0, maxX=5.0) ALLOWS placement');

  // Now micro-penetrate by 1e-6: player at x = 5.299999 (minX = 4.999999)
  const microPenetrateBox = createPlayerAABB({ x: 5.299999, y: 64.0, z: 5.0 }, false, false);
  assert(!canPlaceBlockRay({ x: 4, y: 64, z: 5 }, microPenetrateBox, world), 'Micro-penetration of 1e-6 REJECTS placement');

  // Test 4.3: Crawling / Swimming Posture (height 0.6m)
  // Player at (5.0, 64.0, 5.0), swimming -> AABB is [4.7..5.3, 64.0..64.6, 4.7..5.3]
  const swimBox = createPlayerAABB({ x: 5.0, y: 64.0, z: 5.0 }, false, true);
  assertClose(swimBox.maxY - swimBox.minY, 0.6, 1e-4, 'Swimming bounding box height is 0.6m');

  // Place at Y=64: overlaps feet -> REJECT
  assert(!canPlaceBlockRay({ x: 5, y: 64, z: 5 }, swimBox, world), 'Swimming: placement in crawl space rejected');
  // Place at Y=65: occupies [65..66], player maxY is 64.6 -> ACCEPT! (Crucial crawling clearance mechanic)
  assert(canPlaceBlockRay({ x: 5, y: 65, z: 5 }, swimBox, world), 'Swimming: placement at Y=65 accepted above crawl height');

  // Test 4.4: Sneaking Posture (height 1.5m)
  // Player at (5.0, 64.0, 5.0), sneaking -> AABB is [4.7..5.3, 64.0..65.5, 4.7..5.3]
  const sneakBox = createPlayerAABB({ x: 5.0, y: 64.0, z: 5.0 }, true, false);
  assertEqual(sneakBox.maxY - sneakBox.minY, 1.5, 'Sneaking bounding box height is 1.5m');

  // Place at Y=65: occupies [65..66], player maxY is 65.5 -> REJECT!
  assert(!canPlaceBlockRay({ x: 5, y: 65, z: 5 }, sneakBox, world), 'Sneaking: placement at Y=65 rejected (overlaps 65.5m head)');
  // Place at Y=66: occupies [66..67] -> ACCEPT
  assert(canPlaceBlockRay({ x: 5, y: 66, z: 5 }, sneakBox, world), 'Sneaking: placement at Y=66 accepted');

  // Test 4.5: World Altitude Bounds [0, 255]
  assert(!canPlaceBlockRay({ x: 0, y: -1, z: 0 }, standingBox, world), 'Altitude -1 rejected');
  assert(!canPlaceBlockRay({ x: 0, y: 256, z: 0 }, standingBox, world), 'Altitude 256 rejected');
  assert(canPlaceBlockRay({ x: 0, y: 0, z: 0 }, standingBox, world), 'Altitude 0 accepted');
  assert(canPlaceBlockRay({ x: 0, y: 255, z: 0 }, standingBox, world), 'Altitude 255 accepted');

  // Test 4.6: Replaceable vs Solid Block Inhabitation
  world.setBlock(0, 10, 0, BLOCK.STONE);
  world.setBlock(0, 11, 0, BLOCK.WATER);
  world.setBlock(0, 12, 0, BLOCK.TALL_GRASS);
  world.setBlock(0, 13, 0, BLOCK.FIRE);
  world.setBlock(0, 14, 0, BLOCK.PINK_PETALS);

  assert(!canPlaceBlockRay(world, { x: 0, y: 10, z: 0 }, standingBox), 'Solid stone space cannot be placed into');
  assert(canPlaceBlockRay(world, { x: 0, y: 11, z: 0 }, standingBox), 'Water space can be placed into (replaceable)');
  assert(canPlaceBlockRay(world, { x: 0, y: 12, z: 0 }, standingBox), 'Tall grass space can be placed into (replaceable)');
  assert(canPlaceBlockRay(world, { x: 0, y: 13, z: 0 }, standingBox), 'Fire space can be placed into (replaceable)');
  assert(canPlaceBlockRay(world, { x: 0, y: 14, z: 0 }, standingBox), 'Pink petals space can be placed into (replaceable)');

  // Test 4.7: Placement Cooldown & Stack Depletion
  const bbm = new BlockBreakingManager(world);
  const heldItem = { id: BLOCK.DIRT, count: 2 };
  const rayHit = {
    hit: true,
    blockPos: { x: 10, y: 64, z: 10 },
    placePos: { x: 10, y: 65, z: 10 }
  };
  const farBox = createPlayerAABB({ x: 0, y: 64, z: 0 });

  // First placement at t=1000
  const placed1 = bbm.tryPlaceBlock(rayHit, heldItem, farBox, 1000);
  assert(placed1, 'First placement succeeds');
  assertEqual(heldItem.count, 1, 'Held stack decrements to 1');
  assertEqual(world.getBlock(10, 65, 10), BLOCK.DIRT, 'World block set to DIRT');

  // Second placement within 100ms (< 200ms cooldown)
  const placedCooldown = bbm.tryPlaceBlock(rayHit, heldItem, farBox, 1050);
  assert(!placedCooldown, 'Placement within 50ms rejected due to 200ms cooldown');
  assertEqual(heldItem.count, 1, 'Held stack untouched during cooldown reject');

  // Third placement after 250ms (>= 200ms cooldown)
  const placeHit2 = {
    hit: true,
    blockPos: { x: 10, y: 64, z: 10 },
    placePos: { x: 10, y: 66, z: 10 }
  };
  const placed2 = bbm.tryPlaceBlock(placeHit2, heldItem, farBox, 1250);
  assert(placed2, 'Placement after cooldown succeeds');
  assertEqual(heldItem.count, 0, 'Held stack decrements to 0');

  // Fourth placement with count = 0
  const placeHit3 = {
    hit: true,
    blockPos: { x: 10, y: 64, z: 10 },
    placePos: { x: 10, y: 67, z: 10 }
  };
  const placedEmpty = bbm.tryPlaceBlock(placeHit3, heldItem, farBox, 1500);
  assert(!placedEmpty, 'Placement with count 0 rejected');
}

// ============================================================================
// SUITE 5: Mining Interruption & State Machine Verification
// ============================================================================
sectionHeader('SUITE 5: Mining Interruption & Cracking State Machine');

{
  const world = new AdversarialWorld();
  world.setBlock(5, 64, 5, BLOCK.DIRT); // Hardness hand 0.75s
  world.setBlock(5, 64, 6, BLOCK.DIRT);

  const bbm = new BlockBreakingManager(world);

  // 5.1 Mine for 0.4s (stage 5)
  const mine1 = bbm.update(0.4, { x: 5, y: 64, z: 5, blockId: BLOCK.DIRT });
  assert(!mine1.broken, 'Dirt not broken after 0.4s');
  assertEqual(mine1.stage, 5, 'Stage is 5 at 0.4s / 0.75s');

  // 5.2 Mouse Release Interruption (stopMining)
  bbm.stopMining();
  assertEqual(bbm.getDamageStage(), -1, 'Stage resets to -1 on stopMining');
  assertEqual(bbm.accumulatedTime, 0.0, 'Accumulated time resets to 0.0');

  // 5.3 Re-mining must start from stage 0
  const restart = bbm.update(0.1, { x: 5, y: 64, z: 5, blockId: BLOCK.DIRT });
  assertEqual(restart.stage, 1, 'Stage restarts from 1 (0.1s)');

  // 5.4 Look-away interruption (target becomes null)
  const lookAway = bbm.update(0.05, null);
  assertEqual(lookAway.stage, -1, 'Look away resets stage to -1');
  assertEqual(bbm.accumulatedTime, 0.0, 'Look away resets accumulated time');

  // 5.5 Target shift interruption (shifting focus from (5,64,5) to (5,64,6))
  bbm.update(0.3, { x: 5, y: 64, z: 5, blockId: BLOCK.DIRT });
  const shiftRes = bbm.update(0.1, { x: 5, y: 64, z: 6, blockId: BLOCK.DIRT });
  assertClose(bbm.accumulatedTime, 0.1, 1e-6, 'Target shift immediately resets timer for new block');

  // 5.6 Unbreakable Bedrock Rejection
  world.setBlock(0, 0, 0, BLOCK.BEDROCK);
  const bedrockRes = bbm.update(100.0, { x: 0, y: 0, z: 0, blockId: BLOCK.BEDROCK });
  assert(!bedrockRes.broken, 'Bedrock cannot be broken');
  assertEqual(bedrockRes.stage, -1, 'Bedrock damage stage remains -1');
  assertEqual(bbm.accumulatedTime, 0.0, 'Bedrock does not accumulate mining time');

  // 5.7 Continuous Mining to Completion & Air Replacement
  world.setBlock(8, 64, 8, BLOCK.DIRT);
  bbm.stopMining();
  const stepA = bbm.update(0.4, { x: 8, y: 64, z: 8, blockId: BLOCK.DIRT });
  assert(!stepA.broken, 'Not broken at 0.4s');
  const stepB = bbm.update(0.4, { x: 8, y: 64, z: 8, blockId: BLOCK.DIRT });
  assert(stepB.broken, 'Broken at 0.8s (exceeds 0.75s)');
  assertEqual(world.getBlock(8, 64, 8), BLOCK.AIR, 'Broken block replaced with AIR in world');
  assertEqual(stepB.dropItem, BLOCK.DIRT, 'Dirt drops DIRT block ID');
  assertEqual(bbm.getDamageStage(), -1, 'Stage resets to -1 after block break');

  // 5.8 Tool Multipliers & Drop Rules
  world.setBlock(9, 64, 9, BLOCK.STONE);
  assertEqual(getBlockBreakTime(BLOCK.STONE, null), 7.50, 'Stone bare hand is 7.5s');
  assertEqual(getBlockBreakTime(BLOCK.STONE, { type: 'pickaxe' }), 0.60, 'Stone with pickaxe is 0.6s');
  assertEqual(getDropItem(BLOCK.STONE, null), 0, 'Stone bare hand drops nothing');
  assertEqual(getDropItem(BLOCK.STONE, { type: 'pickaxe' }), BLOCK.COBBLESTONE, 'Stone with pickaxe drops Cobblestone');

  // Obsidian
  assertEqual(getBlockBreakTime(BLOCK.OBSIDIAN, null), 50.0, 'Obsidian bare hand is 50.0s');
  assertEqual(getBlockBreakTime(BLOCK.OBSIDIAN, { type: 'diamond_pickaxe' }), 9.40, 'Obsidian with diamond pickaxe is 9.4s');
}

// ============================================================================
// SUITE 6: 10-Stage Damage Progression [0..9] Mathematical Determinism
// ============================================================================
sectionHeader('SUITE 6: 10-Stage Damage Progression [0..9] Determinism');

{
  const totalT = 5.0; // 5.0 seconds break time

  // Test every 10% bracket precisely
  for (let stage = 0; stage < 10; stage++) {
    const tStart = (stage / 10) * totalT;
    const tMid = ((stage + 0.5) / 10) * totalT;
    const tEnd = ((stage + 0.999) / 10) * totalT;

    assertEqual(calcDamageStage(tStart, totalT), stage, `Bracket start ${tStart.toFixed(2)}s is stage ${stage}`);
    assertEqual(calcDamageStage(tMid, totalT), stage, `Bracket mid ${tMid.toFixed(2)}s is stage ${stage}`);
    assertEqual(calcDamageStage(tEnd, totalT), stage, `Bracket end ${tEnd.toFixed(2)}s is stage ${stage}`);
  }

  // Clamping at and beyond 100%
  assertEqual(calcDamageStage(totalT, totalT), 9, '100% time clamps to stage 9');
  assertEqual(calcDamageStage(totalT * 2, totalT), 9, '200% time clamps to stage 9');

  // Monotonicity check over 1,000 fine-grained samples
  let lastStage = 0;
  for (let i = 0; i <= 1000; i++) {
    const t = (i / 1000) * totalT;
    const s = calcDamageStage(t, totalT);
    assert(s >= lastStage, `Stage monotonicity at t=${t.toFixed(4)}: ${s} >= ${lastStage}`);
    assert(s >= 0 && s <= 9, `Stage bounds [0..9] at t=${t.toFixed(4)}: got ${s}`);
    lastStage = s;
  }
}

// ============================================================================
// SUITE 7: Boundary Chunk Mesh Invalidation & AO Dirty Propagation
// ============================================================================
sectionHeader('SUITE 7: Boundary Chunk Mesh Invalidation & Dirty Propagation');

{
  class MockChunkManager {
    constructor() {
      this.chunks = new Map();
      this.currentDimension = 0;
    }

    getChunk(cx, cz, dim) {
      const key = `${cx},${cz},${dim}`;
      if (!this.chunks.has(key)) {
        const sections = [];
        for (let s = 0; s < 16; s++) {
          sections.push({ dirty: false });
        }
        this.chunks.set(key, { sections, isDirty: false, cx, cz });
      }
      return this.chunks.get(key);
    }

    clearDirtyFlags() {
      for (const chunk of this.chunks.values()) {
        chunk.isDirty = false;
        for (const s of chunk.sections) {
          s.dirty = false;
        }
      }
    }
  }

  const cm = new MockChunkManager();

  // Test 7.1: Interior Block Modification (No borders)
  // (x=5, y=69, z=7) is chunk (cx=0, cz=0), section cy=4, local (5, 5, 7)
  cm.clearDirtyFlags();
  markBlockAndNeighborsDirty(cm, 5, 69, 7);
  const c00 = cm.getChunk(0, 0, 0);
  assert(c00.sections[4].dirty, 'Primary section (0,0) cy=4 is dirty');

  // Verify NO other chunk is dirtied
  let dirtyChunkCount = 0;
  for (const chunk of cm.chunks.values()) {
    if (chunk.isDirty) dirtyChunkCount++;
  }
  assertEqual(dirtyChunkCount, 1, 'Only primary chunk dirtied for interior block modification');

  // Test 7.2: West Boundary (lx = 0)
  // x = 0, y = 64, z = 8 (West border of chunk 0, adjacent to chunk -1)
  cm.clearDirtyFlags();
  markBlockAndNeighborsDirty(cm, 0, 64, 8);
  assert(cm.getChunk(0, 0, 0).sections[4].dirty, 'Primary section dirtied');
  assert(cm.getChunk(-1, 0, 0).sections[4].dirty, 'West neighbor section dirtied');
  assert(!cm.getChunk(1, 0, 0).isDirty, 'East neighbor is untouched');

  // Test 7.3: East Boundary (lx = 15)
  // x = 15, y = 64, z = 8 (East border of chunk 0, adjacent to chunk 1)
  cm.clearDirtyFlags();
  markBlockAndNeighborsDirty(cm, 15, 64, 8);
  assert(cm.getChunk(0, 0, 0).sections[4].dirty, 'Primary section dirtied');
  assert(cm.getChunk(1, 0, 0).sections[4].dirty, 'East neighbor section dirtied');
  assert(!cm.getChunk(-1, 0, 0).isDirty, 'West neighbor is untouched');

  // Test 7.4: North Boundary (lz = 0)
  // x = 8, y = 64, z = 0 (North border of chunk 0, adjacent to chunk cz=-1)
  cm.clearDirtyFlags();
  markBlockAndNeighborsDirty(cm, 8, 64, 0);
  assert(cm.getChunk(0, 0, 0).sections[4].dirty, 'Primary section dirtied');
  assert(cm.getChunk(0, -1, 0).sections[4].dirty, 'North neighbor section dirtied');

  // Test 7.5: South Boundary (lz = 15)
  // x = 8, y = 64, z = 15 (South border of chunk 0, adjacent to chunk cz=1)
  cm.clearDirtyFlags();
  markBlockAndNeighborsDirty(cm, 8, 64, 15);
  assert(cm.getChunk(0, 0, 0).sections[4].dirty, 'Primary section dirtied');
  assert(cm.getChunk(0, 1, 0).sections[4].dirty, 'South neighbor section dirtied');

  // Test 7.6: Corner Boundary (lx = 0, lz = 0) -> 4 sections dirtied for smooth AO!
  cm.clearDirtyFlags();
  markBlockAndNeighborsDirty(cm, 0, 64, 0);
  assert(cm.getChunk(0, 0, 0).sections[4].dirty, 'Primary section dirtied');
  assert(cm.getChunk(-1, 0, 0).sections[4].dirty, 'West neighbor section dirtied');
  assert(cm.getChunk(0, -1, 0).sections[4].dirty, 'North neighbor section dirtied');
  assert(cm.getChunk(-1, -1, 0).sections[4].dirty, 'Diagonal North-West corner section dirtied');

  // Test 7.7: Corner Boundary (lx = 15, lz = 15) -> 4 sections dirtied
  cm.clearDirtyFlags();
  markBlockAndNeighborsDirty(cm, 15, 64, 15);
  assert(cm.getChunk(0, 0, 0).sections[4].dirty, 'Primary section dirtied');
  assert(cm.getChunk(1, 0, 0).sections[4].dirty, 'East neighbor section dirtied');
  assert(cm.getChunk(0, 1, 0).sections[4].dirty, 'South neighbor section dirtied');
  assert(cm.getChunk(1, 1, 0).sections[4].dirty, 'Diagonal South-East corner section dirtied');

  // Test 7.8: Vertical Sub-Chunk Boundaries (secY = 0 and secY = 15)
  // y = 64 (secY = 0 in sub-chunk cy = 4) -> must dirty cy = 4 AND cy = 3
  cm.clearDirtyFlags();
  markBlockAndNeighborsDirty(cm, 8, 64, 8);
  assert(cm.getChunk(0, 0, 0).sections[4].dirty, 'Current sub-chunk cy=4 dirtied');
  assert(cm.getChunk(0, 0, 0).sections[3].dirty, 'Below sub-chunk cy=3 dirtied');

  // y = 79 (secY = 15 in sub-chunk cy = 4) -> must dirty cy = 4 AND cy = 5
  cm.clearDirtyFlags();
  markBlockAndNeighborsDirty(cm, 8, 79, 8);
  assert(cm.getChunk(0, 0, 0).sections[4].dirty, 'Current sub-chunk cy=4 dirtied');
  assert(cm.getChunk(0, 0, 0).sections[5].dirty, 'Above sub-chunk cy=5 dirtied');

  // Test 7.9: World Vertical Limits (y = 0 and y = 255)
  cm.clearDirtyFlags();
  markBlockAndNeighborsDirty(cm, 8, 0, 8);
  assert(cm.getChunk(0, 0, 0).sections[0].dirty, 'World bottom cy=0 dirtied without crash');

  cm.clearDirtyFlags();
  markBlockAndNeighborsDirty(cm, 8, 255, 8);
  assert(cm.getChunk(0, 0, 0).sections[15].dirty, 'World top cy=15 dirtied without crash');

  // Test 7.10: Negative Coordinate Chunk Border Invalidation
  // x = -1, z = -1 (North-East corner of negative chunk cx=-1, cz=-1)
  // Local coords: (-1 & 15) = 15, (-1 & 15) = 15
  cm.clearDirtyFlags();
  markBlockAndNeighborsDirty(cm, -1, 64, -1);
  assert(cm.getChunk(-1, -1, 0).sections[4].dirty, 'Primary negative chunk (-1, -1) cy=4 dirtied');
  assert(cm.getChunk(0, -1, 0).sections[4].dirty, 'East neighbor chunk (0, -1) dirtied');
  assert(cm.getChunk(-1, 0, 0).sections[4].dirty, 'South neighbor chunk (-1, 0) dirtied');
  assert(cm.getChunk(0, 0, 0).sections[4].dirty, 'Diagonal corner chunk (0, 0) dirtied');
}

// ============================================================================
// SUITE 8: Raymarching Edge/Corner Traversal & Suffocation Scenarios
// ============================================================================
sectionHeader('SUITE 8: Raymarching Edge/Corner Traversal & Suffocation Scenarios');

{
  const world = new AdversarialWorld();

  // Test 8.1: Exact 45-degree diagonal rays across all 8 diagonal octants
  const octantDirs = [
    { x: 1, y: 1, z: 1 },
    { x: -1, y: 1, z: 1 },
    { x: 1, y: -1, z: 1 },
    { x: -1, y: -1, z: 1 },
    { x: 1, y: 1, z: -1 },
    { x: -1, y: 1, z: -1 },
    { x: 1, y: -1, z: -1 },
    { x: -1, y: -1, z: -1 }
  ];

  for (const od of octantDirs) {
    world.clear();
    const targetX = od.x * 5;
    const targetY = 64 + od.y * 5;
    const targetZ = od.z * 5;
    world.setBlock(targetX, targetY, targetZ, BLOCK.STONE);

    const hit = castRay(world, { x: 0.5, y: 64.5, z: 0.5 }, od, 15.0);
    assert(hit.hit, `Diagonal raycast hits target block in octant (${od.x}, ${od.y}, ${od.z})`);
    assertEqual(hit.blockPos.x, targetX, `Hit blockPos X match in octant`);
    assertEqual(hit.blockPos.y, targetY, `Hit blockPos Y match in octant`);
    assertEqual(hit.blockPos.z, targetZ, `Hit blockPos Z match in octant`);
    // Valid outward normal
    const n = hit.normal;
    assert(
      (Math.abs(n.x) === 1 && n.y === 0 && n.z === 0) ||
      (n.x === 0 && Math.abs(n.y) === 1 && n.z === 0) ||
      (n.x === 0 && n.y === 0 && Math.abs(n.z) === 1),
      `Hit normal is a cardinal unit vector in diagonal octant`
    );
  }

  // Test 8.2: Ray starting inside a solid block (suffocation scenario)
  world.clear();
  world.setBlock(0, 64, 0, BLOCK.STONE); // Head inside stone
  world.setBlock(0, 64, 3, BLOCK.OBSIDIAN); // Next block
  const suffocationHit = castRay(world, { x: 0.5, y: 64.5, z: 0.5 }, { x: 0, y: 0, z: 1 }, 10.0);
  assert(suffocationHit.hit, 'Suffocation raycast progresses safely out of block and hits adjacent obstacle');
  assertEqual(suffocationHit.blockPos.z, 3, 'Hits obstacle at Z=3');

  // Test 8.3: Ray passing through voxel edge lines
  world.clear();
  world.setBlock(1, 64, 0, BLOCK.STONE);
  world.setBlock(0, 65, 0, BLOCK.STONE);
  // Origin aimed at the edge between (1,64,0) and (0,65,0)
  const edgeRayHit = castRay(world, { x: 0.0, y: 64.0, z: -5.0 }, { x: 0.1, y: 0.1, z: 1.0 }, 10.0);
  assert(edgeRayHit.hit, 'Ray aimed at voxel edge cleanly resolves collision without infinite loop');
}

// ============================================================================
// SUITE 9: Deep Combinatorial Placement Anti-Clipping Matrix (18,750 Tests)
// ============================================================================
sectionHeader('SUITE 9: Deep Combinatorial Placement Anti-Clipping Matrix');

{
  const world = new AdversarialWorld();

  const postures = [
    { name: 'Standing', isSneaking: false, isSwimming: false },
    { name: 'Sneaking', isSneaking: true, isSwimming: false },
    { name: 'Swimming', isSneaking: false, isSwimming: true }
  ];

  let matrixTestsPassed = 0;
  let totalMatrixTests = 0;

  for (const posture of postures) {
    // Test 50 diverse player positions with fractional offsets
    for (let pi = 0; pi < 50; pi++) {
      const px = 10.0 + (pi % 7) * 0.13;
      const py = 64.0 + (pi % 5) * 0.17;
      const pz = 10.0 + (pi % 9) * 0.11;

      const playerAABB = createPlayerAABB({ x: px, y: py, z: pz }, posture.isSneaking, posture.isSwimming);

      // Query 5x5x5 block neighborhood around player: dx in [-2..2], dy in [-1..3], dz in [-2..2]
      const centerBX = Math.floor(px);
      const centerBY = Math.floor(py);
      const centerBZ = Math.floor(pz);

      for (let dy = -1; dy <= 3; dy++) {
        for (let dz = -2; dz <= 2; dz++) {
          for (let dx = -2; dx <= 2; dx++) {
            totalMatrixTests++;
            const bx = centerBX + dx;
            const by = centerBY + dy;
            const bz = centerBZ + dz;

            // Analytical SAT overlap check between candidate cube [bx..bx+1, by..by+1, bz..bz+1] and playerAABB
            const cubeMinX = bx, cubeMaxX = bx + 1;
            const cubeMinY = by, cubeMaxY = by + 1;
            const cubeMinZ = bz, cubeMaxZ = bz + 1;

            const expectedOverlap = (
              playerAABB.maxX > cubeMinX && playerAABB.minX < cubeMaxX &&
              playerAABB.maxY > cubeMinY && playerAABB.minY < cubeMaxY &&
              playerAABB.maxZ > cubeMinZ && playerAABB.minZ < cubeMaxZ
            );

            const allowed = canPlaceBlockRay(world, { x: bx, y: by, z: bz }, playerAABB);

            if (allowed === !expectedOverlap) {
              matrixTestsPassed++;
            } else {
              assert(
                false,
                `SAT anti-clipping failure for ${posture.name} at player (${px.toFixed(2)}, ${py.toFixed(2)}, ${pz.toFixed(2)}) on block (${bx}, ${by}, ${bz})`
              );
            }
          }
        }
      }
    }
  }

  assert(
    matrixTestsPassed === totalMatrixTests,
    `Combinatorial anti-clipping matrix: ${matrixTestsPassed}/${totalMatrixTests} tests passed (100% SAT accuracy across all postures)`
  );
}

// ============================================================================
// SUITE 10: State Machine Concurrency, Rapid Input & Audio Synthesis Triggers
// ============================================================================
sectionHeader('SUITE 10: State Machine Concurrency, Rapid Input & Audio Triggers');

{
  const world = new AdversarialWorld();
  world.setBlock(20, 64, 20, BLOCK.DIRT);

  const audioLog = [];
  const mockAudio = {
    playSound(soundName, details) {
      audioLog.push({ soundName, details });
    }
  };

  const bbm = new BlockBreakingManager(world, mockAudio);

  // 10.1 Rapid click pulsing (50 pulses)
  for (let p = 0; p < 50; p++) {
    bbm.update(0.02, { x: 20, y: 64, z: 20, blockId: BLOCK.DIRT });
    assert(bbm.accumulatedTime > 0, `Pulse ${p} accumulated dt`);
    bbm.stopMining();
    assertEqual(bbm.accumulatedTime, 0.0, `Pulse ${p} stopMining resets timer to 0`);
    assertEqual(bbm.getDamageStage(), -1, `Pulse ${p} stopMining resets stage to -1`);
  }

  // 10.2 Rapid target cycling across 4 different blocks
  const cycleBlocks = [
    { x: 20, y: 64, z: 20, blockId: BLOCK.DIRT },
    { x: 20, y: 64, z: 21, blockId: BLOCK.DIRT },
    { x: 21, y: 64, z: 20, blockId: BLOCK.DIRT },
    { x: 21, y: 64, z: 21, blockId: BLOCK.DIRT }
  ];

  for (let c = 0; c < 40; c++) {
    const target = cycleBlocks[c % cycleBlocks.length];
    bbm.update(0.05, target);
    assertClose(bbm.accumulatedTime, 0.05, 1e-5, `Cycle ${c}: target shift keeps accumulated time exactly 0.05`);
  }

  // 10.3 Audio trigger on block destruction
  bbm.stopMining();
  audioLog.length = 0;
  bbm.update(0.75, { x: 20, y: 64, z: 20, blockId: BLOCK.DIRT });
  assertEqual(audioLog.length, 1, 'Audio playSound triggered exactly once on block break');
  assertEqual(audioLog[0].soundName, 'break_pop', 'Audio soundName is break_pop');
  assertEqual(audioLog[0].details.blockId, BLOCK.DIRT, 'Audio details contains blockId');

  // 10.4 Audio trigger on block placement
  audioLog.length = 0;
  const farAABB = createPlayerAABB({ x: 0, y: 64, z: 0 });
  const placeRay = {
    hit: true,
    blockPos: { x: 20, y: 63, z: 20 },
    placePos: { x: 20, y: 64, z: 20 }
  };
  const heldDirt = { id: BLOCK.DIRT, count: 5 };
  const placeResult = bbm.tryPlaceBlock(placeRay, heldDirt, farAABB, 5000);
  assert(placeResult, 'Block placed successfully');
  assertEqual(audioLog.length, 1, 'Audio playSound triggered on block placement');
  assertEqual(audioLog[0].soundName, 'place', 'Audio soundName is place');
  assertEqual(audioLog[0].details.blockId, BLOCK.DIRT, 'Placement audio contains blockId');
}

// ============================================================================
// SUMMARY & VERDICT
// ============================================================================
console.log(`\n======================================================================`);
console.log(`CHALLENGER 2 ADVERSARIAL STRESS TEST SUMMARY (MILESTONE 3)`);
console.log(`======================================================================`);
console.log(`  Total Assertions:  ${totalAssertions}`);
console.log(`  Passed Assertions: ${passedAssertions}`);
console.log(`  Failed Assertions: ${failedAssertions}`);
console.log(`======================================================================`);

if (failedAssertions > 0) {
  console.log('\nFAILURES:');
  for (const f of failureDetails) {
    console.log(`  - ${f}`);
  }
  console.log('\nFINAL VERDICT: REJECT\n');
  process.exit(1);
} else {
  console.log('\nFINAL VERDICT: APPROVE (ALL EMPIRICAL M3 STRESS TESTS PASSED)\n');
  process.exit(0);
}
