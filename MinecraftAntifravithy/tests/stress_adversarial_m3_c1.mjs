/**
 * Adversarial Stress & Empirical Verification Test Suite for Milestone 3
 * Milestone 3: First-Person Physics, Voxel Raymarching & Block Interaction
 * Challenger 1 Suite
 *
 * Targets:
 * 1. High Velocity / Terminal Fall Collisions & Tunneling Immunity
 * 2. Step Climbing (0.5m, 0.6m, 0.601m rejection, 1.0m rejection, low ceiling, mid-air)
 * 3. Sneak Edge-Clamping on Precarious Cliffs (8-directional stress, release drops, dynamic toggling)
 * 4. Fluid Viscous Drag, Buoyancy, and Crawl Posture Transitions
 * 5. Creative Flight Kinematics, Double-tap Window & Hover Stability
 * 6. Amanatides-Woo 3D DDA Raymarching (Cardinal, Diagonal, Fluid Bypass, Zero Vector, 5m Reach)
 * 7. Block Placement Anti-Clipping (Standing, Sneaking, Crawling, Altitude bounds, Replaceable blocks)
 * 8. Block Breaking State Machine, Hardness Tables, Tool Multipliers, and Mesh Invalidation
 */

import {
  AABB,
  PLAYER_DIMS,
  GRAVITY,
  TERMINAL_VELOCITY,
  STEP_HEIGHT,
  JUMP_IMPULSE,
  createPlayerAABB,
  clipAxisX,
  clipAxisY,
  clipAxisZ,
  resolveAxisCollision
} from '../src/physics/aabb.js';

import { FirstPersonController } from '../src/physics/controller.js';

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
import { WorldManager } from '../src/world/world.js';

// ============================================================================
// Stress Test Harness Infrastructure
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

function printHeader(title) {
  console.log(`\n>>> ${title}`);
}

// Custom World mock for fractional obstacles and controlled arenas
class ControlledPhysicsWorld {
  constructor() {
    this.blocks = new Map(); // "x,y,z" -> blockId
    this.customColliders = []; // Array of AABBs
  }

  setBlock(x, y, z, id) {
    this.blocks.set(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`, id);
  }

  getBlock(x, y, z) {
    return this.blocks.get(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`) || BLOCK.AIR;
  }

  addCustomCollider(aabb) {
    this.customColliders.push(aabb);
  }

  clear() {
    this.blocks.clear();
    this.customColliders = [];
  }

  getIntersectingBlockAABBs(box) {
    const colliders = [];

    // 1. Grid blocks
    const minX = Math.floor(box.minX);
    const maxX = Math.floor(box.maxX - 1e-6);
    const minY = Math.max(0, Math.floor(box.minY));
    const maxY = Math.min(255, Math.floor(box.maxY - 1e-6));
    const minZ = Math.floor(box.minZ);
    const maxZ = Math.floor(box.maxZ - 1e-6);

    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          const id = this.getBlock(x, y, z);
          if (
            id !== BLOCK.AIR &&
            id !== BLOCK.WATER &&
            id !== BLOCK.LAVA &&
            id !== BLOCK.FIRE &&
            id !== BLOCK.TALL_GRASS &&
            id !== BLOCK.PINK_PETALS
          ) {
            colliders.push(new AABB(x, y, z, x + 1, y + 1, z + 1));
          }
        }
      }
    }

    // 2. Custom sub-block colliders (slabs, arbitrary obstacles)
    for (const c of this.customColliders) {
      if (
        box.maxX > c.minX && box.minX < c.maxX &&
        box.maxY > c.minY && box.minY < c.maxY &&
        box.maxZ > c.minZ && box.minZ < c.maxZ
      ) {
        colliders.push(c);
      }
    }

    return colliders;
  }
}

// ============================================================================
// TARGET 1: High Velocity Fall, Discrete Tunneling Immunity & Bedrock Impact
// ============================================================================
printHeader('TARGET 1: High Velocity Fall, Discrete Tunneling Immunity & Bedrock Impact');

{
  const world = new ControlledPhysicsWorld();

  // Arena 1: 1-block thin stone floor suspended over empty void
  // Floor at Y=64 (occupies [X, 64..65, Z]). Air below at Y=63.
  for (let x = -10; x <= 10; x++) {
    for (let z = -10; z <= 10; z++) {
      world.setBlock(x, 64, z, BLOCK.STONE);
    }
  }

  // 1.1 Terminal Velocity Freefall: drop from Y=250 down to Y=65
  const ctrl1 = new FirstPersonController(world, { x: 0.5, y: 250.0, z: 0.5 });
  let landed = false;
  let ticks = 0;
  while (ticks++ < 500 && !landed) {
    ctrl1.tickPhysics();
    if (ctrl1.onGround) {
      landed = true;
    }
  }

  assert(landed, 'Player must eventually land after freefall from Y=250');
  assertClose(ctrl1.pos.y, 65.0, 1e-4, 'Player must settle cleanly on floor top surface at Y=65.0');
  assertClose(ctrl1.vel.y, 0, 1e-4, 'Vertical velocity must be zeroed upon impact');
  assert(ctrl1.onGround === true, 'Controller must register onGround === true on impact');

  // 1.2 Tunneling Stress: Direct Terminal Velocity Impact on Single Tick
  // At terminal velocity, dy = -3.92 b/t.
  // Start player at Y=65.5 (only 0.5m above floor). Unchecked discrete move would place player at 61.58 (below floor!).
  const ctrl2 = new FirstPersonController(world, { x: 0.5, y: 65.5, z: 0.5 });
  ctrl2.vel.y = -TERMINAL_VELOCITY;
  ctrl2.tickPhysics();

  assertClose(ctrl2.pos.y, 65.0, 1e-4, 'Terminal velocity single-tick fall must NOT tunnel through 1-block floor');
  assert(ctrl2.onGround === true, 'Terminal velocity collision must register onGround');
  assert(ctrl2.vel.y === 0, 'Velocity must be zeroed at collision');

  // 1.3 Super-Terminal Hyper-Velocity Stress (-10.0, -50.0, -100.0, -1000.0 b/t)
  const hyperVelocities = [-10.0, -25.0, -50.0, -100.0, -1000.0];
  for (const v of hyperVelocities) {
    const ctrlHyper = new FirstPersonController(world, { x: 0.5, y: 68.0, z: 0.5 });
    // Manually test moveWithCollision
    const res = ctrlHyper.moveWithCollision(0, v, 0);
    assertClose(res.pos.y, 65.0, 1e-4, `Hyper-velocity fall dy=${v} must halt on floor at Y=65.0`);
    assert(res.onGround === true, `Hyper-velocity fall dy=${v} must set onGround=true`);
    assert(res.hitY === true, `Hyper-velocity fall dy=${v} must set hitY=true`);
  }

  // 1.4 Horizontal Thin Wall Tunneling Stress (+1.0 from close, +5.0, +15.0, +30.0, +100.0 b/t)
  // Thin 1-block stone wall at X=10 (occupies [10..11, Y, Z]).
  world.clear();
  for (let y = 60; y <= 70; y++) {
    for (let z = -5; z <= 5; z++) {
      world.setBlock(10, y, z, BLOCK.STONE);
    }
  }

  // A) Short distance collision: start at x=9.0 (dist to wall 0.7m), move vx=1.0
  const ctrlShort = new FirstPersonController(world, { x: 9.0, y: 64.0, z: 0.0 });
  const resShort = ctrlShort.moveWithCollision(1.0, 0, 0);
  assertClose(resShort.pos.x, 9.7, 1e-4, 'Short horizontal move vx=1.0 halts at wall front face (pos.x=9.7)');
  assert(resShort.hitX === true, 'Short horizontal move reports hitX=true');

  // B) Unhindered movement: start at x=5.0, move vx=1.0 (reaches 6.0, dist to wall still 3.7m)
  const ctrlUnhindered = new FirstPersonController(world, { x: 5.0, y: 64.0, z: 0.0 });
  const resUnhindered = ctrlUnhindered.moveWithCollision(1.0, 0, 0);
  assertClose(resUnhindered.pos.x, 6.0, 1e-4, 'Unhindered move vx=1.0 reaches x=6.0 safely');
  assert(resUnhindered.hitX === false, 'Unhindered move reports hitX=false');

  // C) High-speed ballistic velocities from x=5.0 hitting wall at x=10
  const hVelocities = [5.0, 15.0, 30.0, 100.0, 500.0];
  for (const vx of hVelocities) {
    const ctrlH = new FirstPersonController(world, { x: 5.0, y: 64.0, z: 0.0 });
    // Player width 0.6 (half-width 0.3). MaxX starts at 5.3. Wall minX is 10.0.
    // At collision, player maxX should hit 10.0 => pos.x should be exactly 9.7!
    const moveRes = ctrlH.moveWithCollision(vx, 0, 0);
    assertClose(moveRes.pos.x, 9.7, 1e-4, `High-speed horizontal vx=${vx} must halt at wall front face (pos.x=9.7)`);
    assert(moveRes.hitX === true, `High-speed horizontal vx=${vx} must report hitX=true`);
  }

  // 1.5 Decoupled Axis Ordering (Y -> X -> Z sweep)
  // Corner collision: simultaneously moving into floor (Y) and wall corner (X, Z)
  const box = new AABB(0.0, 1.0, 0.0, 0.6, 2.8, 0.6);
  const colliders = [
    new AABB(-1, 0, -1, 3, 1, 3), // Floor at Y in [0, 1]
    new AABB(1, 1, -1, 2, 3, 3),  // Wall at X in [1, 2]
    new AABB(-1, 1, 1, 3, 3, 2)   // Wall at Z in [1, 2]
  ];
  const diagonalVel = { x: 0.8, y: -0.5, z: 0.8 };
  const resDecoupled = resolveAxisCollision(box, diagonalVel, colliders);

  assertClose(resDecoupled.resolvedVelocity.y, 0.0, 1e-4, 'Decoupled Y collision halts on floor');
  assertClose(resDecoupled.resolvedVelocity.x, 0.4, 1e-4, 'Decoupled X collision halts at wall (1.0 - 0.6 = 0.4)');
  assertClose(resDecoupled.resolvedVelocity.z, 0.4, 1e-4, 'Decoupled Z collision halts at wall (1.0 - 0.6 = 0.4)');
  assert(resDecoupled.hitY && resDecoupled.hitX && resDecoupled.hitZ, 'All 3 axes register hits correctly');
}

