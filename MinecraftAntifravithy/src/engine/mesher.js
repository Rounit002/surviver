/**
 * ChunkSection Face-Culling Mesher with Per-Vertex Smooth AO (0-3),
 * Anisotropic Quad-Flipping, and 8-Byte Packed Integer Layout.
 * Zero external dependencies.
 */

import { VAO } from './webgl.js';
import { BLOCK_IDS, TILE_SLOTS } from './atlas.js';

export { BLOCK_IDS, TILE_SLOTS };

export const SECTION_SIZE = 16;
export const SECTION_VOLUME = 4096; // 16 * 16 * 16

// ============================================================================
// Block Transparency & Solidity Predicates
// ============================================================================

export const M2_TO_M1_BLOCK = {
  0: BLOCK_IDS.AIR,             // 0
  1: BLOCK_IDS.STONE,           // 1
  2: BLOCK_IDS.GRASS_BLOCK,     // 2
  3: BLOCK_IDS.DIRT,            // 3
  4: BLOCK_IDS.COBBLESTONE,     // 4
  5: BLOCK_IDS.OAK_LOG,         // 9
  6: BLOCK_IDS.OAK_LEAVES,      // 10
  7: BLOCK_IDS.BEDROCK,         // 6
  8: BLOCK_IDS.WATER,           // 30
  9: BLOCK_IDS.LAVA,            // 31
  10: BLOCK_IDS.SAND,           // 7
  11: BLOCK_IDS.GRAVEL,         // 8
  12: BLOCK_IDS.OBSIDIAN,       // 23
  13: BLOCK_IDS.NETHERRACK,     // 24
  14: BLOCK_IDS.DIRT,           // 3 (soul sand -> dirt)
  15: BLOCK_IDS.GLOWSTONE,      // 25
  16: BLOCK_IDS.NETHER_BRICK,   // 26
  17: BLOCK_IDS.NETHER_BRICK,   // 26 (fence)
  18: BLOCK_IDS.NETHER_BRICK,   // 26 (stairs)
  19: BLOCK_IDS.END_STONE,      // 27
  20: BLOCK_IDS.CHERRY_LOG,     // 11
  21: BLOCK_IDS.CHERRY_LEAVES,  // 12
  22: BLOCK_IDS.CHERRY_PETALS,  // 14
  23: BLOCK_IDS.NETHER_PORTAL,  // 28
  24: BLOCK_IDS.END_STONE,      // 27 (frame)
  25: BLOCK_IDS.END_PORTAL,     // 29
  26: BLOCK_IDS.TORCH,          // 22 (fire)
  27: BLOCK_IDS.CHERRY_PETALS   // 14 (tall grass)
};

export function isOpaque(blockId) {
  if (blockId === 0 || blockId === BLOCK_IDS.AIR) return false;
  // Non-opaque standard M2 blocks:
  if (blockId === 8 || blockId === 9 || blockId === 6 || blockId === 21 ||
      blockId === 22 || blockId === 23 || blockId === 25 || blockId === 27) return false;
  // Non-opaque M1 blocks:
  if (blockId === BLOCK_IDS.WATER) return false;
  if (blockId === BLOCK_IDS.LAVA) return false;
  if (blockId === BLOCK_IDS.GLASS) return false;
  if (blockId === BLOCK_IDS.OAK_LEAVES) return false;
  if (blockId === BLOCK_IDS.CHERRY_LEAVES) return false;
  if (blockId === BLOCK_IDS.CHERRY_PETALS) return false;
  if (blockId === BLOCK_IDS.TORCH) return false;
  if (blockId === BLOCK_IDS.NETHER_PORTAL) return false;
  if (blockId === BLOCK_IDS.END_PORTAL) return false;
  return true;
}

export function isFluid(blockId) {
  return blockId === 8 || blockId === 9 || blockId === BLOCK_IDS.WATER || blockId === BLOCK_IDS.LAVA;
}

