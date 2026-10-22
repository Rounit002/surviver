/**
 * Amanatides-Woo 3D DDA Fast Voxel Raymarching & Block Placement Anti-Clipping.
 * Pure JavaScript, zero external dependencies.
 * Dual ESM and CommonJS exports.
 */

import { AABB } from './aabb.js';
import { BLOCK } from '../world/chunk.js';

// Cardinal face normals index-matched to chunk mesher faces:
// 0: +Y (Top), 1: -Y (Bottom), 2: +Z (South), 3: -Z (North), 4: +X (East), 5: -X (West)
export const FACE_NORMALS = [
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 }
];

export const REACH_DISTANCE = 5.0;

/**
 * Default predicate identifying solid, collidable/targetable blocks.
 * Transparent fluids (water, lava) and portals are ignored during block targeting.
 */
export function defaultSolidFilter(blockId) {
  return blockId > 0 &&
         blockId !== BLOCK.AIR &&
         blockId !== BLOCK.WATER &&
         blockId !== BLOCK.LAVA &&
         blockId !== BLOCK.NETHER_PORTAL &&
         blockId !== BLOCK.END_PORTAL;
}

/**
 * Executes Amanatides-Woo 3D DDA ray traversal through the voxel grid.
 * 
 * @param {object} world - Voxel world containing getBlock(x, y, z, dimension)
 * @param {object} eyePos - Camera world position { x, y, z }
 * @param {object} dir - Look direction vector { x, y, z }
 * @param {number} [maxDist=5.0] - Maximum ray traversal reach in blocks
 * @param {function} [isSolidFn=defaultSolidFilter] - Block solidity predicate
 * @returns {object} Raycast result:
 *   - hit: boolean
 *   - blockPos?: { x, y, z }
 *   - placePos?: { x, y, z }
 *   - normal?: { x, y, z }
 *   - distance?: number
 *   - blockId?: number
 *   - faceIndex?: number
 */
export function castRay(world, eyePos, dir, maxDist = REACH_DISTANCE, isSolidFn = defaultSolidFilter) {
  let dx = dir.x !== undefined ? dir.x : dir[0];
  let dy = dir.y !== undefined ? dir.y : dir[1];
  let dz = dir.z !== undefined ? dir.z : dir[2];

  // Zero-length direction check
  const lenSq = dx * dx + dy * dy + dz * dz;
  if (lenSq < 1e-12) {
    return { hit: false };
  }

  // Prevent division by zero while preserving direction sign
  if (Math.abs(dx) < 1e-9) dx = dx >= 0 ? 1e-9 : -1e-9;
  if (Math.abs(dy) < 1e-9) dy = dy >= 0 ? 1e-9 : -1e-9;
  if (Math.abs(dz) < 1e-9) dz = dz >= 0 ? 1e-9 : -1e-9;

  let x0 = eyePos.x !== undefined ? eyePos.x : eyePos[0];
  let y0 = eyePos.y !== undefined ? eyePos.y : eyePos[1];
  let z0 = eyePos.z !== undefined ? eyePos.z : eyePos[2];

  let X = Math.floor(x0);
  let Y = Math.floor(y0);
  let Z = Math.floor(z0);

  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  const stepZ = Math.sign(dz);

  const tDeltaX = Math.abs(1.0 / dx);
  const tDeltaY = Math.abs(1.0 / dy);
  const tDeltaZ = Math.abs(1.0 / dz);

  let tMaxX = stepX > 0 ? (X + 1 - x0) * tDeltaX : (x0 - X) * tDeltaX;
  let tMaxY = stepY > 0 ? (Y + 1 - y0) * tDeltaY : (y0 - Y) * tDeltaY;
  let tMaxZ = stepZ > 0 ? (Z + 1 - z0) * tDeltaZ : (z0 - Z) * tDeltaZ;

  let normal = { x: 0, y: 0, z: 0 };
  let faceIndex = -1;
  let currentT = 0;

  // Step guard prevents infinite loops on numerical anomalies
  const maxSteps = Math.ceil(maxDist * 3) + 16;
  let steps = 0;

  while (currentT <= maxDist && steps++ < maxSteps) {
    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        X += stepX;
        currentT = tMaxX;
        tMaxX += tDeltaX;
        normal = { x: -stepX, y: 0, z: 0 };
        faceIndex = stepX > 0 ? 5 : 4; // 5: -X (West), 4: +X (East)
      } else {
        Z += stepZ;
        currentT = tMaxZ;
        tMaxZ += tDeltaZ;
        normal = { x: 0, y: 0, z: -stepZ };
        faceIndex = stepZ > 0 ? 3 : 2; // 3: -Z (North), 2: +Z (South)
      }
    } else {
      if (tMaxY < tMaxZ) {
        Y += stepY;
        currentT = tMaxY;
        tMaxY += tDeltaY;
        normal = { x: 0, y: -stepY, z: 0 };
        faceIndex = stepY > 0 ? 1 : 0; // 1: -Y (Bottom), 0: +Y (Top)
      } else {
        Z += stepZ;
        currentT = tMaxZ;
        tMaxZ += tDeltaZ;
        normal = { x: 0, y: 0, z: -stepZ };
        faceIndex = stepZ > 0 ? 3 : 2; // 3: -Z (North), 2: +Z (South)
      }
    }

    if (currentT > maxDist) break;

    const blockId = (world && typeof world.getBlock === 'function')
      ? world.getBlock(X, Y, Z)
      : 0;

    if (isSolidFn(blockId)) {
      return {
        hit: true,
        blockPos: { x: X, y: Y, z: Z },
        placePos: { x: X + normal.x, y: Y + normal.y, z: Z + normal.z },
        normal,
        distance: currentT,
        blockId,
        faceIndex
      };
    }
  }

  return { hit: false };
}