// ============================================================================
// TARGET 2: Step Climbing & Vertical Obstacle Geometry Stress
// ============================================================================
printHeader('TARGET 2: Step Climbing & Vertical Obstacle Geometry Stress');

{
  const world = new ControlledPhysicsWorld();

  // Floor at Y=64.0 (Y in [63, 64])
  for (let x = -5; x <= 5; x++) {
    for (let z = -5; z <= 5; z++) {
      world.setBlock(x, 63, z, BLOCK.STONE);
    }
  }

  // 2.1 Standard 0.5m Half-Slab Step (Y=64.0 to 64.5, X in [1, 2], Z in [-2, 2])
  world.addCustomCollider(new AABB(1.0, 64.0, -2.0, 2.0, 64.5, 2.0));

  // Player at (0.5, 64.0, 0.0), facing +X. Player maxX is 0.8. Obstacle minX is 1.0.
  const ctrlStep = new FirstPersonController(world, { x: 0.5, y: 64.0, z: 0.0 });
  ctrlStep.onGround = true;

  // Move forward +X by 0.5 units (would collide with 0.5m slab at dx=0.2)
  const resStep05 = ctrlStep.moveWithCollision(0.5, 0, 0);

  assert(resStep05.stepped === true, 'Controller must trigger step climbing over 0.5m slab');
  assertClose(resStep05.pos.y, 64.5, 1e-4, 'Player must be stepped up to Y=64.5 on slab top');
  assertClose(resStep05.pos.x, 1.0, 1e-4, 'Player must advance full distance (0.5 + 0.5 = 1.0) onto slab');
  assert(resStep05.onGround === true, 'Player must remain onGround after stepping');

  // 2.2 Boundary 0.6m Step (Exact STEP_HEIGHT)
  world.clear();
  for (let x = -5; x <= 5; x++) {
    for (let z = -5; z <= 5; z++) {
      world.setBlock(x, 63, z, BLOCK.STONE);
    }
  }
  world.addCustomCollider(new AABB(1.0, 64.0, -2.0, 2.0, 64.6, 2.0)); // 0.6m obstacle
  const ctrlStep06 = new FirstPersonController(world, { x: 0.5, y: 64.0, z: 0.0 });
  ctrlStep06.onGround = true;
  const resStep06 = ctrlStep06.moveWithCollision(0.5, 0, 0);

  assert(resStep06.stepped === true, 'Controller must trigger step climbing over exact 0.6m boundary step');
  assertClose(resStep06.pos.y, 64.6, 1e-4, 'Player must step up to Y=64.6');
  assertClose(resStep06.pos.x, 1.0, 1e-4, 'Player must advance full distance onto 0.6m step');

  // 2.3 Super-Step 0.601m Obstacle Rejection (Exceeds STEP_HEIGHT = 0.6)
  world.clear();
  for (let x = -5; x <= 5; x++) {
    for (let z = -5; z <= 5; z++) {
      world.setBlock(x, 63, z, BLOCK.STONE);
    }
  }
  world.addCustomCollider(new AABB(1.0, 64.0, -2.0, 2.0, 64.601, 2.0)); // 0.601m obstacle
  const ctrlStepReject = new FirstPersonController(world, { x: 0.5, y: 64.0, z: 0.0 });
  ctrlStepReject.onGround = true;
  const resStepReject = ctrlStepReject.moveWithCollision(0.5, 0, 0);

  assert(resStepReject.stepped === false, '0.601m obstacle must NOT be climbed');
  assertClose(resStepReject.pos.y, 64.0, 1e-4, 'Player must stay at ground level Y=64.0');
  assertClose(resStepReject.pos.x, 0.7, 1e-4, 'Player must halt at wall front (1.0 - 0.3 = 0.7)');
  assert(resStepReject.hitX === true, 'Horizontal collision must register hitX === true');

  // 2.4 1.0m Full Block Wall Rejection
  world.clear();
  for (let x = -5; x <= 5; x++) {
    for (let z = -5; z <= 5; z++) {
      world.setBlock(x, 63, z, BLOCK.STONE);
    }
  }
  world.setBlock(1, 64, 0, BLOCK.STONE); // 1.0m full block [1..2, 64..65, 0..1]
  const ctrlWall = new FirstPersonController(world, { x: 0.5, y: 64.0, z: 0.5 });
  ctrlWall.onGround = true;
  const resWall = ctrlWall.moveWithCollision(0.5, 0, 0);

  assert(resWall.stepped === false, '1.0m full block cannot be stepped over');
  assertClose(resWall.pos.y, 64.0, 1e-4, 'Player Y position must not change on wall collision');
  assertClose(resWall.pos.x, 0.7, 1e-4, 'Player X must be stopped at wall boundary (0.7)');

  // 2.5 Low Ceiling Obstacle Headroom Contraction
  // Obstacle is 0.5m step at X=1.0. Ceiling at Y=66.0 (only 0.2m headroom above player head at 65.8).
  world.clear();
  for (let x = -5; x <= 5; x++) {
    for (let z = -5; z <= 5; z++) {
      world.setBlock(x, 63, z, BLOCK.STONE);
      world.setBlock(x, 66, z, BLOCK.STONE); // Ceiling at Y=66..67
    }
  }
  world.addCustomCollider(new AABB(1.0, 64.0, -2.0, 2.0, 64.5, 2.0)); // 0.5m step
  const ctrlCeiling = new FirstPersonController(world, { x: 0.5, y: 64.0, z: 0.0 });
  ctrlCeiling.onGround = true;
  const resCeiling = ctrlCeiling.moveWithCollision(0.5, 0, 0);

  // Because headroom is only 0.2m, stepUp is limited to 0.2m, which is insufficient to clear 0.5m step!
  assert(resCeiling.stepped === false, 'Low ceiling must prevent step climbing when headroom is insufficient');
  assertClose(resCeiling.pos.y, 64.0, 1e-4, 'Player must remain on ground and not clip into ceiling');

  // 2.6 Mid-Air Step Climbing Immunity
  // Falling or jumping player (onGround === false) colliding with 0.5m step
  const ctrlMidAir = new FirstPersonController(world, { x: 0.5, y: 64.2, z: 0.0 });
  ctrlMidAir.onGround = false; // in air
  const resMidAir = ctrlMidAir.moveWithCollision(0.5, -0.1, 0);
  assert(resMidAir.stepped === false, 'Mid-air player must not trigger step climbing');
}

