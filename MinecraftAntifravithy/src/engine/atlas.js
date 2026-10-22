/**
 * 100% Procedural 16x16 Canvas 2D Texture Atlas Synthesizer.
 * Generates all block textures, items, mining cracks, and UI elements.
 * Zero external images, CDNs, or network requests.
 */

// ============================================================================
// Mulberry32 Deterministic PRNG
// ============================================================================
export function createPRNG(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 32-bit Little-Endian Color Packer: (A << 24) | (B << 16) | (G << 8) | R
export function packRGBA(r, g, b, a = 255) {
  const R = Math.max(0, Math.min(255, Math.round(r)));
  const G = Math.max(0, Math.min(255, Math.round(g)));
  const B = Math.max(0, Math.min(255, Math.round(b)));
  const A = Math.max(0, Math.min(255, Math.round(a)));
  return ((A & 0xFF) << 24) | ((B & 0xFF) << 16) | ((G & 0xFF) << 8) | (R & 0xFF);
}

// ============================================================================
// Texture Slot Mapping & Block ID Constants
// ============================================================================

export const TILE_SLOTS = {
  air: 0,
  dirt: 1,
  grass_top: 2,
  grass_side: 3,
  stone: 4,
  cobblestone: 5,
  bedrock: 6,
  sand: 7,
  gravel: 8,
  oak_log_side: 9,
  oak_log_top: 10,
  oak_planks: 11,
  oak_leaves: 12,
  cherry_log_side: 13,
  cherry_log_top: 14,
  cherry_planks: 15,
  cherry_leaves: 16,
  cherry_petals: 17,
  water_still: 18,
  lava_still: 19,
  obsidian: 20,
  netherrack: 21,
  glowstone: 22,
  nether_brick: 23,
  end_stone: 24,
  glass: 25,
  coal_ore: 26,
  iron_ore: 27,
  diamond_ore: 28,
  crafting_top: 29,
  crafting_side: 30,
  furnace_front: 31,
  furnace_lit: 32,
  torch: 33,
  nether_portal: 34,
  end_portal: 35,
  // 36..45: destroy_0 to destroy_9
  destroy_0: 36,
  destroy_1: 37,
  destroy_2: 38,
  destroy_3: 39,
  destroy_4: 40,
  destroy_5: 41,
  destroy_6: 42,
  destroy_7: 43,
  destroy_8: 44,
  destroy_9: 45,
  // 46..55: tools
  wood_pickaxe: 46,
  stone_pickaxe: 47,
  iron_pickaxe: 48,
  diamond_pickaxe: 49,
  wood_sword: 50,
  iron_sword: 51,
  diamond_sword: 52,
  iron_axe: 53,
  iron_shovel: 54,
  diamond_axe: 55,
  // 56..65: items
  stick: 56,
  apple: 57,
  coal: 58,
  iron_ingot: 59,
  diamond: 60,
  bread: 61,
  raw_beef: 62,
  cooked_beef: 63,
  feather: 64,
  ender_pearl: 65,
  // 66..75: hud_ui
  heart_full: 66,
  heart_half: 67,
  heart_empty: 68,
  food_full: 69,
  food_half: 70,
  food_empty: 71,
  crosshair: 72,
  hotbar_slot: 73,
  slot_selected: 74,
  xp_bar: 75
};

export const BLOCK_IDS = {
  AIR: 0,
  STONE: 1,
  GRASS_BLOCK: 2,
  DIRT: 3,
  COBBLESTONE: 4,
  OAK_PLANKS: 5,
  BEDROCK: 6,
  SAND: 7,
  GRAVEL: 8,
  OAK_LOG: 9,
  OAK_LEAVES: 10,
  CHERRY_LOG: 11,
  CHERRY_LEAVES: 12,
  CHERRY_PLANKS: 13,
  CHERRY_PETALS: 14,
  GLASS: 15,
  COAL_ORE: 16,
  IRON_ORE: 17,
  DIAMOND_ORE: 18,
  CRAFTING_TABLE: 19,
  FURNACE: 20,
  FURNACE_LIT: 21,
  TORCH: 22,
  OBSIDIAN: 23,
  NETHERRACK: 24,
  GLOWSTONE: 25,
  NETHER_BRICK: 26,
  END_STONE: 27,
  NETHER_PORTAL: 28,
  END_PORTAL: 29,
  WATER: 30,
  LAVA: 31
};

// ============================================================================
// TextureSynthesizer Class
// ============================================================================

export class TextureSynthesizer {
  constructor() {
    this.width = 256;
    this.height = 256;
    this.tilesPerRow = 16;
    this.tileSize = 16;
    this.texture = null;

    if (typeof document !== 'undefined' && document.createElement) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
      this.masterImageData = this.ctx.createImageData(this.width, this.height);
    } else {
      this.canvas = null;
      this.ctx = null;
      const buffer = new ArrayBuffer(this.width * this.height * 4);
      this.masterImageData = {
        width: this.width,
        height: this.height,
        data: new Uint8ClampedArray(buffer)
      };
    }

    this.pixels = new Uint32Array(this.masterImageData.data.buffer);
    this.generateAll();
  }

  getTileIndex(name) {
    return TILE_SLOTS[name] !== undefined ? TILE_SLOTS[name] : 0;
  }

  getTexture() {
    return this.texture;
  }

  blitTile(slotId, buffer16x16) {
    const col = slotId % this.tilesPerRow;
    const row = Math.floor(slotId / this.tilesPerRow);
    const startX = col * this.tileSize;
    const startY = row * this.tileSize;

    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const destIdx = (startY + y) * this.width + (startX + x);
        const srcIdx = y * 16 + x;
        this.pixels[destIdx] = buffer16x16[srcIdx];
      }
    }
  }

  getBlockFaceTile(blockId, faceIdx) {
    // 0: +Y (Top), 1: -Y (Bottom), 2: +Z, 3: -Z, 4: +X, 5: -X
    switch (blockId) {
      case BLOCK_IDS.AIR: return 0;
      case BLOCK_IDS.STONE: return TILE_SLOTS.stone;
      case BLOCK_IDS.GRASS_BLOCK:
        if (faceIdx === 0) return TILE_SLOTS.grass_top;
        if (faceIdx === 1) return TILE_SLOTS.dirt;
        return TILE_SLOTS.grass_side;
      case BLOCK_IDS.DIRT: return TILE_SLOTS.dirt;
      case BLOCK_IDS.COBBLESTONE: return TILE_SLOTS.cobblestone;
      case BLOCK_IDS.OAK_PLANKS: return TILE_SLOTS.oak_planks;
      case BLOCK_IDS.BEDROCK: return TILE_SLOTS.bedrock;
      case BLOCK_IDS.SAND: return TILE_SLOTS.sand;
      case BLOCK_IDS.GRAVEL: return TILE_SLOTS.gravel;
      case BLOCK_IDS.OAK_LOG:
        if (faceIdx === 0 || faceIdx === 1) return TILE_SLOTS.oak_log_top;
        return TILE_SLOTS.oak_log_side;
      case BLOCK_IDS.OAK_LEAVES: return TILE_SLOTS.oak_leaves;
      case BLOCK_IDS.CHERRY_LOG:
        if (faceIdx === 0 || faceIdx === 1) return TILE_SLOTS.cherry_log_top;
        return TILE_SLOTS.cherry_log_side;
      case BLOCK_IDS.CHERRY_LEAVES: return TILE_SLOTS.cherry_leaves;
      case BLOCK_IDS.CHERRY_PLANKS: return TILE_SLOTS.cherry_planks;
      case BLOCK_IDS.CHERRY_PETALS: return TILE_SLOTS.cherry_petals;
      case BLOCK_IDS.GLASS: return TILE_SLOTS.glass;
      case BLOCK_IDS.COAL_ORE: return TILE_SLOTS.coal_ore;
      case BLOCK_IDS.IRON_ORE: return TILE_SLOTS.iron_ore;
      case BLOCK_IDS.DIAMOND_ORE: return TILE_SLOTS.diamond_ore;
      case BLOCK_IDS.CRAFTING_TABLE:
        if (faceIdx === 0) return TILE_SLOTS.crafting_top;
        if (faceIdx === 1) return TILE_SLOTS.oak_planks;
        return TILE_SLOTS.crafting_side;
      case BLOCK_IDS.FURNACE:
        if (faceIdx === 2) return TILE_SLOTS.furnace_front;
        return TILE_SLOTS.cobblestone;
      case BLOCK_IDS.FURNACE_LIT:
        if (faceIdx === 2) return TILE_SLOTS.furnace_lit;
        return TILE_SLOTS.cobblestone;
      case BLOCK_IDS.TORCH: return TILE_SLOTS.torch;
      case BLOCK_IDS.OBSIDIAN: return TILE_SLOTS.obsidian;
      case BLOCK_IDS.NETHERRACK: return TILE_SLOTS.netherrack;
      case BLOCK_IDS.GLOWSTONE: return TILE_SLOTS.glowstone;
      case BLOCK_IDS.NETHER_BRICK: return TILE_SLOTS.nether_brick;
      case BLOCK_IDS.END_STONE: return TILE_SLOTS.end_stone;
      case BLOCK_IDS.NETHER_PORTAL: return TILE_SLOTS.nether_portal;
      case BLOCK_IDS.END_PORTAL: return TILE_SLOTS.end_portal;
      case BLOCK_IDS.WATER: return TILE_SLOTS.water_still;
      case BLOCK_IDS.LAVA: return TILE_SLOTS.lava_still;
      default: return TILE_SLOTS.stone;
    }
  }

  // ==========================================================================
  // Procedural Generators (16x16 pixels each)
  // ==========================================================================

  generateDirt() {
    const rand = createPRNG(1001);
    const buf = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      const n = rand();
      let r = 134, g = 96, b = 67;
      if (n < 0.2) {
        r = 100; g = 70; b = 48; // Dark pebble
      } else if (n > 0.8) {
        r = 155; g = 115; b = 80; // Light pebble
      } else {
        const v = (rand() - 0.5) * 16;
        r += v; g += v * 0.8; b += v * 0.6;
      }
      buf[i] = packRGBA(r, g, b);
    }
    return buf;
  }

  generateGrassTop() {
    const rand = createPRNG(1002);
    const buf = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      const n = rand();
      let r = 90, g = 160, b = 45;
      const v = (n - 0.5) * 26;
      r += v * 0.7; g += v; b += v * 0.5;
      buf[i] = packRGBA(r, g, b);
    }
    return buf;
  }

  generateGrassSide() {
    const dirt = this.generateDirt();
    const rand = createPRNG(1003);
    const buf = new Uint32Array(dirt);

    for (let x = 0; x < 16; x++) {
      const drip = 2 + Math.floor(rand() * 3); // 2 to 4 px drip
      for (let y = 0; y < 16; y++) {
        if (y < drip) {
          const n = rand();
          const r = 90 + (n - 0.5) * 20;
          const g = 160 + (n - 0.5) * 20;
          const b = 45 + (n - 0.5) * 15;
          buf[y * 16 + x] = packRGBA(r, g, b);
        } else if (y === drip && rand() > 0.5) {
          buf[y * 16 + x] = packRGBA(80, 145, 40);
        }
      }
    }
    return buf;
  }

  generateStone() {
    const rand = createPRNG(1004);
    const buf = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      const n = (rand() - 0.5) * 24;
      const val = Math.max(90, Math.min(160, 125 + n));
      buf[i] = packRGBA(val, val, val);
    }
    return buf;
  }

  generateCobblestone() {
    const rand = createPRNG(1005);
    const buf = new Uint32Array(256);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const isGrout = (x % 5 === 0) || (y % 4 === 0 && (x % 5 > 2)) || ((y + 2) % 4 === 0 && (x % 5 <= 2));
        if (isGrout || rand() < 0.12) {
          const g = 65 + (rand() - 0.5) * 16;
          buf[y * 16 + x] = packRGBA(g, g, g);
        } else {
          const val = 135 + (rand() - 0.5) * 28;
          buf[y * 16 + x] = packRGBA(val, val, val);
        }
      }
    }
    return buf;
  }

  generateBedrock() {
    const rand = createPRNG(1006);
    const buf = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      const n = rand();
      let val;
      if (n < 0.4) val = 20 + rand() * 15;
      else if (n < 0.8) val = 75 + rand() * 25;
      else val = 130 + rand() * 30;
      buf[i] = packRGBA(val, val, val);
    }
    return buf;
  }

  generateSand() {
    const rand = createPRNG(1007);
    const buf = new Uint32Array(256);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const wave = Math.sin(x * 0.4 + y * 0.2) * 5;
        const n = (rand() - 0.5) * 12;
        const r = 219 + wave + n;
        const g = 211 + wave + n * 0.9;
        const b = 160 + wave + n * 0.7;
        buf[y * 16 + x] = packRGBA(r, g, b);
      }
    }
    return buf;
  }

  generateGravel() {
    const rand = createPRNG(1008);
    const buf = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      const n = rand();
      let r = 132, g = 126, b = 135;
      if (n < 0.25) {
        r = 105; g = 98; b = 110;
      } else if (n > 0.75) {
        r = 160; g = 152; b = 163;
      } else {
        const v = (rand() - 0.5) * 18;
        r += v; g += v; b += v * 1.1;
      }
      buf[i] = packRGBA(r, g, b);
    }
    return buf;
  }

  generateOakLogSide() {
    const rand = createPRNG(1009);
    const buf = new Uint32Array(256);
    for (let x = 0; x < 16; x++) {
      const isGroove = (x === 0 || x === 4 || x === 9 || x === 13);
      for (let y = 0; y < 16; y++) {
        let r, g, b;
        if (isGroove) {
          r = 78 + (rand() - 0.5) * 10;
          g = 60 + (rand() - 0.5) * 10;
          b = 35 + (rand() - 0.5) * 8;
        } else {
          r = 105 + (rand() - 0.5) * 14;
          g = 84 + (rand() - 0.5) * 14;
          b = 52 + (rand() - 0.5) * 10;
        }
        buf[y * 16 + x] = packRGBA(r, g, b);
      }
    }
    return buf;
  }

  generateOakLogTop() {
    const rand = createPRNG(1010);
    const buf = new Uint32Array(256);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dx = x - 7.5;
        const dy = y - 7.5;
        const dist = Math.hypot(dx, dy);
        let r, g, b;
        if (dist > 6.2) {
          r = 78; g = 60; b = 35; // Outer dark bark
        } else {
          // Rings
          const ring = Math.floor(dist * 1.2) % 2;
          const noise = (rand() - 0.5) * 10;
          if (ring === 0) {
            r = 168 + noise; g = 140 + noise; b = 94 + noise;
          } else {
            r = 148 + noise; g = 120 + noise; b = 78 + noise;
          }
        }
        buf[y * 16 + x] = packRGBA(r, g, b);
      }
    }
    return buf;
  }

  generateOakPlanks() {
    const rand = createPRNG(1011);
    const buf = new Uint32Array(256);
    for (let y = 0; y < 16; y++) {
      const plankIdx = Math.floor(y / 4);
      const isSeam = (y % 4 === 0);
      for (let x = 0; x < 16; x++) {
        if (isSeam) {
          buf[y * 16 + x] = packRGBA(70, 50, 25);
        } else {
          const woodNoise = (rand() - 0.5) * 14;
          const plankTone = plankIdx % 2 === 0 ? 0 : 8;
          let r = 162 + woodNoise + plankTone;
          let g = 130 + woodNoise + plankTone * 0.8;
          let b = 78 + woodNoise + plankTone * 0.5;
          // Nails at ends
          if ((x === 1 || x === 14) && (y % 4 === 2)) {
            r = 70; g = 60; b = 50;
          }
          buf[y * 16 + x] = packRGBA(r, g, b);
        }
      }
    }
    return buf;
  }

  generateOakLeaves() {
    const rand = createPRNG(1012);
    const buf = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      if (rand() < 0.30) {
        buf[i] = packRGBA(0, 0, 0, 0); // Cutout lattice holes
      } else {
        const n = rand();
        const r = 50 + n * 25;
        const g = 120 + n * 35;
        const b = 30 + n * 15;
        buf[i] = packRGBA(r, g, b, 255);
      }
    }
    return buf;
  }

  generateCherryLogSide() {
    const rand = createPRNG(1013);
    const buf = new Uint32Array(256);
    for (let x = 0; x < 16; x++) {
      const isRidge = (x % 4 === 0);
      for (let y = 0; y < 16; y++) {
        let r, g, b;
        if (isRidge) {
          r = 46 + (rand() - 0.5) * 8;
          g = 30 + (rand() - 0.5) * 6;
          b = 36 + (rand() - 0.5) * 8;
        } else {
          r = 68 + (rand() - 0.5) * 12;
          g = 48 + (rand() - 0.5) * 10;
          b = 56 + (rand() - 0.5) * 12;
        }
        buf[y * 16 + x] = packRGBA(r, g, b);
      }
    }
    return buf;
  }

  generateCherryLogTop() {
    const rand = createPRNG(1014);
    const buf = new Uint32Array(256);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dist = Math.hypot(x - 7.5, y - 7.5);
        let r, g, b;
        if (dist > 6.2) {
          r = 46; g = 30; b = 36;
        } else {
          const n = (rand() - 0.5) * 12;
          const ring = Math.floor(dist * 1.3) % 2;
          if (ring === 0) {
            r = 225 + n; g = 175 + n; b = 185 + n;
          } else {
            r = 210 + n; g = 160 + n; b = 170 + n;
          }
        }
        buf[y * 16 + x] = packRGBA(r, g, b);
      }
    }
    return buf;
  }

  generateCherryPlanks() {
    const rand = createPRNG(1015);
    const buf = new Uint32Array(256);
    for (let y = 0; y < 16; y++) {
      const isSeam = (y % 4 === 0);
      for (let x = 0; x < 16; x++) {
        if (isSeam) {
          buf[y * 16 + x] = packRGBA(160, 100, 110);
        } else {
          const n = (rand() - 0.5) * 14;
          const r = 232 + n;
          const g = 186 + n;
          const b = 186 + n;
          buf[y * 16 + x] = packRGBA(r, g, b);
        }
      }
    }
    return buf;
  }

  generateCherryLeaves() {
    const rand = createPRNG(1016);
    const buf = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      if (rand() < 0.28) {
        buf[i] = packRGBA(0, 0, 0, 0); // Cutout
      } else {
        const n = rand();
        let r = 255, g = 183 + (n - 0.5) * 24, b = 197 + (n - 0.5) * 24;
        if (n < 0.25) {
          r = 235; g = 140; b = 165;
        } else if (n > 0.8) {
          r = 255; g = 240; b = 245;
        }
        buf[i] = packRGBA(r, g, b, 255);
      }
    }
    return buf;
  }

  generateCherryPetals() {
    const rand = createPRNG(1017);
    const buf = new Uint32Array(256);
    // Mostly transparent with small scatter of petals
    for (let i = 0; i < 256; i++) {
      if (rand() < 0.80) {
        buf[i] = packRGBA(0, 0, 0, 0);
      } else {
        const n = rand();
        const r = 255, g = 180 + n * 30, b = 195 + n * 20;
        buf[i] = packRGBA(r, g, b, 255);
      }
    }
    return buf;
  }

  generateWater() {
    const buf = new Uint32Array(256);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const wave = Math.sin(x * 0.45 + y * 0.55) * 16;
        const r = 40 + wave * 0.4;
        const g = 90 + wave * 0.7;
        const b = 210 + wave;
        buf[y * 16 + x] = packRGBA(r, g, b, 180); // 70% opacity
      }
    }
    return buf;
  }

  generateLava() {
    const rand = createPRNG(1019);
    const buf = new Uint32Array(256);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const n = rand();
        if (n < 0.18) {
          buf[y * 16 + x] = packRGBA(120, 20, 0); // Basalt crust
        } else if (n > 0.72) {
          buf[y * 16 + x] = packRGBA(255, 220, 0); // White-yellow core
        } else {
          buf[y * 16 + x] = packRGBA(230, 90, 0); // Molten magma
        }
      }
    }
    return buf;
  }

  generateObsidian() {
    const rand = createPRNG(1020);
    const buf = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      const n = rand();
      if (n < 0.14) {
        buf[i] = packRGBA(65, 40, 100); // Sharp purple facet
      } else {
        const val = 18 + (rand() - 0.5) * 8;
        buf[i] = packRGBA(val, val * 0.75, val * 1.5);
      }
    }
    return buf;
  }

  generateNetherrack() {
    const rand = createPRNG(1021);
    const buf = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      const n = rand();
      let r = 115, g = 35, b = 35;
      if (n < 0.2) {
        r = 70; g = 15; b = 15;
      } else if (n > 0.8) {
        r = 145; g = 50; b = 50;
      } else {
        const v = (rand() - 0.5) * 22;
        r += v; g += v * 0.3; b += v * 0.3;
      }
      buf[i] = packRGBA(r, g, b);
    }
    return buf;
  }

  generateGlowstone() {
    const rand = createPRNG(1022);
    const buf = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      const n = rand();
      let r, g, b;
      if (n < 0.25) {
        r = 255; g = 240; b = 170; // Brilliant facet
      } else if (n > 0.75) {
        r = 200; g = 140; b = 40; // Brown stone vein
      } else {
        r = 255; g = 220; b = 110; // Glowing gold
      }
      buf[i] = packRGBA(r, g, b);
    }
    return buf;
  }

  generateNetherBrick() {
    const rand = createPRNG(1023);
    const buf = new Uint32Array(256);
    for (let y = 0; y < 16; y++) {
      const isHSeam = (y % 4 === 0);
      const row = Math.floor(y / 4);
      for (let x = 0; x < 16; x++) {
        const xOffset = (row % 2 === 0) ? 0 : 4;
        const isVSeam = ((x + xOffset) % 8 === 0);
        if (isHSeam || isVSeam) {
          buf[y * 16 + x] = packRGBA(30, 10, 13); // Dark mortar
        } else {
          const n = (rand() - 0.5) * 16;
          buf[y * 16 + x] = packRGBA(50 + n, 20 + n * 0.4, 25 + n * 0.5);
        }
      }
    }
    return buf;
  }

  generateEndStone() {
    const rand = createPRNG(1024);
    const buf = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      const n = rand();
      let r = 220, g = 223, b = 158;
      const v = (n - 0.5) * 32;
      r += v; g += v; b += v * 0.8;
      buf[i] = packRGBA(r, g, b);
    }
    return buf;
  }

  generateGlass() {
    const buf = new Uint32Array(256);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const isBorder = (x === 0 || x === 15 || y === 0 || y === 15);
        // Diagonal highlight glare streaks
        const isGlint1 = (x === y && x >= 3 && x <= 5);
        const isGlint2 = (x === y && x >= 10 && x <= 12);
        if (isBorder || isGlint1 || isGlint2) {
          buf[y * 16 + x] = packRGBA(255, 255, 255, 220);
        } else {
          buf[y * 16 + x] = packRGBA(200, 220, 255, 40); // Faint transparent tint
        }
      }
    }
    return buf;
  }

  generateOre(speckColor) {
    const base = this.generateStone();
    const rand = createPRNG(1025 + speckColor);
    const buf = new Uint32Array(base);
    // Deposit 12-18 ore cluster pixels
    const oreCount = 14 + Math.floor(rand() * 6);
    for (let i = 0; i < oreCount; i++) {
      const ox = 2 + Math.floor(rand() * 12);
      const oy = 2 + Math.floor(rand() * 12);
      buf[oy * 16 + ox] = speckColor;
      if (rand() > 0.4) buf[oy * 16 + (ox + 1)] = speckColor;
    }
    return buf;
  }

  generateCraftingTop() {
    const planks = this.generateOakPlanks();
    const buf = new Uint32Array(planks);
    // Draw 3x3 carved grid and dark perimeter border
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const isFrame = (x <= 1 || x >= 14 || y <= 1 || y >= 14);
        const isGrid = (x === 6 || x === 10 || y === 6 || y === 10);
        if (isFrame) {
          buf[y * 16 + x] = packRGBA(90, 65, 35);
        } else if (isGrid) {
          buf[y * 16 + x] = packRGBA(75, 52, 28);
        }
      }
    }
    return buf;
  }

  generateCraftingSide() {
    const planks = this.generateOakPlanks();
    const buf = new Uint32Array(planks);
    // Hammer / Saw tool silhouettes
    for (let y = 4; y <= 12; y++) {
      buf[y * 16 + 5] = packRGBA(40, 40, 40); // Handle
    }
    for (let x = 3; x <= 7; x++) {
      buf[4 * 16 + x] = packRGBA(180, 180, 180); // Hammer head
    }
    return buf;
  }

  generateFurnaceFront(isLit = false) {
    const cobble = this.generateCobblestone();
    const buf = new Uint32Array(cobble);
    // Furnace opening: (3, 8) to (12, 13)
    for (let y = 7; y <= 13; y++) {
      for (let x = 3; x <= 12; x++) {
        if (isLit) {
          const flame = Math.sin(x * 0.8 + y) * 30;
          buf[y * 16 + x] = packRGBA(255, 140 + flame, 20);
        } else {
          buf[y * 16 + x] = packRGBA(30, 30, 30);
        }
      }
    }
    return buf;
  }

  generateTorch() {
    const buf = new Uint32Array(256);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (x >= 7 && x <= 8 && y >= 6 && y <= 14) {
          buf[y * 16 + x] = packRGBA(130, 95, 45); // Wood stick
        } else if (x >= 6 && x <= 9 && y >= 3 && y <= 5) {
          buf[y * 16 + x] = packRGBA(255, 200, 40); // Flame core
        } else if (x >= 7 && x <= 8 && y === 2) {
          buf[y * 16 + x] = packRGBA(255, 240, 120); // Flame tip
        } else {
          buf[y * 16 + x] = packRGBA(0, 0, 0, 0);
        }
      }
    }
    return buf;
  }

  generateNetherPortal() {
    const rand = createPRNG(1030);
    const buf = new Uint32Array(256);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const swirl = Math.sin(x * 0.5 + y * 0.5) * 30;
        const n = (rand() - 0.5) * 20;
        const r = 160 + swirl * 0.5 + n;
        const g = 40 + n * 0.5;
        const b = 230 + swirl + n;
        buf[y * 16 + x] = packRGBA(r, g, b, 210);
      }
    }
    return buf;
  }

  generateEndPortal() {
    const rand = createPRNG(1031);
    const buf = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      if (rand() < 0.12) {
        // Celestial starry speck
        buf[i] = packRGBA(180, 255, 255, 255);
      } else {
        buf[i] = packRGBA(5, 5, 12, 255); // Pure deep void
      }
    }
    return buf;
  }

  generateDestroyStages() {
    const stages = [];
    const rand = createPRNG(1032);
    const crackMask = new Uint8Array(256);

    for (let stage = 0; stage < 10; stage++) {
      const buf = new Uint32Array(256);
      const newCracks = 12 + stage * 10;
      for (let c = 0; c < newCracks; c++) {
        const idx = Math.floor(rand() * 256);
        crackMask[idx] = 1;
      }
      for (let i = 0; i < 256; i++) {
        if (crackMask[i]) {
          buf[i] = packRGBA(0, 0, 0, 215); // Black crack line
        } else {
          buf[i] = packRGBA(0, 0, 0, 0);
        }
      }
      stages.push(buf);
    }
    return stages;
  }

  generateTool(bladeColor, type = 'pickaxe') {
    const buf = new Uint32Array(256);
    // Draw 45-degree diagonal handle
    for (let i = 0; i < 11; i++) {
      const hx = 2 + i;
      const hy = 13 - i;
      buf[hy * 16 + hx] = packRGBA(120, 85, 45); // Wood stick
    }
    // Draw blade head based on tool type
    if (type === 'pickaxe') {
      const pts = [[10, 2], [11, 2], [12, 3], [13, 4], [13, 5], [9, 3], [8, 4], [7, 5]];
      for (const [px, py] of pts) {
        buf[py * 16 + px] = bladeColor;
      }
    } else if (type === 'sword') {
      for (let i = 0; i < 7; i++) {
        buf[(7 - i) * 16 + (8 + i)] = bladeColor;
        buf[(6 - i) * 16 + (8 + i)] = bladeColor;
      }
      // Guard
      buf[9 * 16 + 6] = bladeColor;
      buf[8 * 16 + 8] = bladeColor;
    } else if (type === 'axe') {
      const pts = [[11, 2], [12, 2], [13, 3], [12, 4], [11, 4], [10, 5]];
      for (const [px, py] of pts) buf[py * 16 + px] = bladeColor;
    } else if (type === 'shovel') {
      const pts = [[11, 3], [12, 3], [13, 3], [11, 4], [12, 4], [13, 4]];
      for (const [px, py] of pts) buf[py * 16 + px] = bladeColor;
    }
    return buf;
  }

  generateItemSprite(type) {
    const buf = new Uint32Array(256);
    if (type === 'apple') {
      for (let y = 4; y <= 12; y++) {
        for (let x = 4; x <= 11; x++) {
          if (Math.hypot(x - 7.5, y - 8) < 4) {
            buf[y * 16 + x] = packRGBA(220, 30, 25);
          }
        }
      }
      buf[3 * 16 + 7] = packRGBA(80, 50, 20); // Stem
      buf[3 * 16 + 8] = packRGBA(80, 180, 40); // Leaf
    } else if (type === 'coal') {
      for (let y = 5; y <= 11; y++) {
        for (let x = 5; x <= 11; x++) {
          if (Math.hypot(x - 8, y - 8) < 3.5) {
            buf[y * 16 + x] = packRGBA(35, 35, 38);
          }
        }
      }
    } else if (type === 'diamond') {
      const pts = [
        [7, 4], [8, 4],
        [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6],
        [6, 8], [7, 8], [8, 8], [9, 8],
        [7, 10], [8, 10]
      ];
      for (const [px, py] of pts) {
        buf[py * 16 + px] = packRGBA(92, 229, 216);
      }
    } else if (type === 'stick') {
      for (let i = 0; i < 12; i++) {
        buf[(13 - i) * 16 + (2 + i)] = packRGBA(125, 90, 48);
      }
    } else {
      // Generic item gem
      for (let y = 6; y <= 10; y++) {
        for (let x = 6; x <= 10; x++) {
          buf[y * 16 + x] = packRGBA(200, 200, 200);
        }
      }
    }
    return buf;
  }

  generateHUDSprite(type) {
    const buf = new Uint32Array(256);
    if (type === 'heart_full') {
      // 9x9 heart shape
      const heart = [
        " 11 11 ",
        "1111111",
        "1111111",
        " 11111 ",
        "  111  ",
        "   1   "
      ];
      for (let r = 0; r < heart.length; r++) {
        for (let c = 0; c < heart[r].length; c++) {
          if (heart[r][c] === '1') {
            buf[(r + 5) * 16 + (c + 4)] = packRGBA(220, 20, 20);
          }
        }
      }
    } else if (type === 'food_full') {
      for (let y = 5; y <= 11; y++) {
        for (let x = 4; x <= 10; x++) {
          if (Math.hypot(x - 7, y - 8) < 3.2) {
            buf[y * 16 + x] = packRGBA(180, 100, 50); // Shank meat
          }
        }
      }
      buf[12 * 16 + 11] = packRGBA(230, 230, 230); // Bone tip
    } else if (type === 'crosshair') {
      // 15x15 inverted crosshair with center gap
      for (let i = 2; i <= 13; i++) {
        if (i < 6 || i > 9) {
          buf[7 * 16 + i] = packRGBA(255, 255, 255, 220); // Horizontal
          buf[i * 16 + 7] = packRGBA(255, 255, 255, 220); // Vertical
        }
      }
    }
    return buf;
  }

  // ==========================================================================
  // Master Synthesizer Build
  // ==========================================================================

  generateAll() {
    this.blitTile(TILE_SLOTS.dirt, this.generateDirt());
    this.blitTile(TILE_SLOTS.grass_top, this.generateGrassTop());
    this.blitTile(TILE_SLOTS.grass_side, this.generateGrassSide());
    this.blitTile(TILE_SLOTS.stone, this.generateStone());
    this.blitTile(TILE_SLOTS.cobblestone, this.generateCobblestone());
    this.blitTile(TILE_SLOTS.bedrock, this.generateBedrock());
    this.blitTile(TILE_SLOTS.sand, this.generateSand());
    this.blitTile(TILE_SLOTS.gravel, this.generateGravel());
    this.blitTile(TILE_SLOTS.oak_log_side, this.generateOakLogSide());
    this.blitTile(TILE_SLOTS.oak_log_top, this.generateOakLogTop());
    this.blitTile(TILE_SLOTS.oak_planks, this.generateOakPlanks());
    this.blitTile(TILE_SLOTS.oak_leaves, this.generateOakLeaves());
    this.blitTile(TILE_SLOTS.cherry_log_side, this.generateCherryLogSide());
    this.blitTile(TILE_SLOTS.cherry_log_top, this.generateCherryLogTop());
    this.blitTile(TILE_SLOTS.cherry_planks, this.generateCherryPlanks());
    this.blitTile(TILE_SLOTS.cherry_leaves, this.generateCherryLeaves());
    this.blitTile(TILE_SLOTS.cherry_petals, this.generateCherryPetals());
    this.blitTile(TILE_SLOTS.water_still, this.generateWater());
    this.blitTile(TILE_SLOTS.lava_still, this.generateLava());
    this.blitTile(TILE_SLOTS.obsidian, this.generateObsidian());
    this.blitTile(TILE_SLOTS.netherrack, this.generateNetherrack());
    this.blitTile(TILE_SLOTS.glowstone, this.generateGlowstone());
    this.blitTile(TILE_SLOTS.nether_brick, this.generateNetherBrick());
    this.blitTile(TILE_SLOTS.end_stone, this.generateEndStone());
    this.blitTile(TILE_SLOTS.glass, this.generateGlass());

    // Ores
    this.blitTile(TILE_SLOTS.coal_ore, this.generateOre(packRGBA(25, 25, 28)));
    this.blitTile(TILE_SLOTS.iron_ore, this.generateOre(packRGBA(210, 180, 150)));
    this.blitTile(TILE_SLOTS.diamond_ore, this.generateOre(packRGBA(92, 229, 216)));

    // Utility blocks
    this.blitTile(TILE_SLOTS.crafting_top, this.generateCraftingTop());
    this.blitTile(TILE_SLOTS.crafting_side, this.generateCraftingSide());
    this.blitTile(TILE_SLOTS.furnace_front, this.generateFurnaceFront(false));
    this.blitTile(TILE_SLOTS.furnace_lit, this.generateFurnaceFront(true));
    this.blitTile(TILE_SLOTS.torch, this.generateTorch());
    this.blitTile(TILE_SLOTS.nether_portal, this.generateNetherPortal());
    this.blitTile(TILE_SLOTS.end_portal, this.generateEndPortal());

    // 10 Mining Cracks (Stages 0..9)
    const cracks = this.generateDestroyStages();
    for (let s = 0; s < 10; s++) {
      this.blitTile(TILE_SLOTS.destroy_0 + s, cracks[s]);
    }

    // Tools
    this.blitTile(TILE_SLOTS.wood_pickaxe, this.generateTool(packRGBA(162, 130, 78), 'pickaxe'));
    this.blitTile(TILE_SLOTS.stone_pickaxe, this.generateTool(packRGBA(135, 135, 135), 'pickaxe'));
    this.blitTile(TILE_SLOTS.iron_pickaxe, this.generateTool(packRGBA(220, 220, 220), 'pickaxe'));
    this.blitTile(TILE_SLOTS.diamond_pickaxe, this.generateTool(packRGBA(92, 229, 216), 'pickaxe'));
    this.blitTile(TILE_SLOTS.wood_sword, this.generateTool(packRGBA(162, 130, 78), 'sword'));
    this.blitTile(TILE_SLOTS.iron_sword, this.generateTool(packRGBA(220, 220, 220), 'sword'));
    this.blitTile(TILE_SLOTS.diamond_sword, this.generateTool(packRGBA(92, 229, 216), 'sword'));
    this.blitTile(TILE_SLOTS.iron_axe, this.generateTool(packRGBA(220, 220, 220), 'axe'));
    this.blitTile(TILE_SLOTS.iron_shovel, this.generateTool(packRGBA(220, 220, 220), 'shovel'));

    // Items
    this.blitTile(TILE_SLOTS.stick, this.generateItemSprite('stick'));
    this.blitTile(TILE_SLOTS.apple, this.generateItemSprite('apple'));
    this.blitTile(TILE_SLOTS.coal, this.generateItemSprite('coal'));
    this.blitTile(TILE_SLOTS.diamond, this.generateItemSprite('diamond'));

    // HUD Elements
    this.blitTile(TILE_SLOTS.heart_full, this.generateHUDSprite('heart_full'));
    this.blitTile(TILE_SLOTS.food_full, this.generateHUDSprite('food_full'));
    this.blitTile(TILE_SLOTS.crosshair, this.generateHUDSprite('crosshair'));
  }

  buildAndUpload(gl) {
    if (this.ctx && this.canvas) {
      this.ctx.putImageData(this.masterImageData, 0, 0);
    }

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    if (this.canvas) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.masterImageData.data);
    }

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    return this.texture;
  }
}
