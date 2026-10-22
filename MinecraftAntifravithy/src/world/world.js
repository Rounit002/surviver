/**
 * Multi-Dimension World Manager, Chunk Column Caching,
 * Persistent Block Modifications across Dimension Visits,
 * and Seamless Dimension Switching.
 * Zero external dependencies.
 */

import {
  CHUNK_WIDTH,
  CHUNK_HEIGHT,
  CHUNK_DEPTH,
  CHUNK_SIZE,
  BLOCK,
  getBlockIndex,
  ChunkSection,
  ChunkColumn
} from './chunk.js';

import {
  FastNoise
} from './noise.js';

import {
  SEA_LEVEL,
  NETHER_LAVA_LEVEL,
  DIMENSION,
  classifyBiome,
  generateTerrain
} from './generator.js';

import {
  scaleCoordinate,
  findOrCreateNetherPortal,
  prepareEndSpawnPlatform,
  validateNetherPortalFrame,
  igniteNetherPortal,
  extinguishNetherPortal,
  validateEndPortalFrame,
  activateEndPortal
} from './portals.js';

export const Dimension = DIMENSION;
export {
  CHUNK_WIDTH,
  CHUNK_HEIGHT,
  CHUNK_DEPTH,
  CHUNK_SIZE,
  BLOCK,
  getBlockIndex,
  ChunkSection,
  ChunkColumn,
  SEA_LEVEL,
  NETHER_LAVA_LEVEL,
  DIMENSION,
  classifyBiome,
  scaleCoordinate
};

/**
 * Master Multi-Dimension World Manager.
 */
export class WorldManager {
  constructor(seed = 1337) {
    this.seed = seed;
    this.currentDimension = DIMENSION.OVERWORLD;

    // Per-dimension chunk caching: Map<"cx,cz", ChunkColumn>
    this.dimensionCaches = {
      [DIMENSION.OVERWORLD]: new Map(),
      [DIMENSION.NETHER]: new Map(),
      [DIMENSION.THE_END]: new Map()
    };

    // Persistent block modification delta maps: Map<"wx,wy,wz", blockId>
    this.modifiedBlocks = {
      [DIMENSION.OVERWORLD]: new Map(),
      [DIMENSION.NETHER]: new Map(),
      [DIMENSION.THE_END]: new Map()
    };

    // Dimension visual environment presets
    this.dimensionEnvironments = {
      [DIMENSION.OVERWORLD]: {
        skyColor: [0.529, 0.706, 0.941],
        fogColor: [0.700, 0.820, 0.980],
        fogStart: 60.0,
        fogEnd: 160.0,
        sunlight: 1.0,
        ambient: 0.15
      },
      [DIMENSION.NETHER]: {
        skyColor: [0.200, 0.030, 0.030],
        fogColor: [0.350, 0.050, 0.050],
        fogStart: 10.0,
        fogEnd: 64.0,
        sunlight: 0.1,
        ambient: 0.25
      },
      [DIMENSION.THE_END]: {
        skyColor: [0.043, 0.016, 0.063],
        fogColor: [0.080, 0.030, 0.110],
        fogStart: 30.0,
        fogEnd: 120.0,
        sunlight: 0.0,
        ambient: 0.18
      }
    };

    this.atlas = null;
    this.SEA_LEVEL = SEA_LEVEL;
    this.NETHER_LAVA_LEVEL = NETHER_LAVA_LEVEL;
    this.DIMENSION = DIMENSION;
    this.BLOCK = BLOCK;
  }

  getActiveDimension() {
    return this.currentDimension;
  }

  setDimension(dim) {
    if (this.dimensionCaches[dim] !== undefined) {
      this.currentDimension = dim;
    }
  }

  getEnvironment(dim = this.currentDimension) {
    return this.dimensionEnvironments[dim] || this.dimensionEnvironments[DIMENSION.OVERWORLD];
  }

  /**
   * Retrieves or procedurally generates a ChunkColumn for the specified dimension.
   */
  getChunk(cx, cz, dimension = this.currentDimension) {
    const key = `${cx},${cz}`;
    const cache = this.dimensionCaches[dimension];
    if (cache.has(key)) {
      return cache.get(key);
    }

    // Procedurally generate new chunk column
    const chunk = new ChunkColumn(cx, cz);
    generateTerrain(chunk, dimension, this.seed);

    // Apply persistent block modifications recorded for this chunk
    const mods = this.modifiedBlocks[dimension];
    const startX = cx * 16;
    const startZ = cz * 16;
    for (let lz = 0; lz < 16; lz++) {
      const wz = startZ + lz;
      for (let lx = 0; lx < 16; lx++) {
        const wx = startX + lx;
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const modKey = `${wx},${y},${wz}`;
          if (mods.has(modKey)) {
            chunk.setBlock(lx, y, lz, mods.get(modKey));
          }
        }
      }
    }