// ============================================================================
// TARGET 3: Sneak Edge-Clamping on Precarious Cliffs
// ============================================================================
printHeader('TARGET 3: Sneak Edge-Clamping on Precarious Cliffs');

{
  const world = new ControlledPhysicsWorld();

  // Single block pillar at (0, 63, 0) - bounds [0, 63, 0] to [1, 64, 1].
  // All surrounding blocks are open void air down to Y=0!
  world.setBlock(0, 63, 0, BLOCK.STONE);

  // 3.1 8-Directional Sneak Edge-Clamping Stress Test
  // Player stands at center (0.5, 64.0, 0.5).
  // Test driving movement in 8 directions with sneak held for 100 ticks each.
  const directions = [
    { name: '+X (East)', input: { forward: true }, yaw: -Math.PI / 2 },
    { name: '-X (West)', input: { forward: true }, yaw: Math.PI / 2 },
    { name: '+Z (South)', input: { forward: true }, yaw: 0 },
    { name: '-Z (North)', input: { forward: true }, yaw: Math.PI },
    { name: '+X +Z (South-East)', input: { forward: true, right: true }, yaw: 0 },
    { name: '-X +Z (South-West)', input: { forward: true, left: true }, yaw: 0 },
    { name: '+X -Z (North-East)', input: { backward: true, right: true }, yaw: 0 },
    { name: '-X -Z (North-West)', input: { backward: true, left: true }, yaw: 0 }
  ];

  for (const dir of directions) {
    const ctrlSneak = new FirstPersonController(world, { x: 0.5, y: 64.0, z: 0.5 });
    ctrlSneak.yaw = dir.yaw;

    let fellOff = false;
    for (let t = 0; t < 100; t++) {
      ctrlSneak.tickPhysics({ ...dir.input, sneak: true });
      if (ctrlSneak.pos.y < 64.0 || !ctrlSneak.onGround) {
        fellOff = true;
        break;
      }
    }

    assert(!fellOff, `Sneaking player must NEVER fall off cliff along direction ${dir.name}`);
    assertClose(ctrlSneak.pos.y, 64.0, 1e-4, `Player Y must remain strictly 64.0 along ${dir.name}`);
    assert(ctrlSneak.onGround === true, `Player must maintain onGround === true along ${dir.name}`);

    // Bounding box must maintain at least fractional footprint overlap with the block [0..1, 63..64, 0..1]
    const pBox = ctrlSneak.playerAABB;
    const hasOverlap = (
      pBox.maxX > 0.0 && pBox.minX < 1.0 &&
      pBox.maxZ > 0.0 && pBox.minZ < 1.0
    );
    assert(hasOverlap, `Player bounding box must maintain foot support over stone pillar along ${dir.name}`);
  }

  // 3.2 Non-Sneaking Control Comparison (Immediate Plummet)
  const ctrlWalkOff = new FirstPersonController(world, { x: 0.5, y: 64.0, z: 0.5 });
  ctrlWalkOff.yaw = 0; // facing +Z
  let walkedOff = false;
  for (let t = 0; t < 20; t++) {
    ctrlWalkOff.tickPhysics({ forward: true, sneak: false }); // NOT sneaking
    if (ctrlWalkOff.pos.y < 64.0 || !ctrlWalkOff.onGround) {
      walkedOff = true;
      break;
    }
  }
  assert(walkedOff, 'Non-sneaking player MUST walk off cliff edge and fall into void');

  // 3.3 Dynamic Sneak Release at Edge
  // Player sneaks to the precipice, halts, then releases sneak while walking forward
  const ctrlDynamic = new FirstPersonController(world, { x: 0.5, y: 64.0, z: 0.5 });
  ctrlDynamic.yaw = 0;
  for (let t = 0; t < 50; t++) {
    ctrlDynamic.tickPhysics({ forward: true, sneak: true });
  }
  assertClose(ctrlDynamic.pos.y, 64.0, 1e-4, 'Precipice reached while sneaking');
  // Now release sneak
  ctrlDynamic.tickPhysics({ forward: true, sneak: false });
  ctrlDynamic.tickPhysics({ forward: true, sneak: false });
  assert(ctrlDynamic.pos.y < 64.0, 'Releasing sneak at cliff edge must allow player to fall');
}

// ============================================================================
// TARGET 4: Fluid Viscous Drag, Buoyancy & Crawl Posture Transitions
// ============================================================================
printHeader('TARGET 4: Fluid Viscous Drag, Buoyancy & Crawl Posture Transitions');

{
  const world = new ControlledPhysicsWorld();

  // Water pool: bottom stone at Y=50, water from Y=51 to Y=63, air above Y=64.
  for (let x = -5; x <= 5; x++) {
    for (let z = -5; z <= 5; z++) {
      world.setBlock(x, 50, z, BLOCK.STONE);
      for (let y = 51; y <= 63; y++) {
        world.setBlock(x, y, z, BLOCK.WATER);
      }
    }
  }

  // 4.1 Water Surface Entry & High Velocity Cushioning
  const ctrlDive = new FirstPersonController(world, { x: 0.5, y: 70.0, z: 0.5 });
  let enteredWater = false;
  let maxDownwardVelInWater = 0;
  for (let t = 0; t < 50; t++) {
    ctrlDive.tickPhysics();
    if (ctrlDive.inWater) {
      enteredWater = true;
      if (Math.abs(ctrlDive.vel.y) > maxDownwardVelInWater) {
        maxDownwardVelInWater = Math.abs(ctrlDive.vel.y);
      }
    }
  }

  assert(enteredWater, 'Freefall into water pool must register inWater === true');
  // Water viscous drag is 0.8; downward velocity must quickly decelerate
  assert(Math.abs(ctrlDive.vel.y) < 0.2, 'Water viscous drag must cushion and decelerate fall velocity');

  // 4.2 Passive Buoyancy Floatation
  // Submerged player at Y=55 with no input keys pressed
  const ctrlBuoyant = new FirstPersonController(world, { x: 0.5, y: 55.0, z: 0.5 });
  ctrlBuoyant.vel.y = 0;
  for (let t = 0; t < 30; t++) {
    ctrlBuoyant.tickPhysics(); // no inputs
  }
  assert(ctrlBuoyant.pos.y > 55.0, 'Passive buoyancy must lift submerged player upward');
  assert(ctrlBuoyant.vel.y > 0, 'Buoyancy must provide positive upward vertical velocity');

  // 4.3 Active Swimming Controls (Jump to Ascend, Sneak to Sink)
  const ctrlSwimUp = new FirstPersonController(world, { x: 0.5, y: 55.0, z: 0.5 });
  ctrlSwimUp.tickPhysics({ jump: true });
  assert(ctrlSwimUp.vel.y > 0.03, 'Jump in water must accelerate upward');

  const ctrlSwimDown = new FirstPersonController(world, { x: 0.5, y: 55.0, z: 0.5 });
  ctrlSwimDown.tickPhysics({ sneak: true });
  assert(ctrlSwimDown.vel.y < 0, 'Sneak in water must pull player downward');

  // 4.4 1x1 Water Crawl Tunnel Traversal
  // 1-block high water tunnel: stone floor at Y=60, stone ceiling at Y=62, water at Y=61.
  // Height between floor (61.0) and ceiling (62.0) is exactly 1.0 block!
  world.clear();
  for (let x = -5; x <= 5; x++) {
    world.setBlock(x, 60, 0, BLOCK.STONE); // floor at 60..61
    world.setBlock(x, 61, 0, BLOCK.WATER); // water at 61..62
    world.setBlock(x, 62, 0, BLOCK.STONE); // ceiling at 62..63
  }

  // Standing player height is 1.8m -> cannot fit in 1.0m height!
  const standingBox = createPlayerAABB({ x: 0.5, y: 61.0, z: 0.5 }, false, false);
  assertClose(standingBox.maxY - standingBox.minY, 1.8, 1e-4, 'Standing height is 1.8m');
  assert(standingBox.maxY > 62.0, 'Standing player penetrates 62.0 ceiling');

  // Swimming player posture height is 0.6m -> fits cleanly in 1.0m tunnel!
  const swimBox = createPlayerAABB({ x: 0.5, y: 61.0, z: 0.5 }, false, true);
  assertClose(swimBox.maxY - swimBox.minY, 0.6, 1e-4, 'Swimming height is 0.6m');
  assert(swimBox.maxY <= 62.0, 'Swimming player fits under 62.0 ceiling');

  const ctrlCrawl = new FirstPersonController(world, { x: -3.0, y: 61.2, z: 0.5 });
  ctrlCrawl.inWater = true;
  ctrlCrawl.isSwimming = true;
  assertClose(ctrlCrawl.eyeHeight, 0.40, 1e-4, 'Swimming eye height is 0.40m');

  // Horizontal motion inside 1x1 tunnel
  const tunnelRes = ctrlCrawl.moveWithCollision(1.0, 0, 0);
  assertClose(tunnelRes.pos.x, -2.0, 1e-4, 'Swimming player traverses through 1x1 water tunnel without ceiling collision');

  // 4.5 Lava Viscous Drag (0.5 drag, stronger gravity)
  world.clear();
  world.setBlock(0, 60, 0, BLOCK.STONE);
  world.setBlock(0, 61, 0, BLOCK.LAVA);
  const ctrlLava = new FirstPersonController(world, { x: 0.5, y: 61.2, z: 0.5 });
  ctrlLava.vel.x = 1.0;
  ctrlLava.tickPhysics();
  assert(ctrlLava.vel.x <= 0.5, 'Lava viscous drag (0.5) strongly dampens horizontal velocity');
}

