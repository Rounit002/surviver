/**
 * Block Breaking, Hardness Table, Damage Overlays & Interaction Manager.
 * Java Edition authentic break times, 10-stage damage calculation,
 * cross-chunk mesh dirtying, and placement anti-clipping.
 * Dual ESM and CommonJS exports. Zero external dependencies.
 */

import { BLOCK } from '../world/chunk.js';

// ============================================================================
// Hardness Constants & Tables
// ============================================================================

export const HARDNESS = {
  dirt: { hand: 0.75, tool: 0.20 },
  stone: { hand: 7.50, tool: 0.60 },
  wood: { hand: 3.00, tool: 0.75 },
  netherrack: { hand: 0.60, tool: 0.15 },
  obsidian: { hand: 50.0, tool: 9.40 },
  leaves: { hand: 0.30, tool: 0.30 },
  bedrock: { hand: Infinity, tool: Infinity }
};

export const BLOCK_PROPERTIES = {
  [BLOCK.AIR]: { name: 'air', hardness: 0.0, hand: 0.0, tool: 0.0, harvestWithHand: true, dropId: 0, unbreakable: true },
  [BLOCK.STONE]: { name: 'stone', hardness: 1.5, hand: 7.50, tool: 0.60, harvestWithHand: false, dropId: BLOCK.COBBLESTONE },
  [BLOCK.GRASS]: { name: 'grass', hardness: 0.6, hand: 0.75, tool: 0.20, harvestWithHand: true, dropId: BLOCK.DIRT },
  [BLOCK.DIRT]: { name: 'dirt', hardness: 0.5, hand: 0.75, tool: 0.20, harvestWithHand: true, dropId: BLOCK.DIRT },
  [BLOCK.COBBLESTONE]: { name: 'cobblestone', hardness: 2.0, hand: 7.50, tool: 0.60, harvestWithHand: false, dropId: BLOCK.COBBLESTONE },
  [BLOCK.OAK_LOG]: { name: 'oak_log', hardness: 2.0, hand: 3.00, tool: 0.75, harvestWithHand: true, dropId: BLOCK.OAK_LOG },
  [BLOCK.OAK_LEAVES]: { name: 'oak_leaves', hardness: 0.2, hand: 0.30, tool: 0.30, harvestWithHand: true, dropId: 0 },
  [BLOCK.BEDROCK]: { name: 'bedrock', hardness: -1.0, hand: Infinity, tool: Infinity, harvestWithHand: false, dropId: 0, unbreakable: true },
  [BLOCK.WATER]: { name: 'water', hardness: 100.0, hand: Infinity, tool: Infinity, harvestWithHand: false, dropId: 0, unbreakable: true },
  [BLOCK.LAVA]: { name: 'lava', hardness: 100.0, hand: Infinity, tool: Infinity, harvestWithHand: false, dropId: 0, unbreakable: true },
  [BLOCK.SAND]: { name: 'sand', hardness: 0.5, hand: 0.75, tool: 0.15, harvestWithHand: true, dropId: BLOCK.SAND },
  [BLOCK.GRAVEL]: { name: 'gravel', hardness: 0.6, hand: 0.90, tool: 0.20, harvestWithHand: true, dropId: BLOCK.GRAVEL },
  [BLOCK.OBSIDIAN]: { name: 'obsidian', hardness: 50.0, hand: 50.0, tool: 9.40, harvestWithHand: false, dropId: BLOCK.OBSIDIAN },
  [BLOCK.NETHERRACK]: { name: 'netherrack', hardness: 0.4, hand: 0.60, tool: 0.15, harvestWithHand: true, dropId: BLOCK.NETHERRACK },
  [BLOCK.SOUL_SAND]: { name: 'soul_sand', hardness: 0.5, hand: 0.75, tool: 0.20, harvestWithHand: true, dropId: BLOCK.SOUL_SAND },
  [BLOCK.GLOWSTONE]: { name: 'glowstone', hardness: 0.3, hand: 0.45, tool: 0.45, harvestWithHand: true, dropId: BLOCK.GLOWSTONE },
  [BLOCK.NETHER_BRICK]: { name: 'nether_brick', hardness: 2.0, hand: 10.0, tool: 1.00, harvestWithHand: false, dropId: BLOCK.NETHER_BRICK },
  [BLOCK.NETHER_BRICK_FENCE]: { name: 'nether_brick_fence', hardness: 2.0, hand: 10.0, tool: 1.00, harvestWithHand: false, dropId: BLOCK.NETHER_BRICK_FENCE },
  [BLOCK.NETHER_BRICK_STAIRS]: { name: 'nether_brick_stairs', hardness: 2.0, hand: 10.0, tool: 1.00, harvestWithHand: false, dropId: BLOCK.NETHER_BRICK_STAIRS },
  [BLOCK.END_STONE]: { name: 'end_stone', hardness: 3.0, hand: 15.0, tool: 0.60, harvestWithHand: false, dropId: BLOCK.END_STONE },
  [BLOCK.CHERRY_LOG]: { name: 'cherry_log', hardness: 2.0, hand: 3.00, tool: 0.75, harvestWithHand: true, dropId: BLOCK.CHERRY_LOG },
  [BLOCK.CHERRY_LEAVES]: { name: 'cherry_leaves', hardness: 0.2, hand: 0.30, tool: 0.30, harvestWithHand: true, dropId: 0 },
  [BLOCK.PINK_PETALS]: { name: 'pink_petals', hardness: 0.0, hand: 0.05, tool: 0.05, harvestWithHand: true, dropId: BLOCK.PINK_PETALS },
  [BLOCK.NETHER_PORTAL]: { name: 'nether_portal', hardness: -1.0, hand: Infinity, tool: Infinity, harvestWithHand: false, dropId: 0, unbreakable: true },
  [BLOCK.END_PORTAL_FRAME]: { name: 'end_portal_frame', hardness: -1.0, hand: Infinity, tool: Infinity, harvestWithHand: false, dropId: 0, unbreakable: true },
  [BLOCK.END_PORTAL]: { name: 'end_portal', hardness: -1.0, hand: Infinity, tool: Infinity, harvestWithHand: false, dropId: 0, unbreakable: true },
  [BLOCK.FIRE]: { name: 'fire', hardness: 0.0, hand: 0.01, tool: 0.01, harvestWithHand: false, dropId: 0 },
  [BLOCK.TALL_GRASS]: { name: 'tall_grass', hardness: 0.0, hand: 0.05, tool: 0.05, harvestWithHand: false, dropId: 0 }
};

