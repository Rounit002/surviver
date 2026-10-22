/**
 * Pure JavaScript 3D Math Engine for Minecraft Voxel Renderer.
 * Zero external dependencies. High performance using Float32Array.
 */

// ============================================================================
// Vec3: 3D Vector Operations
// ============================================================================
export const Vec3 = {
  create(x = 0, y = 0, z = 0) {
    const out = new Float32Array(3);
    out[0] = x;
    out[1] = y;
    out[2] = z;
    return out;
  },

  clone(a) {
    const out = new Float32Array(3);
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    return out;
  },

  copy(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    return out;
  },

  set(out, x, y, z) {
    out[0] = x;
    out[1] = y;
    out[2] = z;
    return out;
  },

  add(out, a, b) {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    out[2] = a[2] + b[2];
    return out;
  },

  sub(out, a, b) {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    out[2] = a[2] - b[2];
    return out;
  },

  multiply(out, a, b) {
    out[0] = a[0] * b[0];
    out[1] = a[1] * b[1];
    out[2] = a[2] * b[2];
    return out;
  },

  scale(out, a, s) {
    out[0] = a[0] * s;
    out[1] = a[1] * s;
    out[2] = a[2] * s;
    return out;
  },

  dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  },

  cross(out, a, b) {
    const ax = a[0], ay = a[1], az = a[2];
    const bx = b[0], by = b[1], bz = b[2];
    out[0] = ay * bz - az * by;
    out[1] = az * bx - ax * bz;
    out[2] = ax * by - ay * bx;
    return out;
  },

  length(a) {
    return Math.hypot(a[0], a[1], a[2]);
  },

  lengthSq(a) {
    return a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
  },

  distance(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  },

  distanceSq(a, b) {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    const dz = a[2] - b[2];
    return dx * dx + dy * dy + dz * dz;
  },

  normalize(out, a) {
    const len = Math.hypot(a[0], a[1], a[2]);
    if (len > 0.000001) {
      const invLen = 1 / len;
      out[0] = a[0] * invLen;
      out[1] = a[1] * invLen;
      out[2] = a[2] * invLen;
    } else {
      out[0] = 0;
      out[1] = 0;
      out[2] = 0;
    }
    return out;
  },

  lerp(out, a, b, t) {
    out[0] = a[0] + t * (b[0] - a[0]);
    out[1] = a[1] + t * (b[1] - a[1]);
    out[2] = a[2] + t * (b[2] - a[2]);
    return out;
  },

  transformMat4(out, a, m) {
    const x = a[0], y = a[1], z = a[2];
    let w = m[3] * x + m[7] * y + m[11] * z + m[15];
    w = w || 1.0;
    out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
    return out;
  }
};