// ============================================================================
// TARGET 5: Creative Flight Kinematics, Double-tap Window & Hover Stability
// ============================================================================
printHeader('TARGET 5: Creative Flight Kinematics, Double-tap Window & Hover Stability');

{
  const world = new ControlledPhysicsWorld();
  const ctrlFlight = new FirstPersonController(world, { x: 0.5, y: 100.0, z: 0.5 });

  // 5.1 Double-tap Space Window Timing
  assert(ctrlFlight.isFlying === false, 'Flight initially disabled');

  // Tap 1 at t=1000
  ctrlFlight.handleSpacePress(1000);
  assert(ctrlFlight.isFlying === false, 'Single tap does not toggle flight');

  // Tap 2 at t=1200 (within 300ms window)
  ctrlFlight.handleSpacePress(1200);
  assert(ctrlFlight.isFlying === true, 'Double tap within 200ms must enable flight');

  // Tap 3 at t=2000 (after 800ms)
  ctrlFlight.handleSpacePress(2000);
  assert(ctrlFlight.isFlying === true, 'Single tap after delay does not disable flight');

  // Tap 4 at t=2150 (within 150ms window)
  ctrlFlight.handleSpacePress(2150);
  assert(ctrlFlight.isFlying === false, 'Double tap disables flight');

  // Tap with > 300ms window rejection
  ctrlFlight.handleSpacePress(3000);
  ctrlFlight.handleSpacePress(3350); // 350ms later (> 300ms)
  assert(ctrlFlight.isFlying === false, 'Double tap after 350ms must NOT toggle flight');

  // Enable flight for kinematics testing
  ctrlFlight.isFlying = true;

  // 5.2 Hover Stability & Gravity Suspension
  // Run 100 ticks with no inputs; player altitude must remain exactly 100.0
  for (let t = 0; t < 100; t++) {
    ctrlFlight.tickPhysics({});
  }
  assertClose(ctrlFlight.pos.y, 100.0, 1e-4, 'Hover stability: player must not fall under gravity while flying');
  assertClose(ctrlFlight.vel.y, 0.0, 1e-4, 'Hover stability: vertical velocity must remain 0.0');

  // 5.3 Vertical Climb & Descent Speeds
  // Normal flight jump: 0.4 b/t
  ctrlFlight.tickPhysics({ jump: true, sprint: false });
  assertClose(ctrlFlight.vel.y, 0.4, 1e-4, 'Normal flight climb speed must be 0.4 b/t');

  // Sprinting flight jump: 0.8 b/t
  ctrlFlight.tickPhysics({ jump: true, sprint: true });
  assertClose(ctrlFlight.vel.y, 0.8, 1e-4, 'Sprinting flight climb speed must be 0.8 b/t');

  // Normal flight sneak: -0.4 b/t
  ctrlFlight.tickPhysics({ sneak: true, sprint: false });
  assertClose(ctrlFlight.vel.y, -0.4, 1e-4, 'Normal flight descent speed must be -0.4 b/t');

  // Sprinting flight sneak: -0.8 b/t
  ctrlFlight.tickPhysics({ sneak: true, sprint: true });
  assertClose(ctrlFlight.vel.y, -0.8, 1e-4, 'Sprinting flight descent speed must be -0.8 b/t');

  // 5.4 Snappy Flight Horizontal Friction (0.7)
  ctrlFlight.vel.x = 1.0;
  ctrlFlight.tickPhysics({});
  assertClose(ctrlFlight.vel.x, 0.7, 1e-4, 'Flight friction multiplier must be 0.7');

  // 5.5 Flight Solid Wall Collision Rejection
  // Place high wall at X=5.0
  world.setBlock(5, 100, 0, BLOCK.STONE);
  ctrlFlight.pos.x = 4.0;
  ctrlFlight.pos.y = 100.0;
  ctrlFlight.pos.z = 0.5;

  // Sprint fly at +X directly towards wall
  const flyRes = ctrlFlight.moveWithCollision(2.0, 0, 0);
  assertClose(flyRes.pos.x, 4.7, 1e-4, 'Flying sprint must halt at wall front face without tunneling');
  assert(flyRes.hitX === true, 'Wall collision must register hitX === true while flying');
}

// ============================================================================
// TARGET 6: Amanatides-Woo 3D DDA Raymarching Rigorous Verification
// ============================================================================
printHeader('TARGET 6: Amanatides-Woo 3D DDA Raymarching Rigorous Verification');

