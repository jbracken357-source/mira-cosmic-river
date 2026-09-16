// THROWAWAY UI PROTOTYPE.
// Three materially different answers to: "How can Mira stop looking plastic?"
// Switch with ?variant=A|B|C. This is not production scene code.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

type Variant = 'A' | 'B' | 'C';

const variants: Record<Variant, { name: string; title: string; description: string }> = {
  A: {
    name: '层叠光河',
    title: '光，不只浮在表面',
    description: '半透明薄雾承载体积，稀疏高光只出现在局部；用遮挡、冷暖与视差取代均匀发光。',
  },
  B: {
    name: '牵引丝线',
    title: '让关系拥有方向',
    description: '减少云团，把光河拆成有张力的丝线、暗部与物质交换；更浪漫，也更强调双星关系。',
  },
  C: {
    name: '穿行体积',
    title: '让观看者进入光河',
    description: '把近景雾层推到镜头前，双星退到远处；最大化尺度和电影感，同时暴露手机性能风险。',
  },
};

const params = new URLSearchParams(location.search);
const requested = params.get('variant')?.toUpperCase();
const variant: Variant = requested === 'B' || requested === 'C' ? requested : 'A';
const keys = Object.keys(variants) as Variant[];
const meta = variants[variant];
document.querySelector('#title')!.textContent = meta.title;
document.querySelector('#status')!.textContent = meta.description;
document.querySelector('#variant-label')!.textContent = `${variant} · ${meta.name}`;

function go(step: number) {
  const next = keys[(keys.indexOf(variant) + step + keys.length) % keys.length];
  const url = new URL(location.href);
  url.searchParams.set('variant', next);
  location.href = url.toString();
}
document.querySelector('#previous')!.addEventListener('click', () => go(-1));
document.querySelector('#next')!.addEventListener('click', () => go(1));
addEventListener('keydown', event => {
  if ((event.target as HTMLElement)?.matches('input, textarea, [contenteditable]')) return;
  if (event.key === 'ArrowLeft') go(-1);
  if (event.key === 'ArrowRight') go(1);
});

const canvas = document.querySelector('canvas')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = variant === 'C' ? 1.06 : 1.12;
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setClearColor('#02030a');

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#02030a', variant === 'C' ? .014 : .008);
const camera = new THREE.PerspectiveCamera(variant === 'C' ? 48 : 43, 1, .1, 160);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 11;
controls.maxDistance = 58;
controls.minAzimuthAngle = -.72;
controls.maxAzimuthAngle = .72;
controls.minPolarAngle = .72;
controls.maxPolarAngle = 1.92;

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const river = new THREE.Group();
scene.add(river);
const animatedMaterials: THREE.ShaderMaterial[] = [];
const textureLoader = new THREE.TextureLoader();
let assetsReady = 0;
function markReady() {
  assetsReady += 1;
  if (assetsReady === 2) canvas.dataset.ready = 'true';
}
const density = textureLoader.load('/experiments/assets/river-density-v1.png', markReady);
density.colorSpace = THREE.NoColorSpace;
const surface = textureLoader.load('/materials/surface-density-v1.webp', markReady);
surface.colorSpace = THREE.NoColorSpace;

function bentPlane(width: number, height: number, layer: number, depth: number) {
  const geometry = new THREE.PlaneGeometry(width, height, 96, 16);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const u = x / width + .5;
    const bend = Math.sin(u * 5.1 + layer * .52) * (1.15 + depth * .16);
    const fold = Math.sin(u * 11. + layer) * .34;
    position.setXYZ(i, x - 5.5, y + bend + fold, Math.sin(u * 3.8 + layer * .7) * 2.8 + depth + y * depth * .055);
  }
  geometry.computeVertexNormals();
  return geometry;
}

const veilVertex = `
  varying vec2 vUv; varying vec3 vWorld;
  void main() { vUv = uv; vec4 world = modelMatrix * vec4(position, 1.); vWorld = world.xyz; gl_Position = projectionMatrix * viewMatrix * world; }
`;
const veilFragment = `
  uniform sampler2D uMap; uniform float uTime; uniform float uLayer; uniform vec3 uCold; uniform vec3 uWarm;
  uniform float uOpacity; uniform float uHighlight; varying vec2 vUv; varying vec3 vWorld;
  void main() {
    vec2 uv = vUv;
    uv.y += sin(uv.x * 12. + uTime * .10 + uLayer) * .017;
    uv.x += sin(uTime * .055 + uLayer * .81) * .011;
    float d = texture2D(uMap, uv).r;
    float d2 = texture2D(uMap, vec2(uv.x * .73 + .11, uv.y * 1.18 - .05)).r;
    float mass = smoothstep(.10, .76, d * .78 + d2 * .30);
    float ridge = smoothstep(.58, .91, d) * uHighlight;
    float softEdge = smoothstep(0., .1, vUv.x) * (1. - smoothstep(.90, 1., vUv.x));
    softEdge *= smoothstep(0., .14, vUv.y) * (1. - smoothstep(.86, 1., vUv.y));
    float warmth = smoothstep(-7., 7., vWorld.x) * (.28 + ridge * .72);
    vec3 color = mix(uCold, uWarm, warmth);
    color *= 1.05 + ridge * 3.6 + mass * .58;
    float absorption = 1. - smoothstep(.76, 1., d) * .24;
    gl_FragColor = vec4(color, mass * softEdge * uOpacity * absorption);
  }
`;

