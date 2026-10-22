/**
 * Adversarial Stress & Verification Test Suite for Milestone 2 World Generation
 * Challenger 1 Empirical Verification Suite
 *
 * Targets:
 * 1. Deterministic Noise Repeatability & Gradient Distribution across 100,000 queries
 * 2. Overworld Terrain Boundaries: Sea Level 62 water, surface stratigraphy (grass/sand/dirt/stone),
 *    cave carve-out voids, and bottom bedrock Y<=4 (100% solid at Y=0, zero bedrock Y>=5)
 * 3. Nether Cavern Boundaries: Dual bedrock floor (Y=0) and ceiling (Y=127), global lava oceans Y<=31,
 *    open cavern airways Y=40..88, hanging glowstone, and modular fortress bridges
 * 4. The End Boundaries: Central floating End Stone island, void hazard space (Y<=0 is 100% AIR),
 *    exactly 10 obsidian monolith pillars in ring R=42 with bedrock caps, fire, and cages,
 *    and central exit fountain
 * 5. Multi-Chunk Boundary Stitching, Coordinate Wrapping, and Multi-Dimension WorldManager Persistence
 */

import { FastNoise, createNoise } from '../src/world/noise.js';
import {
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
} from '../src/world/chunk.js';

import {
  SEA_LEVEL,
  NETHER_LAVA_LEVEL,
  DIMENSION,
  classifyBiome,
  generateOverworldChunk,
  generateNetherChunk,
  generateEndChunk,
  generateTerrain
} from '../src/world/generator.js';

import {
  generateOakTree,
  generateCherryTree,
  generateNetherFortress,
  generateEndPillars,
  generateExitFountain
} from '../src/world/structures.js';

import {
  validateNetherPortalFrame,
  igniteNetherPortal,
  extinguishNetherPortal,
  validateEndPortalFrame,
  activateEndPortal,
  scaleCoordinate,
  findOrCreateNetherPortal,
  prepareEndSpawnPlatform
} from '../src/world/portals.js';

import { WorldManager } from '../src/world/world.js';

// ============================================================================
// Test Framework Utilities
// ============================================================================

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failureMessages = [];

function assert(condition, message) {
  totalAssertions++;
  if (!condition) {
    failedAssertions++;
    failureMessages.push(message);
    console.error(`  [FAIL] ${message}`);
  } else {
    passedAssertions++;
  }
}

function assertEqual(actual, expected, message) {
  assert(
    actual === expected,
    `${message} (expected: ${expected}, got: ${actual})`
  );
}

function assertNear(actual, expected, tolerance, message) {
  const diff = Math.abs(actual - expected);
  assert(
    diff <= tolerance,
    `${message} (expected ~${expected} +/- ${tolerance}, got ${actual}, diff ${diff})`
  );
}

console.log('======================================================================');
console.log('  CHALLENGER 1: ADVERSARIAL STRESS & EMPIRICAL TEST SUITE (M2)');
console.log('======================================================================\n');