    cache.set(key, chunk);
    return chunk;
  }

  /**
   * Returns block ID at world coordinate (x, y, z) in given dimension.
   * Returns 0 (AIR) for out-of-bounds altitudes.
   */
  getBlock(x, y, z, dimension = this.currentDimension) {
    if (y < 0 || y >= CHUNK_HEIGHT) return BLOCK.AIR;

    // Check persistent delta map first
    const modKey = `${x},${y},${z}`;
    const mods = this.modifiedBlocks[dimension];
    if (mods && mods.has(modKey)) {
      return mods.get(modKey);
    }

    const cx = Math.floor(x / 16);
    const cz = Math.floor(z / 16);
    const chunk = this.getChunk(cx, cz, dimension);
    return chunk.getBlock(x & 15, y, z & 15);
  }

  /**
   * Sets block ID at world coordinate (x, y, z) and persists the modification.
   */
  setBlock(x, y, z, id, dimension = this.currentDimension) {
    if (y < 0 || y >= CHUNK_HEIGHT) return;

    // Record persistent delta
    const modKey = `${x},${y},${z}`;
    this.modifiedBlocks[dimension].set(modKey, id);

    const cx = Math.floor(x / 16);
    const cz = Math.floor(z / 16);
    const chunk = this.getChunk(cx, cz, dimension);
    chunk.setBlock(x & 15, y, z & 15, id);
  }

  getLight(x, y, z, dimension = this.currentDimension) {
    if (y < 0 || y >= CHUNK_HEIGHT) return { sky: 15, block: 0 };
    const cx = Math.floor(x / 16);
    const cz = Math.floor(z / 16);
    const chunk = this.getChunk(cx, cz, dimension);
    return chunk.getLight(x & 15, y, z & 15);
  }

  setLight(x, y, z, sky, block, dimension = this.currentDimension) {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    const cx = Math.floor(x / 16);
    const cz = Math.floor(z / 16);
    const chunk = this.getChunk(cx, cz, dimension);
    chunk.setLight(x & 15, y, z & 15, sky, block);
  }

  getBlockIndex(x, y, z) {
    return (x & 15) | ((z & 15) << 4) | (y << 8);
  }

  createChunkData() {
    return new Uint8Array(CHUNK_SIZE);
  }

  classifyBiome(cont, temp) {
    return classifyBiome(cont, temp);
  }

  scaleCoordinate(dimFrom, dimTo, x, z) {
    return scaleCoordinate(dimFrom, dimTo, x, z);
  }

  /**
   * Returns list of bounding boxes for solid blocks intersecting given AABB.
   */
  getIntersectingBlockAABBs(box, dimension = this.currentDimension) {
    if (box.maxX <= box.minX || box.maxY <= box.minY || box.maxZ <= box.minZ) {
      return [];
    }

    const minX = Math.floor(box.minX);
    const maxX = Math.floor(box.maxX - 1e-6);
    const minY = Math.max(0, Math.floor(box.minY));
    const maxY = Math.min(CHUNK_HEIGHT - 1, Math.floor(box.maxY - 1e-6));
    const minZ = Math.floor(box.minZ);
    const maxZ = Math.floor(box.maxZ - 1e-6);

    const colliders = [];

    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          if (x + 1 <= box.minX || x >= box.maxX ||
              y + 1 <= box.minY || y >= box.maxY ||
              z + 1 <= box.minZ || z >= box.maxZ) {
            continue;
          }

          const id = this.getBlock(x, y, z, dimension);
          // Only solid, non-permeable blocks collide
          if (
            id !== BLOCK.AIR &&
            id !== BLOCK.WATER &&
            id !== BLOCK.LAVA &&
            id !== BLOCK.FIRE &&
            id !== BLOCK.TALL_GRASS &&
            id !== BLOCK.PINK_PETALS &&
            id !== BLOCK.NETHER_PORTAL &&
            id !== BLOCK.END_PORTAL
          ) {
            colliders.push({
              minX: x, minY: y, minZ: z,
              maxX: x + 1, maxY: y + 1, maxZ: z + 1
            });
          }
        }
      }
    }

    return colliders;
  }

  /**
   * Dimension transition state switcher with coordinate translation.
   */
  async switchDimension(targetDim, playerPos = { x: 0, y: 64, z: 0 }) {
    const fromDim = this.currentDimension;
    if (fromDim === targetDim) {
      return { x: playerPos.x, y: playerPos.y, z: playerPos.z, dimension: targetDim };
    }

    this.currentDimension = targetDim;

    let targetX = playerPos.x;
    let targetY = playerPos.y;
    let targetZ = playerPos.z;

    if (targetDim === DIMENSION.THE_END) {
      // Fixed spawn on obsidian platform
      prepareEndSpawnPlatform(this, targetDim);
      targetX = 100.5;
      targetY = 49.0;
      targetZ = 0.5;
    } else if (fromDim === DIMENSION.THE_END && targetDim === DIMENSION.OVERWORLD) {
      // Exit fountain back to Overworld spawn: sample surface height dynamically
      targetX = 0.5;
      targetZ = 0.5;
      const chunk = this.getChunk(0, 0, DIMENSION.OVERWORLD);
      const surfaceY = (chunk && chunk.heightMap) ? (chunk.heightMap[0] || 64) : 64;
      targetY = Math.max(64.0, surfaceY + 1.0);
    } else if ((fromDim === DIMENSION.OVERWORLD && targetDim === DIMENSION.NETHER) ||
               (fromDim === DIMENSION.NETHER && targetDim === DIMENSION.OVERWORLD)) {
      // 8:1 coordinate scaling and safe portal locator
      const scaled = scaleCoordinate(fromDim, targetDim, playerPos.x, playerPos.z);
      const portalRes = findOrCreateNetherPortal(
        this,
        scaled.x,
        playerPos.y,
        scaled.z,
        targetDim
      );
      targetX = portalRes.x;
      targetY = portalRes.y;
      targetZ = portalRes.z;
    }

    return {
      x: targetX,
      y: targetY,
      z: targetZ,
      dimension: targetDim
    };
  }
}

// CommonJS interoperability for test runner
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CHUNK_WIDTH,
    CHUNK_HEIGHT,
    CHUNK_DEPTH,
    CHUNK_SIZE,
    BLOCK,
    Dimension: DIMENSION,
    DIMENSION,
    SEA_LEVEL,
    NETHER_LAVA_LEVEL,
    getBlockIndex,
    classifyBiome,
    scaleCoordinate,
    WorldManager,
    VoxelWorld: WorldManager,
    World: WorldManager
  };
}
