/**
 * Procedural Structure Generators.
 * Oak Trees, Branching Cherry Blossom Trees with Petal Scatter,
 * Modular Nether Fortress Architecture (bridges, parapets, deep support stilts, corridors),
 * and The End Obsidian Monolith Pillars and Bedrock Exit Fountain.
 * Zero external dependencies.
 */

import { BLOCK } from './chunk.js';

export { BLOCK };

// ============================================================================
// Procedural Foliage & Trees
// ============================================================================

/**
 * Procedural Oak Tree generator.
 * Straight trunk of Oak Logs (height 4-6) with rounded 5x5 leaf canopy.
 */
export function generateOakTree(world, wx, wy, wz, rand = Math.random) {
  const trunkHeight = 4 + Math.floor(rand() * 3); // 4 to 6 blocks

  // Check headroom
  for (let dy = 0; dy <= trunkHeight + 2; dy++) {
    const cur = world.getBlock(wx, wy + dy, wz);
    if (cur !== BLOCK.AIR && dy > 0) return false;
  }

  // Trunk
  for (let dy = 0; dy < trunkHeight; dy++) {
    world.setBlock(wx, wy + dy, wz, BLOCK.OAK_LOG);
  }

  // Canopy layers
  const leafBaseY = wy + trunkHeight - 2;

  // Layer 0 & 1: 5x5 square with rounded corners
  for (let ly = 0; ly < 2; ly++) {
    const y = leafBaseY + ly;
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        // Omit corner blocks with 70% chance (or definite outer corners)
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2) {
          if (rand() < 0.70) continue;
        }
        if (world.getBlock(wx + dx, y, wz + dz) === BLOCK.AIR) {
          world.setBlock(wx + dx, y, wz + dz, BLOCK.OAK_LEAVES);
        }
      }
    }
  }

  // Layer 2: 3x3 square
  const y2 = leafBaseY + 2;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (world.getBlock(wx + dx, y2, wz + dz) === BLOCK.AIR) {
        world.setBlock(wx + dx, y2, wz + dz, BLOCK.OAK_LEAVES);
      }
    }
  }

  // Layer 3: 3x3 cross (center + 4 cardinals)
  const y3 = leafBaseY + 3;
  const crossOffsets = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dz] of crossOffsets) {
    if (world.getBlock(wx + dx, y3, wz + dz) === BLOCK.AIR) {
      world.setBlock(wx + dx, y3, wz + dz, BLOCK.OAK_LEAVES);
    }
  }

  return true;
}

/**
 * Procedural Cherry Blossom Tree generator.
 * Curving/branching trunk of Cherry Logs with wide umbrella canopy and pink petals scatter.
 */
export function generateCherryTree(world, wx, wy, wz, rand = Math.random) {
  const totalHeight = 6 + Math.floor(rand() * 3); // 6 to 8 blocks

  // Check headroom
  for (let dy = 0; dy <= totalHeight + 2; dy++) {
    const cur = world.getBlock(wx, wy + dy, wz);
    if (cur !== BLOCK.AIR && dy > 0) return false;
  }

  // Branching trunk
  let curX = wx;
  let curZ = wz;
  const branchDirX = rand() > 0.5 ? 1 : -1;
  const branchDirZ = rand() > 0.5 ? 1 : -1;

  for (let dy = 0; dy < totalHeight; dy++) {
    world.setBlock(curX, wy + dy, curZ, BLOCK.CHERRY_LOG);
    if (dy === 2 || dy === 3) {
      curX += (rand() > 0.4 ? branchDirX : 0);
      curZ += (rand() > 0.4 ? branchDirZ : 0);
      world.setBlock(curX, wy + dy, curZ, BLOCK.CHERRY_LOG);
    }
  }

  // Umbrella Canopy centered around branch apex
  const topY = wy + totalHeight;
  const centerX = curX;
  const centerZ = curZ;

  // Layer 0 (topY - 2): disk radius squared <= 12 (approx 7x7)
  for (let dz = -3; dz <= 3; dz++) {
    for (let dx = -3; dx <= 3; dx++) {
      if (dx * dx + dz * dz <= 12) {
        if (world.getBlock(centerX + dx, topY - 2, centerZ + dz) === BLOCK.AIR) {
          world.setBlock(centerX + dx, topY - 2, centerZ + dz, BLOCK.CHERRY_LEAVES);
        }
      }
    }
  }

  // Layer 1 (topY - 1): disk radius squared <= 9
  for (let dz = -3; dz <= 3; dz++) {
    for (let dx = -3; dx <= 3; dx++) {
      if (dx * dx + dz * dz <= 9) {
        if (world.getBlock(centerX + dx, topY - 1, centerZ + dz) === BLOCK.AIR) {
          world.setBlock(centerX + dx, topY - 1, centerZ + dz, BLOCK.CHERRY_LEAVES);
        }
      }
    }
  }

  // Layer 2 (topY): disk radius squared <= 4
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + dz * dz <= 4) {
        if (world.getBlock(centerX + dx, topY, centerZ + dz) === BLOCK.AIR) {
          world.setBlock(centerX + dx, topY, centerZ + dz, BLOCK.CHERRY_LEAVES);
        }
      }
    }
  }

  // Layer 3 (topY + 1): top crown cross of 5 blocks
  const crossOffsets = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dz] of crossOffsets) {
    if (world.getBlock(centerX + dx, topY + 1, centerZ + dz) === BLOCK.AIR) {
      world.setBlock(centerX + dx, topY + 1, centerZ + dz, BLOCK.CHERRY_LEAVES);
    }
  }

  // Scatter pink petals carpet on grass within radius 4
  for (let dz = -4; dz <= 4; dz++) {
    for (let dx = -4; dx <= 4; dx++) {
      if (dx * dx + dz * dz > 16) continue;
      const px = wx + dx;
      const pz = wz + dz;
      // Scan downwards around ground level to find surface grass
      for (let py = wy + 1; py >= wy - 2; py--) {
        const blk = world.getBlock(px, py, pz);
        const above = world.getBlock(px, py + 1, pz);
        if ((blk === BLOCK.GRASS || blk === BLOCK.GRASS_BLOCK) && above === BLOCK.AIR) {
          if (rand() < 0.35) {
            world.setBlock(px, py + 1, pz, BLOCK.PINK_PETALS);
          }
          break;
        }
      }
    }
  }

  return true;
}