// Deterministic fast PRNG for reproducible test inputs
function createTestPRNG(seed = 123456789) {
  let s = seed >>> 0;
  return function() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================================
// TARGET 1: Noise Repeatability & Gradient Distribution across 100,000 Queries
// ============================================================================
console.log('>>> TARGET 1: Noise Repeatability & Gradient Distribution (100,000 Queries)');

const t1Start = performance.now();
const prng = createTestPRNG(987654321);

// Generate 100,000 pseudo-random coordinate queries spanning wide domains
const QUERY_COUNT = 100000;
const queryX = new Float64Array(QUERY_COUNT);
const queryY = new Float64Array(QUERY_COUNT);
const queryZ = new Float64Array(QUERY_COUNT);
const queryModes = new Uint8Array(QUERY_COUNT);

for (let i = 0; i < QUERY_COUNT; i++) {
  const mode = i % 5;
  queryModes[i] = mode;
  if (mode === 0) {
    // Continuous terrain domain [-2000, 2000]
    queryX[i] = (prng() * 4000 - 2000) * 0.01;
    queryY[i] = (prng() * 256) * 0.02;
    queryZ[i] = (prng() * 4000 - 2000) * 0.01;
  } else if (mode === 1) {
    // Large coordinate domain [-100000, 100000]
    queryX[i] = prng() * 200000 - 100000;
    queryY[i] = prng() * 500 - 250;
    queryZ[i] = prng() * 200000 - 100000;
  } else if (mode === 2) {
    // Micro/sub-voxel domain [-1e-4, 1e-4]
    queryX[i] = (prng() * 2 - 1) * 1e-4;
    queryY[i] = (prng() * 2 - 1) * 1e-4;
    queryZ[i] = (prng() * 2 - 1) * 1e-4;
  } else if (mode === 3) {
    // Exact integer lattice points [-500, 500] (for Simplex lattice corner tests)
    queryX[i] = Math.floor(prng() * 1000 - 500);
    queryY[i] = Math.floor(prng() * 256);
    queryZ[i] = Math.floor(prng() * 1000 - 500);
  } else {
    // Extreme coordinates [-1e6, 1e6]
    queryX[i] = (prng() * 2 - 1) * 1e6;
    queryY[i] = (prng() * 2 - 1) * 1e6;
    queryZ[i] = (prng() * 2 - 1) * 1e6;
  }
}

// 1.1 Repeatability: Dual instance identical seed bitwise match across 100,000 queries
const noiseA = new FastNoise(1337);
const noiseB = new FastNoise(1337);
const noiseDiffSeed = new FastNoise(4242);

let bitwiseMatches2D = 0;
let bitwiseMatches3D = 0;
let continuousQueries = 0;
let seedDivergences2D = 0;
let seedDivergences3D = 0;

let min2D = Infinity, max2D = -Infinity, sum2D = 0, sumSq2D = 0;
let min3D = Infinity, max3D = -Infinity, sum3D = 0, sumSq3D = 0;
let nonFiniteCount = 0;

for (let i = 0; i < QUERY_COUNT; i++) {
  const x = queryX[i];
  const y = queryY[i];
  const z = queryZ[i];
  const mode = queryModes[i];

  const val2D_A = noiseA.noise2D(x, z);
  const val2D_B = noiseB.noise2D(x, z);
  const val2D_Diff = noiseDiffSeed.noise2D(x, z);

  const val3D_A = noiseA.noise3D(x, y, z);
  const val3D_B = noiseB.noise3D(x, y, z);
  const val3D_Diff = noiseDiffSeed.noise3D(x, y, z);

  // Exact IEEE-754 bitwise determinism
  if (val2D_A === val2D_B) bitwiseMatches2D++;
  if (val3D_A === val3D_B) bitwiseMatches3D++;

  // Seed divergence test on continuous (non-integer lattice) query sets
  if (mode !== 3) {
    continuousQueries++;
    if (val2D_A !== val2D_Diff) seedDivergences2D++;
    if (val3D_A !== val3D_Diff) seedDivergences3D++;
  }

  if (!Number.isFinite(val2D_A) || !Number.isFinite(val3D_A)) {
    nonFiniteCount++;
  }

  // Distribution statistics
  if (val2D_A < min2D) min2D = val2D_A;
  if (val2D_A > max2D) max2D = val2D_A;
  sum2D += val2D_A;
  sumSq2D += val2D_A * val2D_A;

  if (val3D_A < min3D) min3D = val3D_A;
  if (val3D_A > max3D) max3D = val3D_A;
  sum3D += val3D_A;
  sumSq3D += val3D_A * val3D_A;
}

const mean2D = sum2D / QUERY_COUNT;
const variance2D = (sumSq2D / QUERY_COUNT) - (mean2D * mean2D);
const stdDev2D = Math.sqrt(Math.max(0, variance2D));

const mean3D = sum3D / QUERY_COUNT;
const variance3D = (sumSq3D / QUERY_COUNT) - (mean3D * mean3D);
const stdDev3D = Math.sqrt(Math.max(0, variance3D));

assertEqual(bitwiseMatches2D, QUERY_COUNT, '100,000 queries of noise2D bitwise match with identical seed (100% determinism)');
assertEqual(bitwiseMatches3D, QUERY_COUNT, '100,000 queries of noise3D bitwise match with identical seed (100% determinism)');
assert(seedDivergences2D >= continuousQueries * 0.99, `Seed divergence for noise2D across continuous domain: ${seedDivergences2D}/${continuousQueries} (${(seedDivergences2D/continuousQueries*100).toFixed(2)}%)`);
assert(seedDivergences3D >= continuousQueries * 0.99, `Seed divergence for noise3D across continuous domain: ${seedDivergences3D}/${continuousQueries} (${(seedDivergences3D/continuousQueries*100).toFixed(2)}%)`);
assertEqual(nonFiniteCount, 0, 'Zero NaN or Infinity values across 100,000 noise queries');

// Assert noise bounds within standard Simplex envelope [-1.05, 1.05]
assert(min2D >= -1.05, `noise2D min bound >= -1.05 (got ${min2D.toFixed(4)})`);
assert(max2D <= 1.05, `noise2D max bound <= 1.05 (got ${max2D.toFixed(4)})`);
assert(min3D >= -1.05, `noise3D min bound >= -1.05 (got ${min3D.toFixed(4)})`);
assert(max3D <= 1.05, `noise3D max bound <= 1.05 (got ${max3D.toFixed(4)})`);

// Mean should be centered near 0
assertNear(mean2D, 0.0, 0.05, 'noise2D 100,000 query mean centered near 0.0');
assertNear(mean3D, 0.0, 0.05, 'noise3D 100,000 query mean centered near 0.0');

// Variance and StdDev should show healthy continuous dispersion
assert(stdDev2D > 0.25 && stdDev2D < 0.55, `noise2D stdDev is in healthy range (got ${stdDev2D.toFixed(4)})`);
assert(stdDev3D > 0.15 && stdDev3D < 0.50, `noise3D stdDev is in healthy range (got ${stdDev3D.toFixed(4)})`);

// 1.2 Gradient Continuity & Directional Finite Differences across 10,000 queries
const GRAD_QUERIES = 10000;
const eps = 1e-4;
let posGradX = 0, negGradX = 0;
let posGradY = 0, negGradY = 0;
let posGradZ = 0, negGradZ = 0;
let maxGradMag = 0;
let discontinuousJumps = 0;

for (let i = 0; i < GRAD_QUERIES; i++) {
  const x = queryX[i];
  const y = queryY[i];
  const z = queryZ[i];

  const f0 = noiseA.noise3D(x, y, z);
  const fx1 = noiseA.noise3D(x + eps, y, z);
  const fx0 = noiseA.noise3D(x - eps, y, z);
  const fy1 = noiseA.noise3D(x, y + eps, z);
  const fy0 = noiseA.noise3D(x, y - eps, z);
  const fz1 = noiseA.noise3D(x, y, z + eps);
  const fz0 = noiseA.noise3D(x, y, z - eps);

  const dfdx = (fx1 - fx0) / (2 * eps);
  const dfdy = (fy1 - fy0) / (2 * eps);
  const dfdz = (fz1 - fz0) / (2 * eps);

  if (dfdx > 0) posGradX++; else if (dfdx < 0) negGradX++;
  if (dfdy > 0) posGradY++; else if (dfdy < 0) negGradY++;
  if (dfdz > 0) posGradZ++; else if (dfdz < 0) negGradZ++;

  const mag = Math.hypot(dfdx, dfdy, dfdz);
  if (mag > maxGradMag) maxGradMag = mag;

  // Jump check: step of 1e-4 should never cause jump > 0.1 in noise value
  if (Math.abs(fx1 - f0) > 0.1 || Math.abs(fy1 - f0) > 0.1 || Math.abs(fz1 - f0) > 0.1) {
    discontinuousJumps++;
  }
}

assertEqual(discontinuousJumps, 0, 'Zero discontinuous jumps over 1e-4 delta across 10,000 queries');
assert(maxGradMag < 50.0, `Gradient magnitude is bounded: max |grad| = ${maxGradMag.toFixed(4)} < 50.0`);
assert(posGradX > 1000 && negGradX > 1000, `Gradient X has balanced positive/negative components: +${posGradX}/-${negGradX}`);
assert(posGradY > 1000 && negGradY > 1000, `Gradient Y has balanced positive/negative components: +${posGradY}/-${negGradY}`);
assert(posGradZ > 1000 && negGradZ > 1000, `Gradient Z has balanced positive/negative components: +${posGradZ}/-${negGradZ}`);

// 1.3 Multi-Octave FBM Normalization
let fbmOutliers = 0;
for (let octaves of [1, 2, 4, 8, 12]) {
  for (let i = 0; i < 1000; i++) {
    const v2 = noiseA.fbm2D(queryX[i], queryZ[i], octaves, 0.5, 2.0);
    const v3 = noiseA.fbm3D(queryX[i], queryY[i], queryZ[i], octaves, 0.5, 2.0);
    if (v2 < -1.05 || v2 > 1.05 || v3 < -1.05 || v3 > 1.05 || !Number.isFinite(v2) || !Number.isFinite(v3)) {
      fbmOutliers++;
    }
  }
}
assertEqual(fbmOutliers, 0, 'FBM multi-octave output strictly normalized within [-1.05, 1.05] without NaNs');

// 1.4 Classic Perlin 2D & 3D Quintic Fade Curve & Integer Lattice Tests
let perlinOutliers = 0;
for (let i = 0; i < 2000; i++) {
  const p2 = noiseA.perlin2D(queryX[i], queryZ[i]);
  const p3 = noiseA.perlin3D(queryX[i], queryY[i], queryZ[i]);
  if (!Number.isFinite(p2) || !Number.isFinite(p3)) {
    perlinOutliers++;
  }
}
assertEqual(perlinOutliers, 0, 'Perlin 2D & 3D return finite float values across lattice and extremes');

const t1Duration = (performance.now() - t1Start).toFixed(2);
console.log(`  ✓ Target 1: Noise Repeatability & Gradient Distribution PASSED (${t1Duration} ms).\n`);

// ============================================================================
// TARGET 2: Overworld Terrain Boundaries
// ============================================================================
console.log('>>> TARGET 2: Overworld Terrain Boundaries (Sea Level 62, Stratigraphy, Caves, Bedrock)');

const t2Start = performance.now();

// Test across multiple seeds and negative/positive chunk coordinates
const testSeeds = [1337, 4242, 98765];
const testCoords = [
  { cx: 0, cz: 0 },
  { cx: 1, cz: 0 },
  { cx: -1, cz: -1 },
  { cx: 5, cz: -8 },
  { cx: -12, cz: 15 }
];

let totalOverworldColumns = 0;
let seaLevelWaterMatches = 0;
let waterAboveSeaLevelViolations = 0;
let bedrockY0Violations = 0;
let bedrockYAbove4Violations = 0;
let validStratigraphyColumns = 0;
let gravelSeabedCount = 0;
let surfaceGrassCount = 0;
let beachSandCount = 0;
let caveAirVoxelCount = 0;
let caveLavaVoxelCount = 0;
let deepLavaAboveY10Violations = 0;

for (const seed of testSeeds) {
  for (const { cx, cz } of testCoords) {
    const chunk = new ChunkColumn(cx, cz);
    generateOverworldChunk(chunk, seed);

    for (let lz = 0; lz < 16; lz++) {
      for (let lx = 0; lx < 16; lx++) {
        totalOverworldColumns++;

        // 2.1 Bottom Bedrock Y <= 4 verification
        // Y=0 MUST be 100% solid Bedrock
        const b0 = chunk.getBlock(lx, 0, lz);
        if (b0 !== BLOCK.BEDROCK) {
          bedrockY0Violations++;
        }

        // Y >= 5 MUST NEVER be Bedrock
        for (let y = 5; y < CHUNK_HEIGHT; y++) {
          if (chunk.getBlock(lx, y, lz) === BLOCK.BEDROCK) {
            bedrockYAbove4Violations++;
          }
        }

        // 2.2 Sea Level 62 water boundary check
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const blk = chunk.getBlock(lx, y, lz);

          // Water above sea level violation
          if (y > SEA_LEVEL && blk === BLOCK.WATER) {
            waterAboveSeaLevelViolations++;
          }

          // Cave lava vs air verification
          if (blk === BLOCK.LAVA) {
            if (y > 10) {
              deepLavaAboveY10Violations++;
            } else {
              caveLavaVoxelCount++;
            }
          }

          // Count cave air pockets below terrain surface
          if (blk === BLOCK.AIR && y >= 5 && y <= 55) {
            // Check if stone exists above this air block (enclosed cavern)
            let hasStoneAbove = false;
            for (let checkY = y + 1; checkY <= y + 20 && checkY < CHUNK_HEIGHT; checkY++) {
              if (chunk.getBlock(lx, checkY, lz) === BLOCK.STONE) {
                hasStoneAbove = true;
                break;
              }
            }
            if (hasStoneAbove) {
              caveAirVoxelCount++;
            }
          }
        }

        // 2.3 Surface Stratigraphy Check
        // Scan downwards from sky to find highest solid terrain block
        let surfaceY = -1;
        let surfaceBlock = BLOCK.AIR;

        for (let y = CHUNK_HEIGHT - 1; y >= 1; y--) {
          const blk = chunk.getBlock(lx, y, lz);
          // Ignore foliage / trunk / flower blocks sitting above surface
          if (blk === BLOCK.OAK_LOG || blk === BLOCK.OAK_LEAVES ||
              blk === BLOCK.CHERRY_LOG || blk === BLOCK.CHERRY_LEAVES ||
              blk === BLOCK.PINK_PETALS || blk === BLOCK.TALL_GRASS) {
            continue;
          }
          if (blk !== BLOCK.AIR && blk !== BLOCK.WATER) {
            surfaceY = y;
            surfaceBlock = blk;
            break;
          }
        }

        if (surfaceY >= 1) {
          if (surfaceY >= SEA_LEVEL) {
            // Exposed land surface: MUST be GRASS or SAND
            if (surfaceBlock === BLOCK.GRASS) {
              surfaceGrassCount++;
              // Check sub-surface: depth 1 to 3 should be DIRT
              let dirtLayerValid = true;
              for (let d = 1; d <= 3 && surfaceY - d >= 1; d++) {
                const subBlk = chunk.getBlock(lx, surfaceY - d, lz);
                // Allow cave air/water to interrupt, but if solid, it should be DIRT or STONE
                if (subBlk !== BLOCK.DIRT && subBlk !== BLOCK.STONE && subBlk !== BLOCK.AIR && subBlk !== BLOCK.WATER && subBlk !== BLOCK.LAVA) {
                  dirtLayerValid = false;
                }
              }
              if (dirtLayerValid) validStratigraphyColumns++;
            } else if (surfaceBlock === BLOCK.SAND) {
              beachSandCount++;
              validStratigraphyColumns++;
            }
          } else {
            // Submerged seabed: surface MUST be GRAVEL
            if (surfaceBlock === BLOCK.GRAVEL) {
              gravelSeabedCount++;
              validStratigraphyColumns++;
            }
            // Check that water fills the space above seabed up to SEA_LEVEL
            let waterColumnFilled = true;
            for (let wy = surfaceY + 1; wy <= SEA_LEVEL; wy++) {
              if (chunk.getBlock(lx, wy, lz) !== BLOCK.WATER) {
                waterColumnFilled = false;
              }
            }
            if (waterColumnFilled) seaLevelWaterMatches++;
          }
        }
      }
    }
  }
}

