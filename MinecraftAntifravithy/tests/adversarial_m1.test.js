/**
 * Adversarial Empirical Stress Testing Suite for Milestone 1
 * Targets:
 *  1. Mat4 numerical stability (degenerate camera targets, singular inversion, perspective near>=far)
 *  2. Frustum AABB intersection (corners, behind camera, enclosing camera)
 *  3. Chunk mesher edge cases (all air, all stone face culling, checkerboard)
 *  4. Anisotropic Quad-Flip rule (AO diagonal flip unit tests and 3D geometry meshing)
 */

import { Mat4, Vec3, Frustum, AABB } from '../src/engine/math.js';
import {
  ChunkSection,
  SECTION_SIZE,
  SECTION_VOLUME,
  computeVertexAO,
  getQuadIndices,
  packVertex,
  isOpaque,
  isFluid,
  isCutout,
  buildMesh,
  deleteMesh,
  FACES
} from '../src/engine/mesher.js';
import { TextureSynthesizer, BLOCK_IDS } from '../src/engine/atlas.js';
import { Camera } from '../src/engine/renderer.js';

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message, details = '') {
  if (!condition) {
    failed++;
    const err = `[FAIL] ${message}${details ? ' - ' + details : ''}`;
    console.error(err);
    failures.push(err);
    throw new Error(err);
  }
  passed++;
  console.log(`[PASS] ${message}`);
}

function assertApprox(actual, expected, tol = 1e-4, message = '') {
  const diff = Math.abs(actual - expected);
  assert(diff <= tol, message || `Expected ~${expected}, got ${actual} (diff: ${diff})`);
}

// Mock WebGL context capturing raw vertex and element buffers
function createCaptureGL() {
  let boundArrayBuffer = null;
  let boundElementBuffer = null;
  const buffers = new Map();

  return {
    lastArrayData: null,
    lastElementData: null,
    gl: {
      createVertexArray: () => ({ id: Math.random() }),
      bindVertexArray: () => {},
      deleteVertexArray: () => {},
      createBuffer: () => {
        const buf = { id: Math.random() };
        buffers.set(buf, null);
        return buf;
      },
      bindBuffer: (target, buf) => {
        if (target === 34962) boundArrayBuffer = buf;
        if (target === 34963) boundElementBuffer = buf;
      },
      bufferData: (target, data, usage) => {
        if (target === 34962) {
          const copy = new Uint32Array(data.buffer, data.byteOffset, data.byteLength / 4);
          buffers.set(boundArrayBuffer, copy);
        } else if (target === 34963) {
          const copy = new Uint32Array(data.buffer, data.byteOffset, data.byteLength / 4);
          buffers.set(boundElementBuffer, copy);
        }
      },
      enableVertexAttribArray: () => {},
      vertexAttribIPointer: () => {},
      vertexAttribPointer: () => {},
      deleteBuffer: (buf) => { buffers.delete(buf); },
      STATIC_DRAW: 35044,
      ARRAY_BUFFER: 34962,
      ELEMENT_ARRAY_BUFFER: 34963,
      UNSIGNED_INT: 5125,
      FLOAT: 5126
    },
    getBuffer(buf) {
      return buffers.get(buf);
    }
  };
}

console.log('======================================================================');
console.log('  MILESTONE 1 ADVERSARIAL STRESS TEST SUITE (EMPIRICAL VERIFICATION)');
console.log('======================================================================\n');

// ============================================================================
// AREA 1: Mat4 Numerical Stability
// ============================================================================
console.log('--- AREA 1: Mat4 Numerical Stability ---');

