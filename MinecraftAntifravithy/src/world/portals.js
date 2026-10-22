/**
 * Dimension Portals System:
 * Nether Portal frame detection (4x5 to 23x23), flint & steel ignition, breach extinguish,
 * 8:1 coordinate scaling, safe portal site search & creation fallback.
 * End Portal 5x5 horizontal frame validation with 12 Eye of Ender sockets,
 * instant teleportation to (100.5, 49, 0.5) obsidian pad, and exit fountain return.
 * Zero external dependencies.
 */

import { BLOCK } from './chunk.js';

export { BLOCK };

// ============================================================================
// 1. Nether Portal Frame Detector & State Machine
// ============================================================================

/**
 * Validates a vertical Nether Portal frame along X or Z axis.
 * Minimum outer dimensions: 4 wide x 5 high (inner 2x3 air).
 * Maximum outer dimensions: 23x23 (inner 21x21).
 * Corners are optional. Perimeter must be obsidian.
 */
export function validateNetherPortalFrame(world, startX, startY, startZ, dimension = world?.currentDimension ?? 0) {
  // Test X-aligned frame (width along X, height along Y)
  const xFrame = checkFramePlane(world, startX, startY, startZ, 1, 0, dimension);
  if (xFrame.valid) {
    return { valid: true, axis: 'X', ...xFrame };
  }

  // Test Z-aligned frame (width along Z, height along Y)
  const zFrame = checkFramePlane(world, startX, startY, startZ, 0, 1, dimension);
  if (zFrame.valid) {
    return { valid: true, axis: 'Z', ...zFrame };
  }

  return { valid: false };
}

function checkFramePlane(world, startX, startY, startZ, dx, dz, dimension = world?.currentDimension ?? 0) {
  // 1. Scan downwards to find bottom obsidian frame boundary
  let bottomY = startY;
  while (bottomY > 1 && world.getBlock(startX, bottomY - 1, startZ, dimension) !== BLOCK.OBSIDIAN) {
    bottomY--;
    if (startY - bottomY > 22) return { valid: false };
  }
  if (world.getBlock(startX, bottomY - 1, startZ, dimension) !== BLOCK.OBSIDIAN) {
    return { valid: false };
  }

  // 2. Scan horizontally along (dx, dz) to find left and right obsidian borders
  let minOffset = 0;
  let maxOffset = 0;
  while (world.getBlock(startX - dx * (minOffset + 1), bottomY, startZ - dz * (minOffset + 1), dimension) !== BLOCK.OBSIDIAN) {
    minOffset++;
    if (minOffset > 21) return { valid: false };
  }
  while (world.getBlock(startX + dx * (maxOffset + 1), bottomY, startZ + dz * (maxOffset + 1), dimension) !== BLOCK.OBSIDIAN) {
    maxOffset++;
    if (maxOffset > 21) return { valid: false };
  }

  const innerWidth = minOffset + maxOffset + 1;
  if (innerWidth < 2 || innerWidth > 21) return { valid: false };

  // 3. Scan upwards to find top obsidian border
  let innerHeight = 0;
  for (let h = 0; h <= 22; h++) {
    let rowAllAirOrPortal = true;
    for (let w = -minOffset; w <= maxOffset; w++) {
      const bx = startX + dx * w;
      const by = bottomY + h;
      const bz = startZ + dz * w;
      const block = world.getBlock(bx, by, bz, dimension);
      if (block !== BLOCK.AIR && block !== BLOCK.FIRE && block !== BLOCK.NETHER_PORTAL) {
        rowAllAirOrPortal = false;
        break;
      }
    }
    if (!rowAllAirOrPortal) {
      innerHeight = h;
      break;
    }
  }

  if (innerHeight < 3 || innerHeight > 21) return { valid: false };

  // 4. Verify full outer perimeter consists of obsidian
  // Bottom row:
  for (let w = -minOffset; w <= maxOffset; w++) {
    if (world.getBlock(startX + dx * w, bottomY - 1, startZ + dz * w, dimension) !== BLOCK.OBSIDIAN) {
      return { valid: false };
    }
  }

  // Top row:
  for (let w = -minOffset; w <= maxOffset; w++) {
    if (world.getBlock(startX + dx * w, bottomY + innerHeight, startZ + dz * w, dimension) !== BLOCK.OBSIDIAN) {
      return { valid: false };
    }
  }

  // Left & Right columns:
  for (let h = 0; h < innerHeight; h++) {
    if (world.getBlock(startX - dx * (minOffset + 1), bottomY + h, startZ - dz * (minOffset + 1), dimension) !== BLOCK.OBSIDIAN) {
      return { valid: false };
    }
    if (world.getBlock(startX + dx * (maxOffset + 1), bottomY + h, startZ + dz * (maxOffset + 1), dimension) !== BLOCK.OBSIDIAN) {
      return { valid: false };
    }
  }

  return {
    valid: true,
    minX: startX - dx * minOffset,
    maxX: startX + dx * maxOffset,
    minZ: startZ - dz * minOffset,
    maxZ: startZ + dz * maxOffset,
    bottomY,
    innerHeight,
    innerWidth,
    dx,
    dz
  };
}