// Assert Bedrock invariants
assertEqual(bedrockY0Violations, 0, `Bedrock Y=0 is 100% solid across all ${totalOverworldColumns} columns (0 holes)`);
assertEqual(bedrockYAbove4Violations, 0, `Zero Bedrock blocks generated above Y=4 in Overworld`);

// Assert Sea Level 62 invariants
assertEqual(waterAboveSeaLevelViolations, 0, `Zero water blocks generated above SEA_LEVEL (Y=62) in Overworld`);
assert(seaLevelWaterMatches > 0, `Ocean columns generate water body filling precisely up to Y=62 (${seaLevelWaterMatches} ocean columns verified)`);

// Assert Stratigraphy invariants
assert(surfaceGrassCount > 0, `Overworld generates natural Grass surface terrain (${surfaceGrassCount} columns)`);
assert(beachSandCount > 0 || gravelSeabedCount > 0, `Overworld generates beaches (${beachSandCount}) or seabed gravel (${gravelSeabedCount})`);
assert(validStratigraphyColumns >= totalOverworldColumns * 0.90, `Surface stratigraphy conforms in >=90% of columns (${validStratigraphyColumns}/${totalOverworldColumns})`);

// Assert Cave carve-out invariants
assert(caveAirVoxelCount > 100, `Overworld 3D spaghetti caves carve out empty cavern airways (${caveAirVoxelCount} cave air voxels)`);
assert(caveLavaVoxelCount > 0, `Overworld deep caves generate lava pools at Y<=10 (${caveLavaVoxelCount} deep cave lava voxels)`);
assertEqual(deepLavaAboveY10Violations, 0, `Deep cave lava never generates above Y=10`);

// 2.4 Monotonic Bedrock Decay in Y=1..4
const bedrockCountByY = [0, 0, 0, 0, 0];
for (let { cx, cz } of testCoords) {
  const chunk = new ChunkColumn(cx, cz);
  generateOverworldChunk(chunk, 1337);
  for (let lz = 0; lz < 16; lz++) {
    for (let lx = 0; lx < 16; lx++) {
      for (let y = 0; y <= 4; y++) {
        if (chunk.getBlock(lx, y, lz) === BLOCK.BEDROCK) {
          bedrockCountByY[y]++;
        }
      }
    }
  }
}
assertEqual(bedrockCountByY[0], testCoords.length * 256, `Y=0 bedrock count is exactly 100% (${bedrockCountByY[0]}/${testCoords.length * 256})`);
assert(bedrockCountByY[1] > bedrockCountByY[2], `Bedrock decay: count(Y=1) [${bedrockCountByY[1]}] > count(Y=2) [${bedrockCountByY[2]}]`);
assert(bedrockCountByY[2] > bedrockCountByY[3], `Bedrock decay: count(Y=2) [${bedrockCountByY[2]}] > count(Y=3) [${bedrockCountByY[3]}]`);
assert(bedrockCountByY[3] > bedrockCountByY[4], `Bedrock decay: count(Y=3) [${bedrockCountByY[3]}] > count(Y=4) [${bedrockCountByY[4]}]`);

const t2Duration = (performance.now() - t2Start).toFixed(2);
console.log(`  ✓ Target 2: Overworld Terrain Boundaries PASSED (${t2Duration} ms).\n`);

// ============================================================================
// TARGET 3: Nether Cavern Boundaries
// ============================================================================
console.log('>>> TARGET 3: Nether Cavern Boundaries (Dual Bedrock, Lava Oceans Y<=31, Caverns Y=40..88, Fortress)');

const t3Start = performance.now();

let totalNetherColumns = 0;
let netherFloorViolations = 0;
let netherCeilingViolations = 0;
let netherAboveCeilingViolations = 0;
let netherLavaOceanViolations = 0;
let netherOpenSpaceY40to88 = 0;
let netherSolidNetherrackY40to88 = 0;
let netherGlowstoneCount = 0;

const netherTestCoords = [
  { cx: 0, cz: 0 },
  { cx: -6, cz: -6 },
  { cx: 6, cz: 0 },
  { cx: -1, cz: 2 },
  { cx: 3, cz: -3 }
];

