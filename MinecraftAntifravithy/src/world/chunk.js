/**
 * Voxel Chunk Data Structures & Fast Bitwise Coordinate Indexing.
 * Implements 16x16x16 ChunkSection and 16-section ChunkColumn (Y=0..255)
 * using flat 64KB Uint8Array voxel storage.
 * Zero external dependencies.
 */

export const CHUNK_WIDTH = 16;
export const CHUNK_HEIGHT = 256;
export const CHUNK_DEPTH = 16;
export const SECTIONS_PER_COLUMN = 16;
export const SECTION_SIZE = 16;
export const SECTION_VOLUME = 4096; // 16 * 16 * 16
export const CHUNK_SIZE = CHUNK_WIDTH * CHUNK_HEIGHT * CHUNK_DEPTH; // 65536

export const BLOCK = {
  AIR: 0,
  STONE: 1,
  GRASS: 2,
  GRASS_BLOCK: 2,
  DIRT: 3,
  COBBLESTONE: 4,
  OAK_LOG: 5,
  OAK_LEAVES: 6,
  BEDROCK: 7,
  WATER: 8,
  LAVA: 9,
  SAND: 10,
  GRAVEL: 11,
  OBSIDIAN: 12,
  NETHERRACK: 13,
  SOUL_SAND: 14,
  GLOWSTONE: 15,
  NETHER_BRICK: 16,
  NETHER_BRICK_FENCE: 17,
  NETHER_BRICK_STAIRS: 18,
  END_STONE: 19,
  CHERRY_LOG: 20,
  CHERRY_LEAVES: 21,
  PINK_PETALS: 22,
  NETHER_PORTAL: 23,
  END_PORTAL_FRAME: 24,
  END_PORTAL: 25,
  FIRE: 26,
  TALL_GRASS: 27
};

/**
 * Fast bitwise coordinate indexing into 64KB linear chunk array.
 * (x & 15) | ((z & 15) << 4) | (y << 8)
 */
export function getBlockIndex(x, y, z) {
  return (x & 15) | ((z & 15) << 4) | (y << 8);
}

/**
 * 16x16x16 Voxel Sub-Chunk Section for localized rendering and occlusion culling.
 */
export class ChunkSection {
  constructor(cx = 0, cy = 0, cz = 0) {
    this.cx = cx;
    this.cy = cy;
    this.cz = cz;
    this.blocks = new Uint8Array(SECTION_VOLUME);
    this.light = new Uint8Array(SECTION_VOLUME);
    this.light.fill(0xF0); // 15 sky light, 0 block light default
    this.mesh = null;
    this.dirty = true;
    this.empty = true;
  }

  getIndex(x, y, z) {
    return (y << 8) | (z << 4) | x;
  }

  getBlock(x, y, z) {
    if (x < 0 || x >= 16 || y < 0 || y >= 16 || z < 0 || z >= 16) return 0;
    return this.blocks[(y << 8) | (z << 4) | x];
  }

  setBlock(x, y, z, id) {
    if (x < 0 || x >= 16 || y < 0 || y >= 16 || z < 0 || z >= 16) return;
    this.blocks[(y << 8) | (z << 4) | x] = id;
    this.dirty = true;
    if (id !== BLOCK.AIR) {
      this.empty = false;
    }
  }

  getLight(x, y, z) {
    if (x < 0 || x >= 16 || y < 0 || y >= 16 || z < 0 || z >= 16) {
      return { sky: 15, block: 0 };
    }
    const val = this.light[(y << 8) | (z << 4) | x];
    return { sky: (val >> 4) & 0xF, block: val & 0xF };
  }

  setLight(x, y, z, sky, block) {
    if (x < 0 || x >= 16 || y < 0 || y >= 16 || z < 0 || z >= 16) return;
    this.light[(y << 8) | (z << 4) | x] = ((sky & 0xF) << 4) | (block & 0xF);
    this.dirty = true;
  }
}