export function isCutout(blockId) {
  return (
    blockId === 6 ||
    blockId === 21 ||
    blockId === 22 ||
    blockId === 27 ||
    blockId === BLOCK_IDS.OAK_LEAVES ||
    blockId === BLOCK_IDS.CHERRY_LEAVES ||
    blockId === BLOCK_IDS.CHERRY_PETALS ||
    blockId === BLOCK_IDS.TORCH
  );
}

// ============================================================================
// 6 Cube Faces with Winding Orders & AO Neighbor Offsets
// ============================================================================

export const FACES = [
  // 0: +Y (Top)
  {
    faceId: 0,
    dir: [0, 1, 0],
    corners: [
      [0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]
    ],
    // For each corner: [side1, side2, corner] offsets in chunk coordinates
    aoNeighbors: [
      [[-1, 1, 0], [0, 1, 1], [-1, 1, 1]],  // Corner 0
      [[1, 1, 0],  [0, 1, 1], [1, 1, 1]],   // Corner 1
      [[1, 1, 0],  [0, 1, -1], [1, 1, -1]], // Corner 2
      [[-1, 1, 0], [0, 1, -1], [-1, 1, -1]] // Corner 3
    ]
  },
  // 1: -Y (Bottom)
  {
    faceId: 1,
    dir: [0, -1, 0],
    corners: [
      [0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]
    ],
    aoNeighbors: [
      [[-1, -1, 0], [0, -1, -1], [-1, -1, -1]], // Corner 0
      [[1, -1, 0],  [0, -1, -1], [1, -1, -1]],  // Corner 1
      [[1, -1, 0],  [0, -1, 1],  [1, -1, 1]],   // Corner 2
      [[-1, -1, 0], [0, -1, 1],  [-1, -1, 1]]   // Corner 3
    ]
  },
  // 2: +Z (South)
  {
    faceId: 2,
    dir: [0, 0, 1],
    corners: [
      [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]
    ],
    aoNeighbors: [
      [[-1, 0, 1], [0, -1, 1], [-1, -1, 1]], // Corner 0
      [[1, 0, 1],  [0, -1, 1], [1, -1, 1]],  // Corner 1
      [[1, 0, 1],  [0, 1, 1],  [1, 1, 1]],   // Corner 2
      [[-1, 0, 1], [0, 1, 1],  [-1, 1, 1]]   // Corner 3
    ]
  },
  // 3: -Z (North)
  {
    faceId: 3,
    dir: [0, 0, -1],
    corners: [
      [1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]
    ],
    aoNeighbors: [
      [[1, 0, -1],  [0, -1, -1], [1, -1, -1]],  // Corner 0
      [[-1, 0, -1], [0, -1, -1], [-1, -1, -1]], // Corner 1
      [[-1, 0, -1], [0, 1, -1],  [-1, 1, -1]],  // Corner 2
      [[1, 0, -1],  [0, 1, -1],  [1, 1, -1]]   // Corner 3
    ]
  },
  // 4: +X (East)
  {
    faceId: 4,
    dir: [1, 0, 0],
    corners: [
      [1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]
    ],
    aoNeighbors: [
      [[1, 0, 1],  [1, -1, 0], [1, -1, 1]],  // Corner 0
      [[1, 0, -1], [1, -1, 0], [1, -1, -1]], // Corner 1
      [[1, 0, -1], [1, 1, 0],  [1, 1, -1]],  // Corner 2
      [[1, 0, 1],  [1, 1, 0],  [1, 1, 1]]    // Corner 3
    ]
  },
  // 5: -X (West)
  {
    faceId: 5,
    dir: [-1, 0, 0],
    corners: [
      [0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]
    ],
    aoNeighbors: [
      [[-1, 0, -1], [-1, -1, 0], [-1, -1, -1]], // Corner 0
      [[-1, 0, 1],  [-1, -1, 0], [-1, -1, 1]],  // Corner 1
      [[-1, 0, 1],  [-1, 1, 0],  [-1, 1, 1]],   // Corner 2
      [[-1, 0, -1], [-1, 1, 0],  [-1, 1, -1]]   // Corner 3
    ]
  }
];

