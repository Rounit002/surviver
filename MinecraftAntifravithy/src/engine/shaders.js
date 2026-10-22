/**
 * GLSL ES 3.00 (WebGL 2.0) and GLSL ES 1.00 (WebGL 1.0) Shaders.
 * Packed chunk vertex format, directional shading, smooth AO curve, distance fog, cutout discard.
 */

// ============================================================================
// WebGL 2.0 (GLSL ES 3.00) Chunk Shaders
// ============================================================================

export const CHUNK_VERT_300 = `#version 300 es
precision highp float;

// Packed vertex attributes: 2 x uint32 (8 bytes total)
layout(location = 0) in uvec2 a_data;

uniform mat4 u_viewProj;
uniform vec3 u_chunkPos;   // Base offset for this 16x16x16 chunk in world space
uniform vec3 u_cameraPos;  // Camera world position for distance fog

out vec2 v_uv;
out float v_ao;
out float v_light;
out float v_faceShade;
out float v_dist;

// Directional face shade factors (Minecraft Java Standard):
// 0: +Y (1.00), 1: -Y (0.50), 2: +Z (0.80), 3: -Z (0.80), 4: +X (0.60), 5: -X (0.60)
const float FACE_SHADES[6] = float[6](1.0, 0.5, 0.8, 0.8, 0.6, 0.6);

// Smooth AO multipliers for AO values 0, 1, 2, 3
const float AO_CURVE[4] = float[4](0.40, 0.60, 0.80, 1.00);

void main() {
    // Unpack Word 0:
    // bits 0..4:   local X (0..16)
    // bits 5..9:   local Y (0..16)
    // bits 10..14: local Z (0..16)
    // bits 15..17: face index (0..5)
    // bits 18..19: quad corner index (0..3)
    uint x = a_data.x & 0x1Fu;
    uint y = (a_data.x >> 5u) & 0x1Fu;
    uint z = (a_data.x >> 10u) & 0x1Fu;
    uint faceIdx = (a_data.x >> 15u) & 0x7u;
    uint corner = (a_data.x >> 18u) & 0x3u;

    // Unpack Word 1:
    // bits 0..9:   texture tile ID (0..1023)
    // bits 10..11: AO (0..3)
    // bits 12..15: Sky Light (0..15)
    // bits 16..19: Block Light (0..15)
    uint texId = a_data.y & 0x3FFu;
    uint ao = (a_data.y >> 10u) & 0x3u;
    uint skyLight = (a_data.y >> 12u) & 0xFu;
    uint blockLight = (a_data.y >> 16u) & 0xFu;

    vec3 worldPos = u_chunkPos + vec3(float(x), float(y), float(z));
    gl_Position = u_viewProj * vec4(worldPos, 1.0);

    // Compute Texture Atlas UVs (16x16 grid on 256x256 atlas = 0.0625 per tile)
    float tileU = float(texId % 16u) * 0.0625;
    float tileV = float(texId / 16u) * 0.0625;

    // Sub-pixel margin prevents texture bleeding between adjacent atlas tiles
    const float EPS = 0.0005;
    const float SPAN = 0.0625 - 2.0 * EPS;

    // Quad corner UV mapping: 0=(0,0), 1=(1,0), 2=(1,1), 3=(0,1)
    float u = (corner == 1u || corner == 2u) ? (tileU + EPS + SPAN) : (tileU + EPS);
    float v = (faceIdx >= 2u)
        ? ((corner == 0u || corner == 1u) ? (tileV + EPS + SPAN) : (tileV + EPS))
        : ((corner == 2u || corner == 3u) ? (tileV + EPS + SPAN) : (tileV + EPS));
    v_uv = vec2(u, v);

    v_ao = AO_CURVE[ao];
    v_faceShade = (faceIdx < 6u) ? FACE_SHADES[faceIdx] : 1.0;

    // Combine light: maximum of modulated skylight and blocklight
    float sLight = float(skyLight) / 15.0;
    float bLight = float(blockLight) / 15.0;
    v_light = max(sLight, bLight);

    v_dist = length(worldPos - u_cameraPos);
}
`;