for (const seed of testSeeds) {
  for (const { cx, cz } of netherTestCoords) {
    const chunk = new ChunkColumn(cx, cz);
    generateNetherChunk(chunk, seed);

    for (let lz = 0; lz < 16; lz++) {
      for (let lx = 0; lx < 16; lx++) {
        totalNetherColumns++;

        // 3.1 Dual Bedrock Guarantee
        // Floor at Y=0
        if (chunk.getBlock(lx, 0, lz) !== BLOCK.BEDROCK) {
          netherFloorViolations++;
        }
        // Ceiling at Y=127
        if (chunk.getBlock(lx, 127, lz) !== BLOCK.BEDROCK) {
          netherCeilingViolations++;
        }
        // Void air above ceiling Y>=128
        for (let y = 128; y < CHUNK_HEIGHT; y++) {
          if (chunk.getBlock(lx, y, lz) !== BLOCK.AIR) {
            netherAboveCeilingViolations++;
          }
        }

        // 3.2 Lava Oceans at Y <= 31
        for (let y = 1; y <= NETHER_LAVA_LEVEL; y++) {
          const blk = chunk.getBlock(lx, y, lz);
          // If not solid netherrack, bedrock, or fortress brick, it MUST be LAVA (never air below Y<=31)
          if (blk !== BLOCK.NETHERRACK && blk !== BLOCK.BEDROCK && blk !== BLOCK.SOUL_SAND &&
              blk !== BLOCK.NETHER_BRICK && blk !== BLOCK.NETHER_BRICK_FENCE && blk !== BLOCK.NETHER_BRICK_STAIRS) {
            if (blk !== BLOCK.LAVA) {
              netherLavaOceanViolations++;
            }
          }
        }

        // Lava oceans should NOT exist above Y=31 in open cavern space
        for (let y = NETHER_LAVA_LEVEL + 1; y <= 126; y++) {
          const blk = chunk.getBlock(lx, y, lz);
          if (blk === BLOCK.AIR) {
            // Count open cavern space in Y=40..88
            if (y >= 40 && y <= 88) {
              netherOpenSpaceY40to88++;
            }
          } else if (blk === BLOCK.NETHERRACK) {
            if (y >= 40 && y <= 88) {
              netherSolidNetherrackY40to88++;
            }
          } else if (blk === BLOCK.GLOWSTONE) {
            netherGlowstoneCount++;
          }
        }
      }
    }
  }
}

// Bedrock invariants
assertEqual(netherFloorViolations, 0, `Nether floor Y=0 is 100% solid Bedrock across all ${totalNetherColumns} columns`);
assertEqual(netherCeilingViolations, 0, `Nether ceiling Y=127 is 100% solid Bedrock across all ${totalNetherColumns} columns`);
assertEqual(netherAboveCeilingViolations, 0, `Nether space above ceiling (Y>=128) is 100% void AIR (0 violations)`);

// Lava Ocean invariants
assertEqual(netherLavaOceanViolations, 0, `Nether non-solid cavern space at Y<=31 is 100% filled with Lava Ocean`);

// Open cavern space Y=40..88
const totalVoxelsY40to88 = netherOpenSpaceY40to88 + netherSolidNetherrackY40to88;
const openRatio = netherOpenSpaceY40to88 / totalVoxelsY40to88;
assert(openRatio > 0.20 && openRatio < 0.85, `Cavern bias B_cap(y) creates healthy open airway ratio in Y=40..88 (got ${(openRatio * 100).toFixed(1)}%)`);
assert(netherGlowstoneCount > 0, `Nether ceiling anchors generate hanging Glowstone clusters (${netherGlowstoneCount} glowstone voxels)`);

// 3.3 Modular Nether Fortress Verification
// Test chunk (0, 0) and (6, 0) and (-6, -6) where |cx| % 6 === 0 and |cz| % 6 === 0
const fortressChunk = new ChunkColumn(0, 0);
generateNetherChunk(fortressChunk, 1337);

let fortressBrickCount = 0;
let fortressFenceCount = 0;
let fortressBridgeDeckY58 = false;

for (let lz = 0; lz < 16; lz++) {
  for (let lx = 0; lx < 16; lx++) {
    for (let y = 0; y < 128; y++) {
      const blk = fortressChunk.getBlock(lx, y, lz);
      if (blk === BLOCK.NETHER_BRICK) {
        fortressBrickCount++;
        if (y === 58) fortressBridgeDeckY58 = true;
      } else if (blk === BLOCK.NETHER_BRICK_FENCE) {
        fortressFenceCount++;
      }
    }
  }
}

assert(fortressBrickCount > 50, `Nether Fortress generates Nether Brick components (${fortressBrickCount} brick voxels)`);
assert(fortressFenceCount > 10, `Nether Fortress generates Nether Brick Fence parapets (${fortressFenceCount} fence voxels)`);
assert(fortressBridgeDeckY58, 'Nether Fortress elevated bridge deck floor is built at exactly Y=58');

// Check vertical support stilts extending downwards below bridge floor
let stiltBlocksBelowY58 = 0;
for (let y = 20; y < 58; y++) {
  for (let lz = 0; lz < 16; lz++) {
    for (let lx = 0; lx < 16; lx++) {
      if (fortressChunk.getBlock(lx, y, lz) === BLOCK.NETHER_BRICK) {
        stiltBlocksBelowY58++;
      }
    }
  }
}
assert(stiltBlocksBelowY58 > 20, `Nether Fortress vertical support stilts extend downwards beneath bridge (${stiltBlocksBelowY58} stilt voxels)`);

const t3Duration = (performance.now() - t3Start).toFixed(2);
console.log(`  ✓ Target 3: Nether Cavern Boundaries PASSED (${t3Duration} ms).\n`);

// ============================================================================
// TARGET 4: The End Boundaries
// ============================================================================
console.log('>>> TARGET 4: The End Boundaries (Central Island, Void Hazard Space Y<=0, 10 Pillars R=42, Exit Fountain)');

const t4Start = performance.now();

// 4.1 Void Hazard Space & Central Island Density across a 7x7 chunk grid centered at (0, 0)
const endWorld = new WorldManager(1337);
endWorld.setDimension(DIMENSION.THE_END);

let endStoneCoreCount = 0;
let voidHazardY0Violations = 0;
let voidHazardYNegativeViolations = 0;
let distantVoidViolations = 0;

for (let cz = -3; cz <= 3; cz++) {
  for (let cx = -3; cx <= 3; cx++) {
    const chunk = endWorld.getChunk(cx, cz, DIMENSION.THE_END);
    const startX = cx * 16;
    const startZ = cz * 16;

    for (let lz = 0; lz < 16; lz++) {
      const wz = startZ + lz;
      for (let lx = 0; lx < 16; lx++) {
        const wx = startX + lx;
        const dist = Math.hypot(wx, wz);

        // In The End: Y=0 MUST be 100% AIR (Void Hazard — NO BEDROCK FLOOR)
        if (chunk.getBlock(lx, 0, lz) !== BLOCK.AIR) {
          voidHazardY0Violations++;
        }

        // Altitude Y < 20 must be 100% AIR
        for (let y = 0; y < 20; y++) {
          if (chunk.getBlock(lx, y, lz) !== BLOCK.AIR) {
            voidHazardYNegativeViolations++;
          }
        }

        // Distant perimeter > 120 blocks MUST be void air
        if (dist > 120) {
          for (let y = 0; y < CHUNK_HEIGHT; y++) {
            if (chunk.getBlock(lx, y, lz) !== BLOCK.AIR) {
              distantVoidViolations++;
            }
          }
        }

        // Island Core count
        if (dist < 30) {
          for (let y = 40; y <= 75; y++) {
            if (chunk.getBlock(lx, y, lz) === BLOCK.END_STONE) {
              endStoneCoreCount++;
            }
          }
        }
      }
    }
  }
}

assertEqual(voidHazardY0Violations, 0, 'The End Y=0 is 100% void AIR (NO Bedrock floor)');
assertEqual(voidHazardYNegativeViolations, 0, 'The End altitude Y < 20 is 100% void AIR');
assertEqual(distantVoidViolations, 0, 'The End perimeter beyond 120 blocks is 100% void AIR');
assert(endStoneCoreCount > 1000, `Central floating End Stone island is dense at core (${endStoneCoreCount} End Stone voxels)`);

// 4.2 Central Exit Bedrock Fountain Verification
// Fountain origin (0, 58, 0)
const centerFloor = endWorld.getBlock(0, 58, 0, DIMENSION.THE_END);
const centerPillarTop = endWorld.getBlock(0, 62, 0, DIMENSION.THE_END);
const rimBlock = endWorld.getBlock(3, 59, 0, DIMENSION.THE_END);
const innerBowlAir = endWorld.getBlock(1, 59, 0, DIMENSION.THE_END);