function veilMaterial(layer: number, opacity: number, highlight: number, blending = THREE.NormalBlending) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: density }, uTime: { value: 0 }, uLayer: { value: layer },
      uCold: { value: new THREE.Color(layer % 2 ? '#667ba7' : '#7c72a0') },
      uWarm: { value: new THREE.Color(layer % 3 ? '#d4aa79' : '#b9c2d5') },
      uOpacity: { value: opacity }, uHighlight: { value: highlight },
    },
    vertexShader: veilVertex, fragmentShader: veilFragment, transparent: true,
    depthWrite: false, side: THREE.DoubleSide, blending,
  });
  animatedMaterials.push(material);
  return material;
}

function buildLayeredRiver() {
  for (let layer = 0; layer < 7; layer++) {
    const depth = (layer - 3) * 1.05;
    const mesh = new THREE.Mesh(bentPlane(31, 7.2 + layer * .16, layer, depth), veilMaterial(layer, .31, layer % 2 ? .68 : .34));
    mesh.rotation.x = (layer - 3) * .018;
    river.add(mesh);
  }
  for (let layer = 0; layer < 3; layer++) {
    const mesh = new THREE.Mesh(bentPlane(29, 4.8, layer + 8, (layer - 1) * 1.8), veilMaterial(layer + 8, .16, 1.5, THREE.AdditiveBlending));
    mesh.scale.y = .72;
    river.add(mesh);
  }
}

let seed = 2409;
function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }

function buildFilamentRiver() {
  const cool = new THREE.Color('#6c85b7');
  const warm = new THREE.Color('#e1b77d');
  for (let strand = 0; strand < 18; strand++) {
    const points: THREE.Vector3[] = [];
    const lift = (random() - .5) * 4.4;
    const depth = (random() - .5) * 7;
    const phase = random() * Math.PI * 2;
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      points.push(new THREE.Vector3(
        THREE.MathUtils.lerp(-20, 6.1, t),
        lift * (1 - t) + Math.sin(t * 8 + phase) * (1.2 - t * .75),
        depth * (1 - t) + Math.sin(t * 5 + phase) * 1.1,
      ));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(curve, 88, .012 + random() * .028, 4, false);
    const color = cool.clone().lerp(warm, .18 + random() * .72);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .08 + random() * .18, depthWrite: false, blending: THREE.AdditiveBlending });
    river.add(new THREE.Mesh(geometry, material));
  }
  for (let layer = 0; layer < 5; layer++) river.add(new THREE.Mesh(bentPlane(30, 8, layer, (layer - 2) * 1.35), veilMaterial(layer, .19, layer % 2 ? .5 : .24)));
}

function buildCinematicVolume() {
  for (let layer = 0; layer < 9; layer++) {
    const depth = THREE.MathUtils.lerp(-8, 7, layer / 8);
    const mesh = new THREE.Mesh(bentPlane(42, 10.5, layer + 2, depth), veilMaterial(layer, layer < 2 ? .30 : .23, layer % 3 === 0 ? 1.05 : .36));
    mesh.position.set(-3 - layer * .36, (layer - 4) * .24, layer < 2 ? 11 - layer * 3 : 0);
    mesh.rotation.set(0, -.12 + layer * .028, -.08 + layer * .018);
    if (layer < 2) mesh.scale.setScalar(1.58 - layer * .12);
    river.add(mesh);
  }
}

if (variant === 'A') buildLayeredRiver();
if (variant === 'B') buildFilamentRiver();
if (variant === 'C') buildCinematicVolume();

const pair = new THREE.Group();
pair.position.set(7.2, -.55, -.25);
scene.add(pair);
const starMaterials: THREE.ShaderMaterial[] = [];

