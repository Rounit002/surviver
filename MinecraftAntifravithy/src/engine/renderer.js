/**
 * Master 3D Voxel Scene Renderer, Camera Management, Frustum Culling,
 * Multi-Pass Pipeline, and Block Damage Overlays.
 * Zero external dependencies.
 */

import { Mat4, Vec3, Frustum } from './math.js';
import {
  initWebGL,
  createProgram,
  getUniformLocations,
  VAO,
  createBuffer
} from './webgl.js';
import {
  CHUNK_VERT_300,
  CHUNK_FRAG_300,
  CHUNK_VERT_100,
  CHUNK_FRAG_100,
  WIREFRAME_VERT,
  WIREFRAME_FRAG,
  CRACK_VERT,
  CRACK_FRAG
} from './shaders.js';
import { TextureSynthesizer, TILE_SLOTS } from './atlas.js';
import { buildMesh } from './mesher.js';

// ============================================================================
// Camera Class
// ============================================================================

export class Camera {
  constructor() {
    this.position = Vec3.create(8, 20, 24);
    this.yaw = 0;       // Horizontal rotation in radians (0 = looking down -Z)
    this.pitch = -0.3;  // Vertical rotation in radians (-Math.PI/2 to +Math.PI/2)
    this.fov = 70;      // Field of view in degrees
    this.near = 0.1;
    this.far = 400.0;

    this.viewMatrix = Mat4.create();
    this.projMatrix = Mat4.create();
    this.viewProjMatrix = Mat4.create();
    this.frustum = new Frustum();

    this.forward = Vec3.create(0, 0, -1);
    this.right = Vec3.create(1, 0, 0);
    this.up = Vec3.create(0, 1, 0);
  }

  update(aspect) {
    // Clamp pitch to avoid gimbal lock flip
    const maxPitch = Math.PI / 2 - 0.01;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    // Direction vector from spherical pitch and yaw
    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);
    const cosYaw = Math.cos(this.yaw);
    const sinYaw = Math.sin(this.yaw);

    this.forward[0] = -sinYaw * cosPitch;
    this.forward[1] = sinPitch;
    this.forward[2] = -cosYaw * cosPitch;
    Vec3.normalize(this.forward, this.forward);

    // Right vector: forward x [0, 1, 0]
    Vec3.cross(this.right, this.forward, [0, 1, 0]);
    Vec3.normalize(this.right, this.right);

    // Up vector: right x forward
    Vec3.cross(this.up, this.right, this.forward);
    Vec3.normalize(this.up, this.up);

    // Target point = position + forward
    const target = Vec3.create();
    Vec3.add(target, this.position, this.forward);

    // Calculate View, Projection, and Combined VP Matrices
    Mat4.lookAt(this.viewMatrix, this.position, target, [0, 1, 0]);
    Mat4.perspective(this.projMatrix, (this.fov * Math.PI) / 180, aspect, this.near, this.far);
    Mat4.multiply(this.viewProjMatrix, this.projMatrix, this.viewMatrix);

    // Extract 6 frustum planes
    this.frustum.update(this.viewProjMatrix);
  }
}