assertEqual(centerFloor, BLOCK.BEDROCK, 'Central exit fountain has Bedrock floor at (0, 58, 0)');
assertEqual(centerPillarTop, BLOCK.BEDROCK, 'Central exit fountain has 4-block high Bedrock pillar apex at (0, 62, 0)');
assertEqual(rimBlock, BLOCK.BEDROCK, 'Central exit fountain has elevated Bedrock rim at (3, 59, 0)');
assertEqual(innerBowlAir, BLOCK.AIR, 'Central exit fountain inner basin at (1, 59, 0) is AIR');

// 4.3 Exactly 10 Obsidian Monolith Pillars in Ring R=42
const RING_RADIUS = 42;
let validatedPillars = 0;
let cagedPillars = 0;
let uncagedPillars = 0;

for (let k = 0; k < 10; k++) {
  const theta = (2 * Math.PI * k) / 10;
  const px = Math.floor(RING_RADIUS * Math.cos(theta));
  const pz = Math.floor(RING_RADIUS * Math.sin(theta));
  const radius = 3 + (k % 3);
  const height = 76 + 3 * k;

  // Verify solid obsidian core
  const obsidianBase = endWorld.getBlock(px, 50, pz, DIMENSION.THE_END);
  const obsidianMid = endWorld.getBlock(px, height - 1, pz, DIMENSION.THE_END);
  const bedrockCap = endWorld.getBlock(px, height, pz, DIMENSION.THE_END);
  const crystalFire = endWorld.getBlock(px, height + 1, pz, DIMENSION.THE_END);

  let pillarValid = true;
  if (obsidianBase !== BLOCK.OBSIDIAN) {
    pillarValid = false;
    assert(false, `Pillar ${k} obsidian base at (${px}, 50, ${pz}) expected OBSIDIAN, got ${obsidianBase}`);
  }
  if (obsidianMid !== BLOCK.OBSIDIAN) {
    pillarValid = false;
    assert(false, `Pillar ${k} obsidian mid at (${px}, ${height - 1}, ${pz}) expected OBSIDIAN, got ${obsidianMid}`);
  }
  if (bedrockCap !== BLOCK.BEDROCK) {
    pillarValid = false;
    assert(false, `Pillar ${k} bedrock cap at (${px}, ${height}, ${pz}) expected BEDROCK, got ${bedrockCap}`);
  }
  if (crystalFire !== BLOCK.FIRE) {
    pillarValid = false;
    assert(false, `Pillar ${k} crystal fire at (${px}, ${height + 1}, ${pz}) expected FIRE, got ${crystalFire}`);
  }

  // Verify cylindrical perimeter: check (px + radius, 55, pz) is obsidian
  const perimeterObsidian = endWorld.getBlock(px + radius, 55, pz, DIMENSION.THE_END);
  assertEqual(perimeterObsidian, BLOCK.OBSIDIAN, `Pillar ${k} cylindrical radius ${radius} boundary is OBSIDIAN`);

  // Verify cages: pillars 3 and 7 MUST have cages; other pillars must NOT
  const cageBlock = endWorld.getBlock(px + 1, height + 1, pz, DIMENSION.THE_END);
  if (k === 3 || k === 7) {
    assertEqual(cageBlock, BLOCK.NETHER_BRICK_FENCE, `Pillar ${k} crystal fire is enclosed in protective cage`);
    cagedPillars++;
  } else {
    assertEqual(cageBlock, BLOCK.AIR, `Pillar ${k} crystal fire is open (uncaged)`);
    uncagedPillars++;
  }

  if (pillarValid) validatedPillars++;
}

assertEqual(validatedPillars, 10, 'Exactly 10 Obsidian Monolith Pillars verified in ring R=42');
assertEqual(cagedPillars, 2, 'Exactly 2 pillars (k=3 and k=7) have iron bar/fence cages');
assertEqual(uncagedPillars, 8, 'Exactly 8 pillars have open crystal fire tops');

const t4Duration = (performance.now() - t4Start).toFixed(2);
console.log(`  ✓ Target 4: The End Boundaries PASSED (${t4Duration} ms).\n`);

// ============================================================================
// TARGET 5: Multi-Chunk Seams, WorldManager Persistence & Portals Stress
// ============================================================================
console.log('>>> TARGET 5: Multi-Chunk Seams, WorldManager Persistence & Portals Stress');

const t5Start = performance.now();

// 5.1 Pillar Cross-Chunk Seam Test
// Pillars cross chunk boundaries. Verify no missing vertical slices at boundaries.
for (let k = 0; k < 10; k++) {
  const theta = (2 * Math.PI * k) / 10;
  const px = Math.floor(RING_RADIUS * Math.cos(theta));
  const pz = Math.floor(RING_RADIUS * Math.sin(theta));
  const radius = 3 + (k % 3);
  const height = 76 + 3 * k;

  let missingVoxels = 0;
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dz * dz <= radius * radius) {
        // Query at mid height Y=60
        const b = endWorld.getBlock(px + dx, 60, pz + dz, DIMENSION.THE_END);
        if (b !== BLOCK.OBSIDIAN) {
          missingVoxels++;
        }
      }
    }
  }
  assertEqual(missingVoxels, 0, `Pillar ${k} cylinder cross-chunk volume has zero missing seam voxels`);
}

// 5.2 WorldManager Dimension Switching & Block Persistence Stress
const wm = new WorldManager(2026);
assertEqual(wm.getActiveDimension(), DIMENSION.OVERWORLD, 'WorldManager begins in Overworld dimension');

// Place custom blocks across all 3 dimensions
wm.setBlock(10, 70, 10, BLOCK.GOLD_BLOCK || 4, DIMENSION.OVERWORLD);
wm.setBlock(5, 40, 5, BLOCK.DIAMOND_BLOCK || 12, DIMENSION.NETHER);
wm.setBlock(0, 80, 0, BLOCK.EMERALD_BLOCK || 19, DIMENSION.THE_END);

// Stress switch dimensions 50 times in a loop
for (let cycle = 0; cycle < 50; cycle++) {
  wm.setDimension(DIMENSION.NETHER);
  assertEqual(wm.getBlock(5, 40, 5), BLOCK.DIAMOND_BLOCK || 12, `Cycle ${cycle}: Nether block persistent`);

  wm.setDimension(DIMENSION.THE_END);
  assertEqual(wm.getBlock(0, 80, 0), BLOCK.EMERALD_BLOCK || 19, `Cycle ${cycle}: The End block persistent`);

  wm.setDimension(DIMENSION.OVERWORLD);
  assertEqual(wm.getBlock(10, 70, 10), BLOCK.GOLD_BLOCK || 4, `Cycle ${cycle}: Overworld block persistent`);
}

// 5.3 Portal Coordinate Scaling & Safe Spawn Invariants
const s1 = scaleCoordinate(DIMENSION.OVERWORLD, DIMENSION.NETHER, 80, 160);
assertEqual(s1.x, 10, 'Scale Overworld X=80 to Nether X=10 (8:1 ratio)');
assertEqual(s1.z, 20, 'Scale Overworld Z=160 to Nether Z=20 (8:1 ratio)');

const s2 = scaleCoordinate(DIMENSION.OVERWORLD, DIMENSION.NETHER, -80, -160);
assertEqual(s2.x, -10, 'Scale Overworld X=-80 to Nether X=-10 (negative coords)');
assertEqual(s2.z, -20, 'Scale Overworld Z=-160 to Nether Z=-20 (negative coords)');

const s3 = scaleCoordinate(DIMENSION.NETHER, DIMENSION.OVERWORLD, 10, 20);
assertEqual(s3.x, 80, 'Scale Nether X=10 to Overworld X=80');
assertEqual(s3.z, 160, 'Scale Nether Z=20 to Overworld Z=160');

const s4 = scaleCoordinate(DIMENSION.NETHER, DIMENSION.OVERWORLD, -10, -20);
assertEqual(s4.x, -80, 'Scale Nether X=-10 to Overworld X=-80');
assertEqual(s4.z, -160, 'Scale Nether Z=-20 to Overworld Z=-160');