/**
 * 16x256x16 ChunkColumn holding 16 ChunkSections.
 * Linear flat storage in a single 64KB Uint8Array for optimal GC locality.
 */
export class ChunkColumn {
  constructor(cx = 0, cz = 0) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_SIZE);
    this.heightMap = new Int16Array(256);
    this.sections = new Array(SECTIONS_PER_COLUMN);
    for (let cy = 0; cy < SECTIONS_PER_COLUMN; cy++) {
      this.sections[cy] = new ChunkSection(cx, cy, cz);
    }
    this.isDirty = true;
    this.isGenerated = false;
  }

  getBlockIndex(x, y, z) {
    return (x & 15) | ((z & 15) << 4) | (y << 8);
  }

  getBlock(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return BLOCK.AIR;
    return this.blocks[(x & 15) | ((z & 15) << 4) | (y << 8)];
  }

  setBlock(x, y, z, id) {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    const lx = x & 15;
    const lz = z & 15;
    const idx = lx | (lz << 4) | (y << 8);
    this.blocks[idx] = id;

    // Update sub-chunk section
    const cy = y >> 4;
    const secY = y & 15;
    this.sections[cy].setBlock(lx, secY, lz, id);

    // Update heightmap
    const hIdx = (lz << 4) | lx;
    if (id !== BLOCK.AIR) {
      if (y > this.heightMap[hIdx]) {
        this.heightMap[hIdx] = y;
      }
    } else if (y === this.heightMap[hIdx]) {
      this._recomputeColumnHeight(lx, lz);
    }

    this.isDirty = true;
  }

  getLight(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return { sky: 15, block: 0 };
    const cy = y >> 4;
    return this.sections[cy].getLight(x & 15, y & 15, z & 15);
  }

  setLight(x, y, z, sky, block) {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    const cy = y >> 4;
    this.sections[cy].setLight(x & 15, y & 15, z & 15, sky, block);
    this.isDirty = true;
  }

  _recomputeColumnHeight(lx, lz) {
    const hIdx = (lz << 4) | lx;
    const colBase = lx | (lz << 4);
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      if (this.blocks[colBase | (y << 8)] !== BLOCK.AIR) {
        this.heightMap[hIdx] = y;
        return;
      }
    }
    this.heightMap[hIdx] = 0;
  }

  recomputeHeightMap() {
    for (let lz = 0; lz < 16; lz++) {
      for (let lx = 0; lx < 16; lx++) {
        this._recomputeColumnHeight(lx, lz);
      }
    }
  }

  /**
   * Synchronizes internal ChunkSections and heightmap after direct bulk modification of this.blocks.
   */
  syncFromBlocks() {
    for (let cy = 0; cy < SECTIONS_PER_COLUMN; cy++) {
      const sec = this.sections[cy];
      let empty = true;
      const baseSecY = cy << 4;
      for (let sy = 0; sy < 16; sy++) {
        const y = baseSecY | sy;
        const yShift = y << 8;
        const secYShift = sy << 8;
        for (let sz = 0; sz < 16; sz++) {
          const zShift = sz << 4;
          for (let sx = 0; sx < 16; sx++) {
            const b = this.blocks[sx | zShift | yShift];
            sec.blocks[secYShift | zShift | sx] = b;
            if (b !== BLOCK.AIR) empty = false;
          }
        }
      }
      sec.empty = empty;
      sec.dirty = true;
    }
    this.recomputeHeightMap();
    this.isDirty = true;
  }
}

// CommonJS interoperability for test runner
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CHUNK_WIDTH,
    CHUNK_HEIGHT,
    CHUNK_DEPTH,
    SECTIONS_PER_COLUMN,
    SECTION_SIZE,
    SECTION_VOLUME,
    CHUNK_SIZE,
    BLOCK,
    getBlockIndex,
    ChunkSection,
    ChunkColumn
  };
}
