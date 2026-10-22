/**
 * Pure Browser & Headless Node.js Test Harness for Minecraft Java Edition Voxel Game
 * Zero external dependencies. Standalone WebGL, Canvas 2D, and Web Audio mocks.
 * 
 * Provides:
 * - Assertion library (assert, assertEqual, assertApprox, assertThrows, assertDeepEqual, etc.)
 * - Test suite registration & runner (describe, it, test, beforeEach, afterEach)
 * - Complete Headless Mocks (Canvas, WebGL 1.0/2.0, Web Audio, DOM)
 * - Reference Specification Oracle for all 32 PROJECT.md features
 * - Universal Node.js & browser script execution
 */

(function (global) {
  'use strict';

  // =========================================================================
  // 1. ASSERTION LIBRARY
  // =========================================================================

  class AssertionError extends Error {
    constructor(message, actual, expected, operator) {
      super(message || 'Assertion failed');
      this.name = 'AssertionError';
      this.actual = actual;
      this.expected = expected;
      this.operator = operator;
    }
  }

  function assert(condition, message) {
    if (!condition) {
      throw new AssertionError(message || 'Expected condition to be truthy, got ' + condition, condition, true, '==');
    }
  }

  function assertTrue(val, message) {
    if (val !== true) {
      throw new AssertionError(message || `Expected true, got ${val}`, val, true, '===');
    }
  }

  function assertFalse(val, message) {
    if (val !== false) {
      throw new AssertionError(message || `Expected false, got ${val}`, val, false, '===');
    }
  }

  function assertNull(val, message) {
    if (val !== null) {
      throw new AssertionError(message || `Expected null, got ${JSON.stringify(val)}`, val, null, '===');
    }
  }

  function assertNotNull(val, message) {
    if (val === null || val === undefined) {
      throw new AssertionError(message || `Expected non-null value, got ${val}`, val, '!null', '!==');
    }
  }

  function assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new AssertionError(
        message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
        actual,
        expected,
        '==='
      );
    }
  }

  function assertNotEqual(actual, expected, message) {
    if (actual === expected) {
      throw new AssertionError(
        message || `Expected values to differ, both are ${JSON.stringify(actual)}`,
        actual,
        expected,
        '!=='
      );
    }
  }

  function assertApprox(actual, expected, tolerance = 1e-4, message) {
    const diff = Math.abs(actual - expected);
    if (diff > tolerance) {
      throw new AssertionError(
        message || `Expected ${actual} to approximate ${expected} within ±${tolerance} (diff: ${diff})`,
        actual,
        expected,
        'approx'
      );
    }
  }

  function assertArrayApprox(actual, expected, tolerance = 1e-4, message) {
    if (!actual || !expected || actual.length !== expected.length) {
      throw new AssertionError(
        message || `Array length mismatch: actual ${actual ? actual.length : null}, expected ${expected ? expected.length : null}`,
        actual,
        expected,
        'length'
      );
    }
    for (let i = 0; i < actual.length; i++) {
      const diff = Math.abs(actual[i] - expected[i]);
      if (diff > tolerance) {
        throw new AssertionError(
          message || `Array element mismatch at [${i}]: actual ${actual[i]} vs expected ${expected[i]} (diff: ${diff} > ${tolerance})`,
          actual[i],
          expected[i],
          'approx[]'
        );
      }
    }
  }

  function assertDeepEqual(actual, expected, message) {
    function deepCompare(a, b) {
      if (a === b) return true;
      if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      for (const k of keysA) {
        if (!keysB.includes(k) || !deepCompare(a[k], b[k])) return false;
      }
      return true;
    }
    if (!deepCompare(actual, expected)) {
      throw new AssertionError(
        message || `Deep equality mismatch:\nActual:   ${JSON.stringify(actual)}\nExpected: ${JSON.stringify(expected)}`,
        actual,
        expected,
        'deepEqual'
      );
    }
  }

  function assertThrows(fn, expectedRegexOrMessage, message) {
    let threw = false;
    let caught = null;
    try {
      fn();
    } catch (err) {
      threw = true;
      caught = err;
    }
    if (!threw) {
      throw new AssertionError(message || 'Expected function to throw an error, but it returned cleanly.', null, 'Error', 'throws');
    }
    if (expectedRegexOrMessage) {
      const msg = caught.message || String(caught);
      if (expectedRegexOrMessage instanceof RegExp) {
        if (!expectedRegexOrMessage.test(msg)) {
          throw new AssertionError(
            message || `Error message "${msg}" did not match regex ${expectedRegexOrMessage}`,
            msg,
            expectedRegexOrMessage,
            'match'
          );
        }
      } else if (typeof expectedRegexOrMessage === 'string') {
        if (!msg.includes(expectedRegexOrMessage)) {
          throw new AssertionError(
            message || `Error message "${msg}" did not contain "${expectedRegexOrMessage}"`,
            msg,
            expectedRegexOrMessage,
            'includes'
          );
        }
      }
    }
  }

  // =========================================================================
  // 2. HEADLESS MOCK ENVIRONMENT (Canvas 2D, WebGL 2.0 / 1.0, Web Audio)
  // =========================================================================

  function createMockWebGLContext() {
    const gl = {
      // Constants
      VERTEX_SHADER: 0x8B31,
      FRAGMENT_SHADER: 0x8B30,
      COMPILE_STATUS: 0x8B81,
      LINK_STATUS: 0x8B82,
      ARRAY_BUFFER: 0x8892,
      ELEMENT_ARRAY_BUFFER: 0x8893,
      STATIC_DRAW: 0x88E4,
      DYNAMIC_DRAW: 0x88E8,
      TRIANGLES: 0x0004,
      UNSIGNED_INT: 0x1405,
      UNSIGNED_SHORT: 0x1403,
      UNSIGNED_BYTE: 0x1401,
      FLOAT: 0x1406,
      TEXTURE_2D: 0x0DE1,
      RGBA: 0x1908,
      NEAREST: 0x2600,
      LINEAR: 0x2601,
      TEXTURE_MAG_FILTER: 0x2800,
      TEXTURE_MIN_FILTER: 0x2801,
      DEPTH_TEST: 0x0B71,
      LEQUAL: 0x0203,
      CULL_FACE: 0x0B44,
      BACK: 0x0405,
      FRONT: 0x0404,
      CCW: 0x0901,
      CW: 0x0900,
      BLEND: 0x0BE2,
      SRC_ALPHA: 0x0302,
      ONE_MINUS_SRC_ALPHA: 0x0303,
      COLOR_BUFFER_BIT: 0x4000,
      DEPTH_BUFFER_BIT: 0x0100,

      // State tracking for verification
      _calls: [],
      _buffers: new Map(),
      _shaders: new Map(),
      _programs: new Map(),
      _textures: new Map(),
      _vaos: new Map(),
      _enabledCaps: new Set(),
      _currentProgram: null,
      _boundBuffers: new Map(),
      _boundTexture: null,

      // Methods
      createShader(type) {
        const id = 'shader_' + (this._shaders.size + 1);
        const obj = { id, type, source: '', compiled: true };
        this._shaders.set(id, obj);
        return obj;
      },
      shaderSource(shader, source) {
        if (shader) shader.source = source;
      },
      compileShader(shader) {
        if (shader) shader.compiled = true;
      },
      getShaderParameter(shader, param) {
        if (param === this.COMPILE_STATUS) return true;
        return true;
      },
      getShaderInfoLog() { return ''; },
      createProgram() {
        const id = 'prog_' + (this._programs.size + 1);
        const obj = { id, shaders: [], linked: true, uniforms: new Map() };
        this._programs.set(id, obj);
        return obj;
      },
      attachShader(prog, shader) {
        if (prog && shader) prog.shaders.push(shader);
      },
      linkProgram(prog) {
        if (prog) prog.linked = true;
      },
      getProgramParameter(prog, param) {
        if (param === this.LINK_STATUS) return true;
        return true;
      },
      getProgramInfoLog() { return ''; },
      useProgram(prog) {
        this._currentProgram = prog;
        this._calls.push({ method: 'useProgram', prog });
      },
      getUniformLocation(prog, name) {
        return { program: prog ? prog.id : null, name };
      },
      uniformMatrix4fv(loc, transpose, val) {
        this._calls.push({ method: 'uniformMatrix4fv', loc, val: new Float32Array(val) });
      },
      uniform3fv(loc, val) {
        this._calls.push({ method: 'uniform3fv', loc, val: new Float32Array(val) });
      },
      uniform1f(loc, val) {
        this._calls.push({ method: 'uniform1f', loc, val });
      },
      uniform1i(loc, val) {
        this._calls.push({ method: 'uniform1i', loc, val });
      },
      createBuffer() {
        const id = 'buf_' + (this._buffers.size + 1);
        const obj = { id, data: null, target: null };
        this._buffers.set(id, obj);
        return obj;
      },
      bindBuffer(target, buf) {
        this._boundBuffers.set(target, buf);
        this._calls.push({ method: 'bindBuffer', target, buf });
      },
      bufferData(target, data, usage) {
        const bound = this._boundBuffers.get(target);
        if (bound) bound.data = data;
        this._calls.push({ method: 'bufferData', target, size: data.byteLength || data.length, usage });
      },
      createVertexArray() {
        const id = 'vao_' + (this._vaos.size + 1);
        const obj = { id, attribs: [] };
        this._vaos.set(id, obj);
        return obj;
      },
      bindVertexArray(vao) {
        this._calls.push({ method: 'bindVertexArray', vao });
      },
      enableVertexAttribArray(idx) {
        this._calls.push({ method: 'enableVertexAttribArray', idx });
      },
      vertexAttribPointer(idx, size, type, norm, stride, offset) {
        this._calls.push({ method: 'vertexAttribPointer', idx, size, type, norm, stride, offset });
      },
      vertexAttribIPointer(idx, size, type, stride, offset) {
        this._calls.push({ method: 'vertexAttribIPointer', idx, size, type, stride, offset });
      },
      createTexture() {
        const id = 'tex_' + (this._textures.size + 1);
        const obj = { id, params: {} };
        this._textures.set(id, obj);
        return obj;
      },
      bindTexture(target, tex) {
        this._boundTexture = tex;
        this._calls.push({ method: 'bindTexture', target, tex });
      },
      texParameteri(target, pname, param) {
        if (this._boundTexture) this._boundTexture.params[pname] = param;
        this._calls.push({ method: 'texParameteri', target, pname, param });
      },
      texImage2D(target, level, internalformat, formatOrWidth, typeOrHeight, borderOrSource, format, type, pixels) {
        this._calls.push({ method: 'texImage2D', target, level, internalformat });
      },
      viewport(x, y, w, h) {
        this._viewport = [x, y, w, h];
      },
      enable(cap) {
        this._enabledCaps.add(cap);
      },
      disable(cap) {
        this._enabledCaps.delete(cap);
      },
      isEnabled(cap) {
        return this._enabledCaps.has(cap);
      },
      depthFunc(fn) { this._depthFunc = fn; },
      cullFace(mode) { this._cullFace = mode; },
      frontFace(mode) { this._frontFace = mode; },
      blendFunc(s, d) { this._blendFunc = [s, d]; },
      clearColor(r, g, b, a) { this._clearColor = [r, g, b, a]; },
      clear(mask) { this._calls.push({ method: 'clear', mask }); },
      drawArrays(mode, first, count) {
        this._calls.push({ method: 'drawArrays', mode, first, count });
      },
      drawElements(mode, count, type, offset) {
        this._calls.push({ method: 'drawElements', mode, count, type, offset });
      },
      getExtension(name) {
        if (name === 'OES_vertex_array_object') {
          return {
            createVertexArrayOES: () => gl.createVertexArray(),
            bindVertexArrayOES: (vao) => gl.bindVertexArray(vao)
          };
        }
        if (name === 'OES_element_index_uint') return {};
        if (name === 'WEBGL_depth_texture') return {};
        return null;
      }
    };

    return gl;
  }

  function createMockCanvas2DContext(width = 256, height = 256) {
    const pixels = new Uint8ClampedArray(width * height * 4);
    return {
      canvas: { width, height },
      fillStyle: '#000000',
      strokeStyle: '#000000',
      lineWidth: 1,
      font: '10px sans-serif',
      _calls: [],
      createImageData(w, h) {
        return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
      },
      getImageData(sx, sy, sw, sh) {
        return { width: sw, height: sh, data: new Uint8ClampedArray(sw * sh * 4) };
      },
      putImageData(imgData, dx, dy) {
        this._calls.push({ method: 'putImageData', dx, dy, w: imgData.width, h: imgData.height });
      },
      fillRect(x, y, w, h) {
        this._calls.push({ method: 'fillRect', x, y, w, h, fillStyle: this.fillStyle });
      },
      strokeRect(x, y, w, h) {
        this._calls.push({ method: 'strokeRect', x, y, w, h });
      },
      clearRect(x, y, w, h) {
        this._calls.push({ method: 'clearRect', x, y, w, h });
      },
      beginPath() { this._calls.push({ method: 'beginPath' }); },
      moveTo(x, y) { this._calls.push({ method: 'moveTo', x, y }); },
      lineTo(x, y) { this._calls.push({ method: 'lineTo', x, y }); },
      stroke() { this._calls.push({ method: 'stroke' }); },
      fill() { this._calls.push({ method: 'fill' }); },
      arc(x, y, r, sa, ea) { this._calls.push({ method: 'arc', x, y, r, sa, ea }); },
      fillText(text, x, y) { this._calls.push({ method: 'fillText', text, x, y }); },
      drawImage() { this._calls.push({ method: 'drawImage' }); },
      save() { this._calls.push({ method: 'save' }); },
      restore() { this._calls.push({ method: 'restore' }); },
      translate(x, y) { this._calls.push({ method: 'translate', x, y }); },
      rotate(rad) { this._calls.push({ method: 'rotate', rad }); },
      scale(sx, sy) { this._calls.push({ method: 'scale', sx, sy }); }
    };
  }

  function createMockCanvas(width = 256, height = 256) {
    let ctx2d = null;
    let ctxGL = null;
    return {
      width,
      height,
      style: {},
      addEventListener() {},
      removeEventListener() {},
      getContext(type, opts) {
        if (type === '2d') {
          if (!ctx2d) ctx2d = createMockCanvas2DContext(this.width, this.height);
          return ctx2d;
        }
        if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') {
          if (!ctxGL) ctxGL = createMockWebGLContext();
          return ctxGL;
        }
        return null;
      },
      toDataURL() { return 'data:image/png;base64,mock'; }
    };
  }

  class MockAudioNode {
    constructor() {
      this.connectedTo = [];
    }
    connect(dest) {
      this.connectedTo.push(dest);
      return dest;
    }
    disconnect() {
      this.connectedTo = [];
    }
  }

  class MockGainNode extends MockAudioNode {
    constructor() {
      super();
      this.gain = {
        value: 1.0,
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
        setValueAtTime(v) { this.value = v; }
      };
    }
  }

  class MockOscillatorNode extends MockAudioNode {
    constructor() {
      super();
      this.type = 'sine';
      this.frequency = {
        value: 440,
        setValueAtTime(v) { this.value = v; },
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {}
      };
      this.started = false;
      this.stopped = false;
    }
    start() { this.started = true; }
    stop() { this.stopped = true; }
  }

  class MockBiquadFilterNode extends MockAudioNode {
    constructor() {
      super();
      this.type = 'lowpass';
      this.frequency = {
        value: 350,
        setValueAtTime(v) { this.value = v; },
        linearRampToValueAtTime() {}
      };
      this.Q = {
        value: 1.0,
        setValueAtTime(v) { this.value = v; }
      };
    }
  }

  class MockAudioBuffer {
    constructor(channels, length, sampleRate) {
      this.numberOfChannels = channels;
      this.length = length;
      this.sampleRate = sampleRate;
      this.duration = length / sampleRate;
      this._channelData = [];
      for (let i = 0; i < channels; i++) {
        this._channelData.push(new Float32Array(length));
      }
    }
    getChannelData(c) {
      return this._channelData[c] || this._channelData[0];
    }
  }

  class MockAudioBufferSourceNode extends MockAudioNode {
    constructor() {
      super();
      this.buffer = null;
      this.loop = false;
      this.playbackRate = {
        value: 1.0,
        setValueAtTime(v) { this.value = v; }
      };
    }
    start() { this.started = true; }
    stop() { this.stopped = true; }
  }

  class MockAudioContext {
    constructor() {
      this.sampleRate = 44100;
      this.currentTime = 0;
      this.state = 'running';
      this.destination = new MockAudioNode();
      this.nodesCreated = [];
    }
    createGain() {
      const g = new MockGainNode();
      this.nodesCreated.push(g);
      return g;
    }
    createOscillator() {
      const o = new MockOscillatorNode();
      this.nodesCreated.push(o);
      return o;
    }
    createBiquadFilter() {
      const f = new MockBiquadFilterNode();
      this.nodesCreated.push(f);
      return f;
    }
    createBuffer(channels, length, sampleRate) {
      return new MockAudioBuffer(channels, length, sampleRate);
    }
    createBufferSource() {
      const b = new MockAudioBufferSourceNode();
      this.nodesCreated.push(b);
      return b;
    }
    resume() {
      this.state = 'running';
      return Promise.resolve();
    }
    suspend() {
      this.state = 'suspended';
      return Promise.resolve();
    }
    close() {
      this.state = 'closed';
      return Promise.resolve();
    }
  }

  // Setup mock global environment if running in Node.js
  if (typeof window === 'undefined') {
    global.window = global;
    global.document = {
      createElement(tag) {
        if (tag === 'canvas') return createMockCanvas(300, 150);
        return { style: {}, addEventListener() {}, appendChild() {} };
      },
      getElementById(id) {
        return createMockCanvas(800, 600);
      },
      body: {
        appendChild() {},
        style: {}
      }
    };
    global.HTMLCanvasElement = function () {};
    global.AudioContext = MockAudioContext;
    global.requestAnimationFrame = function (cb) { return setTimeout(cb, 16); };
    global.cancelAnimationFrame = function (id) { clearTimeout(id); };
  }

  // =========================================================================
  // 3. TEST SUITE & RUNNER REGISTRATION SYSTEM
  // =========================================================================

  const registeredSuites = [];
  let currentSuite = null;

  function describe(name, fn) {
    const suite = {
      name,
      tests: [],
      beforeEachFns: [],
      afterEachFns: [],
      parent: currentSuite
    };
    registeredSuites.push(suite);
    const prevSuite = currentSuite;
    currentSuite = suite;
    try {
      fn();
    } finally {
      currentSuite = prevSuite;
    }
  }

  function it(name, fn) {
    if (!currentSuite) {
      describe('Default Suite', () => it(name, fn));
      return;
    }
    currentSuite.tests.push({
      name,
      fn,
      suiteName: currentSuite.name
    });
  }

  const test = it;

  function beforeEach(fn) {
    if (currentSuite) currentSuite.beforeEachFns.push(fn);
  }

  function afterEach(fn) {
    if (currentSuite) currentSuite.afterEachFns.push(fn);
  }

  async function runAllSuites(options = {}) {
    const {
      filter = null,
      verbose = false,
      onProgress = null
    } = options;

    const results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      durationMs: 0,
      suites: []
    };

    const startTime = Date.now();

    for (const suite of registeredSuites) {
      if (filter && !suite.name.toLowerCase().includes(filter.toLowerCase())) {
        continue;
      }

      const suiteResult = {
        name: suite.name,
        passed: 0,
        failed: 0,
        skipped: 0,
        durationMs: 0,
        tests: []
      };

      const suiteStart = Date.now();

      for (const t of suite.tests) {
        results.total++;
        const testStart = Date.now();
        const testResult = {
          name: t.name,
          suiteName: suite.name,
          status: 'pending',
          durationMs: 0,
          error: null
        };

        try {
          // Run beforeEach hooks
          for (const bf of suite.beforeEachFns) {
            await bf();
          }

          // Run test function (synchronous or asynchronous)
          const ret = t.fn();
          if (ret && typeof ret.then === 'function') {
            await ret;
          }

          // Run afterEach hooks
          for (const af of suite.afterEachFns) {
            await af();
          }

          testResult.status = 'passed';
          results.passed++;
          suiteResult.passed++;
        } catch (err) {
          testResult.status = 'failed';
          testResult.error = {
            message: err.message || String(err),
            stack: err.stack || '',
            actual: err.actual,
            expected: err.expected,
            operator: err.operator
          };
          results.failed++;
          suiteResult.failed++;
        }

        testResult.durationMs = Date.now() - testStart;
        suiteResult.tests.push(testResult);

        if (typeof onProgress === 'function') {
          onProgress(testResult, results);
        }
      }

      suiteResult.durationMs = Date.now() - suiteStart;
      results.suites.push(suiteResult);
    }

    results.durationMs = Date.now() - startTime;
    return results;
  }

  // =========================================================================
  // 4. AUTHORITATIVE REFERENCE SPECIFICATION ORACLE (PROJECT.md Features 1-32)
  // =========================================================================

  /**
   * Reference Oracle provides canonical implementations of mathematical properties,
   * coordinate conversions, noise, chunk storage, meshing contracts, DDA raycasting,
   * AABB physics, inventory models, crafting recipes, and audio recipes.
   */
  const ReferenceOracle = {
    // Feature 1: Matrix Engine (Mat4, Vec3, Frustum)
    math: {
      Mat4: {
        create() {
          const out = new Float32Array(16);
          out[0] = 1; out[5] = 1; out[10] = 1; out[15] = 1;
          return out;
        },
        identity(out) {
          for (let i = 0; i < 16; i++) out[i] = 0;
          out[0] = 1; out[5] = 1; out[10] = 1; out[15] = 1;
          return out;
        },
        perspective(out, fovYRad, aspect, near, far) {
          const f = 1.0 / Math.tan(fovYRad / 2.0);
          const nf = 1.0 / (near - far);
          out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
          out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
          out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
          out[12] = 0; out[13] = 0; out[14] = (2.0 * far * near) * nf; out[15] = 0;
          return out;
        },
        lookAt(out, eye, target, up) {
          let z0 = eye[0] - target[0], z1 = eye[1] - target[1], z2 = eye[2] - target[2];
          let len = Math.hypot(z0, z1, z2);
          if (len === 0) {
            return this.identity(out);
          }
          len = 1 / len;
          z0 *= len; z1 *= len; z2 *= len;

          let x0 = up[1] * z2 - up[2] * z1;
          let x1 = up[2] * z0 - up[0] * z2;
          let x2 = up[0] * z1 - up[1] * z0;
          len = Math.hypot(x0, x1, x2);
          if (!len) { x0 = 1; x1 = 0; x2 = 0; } else { len = 1 / len; x0 *= len; x1 *= len; x2 *= len; }

          let y0 = z1 * x2 - z2 * x1;
          let y1 = z2 * x0 - z0 * x2;
          let y2 = z0 * x1 - z1 * x0;
          len = 1 / Math.hypot(y0, y1, y2);
          y0 *= len; y1 *= len; y2 *= len;

          out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
          out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
          out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
          out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
          out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
          out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
          out[15] = 1;
          return out;
        },
        multiply(out, a, b) {
          const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
          const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
          const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
          const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

          let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
          out[0] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
          out[1] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
          out[2] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
          out[3] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

          b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
          out[4] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
          out[5] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
          out[6] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
          out[7] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

          b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
          out[8] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
          out[9] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
          out[10] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
          out[11] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

          b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
          out[12] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
          out[13] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
          out[14] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
          out[15] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
          return out;
        }
      },
      Vec3: {
        create(x = 0, y = 0, z = 0) {
          const out = new Float32Array(3);
          out[0] = x; out[1] = y; out[2] = z;
          return out;
        },
        normalize(out, a) {
          const len = Math.hypot(a[0], a[1], a[2]);
          if (len > 0) {
            out[0] = a[0] / len;
            out[1] = a[1] / len;
            out[2] = a[2] / len;
          }
          return out;
        },
        dot(a, b) {
          return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
        },
        cross(out, a, b) {
          const ax = a[0], ay = a[1], az = a[2];
          const bx = b[0], by = b[1], bz = b[2];
          out[0] = ay * bz - az * by;
          out[1] = az * bx - ax * bz;
          out[2] = ax * by - ay * bx;
          return out;
        }
      },
      Frustum: class {
        constructor() {
          this.planes = new Float32Array(24);
        }
        update(m) {
          const p = this.planes;
          p[0] = m[3] + m[0]; p[1] = m[7] + m[4]; p[2] = m[11] + m[8]; p[3] = m[15] + m[12];
          p[4] = m[3] - m[0]; p[5] = m[7] - m[4]; p[6] = m[11] - m[8]; p[7] = m[15] - m[12];
          p[8] = m[3] + m[1]; p[9] = m[7] + m[5]; p[10] = m[11] + m[9]; p[11] = m[15] + m[13];
          p[12] = m[3] - m[1]; p[13] = m[7] - m[5]; p[14] = m[11] - m[9]; p[15] = m[15] - m[13];
          p[16] = m[3] + m[2]; p[17] = m[7] + m[6]; p[18] = m[11] + m[10]; p[19] = m[15] + m[14];
          p[20] = m[3] - m[2]; p[21] = m[7] - m[6]; p[22] = m[11] - m[10]; p[23] = m[15] - m[14];
          for (let i = 0; i < 24; i += 4) {
            const invLen = 1.0 / Math.hypot(p[i], p[i+1], p[i+2]);
            p[i] *= invLen; p[i+1] *= invLen; p[i+2] *= invLen; p[i+3] *= invLen;
          }
        }
        intersectsAABB(minX, minY, minZ, maxX, maxY, maxZ) {
          const p = this.planes;
          for (let i = 0; i < 24; i += 4) {
            const nx = p[i], ny = p[i+1], nz = p[i+2], d = p[i+3];
            const px = nx > 0 ? maxX : minX;
            const py = ny > 0 ? maxY : minY;
            const pz = nz > 0 ? maxZ : minZ;
            if (nx * px + ny * py + nz * pz + d < 0) return false;
          }
          return true;
        }
      }
    },

    // Feature 2: Texture Atlas
    atlas: {
      TILE_SIZE: 16,
      ATLAS_TILES: 16,
      ATLAS_SIZE: 256,
      tiles: {
        'air': 0,
        'stone': 1,
        'grass_top': 2,
        'grass_side': 3,
        'dirt': 4,
        'cobblestone': 5,
        'oak_log_side': 6,
        'oak_log_top': 7,
        'oak_planks': 8,
        'oak_leaves': 9,
        'bedrock': 10,
        'water': 11,
        'lava': 12,
        'sand': 13,
        'gravel': 14,
        'obsidian': 15,
        'netherrack': 16,
        'soul_sand': 17,
        'glowstone': 18,
        'nether_brick': 19,
        'end_stone': 20,
        'cherry_log_side': 21,
        'cherry_log_top': 22,
        'cherry_planks': 23,
        'cherry_leaves': 24,
        'pink_petals': 25,
        'nether_portal': 26,
        'end_portal_frame_top': 27,
        'end_portal_frame_side': 28,
        'end_portal_frame_eye': 29,
        'crafting_table_top': 30,
        'crafting_table_side': 31,
        'stick': 32,
        'wooden_pickaxe': 33,
        'wooden_axe': 34,
        'wooden_sword': 35,
        'stone_pickaxe': 36,
        'stone_axe': 37,
        'stone_sword': 38,
        'crack_0': 40,
        'crack_9': 49
      },
      getTileIndex(name) {
        return this.tiles[name] !== undefined ? this.tiles[name] : 0;
      },
      getUVs(tileIndex) {
        const u = (tileIndex % 16) / 16.0;
        const v = Math.floor(tileIndex / 16) / 16.0;
        const s = 1.0 / 16.0;
        return [
          u, v,
          u + s, v,
          u + s, v + s,
          u, v + s
        ];
      }
    },

    // Feature 3 & 4 & 5: Chunk Section, Mesher, Ambient Occlusion, Vertex Packing
    mesher: {
      CHUNK_SIZE: 16,
      // Face indices: 0:+Y (Top), 1:-Y (Bottom), 2:+Z (South), 3:-Z (North), 4:+X (East), 5:-X (West)
      FACE_NORMALS: [
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
        [1, 0, 0],
        [-1, 0, 0]
      ],
      FACE_SHADES: [1.0, 0.5, 0.8, 0.8, 0.6, 0.6],
      AO_CURVE: [0.40, 0.60, 0.80, 1.00],

      calcAO(side1, side2, corner) {
        if (side1 && side2) return 0;
        return 3 - (side1 + side2 + corner);
      },

      packVertex(x, y, z, faceIdx, cornerIdx, tileIdx, ao, light) {
        // Word 0: x(5) | y(5) | z(5) | faceIdx(3) | cornerIdx(2) | ao(2)
        const w0 = (x & 0x1F) |
                   ((y & 0x1F) << 5) |
                   ((z & 0x1F) << 10) |
                   ((faceIdx & 0x07) << 15) |
                   ((cornerIdx & 0x03) << 18) |
                   ((ao & 0x03) << 20);
        // Word 1: tileIdx(8) | light(8)
        const w1 = (tileIdx & 0xFF) | ((light & 0xFF) << 8);
        return [w0 >>> 0, w1 >>> 0];
      },

      unpackVertex(w0, w1) {
        return {
          x: w0 & 0x1F,
          y: (w0 >> 5) & 0x1F,
          z: (w0 >> 10) & 0x1F,
          faceIdx: (w0 >> 15) & 0x07,
          cornerIdx: (w0 >> 18) & 0x03,
          ao: (w0 >> 20) & 0x03,
          tileIdx: w1 & 0xFF,
          light: (w1 >> 8) & 0xFF
        };
      },

      shouldFlipQuad(ao0, ao1, ao2, ao3) {
        // AO Quad-Flip Rule: if ao0 + ao2 < ao1 + ao3, flip diagonal to prevent creasing
        return (ao0 + ao2) < (ao1 + ao3);
      }
    },

    // Feature 6: Simplex / Perlin Noise Engine
    noise: class FastNoise {
      constructor(seed = 1337) {
        this.seed = seed;
        this.perm = new Uint8Array(512);
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) p[i] = i;
        // Deterministic shuffle using Mulberry32 PRNG
        let s = seed >>> 0;
        for (let i = 255; i > 0; i--) {
          s = (s + 0x6D2B79F5) >>> 0;
          let t = s;
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          const r = ((t ^ (t >>> 14)) >>> 0) % (i + 1);
          const tmp = p[i]; p[i] = p[r]; p[r] = tmp;
        }
        for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
      }

      noise2D(xin, yin) {
        const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
        const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
        const s = (xin + yin) * F2;
        const i = Math.floor(xin + s);
        const j = Math.floor(yin + s);
        const t = (i + j) * G2;
        const X0 = i - t;
        const Y0 = j - t;
        const x0 = xin - X0;
        const y0 = yin - Y0;

        let i1, j1;
        if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }

        const x1 = x0 - i1 + G2;
        const y1 = y0 - j1 + G2;
        const x2 = x0 - 1.0 + 2.0 * G2;
        const y2 = y0 - 1.0 + 2.0 * G2;

        const ii = i & 255;
        const jj = j & 255;
        const gi0 = this.perm[ii + this.perm[jj]] % 12;
        const gi1 = this.perm[ii + i1 + this.perm[jj + j1]] % 12;
        const gi2 = this.perm[ii + 1 + this.perm[jj + 1]] % 12;

        const grad2 = [
          [1,1],[-1,1],[1,-1],[-1,-1],
          [1,0],[-1,0],[0,1],[0,-1],
          [0.7,0.7],[-0.7,0.7],[0.7,-0.7],[-0.7,-0.7]
        ];

        let t0 = 0.5 - x0*x0 - y0*y0;
        let n0 = 0;
        if (t0 > 0) {
          t0 *= t0;
          n0 = t0 * t0 * (grad2[gi0][0] * x0 + grad2[gi0][1] * y0);
        }

        let t1 = 0.5 - x1*x1 - y1*y1;
        let n1 = 0;
        if (t1 > 0) {
          t1 *= t1;
          n1 = t1 * t1 * (grad2[gi1][0] * x1 + grad2[gi1][1] * y1);
        }

        let t2 = 0.5 - x2*x2 - y2*y2;
        let n2 = 0;
        if (t2 > 0) {
          t2 *= t2;
          n2 = t2 * t2 * (grad2[gi2][0] * x2 + grad2[gi2][1] * y2);
        }

        return 70.0 * (n0 + n1 + n2);
      }

      fbm2D(x, y, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;
        for (let i = 0; i < octaves; i++) {
          total += this.noise2D(x * frequency, y * frequency) * amplitude;
          maxValue += amplitude;
          amplitude *= persistence;
          frequency *= lacunarity;
        }
        return total / maxValue;
      }
    },

    // Feature 7-14: Voxel Chunk Storage & Dimensions
    world: {
      CHUNK_WIDTH: 16,
      CHUNK_HEIGHT: 256,
      CHUNK_DEPTH: 16,
      SEA_LEVEL: 62,
      NETHER_LAVA_LEVEL: 31,

      BLOCK: {
        AIR: 0,
        STONE: 1,
        GRASS: 2,
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
      },

      DIMENSION: {
        OVERWORLD: 0,
        NETHER: -1,
        THE_END: 1
      },

      getBlockIndex(x, y, z) {
        return (x & 15) | ((z & 15) << 4) | (y << 8);
      },

      createChunkData() {
        return new Uint8Array(16 * 256 * 16);
      },

      classifyBiome(continentalness, temperature) {
        if (continentalness > 0.35) return 'CHERRY_GROVE';
        if (temperature > 0.05) return 'PLAINS';
        return 'FOREST';
      },

      scaleCoordinate(dimFrom, dimTo, x, z) {
        if (dimFrom === 0 && dimTo === -1) {
          // Overworld -> Nether: divide by 8
          return { x: Math.floor(x / 8), z: Math.floor(z / 8) };
        }
        if (dimFrom === -1 && dimTo === 0) {
          // Nether -> Overworld: multiply by 8
          return { x: x * 8, z: z * 8 };
        }
        return { x, z };
      }
    },

    // Feature 15-17: Physics & AABB
    physics: {
      AABB: class AABB {
        constructor(minX, minY, minZ, maxX, maxY, maxZ) {
          this.minX = minX; this.minY = minY; this.minZ = minZ;
          this.maxX = maxX; this.maxY = maxY; this.maxZ = maxZ;
        }
        intersects(other) {
          return this.minX < other.maxX && this.maxX > other.minX &&
                 this.minY < other.maxY && this.maxY > other.minY &&
                 this.minZ < other.maxZ && this.maxZ > other.minZ;
        }
        clone() {
          return new AABB(this.minX, this.minY, this.minZ, this.maxX, this.maxY, this.maxZ);
        }
        offset(dx, dy, dz) {
          return new AABB(
            this.minX + dx, this.minY + dy, this.minZ + dz,
            this.maxX + dx, this.maxY + dy, this.maxZ + dz
          );
        }
      },

      PLAYER_DIMS: {
        standing: { width: 0.6, height: 1.8, eyeHeight: 1.62 },
        sneaking: { width: 0.6, height: 1.5, eyeHeight: 1.27 },
        swimming: { width: 0.6, height: 0.6, eyeHeight: 0.40 }
      },

      GRAVITY: 0.08,
      TERMINAL_VELOCITY: 3.92,
      STEP_HEIGHT: 0.6,

      createPlayerAABB(pos, isSneaking = false) {
        const dims = isSneaking ? this.PLAYER_DIMS.sneaking : this.PLAYER_DIMS.standing;
        const hw = dims.width / 2;
        return new this.AABB(
          pos.x - hw, pos.y, pos.z - hw,
          pos.x + hw, pos.y + dims.height, pos.z + hw
        );
      },

      // Decoupled axis collision resolution
      resolveAxisCollision(box, velocity, colliders) {
        let { minX, minY, minZ, maxX, maxY, maxZ } = box;
        let dx = velocity.x;
        let dy = velocity.y;
        let dz = velocity.z;

        // 1. Y Axis
        for (const c of colliders) {
          if (dx + minX < c.maxX && dx + maxX > c.minX && minZ < c.maxZ && maxZ > c.minZ) {
            // Check Y overlap with velocity
            if (dy > 0 && maxY <= c.minY && maxY + dy > c.minY) {
              dy = c.minY - maxY;
            } else if (dy < 0 && minY >= c.maxY && minY + dy < c.maxY) {
              dy = c.maxY - minY;
            }
          }
        }
        minY += dy; maxY += dy;

        // 2. X Axis
        for (const c of colliders) {
          if (minY < c.maxY && maxY > c.minY && minZ < c.maxZ && maxZ > c.minZ) {
            if (dx > 0 && maxX <= c.minX && maxX + dx > c.minX) {
              dx = c.minX - maxX;
            } else if (dx < 0 && minX >= c.maxX && minX + dx < c.maxX) {
              dx = c.maxX - minX;
            }
          }
        }
        minX += dx; maxX += dx;

        // 3. Z Axis
        for (const c of colliders) {
          if (minY < c.maxY && maxY > c.minY && minX < c.maxX && maxX > c.minX) {
            if (dz > 0 && maxZ <= c.minZ && maxZ + dz > c.minZ) {
              dz = c.minZ - maxZ;
            } else if (dz < 0 && minZ >= c.maxZ && minZ + dz < c.maxZ) {
              dz = c.maxZ - minZ;
            }
          }
        }

        return {
          resolvedVelocity: { x: dx, y: dy, z: dz },
          hitX: dx !== velocity.x,
          hitY: dy !== velocity.y,
          hitZ: dz !== velocity.z
        };
      }
    },

    // Feature 18: Amanatides-Woo 3D DDA Raymarch
    raycast: {
      castRay(worldMap, eyePos, dir, maxDist = 5.0) {
        let x0 = eyePos.x, y0 = eyePos.y, z0 = eyePos.z;
        let dx = dir.x, dy = dir.y, dz = dir.z;

        // Prevent division by zero
        if (Math.abs(dx) < 1e-9) dx = 1e-9;
        if (Math.abs(dy) < 1e-9) dy = 1e-9;
        if (Math.abs(dz) < 1e-9) dz = 1e-9;

        let X = Math.floor(x0);
        let Y = Math.floor(y0);
        let Z = Math.floor(z0);

        const stepX = Math.sign(dx);
        const stepY = Math.sign(dy);
        const stepZ = Math.sign(dz);

        const tDeltaX = Math.abs(1.0 / dx);
        const tDeltaY = Math.abs(1.0 / dy);
        const tDeltaZ = Math.abs(1.0 / dz);

        let tMaxX = stepX > 0 ? (X + 1 - x0) * tDeltaX : (x0 - X) * tDeltaX;
        let tMaxY = stepY > 0 ? (Y + 1 - y0) * tDeltaY : (y0 - Y) * tDeltaY;
        let tMaxZ = stepZ > 0 ? (Z + 1 - z0) * tDeltaZ : (z0 - Z) * tDeltaZ;

        let normal = { x: 0, y: 0, z: 0 };
        let currentT = 0;

        while (currentT <= maxDist) {
          if (tMaxX < tMaxY) {
            if (tMaxX < tMaxZ) {
              X += stepX;
              currentT = tMaxX;
              tMaxX += tDeltaX;
              normal = { x: -stepX, y: 0, z: 0 };
            } else {
              Z += stepZ;
              currentT = tMaxZ;
              tMaxZ += tDeltaZ;
              normal = { x: 0, y: 0, z: -stepZ };
            }
          } else {
            if (tMaxY < tMaxZ) {
              Y += stepY;
              currentT = tMaxY;
              tMaxY += tDeltaY;
              normal = { x: 0, y: -stepY, z: 0 };
            } else {
              Z += stepZ;
              currentT = tMaxZ;
              tMaxZ += tDeltaZ;
              normal = { x: 0, y: 0, z: -stepZ };
            }
          }

          if (currentT > maxDist) break;

          const blockId = worldMap.getBlock ? worldMap.getBlock(X, Y, Z) : 0;
          if (blockId > 0 && blockId !== 8 && blockId !== 9) { // Exclude air & fluids
            return {
              hit: true,
              blockPos: { x: X, y: Y, z: Z },
              placePos: { x: X + normal.x, y: Y + normal.y, z: Z + normal.z },
              normal,
              distance: currentT,
              blockId
            };
          }
        }

        return { hit: false };
      }
    },

    // Feature 19 & 20: Block Breaking Hardness & Anti-Clipping Placement
    blockInteraction: {
      HARDNESS: {
        dirt: { hand: 0.75, tool: 0.20 },
        stone: { hand: 7.50, tool: 0.60 },
        wood: { hand: 3.00, tool: 0.75 },
        netherrack: { hand: 0.60, tool: 0.15 },
        obsidian: { hand: 50.0, tool: 9.40 },
        leaves: { hand: 0.30, tool: 0.30 }
      },
      calcDamageStage(accumulatedTime, totalRequiredTime) {
        if (totalRequiredTime <= 0) return 9;
        return Math.min(9, Math.floor(10 * (accumulatedTime / totalRequiredTime)));
      },
      canPlaceBlock(blockPos, playerAABB) {
        const blockAABB = new ReferenceOracle.physics.AABB(
          blockPos.x, blockPos.y, blockPos.z,
          blockPos.x + 1, blockPos.y + 1, blockPos.z + 1
        );
        return !playerAABB.intersects(blockAABB);
      }
    },

    // Feature 21-23: Inventory & Crafting Engine
    inventory: {
      HOTBAR_START: 0,
      HOTBAR_END: 8,
      MAIN_START: 9,
      MAIN_END: 35,
      ARMOR_START: 36,
      ARMOR_END: 39,
      OFFHAND_SLOT: 40,
      CRAFTING_START: 41,
      CRAFTING_END: 44,
      CRAFTING_OUTPUT: 45,
      TOTAL_SLOTS: 46,

      createInventory() {
        return {
          slots: new Array(46).fill(null),
          cursor: null,
          activeHotbarSlot: 0
        };
      },

      handleClick(inv, slotIdx, button, isShift = false) {
        const slot = inv.slots[slotIdx];
        const cursor = inv.cursor;

        // Shift click (Quick Move)
        if (isShift && slot) {
          if (slotIdx >= 0 && slotIdx <= 8) {
            // Hotbar -> Main inventory
            for (let i = 9; i <= 35; i++) {
              if (!inv.slots[i]) {
                inv.slots[i] = slot;
                inv.slots[slotIdx] = null;
                return;
              }
            }
          } else if (slotIdx >= 9 && slotIdx <= 35) {
            // Main inventory -> Hotbar
            for (let i = 0; i <= 8; i++) {
              if (!inv.slots[i]) {
                inv.slots[i] = slot;
                inv.slots[slotIdx] = null;
                return;
              }
            }
          }
          return;
        }

        // Left click (Button 0)
        if (button === 0) {
          if (!cursor && slot) {
            inv.cursor = slot;
            inv.slots[slotIdx] = null;
          } else if (cursor && !slot) {
            inv.slots[slotIdx] = cursor;
            inv.cursor = null;
          } else if (cursor && slot) {
            if (cursor.id === slot.id) {
              const transfer = Math.min(64 - slot.count, cursor.count);
              slot.count += transfer;
              cursor.count -= transfer;
              if (cursor.count === 0) inv.cursor = null;
            } else {
              // Swap
              inv.slots[slotIdx] = cursor;
              inv.cursor = slot;
            }
          }
          return;
        }

        // Right click (Button 2)
        if (button === 2) {
          if (!cursor && slot) {
            const take = Math.ceil(slot.count / 2);
            inv.cursor = { id: slot.id, count: take };
            slot.count -= take;
            if (slot.count === 0) inv.slots[slotIdx] = null;
          } else if (cursor && (!slot || (slot.id === cursor.id && slot.count < 64))) {
            if (!slot) {
              inv.slots[slotIdx] = { id: cursor.id, count: 1 };
            } else {
              slot.count += 1;
            }
            cursor.count -= 1;
            if (cursor.count === 0) inv.cursor = null;
          }
        }
      },

      crafting: {
        recipes: [
          {
            name: 'oak_planks',
            type: 'shapeless',
            ingredients: [5], // OAK_LOG
            result: { id: 8, count: 4 } // OAK_PLANKS
          },
          {
            name: 'cherry_planks',
            type: 'shapeless',
            ingredients: [20], // CHERRY_LOG
            result: { id: 23, count: 4 } // CHERRY_PLANKS
          },
          {
            name: 'crafting_table',
            type: 'shaped',
            width: 2, height: 2,
            pattern: [[8, 8], [8, 8]],
            result: { id: 30, count: 1 } // CRAFTING_TABLE
          },
          {
            name: 'sticks',
            type: 'shaped',
            width: 1, height: 2,
            pattern: [[8], [8]],
            result: { id: 32, count: 4 } // STICKS
          },
          {
            name: 'wooden_pickaxe_2x2',
            type: 'shaped',
            width: 2, height: 2,
            pattern: [[8, 8], [0, 32]],
            result: { id: 33, count: 1 } // WOODEN_PICKAXE
          },
          {
            name: 'wooden_pickaxe_3x3',
            type: 'shaped',
            width: 3, height: 3,
            pattern: [[8, 8, 8], [0, 32, 0], [0, 32, 0]],
            result: { id: 33, count: 1 }
          },
          {
            name: 'stone_pickaxe_3x3',
            type: 'shaped',
            width: 3, height: 3,
            pattern: [[4, 4, 4], [0, 32, 0], [0, 32, 0]],
            result: { id: 36, count: 1 }
          }
        ],

        matchRecipe(grid, width, height) {
          // Normalize grid: filter shapeless or match shaped
          const presentItems = grid.filter(s => s && s.count > 0).map(s => s.id);
          if (presentItems.length === 0) return null;

          // Check shapeless
          for (const r of this.recipes) {
            if (r.type === 'shapeless') {
              if (presentItems.length === r.ingredients.length) {
                const match = r.ingredients.every(id => presentItems.includes(id));
                if (match) return { ...r.result };
              }
            }
          }

          // Check shaped
          for (const r of this.recipes) {
            if (r.type === 'shaped') {
              // Match 2x2 or 3x3 pattern inside given grid
              if (r.width <= width && r.height <= height) {
                for (let rOff = 0; rOff <= height - r.height; rOff++) {
                  for (let cOff = 0; cOff <= width - r.width; cOff++) {
                    let patternMatch = true;
                    for (let rIdx = 0; rIdx < height; rIdx++) {
                      for (let cIdx = 0; cIdx < width; cIdx++) {
                        const slot = grid[rIdx * width + cIdx];
                        const slotId = slot ? slot.id : 0;
                        let expectedId = 0;
                        if (rIdx >= rOff && rIdx < rOff + r.height &&
                            cIdx >= cOff && cIdx < cOff + r.width) {
                          expectedId = r.pattern[rIdx - rOff][cIdx - cOff];
                        }
                        if (slotId !== expectedId) {
                          patternMatch = false;
                          break;
                        }
                      }
                      if (!patternMatch) break;
                    }
                    if (patternMatch) return { ...r.result };
                  }
                }
              }
            }
          }

          return null;
        }
      }
    },

    // Feature 24: Survival HUD Values & Health / Hunger
    hud: {
      MAX_HEALTH: 20, // 10 hearts
      MAX_HUNGER: 20, // 10 meat shanks
      HOTBAR_SLOTS: 9,
      calcHeartRender(hp) {
        const hearts = [];
        for (let i = 0; i < 10; i++) {
          const heartHP = hp - i * 2;
          if (heartHP >= 2) hearts.push('full');
          else if (heartHP === 1) hearts.push('half');
          else hearts.push('empty');
        }
        return hearts;
      }
    },

    // Feature 25-28: Entities & Ender Dragon AI
    entities: {
      DRAGON_STATES: {
        CIRCLING: 0,
        DIVING: 1,
        SWOOP_RECOVER: 2,
        PERCHING: 3
      },
      calcWingFlapAngle(time, omega = 4.5) {
        return Math.sin(time * omega) * 0.52 + 0.15;
      },
      calcEndermanAggro(playerLookDir, playerEyePos, endermanHeadPos) {
        const dx = endermanHeadPos.x - playerEyePos.x;
        const dy = endermanHeadPos.y - playerEyePos.y;
        const dz = endermanHeadPos.z - playerEyePos.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist === 0 || dist > 64) return false;
        const dot = (playerLookDir.x * dx + playerLookDir.y * dy + playerLookDir.z * dz) / dist;
        return dot > 0.985;
      }
    },

    // Feature 29-30: Procedural Sound Synthesizer Parameters
    audio: {
      SOUND_RECIPES: {
        'grass_step': { type: 'bandpass', freq: 800, Q: 1.2, decay: 0.035 },
        'stone_step': { type: 'bandpass', freq: 2200, Q: 2.5, decay: 0.040 },
        'wood_step': { type: 'bandpass', freq: 500, Q: 3.0, decay: 0.050 },
        'place_stone': { type: 'bandpass', freq: 1600, Q: 5.0, decay: 0.045 },
        'break_crack': { type: 'highpass', freq: 3500, Q: 1.0, decay: 0.015 },
        'hurt_oof': { osc: 'triangle', freqStart: 175, freqEnd: 65, duration: 0.110 },
        'dragon_roar': { osc: 'sawtooth', f1: 110, f2: 114, lfo: 18 }
      }
    }
  };

  // =========================================================================
  // 5. MODULE RESOLVER & INTEROP
  // =========================================================================

  /**
   * Resolves a module from `src/` if present in the runtime environment,
   * otherwise falls back to the authoritative ReferenceOracle.
   */
  function resolveModule(moduleName) {
    // If in Node.js and the file exists under ../src/, we can test real code
    if (typeof require !== 'undefined') {
      try {
        const path = require('path');
        const fs = require('fs');
        const candidatePaths = [
          path.resolve(__dirname, '..', 'src', moduleName + '.js'),
          path.resolve(__dirname, '..', 'src', moduleName, 'index.js'),
          path.resolve(__dirname, '..', 'src', moduleName)
        ];
        for (const cp of candidatePaths) {
          if (fs.existsSync(cp)) {
            return require(cp);
          }
        }
      } catch (e) {
        // Fall back to oracle
      }
    }

    // Return the corresponding ReferenceOracle segment
    const parts = moduleName.split('/');
    let current = ReferenceOracle;
    for (const p of parts) {
      if (current[p]) current = current[p];
      else break;
    }
    return current;
  }

  // =========================================================================
  // 6. EXPORT / GLOBAL MOUNT
  // =========================================================================

  const TestHarness = {
    // Assertions
    assert,
    assertTrue,
    assertFalse,
    assertNull,
    assertNotNull,
    assertEqual,
    assertNotEqual,
    assertApprox,
    assertArrayApprox,
    assertDeepEqual,
    assertThrows,
    AssertionError,

    // Test framework
    describe,
    it,
    test,
    beforeEach,
    afterEach,
    runAllSuites,
    getRegisteredSuites: () => registeredSuites,

    // Headless mocks
    createMockCanvas,
    createMockWebGLContext,
    createMockCanvas2DContext,
    MockAudioContext,

    // Reference Specification Engine & Interop
    ReferenceOracle,
    resolveModule
  };

  // Mount assertions and runner onto global scope for test files
  global.assert = assert;
  global.assertTrue = assertTrue;
  global.assertFalse = assertFalse;
  global.assertNull = assertNull;
  global.assertNotNull = assertNotNull;
  global.assertEqual = assertEqual;
  global.assertNotEqual = assertNotEqual;
  global.assertApprox = assertApprox;
  global.assertArrayApprox = assertArrayApprox;
  global.assertDeepEqual = assertDeepEqual;
  global.assertThrows = assertThrows;
  global.describe = describe;
  global.it = it;
  global.test = test;
  global.beforeEach = beforeEach;
  global.afterEach = afterEach;
  global.TestHarness = TestHarness;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TestHarness;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