// ============================================================================
// Core Calculation & Anti-Clipping Functions
// ============================================================================

/**
 * Calculates deterministic damage stage (0..9) from accumulated break progress.
 * Clamps to 9 upon completion.
 */
export function calcDamageStage(accumulatedTime, totalRequiredTime) {
  if (totalRequiredTime <= 0 || accumulatedTime >= totalRequiredTime) return 9;
  return Math.min(9, Math.floor(10 * (accumulatedTime / totalRequiredTime)));
}

/**
 * Gets required break time in seconds for a given block ID and held tool.
 */
export function getBlockBreakTime(blockId, tool = null) {
  const props = BLOCK_PROPERTIES[blockId];
  if (!props || props.unbreakable) return Infinity;
  if (!tool) return props.hand;
  return props.tool !== undefined ? props.tool : props.hand;
}

/**
 * Gets dropped item ID when block is broken.
 */
export function getDropItem(blockId, tool = null) {
  const props = BLOCK_PROPERTIES[blockId];
  if (!props) return blockId;
  if (!props.harvestWithHand && !tool) return 0;
  return props.dropId !== undefined ? props.dropId : blockId;
}

/**
 * Strict anti-clipping placement check.
 * Verifies that candidate block bounding box does not overlap player AABB.
 */
export function canPlaceBlock(placePos, playerAABB) {
  if (!placePos || !playerAABB) return false;

  const bx0 = Math.floor(placePos.x !== undefined ? placePos.x : placePos[0]);
  const bx1 = bx0 + 1;
  const by0 = Math.floor(placePos.y !== undefined ? placePos.y : placePos[1]);
  const by1 = by0 + 1;
  const bz0 = Math.floor(placePos.z !== undefined ? placePos.z : placePos[2]);
  const bz1 = bz0 + 1;

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

  return !overlaps;
}

