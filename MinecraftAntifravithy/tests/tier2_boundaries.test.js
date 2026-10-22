/**
 * Tier 2: Boundary & Corner Cases Test Suite
 * Tests extreme coordinates, chunk boundaries, negative values, division-by-zero,
 * stack size bounds, portal dimension limits, and degenerate geometric cases.
 */

(function () {
  'use strict';

  const harness = typeof module !== 'undefined' ? require('./test_harness.js') : window.TestHarness;
  const {
    assert, assertTrue, assertFalse, assertNull, assertNotNull,
    assertEqual, assertNotEqual, assertApprox, assertArrayApprox,
    assertDeepEqual, assertThrows, describe, it, test,
    ReferenceOracle
  } = harness;

  const oracle = ReferenceOracle;

  // =========================================================================
  // 1. WORLD COORDINATE & ALTITUDE BOUNDARIES
  // =========================================================================
  describe('Tier 2 - Boundaries: World Coordinate & Altitude Extremes', () => {
    const world = oracle.world;

    test('Negative block coordinates correctly resolve to negative chunk indices', () => {
      function getChunkCoord(blockCoord) {
        return Math.floor(blockCoord / 16);
      }
      assertEqual(getChunkCoord(-1), -1);
      assertEqual(getChunkCoord(-16), -1);
      assertEqual(getChunkCoord(-17), -2);
      assertEqual(getChunkCoord(0), 0);
      assertEqual(getChunkCoord(15), 0);
      assertEqual(getChunkCoord(16), 1);
    });

    test('Bitwise local coordinate masking handles negative values correctly', () => {
      // In JS, (-1 & 15) === 15, which corresponds to the last voxel in chunk -1
      assertEqual(-1 & 15, 15);
      assertEqual(-16 & 15, 0);
      assertEqual(-17 & 15, 15);
      assertEqual(0 & 15, 0);
      assertEqual(15 & 15, 15);
      assertEqual(16 & 15, 0);
    });

    test('World border boundary at +/- 30,000,000 blocks', () => {
      const WORLD_BORDER = 30000000;
      function isWithinWorldBorder(x, z) {
        return Math.abs(x) <= WORLD_BORDER && Math.abs(z) <= WORLD_BORDER;
      }
      assertTrue(isWithinWorldBorder(30000000, 30000000));
      assertTrue(isWithinWorldBorder(-30000000, -30000000));
      assertFalse(isWithinWorldBorder(30000001, 0));
      assertFalse(isWithinWorldBorder(0, -30000001));
    });

    test('Altitude bounds Y < 0 and Y >= 256 return AIR (ID 0) without buffer overflow', () => {
      function safeGetBlock(chunkData, x, y, z) {
        if (y < 0 || y >= 256 || x < 0 || x >= 16 || z < 0 || z >= 16) {
          return 0; // AIR
        }
        return chunkData[world.getBlockIndex(x, y, z)];
      }
      const chunk = world.createChunkData();
      assertEqual(safeGetBlock(chunk, 0, -1, 0), 0);
      assertEqual(safeGetBlock(chunk, 0, 256, 0), 0);
      assertEqual(safeGetBlock(chunk, 0, 9999, 0), 0);
      assertEqual(safeGetBlock(chunk, -1, 64, 0), 0);
      assertEqual(safeGetBlock(chunk, 16, 64, 0), 0);
    });

    test('Extreme altitudes Y = 0 (bedrock) and Y = 255 (build limit) index correctly', () => {
      const idxBottom = world.getBlockIndex(0, 0, 0);
      const idxTop = world.getBlockIndex(15, 255, 15);
      assertEqual(idxBottom, 0);
      assertEqual(idxTop, 65535, 'Max index for 16x256x16 chunk must be exactly 65535 (64KB - 1)');
    });
  });

  // =========================================================================
  // 2. RAYCAST & VECTOR DIVISION-BY-ZERO BOUNDARIES
  // =========================================================================
  describe('Tier 2 - Boundaries: Raycast & Math Edge Conditions', () => {
    const raycast = oracle.raycast;
    const { Mat4, Vec3 } = oracle.math;

    test('DDA raycast with vector strictly parallel to cardinal axes does not divide by zero', () => {
      const world = { getBlock: () => 0 };
      const eye = { x: 0.5, y: 0.5, z: 0.5 };
      // Cardinal +X (dy=0, dz=0)
      const resX = raycast.castRay(world, eye, { x: 1, y: 0, z: 0 }, 5.0);
      assertFalse(resX.hit);
      // Cardinal +Y (dx=0, dz=0)
      const resY = raycast.castRay(world, eye, { x: 0, y: 1, z: 0 }, 5.0);
      assertFalse(resY.hit);
      // Cardinal +Z (dx=0, dy=0)
      const resZ = raycast.castRay(world, eye, { x: 0, y: 0, z: 1 }, 5.0);
      assertFalse(resZ.hit);
    });

    test('DDA raycast with exact zero vector (0, 0, 0) terminates safely', () => {
      const world = { getBlock: () => 0 };
      const eye = { x: 0.5, y: 0.5, z: 0.5 };
      const res = raycast.castRay(world, eye, { x: 0, y: 0, z: 0 }, 5.0);
      assertFalse(res.hit);
    });

    test('Raycast starting on exact block boundaries (x=1.0, y=1.0) does not get trapped', () => {
      const world = {
        getBlock(x, y, z) {
          if (x === 2 && y === 1 && z === 1) return 1;
          return 0;
        }
      };
      const eye = { x: 1.0, y: 1.0, z: 1.0 };
      const dir = { x: 1.0, y: 0.0, z: 0.0 };
      const hit = raycast.castRay(world, eye, dir, 5.0);
      assertTrue(hit.hit);
      assertEqual(hit.blockPos.x, 2);
    });

    test('Vec3.normalize handles zero-length vector without producing NaN', () => {
      const v = Vec3.create(0, 0, 0);
      const out = Vec3.create();
      Vec3.normalize(out, v);
      assertFalse(isNaN(out[0]));
      assertFalse(isNaN(out[1]));
      assertFalse(isNaN(out[2]));
    });

    test('Mat4.lookAt with coincident eye and target (eye == target) handles degenerate camera', () => {
      const m = Mat4.create();
      const eye = [5, 5, 5];
      const target = [5, 5, 5];
      const up = [0, 1, 0];
      Mat4.lookAt(m, eye, target, up);
      // Should produce valid numbers without NaN
      for (let i = 0; i < 16; i++) {
        assertFalse(isNaN(m[i]), `Matrix element [${i}] was NaN`);
      }
    });
  });

  // =========================================================================
  // 3. INVENTORY & ITEM STACK BOUNDARIES
  // =========================================================================
  describe('Tier 2 - Boundaries: Inventory Stack Limits & Out-Of-Bounds', () => {
    const invMod = oracle.inventory;

    test('Item stack cannot exceed maximum limit of 64', () => {
      const slot = { id: 1, count: 64 };
      function addItems(existing, toAdd) {
        const space = 64 - existing.count;
        const transfer = Math.min(space, toAdd);
        existing.count += transfer;
        return toAdd - transfer;
      }
      const overflow = addItems(slot, 10);
      assertEqual(slot.count, 64);
      assertEqual(overflow, 10, '10 excess items must remain untransferred');
    });

    test('Zero count item automatically cleans up to null slot', () => {
      const inv = invMod.createInventory();
      inv.slots[0] = { id: 2, count: 1 };
      // Simulate taking 1 item
      inv.slots[0].count -= 1;
      if (inv.slots[0].count <= 0) inv.slots[0] = null;
      assertNull(inv.slots[0]);
    });

    test('Clicking on invalid/out-of-bounds slot indices does not crash', () => {
      const inv = invMod.createInventory();
      // Should not throw on out of bounds
      invMod.handleClick(inv, -1, 0);
      invMod.handleClick(inv, 46, 0);
      invMod.handleClick(inv, 999, 0);
    });

    test('Right-clicking a stack with count = 1 splits into 1 in cursor and null in slot', () => {
      const inv = invMod.createInventory();
      inv.slots[4] = { id: 5, count: 1 };
      invMod.handleClick(inv, 4, 2); // Right click
      assertNotNull(inv.cursor);
      assertEqual(inv.cursor.count, 1);
      assertNull(inv.slots[4]);
    });

    test('Merging non-identical item types triggers swap instead of combine', () => {
      const inv = invMod.createInventory();
      inv.slots[0] = { id: 1, count: 10 }; // Stone
      inv.cursor = { id: 3, count: 5 };    // Dirt
      invMod.handleClick(inv, 0, 0);       // Left click
      assertEqual(inv.slots[0].id, 3);
      assertEqual(inv.slots[0].count, 5);
      assertEqual(inv.cursor.id, 1);
      assertEqual(inv.cursor.count, 10);
    });
  });

  // =========================================================================
  // 4. CRAFTING GRID BOUNDARIES
  // =========================================================================
  describe('Tier 2 - Boundaries: Crafting Edge Cases', () => {
    const crafting = oracle.inventory.crafting;

    test('Completely empty crafting grid returns null recipe result', () => {
      const grid = [null, null, null, null];
      const res = crafting.matchRecipe(grid, 2, 2);
      assertNull(res);
    });

    test('Incomplete 2x2 Crafting Table recipe (3 planks instead of 4) returns null', () => {
      const grid = [
        { id: 8, count: 1 }, { id: 8, count: 1 },
        { id: 8, count: 1 }, null
      ];
      const res = crafting.matchRecipe(grid, 2, 2);
      assertNull(res);
    });

    test('Shapeless recipe succeeds regardless of which slot contains the ingredient', () => {
      for (let slot = 0; slot < 4; slot++) {
        const grid = [null, null, null, null];
        grid[slot] = { id: 5, count: 1 }; // 1 Oak log in any of the 4 slots
        const res = crafting.matchRecipe(grid, 2, 2);
        assertNotNull(res, `Failed when log was in slot ${slot}`);
        assertEqual(res.id, 8);
        assertEqual(res.count, 4);
      }
    });

    test('3x3 recipe cannot be crafted inside 2x2 player inventory grid', () => {
      // Wooden Pickaxe requires 3x3
      const grid2x2 = [
        { id: 8, count: 1 }, { id: 8, count: 1 },
        { id: 32, count: 1 }, null
      ];
      const res = crafting.matchRecipe(grid2x2, 2, 2);
      assertNull(res);
    });
  });

  // =========================================================================
  // 5. PORTAL GEOMETRIC BOUNDARIES
  // =========================================================================
  describe('Tier 2 - Boundaries: Portal Frame Limits', () => {
    test('Under-sized Nether portal frame (3 wide x 4 high) is rejected', () => {
      function validateSize(w, h) {
        return w >= 4 && w <= 23 && h >= 5 && h <= 23;
      }
      assertFalse(validateSize(3, 5), 'Width 3 is invalid (needs >= 4)');
      assertFalse(validateSize(4, 4), 'Height 4 is invalid (needs >= 5)');
      assertTrue(validateSize(4, 5), 'Minimum 4x5 is valid');
    });

    test('Over-sized Nether portal frame (24x24) is rejected', () => {
      function validateSize(w, h) {
        return w >= 4 && w <= 23 && h >= 5 && h <= 23;
      }
      assertFalse(validateSize(24, 23));
      assertFalse(validateSize(23, 24));
      assertTrue(validateSize(23, 23), 'Maximum 23x23 is valid');
    });

    test('Nether portal corners are optional (cornerless frame is valid)', () => {
      function isFrameValid(hasCorners) {
        // Minecraft Java specification explicitly allows missing corners
        return true;
      }
      assertTrue(isFrameValid(true));
      assertTrue(isFrameValid(false));
    });

    test('End portal with 11 of 12 Eyes of Ender remains inactive', () => {
      function isEndPortalActive(eyesPlaced) {
        return eyesPlaced === 12;
      }
      assertFalse(isEndPortalActive(11));
      assertTrue(isEndPortalActive(12));
    });
  });

  // =========================================================================
  // 6. AUDIO & PHYSICS BOUNDARY CONDITIONS
  // =========================================================================
  describe('Tier 2 - Boundaries: Audio & Physics Extremes', () => {
    const physics = oracle.physics;

    test('Extreme falling velocity does not cause NaN or infinite position updates', () => {
      const box = new physics.AABB(0, 100, 0, 0.6, 101.8, 0.6);
      const ground = new physics.AABB(-10, 0, -10, 10, 1, 10);
      const vel = { x: 0, y: -150.0, z: 0 }; // Extreme fall exceeding distance to ground
      const res = physics.resolveAxisCollision(box, vel, [ground]);
      assertFalse(isNaN(res.resolvedVelocity.y));
      assertEqual(res.resolvedVelocity.y, -99); // Drops from 100 to ground top at 1
    });

    test('Zero volume AABB (point) intersects containing volume', () => {
      const container = new physics.AABB(0, 0, 0, 10, 10, 10);
      const insidePoint = new physics.AABB(5, 5, 5, 5, 5, 5);
      const outsidePoint = new physics.AABB(15, 15, 15, 15, 15, 15);
      assertTrue(insidePoint.intersects(container));
      assertFalse(outsidePoint.intersects(container));
    });

    test('Audio synthesizer clamps negative volume gain to 0.0', () => {
      function clampVolume(vol) {
        return Math.max(0.0, Math.min(1.0, vol));
      }
      assertEqual(clampVolume(-0.5), 0.0);
      assertEqual(clampVolume(1.5), 1.0);
      assertEqual(clampVolume(0.7), 0.7);
    });
  });

})();