{
  const world = new ControlledPhysicsWorld();

  // Place target stone block at (10, 64, 10)
  world.setBlock(10, 64, 10, BLOCK.STONE);

  // 6.1 6-Axis Cardinal Ray Casts & Exact Face Normals
  const testFaces = [
    { name: '+X Ray (hits West face)', origin: { x: 7.5, y: 64.5, z: 10.5 }, dir: { x: 1, y: 0, z: 0 }, expectedNormal: { x: -1, y: 0, z: 0 }, expectedFace: 5 },
    { name: '-X Ray (hits East face)', origin: { x: 12.5, y: 64.5, z: 10.5 }, dir: { x: -1, y: 0, z: 0 }, expectedNormal: { x: 1, y: 0, z: 0 }, expectedFace: 4 },
    { name: '+Y Ray (hits Bottom face)', origin: { x: 10.5, y: 61.5, z: 10.5 }, dir: { x: 0, y: 1, z: 0 }, expectedNormal: { x: 0, y: -1, z: 0 }, expectedFace: 1 },
    { name: '-Y Ray (hits Top face)', origin: { x: 10.5, y: 67.5, z: 10.5 }, dir: { x: 0, y: -1, z: 0 }, expectedNormal: { x: 0, y: 1, z: 0 }, expectedFace: 0 },
    { name: '+Z Ray (hits North face)', origin: { x: 10.5, y: 64.5, z: 7.5 }, dir: { x: 0, y: 0, z: 1 }, expectedNormal: { x: 0, y: 0, z: -1 }, expectedFace: 3 },
    { name: '-Z Ray (hits South face)', origin: { x: 10.5, y: 64.5, z: 13.5 }, dir: { x: 0, y: 0, z: -1 }, expectedNormal: { x: 0, y: 0, z: 1 }, expectedFace: 2 }
  ];

  for (const tf of testFaces) {
    const hit = castRay(world, tf.origin, tf.dir, 5.0);
    assert(hit.hit === true, `Ray must hit target block in ${tf.name}`);
    assert(hit.blockPos.x === 10 && hit.blockPos.y === 64 && hit.blockPos.z === 10, `Block position match in ${tf.name}`);
    assertClose(hit.normal.x, tf.expectedNormal.x, 1e-4, `Normal X match in ${tf.name}`);
    assertClose(hit.normal.y, tf.expectedNormal.y, 1e-4, `Normal Y match in ${tf.name}`);
    assertClose(hit.normal.z, tf.expectedNormal.z, 1e-4, `Normal Z match in ${tf.name}`);
    assert(hit.faceIndex === tf.expectedFace, `Face index match in ${tf.name}`);

    // Verify candidate placement position = blockPos + normal
    assert(hit.placePos.x === hit.blockPos.x + tf.expectedNormal.x, `Placement X match in ${tf.name}`);
    assert(hit.placePos.y === hit.blockPos.y + tf.expectedNormal.y, `Placement Y match in ${tf.name}`);
    assert(hit.placePos.z === hit.blockPos.z + tf.expectedNormal.z, `Placement Z match in ${tf.name}`);
  }

  // 6.2 Diagonal Ray Cast & Geometric Accuracy
  // Target stone block at (5, 5, 5)
  world.clear();
  world.setBlock(5, 5, 5, BLOCK.STONE);
  const diagHit = castRay(world, { x: 2.5, y: 2.5, z: 2.5 }, { x: 1, y: 1, z: 1 }, 5.0);
  assert(diagHit.hit === true, 'Diagonal ray must hit target block');
  assert(diagHit.blockPos.x === 5 && diagHit.blockPos.y === 5 && diagHit.blockPos.z === 5, 'Diagonal block pos match');

  // 6.3 Reach Distance Limit (4.9m vs 5.1m)
  world.clear();
  world.setBlock(0, 64, 4, BLOCK.STONE); // Face at Z=4.0
  // Eye at Z= -0.9 -> distance to Z=4.0 is 4.9m (<= 5.0m)
  const reachHit = castRay(world, { x: 0.5, y: 64.5, z: -0.9 }, { x: 0, y: 0, z: 1 }, 5.0);
  assert(reachHit.hit === true, 'Block within reach (4.9m) must hit');

  // Eye at Z= -1.1 -> distance to Z=4.0 is 5.1m (> 5.0m)
  const missHit = castRay(world, { x: 0.5, y: 64.5, z: -1.1 }, { x: 0, y: 0, z: 1 }, 5.0);
  assert(missHit.hit === false, 'Block beyond reach (5.1m) must miss');

  // 6.4 Transparent Fluid Pass-Through
  world.clear();
  // Line of water from Z=1 to Z=3, Stone at Z=4
  world.setBlock(0, 64, 1, BLOCK.WATER);
  world.setBlock(0, 64, 2, BLOCK.WATER);
  world.setBlock(0, 64, 3, BLOCK.WATER);
  world.setBlock(0, 64, 4, BLOCK.STONE);

  const fluidHit = castRay(world, { x: 0.5, y: 64.5, z: 0.5 }, { x: 0, y: 0, z: 1 }, 5.0);
  assert(fluidHit.hit === true, 'Raycast must pass through water blocks');
  assert(fluidHit.blockId === BLOCK.STONE, 'Raycast through water must target stone block behind');
  assert(fluidHit.blockPos.z === 4, 'Hit block pos Z must be stone at Z=4');

  // 6.5 Zero Vector & Numerical Singularity Immunity
  const zeroHit = castRay(world, { x: 0, y: 64, z: 0 }, { x: 0, y: 0, z: 0 });
  assert(zeroHit.hit === false, 'Zero length direction vector safely returns hit === false');

  const microHit = castRay(world, { x: 0, y: 64, z: 0 }, { x: 1e-15, y: 1e-15, z: 1e-15 });
  assert(microHit.hit === false, 'Micro-epsilon direction vector safely handles raymarching');

  // 6.6 Wireframe Box Vertices Spec
  const wireVertices = generateWireframeBoxVertices(0.002);
  assert(wireVertices instanceof Float32Array, 'Wireframe vertices must be Float32Array');
  assert(wireVertices.length === 72, 'Wireframe must consist of 72 floats (24 vec3 vertices for 12 lines)');
}

// ============================================================================
// TARGET 7: Block Anti-Clipping & Placement Validation
// ============================================================================
printHeader('TARGET 7: Block Anti-Clipping & Placement Validation');

{
  const world = new ControlledPhysicsWorld();

  // Player stands at (10.5, 64.0, 10.5)
  // Standing AABB: [10.2, 64.0, 10.2] to [10.8, 65.8, 10.8]
  const standingBox = createPlayerAABB({ x: 10.5, y: 64.0, z: 10.5 }, false, false);

  // 7.1 Feet Placement (Block at 10, 64, 10 -> [10..11, 64..65, 10..11])
  const feetPlace = canPlaceBlockRay(world, { x: 10, y: 64, z: 10 }, standingBox);
  assert(feetPlace === false, 'Placement inside standing player feet must be rejected by anti-clipping');

  // 7.2 Head Placement (Block at 10, 65, 10 -> [10..11, 65..66, 10..11])
  const headPlace = canPlaceBlockRay(world, { x: 10, y: 65, z: 10 }, standingBox);
  assert(headPlace === false, 'Placement inside standing player head must be rejected by anti-clipping');

  // 7.3 Above Head Placement (Block at 10, 66, 10 -> [10..11, 66..67, 10..11])
  const abovePlace = canPlaceBlockRay(world, { x: 10, y: 66, z: 10 }, standingBox);
  assert(abovePlace === true, 'Placement directly above player head must be accepted');

  // 7.4 Sneaking Posture Differential
  // Sneaking height is 1.5m -> maxY is 65.5.
  // Candidate block at (10, 66, 10) occupies [66..67] -> clear.
  // Candidate block at (10, 65, 10) occupies [65..66] -> overlaps sneaking box [64.0..65.5].
  const sneakBox = createPlayerAABB({ x: 10.5, y: 64.0, z: 10.5 }, true, false);
  assert(canPlaceBlockRay(world, { x: 10, y: 65, z: 10 }, sneakBox) === false, 'Sneak box still overlaps Y=65 block');

  // Crawling/Swimming posture (height 0.6m -> maxY is 64.6)
  // Candidate block at (10, 65, 10) occupies [65..66] -> clear of 64.6!
  const crawlBox = createPlayerAABB({ x: 10.5, y: 64.0, z: 10.5 }, false, true);
  assert(canPlaceBlockRay(world, { x: 10, y: 65, z: 10 }, crawlBox) === true, 'Swimming posture clears Y=65 block placement');

  // 7.5 World Altitude Bounds [0, 255]
  assert(canPlaceBlockRay(world, { x: 0, y: 256, z: 0 }, standingBox) === false, 'Placement at Y=256 rejected');
  assert(canPlaceBlockRay(world, { x: 0, y: -1, z: 0 }, standingBox) === false, 'Placement at Y=-1 rejected');
  assert(canPlaceBlockRay(world, { x: 0, y: 255, z: 0 }, null) === true, 'Placement at Y=255 accepted');
  assert(canPlaceBlockRay(world, { x: 0, y: 0, z: 0 }, null) === true, 'Placement at Y=0 accepted');

  // 7.6 Replaceable Blocks (Water, Tall Grass, Pink Petals)
  world.setBlock(20, 64, 20, BLOCK.WATER);
  assert(canPlaceBlockRay(world, { x: 20, y: 64, z: 20 }, null) === true, 'Placement can replace water');

  world.setBlock(21, 64, 21, BLOCK.TALL_GRASS);
  assert(canPlaceBlockRay(world, { x: 21, y: 64, z: 21 }, null) === true, 'Placement can replace tall grass');

  world.setBlock(22, 64, 22, BLOCK.STONE);
  assert(canPlaceBlockRay(world, { x: 22, y: 64, z: 22 }, null) === false, 'Placement cannot replace solid stone');
}