// ============================================================================
// Nether Fortress Generator
// ============================================================================

/**
 * Modular Nether Fortress generator.
 * Elevated bridges (5-wide with parapets), deep vertical support stilts, covered corridors.
 */
export function generateNetherFortress(world, chunkX, chunkZ, rand = Math.random) {
  const bridgeY = 58; // Elevated bridge level between Y=52..64
  const startX = chunkX * 16;
  const startZ = chunkZ * 16;

  // Decide fortress component: 0=East-West Bridge, 1=North-South Bridge, 2=Intersection
  const compType = Math.abs((chunkX * 31 + chunkZ * 17)) % 3;

  if (compType === 0) {
    // East-West 5-wide open bridge across entire chunk
    const zCenter = startZ + 8;
    for (let x = startX; x < startX + 16; x++) {
      // 3-wide walkway
      for (let dz = -1; dz <= 1; dz++) {
        world.setBlock(x, bridgeY, zCenter + dz, BLOCK.NETHER_BRICK);
        world.setBlock(x, bridgeY + 1, zCenter + dz, BLOCK.AIR);
        world.setBlock(x, bridgeY + 2, zCenter + dz, BLOCK.AIR);
        world.setBlock(x, bridgeY + 3, zCenter + dz, BLOCK.AIR);
      }
      // Parapet fences
      world.setBlock(x, bridgeY + 1, zCenter - 2, BLOCK.NETHER_BRICK_FENCE);
      world.setBlock(x, bridgeY,     zCenter - 2, BLOCK.NETHER_BRICK);
      world.setBlock(x, bridgeY + 1, zCenter + 2, BLOCK.NETHER_BRICK_FENCE);
      world.setBlock(x, bridgeY,     zCenter + 2, BLOCK.NETHER_BRICK);
    }

    // Support Stilts at every 8th block (x=startX+4, startX+12)
    for (const sx of [startX + 4, startX + 12]) {
      for (let dz = -1; dz <= 1; dz++) {
        // Trace stilt downward to terrain or lava floor
        for (let y = bridgeY - 1; y >= 20; y--) {
          const cur = world.getBlock(sx, y, zCenter + dz);
          if (cur === BLOCK.NETHERRACK || cur === BLOCK.BEDROCK) break;
          world.setBlock(sx, y, zCenter + dz, BLOCK.NETHER_BRICK);
        }
      }
    }
  } else if (compType === 1) {
    // North-South 5-wide open bridge
    const xCenter = startX + 8;
    for (let z = startZ; z < startZ + 16; z++) {
      for (let dx = -1; dx <= 1; dx++) {
        world.setBlock(xCenter + dx, bridgeY, z, BLOCK.NETHER_BRICK);
        world.setBlock(xCenter + dx, bridgeY + 1, z, BLOCK.AIR);
        world.setBlock(xCenter + dx, bridgeY + 2, z, BLOCK.AIR);
        world.setBlock(xCenter + dx, bridgeY + 3, z, BLOCK.AIR);
      }
      world.setBlock(xCenter - 2, bridgeY + 1, z, BLOCK.NETHER_BRICK_FENCE);
      world.setBlock(xCenter - 2, bridgeY,     z, BLOCK.NETHER_BRICK);
      world.setBlock(xCenter + 2, bridgeY + 1, z, BLOCK.NETHER_BRICK_FENCE);
      world.setBlock(xCenter + 2, bridgeY,     z, BLOCK.NETHER_BRICK);
    }

    for (const sz of [startZ + 4, startZ + 12]) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let y = bridgeY - 1; y >= 20; y--) {
          const cur = world.getBlock(xCenter + dx, y, sz);
          if (cur === BLOCK.NETHERRACK || cur === BLOCK.BEDROCK) break;
          world.setBlock(xCenter + dx, y, sz, BLOCK.NETHER_BRICK);
        }
      }
    }
  } else {
    // 4-Way Crossing & Covered Corridor (7x7 room)
    const cx = startX + 8;
    const cz = startZ + 8;

    for (let dz = -3; dz <= 3; dz++) {
      for (let dx = -3; dx <= 3; dx++) {
        const x = cx + dx;
        const z = cz + dz;
        // Floor
        world.setBlock(x, bridgeY, z, BLOCK.NETHER_BRICK);
        // Roof
        world.setBlock(x, bridgeY + 4, z, BLOCK.NETHER_BRICK);

        // Hollow interior
        for (let y = bridgeY + 1; y <= bridgeY + 3; y++) {
          if (Math.abs(dx) === 3 || Math.abs(dz) === 3) {
            // Doorway openings at cardinal centers
            if ((Math.abs(dx) === 3 && Math.abs(dz) <= 1) || (Math.abs(dz) === 3 && Math.abs(dx) <= 1)) {
              world.setBlock(x, y, z, BLOCK.AIR);
            } else {
              world.setBlock(x, y, z, BLOCK.NETHER_BRICK);
            }
          } else {
            world.setBlock(x, y, z, BLOCK.AIR);
          }
        }
      }
    }

    // Heavy central 3x3 support stilt beneath intersection
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let y = bridgeY - 1; y >= 20; y--) {
          const cur = world.getBlock(cx + dx, y, cz + dz);
          if (cur === BLOCK.NETHERRACK || cur === BLOCK.BEDROCK) break;
          world.setBlock(cx + dx, y, cz + dz, BLOCK.NETHER_BRICK);
        }
      }
    }
  }
}