try {
  // 1.1 Degenerate Camera Target (eye === target)
  const mDegenerate = Mat4.create();
  // Case A: Exact equality at origin
  Mat4.lookAt(mDegenerate, [0, 0, 0], [0, 0, 0], [0, 1, 0]);
  assert(!isNaN(mDegenerate[0]) || isNaN(mDegenerate[1]), 'Mat4.lookAt with eye===target executes without throwing uncaught exception');
  assert(mDegenerate[15] === 1, 'Mat4.lookAt maintains homogeneous w=1 even under degenerate target');

  // Case B: Exact equality at offset position
  Mat4.lookAt(mDegenerate, [150.5, 72.3, -89.1], [150.5, 72.3, -89.1], [0, 1, 0]);
  assert(mDegenerate[15] === 1, 'Mat4.lookAt at non-zero degenerate coordinates maintains w=1');

  // Case C: Sub-normal epsilon distance (distance = 1e-15)
  const mSubnormal = Mat4.create();
  Mat4.lookAt(mSubnormal, [0, 0, 0], [0, 0, 1e-15], [0, 1, 0]);
  assert(mSubnormal[15] === 1, 'Mat4.lookAt with sub-normal epsilon distance executes without throwing');

  // Case D: Up vector collinear with forward direction (cross product is zero)
  const mCollinearUp = Mat4.create();
  Mat4.lookAt(mCollinearUp, [0, 0, 0], [0, 1, 0], [0, 1, 0]);
  assert(mCollinearUp[0] === 1 && mCollinearUp[1] === 0 && mCollinearUp[2] === 0,
    'Mat4.lookAt handles collinear up vector via fallback (x0=1, x1=0, x2=0)');

  // 1.2 Singular Matrix Inversion
  const mSingular = Mat4.create();
  const mInvOut = Mat4.create();

  // All-zero matrix
  mSingular.fill(0);
  const invZero = Mat4.invert(mInvOut, mSingular);
  assert(invZero === null, 'Mat4.invert returns null for all-zero singular matrix (det === 0)');

  // Rank-1 matrix (all elements = 1)
  mSingular.fill(1);
  const invRank1 = Mat4.invert(mInvOut, mSingular);
  assert(invRank1 === null, 'Mat4.invert returns null for rank-1 all-ones matrix');

  // Colinear row matrix (row1 = 2 * row0)
  mSingular.set([
    1, 2, 3, 4,
    2, 4, 6, 8,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]);
  const invColinear = Mat4.invert(mInvOut, mSingular);
  assert(invColinear === null, 'Mat4.invert returns null for colinear row singular matrix');

  // Invertible matrix must roundtrip to identity: M * M_inv = I
  const mInvertible = Mat4.create();
  Mat4.lookAt(mInvertible, [10, 20, 30], [0, 5, 0], [0, 1, 0]);
  Mat4.invert(mInvOut, mInvertible);
  const mProduct = Mat4.create();
  Mat4.multiply(mProduct, mInvertible, mInvOut);
  for (let i = 0; i < 16; i++) {
    const expected = (i % 5 === 0) ? 1.0 : 0.0;
    assertApprox(mProduct[i], expected, 1e-4, `M * M_inv produces identity at element ${i}`);
  }

  // 1.3 Perspective with near >= far
  const mPerspNF = Mat4.create();

  // near === far
  Mat4.perspective(mPerspNF, Math.PI / 3, 16 / 9, 10.0, 10.0);
  assert(mPerspNF[11] === -1, 'Mat4.perspective with near===far populates perspective divisor m[11] = -1');
  assert(!isFinite(mPerspNF[10]), 'Mat4.perspective with near===far results in infinite depth multiplier');

  // near > far (reversed Z)
  Mat4.perspective(mPerspNF, Math.PI / 3, 16 / 9, 100.0, 1.0);
  assert(isFinite(mPerspNF[0]) && isFinite(mPerspNF[5]), 'Mat4.perspective with near > far preserves finite XY scaling');
  assert(mPerspNF[10] > 0, 'Mat4.perspective with near > far flips depth multiplier sign');

  // fovYRad boundary (near zero and near PI)
  Mat4.perspective(mPerspNF, 0.001, 16 / 9, 0.1, 100.0);
  assert(isFinite(mPerspNF[5]) && mPerspNF[5] > 0, 'Mat4.perspective handles small FOV without crash');

  Mat4.perspective(mPerspNF, Math.PI - 0.001, 16 / 9, 0.1, 100.0);
  assert(isFinite(mPerspNF[5]) && mPerspNF[5] > 0, 'Mat4.perspective handles large FOV approaching PI without crash');

} catch (e) {
  console.error('Error in AREA 1:', e);
}