// ============================================================================
// TARGET 8: Block Breaking State Machine, Hardness Tables & Dirtying
// ============================================================================
printHeader('TARGET 8: Block Breaking State Machine, Hardness Tables & Dirtying');

{
  // 8.1 Hardness Table Java Parity
  assertClose(HARDNESS.dirt.hand, 0.75, 1e-4, 'Dirt hand hardness');
  assertClose(HARDNESS.dirt.tool, 0.20, 1e-4, 'Dirt tool hardness');
  assertClose(HARDNESS.stone.hand, 7.50, 1e-4, 'Stone hand hardness');
  assertClose(HARDNESS.stone.tool, 0.60, 1e-4, 'Stone tool hardness');
  assertClose(HARDNESS.wood.hand, 3.00, 1e-4, 'Wood hand hardness');
  assertClose(HARDNESS.obsidian.hand, 50.0, 1e-4, 'Obsidian hand hardness');
  assertClose(HARDNESS.obsidian.tool, 9.40, 1e-4, 'Obsidian tool hardness');
  assert(HARDNESS.bedrock.hand === Infinity && HARDNESS.bedrock.tool === Infinity, 'Bedrock is infinite hardness');

  // 8.2 10-Stage Damage Formula
  assert(calcDamageStage(0.0, 1.0) === 0, '0% time is stage 0');
  assert(calcDamageStage(0.09, 1.0) === 0, '9% time is stage 0');
  assert(calcDamageStage(0.10, 1.0) === 1, '10% time is stage 1');
  assert(calcDamageStage(0.50, 1.0) === 5, '50% time is stage 5');
  assert(calcDamageStage(0.89, 1.0) === 8, '89% time is stage 8');
  assert(calcDamageStage(0.95, 1.0) === 9, '95% time is stage 9');
  assert(calcDamageStage(1.00, 1.0) === 9, '100% time clamps to stage 9');
  assert(calcDamageStage(1.50, 1.0) === 9, 'Over-completion clamps to stage 9');

  // 8.3 Tool Speedup and Item Drops
  assert(getDropItem(BLOCK.STONE, null) === 0, 'Stone drops nothing by hand');
  assert(getDropItem(BLOCK.STONE, { type: 'pickaxe' }) === BLOCK.COBBLESTONE, 'Stone drops cobblestone with pickaxe');
  assert(getDropItem(BLOCK.DIRT, null) === BLOCK.DIRT, 'Dirt drops dirt by hand');
  assert(getDropItem(BLOCK.OAK_LOG, null) === BLOCK.OAK_LOG, 'Wood drops oak log by hand');

  // 8.4 Continuous Mining State Machine with WorldManager
  const wm = new WorldManager();
  wm.setBlock(5, 64, 5, BLOCK.DIRT);

  const manager = new BlockBreakingManager(wm);

  // Initial state
  assert(manager.getDamageStage() === -1, 'Initial damage stage is -1 (inactive)');
  assert(!manager.isBroken(), 'Initially not broken');

  // Step 1: Mine for 0.3s (Dirt total hand time is 0.75s)
  const hitDirt = { hit: true, blockPos: { x: 5, y: 64, z: 5 }, blockId: BLOCK.DIRT };
  const res1 = manager.update(0.3, hitDirt);
  assert(res1.broken === false, 'Dirt not broken after 0.3s');
  assert(res1.stage === 3, `Damage stage after 0.3s should be 3 (got ${res1.stage})`);
  assert(manager.getDamageStage() === 3, 'Manager stage is 3');

  // Step 2: Target Change mid-mining resets accumulated progress
  const hitDifferent = { hit: true, blockPos: { x: 6, y: 64, z: 5 }, blockId: BLOCK.DIRT };
  const resReset = manager.update(0.1, hitDifferent);
  assert(resReset.broken === false, 'Different block not broken');
  assert(manager.accumulatedTime === 0.1, 'Accumulated time reset for new block');

  // Step 3: Complete mining of original dirt block
  manager.stopMining();
  manager.update(0.5, hitDirt);
  const resComplete = manager.update(0.3, hitDirt); // total 0.8s >= 0.75s
  assert(resComplete.broken === true, 'Dirt broken after 0.8s total');
  assert(resComplete.dropItem === BLOCK.DIRT, 'Dirt dropped item is DIRT');
  assert(wm.getBlock(5, 64, 5) === BLOCK.AIR, 'World block replaced with AIR');
  assert(manager.getDamageStage() === -1, 'Stage reset to -1 after block break');

  // 8.5 Bedrock Unbreakable Immunity
  wm.setBlock(0, 0, 0, BLOCK.BEDROCK);
  const hitBedrock = { hit: true, blockPos: { x: 0, y: 0, z: 0 }, blockId: BLOCK.BEDROCK };
  const resBedrock = manager.update(1000.0, hitBedrock); // 1000 seconds of mining
  assert(resBedrock.broken === false, 'Bedrock cannot be broken after 1000 seconds');
  assert(wm.getBlock(0, 0, 0) === BLOCK.BEDROCK, 'Bedrock remains intact in world');

  // 8.6 Cross-Boundary Chunk Invalidation
  // Place block on chunk boundary: x=15, z=15, y=15 (local section cy=0)
  wm.setBlock(15, 15, 15, BLOCK.STONE);
  markBlockAndNeighborsDirty(wm, 15, 15, 15);

  // Verify primary chunk section dirty
  const primaryChunk = wm.getChunk(0, 0);
  assert(primaryChunk && primaryChunk.sections[0].dirty === true, 'Primary section cy=0 must be marked dirty');

  // Verify East (+X, cx=1) chunk section dirty
  const eastChunk = wm.getChunk(1, 0);
  assert(eastChunk && eastChunk.sections[0].dirty === true, 'East border chunk cy=0 marked dirty');

  // Verify South (+Z, cz=1) chunk section dirty
  const southChunk = wm.getChunk(0, 1);
  assert(southChunk && southChunk.sections[0].dirty === true, 'South border chunk cy=0 marked dirty');

  // Verify South-East corner (+X, +Z) chunk section dirty
  const seCornerChunk = wm.getChunk(1, 1);
  assert(seCornerChunk && seCornerChunk.sections[0].dirty === true, 'South-East diagonal corner chunk cy=0 marked dirty');
}

// ============================================================================
// TARGET 9: High-Speed Corner, Sliding Walls & Diagonal Collisions
// ============================================================================
printHeader('TARGET 9: High-Speed Corner, Sliding Walls & Diagonal Collisions');