// ============================================================================
// Mat4: Column-Major 4x4 Matrix Operations
// ============================================================================
export const Mat4 = {
  create() {
    const out = new Float32Array(16);
    out[0] = 1; out[5] = 1; out[10] = 1; out[15] = 1;
    return out;
  },

  clone(a) {
    const out = new Float32Array(16);
    out.set(a);
    return out;
  },

  copy(out, a) {
    out.set(a);
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

  ortho(out, left, right, bottom, top, near, far) {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);
    out[0] = -2 * lr; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = -2 * bt; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = 2 * nf; out[11] = 0;
    out[12] = (left + right) * lr;
    out[13] = (top + bottom) * bt;
    out[14] = (far + near) * nf;
    out[15] = 1;
    return out;
  },

  lookAt(out, eye, target, up) {
    let z0 = eye[0] - target[0], z1 = eye[1] - target[1], z2 = eye[2] - target[2];
    let len = 1 / Math.hypot(z0, z1, z2);
    z0 *= len; z1 *= len; z2 *= len;

    let x0 = up[1] * z2 - up[2] * z1;
    let x1 = up[2] * z0 - up[0] * z2;
    let x2 = up[0] * z1 - up[1] * z0;
    len = Math.hypot(x0, x1, x2);
    if (!len) {
      x0 = 1; x1 = 0; x2 = 0;
    } else {
      len = 1 / len;
      x0 *= len; x1 *= len; x2 *= len;
    }

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
    out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    return out;
  },

  invert(out, a) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;

    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1.0 / det;

    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
  },

  translate(out, a, v) {
    const x = v[0], y = v[1], z = v[2];
    if (a === out) {
      out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
      out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
      out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
      out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
    } else {
      const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
      const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
      const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
      out[0] = a00; out[1] = a01; out[2] = a02; out[3] = a03;
      out[4] = a10; out[5] = a11; out[6] = a12; out[7] = a13;
      out[8] = a20; out[9] = a21; out[10] = a22; out[11] = a23;
      out[12] = a00 * x + a10 * y + a20 * z + a[12];
      out[13] = a01 * x + a11 * y + a21 * z + a[13];
      out[14] = a02 * x + a12 * y + a22 * z + a[14];
      out[15] = a03 * x + a13 * y + a23 * z + a[15];
    }
    return out;
  },

  scale(out, a, v) {
    const x = v[0], y = v[1], z = v[2];
    out[0] = a[0] * x;
    out[1] = a[1] * x;
    out[2] = a[2] * x;
    out[3] = a[3] * x;
    out[4] = a[4] * y;
    out[5] = a[5] * y;
    out[6] = a[6] * y;
    out[7] = a[7] * y;
    out[8] = a[8] * z;
    out[9] = a[9] * z;
    out[10] = a[10] * z;
    out[11] = a[11] * z;
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
    return out;
  },

  fromTranslation(out, v) {
    out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = 1; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = 1; out[11] = 0;
    out[12] = v[0]; out[13] = v[1]; out[14] = v[2]; out[15] = 1;
    return out;
  },

  rotateX(out, a, rad) {
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    if (a !== out) {
      out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; out[3] = a[3];
      out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
    }
    out[4] = a10 * c + a20 * s;
    out[5] = a11 * c + a21 * s;
    out[6] = a12 * c + a22 * s;
    out[7] = a13 * c + a23 * s;
    out[8] = a20 * c - a10 * s;
    out[9] = a21 * c - a11 * s;
    out[10] = a22 * c - a12 * s;
    out[11] = a23 * c - a13 * s;
    return out;
  },

  rotateY(out, a, rad) {
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    if (a !== out) {
      out[4] = a[4]; out[5] = a[5]; out[6] = a[6]; out[7] = a[7];
      out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
    }
    out[0] = a00 * c - a20 * s;
    out[1] = a01 * c - a21 * s;
    out[2] = a02 * c - a22 * s;
    out[3] = a03 * c - a23 * s;
    out[8] = a00 * s + a20 * c;
    out[9] = a01 * s + a21 * c;
    out[10] = a02 * s + a22 * c;
    out[11] = a03 * s + a23 * c;
    return out;
  },

  rotateZ(out, a, rad) {
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    if (a !== out) {
      out[8] = a[8]; out[9] = a[9]; out[10] = a[10]; out[11] = a[11];
      out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
    }
    out[0] = a00 * c + a10 * s;
    out[1] = a01 * c + a11 * s;
    out[2] = a02 * c + a12 * s;
    out[3] = a03 * c + a13 * s;
    out[4] = a10 * c - a00 * s;
    out[5] = a11 * c - a01 * s;
    out[6] = a12 * c - a02 * s;
    out[7] = a13 * c - a03 * s;
    return out;
  }
};

// ============================================================================
// Frustum: 6-Plane Camera Frustum for Culling
// ============================================================================
export class Frustum {
  constructor() {
    // 6 planes: [nx, ny, nz, d] for Left, Right, Bottom, Top, Near, Far
    this.planes = new Float32Array(24);
  }