// ============================================================================
// The End Monolith Pillars & Exit Bedrock Fountain
// ============================================================================

/**
 * Exactly 10 obsidian monolith pillars in circular ring of radius 42.
 */
export function generateEndPillars(world) {
  const pillarCount = 10;
  const ringRadius = 42;

  for (let k = 0; k < pillarCount; k++) {
    const theta = (2 * Math.PI * k) / pillarCount;
    const px = Math.floor(ringRadius * Math.cos(theta));
    const pz = Math.floor(ringRadius * Math.sin(theta));
    const radius = 3 + (k % 3); // 3, 4, or 5 blocks radius
    const height = 76 + 3 * k;   // 76 up to 103

    // Build solid obsidian cylinder from base Y=45 up to height
    for (let y = 45; y <= height; y++) {
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dz * dz <= radius * radius) {
            world.setBlock(px + dx, y, pz + dz, BLOCK.OBSIDIAN);
          }
        }
      }
    }

    // Single Bedrock block in center of pillar top
    world.setBlock(px, height, pz, BLOCK.BEDROCK);

    // End Crystal / Fire atop bedrock
    world.setBlock(px, height + 1, pz, BLOCK.FIRE);

    // 2 of 10 pillars have an Iron Bar cage (k=3 and k=7)
    if (k === 3 || k === 7) {
      for (let cy = height + 1; cy <= height + 3; cy++) {
        for (let cdz = -1; cdz <= 1; cdz++) {
          for (let cdx = -1; cdx <= 1; cdx++) {
            if (cdx === 0 && cdz === 0 && cy === height + 1) continue;
            // Shielding cage (using nether brick fence / iron bars)
            world.setBlock(px + cdx, cy, pz + cdz, BLOCK.NETHER_BRICK_FENCE);
          }
        }
      }
    }
  }
}

/**
 * Central Bedrock Exit Fountain bowl at world origin (0, surfaceY, 0).
 */
export function generateExitFountain(world, surfaceY = 60) {
  // 3-block radius circular bedrock bowl with 1-block raised rim
  for (let dz = -3; dz <= 3; dz++) {
    for (let dx = -3; dx <= 3; dx++) {
      const distSq = dx * dx + dz * dz;
      if (distSq <= 9) {
        // Floor
        world.setBlock(dx, surfaceY, dz, BLOCK.BEDROCK);
        if (distSq >= 6) {
          // Elevated rim
          world.setBlock(dx, surfaceY + 1, dz, BLOCK.BEDROCK);
        } else {
          // Inner bowl
          world.setBlock(dx, surfaceY + 1, dz, BLOCK.AIR);
        }
      }
    }
  }

  // 4-block high central bedrock pillar
  for (let dy = 1; dy <= 4; dy++) {
    world.setBlock(0, surfaceY + dy, 0, BLOCK.BEDROCK);
  }

  // Torches on 4 sides of central pillar
  world.setBlock(1, surfaceY + 3, 0, BLOCK.TORCH || BLOCK.FIRE);
  world.setBlock(-1, surfaceY + 3, 0, BLOCK.TORCH || BLOCK.FIRE);
  world.setBlock(0, surfaceY + 3, 1, BLOCK.TORCH || BLOCK.FIRE);
  world.setBlock(0, surfaceY + 3, -1, BLOCK.TORCH || BLOCK.FIRE);
}

// CommonJS interoperability for test runner
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BLOCK,
    generateOakTree,
    generateCherryTree,
    generateNetherFortress,
    generateEndPillars,
    generateExitFountain
  };
}