{
  const world = new ControlledPhysicsWorld();
  // Floor at Y=63
  for (let x = -5; x <= 10; x++) {
    for (let z = -5; z <= 10; z++) {
      world.setBlock(x, 63, z, BLOCK.STONE);
    }
  }

  // 90-degree internal corner: Wall at X=5, Wall at Z=5
  for (let y = 64; y <= 66; y++) {
    for (let z = 0; z <= 10; z++) world.setBlock(5, y, z, BLOCK.STONE);
    for (let x = 0; x <= 10; x++) world.setBlock(x, y, 5, BLOCK.STONE);
  }

  // 9.1 Player moving directly into internal corner (+X, +Z)
  const ctrlCorner = new FirstPersonController(world, { x: 3.0, y: 64.0, z: 3.0 });
  ctrlCorner.onGround = true;
  const resCorner = ctrlCorner.moveWithCollision(4.0, 0, 4.0);

  // Player width 0.6 (half-width 0.3). Wall at 5.0 -> stopped at 4.7
  assertClose(resCorner.pos.x, 4.7, 1e-4, 'Player halts at X=5.0 corner wall (pos.x=4.7)');
  assertClose(resCorner.pos.z, 4.7, 1e-4, 'Player halts at Z=5.0 corner wall (pos.z=4.7)');
  assert(resCorner.hitX === true && resCorner.hitZ === true, 'Both axes register collision in internal corner');

  // 9.2 Wall sliding: moving along wall at X=5 with velocity (vx=1.0, vz=2.0)
  // Player at (4.7, 64.0, 0.0), facing +Z along the wall
  const ctrlSlide = new FirstPersonController(world, { x: 4.7, y: 64.0, z: 0.0 });
  ctrlSlide.onGround = true;
  // Clear wall at Z=5 for unobstructed slide along X=5
  for (let y = 64; y <= 66; y++) {
    for (let x = 0; x < 5; x++) world.setBlock(x, y, 5, BLOCK.AIR);
  }

  const resSlide = ctrlSlide.moveWithCollision(0.5, 0, 2.0);
  assertClose(resSlide.pos.x, 4.7, 1e-4, 'X position remains clamped against wall (4.7)');
  assert(resSlide.hitX === true, 'X axis registers collision against wall');
  assertClose(resSlide.pos.z, 2.0, 1e-4, 'Z position slides unhindered along wall (2.0)');
  assert(resSlide.hitZ === false, 'Z axis unhindered along sliding wall');
}

// ============================================================================
// TARGET 10: Mouse Look Numerical Extremes & Camera Vector Rigor
// ============================================================================
printHeader('TARGET 10: Mouse Look Numerical Extremes & Camera Vector Rigor');

{
  const ctrlMouse = new FirstPersonController(null, { x: 0, y: 64, z: 0 });

  // 10.1 Massive upward mouse flick (deltaY = -1,000,000)
  ctrlMouse.handleMouseMove(0, -1000000);
  const maxPitch = (Math.PI / 2) - 0.001;
  assertClose(ctrlMouse.pitch, maxPitch, 1e-4, 'Upward look strictly clamped to +89.9 deg');

  // 10.2 Massive downward mouse flick (deltaY = +1,000,000)
  ctrlMouse.handleMouseMove(0, 2000000);
  assertClose(ctrlMouse.pitch, -maxPitch, 1e-4, 'Downward look strictly clamped to -89.9 deg');

  // 10.3 Massive yaw spin (deltaX = 10,000,000)
  ctrlMouse.handleMouseMove(10000000, 0);
  assert(ctrlMouse.yaw >= 0 && ctrlMouse.yaw < Math.PI * 2, 'Yaw remains strictly normalized in [0, 2*PI)');

  // 10.4 Camera Look Direction Unit Vector Rigor across 360 degree sphere
  for (let pitchDeg = -89; pitchDeg <= 89; pitchDeg += 30) {
    for (let yawDeg = 0; yawDeg < 360; yawDeg += 45) {
      ctrlMouse.pitch = (pitchDeg * Math.PI) / 180;
      ctrlMouse.yaw = (yawDeg * Math.PI) / 180;

      const look = ctrlMouse.getLookDirection();
      const mag = Math.hypot(look.x, look.y, look.z);
      assertClose(mag, 1.0, 1e-4, `Look direction vector must have unit magnitude at pitch=${pitchDeg}, yaw=${yawDeg}`);

      // Forward and Right vectors in XZ plane
      const fwd = ctrlMouse.getForwardXZ();
      const rgt = ctrlMouse.getRightXZ();
      assertClose(Math.hypot(fwd.x, fwd.z), 1.0, 1e-4, `Forward XZ must have unit magnitude at yaw=${yawDeg}`);
      assertClose(Math.hypot(rgt.x, rgt.z), 1.0, 1e-4, `Right XZ must have unit magnitude at yaw=${yawDeg}`);

      // Orthogonality: forward . right = 0
      const dot = fwd.x * rgt.x + fwd.z * rgt.z;
      assertClose(dot, 0.0, 1e-4, `Forward and Right vectors must be strictly orthogonal at yaw=${yawDeg}`);
    }
  }
}

// ============================================================================
// TARGET 11: Jump Impulse, Sprint Multipliers & Mid-Air Constraints
// ============================================================================
printHeader('TARGET 11: Jump Impulse, Sprint Multipliers & Mid-Air Constraints');

{
  const world = new ControlledPhysicsWorld();
  for (let x = -5; x <= 5; x++) {
    for (let z = -5; z <= 5; z++) world.setBlock(x, 63, z, BLOCK.STONE);
  }

  // 11.1 Grounded jump applies JUMP_IMPULSE (0.42)
  const ctrlJump = new FirstPersonController(world, { x: 0.5, y: 64.0, z: 0.5 });
  ctrlJump.onGround = true;
  ctrlJump.tickPhysics({ jump: true });
  assertClose(ctrlJump.vel.y, JUMP_IMPULSE, 1e-4, 'Grounded jump sets vel.y = 0.42 b/t');

  // 11.2 Mid-air jump spam has zero effect (cannot double-jump in survival)
  const ctrlAirJump = new FirstPersonController(world, { x: 0.5, y: 65.0, z: 0.5 });
  ctrlAirJump.onGround = false;
  ctrlAirJump.vel.y = -0.1;
  ctrlAirJump.tickPhysics({ jump: true });
  // Under gravity: -0.1 - 0.08 = -0.18, * 0.98 = -0.1764 (downward!)
  assert(ctrlAirJump.vel.y < -0.1, 'Mid-air jump does NOT apply impulse; player continues falling');

  // 11.3 Sprinting while sneaking mutually exclusive (sneak takes precedence)
  const ctrlSneakSprint = new FirstPersonController(world, { x: 0.5, y: 64.0, z: 0.5 });
  ctrlSneakSprint.tickPhysics({ forward: true, sprint: true, sneak: true });
  assert(ctrlSneakSprint.isSneaking === true, 'Sneak flag active');
  assert(ctrlSneakSprint.isSprinting === false, 'Sprint flag disabled when sneaking');

  // 11.4 Sprint jumping forward horizontal boost
  const ctrlNormalJump = new FirstPersonController(world, { x: 0.5, y: 64.0, z: 0.5 });
  ctrlNormalJump.yaw = 0; // facing +Z
  ctrlNormalJump.onGround = true;
  ctrlNormalJump.tickPhysics({ forward: true, jump: true, sprint: false });

  const ctrlSprintJump = new FirstPersonController(world, { x: 0.5, y: 64.0, z: 0.5 });
  ctrlSprintJump.yaw = 0; // facing +Z
  ctrlSprintJump.onGround = true;
  ctrlSprintJump.tickPhysics({ forward: true, jump: true, sprint: true });

  assert(ctrlSprintJump.vel.z > ctrlNormalJump.vel.z, 'Sprint jump provides superior forward horizontal momentum');
}

// ============================================================================
// TARGET 12: Narrow 1-Block Bridge Sneak Edge Clamping
// ============================================================================
printHeader('TARGET 12: Narrow 1-Block Bridge Sneak Edge Clamping');

{
  const world = new ControlledPhysicsWorld();

  // Narrow 1-block wide bridge: X from -10 to +10, Z=0 only!
  // Bounds of each bridge block: [X, 63..64, 0..1]. Void everywhere else!
  for (let x = -10; x <= 10; x++) {
    world.setBlock(x, 63, 0, BLOCK.STONE);
  }

  const ctrlBridge = new FirstPersonController(world, { x: 0.0, y: 64.0, z: 0.5 });
  ctrlBridge.yaw = -Math.PI / 2; // Facing +X along the bridge length

  // Walk forward while simultaneously strafing right towards void at +Z
  for (let t = 0; t < 50; t++) {
    ctrlBridge.tickPhysics({ forward: true, right: true, sneak: true });
  }

  assertClose(ctrlBridge.pos.y, 64.0, 1e-4, 'Player remains on bridge at Y=64.0 while diagonal sneaking');
  assert(ctrlBridge.onGround === true, 'Player maintains onGround on narrow bridge');
  assert(ctrlBridge.pos.x > 0.5, 'Player made forward progress along bridge length (+X)');

  // Player width 0.6. Bridge Z bounds are [0.0, 1.0].
  // MinZ cannot cross 1.0; player center cannot exceed 1.3
  assert(ctrlBridge.pos.z < 1.35, 'Player Z position is clamped to prevent falling off the bridge side');
}