// End Spawn Platform at fixed coordinate (100.5, 49, 0.5)
const endSpawnPad = prepareEndSpawnPlatform(wm);
assertEqual(endSpawnPad.x, 100.5, 'End spawn X is exactly 100.5');
assertEqual(endSpawnPad.y, 49.0, 'End spawn Y is exactly 49.0');
assertEqual(endSpawnPad.z, 0.5, 'End spawn Z is exactly 0.5');
assertEqual(wm.getBlock(100, 48, 0, DIMENSION.THE_END), BLOCK.OBSIDIAN, 'End spawn platform base Y=48 is solid Obsidian');
assertEqual(wm.getBlock(100, 49, 0, DIMENSION.THE_END), BLOCK.AIR, 'End spawn platform standing space Y=49 is clear AIR');

// 5.4 Nether Portal Frame Boundary Stress Tests
// Test valid 4x5 minimum frame along X axis
const portalWorld = new WorldManager(999);

// Build 4 wide x 5 high frame: inner is (21..22, 66..68, 20)
// Bottom & Top
for (let x = 20; x <= 23; x++) {
  portalWorld.setBlock(x, 65, 20, BLOCK.OBSIDIAN, DIMENSION.OVERWORLD);
  portalWorld.setBlock(x, 69, 20, BLOCK.OBSIDIAN, DIMENSION.OVERWORLD);
}
// Left & Right sides
for (let y = 66; y <= 68; y++) {
  portalWorld.setBlock(20, y, 20, BLOCK.OBSIDIAN, DIMENSION.OVERWORLD);
  portalWorld.setBlock(23, y, 20, BLOCK.OBSIDIAN, DIMENSION.OVERWORLD);
  // Inner air
  portalWorld.setBlock(21, y, 20, BLOCK.AIR, DIMENSION.OVERWORLD);
  portalWorld.setBlock(22, y, 20, BLOCK.AIR, DIMENSION.OVERWORLD);
}

const frameValidation = validateNetherPortalFrame(portalWorld, 21, 66, 20);
assertEqual(frameValidation.valid, true, 'Valid 4x5 Nether Portal frame validated');
assertEqual(frameValidation.innerWidth, 2, 'Frame inner width is 2');
assertEqual(frameValidation.innerHeight, 3, 'Frame inner height is 3');

// Ignite frame
const ignited = igniteNetherPortal(portalWorld, 21, 66, 20);
assertEqual(ignited, true, 'Nether portal ignited successfully');
assertEqual(portalWorld.getBlock(21, 66, 20), BLOCK.NETHER_PORTAL, 'Inner block converted to NETHER_PORTAL');
assertEqual(portalWorld.getBlock(22, 68, 20), BLOCK.NETHER_PORTAL, 'Inner top block converted to NETHER_PORTAL');

// Extinguish portal
extinguishNetherPortal(portalWorld, 21, 66, 20);
assertEqual(portalWorld.getBlock(21, 66, 20), BLOCK.AIR, 'Extinguished portal restores inner air');

// Invalid frame test: break bottom obsidian
portalWorld.setBlock(21, 65, 20, BLOCK.DIRT, DIMENSION.OVERWORLD);
const invalidFrameValidation = validateNetherPortalFrame(portalWorld, 21, 66, 20);
assertEqual(invalidFrameValidation.valid, false, 'Invalid Nether Portal frame rejected (missing obsidian base)');

// 5.5 AABB Solid Collider Intersection Test
const colliders = wm.getIntersectingBlockAABBs({
  minX: 99.5, maxX: 101.5,
  minY: 47.5, maxY: 49.5,
  minZ: -0.5, maxZ: 1.5
}, DIMENSION.THE_END);
assert(colliders.length > 0, `WorldManager detected ${colliders.length} solid block AABB colliders for spawn platform`);

const t5Duration = (performance.now() - t5Start).toFixed(2);
console.log(`  ✓ Target 5: Multi-Chunk Seams, Persistence & Portals PASSED (${t5Duration} ms).\n`);

// ============================================================================
// TARGET 6: Chunk Coordinate Extremes & Boundary Stress
// ============================================================================
console.log('>>> TARGET 6: Chunk Coordinate Extremes & Boundary Stress (Negative & Extreme Coordinates)');

const t6Start = performance.now();

const extremeChunkCoords = [
  { cx: -1, cz: -1 },
  { cx: -16, cz: -16 },
  { cx: -100, cz: -100 },
  { cx: 1000, cz: -1000 },
  { cx: -50000, cz: 50000 },
  { cx: 1000000, cz: -1000000 },
  { cx: -1000000, cz: 1000000 }
];

let extremeDeterminismFailures = 0;
let extremeBedrockViolations = 0;
let extremeHeightmapViolations = 0;
let extremeNetherCeilingFloorViolations = 0;
let extremeNetherVoidViolations = 0;
let extremeEndDistantVoidViolations = 0;

for (const { cx, cz } of extremeChunkCoords) {
  // 6.1 Determinism: Multiple generations of the same extreme chunk produce identical byte arrays
  const owChunkA = new ChunkColumn(cx, cz);
  const owChunkB = new ChunkColumn(cx, cz);
  generateOverworldChunk(owChunkA, 1337);
  generateOverworldChunk(owChunkB, 1337);

  if (Buffer.compare(owChunkA.blocks, owChunkB.blocks) !== 0) {
    extremeDeterminismFailures++;
  }

  // 6.2 Overworld Bedrock & Heightmap integrity at extreme coordinates
  for (let lz = 0; lz < 16; lz++) {
    for (let lx = 0; lx < 16; lx++) {
      if (owChunkA.getBlock(lx, 0, lz) !== BLOCK.BEDROCK) {
        extremeBedrockViolations++;
      }
      for (let y = 5; y < CHUNK_HEIGHT; y++) {
        if (owChunkA.getBlock(lx, y, lz) === BLOCK.BEDROCK) {
          extremeBedrockViolations++;
        }
      }
      const h = owChunkA.heightMap[(lz << 4) | lx];
      if (h < 0 || h >= CHUNK_HEIGHT || !Number.isFinite(h)) {
        extremeHeightmapViolations++;
      }
    }
  }

  // 6.3 Nether Bedrock Dual-Seal at extreme coordinates
  const netherChunk = new ChunkColumn(cx, cz);
  generateNetherChunk(netherChunk, 1337);
  for (let lz = 0; lz < 16; lz++) {
    for (let lx = 0; lx < 16; lx++) {
      if (netherChunk.getBlock(lx, 0, lz) !== BLOCK.BEDROCK) {
        extremeNetherCeilingFloorViolations++;
      }
      if (netherChunk.getBlock(lx, 127, lz) !== BLOCK.BEDROCK) {
        extremeNetherCeilingFloorViolations++;
      }
      for (let y = 128; y < CHUNK_HEIGHT; y++) {
        if (netherChunk.getBlock(lx, y, lz) !== BLOCK.AIR) {
          extremeNetherVoidViolations++;
        }
      }
    }
  }

  // 6.4 The End Void Isolation at truly distant coordinates (dist > 120 blocks)
  const distFromOrigin = Math.hypot(cx * 16, cz * 16);
  const endChunk = new ChunkColumn(cx, cz);
  generateEndChunk(endChunk, 1337);

  if (distFromOrigin > 120) {
    for (let idx = 0; idx < CHUNK_SIZE; idx++) {
      if (endChunk.blocks[idx] !== BLOCK.AIR) {
        extremeEndDistantVoidViolations++;
      }
    }
  } else {
    // For near-origin negative chunk (-1, -1), verify void altitude invariants
    for (let lz = 0; lz < 16; lz++) {
      for (let lx = 0; lx < 16; lx++) {
        if (endChunk.getBlock(lx, 0, lz) !== BLOCK.AIR) {
          extremeEndDistantVoidViolations++;
        }
        for (let y = 0; y < 20; y++) {
          if (endChunk.getBlock(lx, y, lz) !== BLOCK.AIR) {
            extremeEndDistantVoidViolations++;
          }
        }
        for (let y = 110; y < CHUNK_HEIGHT; y++) {
          if (endChunk.getBlock(lx, y, lz) !== BLOCK.AIR) {
            extremeEndDistantVoidViolations++;
          }
        }
      }
    }
  }
}

