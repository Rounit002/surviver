/**
 * First-Person Kinematics, Camera & Traversal Controller.
 * Implements Pointer Lock mouse look, WASD kinematics, decoupled AABB collision,
 * 0.6-block step climbing, sneak edge-clamping, creative flight, and fluid dynamics.
 * Dual ESM and CommonJS exports. Zero external dependencies.
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
  clipAxisZ
} from './aabb.js';

import { BLOCK } from '../world/chunk.js';

const PITCH_LIMIT = (Math.PI / 2) - 0.001; // +/- 89.9 degrees

export class FirstPersonController {
  constructor(world = null, initialPos = { x: 0.5, y: 64.0, z: 0.5 }) {
    this.world = world;
    this.pos = {
      x: initialPos.x !== undefined ? initialPos.x : initialPos[0],
      y: initialPos.y !== undefined ? initialPos.y : initialPos[1],
      z: initialPos.z !== undefined ? initialPos.z : initialPos[2]
    };
    this.vel = { x: 0, y: 0, z: 0 };

    // Camera angles (radians)
    this.yaw = 0;
    this.pitch = 0;

    // State flags
    this.onGround = false;
    this.isSprinting = false;
    this.isSneaking = false;
    this.isFlying = false;
    this.isSwimming = false;
    this.inWater = false;
    this.inLava = false;
    this.headInWater = false;

    // Double-tap space flight toggle tracking
    this.lastSpacePressTime = 0;

    // Fixed-step accumulator for frame-rate independence (20 Hz)
    this.physicsAccumulator = 0;
    this.fixedDelta = 1 / 20; // 0.05s
  }

  get eyeHeight() {
    if (this.isSwimming) return PLAYER_DIMS.swimming.eyeHeight;
    if (this.isSneaking) return PLAYER_DIMS.sneaking.eyeHeight;
    return PLAYER_DIMS.standing.eyeHeight;
  }

  get eyePosition() {
    return {
      x: this.pos.x,
      y: this.pos.y + this.eyeHeight,
      z: this.pos.z
    };
  }

  get playerAABB() {
    return createPlayerAABB(this.pos, this.isSneaking, this.isSwimming);
  }

  getForwardXZ() {
    return { x: -Math.sin(this.yaw), z: Math.cos(this.yaw) };
  }

  getRightXZ() {
    return { x: Math.cos(this.yaw), z: Math.sin(this.yaw) };
  }

  getLookDirection() {
    const cp = Math.cos(this.pitch);
    return {
      x: -Math.sin(this.yaw) * cp,
      y: Math.sin(this.pitch),
      z: Math.cos(this.yaw) * cp
    };
  }

  handleMouseMove(deltaX, deltaY, sensitivity = 0.0022) {
    this.yaw -= deltaX * sensitivity;
    this.pitch -= deltaY * sensitivity;

    // Pitch clamping strictly confines vertical look to [-89.9 deg, +89.9 deg]
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));

    // Keep yaw normalized in [0, 2*PI)
    const twoPi = Math.PI * 2;
    this.yaw = (this.yaw % twoPi + twoPi) % twoPi;
  }

  handleSpacePress(now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    if (now - this.lastSpacePressTime <= 300) {
      this.isFlying = !this.isFlying;
      this.lastSpacePressTime = 0;
    } else {
      this.lastSpacePressTime = now;
    }
  }

  update(dt, input = {}) {
    // Accumulate dt with clamp to avoid spiral of death
    this.physicsAccumulator += Math.min(dt, 0.1);

    while (this.physicsAccumulator >= this.fixedDelta) {
      this.tickPhysics(input);
      this.physicsAccumulator -= this.fixedDelta;
    }
  }

  tickPhysics(input = {}) {
    this.isSneaking = Boolean(input.sneak) && !this.isFlying;
    this.isSprinting = Boolean(input.sprint) && !this.isSneaking;

    // 1. Fluid Detection
    this.checkFluids();

    // 2. Compute Input Acceleration
    let forward = 0;
    let strafe = 0;
    if (input.forward) forward += 1;
    if (input.backward) forward -= 1;
    if (input.left) strafe -= 1;
    if (input.right) strafe += 1;

    // Normalize diagonal input vector
    const inputMag = Math.hypot(strafe, forward);
    if (inputMag > 1.0) {
      strafe /= inputMag;
      forward /= inputMag;
    }

    // Determine movement speed
    let speed = 0.1;
    if (this.isFlying) {
      speed = this.isSprinting ? 0.8 : 0.4;
    } else if (this.isSprinting) {
      speed *= 1.3;
    } else if (this.isSneaking) {
      speed *= 0.3;
    }

    const f = this.getForwardXZ();
    const r = this.getRightXZ();
    const ax = (f.x * forward + r.x * strafe) * speed;
    const az = (f.z * forward + r.z * strafe) * speed;

    this.vel.x += ax;
    this.vel.z += az;

    // 3. Vertical Dynamics
    if (this.isFlying) {
      if (input.jump) {
        this.vel.y = this.isSprinting ? 0.8 : 0.4;
      } else if (input.sneak) {
        this.vel.y = -(this.isSprinting ? 0.8 : 0.4);
      } else {
        this.vel.y *= 0.7;
      }
    } else if (this.inWater) {
      this.vel.y -= 0.005; // weak gravity in water
      this.vel.y *= 0.8;   // water viscous drag
      if (input.jump) {
        this.vel.y = Math.min(this.vel.y + 0.04, 0.15); // swim upward
      } else if (input.sneak) {
        this.vel.y = Math.max(this.vel.y - 0.04, -0.15); // sink downward
      } else {
        // Water buoyancy lift
        this.vel.y = Math.min(this.vel.y + 0.04, 0.05);
      }
    } else if (this.inLava) {
      this.vel.y -= 0.02; // lava gravity
      this.vel.y *= 0.5;  // lava drag
      if (input.jump) {
        this.vel.y = Math.min(this.vel.y + 0.02, 0.08);
      }
    } else {
      // In air / ground: apply jump impulse
      if (input.jump && this.onGround) {
        this.vel.y = JUMP_IMPULSE;
        if (this.isSprinting) {
          this.vel.x += f.x * 0.2;
          this.vel.z += f.z * 0.2;
        }
      } else {
        // Gravity & terminal velocity
        this.vel.y -= GRAVITY;
        this.vel.y *= 0.98;
        if (this.vel.y < -TERMINAL_VELOCITY) {
          this.vel.y = -TERMINAL_VELOCITY;
        }
      }
    }

    // 4. Sneak Ledge-Edge Clamping
    let moveX = this.vel.x;
    let moveY = this.vel.y;
    let moveZ = this.vel.z;

    if (this.onGround && this.isSneaking) {
      const clamped = this.clampLedgeMovement(moveX, moveZ);
      moveX = clamped.x;
      moveZ = clamped.z;
    }

    // 5. Decoupled Axis Swept Collision & Step Climbing
    const moveRes = this.moveWithCollision(moveX, moveY, moveZ);
    this.pos.x = moveRes.pos.x;
    this.pos.y = moveRes.pos.y;
    this.pos.z = moveRes.pos.z;
    this.onGround = moveRes.onGround;

    // 6. Update velocities after collision
    if (moveRes.hitX && !moveRes.stepped) this.vel.x = 0;
    if (moveRes.hitY) this.vel.y = 0;
    if (moveRes.hitZ && !moveRes.stepped) this.vel.z = 0;

    // 7. Friction & Drag Deceleration
    if (this.isFlying) {
      this.vel.x *= 0.7;
      this.vel.z *= 0.7;
    } else if (this.inWater) {
      this.vel.x *= 0.8;
      this.vel.z *= 0.8;
    } else if (this.inLava) {
      this.vel.x *= 0.5;
      this.vel.z *= 0.5;
    } else {
      const friction = this.onGround ? (0.6 * 0.91) : 0.91;
      this.vel.x *= friction;
      this.vel.z *= friction;
    }

    // Clean up micro velocities
    if (Math.abs(this.vel.x) < 1e-4) this.vel.x = 0;
    if (Math.abs(this.vel.y) < 1e-4) this.vel.y = 0;
    if (Math.abs(this.vel.z) < 1e-4) this.vel.z = 0;
  }

  checkFluids() {
    if (!this.world || typeof this.world.getBlock !== 'function') {
      this.inWater = false;
      this.headInWater = false;
      this.inLava = false;
      this.isSwimming = false;
      return;
    }

    const bx = Math.floor(this.pos.x);
    const by = Math.floor(this.pos.y + 0.4);
    const bz = Math.floor(this.pos.z);
    const eyeBy = Math.floor(this.pos.y + this.eyeHeight);

    const bodyBlock = this.world.getBlock(bx, by, bz);
    const eyeBlock = this.world.getBlock(bx, eyeBy, bz);

    this.inWater = (bodyBlock === BLOCK.WATER);
    this.headInWater = (eyeBlock === BLOCK.WATER);
    this.inLava = (bodyBlock === BLOCK.LAVA);
    this.isSwimming = this.inWater && !this.onGround;
  }

  clampLedgeMovement(dx, dz) {
    if (!this.world || typeof this.world.getIntersectingBlockAABBs !== 'function') {
      return { x: dx, z: dz };
    }

    const pBox = createPlayerAABB(this.pos, this.isSneaking, this.isSwimming);

    // Iterative step-down for X
    while (dx !== 0) {
      const probeX = new AABB(
        pBox.minX + dx, pBox.minY - 0.5, pBox.minZ,
        pBox.maxX + dx, pBox.minY, pBox.maxZ
      );
      const collidersX = this.world.getIntersectingBlockAABBs(probeX);
      if (collidersX.length > 0) {
        break; // Supported ground exists
      }
      if (Math.abs(dx) <= 0.05) {
        dx = 0;
        break;
      }
      dx += (dx > 0 ? -0.05 : 0.05);
    }

    // Iterative step-down for Z
    while (dz !== 0) {
      const probeZ = new AABB(
        pBox.minX, pBox.minY - 0.5, pBox.minZ + dz,
        pBox.maxX, pBox.minY, pBox.maxZ + dz
      );
      const collidersZ = this.world.getIntersectingBlockAABBs(probeZ);
      if (collidersZ.length > 0) {
        break; // Supported ground exists
      }
      if (Math.abs(dz) <= 0.05) {
        dz = 0;
        break;
      }
      dz += (dz > 0 ? -0.05 : 0.05);
    }

    return { x: dx, z: dz };
  }

  moveWithCollision(dx, dy, dz) {
    const playerAABB = createPlayerAABB(this.pos, this.isSneaking, this.isSwimming);

    // Broadphase query over expanded path
    const broadphase = playerAABB.expand(dx, dy, dz);
    if (this.onGround) broadphase.maxY += STEP_HEIGHT;

    const colliders = (this.world && typeof this.world.getIntersectingBlockAABBs === 'function')
      ? this.world.getIntersectingBlockAABBs(broadphase)
      : [];

    // 1. Y Sweep
    let onGround = this.onGround;
    let actualDy = clipAxisY(playerAABB, colliders, dy);
    playerAABB.offsetSelf(0, actualDy, 0);
    if (dy < 0 && actualDy > dy) {
      onGround = true;
    } else if (dy > 0 || (dy < 0 && actualDy === dy)) {
      onGround = false;
    }

    // 2. Flat Horizontal Sweep (X then Z)
    let actualDx = clipAxisX(playerAABB, colliders, dx);
    playerAABB.offsetSelf(actualDx, 0, 0);

    let actualDz = clipAxisZ(playerAABB, colliders, dz);
    playerAABB.offsetSelf(0, 0, actualDz);

    const hitX = actualDx !== dx;
    const hitZ = actualDz !== dz;
    let stepped = false;

    // 3. Step Climbing (if on ground and horizontal obstacle encountered)
    if (onGround && (hitX || hitZ)) {
      // Revert horizontal moves on playerAABB
      playerAABB.offsetSelf(-actualDx, 0, -actualDz);

      // Attempt stepped path:
      const stepAABB = playerAABB.clone();
      const stepUp = clipAxisY(stepAABB, colliders, STEP_HEIGHT);

      if (stepUp >= 0.01) {
        stepAABB.offsetSelf(0, stepUp, 0);

        // Sweep original horizontal displacements on stepAABB
        const stepDx = clipAxisX(stepAABB, colliders, dx);
        stepAABB.offsetSelf(stepDx, 0, 0);

        const stepDz = clipAxisZ(stepAABB, colliders, dz);
        stepAABB.offsetSelf(0, 0, stepDz);

        // Step back down to obstacle surface
        const stepDown = clipAxisY(stepAABB, colliders, -stepUp);
        stepAABB.offsetSelf(0, stepDown, 0);

        const flatDistSq = actualDx * actualDx + actualDz * actualDz;
        const stepDistSq = stepDx * stepDx + stepDz * stepDz;

        if (stepDistSq > flatDistSq) {
          // Stepped path made superior forward progress: commit step!
          playerAABB.copy(stepAABB);
          actualDx = stepDx;
          actualDz = stepDz;
          actualDy += stepUp + stepDown;
          stepped = true;
        } else {
          playerAABB.offsetSelf(actualDx, 0, actualDz);
        }
      } else {
        playerAABB.offsetSelf(actualDx, 0, actualDz);
      }
    }

    return {
      pos: {
        x: (playerAABB.minX + playerAABB.maxX) / 2,
        y: playerAABB.minY,
        z: (playerAABB.minZ + playerAABB.maxZ) / 2
      },
      onGround: onGround || stepped,
      hitX,
      hitY: actualDy !== dy,
      hitZ,
      stepped
    };
  }
}

// CommonJS interoperability for Node testing environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FirstPersonController
  };
}