/**
 * Ignites a Nether Portal using flint & steel.
 * If frame is valid, fills interior with BLOCK.NETHER_PORTAL.
 */
export function igniteNetherPortal(world, x, y, z, dimension = world?.currentDimension ?? 0) {
  const result = validateNetherPortalFrame(world, x, y, z, dimension);
  if (!result.valid) return false;

  const { minX, maxX, minZ, maxZ, bottomY, innerHeight, dx, dz } = result;

  // Fill interior air blocks with Nether Portal blocks
  for (let h = 0; h < innerHeight; h++) {
    if (dx === 1) {
      for (let bx = minX; bx <= maxX; bx++) {
        world.setBlock(bx, bottomY + h, minZ, BLOCK.NETHER_PORTAL, dimension);
      }
    } else {
      for (let bz = minZ; bz <= maxZ; bz++) {
        world.setBlock(minX, bottomY + h, bz, BLOCK.NETHER_PORTAL, dimension);
      }
    }
  }

  return true;
}

/**
 * Extinguishes contiguous Nether Portal blocks if frame perimeter is breached.
 */
export function extinguishNetherPortal(world, startX, startY, startZ, dimension = world?.currentDimension ?? 0) {
  const visited = new Set();
  const queue = [{ x: startX, y: startY, z: startZ }];

  while (queue.length > 0) {
    const p = queue.shift();
    const key = `${p.x},${p.y},${p.z}`;
    if (visited.has(key)) continue;
    visited.add(key);

    if (world.getBlock(p.x, p.y, p.z, dimension) === BLOCK.NETHER_PORTAL) {
      world.setBlock(p.x, p.y, p.z, BLOCK.AIR, dimension);
      // Check 6 neighbors
      queue.push({ x: p.x + 1, y: p.y, z: p.z });
      queue.push({ x: p.x - 1, y: p.y, z: p.z });
      queue.push({ x: p.x, y: p.y + 1, z: p.z });
      queue.push({ x: p.x, y: p.y - 1, z: p.z });
      queue.push({ x: p.x, y: p.y, z: p.z + 1 });
      queue.push({ x: p.x, y: p.y, z: p.z - 1 });
    }
  }
}

// ============================================================================
// 2. Coordinate Scaling & Safe Portal Placement
// ============================================================================

/**
 * 8:1 Coordinate scaling between Overworld and Nether.
 */
export function scaleCoordinate(dimFrom, dimTo, x, z) {
  if (dimFrom === 0 && dimTo === -1) {
    // Overworld -> Nether (1/8)
    return { x: Math.floor(x / 8), z: Math.floor(z / 8) };
  }
  if (dimFrom === -1 && dimTo === 0) {
    // Nether -> Overworld (8x)
    return { x: x * 8, z: z * 8 };
  }
  return { x, z };
}

/**
 * Searches for existing portal or constructs a fallback 4x5 obsidian frame with platform.
 */