// ============================================================================
// Smooth Ambient Occlusion Formula & Quad-Flip Rule
// ============================================================================

/**
 * Standard Minecraft Java AO formula.
 * @param {boolean} s1Solid
 * @param {boolean} s2Solid
 * @param {boolean} cSolid
 * @returns {number} 0 (darkest), 1, 2, 3 (unoccluded)
 */
export function computeVertexAO(s1Solid, s2Solid, cSolid) {
  if (s1Solid && s2Solid) {
    return 0; // Both orthogonal neighbors solid -> fully enclosed corner
  }
  const s1 = s1Solid ? 1 : 0;
  const s2 = s2Solid ? 1 : 0;
  const c = cSolid ? 1 : 0;
  return 3 - (s1 + s2 + c);
}

/**
 * Anisotropic Quad-Flip Rule:
 * Swaps triangulation split diagonal when ao0 + ao2 > ao1 + ao3
 * to eliminate dark anisotropic creases.
 */
export function getQuadIndices(ao0, ao1, ao2, ao3, baseVertex) {
  if (ao0 + ao2 > ao1 + ao3) {
    // Flipped diagonal: smooth gradient along v1-v3
    return [
      baseVertex + 1, baseVertex + 2, baseVertex + 3,
      baseVertex + 3, baseVertex + 0, baseVertex + 1
    ];
  } else {
    // Default diagonal: smooth gradient along v0-v2
    return [
      baseVertex + 0, baseVertex + 1, baseVertex + 2,
      baseVertex + 2, baseVertex + 3, baseVertex + 0
    ];
  }
}

/**
 * Pack vertex into two 32-bit unsigned integers (8 bytes).
 */
export function packVertex(x, y, z, faceId, cornerIdx, texId, ao, skyLight, blockLight) {
  const w0 = ((x & 0x1F) | ((y & 0x1F) << 5) | ((z & 0x1F) << 10) | ((faceId & 0x7) << 15) | ((cornerIdx & 0x3) << 18)) >>> 0;
  const w1 = ((texId & 0x3FF) | ((ao & 0x3) << 10) | ((skyLight & 0xF) << 12) | ((blockLight & 0xF) << 16)) >>> 0;
  return [w0, w1];
}

// ============================================================================
// ChunkSection Class
// ============================================================================

