/**
 * WebGL 2.0 Engine & WebGL 1.0 Fallback Abstraction.
 * Zero external dependencies.
 */

/**
 * Initialize WebGL context with WebGL 2.0 preference and WebGL 1.0 fallback.
 * @param {HTMLCanvasElement} canvas
 * @param {object} customOpts
 * @returns {{ gl: WebGLRenderingContext | WebGL2RenderingContext, isWebGL2: boolean, vaoExt: any, idxExt: any }}
 */
export function initWebGL(canvas, customOpts = {}) {
  const glOpts = {
    alpha: false,
    depth: true,
    stencil: false,
    antialias: false, // Minecraft aesthetic requires crisp pixel rendering
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
    ...customOpts
  };

  let gl = canvas.getContext('webgl2', glOpts);
  let isWebGL2 = Boolean(gl);
  let vaoExt = null;
  let idxExt = null;

  if (!gl) {
    gl = canvas.getContext('webgl', glOpts) || canvas.getContext('experimental-webgl', glOpts);
    if (!gl) {
      throw new Error('WebGL is not supported in this browser.');
    }
    // WebGL 1.0 extensions
    vaoExt = gl.getExtension('OES_vertex_array_object');
    idxExt = gl.getExtension('OES_element_index_uint');
    gl.getExtension('WEBGL_depth_texture');
    gl.getExtension('ANGLE_instanced_arrays');
  }

  // Standard voxel rendering pipeline configuration
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.frontFace(gl.CCW);

  return { gl, isWebGL2, vaoExt, idxExt };
}

/**
 * Compile a single WebGL shader (Vertex or Fragment).
 */
export function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source.trim());
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    const typeName = type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
    gl.deleteShader(shader);
    const numbered = source.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n');
    throw new Error(`Shader compilation error [${typeName}]:\n${info}\nSource:\n${numbered}`);
  }
  return shader;
}

/**
 * Link a vertex and fragment shader into a program.
 */
export function createProgram(gl, vertexSource, fragmentSource) {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  const program = gl.createProgram();
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    throw new Error(`Program link error:\n${info}`);
  }

  // Shaders are linked, detach & mark for deletion to reclaim memory
  gl.detachShader(program, vert);
  gl.detachShader(program, frag);
  gl.deleteShader(vert);
  gl.deleteShader(frag);

  return program;
}

/**
 * Get uniform locations dictionary for program.
 */
export function getUniformLocations(gl, program, uniformNames) {
  const locs = {};
  for (const name of uniformNames) {
    locs[name] = gl.getUniformLocation(program, name);
  }
  return locs;
}

/**
 * Get attribute locations dictionary for program.
 */
export function getAttributeLocations(gl, program, attributeNames) {
  const locs = {};
  for (const name of attributeNames) {
    locs[name] = gl.getAttribLocation(program, name);
  }
  return locs;
}

/**
 * VAO abstraction supporting WebGL 2 and WebGL 1 (OES_vertex_array_object).
 */
export const VAO = {
  create(gl, isWebGL2, vaoExt) {
    if (isWebGL2) {
      return gl.createVertexArray();
    } else if (vaoExt) {
      return vaoExt.createVertexArrayOES();
    }
    return null;
  },

  bind(gl, isWebGL2, vaoExt, vao) {
    if (isWebGL2) {
      gl.bindVertexArray(vao);
    } else if (vaoExt) {
      vaoExt.bindVertexArrayOES(vao);
    }
  },

  delete(gl, isWebGL2, vaoExt, vao) {
    if (!vao) return;
    if (isWebGL2) {
      gl.deleteVertexArray(vao);
    } else if (vaoExt) {
      vaoExt.deleteVertexArrayOES(vao);
    }
  }
};

/**
 * Create a WebGL buffer with data.
 */
export function createBuffer(gl, target, data, usage = gl.STATIC_DRAW) {
  const buf = gl.createBuffer();
  gl.bindBuffer(target, buf);
  gl.bufferData(target, data, usage);
  return buf;
}

/**
 * Update an existing WebGL buffer.
 */
export function updateBuffer(gl, buffer, target, data, usage = gl.STATIC_DRAW) {
  gl.bindBuffer(target, buffer);
  gl.bufferData(target, data, usage);
}

/**
 * Create a 2D texture with pixel-crisp nearest filtering.
 */
export function createTexture2D(gl, source, options = {}) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  const minFilter = options.minFilter !== undefined ? options.minFilter : gl.NEAREST;
  const magFilter = options.magFilter !== undefined ? options.magFilter : gl.NEAREST;
  const wrapS = options.wrapS !== undefined ? options.wrapS : gl.CLAMP_TO_EDGE;
  const wrapT = options.wrapT !== undefined ? options.wrapT : gl.CLAMP_TO_EDGE;

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);

  if (source) {
    if (source.width && source.height && (source.getContext || source instanceof ImageBitmap || (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement))) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } else if (source instanceof ImageData) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, source.width, source.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, source.data);
    } else if (source.data && source.width && source.height) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, source.width, source.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, source.data);
    }
  }

  return texture;
}

/**
 * Fast uniform setters
 */
export function setUniform1i(gl, loc, val) {
  if (loc !== null && loc !== undefined) gl.uniform1i(loc, val);
}

export function setUniform1f(gl, loc, val) {
  if (loc !== null && loc !== undefined) gl.uniform1f(loc, val);
}

export function setUniform2f(gl, loc, x, y) {
  if (loc !== null && loc !== undefined) gl.uniform2f(loc, x, y);
}

export function setUniform3f(gl, loc, x, y, z) {
  if (loc !== null && loc !== undefined) gl.uniform3f(loc, x, y, z);
}

export function setUniform4f(gl, loc, x, y, z, w) {
  if (loc !== null && loc !== undefined) gl.uniform4f(loc, x, y, z, w);
}

export function setUniformMatrix4fv(gl, loc, mat) {
  if (loc !== null && loc !== undefined) gl.uniformMatrix4fv(loc, false, mat);
}

/**
 * Resize WebGL viewport to canvas drawing buffer.
 */
export function resizeViewport(gl, width, height) {
  gl.viewport(0, 0, width, height);
}

/**
 * Clear framebuffer color and depth buffers.
 */
export function clear(gl, r = 0, g = 0, b = 0, a = 1, clearDepth = true) {
  gl.clearColor(r, g, b, a);
  let mask = gl.COLOR_BUFFER_BIT;
  if (clearDepth) {
    gl.clearDepth(1.0);
    mask |= gl.DEPTH_BUFFER_BIT;
  }
  gl.clear(mask);
}