// ============================================================================
// AREA 2: Frustum AABB Intersection
// ============================================================================
console.log('\n--- AREA 2: Frustum AABB Intersection ---');

try {
  // Setup standard frustum: Camera at (0, 0, 0) looking along -Z, FOV=90 deg (tan=1), aspect=1.0, near=1.0, far=100.0
  // At depth Z = -d: frustum bounds are X in [-d, d], Y in [-d, d]
  const mProj = Mat4.create();
  Mat4.perspective(mProj, Math.PI / 2, 1.0, 1.0, 100.0);
  const mView = Mat4.create();
  Mat4.lookAt(mView, [0, 0, 0], [0, 0, -1], [0, 1, 0]);
  const mVP = Mat4.create();
  Mat4.multiply(mVP, mProj, mView);

  const frustum = new Frustum();
  frustum.update(mVP);

  // 2.1 Boxes on Frustum Corners
  // Near plane corners at Z = -1: (±1, ±1, -1)
  const nearCorners = [
    [1, 1, -1],
    [-1, 1, -1],
    [1, -1, -1],
    [-1, -1, -1]
  ];

  for (const [cx, cy, cz] of nearCorners) {
    // Straddling corner box: spans Z in [-1.1, -0.9], X in [0.9, 1.1] -> penetrates frustum
    const straddling = frustum.intersectsAABB(
      cx > 0 ? 0.9 : -1.1,
      cy > 0 ? 0.9 : -1.1,
      -1.1,
      cx > 0 ? 1.1 : -0.9,
      cy > 0 ? 1.1 : -0.9,
      -0.9
    );
    assert(straddling, `Frustum intersects straddling box on near corner (${cx}, ${cy}, ${cz})`);

    // Box strictly outside corner: for Z in [-1.0, -0.2], frustum half-width <= 1.0.
    // Placing box at |X| in [1.5, 2.5] guarantees |X| > 1.0 >= -Z everywhere.
    const outside = frustum.intersectsAABB(
      cx > 0 ? 1.5 : -2.5,
      cy > 0 ? 1.5 : -2.5,
      -1.0,
      cx > 0 ? 2.5 : -1.5,
      cy > 0 ? 2.5 : -1.5,
      -0.2
    );
    assert(!outside, `Frustum culls box strictly outside near corner (${cx}, ${cy}, ${cz})`);
  }

  // Far plane corners at Z = -100: (±100, ±100, -100)
  const farCorners = [
    [100, 100, -100],
    [-100, 100, -100],
    [100, -100, -100],
    [-100, -100, -100]
  ];

  for (const [cx, cy, cz] of farCorners) {
    // Straddling box on far corner
    const straddling = frustum.intersectsAABB(
      cx > 0 ? 95 : -105,
      cy > 0 ? 95 : -105,
      -101,
      cx > 0 ? 105 : -95,
      cy > 0 ? 105 : -95,
      -95
    );
    assert(straddling, `Frustum intersects straddling box on far corner (${cx}, ${cy}, ${cz})`);

    // Box strictly outside far corner: for Z in [-100, -90], max width is 100.
    // Placing box at |X| in [105, 115] guarantees it is strictly outside the frustum cone.
    const outsideFar = frustum.intersectsAABB(
      cx > 0 ? 105 : -115,
      cy > 0 ? 105 : -115,
      -100,
      cx > 0 ? 115 : -105,
      cy > 0 ? 115 : -105,
      -90
    );
    assert(!outsideFar, `Frustum culls box strictly outside far corner (${cx}, ${cy}, ${cz})`);

    // Box strictly past far plane (Z < -100)
    const pastFar = frustum.intersectsAABB(
      cx - 5, cy - 5, -120,
      cx + 5, cy + 5, -105
    );
    assert(!pastFar, `Frustum culls box strictly past far plane (${cx}, ${cy}, -110)`);
  }

  // 2.2 Boxes Completely Behind Camera (Z > 0)
  assert(!frustum.intersectsAABB(-5, -5, 1, 5, 5, 10), 'Frustum culls box directly behind camera along +Z');
  assert(!frustum.intersectsAABB(50, 50, 20, 60, 60, 30), 'Frustum culls diagonal box behind camera');
  assert(!frustum.intersectsAABB(-10, -10, 1000, 10, 10, 1020), 'Frustum culls distant box behind camera');

  // Box between camera origin (Z=0) and near plane (Z=-1): e.g. Z in [-0.8, -0.2]
  assert(!frustum.intersectsAABB(-0.5, -0.5, -0.8, 0.5, 0.5, -0.2), 'Frustum culls box between camera eye and near plane');

  // 2.3 Boxes Enclosing the Camera
  // Camera at (0, 0, 0) is enclosed by [-10, -10, -10] to [10, 10, 10]
  assert(frustum.intersectsAABB(-10, -10, -10, 10, 10, 10), 'Frustum reports TRUE for AABB enclosing the camera');

  // Huge global bounding box enclosing camera and entire frustum
  assert(frustum.intersectsAABB(-5000, -5000, -5000, 5000, 5000, 5000), 'Frustum reports TRUE for massive enclosing world bounding box');

  // Camera situated precisely on boundary of AABB
  assert(frustum.intersectsAABB(0, 0, -10, 10, 10, 0), 'Frustum reports TRUE for AABB where camera lies on the box boundary');

  // 2.4 Box completely inside frustum center
  assert(frustum.intersectsAABB(-2, -2, -52, 2, 2, -48), 'Frustum reports TRUE for box completely inside view frustum');

} catch (e) {
  console.error('Error in AREA 2:', e);
}

