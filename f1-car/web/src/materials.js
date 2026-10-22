// Re-creates the Blender material library (f1car/materials.py) for the browser.
// GLB carries geometry + material *names*; everything visual is defined here, by name.
import * as THREE from 'three';

export const palette = {
  base: '#06080c', baseEdge: '#0b1428', accent: '#ff4310', accentDeep: '#b81e00',
  white: '#eeebe4', tyreBand: '#e02631', caliper: '#d9a21b',
};

// Shared uniforms so the accent can be re-coloured live (livery + accent paint + wing tips)
export const U = {
  uBase: { value: new THREE.Color(palette.base) },
  uEdge: { value: new THREE.Color(palette.baseEdge) },
  uAccent: { value: new THREE.Color(palette.accent) },
  uDeep: { value: new THREE.Color(palette.accentDeep) },
  uWhite: { value: new THREE.Color(palette.white) },
};

// ---------------------------------------------------------------- shader plumbing
const LOCAL_VERT_PARS = /* glsl */ `varying vec3 vLocalPos; varying vec3 vLocalNrm;`;

function attachLocal(shader) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\n' + LOCAL_VERT_PARS)
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalPos = position; vLocalNrm = normal;');
}

const FRAG_PARS = /* glsl */ `
varying vec3 vLocalPos; varying vec3 vLocalNrm;
// glTF (y up, -z = car left) -> car frame used by the Blender model (x fwd, y left, z up)
vec3 toCar(vec3 p){ return vec3(p.x, -p.z, p.y); }
`;

// 2x2 twill: returns vec2(height, tone) for planar coordinates already scaled to cells
const TWILL = /* glsl */ `
vec2 twill(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float k = mod(i.x + i.y + 4000.0, 4.0);
  float warp = step(k, 1.5);
  float hv = pow(sin(3.14159265 * f.y), 0.55), hu = pow(sin(3.14159265 * f.x), 0.55);
  float h = mix(hu, hv, warp);
  float tone = (0.70 + 0.30 * warp) * (0.5 + 0.5 * h);
  return vec2(h, tone);
}
vec2 carbonTri(vec3 p, vec3 n, float scale){
  vec3 w = pow(abs(n), vec3(6.0)); w /= (w.x + w.y + w.z + 1e-5);
  const float r = 0.70710678;
  vec2 a = twill(vec2(p.y + p.z, p.y - p.z) * scale * r);
  vec2 b = twill(vec2(p.x + p.z, p.x - p.z) * scale * r);
  vec2 c = twill(vec2(p.x + p.y, p.x - p.y) * scale * r);
  return a * w.x + b * w.y + c * w.z;
}
vec3 perturbN(vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float faceDir){
  vec3 sx = dFdx(surfPos), sy = dFdy(surfPos);
  vec3 R1 = cross(sy, surfNorm), R2 = cross(surfNorm, sx);
  float det = dot(sx, R1) * faceDir;
  vec3 grad = sign(det) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(det) * surfNorm - grad);
}
`;