// ============================================================================
// Chunk Section Invalidation & Cross-Boundary Dirtying
// ============================================================================

/**
 * Marks primary chunk section and all neighboring chunk sections dirty
 * across X, Y, Z borders and diagonal corners for ambient occlusion re-meshing.
 */
export function markBlockAndNeighborsDirty(worldManager, x, y, z, dimension = undefined) {
  if (!worldManager || typeof worldManager.getChunk !== 'function') return;

  const dim = dimension !== undefined ? dimension : worldManager.currentDimension;
  const cx = Math.floor(x / 16);
  const cz = Math.floor(z / 16);
  const cy = Math.floor(y / 16);

  if (cy < 0 || cy >= 16) return;

  const lx = x & 15;
  const lz = z & 15;
  const secY = y & 15;

  function markSection(targetCX, targetCY, targetCZ) {
    if (targetCY < 0 || targetCY >= 16) return;
    const chunk = worldManager.getChunk(targetCX, targetCZ, dim);
    if (chunk && chunk.sections && chunk.sections[targetCY]) {
      chunk.sections[targetCY].dirty = true;
      chunk.isDirty = true;
    }
  }

  // 1. Primary sub-chunk section
  markSection(cx, cy, cz);

  // 2. Horizontal chunk boundaries
  if (lx === 0) markSection(cx - 1, cy, cz);
  if (lx === 15) markSection(cx + 1, cy, cz);
  if (lz === 0) markSection(cx, cy, cz - 1);
  if (lz === 15) markSection(cx, cy, cz + 1);

  // 3. Vertical sub-chunk boundaries
  if (secY === 0 && cy > 0) markSection(cx, cy - 1, cz);
  if (secY === 15 && cy < 15) markSection(cx, cy + 1, cz);

  // 4. Diagonal corner boundaries (for smooth AO 1-voxel neighborhood)
  if (lx === 0 && lz === 0) markSection(cx - 1, cy, cz - 1);
  if (lx === 0 && lz === 15) markSection(cx - 1, cy, cz + 1);
  if (lx === 15 && lz === 0) markSection(cx + 1, cy, cz - 1);
  if (lx === 15 && lz === 15) markSection(cx + 1, cy, cz + 1);
}

// ============================================================================
// Block Breaking State Machine Manager
// ============================================================================

export class BlockBreakingManager {
  constructor(worldManager, audio = null) {
    this.worldManager = worldManager;
    this.audio = audio;
    this.target = null;
    this.accumulatedTime = 0.0;
    this.totalRequiredTime = 0.0;
    this.currentStage = -1;
    this.lastPlaceTime = 0;
    this.placeCooldownMs = 200; // 4 ticks cooldown between placements
  }

  stopMining() {
    this.target = null;
    this.accumulatedTime = 0.0;
    this.totalRequiredTime = 0.0;
    this.currentStage = -1;
  }

  getDamageStage() {
    return this.currentStage;
  }

  isBroken() {
    return this.totalRequiredTime > 0 && this.accumulatedTime >= this.totalRequiredTime;
  }