export class ChunkSection {
  constructor(cx = 0, cy = 0, cz = 0) {
    this.cx = cx;
    this.cy = cy;
    this.cz = cz;
    this.blocks = new Uint8Array(SECTION_VOLUME);
    this.light = new Uint8Array(SECTION_VOLUME);
    // Initialize light: default full daylight (15 sky, 0 block)
    this.light.fill(0xF0);
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
    if (id !== BLOCK_IDS.AIR) {
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

// ============================================================================
// Scratch Memory Pools (Eliminates GC Pauses during Meshing)
// ============================================================================

const MAX_QUADS = 4096 * 6; // Max theoretical faces
const scratchOpaqueVertices = new Uint32Array(MAX_QUADS * 4 * 2);
const scratchOpaqueIndices = new Uint32Array(MAX_QUADS * 6);
const scratchTransVertices = new Uint32Array(MAX_QUADS * 4 * 2);
const scratchTransIndices = new Uint32Array(MAX_QUADS * 6);

// Fallback Float Buffers for WebGL 1.0 (7 floats per vertex: x, y, z, u, v, faceIdx, ao)
const scratchOpaqueFloats = new Float32Array(MAX_QUADS * 4 * 7);
const scratchTransFloats = new Float32Array(MAX_QUADS * 4 * 7);

// ============================================================================
// ChunkSection Mesher
// ============================================================================

/**
 * Builds or updates the WebGL mesh for a 16x16x16 ChunkSection.
 * Employs neighbor face culling, per-vertex AO, quad-flipping, and packed vertex buffers.
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl
 * @param {ChunkSection} section
 * @param {object} world - Optional world query interface { getBlock(wx, wy, wz), getLight(wx, wy, wz) }
 * @param {object} atlas - Texture synthesizer instance
 * @param {boolean} isWebGL2
 * @param {object} vaoExt - OES_vertex_array_object extension for WebGL 1
 */
export function buildMesh(gl, section, world, atlas, isWebGL2 = true, vaoExt = null) {
  // Free existing mesh buffers if present
  if (section.mesh) {
    deleteMesh(gl, section.mesh, isWebGL2, vaoExt);
    section.mesh = null;
  }

  section.dirty = false;

  // Atlas parameter alignment: support passing atlas directly, via world, or as 3rd param
  let actualWorld = world;
  let actualAtlas = atlas;
  if (world && typeof world.getBlockFaceTile === 'function' && !atlas) {
    actualAtlas = world;
    actualWorld = null;
  }
  if (!actualAtlas && actualWorld && actualWorld.atlas) {
    actualAtlas = actualWorld.atlas;
  }

  const baseWX = section.cx * 16;
  const baseWY = section.cy * 16;
  const baseWZ = section.cz * 16;

  // Block query helper (handles chunk boundary crossing via world)
  function queryBlock(lx, ly, lz) {
    if (lx >= 0 && lx < 16 && ly >= 0 && ly < 16 && lz >= 0 && lz < 16) {
      return section.getBlock(lx, ly, lz);
    }
    if (actualWorld && typeof actualWorld.getBlock === 'function') {
      return actualWorld.getBlock(baseWX + lx, baseWY + ly, baseWZ + lz);
    }
    return BLOCK_IDS.AIR; // Default outside unloaded chunk
  }

  // Light query helper
  function queryLight(lx, ly, lz) {
    if (lx >= 0 && lx < 16 && ly >= 0 && ly < 16 && lz >= 0 && lz < 16) {
      return section.getLight(lx, ly, lz);
    }
    if (actualWorld && typeof actualWorld.getLight === 'function') {
      return actualWorld.getLight(baseWX + lx, baseWY + ly, baseWZ + lz);
    }
    return { sky: 15, block: 0 };
  }

  let opaqueVertexCount = 0;
  let opaqueIndexCount = 0;
  let transVertexCount = 0;
  let transIndexCount = 0;

  // Traverse all 4096 voxels in chunk section
  for (let y = 0; y < 16; y++) {
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const blockId = section.getBlock(x, y, z);
        if (blockId === BLOCK_IDS.AIR) continue;

        const isBlockFluid = isFluid(blockId);
        const isBlockCutout = isCutout(blockId);
        const isBlockTranslucent = isBlockFluid || blockId === BLOCK_IDS.GLASS;

        // Check each of the 6 faces
        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const nx = x + face.dir[0];
          const ny = y + face.dir[1];
          const nz = z + face.dir[2];

          const neighborId = queryBlock(nx, ny, nz);

          // Face Culling Logic:
          // 1. If neighbor is opaque solid block -> face is hidden, cull!
          if (isOpaque(neighborId)) {
            continue;
          }
          // 2. Fluid neighbor culling: if both this block and neighbor are water -> internal face, cull!
          if (isBlockFluid && neighborId === blockId) {
            continue;
          }
          // 3. Glass neighbor culling: adjacent glass faces cull each other
          if (blockId === BLOCK_IDS.GLASS && neighborId === BLOCK_IDS.GLASS) {
            continue;
          }

          // Emit face!
          let texId = 0;
          if (actualAtlas && typeof actualAtlas.getBlockFaceTile === 'function') {
            const m1Id = M2_TO_M1_BLOCK[blockId];
            texId = actualAtlas.getBlockFaceTile(m1Id !== undefined ? m1Id : blockId, face.faceId);
          } else if (actualAtlas && typeof actualAtlas.getTileIndex === 'function') {
            texId = actualAtlas.getTileIndex('stone');
          }
          const neighborLight = queryLight(nx, ny, nz);

          // Compute per-vertex AO for the 4 corners of this face
          const aos = [3, 3, 3, 3];
          if (!isBlockFluid) { // Fluids don't receive sharp voxel AO
            for (let c = 0; c < 4; c++) {
              const [s1Off, s2Off, cOff] = face.aoNeighbors[c];
              const s1Id = queryBlock(x + s1Off[0], y + s1Off[1], z + s1Off[2]);
              const s2Id = queryBlock(x + s2Off[0], y + s2Off[1], z + s2Off[2]);
              const cId  = queryBlock(x + cOff[0],  y + cOff[1],  z + cOff[2]);

              const s1Solid = isOpaque(s1Id);
              const s2Solid = isOpaque(s2Id);
              const cSolid  = isOpaque(cId);

              aos[c] = computeVertexAO(s1Solid, s2Solid, cSolid);
            }
          }

          // Buffer selection: Opaque or Transparent/Translucent
          const isTransBatch = isBlockTranslucent;
          let vOffset, iOffset, vBuf, iBuf, baseVert;

          if (!isTransBatch) {
            baseVert = opaqueVertexCount;
            vOffset = opaqueVertexCount * 2;
            iOffset = opaqueIndexCount;
            vBuf = scratchOpaqueVertices;
            iBuf = scratchOpaqueIndices;
          } else {
            baseVert = transVertexCount;
            vOffset = transVertexCount * 2;
            iOffset = transIndexCount;
            vBuf = scratchTransVertices;
            iBuf = scratchTransIndices;
          }

          // Emit 4 vertices for the quad
          for (let c = 0; c < 4; c++) {
            const cornerPos = face.corners[c];
            const vx = x + cornerPos[0];
            const vy = y + cornerPos[1];
            const vz = z + cornerPos[2];

            const [w0, w1] = packVertex(
              vx, vy, vz,
              face.faceId,
              c,
              texId,
              aos[c],
              neighborLight.sky,
              neighborLight.block
            );

            vBuf[vOffset + c * 2]     = w0;
            vBuf[vOffset + c * 2 + 1] = w1;

            // Also populate float fallback if WebGL 1
            if (!isWebGL2) {
              const fBuf = isTransBatch ? scratchTransFloats : scratchOpaqueFloats;
              const fOff = (baseVert + c) * 7;
              fBuf[fOff + 0] = vx;
              fBuf[fOff + 1] = vy;
              fBuf[fOff + 2] = vz;
              // UV coordinates
              const tileU = (texId % 16) * 0.0625;
              const tileV = Math.floor(texId / 16) * 0.0625;
              const EPS = 0.0005;
              const SPAN = 0.0625 - 2.0 * EPS;
              fBuf[fOff + 3] = (c === 1 || c === 2) ? (tileU + EPS + SPAN) : (tileU + EPS);
              fBuf[fOff + 4] = (face.faceId >= 2)
                ? ((c === 0 || c === 1) ? (tileV + EPS + SPAN) : (tileV + EPS))
                : ((c === 2 || c === 3) ? (tileV + EPS + SPAN) : (tileV + EPS));
              fBuf[fOff + 5] = face.faceId;
              fBuf[fOff + 6] = aos[c];
            }
          }

          // Quad Indices with Anisotropic Quad-Flip Rule
          const quadIndices = getQuadIndices(aos[0], aos[1], aos[2], aos[3], baseVert);
          for (let idx = 0; idx < 6; idx++) {
            iBuf[iOffset + idx] = quadIndices[idx];
          }

          if (!isTransBatch) {
            opaqueVertexCount += 4;
            opaqueIndexCount += 6;
          } else {
            transVertexCount += 4;
            transIndexCount += 6;
          }
        }
      }
    }
  }

