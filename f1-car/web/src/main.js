import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildLibrary, U } from './materials.js';
import { buildEnvironment, buildLights, buildFloor } from './studio.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 200);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 0.6;
controls.maxDistance = 22;
controls.maxPolarAngle = Math.PI * 0.495;
controls.autoRotateSpeed = 0.8;

scene.environment = buildEnvironment(renderer);
scene.environmentIntensity = 2.2;
buildLights(scene);
buildFloor(scene);

// ------------------------------------------------ camera presets (Blender coords -> three)
const fov = (lens) => THREE.MathUtils.radToDeg(2 * Math.atan(10.125 / lens));
const P = (loc, target, lens) => ({
  pos: new THREE.Vector3(loc[0], loc[2], -loc[1]),
  target: new THREE.Vector3(target[0], target[2], -target[1]),
  fov: fov(lens),
});
const VIEWS = {
  'Hero': P([8.4, 5.6, 1.15], [0.35, 0, 0.42], 62),
  'Rear ¾': P([-8.6, 5.4, 1.55], [-0.35, 0, 0.5], 62),
  'Side': P([0, 15, 0.62], [0, 0, 0.5], 105),
  'Front': P([8.0, 0.6, 0.38], [1.6, 0, 0.42], 55),
  'Rear': P([-7.5, -1.5, 0.55], [-2.4, 0, 0.55], 55),
  'Top': P([0.01, 0, 12], [0, 0, 0], 90),
  'Front wing': P([4.6, 2.1, 0.55], [2.6, 0.4, 0.14], 85),
  'Cockpit': P([2.4, 1.6, 1.4], [0.1, 0, 0.72], 85),
  'Wheel': P([3.8, 3.1, 0.55], [1.8, 0.85, 0.36], 85),
  'Sidepod': P([0.3, 3.4, 0.85], [0, 0.3, 0.42], 85),
  'Rear wing': P([-5.1, 2.6, 1.3], [-2.65, 0, 0.85], 85),
  'Diffuser': P([-4.6, -1.4, 0.35], [-2.2, 0, 0.22], 70),
};

let tween = null;
function goTo(name, instant = false) {
  const v = VIEWS[name];
  document.querySelectorAll('#views button').forEach((b) => b.classList.toggle('on', b.dataset.v === name));
  if (instant) {
    camera.position.copy(v.pos); controls.target.copy(v.target); camera.fov = v.fov; camera.updateProjectionMatrix(); controls.update();
    return;
  }
  tween = { t: 0, from: { p: camera.position.clone(), t: controls.target.clone(), f: camera.fov }, to: v };
}
const viewsEl = document.getElementById('views');
for (const name of Object.keys(VIEWS)) {
  const b = document.createElement('button');
  b.textContent = name; b.dataset.v = name;
  b.onclick = () => goTo(name);
  viewsEl.appendChild(b);
}

// ------------------------------------------------ UI toggles
const $ = (id) => document.getElementById(id);
$('rot').onchange = (e) => (controls.autoRotate = e.target.checked);
controls.autoRotate = $('rot').checked;
let spinOn = false, steerOn = false;
$('spin').onchange = (e) => (spinOn = e.target.checked);
$('steer').onchange = (e) => (steerOn = e.target.checked);
controls.addEventListener('start', () => { if (tween) tween = null; });

const ACCENTS = ['#ff4310', '#f2d31b', '#19c2ff', '#ff2d8a', '#39e08a', '#e9e6de'];
ACCENTS.forEach((hex, i) => {
  const s = document.createElement('i');
  s.style.background = hex;
  if (i === 0) s.classList.add('on');
  s.onclick = () => {
    U.uAccent.value.set(hex);
    U.uDeep.value.set(hex).multiplyScalar(0.55);
    document.documentElement.style.setProperty('--accent', hex);
    document.querySelectorAll('.sw i').forEach((x) => x.classList.toggle('on', x === s));
  };
  $('swatches').appendChild(s);
});

// ------------------------------------------------ load
const bar = document.querySelector('#bar i');
const loader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();
const wheels = {};
const steers = {};

async function loadDecals() {
  const specs = await (await fetch('decals/decals.json')).json();
  await Promise.all(specs.map(async (d) => {
    d.texture = await texLoader.loadAsync(d.url);
    d.texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    d.texture.generateMipmaps = true;
    d.texture.minFilter = THREE.LinearMipmapLinearFilter;
  }));
  return specs;
}

async function init() {
  const decals = await loadDecals();
  const lib = buildLibrary(decals);
  const gltf = await loader.loadAsync('models/f1car.glb', (e) => {
    if (e.total) bar.style.width = (100 * e.loaded / e.total).toFixed(0) + '%';
  });
  const car = gltf.scene;
  const missing = new Set();
  car.traverse((o) => {
    if (o.isMesh) {
      const name = o.material.name;
      const mat = lib[name];
      if (mat) o.material = mat; else missing.add(name);
      o.castShadow = true;
      o.receiveShadow = true;
    }
    if (/^SPIN_/.test(o.name)) wheels[o.name.slice(5)] = o;
    if (/^STEER_/.test(o.name)) steers[o.name.slice(6)] = o;
  });
  if (missing.size) console.warn('materials without web equivalent:', [...missing]);
  scene.add(car);
  // glTF is y-up with car nose along +X, same as Blender: no re-orientation needed.
  goTo('Hero', true);
  document.getElementById('loading').classList.add('done');
  window.__car = car;
}
init().catch((e) => { console.error(e); document.getElementById('loading').textContent = 'FAILED: ' + e.message; });

// ------------------------------------------------ loop
const clock = new THREE.Clock();
let rollAngle = 0, steerT = 0;
const ease = (t) => t * t * (3 - 2 * t);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (tween) {
    tween.t = Math.min(1, tween.t + dt / 1.4);
    const k = ease(tween.t);
    camera.position.lerpVectors(tween.from.p, tween.to.pos, k);
    controls.target.lerpVectors(tween.from.t, tween.to.target, k);
    camera.fov = THREE.MathUtils.lerp(tween.from.f, tween.to.fov, k);
    camera.updateProjectionMatrix();
    if (tween.t >= 1) tween = null;
  }
  if (spinOn) rollAngle += dt * (60 / 3.6) / 0.36;    // 60 km/h on 0.36 m tyres
  // Blender's spin axis (local +Y) becomes glTF's -Z; right-hand corners are yawed 180 deg
  for (const [tag, o] of Object.entries(wheels)) {
    const s = tag.endsWith('R') ? -1 : 1;
    o.rotation.set(0, 0, -s * rollAngle);
  }
  if (steerOn) steerT += dt;
  for (const o of Object.values(steers)) {
    o.rotation.set(0, steerOn ? Math.sin(steerT * 1.6) * 0.26 : 0, 0);
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
