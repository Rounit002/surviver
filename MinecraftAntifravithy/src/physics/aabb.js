/**
 * Pure ES6 Axis-Aligned Bounding Box (AABB) & Decoupled Axis Swept Collision.
 * Minecraft Java Edition 1:1 Traversal Mechanics.
 * Dual ESM and CommonJS exports. Zero external dependencies.
 */

export const PLAYER_DIMS = {
  standing: { width: 0.6, height: 1.8, eyeHeight: 1.62 },
  sneaking: { width: 0.6, height: 1.5, eyeHeight: 1.27 },
  swimming: { width: 0.6, height: 0.6, eyeHeight: 0.40 }
};

export const GRAVITY = 0.08;
export const TERMINAL_VELOCITY = 3.92;
export const STEP_HEIGHT = 0.6;
export const JUMP_IMPULSE = 0.42;

/**
 * Axis-Aligned Bounding Box representation in 3D Euclidean space.
 */
export class AABB {
  constructor(minX = 0, minY = 0, minZ = 0, maxX = 0, maxY = 0, maxZ = 0) {
    this.minX = minX;
    this.minY = minY;
    this.minZ = minZ;
    this.maxX = maxX;
    this.maxY = maxY;
    this.maxZ = maxZ;
  }

  set(minX, minY, minZ, maxX, maxY, maxZ) {
    this.minX = minX;
    this.minY = minY;
    this.minZ = minZ;
    this.maxX = maxX;
    this.maxY = maxY;
    this.maxZ = maxZ;
    return this;
  }

  clone() {
    return new AABB(this.minX, this.minY, this.minZ, this.maxX, this.maxY, this.maxZ);
  }

  copy(other) {
    this.minX = other.minX;
    this.minY = other.minY;
    this.minZ = other.minZ;
    this.maxX = other.maxX;
    this.maxY = other.maxY;
    this.maxZ = other.maxZ;
    return this;
  }

  offset(dx, dy, dz) {
    return new AABB(
      this.minX + dx, this.minY + dy, this.minZ + dz,
      this.maxX + dx, this.maxY + dy, this.maxZ + dz
    );
  }

  offsetSelf(dx, dy, dz) {
    this.minX += dx;
    this.maxX += dx;
    this.minY += dy;
    this.maxY += dy;
    this.minZ += dz;
    this.maxZ += dz;
    return this;
  }

  expand(dx, dy, dz) {
    const minX = dx < 0 ? this.minX + dx : this.minX;
    const maxX = dx > 0 ? this.maxX + dx : this.maxX;
    const minY = dy < 0 ? this.minY + dy : this.minY;
    const maxY = dy > 0 ? this.maxY + dy : this.maxY;
    const minZ = dz < 0 ? this.minZ + dz : this.minZ;
    const maxZ = dz > 0 ? this.maxZ + dz : this.maxZ;
    return new AABB(minX, minY, minZ, maxX, maxY, maxZ);
  }

  intersects(other) {
    return (
      this.minX < other.maxX && this.maxX > other.minX &&
      this.minY < other.maxY && this.maxY > other.minY &&
      this.minZ < other.maxZ && this.maxZ > other.minZ
    );
  }

  intersectsAABB(other) {
    return this.intersects(other);
  }

  containsPoint(x, y, z) {
    return (
      x >= this.minX && x <= this.maxX &&
      y >= this.minY && y <= this.maxY &&
      z >= this.minZ && z <= this.maxZ
    );
  }
}

/**
 * Creates player AABB at given base foot position.
 * @param {object|Array} pos - { x, y, z } or [x, y, z]
 * @param {boolean} isSneaking
 * @param {boolean} isSwimming
 * @returns {AABB}
 */
export function createPlayerAABB(pos, isSneaking = false, isSwimming = false) {
  const dims = isSwimming
    ? PLAYER_DIMS.swimming
    : (isSneaking ? PLAYER_DIMS.sneaking : PLAYER_DIMS.standing);
  const hw = dims.width / 2;
  const x = pos.x !== undefined ? pos.x : pos[0];
  const y = pos.y !== undefined ? pos.y : pos[1];
  const z = pos.z !== undefined ? pos.z : pos[2];
  return new AABB(
    x - hw, y, z - hw,
    x + hw, y + dims.height, z + hw
  );
}