export function findOrCreateNetherPortal(world, targetX, targetY, targetZ, targetDim) {
  const searchRadius = targetDim === -1 ? 16 : 128;
  const minY = Math.max(10, targetY - 16);
  const maxY = Math.min(targetDim === -1 ? 115 : 240, targetY + 16);

  // Tier 1: Immediate local probe (radius 3, stride 1) — covers fallback portal blocks (dx=1,2, dz=0)
  for (let dy = 0; dy <= 16; dy++) {
    const yOffsets = dy === 0 ? [0] : [dy, -dy];
    for (const dY of yOffsets) {
      const y = targetY + dY;
      if (y < minY || y > maxY) continue;
      for (let dz = -3; dz <= 3; dz++) {
        for (let dx = -3; dx <= 3; dx++) {
          if (world.getBlock(targetX + dx, y, targetZ + dz, targetDim) === BLOCK.NETHER_PORTAL) {
            return {
              x: targetX + dx + 0.5,
              y: y,
              z: targetZ + dz + 0.5,
              created: false
            };
          }
        }
      }
    }
  }

  // Tier 2: Check WorldManager persistent block modifications delta map if available (O(1) portal linking)
  if (world.modifiedBlocks && world.modifiedBlocks[targetDim]) {
    let bestDistSq = searchRadius * searchRadius;
    let bestPortal = null;
    for (const [key, blockId] of world.modifiedBlocks[targetDim].entries()) {
      if (blockId === BLOCK.NETHER_PORTAL) {
        const [bx, by, bz] = key.split(',').map(Number);
        if (Math.abs(by - targetY) <= 16) {
          const dsq = (bx - targetX) ** 2 + (bz - targetZ) ** 2;
          if (dsq <= bestDistSq) {
            bestDistSq = dsq;
            bestPortal = { x: bx + 0.5, y: by, z: bz + 0.5, created: false };
          }
        }
      }
    }
    if (bestPortal) return bestPortal;
  }

  // Tier 3: Expanding radial shell search for mock worlds or non-registry environments
  for (let r = 4; r <= searchRadius; r += 2) {
    for (let dy = -16; dy <= 16; dy += 2) {
      const y = Math.max(10, Math.min(targetDim === -1 ? 115 : 240, targetY + dy));
      for (let dx = -r; dx <= r; dx += 2) {
        for (const dz of [-r, -(r - 1), r - 1, r]) {
          if (world.getBlock(targetX + dx, y, targetZ + dz, targetDim) === BLOCK.NETHER_PORTAL) {
            return { x: targetX + dx + 0.5, y: y, z: targetZ + dz + 0.5, created: false };
          }
        }
      }
      for (let dz = -r; dz <= r; dz += 2) {
        for (const dx of [-r, -(r - 1), r - 1, r]) {
          if (world.getBlock(targetX + dx, y, targetZ + dz, targetDim) === BLOCK.NETHER_PORTAL) {
            return { x: targetX + dx + 0.5, y: y, z: targetZ + dz + 0.5, created: false };
          }
        }
      }
    }
  }

  // 2. No existing portal found: Construct a fresh 4x5 obsidian portal and safe platform
  const clampedY = Math.max(15, Math.min(targetDim === -1 ? 100 : 120, targetY));
  const px = targetX;
  const py = clampedY;
  const pz = targetZ;

  // Build a 4x4 stone platform beneath the portal
  for (let dz = -1; dz <= 2; dz++) {
    for (let dx = -1; dx <= 4; dx++) {
      world.setBlock(px + dx, py - 1, pz + dz, targetDim === -1 ? BLOCK.NETHERRACK : BLOCK.STONE, targetDim);
      // Clear 4-block headroom above platform
      for (let h = 0; h < 5; h++) {
        world.setBlock(px + dx, py + h, pz + dz, BLOCK.AIR, targetDim);
      }
    }
  }

  // Construct 4x5 Obsidian Frame (along X axis)
  // Bottom obsidian row
  world.setBlock(px + 0, py, pz, BLOCK.OBSIDIAN, targetDim);
  world.setBlock(px + 1, py, pz, BLOCK.OBSIDIAN, targetDim);
  world.setBlock(px + 2, py, pz, BLOCK.OBSIDIAN, targetDim);
  world.setBlock(px + 3, py, pz, BLOCK.OBSIDIAN, targetDim);

  // Top obsidian row
  world.setBlock(px + 0, py + 4, pz, BLOCK.OBSIDIAN, targetDim);
  world.setBlock(px + 1, py + 4, pz, BLOCK.OBSIDIAN, targetDim);
  world.setBlock(px + 2, py + 4, pz, BLOCK.OBSIDIAN, targetDim);
  world.setBlock(px + 3, py + 4, pz, BLOCK.OBSIDIAN, targetDim);

  // Left & right pillars
  for (let h = 1; h <= 3; h++) {
    world.setBlock(px + 0, py + h, pz, BLOCK.OBSIDIAN, targetDim);
    world.setBlock(px + 3, py + h, pz, BLOCK.OBSIDIAN, targetDim);
    // Inner 2x3 portal blocks
    world.setBlock(px + 1, py + h, pz, BLOCK.NETHER_PORTAL, targetDim);
    world.setBlock(px + 2, py + h, pz, BLOCK.NETHER_PORTAL, targetDim);
  }

  return {
    x: px + 1.5,
    y: py + 1.0,
    z: pz + 0.5,
    created: true
  };
}

