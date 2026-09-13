// Disposable material feasibility study. Not the production scene or final art.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const canvas = document.querySelector('canvas')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setClearColor('#03050d');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 150);
camera.position.set(0, 7, 30);
const controls = new OrbitControls(camera, canvas);
controls.target.set(-3, 0, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 12;
controls.maxDistance = 55;
// The first study tests bounded viewing: a full orbit can expose ribbon edges.
controls.minAzimuthAngle = -0.65;
controls.maxAzimuthAngle = 0.65;
controls.minPolarAngle = 0.8;
controls.maxPolarAngle = 1.8;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const density = new THREE.TextureLoader().load('/experiments/assets/river-density-v1.png', () => {
  document.querySelector('#status')!.textContent = '两颗星，一条没有尽头的光河';
  canvas.dataset.ready = 'true';
}, undefined, () => {
  document.querySelector('#status')!.textContent = '光河素材未能载入，请刷新重试';
});
// This is a data texture: raw grayscale becomes opacity, not a painted black card.
density.colorSpace = THREE.NoColorSpace;

const riverMaterials: THREE.ShaderMaterial[] = [];
for (let layer = 0; layer < 5; layer++) {
  const geo = new THREE.PlaneGeometry(28, 7, 72, 10);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const u = (x + 14) / 28;
    const y = pos.getY(i);
    pos.setXYZ(i, x - 5, y + Math.sin(u * 4.2 + layer * .25) * 1.5,
      Math.sin(u * 3.5 + layer * .4) * 2.5 + (layer - 2) * 1.1 + y * (layer - 2) * .1);
  }
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: density }, uTime: { value: 0 }, uLayer: { value: layer },
      uColor: { value: new THREE.Color(['#718ecb', '#a998cf', '#d9c3a0', '#698bb9', '#cabbae'][layer]) } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform sampler2D uMap; uniform float uTime; uniform float uLayer; uniform vec3 uColor; varying vec2 vUv;
      void main() {
        vec2 uv = vUv;
        uv.y += sin(uv.x * 13. + uTime * .17 + uLayer) * .018;
        uv.x += sin(uTime * .09 + uLayer * .8) * .014;
        float d = texture2D(uMap, uv).r;
        float edge = smoothstep(0., .08, vUv.x) * (1. - smoothstep(.92, 1., vUv.x));
        edge *= smoothstep(0., .12, vUv.y) * (1. - smoothstep(.88, 1., vUv.y));
        gl_FragColor = vec4(uColor, pow(d, 1.25) * edge * .40);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  riverMaterials.push(mat);
  scene.add(new THREE.Mesh(geo, mat));
}

const pair = new THREE.Group();
pair.position.set(7, -.7, -.5);
scene.add(pair);
const starMaterials: THREE.ShaderMaterial[] = [];
function star(radius: number, color: string, x: number, y: number) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vV; void main() {
      vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.);
      vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec3 vP; varying vec3 vN; varying vec3 vV;
      void main() { vec3 p = vP * 10.; float n = sin(p.x + sin(p.y * 1.8 + uTime * .15)) * sin(p.z * 1.5 + cos(p.y));
      float face = pow(max(dot(normalize(vN), normalize(vV)), 0.), .4);
      gl_FragColor = vec4(uColor * (.55 + .35 * n + .55 * face), 1.); }`,
  });
  starMaterials.push(mat);
  const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), mat);
  body.position.set(x, y, 0);
  pair.add(body);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.22, 32, 24), new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main() { vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; varying vec3 vN; varying vec3 vV; void main() { float d = max(dot(normalize(vN), normalize(vV)), 0.); gl_FragColor = vec4(uColor, pow(d, 2.) * .22); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glow.position.copy(body.position);
  pair.add(glow);
}
star(1, '#ff993f', 0, 0);
star(.28, '#b8dfff', 1.7, -.7);
const positions = new Float32Array(800 * 3);
let seed = 17;
function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
for (let i = 0; i < positions.length; i += 3) {
  positions[i] = (random() - .5) * 100;
  positions[i + 1] = (random() - .5) * 70;
  positions[i + 2] = -15 - random() * 45;
}
const stars = new THREE.BufferGeometry();
stars.setAttribute('position', new THREE.BufferAttribute(positions, 3));
scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: '#c3cde1', size: .055, transparent: true, opacity: .65 })));
function resize() {
  const portrait = innerWidth < 600;
  camera.aspect = innerWidth / innerHeight;
  camera.fov = portrait ? 64 : 43;
  scene.rotation.z = portrait ? Math.PI / 3 : 0;
  camera.position.set(0, portrait ? 4 : 7, portrait ? 40 : 30);
  controls.target.set(portrait ? -2.5 : -3, portrait ? -4.3 : 0, 0);
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);
resize();
let last = performance.now();
let elapsed = 0;
renderer.setAnimationLoop((now) => {
  const delta = Math.min((now - last) / 1000, .05);
  last = now;
  if (!document.hidden && !reduceMotion.matches) elapsed += delta;
  for (const mat of [...riverMaterials, ...starMaterials]) mat.uniforms.uTime.value = elapsed;
  controls.update();
  renderer.render(scene, camera);
});