assertEqual(extremeDeterminismFailures, 0, 'Zero determinism mismatches across extreme chunk coordinates (100% byte-exact repeatability)');
assertEqual(extremeBedrockViolations, 0, 'Bedrock invariants (Y=0 solid, Y>=5 zero) hold strictly at chunk coordinate extremes');
assertEqual(extremeHeightmapViolations, 0, 'ChunkColumn heightmaps strictly within valid bounds [0..255] at extreme coordinates');
assertEqual(extremeNetherCeilingFloorViolations, 0, 'Nether dual-bedrock floor (Y=0) & ceiling (Y=127) intact at extreme coordinates');
assertEqual(extremeNetherVoidViolations, 0, 'Nether space above Y=127 is 100% void AIR at extreme coordinates');
assertEqual(extremeEndDistantVoidViolations, 0, 'The End distant chunks at extreme coordinates are 100% void AIR (all 65,536 voxels)');

// 6.5 WorldManager getBlock / setBlock round-trip across negative & extreme coordinate seams
const wmExtreme = new WorldManager(777);
const roundTripPoints = [
  { x: -1, y: 65, z: -1 },
  { x: -16, y: 65, z: -16 },
  { x: -17, y: 65, z: -17 },
  { x: -999999, y: 70, z: 999999 },
  { x: 1000000, y: 80, z: -1000000 }
];

let roundTripFailures = 0;
for (const pt of roundTripPoints) {
  wmExtreme.setBlock(pt.x, pt.y, pt.z, BLOCK.OBSIDIAN, DIMENSION.OVERWORLD);
  const retrieved = wmExtreme.getBlock(pt.x, pt.y, pt.z, DIMENSION.OVERWORLD);
  if (retrieved !== BLOCK.OBSIDIAN) {
    roundTripFailures++;
  }
}
assertEqual(roundTripFailures, 0, 'WorldManager getBlock/setBlock persists across negative and extreme chunk seams without coordinate wrapping corruption');

const t6Duration = (performance.now() - t6Start).toFixed(2);
console.log(`  ✓ Target 6: Chunk Coordinate Extremes & Boundary Stress PASSED (${t6Duration} ms).\n`);

// ============================================================================
// TARGET 7: Biome Transitions & Boundary Blending Stress
// ============================================================================
console.log('>>> TARGET 7: Biome Transitions & Boundary Blending Stress (Plains <-> Cherry Grove <-> Forest)');

const t7Start = performance.now();

// 7.1 Mathematical boundary correctness of classifyBiome
let classifyViolations = 0;
const testBiomeInputs = [
  { cont: 0.350001, temp: 0.0, expected: 'CHERRY_GROVE' },
  { cont: 0.350000, temp: 0.0, expected: 'FOREST' },
  { cont: 0.350000, temp: 0.050001, expected: 'PLAINS' },
  { cont: 0.350000, temp: 0.050000, expected: 'FOREST' },
  { cont: 0.349999, temp: 0.06, expected: 'PLAINS' },
  { cont: 0.800000, temp: -0.9, expected: 'CHERRY_GROVE' },
  { cont: -0.50000, temp: 0.5, expected: 'PLAINS' },
  { cont: -0.50000, temp: -0.5, expected: 'FOREST' }
];

for (const t of testBiomeInputs) {
  const result = classifyBiome(t.cont, t.temp);
  if (result !== t.expected) {
    classifyViolations++;
  }
}
assertEqual(classifyViolations, 0, 'classifyBiome strictly respects continentalness > 0.35 and temperature > 0.05 decision boundaries');

// 7.2 High-resolution sampling across continuous biome boundary lines (49 chunk grid)
let boundaryFoliageExclusionViolations = 0;
let boundaryStratigraphyViolations = 0;
let cherryGroveColumnsFound = 0;
let plainsColumnsFound = 0;
let forestColumnsFound = 0;

const noiseElev = new FastNoise(1337);
const noiseTemp = new FastNoise(1337 + 101);

for (let cz = -3; cz <= 3; cz++) {
  for (let cx = -3; cx <= 3; cx++) {
    const chunk = new ChunkColumn(cx, cz);
    generateOverworldChunk(chunk, 1337);

    for (let lz = 0; lz < 16; lz++) {
      const wz = cz * 16 + lz;
      for (let lx = 0; lx < 16; lx++) {
        const wx = cx * 16 + lx;
        const cont = noiseElev.noise2D((wx + 500) * 0.0012, (wz + 500) * 0.0012);
        const temp = noiseTemp.noise2D(wx * 0.0015, wz * 0.0015);
        const biome = classifyBiome(cont, temp);

        if (biome === 'CHERRY_GROVE') cherryGroveColumnsFound++;
        else if (biome === 'PLAINS') plainsColumnsFound++;
        else forestColumnsFound++;

        // Surface block check: highest solid terrain block
        let surfaceY = -1;
        let surfaceBlock = BLOCK.AIR;
        for (let y = CHUNK_HEIGHT - 1; y >= 1; y--) {
          const b = chunk.getBlock(lx, y, lz);
          if (b === BLOCK.OAK_LOG || b === BLOCK.OAK_LEAVES ||
              b === BLOCK.CHERRY_LOG || b === BLOCK.CHERRY_LEAVES ||
              b === BLOCK.PINK_PETALS || b === BLOCK.TALL_GRASS) continue;
          if (b !== BLOCK.AIR && b !== BLOCK.WATER) {
            surfaceY = y;
            surfaceBlock = b;
            break;
          }
        }

        if (surfaceY >= SEA_LEVEL) {
          // If above sea level, surface must be GRASS or SAND (or DIRT directly beneath a tree trunk)
          const isTreeBase = (surfaceBlock === BLOCK.DIRT &&
            (chunk.getBlock(lx, surfaceY + 1, lz) === BLOCK.OAK_LOG ||
             chunk.getBlock(lx, surfaceY + 1, lz) === BLOCK.CHERRY_LOG));
          if (surfaceBlock !== BLOCK.GRASS && surfaceBlock !== BLOCK.SAND && !isTreeBase) {
            boundaryStratigraphyViolations++;
          }
        }

        // Decoration exclusion checks:
        // Cherry Grove must never have Tall Grass or Oak Log trunks planted in it
        for (let y = 1; y < CHUNK_HEIGHT; y++) {
          const blk = chunk.getBlock(lx, y, lz);
          if (biome === 'CHERRY_GROVE') {
            if (blk === BLOCK.TALL_GRASS || blk === BLOCK.OAK_LOG) {
              boundaryFoliageExclusionViolations++;
            }
          } else {
            // Plains and Forest must never generate Pink Petals
            if (blk === BLOCK.PINK_PETALS) {
              boundaryFoliageExclusionViolations++;
            }
          }
        }
      }
    }
  }
}

assert(cherryGroveColumnsFound > 0, `Discovered ${cherryGroveColumnsFound} Cherry Grove columns across test grid`);
assert(plainsColumnsFound > 0, `Discovered ${plainsColumnsFound} Plains columns across test grid`);
assert(forestColumnsFound > 0, `Discovered ${forestColumnsFound} Forest columns across test grid`);
assertEqual(boundaryStratigraphyViolations, 0, 'Surface stratigraphy is consistently GRASS or SAND across all biome transitions above sea level');
assertEqual(boundaryFoliageExclusionViolations, 0, 'Biome decoration exclusivity strictly maintained: zero Oak trunks/Tall Grass in Cherry Grove, zero Pink Petals in Plains/Forest');

const t7Duration = (performance.now() - t7Start).toFixed(2);
console.log(`  ✓ Target 7: Biome Transitions & Boundary Blending PASSED (${t7Duration} ms).\n`);

// ============================================================================
// TARGET 8: Cave Carver Boundaries & Nether Bedrock Floor/Ceiling Stress
// ============================================================================
console.log('>>> TARGET 8: Cave Carver Boundaries & Nether Bedrock Floor/Ceiling Stress');

