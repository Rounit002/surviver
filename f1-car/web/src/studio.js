// Photo-studio: emissive softbox environment (drives all reflections), lights, reflective floor.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

// Blender (x fwd, y left, z up) -> three (x, y up, z = -y_blender)
const B = (x, y, z) => new THREE.Vector3(x, z, -y);

function softbox(size, pos, look, color, intensity) {
  const g = new THREE.PlaneGeometry(size[0], size[1]);
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, m);
  mesh.position.copy(pos);
  mesh.lookAt(look);
  return mesh;
}

export function buildEnvironment(renderer) {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x020203);
  const T = B(0, 0, 0.4);
  // overhead long strips
  for (const s of [1, -1]) {
    const m = softbox([9, 0.55], B(0.2, s * 1.35, 5), B(0.2, s * 1.35, 0), '#ffffff', 26);
    m.rotation.set(Math.PI / 2, 0, 0);       // face down, long axis along X
    env.add(m);
  }
  // wide dim fill above
  const top = softbox([12, 12], B(0, 0, 7.5), B(0, 0, 0), '#eef3ff', 0.7);
  top.rotation.set(Math.PI / 2, 0, 0);
  env.add(top);
  // vertical side strips
  env.add(softbox([0.9, 2.4], B(0.6, 5.4, 1.4), T, '#fff6ec', 22));
  env.add(softbox([0.9, 2.4], B(0.6, -5.4, 1.4), T, '#eaf1ff', 22));
  // rear rim strips (warm / cool)
  env.add(softbox([0.9, 3.0], B(-6.8, 3.6, 1.7), T, '#fff0e4', 7));
  env.add(softbox([0.9, 3.0], B(-6.8, -3.6, 1.7), T, '#e2ecff', 7));
  // soft front fill
  env.add(softbox([4, 1.8], B(9, 0, 2.2), T, '#ffffff', 4));
  // faint cool wash on the far wall so dark paint keeps a horizon line
  env.add(softbox([40, 6], B(-16, 0, 3), T, '#3a4660', 0.35));
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(env, 0.02, 0.1, 100);
  pm.dispose();
  return rt.texture;
}

export function buildLights(scene) {
  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(3.5, 8, 2.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const c = key.shadow.camera;
  c.left = -4.5; c.right = 4.5; c.top = 4.5; c.bottom = -4.5; c.near = 1; c.far = 20;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 5;
  scene.add(key);
  const rimL = new THREE.DirectionalLight(0xffeadb, 0.7); rimL.position.set(-7, 2, -3.6); scene.add(rimL);
  const rimR = new THREE.DirectionalLight(0xdde8ff, 0.7); rimR.position.set(-7, 2, 3.6); scene.add(rimR);
}

export function buildFloor(scene) {
  const mirror = new Reflector(new THREE.CircleGeometry(30, 64), {
    textureWidth: 1024, textureHeight: 1024, color: 0x777777, clipBias: 0.003,
  });
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.y = -0.002;
  scene.add(mirror);

  // dark resin surface over the mirror; transparent near the car, opaque far away
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(256, 256, 40, 256, 256, 256);
  grad.addColorStop(0.0, 'rgba(3,4,5,0.80)');
  grad.addColorStop(0.28, 'rgba(3,4,5,0.86)');
  grad.addColorStop(0.55, 'rgba(3,4,5,0.96)');
  grad.addColorStop(1.0, 'rgba(3,4,5,1)');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const cover = new THREE.Mesh(new THREE.CircleGeometry(30, 64),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  cover.rotation.x = -Math.PI / 2;
  cover.position.y = -0.001;
  scene.add(cover);

  // contact shadow
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(30, 32), new THREE.ShadowMaterial({ opacity: 0.55 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.0005;
  shadow.receiveShadow = true;
  scene.add(shadow);

  // far backdrop: soft vignette sphere so the horizon fades to black
  scene.background = new THREE.Color(0x030304);
  scene.fog = new THREE.Fog(0x030304, 18, 46);
}