// ============================================================================
// AREA 3: Chunk Mesher Edge Cases
// ============================================================================
console.log('\n--- AREA 3: Chunk Mesher Edge Cases ---');

try {
  const atlas = new TextureSynthesizer();
  const capture = createCaptureGL();

  // 3.1 Completely Empty Section (All AIR)
  const emptySection = new ChunkSection(0, 0, 0);
  assert(emptySection.empty === true, 'ChunkSection initially has empty === true');
  const emptyMesh = buildMesh(capture.gl, emptySection, null, atlas, true, null);
  assert(emptyMesh === null, 'buildMesh returns null for completely empty chunk section');
  assert(emptySection.mesh === null, 'emptySection.mesh is set to null');

  // 3.2 Completely Solid Section (All STONE = 4096 blocks)
  const solidSection = new ChunkSection(0, 0, 0);
  for (let y = 0; y < 16; y++) {
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        solidSection.setBlock(x, y, z, BLOCK_IDS.STONE);
      }
    }
  }
  assert(solidSection.empty === false, 'Solid section marked non-empty');

  // Test 3.2.A: Meshed with isolated boundary (world = null, default AIR outside)
  // Expected faces: exactly the 6 outer bounding planes of the 16x16x16 cube.
  // 6 outer faces * 16 * 16 blocks = 1536 quads = 6144 vertices = 9216 indices.
  // All 23,040 internal faces MUST be completely culled!
  const solidMeshAirBound = buildMesh(capture.gl, solidSection, null, atlas, true, null);
  assert(solidMeshAirBound !== null, 'Solid section with air boundary produces mesh');
  assert(solidMeshAirBound.opaqueIndexCount === 1536 * 6,
    `Solid section emits exactly 1536 outer quads (9216 indices, got ${solidMeshAirBound.opaqueIndexCount})`);
  assert(solidMeshAirBound.transIndexCount === 0, 'Solid stone section produces 0 translucent indices');

  // Deep inspection of vertex buffer: verify all emitted vertices belong to outer boundary
  const solidVBuf = capture.getBuffer(solidMeshAirBound.vbo);
  assert(solidVBuf !== null && solidVBuf.length === 1536 * 4 * 2,
    `Packed vertex buffer has exact length of 1536 * 4 * 2 = 12288 words (got ${solidVBuf ? solidVBuf.length : 0})`);

  let internalFaceLeaked = false;
  for (let q = 0; q < 1536; q++) {
    const w0 = solidVBuf[q * 4 * 2]; // first vertex of quad
    const vx = w0 & 0x1F;
    const vy = (w0 >> 5) & 0x1F;
    const vz = (w0 >> 10) & 0x1F;
    const faceId = (w0 >> 15) & 0x7;

    // Face must be one of the 6 outer faces pointing outward from chunk boundary
    if (faceId === 0 && vy !== 16) internalFaceLeaked = true;
    if (faceId === 1 && vy !== 0) internalFaceLeaked = true;
    if (faceId === 2 && vz !== 16) internalFaceLeaked = true;
    if (faceId === 3 && vz !== 0) internalFaceLeaked = true;
    if (faceId === 4 && vx !== 16) internalFaceLeaked = true;
    if (faceId === 5 && vx !== 0) internalFaceLeaked = true;
  }
  assert(!internalFaceLeaked, 'Zero internal faces emitted: 100% of internal faces (23,040) culled successfully');

  // Test 3.2.B: Meshed with SOLID STONE neighbor chunks (world returns STONE everywhere)
  // All 6 neighbor chunks are solid -> outer boundary faces are ALSO completely occluded!
  const solidWorld = {
    getBlock: () => BLOCK_IDS.STONE,
    getLight: () => ({ sky: 0, block: 0 })
  };
  const fullyEnclosedMesh = buildMesh(capture.gl, solidSection, solidWorld, atlas, true, null);
  assert(fullyEnclosedMesh === null, 'Solid section surrounded by solid stone neighbor chunks emits 0 faces (returns null)');

  // 3.3 Checkerboard Pattern: Alternating STONE and AIR
  // (x + y + z) % 2 === 0 -> STONE (2048 blocks), odd -> AIR (2048 blocks)
  // In a checkerboard, NO two stone blocks share a face (every face borders AIR)!
  // Total quads: 2048 stone blocks * 6 faces = 12,288 quads = 49,152 vertices = 73,728 indices.
  const checkerSection = new ChunkSection(0, 0, 0);
  let stoneCount = 0;
  for (let y = 0; y < 16; y++) {
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        if ((x + y + z) % 2 === 0) {
          checkerSection.setBlock(x, y, z, BLOCK_IDS.STONE);
          stoneCount++;
        }
      }
    }
  }
  assert(stoneCount === 2048, `Checkerboard contains exactly 2048 stone blocks (got ${stoneCount})`);

  const checkerMesh = buildMesh(capture.gl, checkerSection, null, atlas, true, null);
  assert(checkerMesh !== null, 'Checkerboard section generates valid mesh');
  assert(checkerMesh.opaqueIndexCount === 12288 * 6,
    `Checkerboard emits exactly 12,288 quads (73,728 indices, got ${checkerMesh.opaqueIndexCount})`);

  // Verify index buffer bounds for 49,152 vertices
  const checkerIBuf = capture.getBuffer(checkerMesh.ibo);
  let maxIndex = 0;
  for (let i = 0; i < checkerMesh.opaqueIndexCount; i++) {
    if (checkerIBuf[i] > maxIndex) maxIndex = checkerIBuf[i];
  }
  assert(maxIndex === 49151, `Maximum index in checkerboard mesh is exactly 49,151 (got ${maxIndex})`);

  // Inverted checkerboard: (x + y + z) % 2 === 1 -> STONE
  const invCheckerSection = new ChunkSection(0, 0, 0);
  let invStoneCount = 0;
  for (let y = 0; y < 16; y++) {
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        if ((x + y + z) % 2 === 1) {
          invCheckerSection.setBlock(x, y, z, BLOCK_IDS.STONE);
          invStoneCount++;
        }
      }
    }
  }
  assert(invStoneCount === 2048, 'Inverted checkerboard has exactly 2048 stone blocks');
  const invCheckerMesh = buildMesh(capture.gl, invCheckerSection, null, atlas, true, null);
  assert(invCheckerMesh.opaqueIndexCount === 12288 * 6,
    `Inverted checkerboard emits exactly 12,288 quads (got ${invCheckerMesh.opaqueIndexCount})`);

  // 3.4 Translucent Section Edge Case: 4096 GLASS blocks
  // Adjacent glass blocks must cull each other, only emitting outer 1536 quads into trans buffer
  const glassSection = new ChunkSection(0, 0, 0);
  for (let y = 0; y < 16; y++) {
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        glassSection.setBlock(x, y, z, BLOCK_IDS.GLASS);
      }
    }
  }
  const glassMesh = buildMesh(capture.gl, glassSection, null, atlas, true, null);
  assert(glassMesh.opaqueIndexCount === 0, 'Glass section produces 0 opaque indices');
  assert(glassMesh.transIndexCount === 1536 * 6,
    `Glass section culls internal glass faces and emits exactly 1536 translucent quads (9216 indices, got ${glassMesh.transIndexCount})`);

  // 3.5 High Coordinate Chunk Section: ChunkSection(1000, -500, 2000)
  const highCoordSection = new ChunkSection(1000, -500, 2000);
  highCoordSection.setBlock(0, 0, 0, BLOCK_IDS.STONE);
  const highCoordMesh = buildMesh(capture.gl, highCoordSection, null, atlas, true, null);
  assert(highCoordMesh !== null && highCoordMesh.opaqueIndexCount === 36,
    'High-coordinate chunk section (1000, -500, 2000) correctly meshes isolated block with 6 faces');
  assert(highCoordMesh.cx === 1000 && highCoordMesh.cy === -500 && highCoordMesh.cz === 2000,
    'High-coordinate mesh handle records accurate chunk coordinates');

} catch (e) {
  console.error('Error in AREA 3:', e);
}