/**
 * Validates whether a candidate block can be placed at the target coordinates.
 * Verifies altitude within [0, 255], space permeability, and player AABB exclusion.
 * Flexibly accepts either:
 *   canPlaceBlock(world, placePos, playerAABB, dimension)
 *   OR
 *   canPlaceBlock(placePos, playerAABB, world)
 */
export function canPlaceBlock(arg1, arg2, arg3, arg4) {
  let world = null;
  let placePos = null;
  let playerAABB = null;
  let dimension = undefined;

  if (arg1 && typeof arg1.getBlock === 'function') {
    world = arg1;
    placePos = arg2;
    playerAABB = arg3;
    dimension = arg4;
  } else {
    placePos = arg1;
    playerAABB = arg2;
    world = arg3 || null;
  }

  if (!placePos) return false;

  const bx = Math.floor(placePos.x !== undefined ? placePos.x : placePos[0]);
  const by = Math.floor(placePos.y !== undefined ? placePos.y : placePos[1]);
  const bz = Math.floor(placePos.z !== undefined ? placePos.z : placePos[2]);

  // Altitude bounds: [0, 255]
  if (by < 0 || by >= 256) {
    return false;
  }

  // Check if target block space is currently replaceable
  if (world && typeof world.getBlock === 'function') {
    const existing = world.getBlock(bx, by, bz, dimension);
    if (
      existing !== BLOCK.AIR &&
      existing !== BLOCK.WATER &&
      existing !== BLOCK.LAVA &&
      existing !== BLOCK.FIRE &&
      existing !== BLOCK.TALL_GRASS &&
      existing !== BLOCK.PINK_PETALS
    ) {
      return false;
    }
  }

  // Candidate block bounding box
  const bx0 = bx;
  const bx1 = bx + 1;
  const by0 = by;
  const by1 = by + 1;
  const bz0 = bz;
  const bz1 = bz + 1;

  // Check overlap with player bounding box
  if (playerAABB) {
    const pMinX = playerAABB.minX !== undefined ? playerAABB.minX : playerAABB[0];
    const pMinY = playerAABB.minY !== undefined ? playerAABB.minY : playerAABB[1];
    const pMinZ = playerAABB.minZ !== undefined ? playerAABB.minZ : playerAABB[2];
    const pMaxX = playerAABB.maxX !== undefined ? playerAABB.maxX : playerAABB[3];
    const pMaxY = playerAABB.maxY !== undefined ? playerAABB.maxY : playerAABB[4];
    const pMaxZ = playerAABB.maxZ !== undefined ? playerAABB.maxZ : playerAABB[5];

    const overlaps = (
      pMaxX > bx0 && pMinX < bx1 &&
      pMaxY > by0 && pMinY < by1 &&
      pMaxZ > bz0 && pMinZ < bz1
    );

    if (overlaps) {
      return false; // Intersects player AABB: anti-clipping rejected
    }
  }

  return true;
}

/**
 * Generates 24 vertices (12 lines) forming a wireframe cube outline.
 * Default epsilon expands slightly past 1.0 to prevent Z-fighting with block faces.
 * @param {number} [epsilon=0.002]
 * @returns {Float32Array} 72 floats (24 vec3 vertices)
 */
export function generateWireframeBoxVertices(epsilon = 0.002) {
  const min = -epsilon;
  const max = 1 + epsilon;

  return new Float32Array([
    // Bottom 4 edges
    min, min, min,  max, min, min,
    max, min, min,  max, min, max,
    max, min, max,  min, min, max,
    min, min, max,  min, min, min,

    // Top 4 edges
    min, max, min,  max, max, min,
    max, max, min,  max, max, max,
    max, max, max,  min, max, max,
    min, max, max,  min, max, min,

    // 4 vertical connecting edges
    min, min, min,  min, max, min,
    max, min, min,  max, max, min,
    max, min, max,  max, max, max,
    min, min, max,  min, max, max
  ]);
}

// CommonJS interoperability for Node testing environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FACE_NORMALS,
    REACH_DISTANCE,
    defaultSolidFilter,
    castRay,
    canPlaceBlock,
    generateWireframeBoxVertices
  };
}