  /**
   * Updates breaking progress when continuously targeting a block.
   * Resets when target changes, is released, or when block is broken.
   * Accepts either (dt, currentTarget, heldTool) or (dt, rayHit, heldTool).
   */
  update(dt, currentTarget, heldTool = null) {
    if (!currentTarget) {
      this.stopMining();
      return { broken: false, stage: -1, target: null };
    }

    // Handle rayHit vs blockPos object format
    let x, y, z, blockId;
    if (currentTarget.blockPos) {
      if (!currentTarget.hit) {
        this.stopMining();
        return { broken: false, stage: -1, target: null };
      }
      x = currentTarget.blockPos.x;
      y = currentTarget.blockPos.y;
      z = currentTarget.blockPos.z;
      blockId = currentTarget.blockId;
    } else {
      x = currentTarget.x;
      y = currentTarget.y;
      z = currentTarget.z;
      blockId = currentTarget.blockId !== undefined
        ? currentTarget.blockId
        : (this.worldManager && typeof this.worldManager.getBlock === 'function'
            ? this.worldManager.getBlock(x, y, z)
            : 0);
    }

    const props = BLOCK_PROPERTIES[blockId];
    if (!props || props.unbreakable || props.hand === Infinity) {
      this.stopMining();
      return { broken: false, stage: -1, target: null };
    }

    // Target change detection
    if (!this.target || this.target.x !== x || this.target.y !== y || this.target.z !== z) {
      this.target = { x, y, z, blockId };
      this.accumulatedTime = 0.0;
      this.totalRequiredTime = getBlockBreakTime(blockId, heldTool);
    }

    this.accumulatedTime += dt;
    this.currentStage = calcDamageStage(this.accumulatedTime, this.totalRequiredTime);

    if (this.accumulatedTime >= this.totalRequiredTime) {
      const dropItem = getDropItem(blockId, heldTool);
      if (this.worldManager && typeof this.worldManager.setBlock === 'function') {
        this.worldManager.setBlock(x, y, z, BLOCK.AIR);
        markBlockAndNeighborsDirty(this.worldManager, x, y, z);
      }

      if (this.audio && typeof this.audio.playSound === 'function') {
        this.audio.playSound('break_pop', { blockId });
      }

      this.stopMining();
      return {
        broken: true,
        dropItem,
        blockId,
        pos: { x, y, z },
        stage: -1,
        target: null
      };
    }

    return {
      broken: false,
      stage: this.currentStage,
      target: { x, y, z, blockId }
    };
  }

  // Alias for update to support updateMining naming
  updateMining(dt, rayHit, heldTool = null) {
    return this.update(dt, rayHit, heldTool);
  }

  /**
   * Attempts block placement against targeted face with anti-clipping check.
   */
  tryPlaceBlock(rayHit, heldItem, playerAABB, currentTimeMs = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    if (!rayHit || !rayHit.hit || !heldItem || heldItem.count <= 0) return false;
    if (currentTimeMs - this.lastPlaceTime < this.placeCooldownMs) return false;

    const placePos = rayHit.placePos;
    if (!placePos || placePos.y < 0 || placePos.y >= 256) return false;

    if (this.worldManager && typeof this.worldManager.getBlock === 'function') {
      const existingBlock = this.worldManager.getBlock(placePos.x, placePos.y, placePos.z);
      if (
        existingBlock !== BLOCK.AIR &&
        existingBlock !== BLOCK.WATER &&
        existingBlock !== BLOCK.LAVA &&
        existingBlock !== BLOCK.FIRE &&
        existingBlock !== BLOCK.TALL_GRASS &&
        existingBlock !== BLOCK.PINK_PETALS
      ) {
        return false;
      }
    }

    if (!canPlaceBlock(placePos, playerAABB)) {
      return false; // Anti-clipping rejected
    }

    if (this.worldManager && typeof this.worldManager.setBlock === 'function') {
      this.worldManager.setBlock(placePos.x, placePos.y, placePos.z, heldItem.id);
      markBlockAndNeighborsDirty(this.worldManager, placePos.x, placePos.y, placePos.z);
    }

    heldItem.count--;

    if (this.audio && typeof this.audio.playSound === 'function') {
      this.audio.playSound('place', { blockId: heldItem.id });
    }

    this.lastPlaceTime = currentTimeMs;
    return true;
  }
}

// Alias class name for flexible imports
export const BlockInteractionManager = BlockBreakingManager;

// CommonJS interoperability for Node testing environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    HARDNESS,
    BLOCK_PROPERTIES,
    calcDamageStage,
    getBlockBreakTime,
    getDropItem,
    canPlaceBlock,
    markBlockAndNeighborsDirty,
    BlockBreakingManager,
    BlockInteractionManager
  };
}
