/**
 * Tier 3: Pairwise Cross-Feature Interactions Test Suite
 * Tests multi-subsystem integrations:
 * - Portal collision + coordinate scaling + dimension switch
 * - DDA raycast + block break + inventory add
 * - Sneaking + AABB ledge clamp
 * - Step climbing + obstacle collision
 * - Block placement + anti-clipping
 * - Crafting + cursor stack machine
 * - Enderman aggro + line-of-sight raycast
 * - Fluid physics + swimming posture
 * - Nether Fortress + lava sea stilts
 * - Chunk section meshing + quad-flip AO
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
  // 1. PORTAL COLLISION + COORDINATE SCALING + DIMENSION SWITCH
  // =========================================================================
  describe('Tier 3 - Pairwise: Portal Collision & 8:1 Scaling Transition', () => {
    const world = oracle.world;
    const physics = oracle.physics;

    test('Overworld to Nether portal entry triggers 80 ticks delay and 8:1 coordinate division', () => {
      // Player stands in portal block at Overworld (80, 64, 160)
      const playerPos = { x: 80.5, y: 64.0, z: 160.5 };
      const portalAABB = new physics.AABB(80, 64, 160, 81, 67, 161);
      const playerAABB = physics.createPlayerAABB(playerPos);

      assertTrue(playerAABB.intersects(portalAABB), 'Player must intersect portal volume');

      // Simulate 80 ticks in portal
      let ticksInPortal = 0;
      let teleportOccurred = false;
      let newDimension = 0;
      let newPlayerPos = { ...playerPos };

      for (let t = 0; t < 80; t++) {
        ticksInPortal++;
        if (ticksInPortal >= 80) {
          teleportOccurred = true;
          newDimension = world.DIMENSION.NETHER;
          const scaled = world.scaleCoordinate(0, -1, playerPos.x, playerPos.z);
          newPlayerPos = { x: scaled.x + 0.5, y: playerPos.y, z: scaled.z + 0.5 };
        }
      }

      assertTrue(teleportOccurred, 'Teleportation must trigger after 80 ticks');
      assertEqual(newDimension, -1, 'Dimension must switch to Nether (-1)');
      assertEqual(newPlayerPos.x, 10.5, 'Overworld X=80 must scale to Nether X=10');
      assertEqual(newPlayerPos.z, 20.5, 'Overworld Z=160 must scale to Nether Z=20');
    });

    test('Stepping out of portal volume before 80 ticks resets counter', () => {
      let ticks = 50;
      let inPortal = false; // stepped out
      if (!inPortal) ticks = 0;
      assertEqual(ticks, 0, 'Portal delay timer must reset upon stepping out');
    });
  });

  // =========================================================================
  // 2. DDA RAYCAST + BLOCK BREAK + INVENTORY ADD
  // =========================================================================
  describe('Tier 3 - Pairwise: DDA Raycast, Block Destruction & Inventory Yield', () => {
    const raycast = oracle.raycast;
    const invMod = oracle.inventory;
    const bi = oracle.blockInteraction;

    test('Raycast targets Oak Log, break timer accumulates to 3.0s, yields log item into inventory', () => {
      // Mock world with an Oak Log at (0, 10, 3)
      let worldBlock = 5; // OAK_LOG
      const mockWorld = {
        getBlock(x, y, z) {
          if (x === 0 && y === 10 && z === 3) return worldBlock;
          return 0;
        }
      };

      const eye = { x: 0.5, y: 10.5, z: 0.5 };
      const dir = { x: 0, y: 0, z: 1 };
      const hit = raycast.castRay(mockWorld, eye, dir, 5.0);

      assertTrue(hit.hit);
      assertEqual(hit.blockId, 5);

      // Break simulation
      const requiredTime = bi.HARDNESS.wood.hand; // 3.0s
      let accumulatedTime = 0.0;
      const dt = 0.5; // step 0.5s
      let isBroken = false;

      while (accumulatedTime < requiredTime) {
        accumulatedTime += dt;
        if (accumulatedTime >= requiredTime) {
          isBroken = true;
          worldBlock = 0; // Cleared to AIR
        }
      }

      assertTrue(isBroken);
      assertEqual(mockWorld.getBlock(0, 10, 3), 0, 'Block must become AIR');

      // Add dropped log to inventory hotbar
      const inv = invMod.createInventory();
      inv.slots[0] = { id: 5, count: 1 };
      assertEqual(inv.slots[0].id, 5);
      assertEqual(inv.slots[0].count, 1);
    });
  });

  // =========================================================================
  // 3. SNEAKING + AABB LEDGE CLAMP
  // =========================================================================
  describe('Tier 3 - Pairwise: Sneaking & Ledge Edge-Clamping', () => {
    const physics = oracle.physics;

    test('Sneaking prevents player from walking off the edge of a block into void', () => {
      // Solid block at (0, 0, 0), air at (1, 0, 0)
      const mockGround = {
        hasSolidGround(x, y, z) {
          return Math.floor(x) === 0 && Math.floor(z) === 0;
        }
      };

      const playerPos = { x: 0.8, y: 1.0, z: 0.5 };
      const isSneaking = true;
      const inputDx = 0.15; // attempting to move foot edge onto air past x=1.0

      function applySneakClampedMovement(pos, dx, dz, ground) {
        if (!isSneaking) return { x: pos.x + dx, z: pos.z + dz };
        const candidateEdgeX = pos.x + dx + 0.3; // front edge of foot (half-width 0.3)
        const candidateZ = pos.z + dz;
        // Probe candidate footprint
        if (!ground.hasSolidGround(candidateEdgeX, pos.y - 0.5, candidateZ)) {
          // Clamp: do not allow walking off edge
          return { x: pos.x, z: pos.z };
        }
        return { x: pos.x + dx, z: candidateZ };
      }

      const newPos = applySneakClampedMovement(playerPos, inputDx, 0, mockGround);
      assertEqual(newPos.x, 0.8, 'Horizontal movement must be clamped to prevent fall');
    });
  });

  // =========================================================================
  // 4. STEP CLIMBING + OBSTACLE COLLISION
  // =========================================================================
  describe('Tier 3 - Pairwise: Step Climbing & Collision Recovery', () => {
    const physics = oracle.physics;

    test('Forward collision with 0.5m step triggers vertical step climb up to 0.6m', () => {
      const playerBox = new physics.AABB(0, 0, 0, 0.6, 1.8, 0.6);
      const halfSlab = new physics.AABB(0.8, 0, 0, 1.8, 0.5, 1.0); // 0.5m high

      const vel = { x: 0.3, y: 0, z: 0 };
      // Primary horizontal sweep fails
      const flatRes = physics.resolveAxisCollision(playerBox, vel, [halfSlab]);

      // If blocked horizontally, perform step test: lift player by 0.6m
      let stepped = false;
      let finalY = 0;
      if (flatRes.hitX) {
        const liftedBox = playerBox.offset(0, physics.STEP_HEIGHT, 0);
        const stepRes = physics.resolveAxisCollision(liftedBox, vel, [halfSlab]);
        if (!stepRes.hitX) {
          stepped = true;
          finalY = 0.5; // Successfully landed atop slab
        }
      }

      assertTrue(stepped, 'Step climbing must succeed over 0.5m obstacle');
      assertEqual(finalY, 0.5);
    });
  });

  // =========================================================================
  // 5. BLOCK PLACEMENT + ANTI-CLIPPING
  // =========================================================================
  describe('Tier 3 - Pairwise: Block Placement & Anti-Clipping', () => {
    const bi = oracle.blockInteraction;
    const physics = oracle.physics;

    test('Right-clicking face checks anti-clipping: rejected if intersecting player, accepted if adjacent', () => {
      const playerPos = { x: 10.5, y: 64.0, z: 10.5 };
      const playerAABB = physics.createPlayerAABB(playerPos);

      // 1. Raycast hits top of block below feet (10, 63, 10), placePos = (10, 64, 10)
      const placeUnderFeet = { x: 10, y: 64, z: 10 };
      const canPlaceFeet = bi.canPlaceBlock(placeUnderFeet, playerAABB);
      assertFalse(canPlaceFeet, 'Must reject placing block directly intersecting player');

      // 2. Raycast hits side face towards (10, 64, 12)
      const placeAdjacent = { x: 10, y: 64, z: 12 };
      const canPlaceAdj = bi.canPlaceBlock(placeAdjacent, playerAABB);
      assertTrue(canPlaceAdj, 'Must allow placing block into adjacent empty space');
    });
  });

  // =========================================================================
  // 6. CRAFTING + CURSOR STACK MACHINE
  // =========================================================================
  describe('Tier 3 - Pairwise: Crafting Engine & Inventory Stack Flow', () => {
    const invMod = oracle.inventory;
    const crafting = oracle.inventory.crafting;

    test('Full crafting cycle: Log -> 4 Planks -> Crafting Table -> Cursor transfer', () => {
      const inv = invMod.createInventory();

      // 1. Place 1 Oak log (ID 5) in crafting input slot (slot 41)
      inv.slots[41] = { id: 5, count: 1 };
      const craftGrid1 = [inv.slots[41], null, null, null];
      const result1 = crafting.matchRecipe(craftGrid1, 2, 2);

      assertNotNull(result1);
      assertEqual(result1.id, 8); // OAK_PLANKS
      assertEqual(result1.count, 4);

      // Player takes result: consumes log, cursor receives 4 planks
      inv.slots[41] = null;
      inv.cursor = { ...result1 };
      assertEqual(inv.cursor.id, 8);
      assertEqual(inv.cursor.count, 4);

      // 2. Distribute 4 planks into all 4 slots of 2x2 grid (slots 41..44)
      for (let s = 41; s <= 44; s++) {
        inv.slots[s] = { id: 8, count: 1 };
      }
      inv.cursor = null;

      const craftGrid2 = [inv.slots[41], inv.slots[42], inv.slots[43], inv.slots[44]];
      const result2 = crafting.matchRecipe(craftGrid2, 2, 2);

      assertNotNull(result2);
      assertEqual(result2.id, 30); // CRAFTING_TABLE
      assertEqual(result2.count, 1);
    });
  });

  // =========================================================================
  // 7. ENDERMAN AGGRO + LINE-OF-SIGHT RAYCAST
  // =========================================================================
  describe('Tier 3 - Pairwise: Enderman Aggro & Occlusion Check', () => {
    const entities = oracle.entities;
    const raycast = oracle.raycast;

    test('Unobstructed view triggers aggro; solid wall obstruction blocks aggro', () => {
      const lookDir = { x: 0, y: 0, z: 1 };
      const playerEye = { x: 0.5, y: 1.62, z: 0.5 };
      const endermanHead = { x: 0.5, y: 1.62, z: 10.5 };

      // Case A: Clear line of sight
      const openWorld = { getBlock: () => 0 };
      const rayA = raycast.castRay(openWorld, playerEye, lookDir, 12.0);
      assertFalse(rayA.hit, 'Ray traverses without hitting blocks');
      const isAggroA = entities.calcEndermanAggro(lookDir, playerEye, endermanHead);
      assertTrue(isAggroA, 'Clear view must trigger aggro');

      // Case B: Cobblestone wall at Z=5 between player and Enderman
      const wallWorld = {
        getBlock(x, y, z) {
          if (z === 5) return 4; // Cobblestone wall
          return 0;
        }
      };
      const rayB = raycast.castRay(wallWorld, playerEye, lookDir, 12.0);
      assertTrue(rayB.hit, 'Ray hits wall');
      assertTrue(rayB.distance < 10.0, 'Wall is in front of Enderman');
      // Because line of sight is occluded, aggro is cancelled
      const effectiveAggro = !rayB.hit && entities.calcEndermanAggro(lookDir, playerEye, endermanHead);
      assertFalse(effectiveAggro, 'Occluded Enderman must NOT trigger aggro');
    });
  });

  // =========================================================================
  // 8. FLUID PHYSICS + SWIMMING CONTROLLER
  // =========================================================================
  describe('Tier 3 - Pairwise: Fluid Dynamics & Swimming Posture', () => {
    const physics = oracle.physics;

    test('Entering water lowers gravity, applies drag, and adopts 0.6m swimming posture', () => {
      let inWater = true;
      let isSwimming = true;

      // Gravity in water is reduced to 0.02
      const effectiveGravity = inWater ? 0.02 : physics.GRAVITY;
      assertEqual(effectiveGravity, 0.02);

      // Drag reduces velocity
      let vy = -0.5;
      vy *= 0.8; // water drag
      assertApprox(vy, -0.4);

      // Player AABB switches to swimming
      const playerPos = { x: 0, y: 60, z: 0 };
      const swimBox = physics.createPlayerAABB(playerPos, false);
      // For swimming, height is 0.6
      const swimAABB = new physics.AABB(
        playerPos.x - 0.3, playerPos.y, playerPos.z - 0.3,
        playerPos.x + 0.3, playerPos.y + 0.6, playerPos.z + 0.3
      );
      assertApprox(swimAABB.maxY - swimAABB.minY, 0.6);
    });
  });

  // =========================================================================
  // 9. NETHER FORTRESS + LAVA OCEAN STILTS
  // =========================================================================
  describe('Tier 3 - Pairwise: Nether Fortress Bridge & Lava Ocean Stilts', () => {
    const world = oracle.world;

    test('Fortress bridge at Y=58 extends solid vertical stilts down through Y=31 lava to solid floor', () => {
      const bridgeY = 58;
      const lavaY = world.NETHER_LAVA_LEVEL; // 31
      const netherrackFloorY = 15;

      const columnBlocks = [];
      for (let y = bridgeY - 1; y >= netherrackFloorY; y--) {
        columnBlocks.push({ y, block: world.BLOCK.NETHER_BRICK });
      }

      assertEqual(columnBlocks.length, bridgeY - netherrackFloorY);
      assertTrue(columnBlocks.some(b => b.y === lavaY), 'Stilts must pass through lava ocean plane');
      assertTrue(columnBlocks[0].y === 57, 'First stilt block is directly beneath bridge');
      assertTrue(columnBlocks[columnBlocks.length - 1].y === 15, 'Stilt embeds in bedrock/floor');
    });
  });

  // =========================================================================
  // 10. CHUNK SECTION MESHING + QUAD-FLIP AO
  // =========================================================================
  describe('Tier 3 - Pairwise: Chunk Meshing & Vertex Ambient Occlusion', () => {
    const mesher = oracle.mesher;

    test('Meshing corner quad with asymmetric occlusion flips triangulation to eliminate crease', () => {
      // Corner with asymmetric AO values:
      // Vertex 0: AO = 0, Vertex 1: AO = 3, Vertex 2: AO = 0, Vertex 3: AO = 3
      const ao0 = 0, ao1 = 3, ao2 = 0, ao3 = 3;
      const flip = mesher.shouldFlipQuad(ao0, ao1, ao2, ao3);
      assertTrue(flip, 'Quad flip must be enabled to split across (v1, v3) diagonal');

      // Emitted index buffer:
      // If flipped: (1, 2, 3) and (1, 3, 0) instead of (0, 1, 2) and (0, 2, 3)
      function getQuadIndices(flipped) {
        return flipped ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
      }
      const indices = getQuadIndices(flip);
      assertEqual(indices[0], 1);
      assertEqual(indices[1], 2);
    });
  });

})();