// ============================================================================
// TARGET 13: Amanatides-Woo Negative Coordinate Grid Traversals
// ============================================================================
printHeader('TARGET 13: Amanatides-Woo Negative Coordinate Grid Traversals');

{
  const world = new ControlledPhysicsWorld();

  // Target block placed in deep negative coordinates: (-10, 64, -10)
  world.setBlock(-10, 64, -10, BLOCK.STONE);

  // 13.1 Raycast from -X in negative space towards (-10, 64, -10)
  const hitNegX = castRay(world, { x: -13.5, y: 64.5, z: -9.5 }, { x: 1, y: 0, z: 0 }, 5.0);
  assert(hitNegX.hit === true, 'Negative coordinate raycast +X hits target');
  assert(hitNegX.blockPos.x === -10 && hitNegX.blockPos.y === 64 && hitNegX.blockPos.z === -10, 'BlockPos match in negative coords');
  assert(hitNegX.normal.x === -1 && hitNegX.normal.y === 0 && hitNegX.normal.z === 0, 'Normal match on negative block');
  assert(hitNegX.placePos.x === -11 && hitNegX.placePos.y === 64 && hitNegX.placePos.z === -10, 'PlacePos match on negative block');

  // 13.2 Raycast from +Z in negative space towards (-10, 64, -10)
  const hitNegZ = castRay(world, { x: -9.5, y: 64.5, z: -6.5 }, { x: 0, y: 0, z: -1 }, 5.0);
  assert(hitNegZ.hit === true, 'Negative coordinate raycast -Z hits target');
  assert(hitNegZ.normal.z === 1, 'Outward normal facing ray in negative space');
  assert(hitNegZ.placePos.z === -9, 'PlacePos correctly advances in negative space');

  // 13.3 Raycast crossing the coordinate zero plane (X: -2.0 -> +1.5)
  world.clear();
  world.setBlock(1, 64, 0, BLOCK.STONE); // Block in positive X
  const hitCrossZero = castRay(world, { x: -2.0, y: 64.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, 5.0);
  assert(hitCrossZero.hit === true, 'Ray traversing across X=0 plane hits target block in positive space');
  assert(hitCrossZero.blockPos.x === 1, 'Hit block pos X is 1');
}

// ============================================================================
// TARGET 14: Interaction Hardness & Tool Multipliers Coverage
// ============================================================================
printHeader('TARGET 14: Interaction Hardness & Tool Multipliers Coverage');

{
  // Test authentic properties across all major blocks
  const cases = [
    { id: BLOCK.DIRT, expectedHand: 0.75, expectedTool: 0.20, expectedDrop: BLOCK.DIRT },
    { id: BLOCK.GRASS, expectedHand: 0.75, expectedTool: 0.20, expectedDrop: BLOCK.DIRT },
    { id: BLOCK.STONE, expectedHand: 7.50, expectedTool: 0.60, expectedDropHand: 0, expectedDropTool: BLOCK.COBBLESTONE },
    { id: BLOCK.COBBLESTONE, expectedHand: 7.50, expectedTool: 0.60, expectedDropHand: 0, expectedDropTool: BLOCK.COBBLESTONE },
    { id: BLOCK.OAK_LOG, expectedHand: 3.00, expectedTool: 0.75, expectedDrop: BLOCK.OAK_LOG },
    { id: BLOCK.OBSIDIAN, expectedHand: 50.0, expectedTool: 9.40, expectedDropHand: 0, expectedDropTool: BLOCK.OBSIDIAN },
    { id: BLOCK.NETHERRACK, expectedHand: 0.60, expectedTool: 0.15, expectedDrop: BLOCK.NETHERRACK },
    { id: BLOCK.SOUL_SAND, expectedHand: 0.75, expectedTool: 0.20, expectedDrop: BLOCK.SOUL_SAND },
    { id: BLOCK.GLOWSTONE, expectedHand: 0.45, expectedTool: 0.45, expectedDrop: BLOCK.GLOWSTONE },
    { id: BLOCK.END_STONE, expectedHand: 15.0, expectedTool: 0.60, expectedDropHand: 0, expectedDropTool: BLOCK.END_STONE }
  ];

  for (const c of cases) {
    const handTime = getBlockBreakTime(c.id, null);
    const toolTime = getBlockBreakTime(c.id, { type: 'tool' });
    assertClose(handTime, c.expectedHand, 1e-4, `Block ID ${c.id} hand break time`);
    assertClose(toolTime, c.expectedTool, 1e-4, `Block ID ${c.id} tool break time`);

    if (c.expectedDrop !== undefined) {
      assert(getDropItem(c.id, null) === c.expectedDrop, `Block ID ${c.id} drops item`);
    } else {
      assert(getDropItem(c.id, null) === c.expectedDropHand, `Block ID ${c.id} bare hand drop`);
      assert(getDropItem(c.id, { type: 'pickaxe' }) === c.expectedDropTool, `Block ID ${c.id} tool drop`);
    }
  }

  // Unbreakable blocks
  assert(getBlockBreakTime(BLOCK.BEDROCK) === Infinity, 'Bedrock break time is Infinity');
  assert(getBlockBreakTime(BLOCK.WATER) === Infinity, 'Water break time is Infinity');
  assert(getBlockBreakTime(BLOCK.LAVA) === Infinity, 'Lava break time is Infinity');
  assert(getBlockBreakTime(BLOCK.NETHER_PORTAL) === Infinity, 'Nether portal break time is Infinity');
  assert(getBlockBreakTime(BLOCK.END_PORTAL) === Infinity, 'End portal break time is Infinity');
}

// ============================================================================
// TARGET 15: Throughput & Performance Stress
// ============================================================================
printHeader('TARGET 15: Throughput & Performance Stress');

{
  const world = new ControlledPhysicsWorld();
  for (let x = -10; x <= 10; x++) {
    for (let z = -10; z <= 10; z++) world.setBlock(x, 63, z, BLOCK.STONE);
  }

  // 15.1 5,000 Physics Ticks Throughput Benchmark
  const ctrlPerf = new FirstPersonController(world, { x: 0.5, y: 64.0, z: 0.5 });
  const startPhysics = performance.now();
  for (let i = 0; i < 5000; i++) {
    ctrlPerf.tickPhysics({ forward: true, jump: i % 10 === 0 });
  }
  const physicsDuration = performance.now() - startPhysics;
  assert(physicsDuration < 200, `5,000 physics ticks completed in ${physicsDuration.toFixed(2)} ms (< 200ms)`);

  // 15.2 5,000 Amanatides-Woo Raycasts Throughput Benchmark
  world.setBlock(0, 64, 5, BLOCK.STONE);
  const startRay = performance.now();
  for (let i = 0; i < 5000; i++) {
    castRay(world, { x: 0.5, y: 64.5, z: 0.5 }, { x: 0, y: 0, z: 1 }, 5.0);
  }
  const rayDuration = performance.now() - startRay;
  assert(rayDuration < 200, `5,000 DDA raycasts completed in ${rayDuration.toFixed(2)} ms (< 200ms)`);
}

// ============================================================================
// STRESS TEST EXECUTION SUMMARY
// ============================================================================

console.log('\n======================================================================');
console.log('CHALLENGER 1 ADVERSARIAL STRESS TEST SUMMARY (MILESTONE 3)');
console.log('======================================================================');
console.log(`  Total Assertions:  ${totalAssertions}`);
console.log(`  Passed Assertions: ${passedAssertions}`);
console.log(`  Failed Assertions: ${failedAssertions}`);
console.log('======================================================================');

if (failedAssertions > 0) {
  console.log('\nFAILURES:');
  for (const f of failureDetails) {
    console.log(`  - ${f}`);
  }
  console.log('\nFINAL VERDICT: REJECT');
  process.exit(1);
} else {
  console.log('\nFINAL VERDICT: APPROVE (ALL EMPIRICAL M3 STRESS TESTS PASSED)');
  process.exit(0);
}