  /**
   * Extract frustum planes from View-Projection matrix using Gribb-Hartmann method.
   * @param {Float32Array} m - View-Projection matrix
   */
  update(m) {
    const p = this.planes;
    // Left: row3 + row0
    p[0]  = m[3]  + m[0];
    p[1]  = m[7]  + m[4];
    p[2]  = m[11] + m[8];
    p[3]  = m[15] + m[12];

    // Right: row3 - row0
    p[4]  = m[3]  - m[0];
    p[5]  = m[7]  - m[4];
    p[6]  = m[11] - m[8];
    p[7]  = m[15] - m[12];

    // Bottom: row3 + row1
    p[8]  = m[3]  + m[1];
    p[9]  = m[7]  + m[5];
    p[10] = m[11] + m[9];
    p[11] = m[15] + m[13];

    // Top: row3 - row1
    p[12] = m[3]  - m[1];
    p[13] = m[7]  - m[5];
    p[14] = m[11] - m[9];
    p[15] = m[15] - m[13];

    // Near: row3 + row2
    p[16] = m[3]  + m[2];
    p[17] = m[7]  + m[6];
    p[18] = m[11] + m[10];
    p[19] = m[15] + m[14];

    // Far: row3 - row2
    p[20] = m[3]  - m[2];
    p[21] = m[7]  - m[6];
    p[22] = m[11] - m[10];
    p[23] = m[15] - m[14];

    // Normalize each plane normal
    for (let i = 0; i < 24; i += 4) {
      const len = Math.hypot(p[i], p[i + 1], p[i + 2]);
      if (len > 0.000001) {
        const invLen = 1.0 / len;
        p[i]     *= invLen;
        p[i + 1] *= invLen;
        p[i + 2] *= invLen;
        p[i + 3] *= invLen;
      }
    }
  }

  /**
   * Fast AABB intersection test with the 6 frustum planes.
   * Returns true if AABB is inside or intersects frustum.
   */
  intersectsAABB(minX, minY, minZ, maxX, maxY, maxZ) {
    const p = this.planes;
    for (let i = 0; i < 24; i += 4) {
      const nx = p[i], ny = p[i + 1], nz = p[i + 2], d = p[i + 3];
      // Positive vertex in direction of normal
      const px = nx > 0 ? maxX : minX;
      const py = ny > 0 ? maxY : minY;
      const pz = nz > 0 ? maxZ : minZ;
      if (nx * px + ny * py + nz * pz + d < 0) {
        return false; // Completely outside this plane
      }
    }
    return true;
  }

  containsPoint(x, y, z) {
    const p = this.planes;
    for (let i = 0; i < 24; i += 4) {
      if (p[i] * x + p[i + 1] * y + p[i + 2] * z + p[i + 3] < 0) {
        return false;
      }
    }
    return true;
  }
}

// ============================================================================
// AABB: Axis-Aligned Bounding Box
// ============================================================================
export class AABB {
  constructor(minX = 0, minY = 0, minZ = 0, maxX = 0, maxY = 0, maxZ = 0) {
    this.minX = minX;
    this.minY = minY;
    this.minZ = minZ;
    this.maxX = maxX;
    this.maxY = maxY;
    this.maxZ = maxZ;
  }

  set(minX, minY, minZ, maxX, maxY, maxZ) {
    this.minX = minX;
    this.minY = minY;
    this.minZ = minZ;
    this.maxX = maxX;
    this.maxY = maxY;
    this.maxZ = maxZ;
    return this;
  }

  clone() {
    return new AABB(this.minX, this.minY, this.minZ, this.maxX, this.maxY, this.maxZ);
  }

  copy(other) {
    this.minX = other.minX;
    this.minY = other.minY;
    this.minZ = other.minZ;
    this.maxX = other.maxX;
    this.maxY = other.maxY;
    this.maxZ = other.maxZ;
    return this;
  }

  offset(dx, dy, dz) {
    this.minX += dx;
    this.maxX += dx;
    this.minY += dy;
    this.maxY += dy;
    this.minZ += dz;
    this.maxZ += dz;
    return this;
  }

  expand(dx, dy, dz) {
    if (dx < 0) this.minX += dx; else this.maxX += dx;
    if (dy < 0) this.minY += dy; else this.maxY += dy;
    if (dz < 0) this.minZ += dz; else this.maxZ += dz;
    return this;
  }

  intersects(other) {
    return (
      this.maxX > other.minX &&
      this.minX < other.maxX &&
      this.maxY > other.minY &&
      this.minY < other.maxY &&
      this.maxZ > other.minZ &&
      this.minZ < other.maxZ
    );
  }

  containsPoint(x, y, z) {
    return (
      x >= this.minX && x <= this.maxX &&
      y >= this.minY && y <= this.maxY &&
      z >= this.minZ && z <= this.maxZ
    );
  }
}