/**
 * Clips displacement along Y-axis against colliders.
 * Supports both an array of colliders or a single collider.
 */
export function clipAxisY(box, colliders, dy) {
  if (dy === 0) return 0;
  const list = Array.isArray(colliders) ? colliders : [colliders];
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (box.maxX > c.minX && box.minX < c.maxX && box.maxZ > c.minZ && box.minZ < c.maxZ) {
      if (dy > 0 && box.maxY <= c.minY && box.maxY + dy > c.minY) {
        dy = c.minY - box.maxY;
      } else if (dy < 0 && box.minY >= c.maxY && box.minY + dy < c.maxY) {
        dy = c.maxY - box.minY;
      }
    }
  }
  return dy;
}

/**
 * Clips displacement along X-axis against colliders.
 * Supports both an array of colliders or a single collider.
 */
export function clipAxisX(box, colliders, dx) {
  if (dx === 0) return 0;
  const list = Array.isArray(colliders) ? colliders : [colliders];
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (box.maxY > c.minY && box.minY < c.maxY && box.maxZ > c.minZ && box.minZ < c.maxZ) {
      if (dx > 0 && box.maxX <= c.minX && box.maxX + dx > c.minX) {
        dx = c.minX - box.maxX;
      } else if (dx < 0 && box.minX >= c.maxX && box.minX + dx < c.maxX) {
        dx = c.maxX - box.minX;
      }
    }
  }
  return dx;
}

/**
 * Clips displacement along Z-axis against colliders.
 * Supports both an array of colliders or a single collider.
 */
export function clipAxisZ(box, colliders, dz) {
  if (dz === 0) return 0;
  const list = Array.isArray(colliders) ? colliders : [colliders];
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (box.maxY > c.minY && box.minY < c.maxY && box.maxX > c.minX && box.minX < c.maxX) {
      if (dz > 0 && box.maxZ <= c.minZ && box.maxZ + dz > c.minZ) {
        dz = c.minZ - box.maxZ;
      } else if (dz < 0 && box.minZ >= c.maxZ && box.minZ + dz < c.maxZ) {
        dz = c.maxZ - box.minZ;
      }
    }
  }
  return dz;
}

/**
 * Decoupled axis collision resolution following Y -> X -> Z sweep.
 * Matches ReferenceOracle.physics.resolveAxisCollision contract.
 * @param {AABB} box
 * @param {object} velocity - { x, y, z }
 * @param {Array<object>} colliders - Array of AABBs / bounding boxes
 * @returns {object} { resolvedVelocity: { x, y, z }, hitX: boolean, hitY: boolean, hitZ: boolean }
 */
export function resolveAxisCollision(box, velocity, colliders) {
  const currentBox = box.clone();
  let dx = velocity.x !== undefined ? velocity.x : velocity[0];
  let dy = velocity.y !== undefined ? velocity.y : velocity[1];
  let dz = velocity.z !== undefined ? velocity.z : velocity[2];

  const origDx = dx;
  const origDy = dy;
  const origDz = dz;

  // 1. Y Axis Sweep
  dy = clipAxisY(currentBox, colliders, dy);
  currentBox.minY += dy;
  currentBox.maxY += dy;

  // 2. X Axis Sweep
  dx = clipAxisX(currentBox, colliders, dx);
  currentBox.minX += dx;
  currentBox.maxX += dx;

  // 3. Z Axis Sweep
  dz = clipAxisZ(currentBox, colliders, dz);
  currentBox.minZ += dz;
  currentBox.maxZ += dz;

  return {
    resolvedVelocity: { x: dx, y: dy, z: dz },
    hitX: dx !== origDx,
    hitY: dy !== origDy,
    hitZ: dz !== origDz
  };
}

// CommonJS interoperability for Node testing environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PLAYER_DIMS,
    GRAVITY,
    TERMINAL_VELOCITY,
    STEP_HEIGHT,
    JUMP_IMPULSE,
    AABB,
    createPlayerAABB,
    clipAxisY,
    clipAxisX,
    clipAxisZ,
    resolveAxisCollision
  };
}