function carbon({ matte = false, dark = 1.0 } = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0x0b0b0d,
    metalness: 0.0, roughness: matte ? 0.55 : 0.26,
    clearcoat: matte ? 0.0 : 1.0, clearcoatRoughness: 0.03, specularIntensity: matte ? 0.35 : 0.8,
  });
  m.color.multiplyScalar(dark);
  m.onBeforeCompile = (shader) => {
    attachLocal(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_PARS + TWILL)
      .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
        float wDist = length(vViewPosition);
        float wFade = 1.0 - smoothstep(0.7, 3.2, wDist);
        vec2 wv = carbonTri(vLocalPos, normalize(vLocalNrm), 210.0);
        diffuseColor.rgb *= mix(1.0, 0.35 + 0.65 * wv.y * 1.35, wFade * 0.9);`)
      .replace('#include <normal_fragment_maps>', /* glsl */ `#include <normal_fragment_maps>
        {
          vec2 dH = vec2(dFdx(wv.x), dFdy(wv.x)) * 0.10 * wFade;
          normal = perturbN(-vViewPosition, normal, dH, faceDirection);
        }`);
  };
  return m;
}

// ---------------------------------------------------------------- livery paint
export function makeLivery(decals) {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0.55, roughness: 0.2, clearcoat: 1.0, clearcoatRoughness: 0.015,
  });
  const samplers = decals.map((_, i) => `uniform sampler2D uD${i};`).join('\n');
  let decalCode = '';
  decals.forEach((d, i) => {
    const w = d.width.toFixed(5), h = (d.width * d.aspect).toFixed(5);
    const cx = d.center[0].toFixed(5), cy = d.center[1].toFixed(5);
    const col = new THREE.Color(d.color);
    const c = `vec3(${col.r.toFixed(5)}, ${col.g.toFixed(5)}, ${col.b.toFixed(5)})`;
    if (d.plane === 'side') {
      decalCode += `
      { float sg = sign(bp.y);
        vec2 uv = vec2((bp.x - ${cx}) * (-sg) / ${w} + 0.5, (bp.z - ${cy}) / ${h} + 0.5);
        float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
        float gate = smoothstep(0.12, 0.38, bn.y * sg) * smoothstep(${(d.ymin - 0.01).toFixed(4)}, ${d.ymin.toFixed(4)}, abs(bp.y));
        float a = texture2D(uD${i}, uv).a * inside * gate;
        diffuseColor.rgb = mix(diffuseColor.rgb, ${c}, a); paintMask = max(paintMask, a); }`;
    } else {
      decalCode += `
      { vec2 uv = vec2((bp.y - ${cy}) * (-1.0) / ${w} + 0.5, (bp.x - ${cx}) / ${h} + 0.5);
        float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
        float gate = smoothstep(0.15, 0.4, bn.z);
        float a = texture2D(uD${i}, uv).a * inside * gate;
        diffuseColor.rgb = mix(diffuseColor.rgb, ${c}, a); paintMask = max(paintMask, a); }`;
    }
  });

  m.onBeforeCompile = (shader) => {
    attachLocal(shader);
    Object.assign(shader.uniforms, U);
    decals.forEach((d, i) => { shader.uniforms['uD' + i] = { value: d.texture }; });
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uBase, uEdge, uAccent, uDeep, uWhite;
        ${samplers}
        ${FRAG_PARS}
        float band(float u, float lo, float hi){ float s = 0.0035;
          return smoothstep(lo - s, lo + s, u) * (1.0 - smoothstep(hi - s, hi + s, u)); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float paintMask = 0.0;
        {
          vec3 bp = toCar(vLocalPos);
          vec3 bn = toCar(normalize(vLocalNrm));
          float u = bp.x - 0.85 * bp.z;
          float facing = 1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition)));
          vec3 col = mix(uBase, uEdge, pow(facing, 2.2));
          float sash = band(u, -1.12, -0.55);
          vec3 tone = mix(uDeep, uAccent, smoothstep(-1.12, -0.55, u));
          col = mix(col, tone, sash);
          col = mix(col, uWhite, band(u, -1.20, -1.165));
          col = mix(col, uWhite, band(u, -0.515, -0.500));
          col = mix(col, uAccent, band(u, -1.72, -1.62));
          float nose = smoothstep(1.66, 1.68, u);
          col = mix(col, uAccent, nose);
          col = mix(col, uWhite, band(u, 1.60, 1.625));
          paintMask = max(sash, nose);
          diffuseColor.rgb = col;
          ${decalCode}
        }`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor *= (1.0 - paintMask);`);
  };
  return m;
}

// ---------------------------------------------------------------- misc special shaders
function helmet() {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.02 });
  m.onBeforeCompile = (shader) => {
    attachLocal(shader);
    Object.assign(shader.uniforms, U);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec3 uAccent, uWhite;\n${FRAG_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        { vec3 p = toCar(vLocalPos) - vec3(0.16, 0.0, 0.705);
          float u = p.z * 1.2 + p.x * 0.9;
          float flash = 1.0 - smoothstep(0.030, 0.038, abs(u - 0.035));
          float line = 1.0 - smoothstep(0.006, 0.009, abs(p.y));
          vec3 c = mix(uWhite, uAccent, flash);
          c = mix(c, vec3(0.006), line * smoothstep(-0.02, 0.02, p.z));
          diffuseColor.rgb = c; }`);
  };
  return m;
}