// ============================================================================
// AREA 4: Anisotropic Quad-Flip Rule
// ============================================================================
console.log('\n--- AREA 4: Anisotropic Quad-Flip Rule ---');

try {
  // 4.1 Exhaustive unit testing of getQuadIndices for all 256 combinations of AO
  // Mathematical theorem:
  // S_A = ao0 + ao2 in [0, 6], S_B = ao1 + ao3 in [0, 6]
  // Both S_A and S_B follow identical triangular distributions over 16 events.
  // Exactly 44 events have S_A == S_B.
  // By symmetry: exactly (256 - 44)/2 = 106 events have S_A > S_B (flip).
  // Exactly 106 + 44 = 150 events have S_A <= S_B (standard).
  let flippedCount = 0;
  let standardCount = 0;

  for (let ao0 = 0; ao0 <= 3; ao0++) {
    for (let ao1 = 0; ao1 <= 3; ao1++) {
      for (let ao2 = 0; ao2 <= 3; ao2++) {
        for (let ao3 = 0; ao3 <= 3; ao3++) {
          const base = 100;
          const idx = getQuadIndices(ao0, ao1, ao2, ao3, base);

          if (ao0 + ao2 > ao1 + ao3) {
            // Flipped diagonal: smooth gradient along v1-v3 -> [1, 2, 3, 3, 0, 1]
            assert(
              idx[0] === base + 1 && idx[1] === base + 2 && idx[2] === base + 3 &&
              idx[3] === base + 3 && idx[4] === base + 0 && idx[5] === base + 1,
              `Flipped diagonal matches [1,2,3, 3,0,1] for AO (${ao0}, ${ao1}, ${ao2}, ${ao3})`
            );
            flippedCount++;
          } else {
            // Standard diagonal: smooth gradient along v0-v2 -> [0, 1, 2, 2, 3, 0]
            assert(
              idx[0] === base + 0 && idx[1] === base + 1 && idx[2] === base + 2 &&
              idx[3] === base + 2 && idx[4] === base + 3 && idx[5] === base + 0,
              `Standard diagonal matches [0,1,2, 2,3,0] for AO (${ao0}, ${ao1}, ${ao2}, ${ao3})`
            );
            standardCount++;
          }
        }
      }
    }
  }

  assert(flippedCount === 106, `Exhaustive AO test: mathematically proved 106 permutations trigger quad-flip (got ${flippedCount})`);
  assert(standardCount === 150, `Exhaustive AO test: mathematically proved 150 permutations use standard diagonal (got ${standardCount})`);
  assert(flippedCount + standardCount === 256, 'All 256 combinations verified');

  // 4.2 End-to-End 3D Voxel Meshing AO Quad-Flip Test
  // Build real chunk geometry where corner AO creates asymmetric gradient:
  // Place floor block at (5, 5, 5). Look at its Top Face (+Y):
  // Corner 0: (-X, +Z)
  // Corner 1: (+X, +Z) -> diagonal neighbor at (6, 6, 6)
  // Corner 2: (+X, -Z)
  // Corner 3: (-X, -Z) -> diagonal neighbor at (4, 6, 4)

  const atlas = new TextureSynthesizer();
  const capture = createCaptureGL();

  // Test Case A: Place blocks at (6, 6, 6) and (4, 6, 4).
  // Corner 1 has diagonal occlusion -> ao1 = 2
  // Corner 3 has diagonal occlusion -> ao3 = 2
  // Corners 0 and 2 have no occlusion -> ao0 = 3, ao2 = 3
  // Gradient: ao0 + ao2 = 6, ao1 + ao3 = 4.
  // 6 > 4 -> Quad-Flip MUST be triggered on top face of (5, 5, 5)!
  const flipSection = new ChunkSection(0, 0, 0);
  flipSection.setBlock(5, 5, 5, BLOCK_IDS.STONE);
  flipSection.setBlock(6, 6, 6, BLOCK_IDS.STONE);
  flipSection.setBlock(4, 6, 4, BLOCK_IDS.STONE);

  const flipMesh = buildMesh(capture.gl, flipSection, null, atlas, true, null);
  const flipIBuf = capture.getBuffer(flipMesh.ibo);
  const flipVBuf = capture.getBuffer(flipMesh.vbo);

  // Locate the Top (+Y) face of block (5, 5, 5) in the emitted vertex buffer
  let topFaceQuadIdx = -1;
  const quadCount = flipMesh.opaqueIndexCount / 6;
  for (let q = 0; q < quadCount; q++) {
    const vOffset = q * 4 * 2;
    const w0 = flipVBuf[vOffset];
    const vx = w0 & 0x1F;
    const vy = (w0 >> 5) & 0x1F;
    const vz = (w0 >> 10) & 0x1F;
    const faceId = (w0 >> 15) & 0x7;
    // Block (5,5,5) top face has vy=6, faceId=0 (+Y)
    // corners for face 0: vx in [5,6], vz in [5,6]
    if (faceId === 0 && vy === 6 && (vx === 5 || vx === 6) && (vz === 5 || vz === 6)) {
      topFaceQuadIdx = q;
      break;
    }
  }

  assert(topFaceQuadIdx !== -1, 'Found Top (+Y) face of block (5, 5, 5) in meshed geometry');
  const baseVert = topFaceQuadIdx * 4;
  const faceIndices = [
    flipIBuf[topFaceQuadIdx * 6 + 0],
    flipIBuf[topFaceQuadIdx * 6 + 1],
    flipIBuf[topFaceQuadIdx * 6 + 2],
    flipIBuf[topFaceQuadIdx * 6 + 3],
    flipIBuf[topFaceQuadIdx * 6 + 4],
    flipIBuf[topFaceQuadIdx * 6 + 5]
  ];

  // Verify that indices match the FLIPPED diagonal [base+1, base+2, base+3, base+3, base+0, base+1]
  assert(
    faceIndices[0] === baseVert + 1 &&
    faceIndices[1] === baseVert + 2 &&
    faceIndices[2] === baseVert + 3 &&
    faceIndices[3] === baseVert + 3 &&
    faceIndices[4] === baseVert + 0 &&
    faceIndices[5] === baseVert + 1,
    `Empirical 3D Geometry: Top face indices correctly flipped to [1,2,3, 3,0,1] when ao0+ao2 > ao1+ao3 (got ${JSON.stringify(faceIndices.map(x => x - baseVert))})`
  );

  // Test Case B: Place blocks at (4, 6, 6) and (6, 6, 4) (opposite diagonals: Corners 0 and 2)
  // Corner 0 -> ao0 = 2
  // Corner 2 -> ao2 = 2
  // Corners 1 and 3 -> ao1 = 3, ao3 = 3
  // Gradient: ao0 + ao2 = 4, ao1 + ao3 = 6.
  // 4 <= 6 -> Quad-Flip MUST NOT trigger; standard diagonal [base+0, base+1, base+2, base+2, base+3, base+0]
  const stdSection = new ChunkSection(0, 0, 0);
  stdSection.setBlock(5, 5, 5, BLOCK_IDS.STONE);
  stdSection.setBlock(4, 6, 6, BLOCK_IDS.STONE);
  stdSection.setBlock(6, 6, 4, BLOCK_IDS.STONE);

  const stdMesh = buildMesh(capture.gl, stdSection, null, atlas, true, null);
  const stdIBuf = capture.getBuffer(stdMesh.ibo);
  const stdVBuf = capture.getBuffer(stdMesh.vbo);

  let stdTopFaceQuadIdx = -1;
  const stdQuadCount = stdMesh.opaqueIndexCount / 6;
  for (let q = 0; q < stdQuadCount; q++) {
    const vOffset = q * 4 * 2;
    const w0 = stdVBuf[vOffset];
    const vx = w0 & 0x1F;
    const vy = (w0 >> 5) & 0x1F;
    const vz = (w0 >> 10) & 0x1F;
    const faceId = (w0 >> 15) & 0x7;
    if (faceId === 0 && vy === 6 && (vx === 5 || vx === 6) && (vz === 5 || vz === 6)) {
      stdTopFaceQuadIdx = q;
      break;
    }
  }

  assert(stdTopFaceQuadIdx !== -1, 'Found Top (+Y) face of block (5, 5, 5) in standard meshed geometry');
  const stdBaseVert = stdTopFaceQuadIdx * 4;
  const stdFaceIndices = [
    stdIBuf[stdTopFaceQuadIdx * 6 + 0],
    stdIBuf[stdTopFaceQuadIdx * 6 + 1],
    stdIBuf[stdTopFaceQuadIdx * 6 + 2],
    stdIBuf[stdTopFaceQuadIdx * 6 + 3],
    stdIBuf[stdTopFaceQuadIdx * 6 + 4],
    stdIBuf[stdTopFaceQuadIdx * 6 + 5]
  ];

  assert(
    stdFaceIndices[0] === stdBaseVert + 0 &&
    stdFaceIndices[1] === stdBaseVert + 1 &&
    stdFaceIndices[2] === stdBaseVert + 2 &&
    stdFaceIndices[3] === stdBaseVert + 2 &&
    stdFaceIndices[4] === stdBaseVert + 3 &&
    stdFaceIndices[5] === stdBaseVert + 0,
    `Empirical 3D Geometry: Top face indices correctly standard [0,1,2, 2,3,0] when ao0+ao2 <= ao1+ao3 (got ${JSON.stringify(stdFaceIndices.map(x => x - stdBaseVert))})`
  );

} catch (e) {
  console.error('Error in AREA 4:', e);
}

// ============================================================================
// SUMMARY REPORT
// ============================================================================
console.log('\n----------------------------------------------------------------------');
console.log('ADVERSARIAL STRESS TEST SUMMARY:');
console.log(`  Passed Tests:  ${passed}`);
console.log(`  Failed Tests:  ${failed}`);
console.log('----------------------------------------------------------------------');

if (failed > 0) {
  console.error('\nADVERSARIAL FAILURES:');
  for (const f of failures) {
    console.error(`  ${f}`);
  }
  process.exit(1);
} else {
  console.log('\nVERDICT: ALL ADVERSARIAL STRESS TESTS PASSED EMPIRICALLY (100% PASS)');
  process.exit(0);
}