  // If section has no visible faces at all
  if (opaqueIndexCount === 0 && transIndexCount === 0) {
    section.mesh = null;
    return null;
  }

  // Create WebGL Buffers & VAO
  const vao = VAO.create(gl, isWebGL2, vaoExt);
  VAO.bind(gl, isWebGL2, vaoExt, vao);

  const vbo = gl.createBuffer();
  const ibo = gl.createBuffer();

  if (isWebGL2) {
    // Combine opaque and transparent vertices into unified buffer
    const totalVertices = opaqueVertexCount + transVertexCount;
    const vertexData = new Uint32Array(totalVertices * 2);
    vertexData.set(scratchOpaqueVertices.subarray(0, opaqueVertexCount * 2), 0);
    vertexData.set(scratchTransVertices.subarray(0, transVertexCount * 2), opaqueVertexCount * 2);

    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

    // Setup 8-byte packed integer attribute (location 0: uvec2 a_data)
    gl.enableVertexAttribArray(0);
    gl.vertexAttribIPointer(0, 2, gl.UNSIGNED_INT, 8, 0);

    // Unified index buffer (re-index transparent indices with offset)
    const totalIndices = opaqueIndexCount + transIndexCount;
    const indexData = new Uint32Array(totalIndices);
    indexData.set(scratchOpaqueIndices.subarray(0, opaqueIndexCount), 0);

    for (let i = 0; i < transIndexCount; i++) {
      indexData[opaqueIndexCount + i] = scratchTransIndices[i] + opaqueVertexCount;
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexData, gl.STATIC_DRAW);
  } else {
    // WebGL 1.0 Float Fallback
    const totalVertices = opaqueVertexCount + transVertexCount;
    const floatData = new Float32Array(totalVertices * 7);
    floatData.set(scratchOpaqueFloats.subarray(0, opaqueVertexCount * 7), 0);
    floatData.set(scratchTransFloats.subarray(0, transVertexCount * 7), opaqueVertexCount * 7);

    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, floatData, gl.STATIC_DRAW);