function exhaust() {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: 0.3 });
  m.onBeforeCompile = (shader) => {
    attachLocal(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        { float x = toCar(vLocalPos).x;
          float t = smoothstep(-2.42, -2.66, x);
          vec3 silver = vec3(0.27), straw = vec3(0.34, 0.20, 0.05), violet = vec3(0.06, 0.02, 0.09), blue = vec3(0.01, 0.02, 0.10);
          vec3 c = mix(silver, straw, smoothstep(0.0, 0.35, t));
          c = mix(c, violet, smoothstep(0.35, 0.7, t)); c = mix(c, blue, smoothstep(0.7, 1.0, t));
          diffuseColor.rgb = c; }`);
  };
  return m;
}

function accentPaint() {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.03 });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uAccent;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = uAccent;');
  };
  return m;
}

const std = (o) => new THREE.MeshPhysicalMaterial(o);
const emissive = (hex, i) => std({ color: 0x000000, emissive: new THREE.Color(hex), emissiveIntensity: i, roughness: 0.5 });

export function buildLibrary(decals) {
  const lib = {
    Carbon_Gloss: carbon(),
    Carbon_Matte: carbon({ matte: true }),
    Carbon_Underside: carbon({ matte: true, dark: 0.6 }),
    Body_Livery: makeLivery(decals),
    Paint_Ember: accentPaint(),
    Paint_Bone: std({ color: palette.white, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.03 }),
    Paint_PianoBlack: std({ color: 0x040405, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.02 }),
    Titanium: std({ color: 0x8a8c90, metalness: 1, roughness: 0.34 }),
    Steel: std({ color: 0xc4c7cc, metalness: 1, roughness: 0.26 }),
    Steel_Dark: std({ color: 0x3a3c40, metalness: 1, roughness: 0.35 }),
    Alu_Anodised: std({ color: 0x4a4e57, metalness: 0.9, roughness: 0.38 }),
    Alu_Raw: std({ color: 0xd2d4d8, metalness: 1, roughness: 0.22 }),
    Caliper_Gold: std({ color: palette.caliper, metalness: 0.8, roughness: 0.28 }),
    Caliper_Paint: std({ color: palette.caliper, metalness: 0.5, roughness: 0.28, clearcoat: 1 }),
    Wheel_Forged: std({ color: 0x2b2b30, metalness: 0.9, roughness: 0.3 }),
    Brake_Disc: std({ color: 0x3b3835, metalness: 0.6, roughness: 0.45 }),
    Tyre_Tread: std({ color: 0x151516, roughness: 0.82, sheen: 0.15 }),
    Tyre_Sidewall: std({ color: 0x18181a, roughness: 0.86, sheen: 0.15 }),
    Tyre_Band: std({ color: palette.tyreBand, roughness: 0.6 }),
    Tyre_Text: std({ color: 0xf0f0f0, roughness: 0.6 }),
    Exhaust_Inconel: exhaust(),
    Seat_Fabric: std({ color: 0x0f0f11, roughness: 0.9, sheen: 0.6 }),
    Padding_Foam: std({ color: 0x1a1a1e, roughness: 0.92, sheen: 0.5 }),
    Padding_Accent: std({ color: 0x8a1a0a, roughness: 0.9, sheen: 0.5 }),
    Helmet_Visor: std({ color: 0x08090c, metalness: 0.9, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0 }),
    Helmet_Paint: helmet(),
    Steering_Display: emissive(0x36ff7a, 2.4),
    Mirror_Glass: std({ color: 0xd2d6dc, metalness: 1, roughness: 0.015 }),
    LED_Red: emissive(0xff1010, 5),
    LED_Green: emissive(0x20ff60, 3),
    LED_Blue: emissive(0x3070ff, 3),
    Rubber_Black: std({ color: 0x0d0d0e, roughness: 0.7 }),
    Intake_Dark: std({ color: 0x020203, roughness: 0.9 }),
    Decal_White: std({ color: palette.white, roughness: 0.4 }),
    Decal_Orange: accentPaint(),
    Camera_Lens: std({ color: 0x050608, metalness: 0.9, roughness: 0.03, clearcoat: 1 }),
  };
  lib.Carbon_Gloss.name = 'Carbon_Gloss';
  return lib;
}