export const CHUNK_FRAG_300 = `#version 300 es
precision highp float;

in vec2 v_uv;
in float v_ao;
in float v_light;
in float v_faceShade;
in float v_dist;

uniform sampler2D u_atlas;
uniform float u_sunlight;     // 0.05 (night) to 1.0 (midday)
uniform vec3 u_fogColor;      // Biome/dimension fog color
uniform float u_fogStart;     // Fog begin distance in blocks
uniform float u_fogEnd;       // Fog end distance in blocks

out vec4 fragColor;

void main() {
    vec4 texColor = texture(u_atlas, v_uv);

    // Cutout alpha test (foliage leaves, tall grass, transparent openings)
    if (texColor.a < 0.1) {
        discard;
    }

    // Light ramp: minimum ambient (0.08) to full bright
    float lightLevel = clamp(v_light * u_sunlight, 0.08, 1.0);
    vec3 shadedColor = texColor.rgb * v_faceShade * v_ao * lightLevel;

    // Distance fog application
    float fogFactor = clamp((v_dist - u_fogStart) / max(0.001, u_fogEnd - u_fogStart), 0.0, 1.0);
    fragColor = vec4(mix(shadedColor, u_fogColor, fogFactor), texColor.a);
}
`;

// ============================================================================
// WebGL 1.0 (GLSL ES 1.00) Fallback Chunk Shaders
// ============================================================================

export const CHUNK_VERT_100 = `
precision highp float;

attribute vec3 a_position;  // World or chunk local position
attribute vec2 a_uv;        // Pre-computed texture UV
attribute float a_faceIdx;  // Face index (0..5)
attribute float a_ao;       // AO (0..3)
attribute float a_skyLight; // (0..15)
attribute float a_blockLight; // (0..15)

uniform mat4 u_viewProj;
uniform vec3 u_chunkPos;
uniform vec3 u_cameraPos;

varying vec2 v_uv;
varying float v_ao;
varying float v_light;
varying float v_faceShade;
varying float v_dist;

void main() {
    vec3 worldPos = u_chunkPos + a_position;
    gl_Position = u_viewProj * vec4(worldPos, 1.0);
    v_uv = a_uv;

    // Face shading
    float shade = 0.8;
    if (a_faceIdx < 0.5) shade = 1.0;       // +Y
    else if (a_faceIdx < 1.5) shade = 0.5;  // -Y
    else if (a_faceIdx < 3.5) shade = 0.8;  // +Z, -Z
    else shade = 0.6;                       // +X, -X
    v_faceShade = shade;

    // AO curve: 0->0.4, 1->0.6, 2->0.8, 3->1.0
    v_ao = 0.40 + a_ao * 0.20;

    float sLight = a_skyLight / 15.0;
    float bLight = a_blockLight / 15.0;
    v_light = max(sLight, bLight);

    v_dist = length(worldPos - u_cameraPos);
}
`;

export const CHUNK_FRAG_100 = `
precision highp float;

varying vec2 v_uv;
varying float v_ao;
varying float v_light;
varying float v_faceShade;
varying float v_dist;

uniform sampler2D u_atlas;
uniform float u_sunlight;
uniform vec3 u_fogColor;
uniform float u_fogStart;
uniform float u_fogEnd;

void main() {
    vec4 texColor = texture2D(u_atlas, v_uv);
    if (texColor.a < 0.1) {
        discard;
    }
    float lightLevel = clamp(v_light * u_sunlight, 0.08, 1.0);
    vec3 shadedColor = texColor.rgb * v_faceShade * v_ao * lightLevel;
    float fogFactor = clamp((v_dist - u_fogStart) / max(0.001, u_fogEnd - u_fogStart), 0.0, 1.0);
    gl_FragColor = vec4(mix(shadedColor, u_fogColor, fogFactor), texColor.a);
}
`;

// ============================================================================
// Highlight / Wireframe Shaders (Block Outline)
// ============================================================================

export const WIREFRAME_VERT = `
precision highp float;
attribute vec3 a_position;
uniform mat4 u_viewProj;
uniform vec3 u_offset;

void main() {
    gl_Position = u_viewProj * vec4(a_position + u_offset, 1.0);
}
`;

export const WIREFRAME_FRAG = `
precision highp float;
uniform vec4 u_color;

void main() {
    gl_FragColor = u_color;
}
`;

// ============================================================================
// Damage Crack Overlay Shaders
// ============================================================================

export const CRACK_VERT = `
precision highp float;
attribute vec3 a_position;
attribute vec2 a_uv;
uniform mat4 u_viewProj;
uniform vec3 u_offset;

varying vec2 v_uv;

void main() {
    v_uv = a_uv;
    gl_Position = u_viewProj * vec4(a_position + u_offset, 1.0);
}
`;

export const CRACK_FRAG = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_atlas;
uniform float u_tileOffsetU;
uniform float u_tileOffsetV;

void main() {
    vec2 atlasUV = vec2(u_tileOffsetU + v_uv.x * 0.0625, u_tileOffsetV + v_uv.y * 0.0625);
    vec4 crackColor = texture2D(u_atlas, atlasUV);
    if (crackColor.a < 0.1) {
        discard;
    }
    gl_FragColor = crackColor;
}
`;