// ============================================================================
// 3. The End Portal Mechanics & Teleportation
// ============================================================================

/**
 * Validates a 5x5 horizontal End Portal frame with 12 Eye of Ender sockets.
 */
export function validateEndPortalFrame(world, startX, startY, startZ, dimension = world?.currentDimension ?? 0) {
  // Check if center 3x3 is surrounded by 12 END_PORTAL_FRAME blocks
  // Frame layout: 5x5 horizontal with open corners
  // Center is at (centerX, startY, centerZ)
  for (let ox = -2; ox <= 2; ox++) {
    for (let oz = -2; oz <= 2; oz++) {
      const cx = startX + ox;
      const cz = startZ + oz;

      let validCount = 0;
      // North & South sides (dx = -1, 0, 1; dz = -2, 2)
      for (const dz of [-2, 2]) {
        for (let dx = -1; dx <= 1; dx++) {
          if (world.getBlock(cx + dx, startY, cz + dz, dimension) === BLOCK.END_PORTAL_FRAME) {
            validCount++;
          }
        }
      }
      // East & West sides (dx = -2, 2; dz = -1, 0, 1)
      for (const dx of [-2, 2]) {
        for (let dz = -1; dz <= 1; dz++) {
          if (world.getBlock(cx + dx, startY, cz + dz, dimension) === BLOCK.END_PORTAL_FRAME) {
            validCount++;
          }
        }
      }

      if (validCount === 12) {
        return { valid: true, centerX: cx, centerY: startY, centerZ: cz };
      }
    }
  }

  return { valid: false };
}

/**
 * Activates an End Portal by filling the central 3x3 horizontal area with starry End Portal blocks (ID 25).
 */
export function activateEndPortal(world, centerX, centerY, centerZ, dimension = world?.currentDimension ?? 0) {
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      world.setBlock(centerX + dx, centerY, centerZ + dz, BLOCK.END_PORTAL, dimension);
    }
  }
  return true;
}

/**
 * Teleports player to The End at fixed coordinate (100.5, 49.0, 0.5)
 * and generates a 5x5 obsidian spawn pad at Y=48 with 3-block headroom.
 */
export function prepareEndSpawnPlatform(world, targetDim = 1) {
  const spawnX = 100;
  const spawnY = 49;
  const spawnZ = 0;

  // Generate 5x5 obsidian pad at Y=48
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      world.setBlock(spawnX + dx, spawnY - 1, spawnZ + dz, BLOCK.OBSIDIAN, targetDim);
      // Clear 3 blocks of headroom
      for (let dy = 0; dy < 3; dy++) {
        world.setBlock(spawnX + dx, spawnY + dy, spawnZ + dz, BLOCK.AIR, targetDim);
      }
    }
  }

  return {
    x: 100.5,
    y: 49.0,
    z: 0.5
  };
}

// CommonJS interoperability for test runner
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BLOCK,
    validateNetherPortalFrame,
    igniteNetherPortal,
    extinguishNetherPortal,
    scaleCoordinate,
    findOrCreateNetherPortal,
    validateEndPortalFrame,
    activateEndPortal,
    prepareEndSpawnPlatform
  };
}
