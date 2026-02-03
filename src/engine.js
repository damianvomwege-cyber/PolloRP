import { THREE } from './three.js';

export function initEngine(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.physicallyCorrectLights = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9bb7d1);
  scene.fog = new THREE.Fog(0x9bb7d1, 20, 70);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 120);

  const hemisphere = new THREE.HemisphereLight(0xfff4d6, 0x41545e, 0.55);
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight(0xfff1d4, 1.45);
  sun.position.set(12, 20, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22;
  sun.shadow.camera.bottom = -22;
  sun.shadow.bias = -0.0003;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xbdd4ff, 0.28);
  fill.position.set(-10, 8, -6);
  scene.add(fill);

  return { renderer, scene, camera, maxAnisotropy };
}
