/**
 * Multi-Dimension Procedural World Generator.
 * Implements Overworld (biomes, 3D caves, oceans, beaches, trees),
 * The Nether (enclosed caverns, dual bedrock, lava oceans at Y=31, fortress, glowstone),
 * and The End (void topology, floating End Stone island, obsidian pillars, exit fountain).
 * Zero external dependencies.
 */

import { FastNoise } from './noise.js';
import { BLOCK, CHUNK_WIDTH, CHUNK_HEIGHT, CHUNK_DEPTH, getBlockIndex } from './chunk.js';
import {
  generateOakTree,
  generateCherryTree,
  generateNetherFortress,
  generateEndPillars,
  generateExitFountain
} from './structures.js';

export const SEA_LEVEL = 62;
export const NETHER_LAVA_LEVEL = 31;

export const DIMENSION = {
  OVERWORLD: 0,
  NETHER: -1,
  THE_END: 1
};

/**
 * Biome selector based on continentalness and temperature.
 */
export function classifyBiome(continentalness, temperature) {
  if (continentalness > 0.35) return 'CHERRY_GROVE';
  if (temperature > 0.05) return 'PLAINS';
  return 'FOREST';
}

/**
 * Deterministic integer hash for coordinates and seed.
 */
function coordHash(x, y, z, seed) {
  let h = (seed ^ (x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ============================================================================
// 1. Overworld Generator
// ============================================================================

export function generateOverworldChunk(chunk, seed = 1337) {
  const elevNoise = new FastNoise(seed);
  const tempNoise = new FastNoise(seed + 101);
  const caveNoiseA = new FastNoise(seed + 202);
  const caveNoiseB = new FastNoise(seed + 303);
  const density3D = new FastNoise(seed + 404);

  const startX = chunk.cx * 16;
  const startZ = chunk.cz * 16;

  // Track candidate tree spawn locations: { x, y, z, biome }
  const treeCandidates = [];

  // Pass 1: Solid stone, bedrock, caves, and water
  for (let lz = 0; lz < 16; lz++) {
    const wz = startZ + lz;
    for (let lx = 0; lx < 16; lx++) {
      const wx = startX + lx;

      const cont = elevNoise.noise2D((wx + 500) * 0.0012, (wz + 500) * 0.0012);
      const temp = tempNoise.noise2D(wx * 0.0015, wz * 0.0015);
      const biome = classifyBiome(cont, temp);

      let hBase;
      if (biome === 'CHERRY_GROVE') {
        hBase = 84 + cont * 24 + elevNoise.fbm2D(wx * 0.006, wz * 0.006, 4) * 16;
      } else if (biome === 'PLAINS') {
        hBase = 65 + cont * 10 + elevNoise.fbm2D(wx * 0.005, wz * 0.005, 3) * 8;
      } else { // FOREST
        hBase = 68 + cont * 16 + elevNoise.fbm2D(wx * 0.006, wz * 0.006, 4) * 12;
      }
      hBase = Math.round(hBase);

      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        // Bedrock floor
        if (y === 0) {
          chunk.setBlock(lx, y, lz, BLOCK.BEDROCK);
          continue;
        }
        if (y >= 1 && y <= 4) {
          const r = coordHash(wx, y, wz, seed);
          if (r < (5 - y) / 5) {
            chunk.setBlock(lx, y, lz, BLOCK.BEDROCK);
            continue;
          }
        }

        // 3D Overhang density
        const d3 = density3D.noise3D(wx * 0.015, y * 0.025, wz * 0.015) * 1.5 - ((y - hBase) / 16.0);
        const isSolid = d3 > 0;

        if (isSolid) {
          // 3D Spaghetti cave carve-out
          const na = caveNoiseA.noise3D(wx * 0.022, y * 0.035, wz * 0.022);
          const nb = caveNoiseB.noise3D(wx * 0.022, y * 0.035, wz * 0.022);
          const isCave = (na * na + nb * nb) < 0.0045 && y >= 4 && y <= hBase - 4;

          if (isCave) {
            // Lava in deep cavern below Y=10
            if (y <= 10) {
              chunk.setBlock(lx, y, lz, BLOCK.LAVA);
            } else {
              chunk.setBlock(lx, y, lz, BLOCK.AIR);
            }
          } else {
            chunk.setBlock(lx, y, lz, BLOCK.STONE);
          }
        } else {
          // Water body at sea level
          if (y <= SEA_LEVEL) {
            chunk.setBlock(lx, y, lz, BLOCK.WATER);
          } else {
            chunk.setBlock(lx, y, lz, BLOCK.AIR);
          }
        }
      }
    }
  }

  // Pass 2: Surface stratigraphy (Grass, Dirt, Sand, Gravel) & Foliage candidates
  for (let lz = 0; lz < 16; lz++) {
    const wz = startZ + lz;
    for (let lx = 0; lx < 16; lx++) {
      const wx = startX + lx;
      const cont = elevNoise.noise2D((wx + 500) * 0.0012, (wz + 500) * 0.0012);
      const temp = tempNoise.noise2D(wx * 0.0015, wz * 0.0015);
      const biome = classifyBiome(cont, temp);

      let foundSurface = false;
      let depth = 0;

      for (let y = CHUNK_HEIGHT - 1; y >= 1; y--) {
        const blk = chunk.getBlock(lx, y, lz);

        if (blk === BLOCK.STONE) {
          if (!foundSurface) {
            foundSurface = true;
            depth = 1;

            if (y >= SEA_LEVEL) {
              // Above water: Beach or Grass
              if (y <= SEA_LEVEL + 2 && (chunk.getBlock(lx + 1, y, lz) === BLOCK.WATER ||
                                         chunk.getBlock(lx - 1, y, lz) === BLOCK.WATER ||
                                         chunk.getBlock(lx, y, lz + 1) === BLOCK.WATER ||
                                         chunk.getBlock(lx, y, lz - 1) === BLOCK.WATER)) {
                chunk.setBlock(lx, y, lz, BLOCK.SAND);
              } else {
                chunk.setBlock(lx, y, lz, BLOCK.GRASS);
                // Register foliage / tree candidate
                treeCandidates.push({ lx, y: y + 1, lz, wx, wz, biome });
              }
            } else {
              // Submerged seabed
              chunk.setBlock(lx, y, lz, BLOCK.GRAVEL);
            }
          } else {
            // Sub-surface layers
            if (depth <= 3) {
              const surf = chunk.getBlock(lx, y + depth, lz);
              if (surf === BLOCK.SAND) {
                chunk.setBlock(lx, y, lz, BLOCK.SAND);
              } else if (surf === BLOCK.GRAVEL) {
                chunk.setBlock(lx, y, lz, BLOCK.GRAVEL);
              } else {
                chunk.setBlock(lx, y, lz, BLOCK.DIRT);
              }
              depth++;
            }
          }
        } else if (blk === BLOCK.WATER || blk === BLOCK.AIR) {
          // If we encounter a cave below surface, reset surface search for lower ledges
          if (foundSurface && depth > 4) {
            foundSurface = false;
            depth = 0;
          }
        }
      }
    }
  }

  // Pass 3: Procedural trees & foliage decoration
  for (const c of treeCandidates) {
    const r = coordHash(c.wx, c.y, c.wz, seed);
    if (c.biome === 'CHERRY_GROVE') {
      if (r < 0.05 && c.lx >= 3 && c.lx <= 12 && c.lz >= 3 && c.lz <= 12) {
        generateCherryTree(chunk, c.lx, c.y, c.lz, () => coordHash(c.wx, c.y, c.wz, seed + 999));
      } else if (r < 0.20) {
        chunk.setBlock(c.lx, c.y, c.lz, BLOCK.PINK_PETALS);
      }
    } else if (c.biome === 'FOREST') {
      if (r < 0.08 && c.lx >= 2 && c.lx <= 13 && c.lz >= 2 && c.lz <= 13) {
        generateOakTree(chunk, c.lx, c.y, c.lz, () => coordHash(c.wx, c.y, c.wz, seed + 888));
      } else if (r < 0.25) {
        chunk.setBlock(c.lx, c.y, c.lz, BLOCK.TALL_GRASS);
      }
    } else { // PLAINS
      if (r < 0.008 && c.lx >= 2 && c.lx <= 13 && c.lz >= 2 && c.lz <= 13) {
        generateOakTree(chunk, c.lx, c.y, c.lz, () => coordHash(c.wx, c.y, c.wz, seed + 777));
      } else if (r < 0.12) {
        chunk.setBlock(c.lx, c.y, c.lz, BLOCK.TALL_GRASS);
      }
    }
  }

  chunk.syncFromBlocks();
  chunk.isGenerated = true;
  return chunk;
}

// ============================================================================
// 2. Nether Cavern Generator
// ============================================================================

export function generateNetherChunk(chunk, seed = 1337) {
  const netherNoise = new FastNoise(seed + 606);
  const soulNoise = new FastNoise(seed + 707);

  const startX = chunk.cx * 16;
  const startZ = chunk.cz * 16;

  for (let lz = 0; lz < 16; lz++) {
    const wz = startZ + lz;
    for (let lx = 0; lx < 16; lx++) {
      const wx = startX + lx;

      for (let y = 0; y <= 127; y++) {
        // Dual Bedrock ceiling (127) and floor (0)
        if (y === 0 || y === 127) {
          chunk.setBlock(lx, y, lz, BLOCK.BEDROCK);
          continue;
        }
        if (y >= 1 && y <= 4) {
          const r = coordHash(wx, y, wz, seed);
          if (r < (5 - y) / 5) {
            chunk.setBlock(lx, y, lz, BLOCK.BEDROCK);
            continue;
          }
        }
        if (y >= 123 && y <= 126) {
          const r = coordHash(wx, y, wz, seed + 55);
          if (r < (y - 122) / 5) {
            chunk.setBlock(lx, y, lz, BLOCK.BEDROCK);
            continue;
          }
        }

        // Nether Cavern density bias formula:
        // B_cap(y) = 2.5 * (|y - 64| / 64)^3 - 0.5
        const bCap = 2.5 * Math.pow(Math.abs(y - 64) / 64.0, 3) - 0.5;
        const density = netherNoise.noise3D(wx * 0.02, y * 0.035, wz * 0.02) * 2.0 + bCap;

        if (density > 0) {
          chunk.setBlock(lx, y, lz, BLOCK.NETHERRACK);
        } else {
          // Vast lava sea at Y <= 31
          if (y <= NETHER_LAVA_LEVEL) {
            chunk.setBlock(lx, y, lz, BLOCK.LAVA);
          } else {
            chunk.setBlock(lx, y, lz, BLOCK.AIR);
          }
        }
      }

      // Beyond Y=127 is void air in Nether
      for (let y = 128; y < CHUNK_HEIGHT; y++) {
        chunk.setBlock(lx, y, lz, BLOCK.AIR);
      }

      // Soul sand beaches near lava ocean
      for (let y = 1; y <= 31; y++) {
        if (chunk.getBlock(lx, y, lz) === BLOCK.NETHERRACK &&
            (chunk.getBlock(lx, y + 1, lz) === BLOCK.AIR || chunk.getBlock(lx, y + 1, lz) === BLOCK.LAVA)) {
          if (soulNoise.noise2D(wx * 0.05, wz * 0.05) > 0.25) {
            chunk.setBlock(lx, y, lz, BLOCK.SOUL_SAND);
          }
        }
      }
    }
  }

  // Hanging Glowstone clusters from ceiling anchors (Y=65..115)
  for (let lz = 2; lz < 14; lz += 4) {
    const wz = startZ + lz;
    for (let lx = 2; lx < 14; lx += 4) {
      const wx = startX + lx;
      for (let y = 115; y >= 65; y--) {
        if (chunk.getBlock(lx, y, lz) === BLOCK.NETHERRACK &&
            chunk.getBlock(lx, y - 1, lz) === BLOCK.AIR) {
          const r = coordHash(wx, y, wz, seed + 777);
          if (r < 0.25) {
            // Teardrop glowstone cluster
            for (let dy = 0; dy < 3; dy++) {
              chunk.setBlock(lx, y - 1 - dy, lz, BLOCK.GLOWSTONE);
              if (dy < 2) {
                chunk.setBlock(lx + 1, y - 1 - dy, lz, BLOCK.GLOWSTONE);
                chunk.setBlock(lx, y - 1 - dy, lz + 1, BLOCK.GLOWSTONE);
              }
            }
          }
          break;
        }
      }
    }
  }

  // Nether Fortress spawning in aligned chunk bands
  if (Math.abs(chunk.cx) % 6 === 0 && Math.abs(chunk.cz) % 6 === 0) {
    generateNetherFortress(chunk, chunk.cx, chunk.cz, () => coordHash(startX, 58, startZ, seed));
  }

  chunk.syncFromBlocks();
  chunk.isGenerated = true;
  return chunk;
}

// ============================================================================
// 3. The End Floating Island Generator
// ============================================================================

export function generateEndChunk(chunk, seed = 1337) {
  const endNoise = new FastNoise(seed + 909);

  const startX = chunk.cx * 16;
  const startZ = chunk.cz * 16;

  // Generate floating End Stone island using radial and vertical density formulas
  for (let lz = 0; lz < 16; lz++) {
    const wz = startZ + lz;
    for (let lx = 0; lx < 16; lx++) {
      const wx = startX + lx;
      const dist = Math.hypot(wx, wz);

      // Radial density: 1.0 - (dist / 95.0)^2
      const fRadial = 1.0 - Math.pow(dist / 95.0, 2);

      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        if (y < 20 || y > 90 || fRadial <= 0) {
          chunk.setBlock(lx, y, lz, BLOCK.AIR);
          continue;
        }

        // Vertical density: 1.0 - ((y - 58) / 18.0)^2
        const fVertical = 1.0 - Math.pow((y - 58) / 18.0, 2);
        if (fVertical <= 0) {
          chunk.setBlock(lx, y, lz, BLOCK.AIR);
          continue;
        }

        const density = fRadial * fVertical + endNoise.noise3D(wx * 0.04, y * 0.06, wz * 0.04) * 0.45;

        if (density > 0.12) {
          chunk.setBlock(lx, y, lz, BLOCK.END_STONE);
        } else {
          chunk.setBlock(lx, y, lz, BLOCK.AIR);
        }
      }
    }
  }

  // Central structures: Bedrock exit fountain and Obsidian Pillars
  if (chunk.cx === 0 && chunk.cz === 0) {
    generateExitFountain(chunk, 58);
  }

  // Check if any of the 10 obsidian pillars intersect this chunk
  const ringRadius = 42;
  for (let k = 0; k < 10; k++) {
    const theta = (2 * Math.PI * k) / 10;
    const px = Math.floor(ringRadius * Math.cos(theta));
    const pz = Math.floor(ringRadius * Math.sin(theta));
    const radius = 3 + (k % 3);
    const height = 76 + 3 * k;

    // Check if pillar cylinder overlaps chunk bounds [startX..startX+15, startZ..startZ+15]
    if (px + radius >= startX && px - radius <= startX + 15 &&
        pz + radius >= startZ && pz - radius <= startZ + 15) {
      for (let y = 45; y <= height; y++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const wz = pz + dz;
          if (wz < startZ || wz >= startZ + 16) continue;
          const lz = wz - startZ;
          for (let dx = -radius; dx <= radius; dx++) {
            const wx = px + dx;
            if (wx < startX || wx >= startX + 16) continue;
            const lx = wx - startX;
            if (dx * dx + dz * dz <= radius * radius) {
              chunk.setBlock(lx, y, lz, BLOCK.OBSIDIAN);
            }
          }
        }
      }

      // Bedrock apex and End Crystal / Fire
      if (px >= startX && px < startX + 16 && pz >= startZ && pz < startZ + 16) {
        chunk.setBlock(px - startX, height, pz - startZ, BLOCK.BEDROCK);
        chunk.setBlock(px - startX, height + 1, pz - startZ, BLOCK.FIRE);

        // Iron bar cage on pillars 3 and 7
        if (k === 3 || k === 7) {
          for (let cy = height + 1; cy <= height + 3; cy++) {
            for (let cdz = -1; cdz <= 1; cdz++) {
              const wz = pz + cdz;
              if (wz < startZ || wz >= startZ + 16) continue;
              const lz = wz - startZ;
              for (let cdx = -1; cdx <= 1; cdx++) {
                const wx = px + cdx;
                if (wx < startX || wx >= startX + 16) continue;
                const lx = wx - startX;
                if (cdx === 0 && cdz === 0 && cy === height + 1) continue;
                chunk.setBlock(lx, cy, lz, BLOCK.NETHER_BRICK_FENCE);
              }
            }
          }
        }
      }
    }
  }

  chunk.syncFromBlocks();
  chunk.isGenerated = true;
  return chunk;
}

// Master terrain generator dispatcher
export function generateTerrain(chunk, dimension, seed = 1337) {
  if (dimension === DIMENSION.NETHER) {
    return generateNetherChunk(chunk, seed);
  }
  if (dimension === DIMENSION.THE_END) {
    return generateEndChunk(chunk, seed);
  }
  return generateOverworldChunk(chunk, seed);
}

// CommonJS interoperability for test runner
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SEA_LEVEL,
    NETHER_LAVA_LEVEL,
    DIMENSION,
    classifyBiome,
    generateOverworldChunk,
    generateNetherChunk,
    generateEndChunk,
    generateTerrain
  };
}