function createStar(radius: number, colors: [string, string, string], position: [number, number, number]) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uMap: { value: surface },
      uShadow: { value: new THREE.Color(colors[0]) }, uBody: { value: new THREE.Color(colors[1]) }, uHot: { value: new THREE.Color(colors[2]) },
    },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main() {
      vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.);
      vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv;
    }`,
    fragmentShader: `uniform sampler2D uMap; uniform float uTime; uniform vec3 uShadow; uniform vec3 uBody; uniform vec3 uHot;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vec2 uv = vUv + vec2(uTime * .0025, sin(vUv.x * 10. + uTime * .04) * .005);
        float d = texture2D(uMap, uv).r;
        float large = texture2D(uMap, uv * .47 + .19).r;
        float limb = pow(max(dot(normalize(vN), normalize(vV)), 0.), .48);
        float cells = smoothstep(.38, .82, d * .74 + large * .34);
        float sparks = smoothstep(.78, .96, d);
        vec3 color = mix(uShadow, uBody, cells);
        color = mix(color, uHot, sparks * .58);
        color *= .55 + limb * (2.1 + cells * 1.05);
        gl_FragColor = vec4(color, 1.);
      }`,
  });
  starMaterials.push(material);
  const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 48), material);
  body.position.set(...position);
  pair.add(body);
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 128;
  const context = glowCanvas.getContext('2d')!;
  const gradient = context.createRadialGradient(64, 64, 8, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,.34)');
  gradient.addColorStop(.28, 'rgba(255,255,255,.14)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(glowCanvas), color: colors[2], transparent: true,
    opacity: .34, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glow.scale.setScalar(radius * 4.4);
  glow.position.copy(body.position);
  pair.add(glow);
}

createStar(1.25, ['#3a130c', '#c45322', '#ffd184'], [0, 0, 0]);
createStar(.30, ['#172139', '#89a8d4', '#eef6ff'], [2.05, -.66, .08]);

// Broken arcs read as gathered mist, not a hard Saturn ring.
for (let arc = 0; arc < 5; arc++) {
  const curve = new THREE.EllipseCurve(0, 0, .72 + arc * .09, .21 + arc * .025, -.55 + arc * .16, 2.1 + arc * .13, false, arc * .34);
  const points = curve.getPoints(70).map(point => new THREE.Vector3(point.x, point.y, (arc - 2) * .035));
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: arc % 2 ? '#b8cced' : '#7f8fbc', transparent: true, opacity: .10 + arc * .025, blending: THREE.AdditiveBlending }),
  );
  line.position.set(2.05, -.66, .08);
  line.rotation.set(1.02, 0, -.28);
  pair.add(line);
}

const streamCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(.72, -.06, .06), new THREE.Vector3(1.1, .12, .12),
  new THREE.Vector3(1.48, -.28, .02), new THREE.Vector3(1.78, -.57, .08),
]);
pair.add(new THREE.Mesh(
  new THREE.TubeGeometry(streamCurve, 64, .018, 5, false),
  new THREE.MeshBasicMaterial({ color: '#e7b786', transparent: true, opacity: .42, depthWrite: false, blending: THREE.AdditiveBlending }),
));

const starPositions = new Float32Array((variant === 'C' ? 1500 : 1000) * 3);
for (let i = 0; i < starPositions.length; i += 3) {
  starPositions[i] = (random() - .5) * 110;
  starPositions[i + 1] = (random() - .5) * 74;
  starPositions[i + 2] = -12 - random() * 70;
}
const backgroundStars = new THREE.BufferGeometry();
backgroundStars.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
scene.add(new THREE.Points(backgroundStars, new THREE.PointsMaterial({ color: '#aeb9cf', size: .045, transparent: true, opacity: .62, depthWrite: false })));

function resize() {
  const portrait = innerWidth < 600;
  camera.aspect = innerWidth / innerHeight;
  camera.fov = portrait ? 64 : (variant === 'C' ? 48 : 43);
  scene.rotation.z = portrait ? Math.PI / 3 : 0;
  if (variant === 'B') camera.position.set(2, portrait ? 4 : 3.8, portrait ? 36 : 25);
  else if (variant === 'C') camera.position.set(-1, portrait ? 5 : 3.2, portrait ? 43 : 30);
  else camera.position.set(0, portrait ? 4 : 7, portrait ? 40 : 30);
  controls.target.set(portrait ? -2.5 : -3, portrait ? -4.2 : 0, 0);
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);
resize();

let last = performance.now();
let elapsed = 0;
renderer.setAnimationLoop(now => {
  const delta = Math.min((now - last) / 1000, .05);
  last = now;
  if (!document.hidden && !reduceMotion.matches) elapsed += delta;
  for (const material of animatedMaterials) material.uniforms.uTime.value = elapsed;
  for (const material of starMaterials) material.uniforms.uTime.value = elapsed;
  controls.update();
  renderer.render(scene, camera);
});