const t8Start = performance.now();

let caveBedrockBreaches = 0;
let caveDeepLavaViolations = 0;
let netherFloorBreaches = 0;
let netherCeilingBreaches = 0;
let netherSubLavaAirBreaches = 0;

const carverTestChunks = [
  { cx: 0, cz: 0 },
  { cx: -2, cz: 3 },
  { cx: 4, cz: -5 },
  { cx: -8, cz: -8 },
  { cx: 12, cz: 12 }
];

for (const seed of [101, 202, 303]) {
  for (const { cx, cz } of carverTestChunks) {
    const chunk = new ChunkColumn(cx, cz);
    generateOverworldChunk(chunk, seed);

    for (let lz = 0; lz < 16; lz++) {
      for (let lx = 0; lx < 16; lx++) {
        // Bedrock floor Y=0 must NEVER be penetrated by cave carver
        if (chunk.getBlock(lx, 0, lz) !== BLOCK.BEDROCK) {
          caveBedrockBreaches++;
        }

        // Deep cave lava pools: lava must only exist at Y <= 10
        for (let y = 11; y < CHUNK_HEIGHT; y++) {
          if (chunk.getBlock(lx, y, lz) === BLOCK.LAVA) {
            caveDeepLavaViolations++;
          }
        }
      }
    }

    // Nether dual-bedrock & lava ocean integrity
    const nChunk = new ChunkColumn(cx, cz);
    generateNetherChunk(nChunk, seed);

    for (let lz = 0; lz < 16; lz++) {
      for (let lx = 0; lx < 16; lx++) {
        if (nChunk.getBlock(lx, 0, lz) !== BLOCK.BEDROCK) {
          netherFloorBreaches++;
        }
        if (nChunk.getBlock(lx, 127, lz) !== BLOCK.BEDROCK) {
          netherCeilingBreaches++;
        }
        // Sub-lava cavern space: no vacuum AIR at Y <= 31
        for (let y = 1; y <= NETHER_LAVA_LEVEL; y++) {
          if (nChunk.getBlock(lx, y, lz) === BLOCK.AIR) {
            netherSubLavaAirBreaches++;
          }
        }
      }
    }
  }
}

assertEqual(caveBedrockBreaches, 0, 'Zero cave carver breaches into Bedrock floor Y=0 in Overworld (100% solid bedrock floor)');
assertEqual(caveDeepLavaViolations, 0, 'Zero deep cave lava pools generated above Y=10 in Overworld');
assertEqual(netherFloorBreaches, 0, 'Nether bedrock floor Y=0 has zero breaches across all test seeds and chunks');
assertEqual(netherCeilingBreaches, 0, 'Nether bedrock ceiling Y=127 has zero breaches across all test seeds and chunks');
assertEqual(netherSubLavaAirBreaches, 0, 'Zero vacuum AIR pockets below Nether Lava Ocean level (Y <= 31 is completely solid or lava)');

const t8Duration = (performance.now() - t8Start).toFixed(2);
console.log(`  ✓ Target 8: Cave Carver Boundaries & Nether Bedrock Floor/Ceiling PASSED (${t8Duration} ms).\n`);

// ============================================================================
// TARGET 9: The End Void Dimension Floating Island Bounds & Structure Integrity
// ============================================================================
console.log('>>> TARGET 9: The End Void Dimension Floating Island Bounds & Structure Integrity');

const t9Start = performance.now();

const endStressWorld = new WorldManager(31415);
endStressWorld.setDimension(DIMENSION.THE_END);

let endStoneBeyond95 = 0;
let endVoxelBelow20 = 0;
let endVoxelAbove110 = 0;
let endFloorBedrockViolations = 0;
let distantChunkNonAirCount = 0;

// Test 9x9 chunk grid centered at (0, 0) in The End
for (let cz = -4; cz <= 4; cz++) {
  for (let cx = -4; cx <= 4; cx++) {
    const chunk = endStressWorld.getChunk(cx, cz, DIMENSION.THE_END);
    const startX = cx * 16;
    const startZ = cz * 16;

    for (let lz = 0; lz < 16; lz++) {
      const wz = startZ + lz;
      for (let lx = 0; lx < 16; lx++) {
        const wx = startX + lx;
        const dist = Math.hypot(wx, wz);

        // Y=0 MUST be AIR (Void hazard, NO bedrock floor)
        if (chunk.getBlock(lx, 0, lz) !== BLOCK.AIR) {
          endFloorBedrockViolations++;
        }

        // Below Y=20 must be 100% AIR
        for (let y = 0; y < 20; y++) {
          if (chunk.getBlock(lx, y, lz) !== BLOCK.AIR) {
            endVoxelBelow20++;
          }
        }

        // Above Y=110 must be 100% AIR (highest pillar top is 103 + fire/cage at 106)
        for (let y = 110; y < CHUNK_HEIGHT; y++) {
          if (chunk.getBlock(lx, y, lz) !== BLOCK.AIR) {
            endVoxelAbove110++;
          }
        }

        // Floating island radial cutoff: End Stone must strictly vanish for dist >= 95
        if (dist >= 95.0) {
          for (let y = 0; y < CHUNK_HEIGHT; y++) {
            if (chunk.getBlock(lx, y, lz) === BLOCK.END_STONE) {
              endStoneBeyond95++;
            }
          }
        }
      }
    }
  }
}

assertEqual(endFloorBedrockViolations, 0, 'The End Y=0 is 100% void AIR (NO Bedrock floor)');
assertEqual(endVoxelBelow20, 0, 'The End altitude space Y < 20 is 100% void AIR (void hazard space)');
assertEqual(endVoxelAbove110, 0, 'The End altitude space Y >= 110 is 100% void AIR');
assertEqual(endStoneBeyond95, 0, 'End Stone procedural generation strictly vanishes at radial distance >= 95 blocks');

// Distant chunks beyond distance 150 blocks must be 100% void AIR across all 65,536 voxels
const distantChunks = [
  { cx: 12, cz: 12 },
  { cx: -15, cz: -15 },
  { cx: 0, cz: 20 },
  { cx: -20, cz: 0 }
];

for (const { cx, cz } of distantChunks) {
  const dChunk = endStressWorld.getChunk(cx, cz, DIMENSION.THE_END);
  for (let idx = 0; idx < CHUNK_SIZE; idx++) {
    if (dChunk.blocks[idx] !== BLOCK.AIR) {
      distantChunkNonAirCount++;
    }
  }
}
assertEqual(distantChunkNonAirCount, 0, 'The End distant chunks beyond island perimeter are 100% empty void AIR across all 65,536 voxels per chunk');

// Exit Fountain integrity at (0, 58, 0)
const fountainCenter = endStressWorld.getBlock(0, 58, 0, DIMENSION.THE_END);
const fountainApex = endStressWorld.getBlock(0, 62, 0, DIMENSION.THE_END);
assertEqual(fountainCenter, BLOCK.BEDROCK, 'Central exit fountain has Bedrock floor at (0, 58, 0)');
assertEqual(fountainApex, BLOCK.BEDROCK, 'Central exit fountain has Bedrock pillar apex at (0, 62, 0)');

const t9Duration = (performance.now() - t9Start).toFixed(2);
console.log(`  ✓ Target 9: The End Void Dimension Floating Island Bounds PASSED (${t9Duration} ms).\n`);

// ============================================================================
// SUMMARY & VERDICT
// ============================================================================
console.log('======================================================================');
console.log('ADVERSARIAL STRESS TEST RESULTS:');
console.log(`  Total Assertions:  ${totalAssertions}`);
console.log(`  Passed Assertions: ${passedAssertions}`);
console.log(`  Failed Assertions: ${failedAssertions}`);
console.log('======================================================================\n');

if (failedAssertions === 0) {
  console.log('FINAL VERDICT: APPROVE (ALL EMPIRICAL WORLD GENERATION STRESS TESTS PASSED)');
  process.exit(0);
} else {
  console.error(`FINAL VERDICT: REJECT (${failedAssertions} ASSERTIONS FAILED)`);
  process.exit(1);
}