// ============================================================================
// Renderer Class
// ============================================================================

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const { gl, isWebGL2, vaoExt, idxExt } = initWebGL(canvas);
    this.gl = gl;
    this.isWebGL2 = isWebGL2;
    this.vaoExt = vaoExt;
    this.idxExt = idxExt;

    this.camera = new Camera();
    this.atlas = new TextureSynthesizer();
    this.atlasTexture = this.atlas.buildAndUpload(this.gl);

    // Compile Shader Programs
    this.initChunkShader();
    this.initWireframeShader();
    this.initCrackShader();

    // Environment & Lighting Configuration
    this.sunlight = 1.0; // 0.05 (night) to 1.0 (midday)
    this.dimension = 0;  // 0: Overworld, -1: Nether, 1: The End
    this.fogColor = new Float32Array([0.65, 0.80, 1.00]);
    this.fogStart = 48.0;
    this.fogEnd = 96.0;

    // Performance Stats
    this.stats = {
      fps: 60,
      frameTime: 0,
      chunksTotal: 0,
      chunksRendered: 0,
      triangles: 0,
      drawCalls: 0
    };

    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this.fpsTimer = performance.now();
  }

  initChunkShader() {
    const gl = this.gl;
    const vSrc = this.isWebGL2 ? CHUNK_VERT_300 : CHUNK_VERT_100;
    const fSrc = this.isWebGL2 ? CHUNK_FRAG_300 : CHUNK_FRAG_100;
    this.chunkProgram = createProgram(gl, vSrc, fSrc);

    this.chunkUniforms = getUniformLocations(gl, this.chunkProgram, [
      'u_viewProj',
      'u_chunkPos',
      'u_cameraPos',
      'u_atlas',
      'u_sunlight',
      'u_fogColor',
      'u_fogStart',
      'u_fogEnd'
    ]);
  }

  initWireframeShader() {
    const gl = this.gl;
    this.wireframeProgram = createProgram(gl, WIREFRAME_VERT, WIREFRAME_FRAG);
    this.wireframeUniforms = getUniformLocations(gl, this.wireframeProgram, [
      'u_viewProj',
      'u_offset',
      'u_color'
    ]);

    // 12 edges of a unit cube with subtle offset [-0.002 to 1.002]
    const min = -0.002;
    const max = 1.002;
    const wireVerts = new Float32Array([
      // Bottom 4 edges
      min, min, min,  max, min, min,
      max, min, min,  max, min, max,
      max, min, max,  min, min, max,
      min, min, max,  min, min, min,
      // Top 4 edges
      min, max, min,  max, max, min,
      max, max, min,  max, max, max,
      max, max, max,  min, max, max,
      min, max, max,  min, max, min,
      // Vertical 4 edges
      min, min, min,  min, max, min,
      max, min, min,  max, max, min,
      max, min, max,  max, max, max,
      min, min, max,  min, max, max
    ]);

    this.wireframeVBO = createBuffer(gl, gl.ARRAY_BUFFER, wireVerts, gl.STATIC_DRAW);
  }

  initCrackShader() {
    const gl = this.gl;
    this.crackProgram = createProgram(gl, CRACK_VERT, CRACK_FRAG);
    this.crackUniforms = getUniformLocations(gl, this.crackProgram, [
      'u_viewProj',
      'u_offset',
      'u_atlas',
      'u_tileOffsetU',
      'u_tileOffsetV'
    ]);

    // 6-face unit cube vertices with UVs [0..1]
    // 4 vertices per face * 6 faces * (3 pos + 2 uv = 5 floats) = 120 floats
    const cubeVerts = [];
    const cubeIndices = [];
    const min = -0.001;
    const max = 1.001;

    // +Y, -Y, +Z, -Z, +X, -X
    const faceCorners = [
      [[min,max,max],[max,max,max],[max,max,min],[min,max,min]], // +Y
      [[min,min,min],[max,min,min],[max,min,max],[min,min,max]], // -Y
      [[min,min,max],[max,min,max],[max,max,max],[min,max,max]], // +Z
      [[max,min,min],[min,min,min],[min,max,min],[max,max,min]], // -Z
      [[max,min,max],[max,min,min],[max,max,min],[max,max,max]], // +X
      [[min,min,min],[min,min,max],[min,max,max],[min,max,min]]  // -X
    ];

    const uvs = [[0,0],[1,0],[1,1],[0,1]];
    let vertCount = 0;

    for (let f = 0; f < 6; f++) {
      const corners = faceCorners[f];
      for (let c = 0; c < 4; c++) {
        cubeVerts.push(corners[c][0], corners[c][1], corners[c][2], uvs[c][0], uvs[c][1]);
      }
      cubeIndices.push(
        vertCount + 0, vertCount + 1, vertCount + 2,
        vertCount + 2, vertCount + 3, vertCount + 0
      );
      vertCount += 4;
    }

    this.crackVBO = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(cubeVerts), gl.STATIC_DRAW);
    this.crackIBO = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeIndices), gl.STATIC_DRAW);
  }

  // ==========================================================================
  // Dimension & Sky Settings
  // ==========================================================================

  setDimension(dimension) {
    this.dimension = dimension;
    if (dimension === 0) {
      // Overworld
      this.fogColor.set([0.65, 0.80, 1.00]);
    } else if (dimension === -1) {
      // The Nether: deep fiery crimson
      this.fogColor.set([0.18, 0.02, 0.02]);
    } else if (dimension === 1) {
      // The End: deep celestial void
      this.fogColor.set([0.04, 0.03, 0.06]);
    }
  }

  setSunlight(val) {
    this.sunlight = Math.max(0.05, Math.min(1.0, val));
    if (this.dimension === 0) {
      // Dynamic Overworld sky / fog color modulated by sunlight
      const r = 0.65 * this.sunlight;
      const g = 0.80 * this.sunlight;
      const b = Math.max(0.08, 1.00 * this.sunlight);
      this.fogColor.set([r, g, b]);
    }
  }

  // ==========================================================================
  // Frame Render Passes
  // ==========================================================================

  /**
   * Main render method executing all multi-pass drawing.
   * @param {ChunkSection[]} sections - List of active chunk sections
   * @param {object} highlight - Optional targeted block info { x, y, z }
   * @param {object} damage - Optional breaking block info { x, y, z, stage: 0..9 }
   */
  render(sections, highlight = null, damage = null) {
    const gl = this.gl;
    const now = performance.now();
    const dt = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Update FPS counter
    this.frameCount++;
    if (now - this.fpsTimer >= 500) {
      this.stats.fps = Math.round((this.frameCount * 1000) / (now - this.fpsTimer));
      this.frameCount = 0;
      this.fpsTimer = now;
    }
    this.stats.frameTime = dt;
    this.stats.chunksTotal = sections.length;
    this.stats.chunksRendered = 0;
    this.stats.triangles = 0;
    this.stats.drawCalls = 0;

    // Update Camera & View Frustum
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    this.camera.update(aspect);

    // ========================================================================
    // PASS 1: Sky & Atmosphere
    // ========================================================================
    gl.clearColor(this.fogColor[0], this.fogColor[1], this.fogColor[2], 1.0);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Filter chunk sections using Camera View Frustum Culling
    const visibleSections = [];
    const frustum = this.camera.frustum;

    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      // Frustum AABB culling
      const minX = sec.cx * 16;
      const minY = sec.cy * 16;
      const minZ = sec.cz * 16;
      const maxX = minX + 16;
      const maxY = minY + 16;
      const maxZ = minZ + 16;

      if (frustum.intersectsAABB(minX, minY, minZ, maxX, maxY, maxZ)) {
        visibleSections.push(sec);
      }
    }
    this.stats.chunksRendered = visibleSections.length;

    // ========================================================================
    // PASS 2 & 3: Opaque Chunk Terrain & Cutout Foliage
    // ========================================================================
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.disable(gl.BLEND);

    gl.useProgram(this.chunkProgram);

    // Uniforms
    gl.uniformMatrix4fv(this.chunkUniforms.u_viewProj, false, this.camera.viewProjMatrix);
    gl.uniform3fv(this.chunkUniforms.u_cameraPos, this.camera.position);
    gl.uniform1f(this.chunkUniforms.u_sunlight, this.sunlight);
    gl.uniform3fv(this.chunkUniforms.u_fogColor, this.fogColor);
    gl.uniform1f(this.chunkUniforms.u_fogStart, this.fogStart);
    gl.uniform1f(this.chunkUniforms.u_fogEnd, this.fogEnd);

    // Bind Procedural Texture Atlas to Unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
    gl.uniform1i(this.chunkUniforms.u_atlas, 0);

    for (let i = 0; i < visibleSections.length; i++) {
      const sec = visibleSections[i];
      const mesh = sec.mesh;
      if (!mesh || mesh.opaqueIndexCount === 0) continue;

      gl.uniform3f(this.chunkUniforms.u_chunkPos, sec.cx * 16, sec.cy * 16, sec.cz * 16);
      VAO.bind(gl, this.isWebGL2, this.vaoExt, mesh.vao);

      gl.drawElements(gl.TRIANGLES, mesh.opaqueIndexCount, gl.UNSIGNED_INT, 0);
      this.stats.triangles += mesh.opaqueIndexCount / 3;
      this.stats.drawCalls++;
    }

    // ========================================================================
    // PASS 4: Translucent Fluids & Glass (Alpha Blending)
    // ========================================================================
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    // Translucent surfaces write color with depth testing, but disable depth mask to prevent occluding other water
    gl.depthMask(false);

    for (let i = 0; i < visibleSections.length; i++) {
      const sec = visibleSections[i];
      const mesh = sec.mesh;
      if (!mesh || mesh.transIndexCount === 0) continue;

      gl.uniform3f(this.chunkUniforms.u_chunkPos, sec.cx * 16, sec.cy * 16, sec.cz * 16);
      VAO.bind(gl, this.isWebGL2, this.vaoExt, mesh.vao);

      gl.drawElements(gl.TRIANGLES, mesh.transIndexCount, gl.UNSIGNED_INT, mesh.transOffsetBytes);
      this.stats.triangles += mesh.transIndexCount / 3;
      this.stats.drawCalls++;
    }

    gl.depthMask(true);
    gl.disable(gl.BLEND);
    VAO.bind(gl, this.isWebGL2, this.vaoExt, null);

    // ========================================================================
    // PASS 5: Targeted Block Outline Wireframe
    // ========================================================================
    if (highlight) {
      this.renderHighlight(highlight.x, highlight.y, highlight.z);
    }

    // ========================================================================
    // PASS 6: Block Destruction Mining Cracks Overlay
    // ========================================================================
    if (damage && damage.stage >= 0 && damage.stage < 10) {
      this.renderDamageCrack(damage.x, damage.y, damage.z, damage.stage);
    }
  }

  renderHighlight(bx, by, bz) {
    const gl = this.gl;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    gl.useProgram(this.wireframeProgram);
    gl.uniformMatrix4fv(this.wireframeUniforms.u_viewProj, false, this.camera.viewProjMatrix);
    gl.uniform3f(this.wireframeUniforms.u_offset, bx, by, bz);
    gl.uniform4f(this.wireframeUniforms.u_color, 0.0, 0.0, 0.0, 0.8);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.wireframeVBO);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);

    gl.drawArrays(gl.LINES, 0, 24);
    this.stats.drawCalls++;
  }

  renderDamageCrack(bx, by, bz, stage) {
    const gl = this.gl;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Polygon offset prevents z-fighting against the block face
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(-1.0, -1.0);

    gl.useProgram(this.crackProgram);
    gl.uniformMatrix4fv(this.crackUniforms.u_viewProj, false, this.camera.viewProjMatrix);
    gl.uniform3f(this.crackUniforms.u_offset, bx, by, bz);

    const slotId = TILE_SLOTS.destroy_0 + stage;
    const tileU = (slotId % 16) * 0.0625;
    const tileV = Math.floor(slotId / 16) * 0.0625;

    gl.uniform1f(this.crackUniforms.u_tileOffsetU, tileU);
    gl.uniform1f(this.crackUniforms.u_tileOffsetV, tileV);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
    gl.uniform1i(this.crackUniforms.u_atlas, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.crackVBO);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.crackIBO);
    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);

    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.disable(gl.BLEND);
    this.stats.drawCalls++;
  }
}