    const stride = 7 * 4; // 28 bytes
    // loc 0: a_position (vec3)
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    // loc 1: a_uv (vec2)
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 12);
    // loc 2: a_faceIdx (float)
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 20);
    // loc 3: a_ao (float)
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 24);

    const totalIndices = opaqueIndexCount + transIndexCount;
    const indexData = new Uint32Array(totalIndices);
    indexData.set(scratchOpaqueIndices.subarray(0, opaqueIndexCount), 0);
    for (let i = 0; i < transIndexCount; i++) {
      indexData[opaqueIndexCount + i] = scratchTransIndices[i] + opaqueVertexCount;
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexData, gl.STATIC_DRAW);
  }

  VAO.bind(gl, isWebGL2, vaoExt, null);

  const meshHandle = {
    vao,
    vbo,
    ibo,
    opaqueIndexCount,
    transIndexCount,
    totalIndices: opaqueIndexCount + transIndexCount,
    transOffsetBytes: opaqueIndexCount * 4,
    cx: section.cx,
    cy: section.cy,
    cz: section.cz
  };

  section.mesh = meshHandle;
  return meshHandle;
}

/**
 * Safely delete WebGL mesh handles.
 */
export function deleteMesh(gl, meshHandle, isWebGL2 = true, vaoExt = null) {
  if (!meshHandle) return;
  if (meshHandle.vao) VAO.delete(gl, isWebGL2, vaoExt, meshHandle.vao);
  if (meshHandle.vbo) gl.deleteBuffer(meshHandle.vbo);
  if (meshHandle.ibo) gl.deleteBuffer(meshHandle.ibo);
  meshHandle.vao = null;
  meshHandle.vbo = null;
  meshHandle.ibo = null;
}
