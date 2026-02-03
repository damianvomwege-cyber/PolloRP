import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';

const canvasContainer = document.body;
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
canvasContainer.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9bb7d1);
scene.fog = new THREE.Fog(0x9bb7d1, 20, 70);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 120);
const orbitDistance = 7.2;
const orbitHeight = 1.2;
let cameraYaw = Math.PI;
let cameraPitch = 0.35;
const pitchMin = 0.1;
const pitchMax = 0.75;

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

function makeCanvas(size, drawFn) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, size);
  return canvas;
}

function makeTexture(canvas, repeat) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = maxAnisotropy;
  return texture;
}

function makeRoughness(texture) {
  const roughness = texture.clone();
  roughness.colorSpace = THREE.NoColorSpace;
  roughness.needsUpdate = true;
  return roughness;
}

function createGroundMaps() {
  const canvas = makeCanvas(256, (ctx, size) => {
    ctx.fillStyle = '#496b50';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 900; i += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const radius = Math.random() * 1.6 + 0.2;
      const shade = Math.random() > 0.5 ? 'rgba(60, 85, 60, 0.25)' : 'rgba(120, 150, 120, 0.18)';
      ctx.beginPath();
      ctx.fillStyle = shade;
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(80, 110, 80, 0.18)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i += 1) {
      const y = (i / 8) * size + (Math.random() - 0.5) * 6;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y + (Math.random() - 0.5) * 6);
      ctx.stroke();
    }
  });
  const map = makeTexture(canvas, 18);
  return { map, roughnessMap: makeRoughness(map) };
}

function createWallMaps() {
  const canvas = makeCanvas(256, (ctx, size) => {
    ctx.fillStyle = '#d7c2a0';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(170, 150, 120, 0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i += 1) {
      const y = (i / 6) * size + (Math.random() - 0.5) * 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y + (Math.random() - 0.5) * 4);
      ctx.stroke();
    }
    for (let i = 0; i < 500; i += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const alpha = Math.random() * 0.15;
      ctx.fillStyle = `rgba(120, 100, 80, ${alpha})`;
      ctx.fillRect(x, y, 1.5, 1.5);
    }
  });
  const map = makeTexture(canvas, 2.6);
  return { map, roughnessMap: makeRoughness(map) };
}

function createRoofMaps() {
  const canvas = makeCanvas(256, (ctx, size) => {
    ctx.fillStyle = '#914839';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(60, 25, 20, 0.35)';
    ctx.lineWidth = 2;
    for (let y = 0; y < size; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y + 6);
      ctx.stroke();
    }
    for (let i = 0; i < 300; i += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const alpha = Math.random() * 0.2;
      ctx.fillStyle = `rgba(140, 80, 70, ${alpha})`;
      ctx.fillRect(x, y, 2, 2);
    }
  });
  const map = makeTexture(canvas, 3.2);
  return { map, roughnessMap: makeRoughness(map) };
}

const groundMaps = createGroundMaps();
const wallMaps = createWallMaps();
const roofMaps = createRoofMaps();

const CHUNK_SIZE = 40;
const CHUNK_RADIUS = 2;

const groundGeometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE);
const groundMaterial = new THREE.MeshStandardMaterial({
  map: groundMaps.map,
  roughnessMap: groundMaps.roughnessMap,
  color: 0xffffff,
  roughness: 1,
  metalness: 0.0
});

const playerRadius = 0.6;
const obstacles = [];
const lanterns = [];
let lanternsLit = 0;
const lanternGoal = 3;
const chunks = new Map();
const tempVector = new THREE.Vector3();

function addObstacle(x, z, radius, chunkKey = null) {
  const obstacle = { position: new THREE.Vector3(x, 0, z), radius, chunkKey };
  obstacles.push(obstacle);
  return obstacle;
}

function createHouse(x, z, options = {}) {
  const parent = options.parent ?? scene;
  const chunkKey = options.chunkKey ?? null;
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 3, 3.6),
    new THREE.MeshStandardMaterial({
      map: wallMaps.map,
      roughnessMap: wallMaps.roughnessMap,
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.0
    })
  );
  base.position.y = 1.5;
  base.castShadow = true;
  base.receiveShadow = true;
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(3.4, 2, 4),
    new THREE.MeshStandardMaterial({
      map: roofMaps.map,
      roughnessMap: roofMaps.roughnessMap,
      color: 0xffffff,
      roughness: 0.75,
      metalness: 0.0
    })
  );
  roof.position.y = 4.2;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(base, roof);
  group.position.set(x - parent.position.x, 0, z - parent.position.z);
  parent.add(group);
  addObstacle(x, z, 2.6, chunkKey);
}

function createTree(x, z, options = {}) {
  const parent = options.parent ?? scene;
  const chunkKey = options.chunkKey ?? null;
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.4, 2.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x7b4f2a, roughness: 0.9, metalness: 0.0 })
  );
  trunk.position.y = 1.1;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(1.8, 3.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x2f5d43, roughness: 0.8, metalness: 0.0 })
  );
  leaves.position.y = 3.2;
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  group.add(trunk, leaves);
  group.position.set(x - parent.position.x, 0, z - parent.position.z);
  parent.add(group);
  addObstacle(x, z, 1.3, chunkKey);
}

function createCrate(x, z, options = {}) {
  const parent = options.parent ?? scene;
  const chunkKey = options.chunkKey ?? null;
  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.85, metalness: 0.0 })
  );
  crate.position.set(x - parent.position.x, 0.5, z - parent.position.z);
  crate.castShadow = true;
  crate.receiveShadow = true;
  parent.add(crate);
  addObstacle(x, z, 0.75, chunkKey);
}

function createBarrel(x, z, options = {}) {
  const parent = options.parent ?? scene;
  const chunkKey = options.chunkKey ?? null;
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.55, 1.1, 14),
    new THREE.MeshStandardMaterial({ color: 0x7c4a2a, roughness: 0.8, metalness: 0.0 })
  );
  barrel.position.set(x - parent.position.x, 0.55, z - parent.position.z);
  barrel.castShadow = true;
  barrel.receiveShadow = true;
  parent.add(barrel);
  addObstacle(x, z, 0.75, chunkKey);
}

function createRock(x, z, options = {}) {
  const parent = options.parent ?? scene;
  const chunkKey = options.chunkKey ?? null;
  const rand = options.rng ?? Math.random;
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.6, 0),
    new THREE.MeshStandardMaterial({ color: 0x6a6d72, roughness: 0.95, metalness: 0.0 })
  );
  rock.position.set(x - parent.position.x, 0.35, z - parent.position.z);
  rock.scale.set(0.8 + rand() * 0.5, 0.6 + rand() * 0.4, 0.8 + rand() * 0.5);
  rock.castShadow = true;
  rock.receiveShadow = true;
  parent.add(rock);
  addObstacle(x, z, 0.7, chunkKey);
}

function createLantern(x, z, options = {}) {
  const parent = options.parent ?? scene;
  const chunkKey = options.chunkKey ?? null;
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.12, 3.2, 10),
    new THREE.MeshStandardMaterial({ color: 0x3f3a34, roughness: 0.85, metalness: 0.1 })
  );
  pole.position.y = 1.6;
  pole.castShadow = true;
  pole.receiveShadow = true;

  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.08, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x3f3a34, roughness: 0.85, metalness: 0.1 })
  );
  arm.position.set(0.25, 2.9, 0);
  arm.castShadow = true;
  arm.receiveShadow = true;

  const glass = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 12),
    new THREE.MeshStandardMaterial({
      color: 0xffd9a1,
      emissive: 0x1a1208,
      emissiveIntensity: 0.15,
      roughness: 0.4,
      metalness: 0.0
    })
  );
  glass.position.set(0.48, 2.75, 0);
  glass.castShadow = true;

  const light = new THREE.PointLight(0xffd2a0, 0, 8.5, 2);
  light.position.set(0.48, 2.75, 0);
  light.castShadow = true;
  light.shadow.mapSize.set(512, 512);

  group.add(pole, arm, glass, light);
  group.position.set(x - parent.position.x, 0, z - parent.position.z);
  parent.add(group);
  addObstacle(x, z, 0.6, chunkKey);

  const lantern = { group, glass, light, lit: false, chunkKey };
  lanterns.push(lantern);
  return lantern;
}

function makeRng(cx, cz) {
  let seed = (cx * 374761393 + cz * 668265263) ^ (cx * cz);
  seed = (seed ^ (seed >>> 13)) >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function getChunkCoords(x, z) {
  return [Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)];
}

function getChunkKey(cx, cz) {
  return `${cx},${cz}`;
}

function populateChunk(cx, cz, chunkKey, parent) {
  if (Math.abs(cx) <= 1 && Math.abs(cz) <= 1) {
    return;
  }
  const rand = makeRng(cx, cz);
  const margin = 4;
  const count = 6 + Math.floor(rand() * 6);
  for (let i = 0; i < count; i += 1) {
    const x = cx * CHUNK_SIZE + margin + rand() * (CHUNK_SIZE - margin * 2);
    const z = cz * CHUNK_SIZE + margin + rand() * (CHUNK_SIZE - margin * 2);
    const pick = rand();
    if (pick < 0.65) {
      createTree(x, z, { parent, chunkKey });
    } else {
      createRock(x, z, { parent, chunkKey, rng: rand });
    }
  }
}

function createChunk(cx, cz) {
  const chunkKey = getChunkKey(cx, cz);
  if (chunks.has(chunkKey)) return;

  const group = new THREE.Group();
  group.position.set(cx * CHUNK_SIZE + CHUNK_SIZE / 2, 0, cz * CHUNK_SIZE + CHUNK_SIZE / 2);

  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  scene.add(group);
  chunks.set(chunkKey, { group, cx, cz });

  populateChunk(cx, cz, chunkKey, group);
}

function removeByChunk(list, chunkKey, onRemove) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i].chunkKey === chunkKey) {
      if (onRemove) {
        onRemove(list[i]);
      }
      list.splice(i, 1);
    }
  }
}

function disposeGroup(group) {
  group.traverse((child) => {
    if (!child.isMesh) return;
    if (child.geometry && child.geometry !== groundGeometry) {
      child.geometry.dispose();
    }
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (material !== groundMaterial) {
          material.dispose();
        }
      });
    }
  });
}

function removeChunk(chunkKey) {
  const chunk = chunks.get(chunkKey);
  if (!chunk) return;
  scene.remove(chunk.group);
  disposeGroup(chunk.group);
  removeByChunk(obstacles, chunkKey);
  removeByChunk(lanterns, chunkKey, (lantern) => {
    if (lantern.lit) {
      lanternsLit = Math.max(0, lanternsLit - 1);
    }
  });
  chunks.delete(chunkKey);
}

let currentChunkKey = null;
function updateChunks(force = false) {
  const [cx, cz] = getChunkCoords(player.position.x, player.position.z);
  const centerKey = getChunkKey(cx, cz);
  if (!force && centerKey === currentChunkKey) return;
  currentChunkKey = centerKey;

  const needed = new Set();
  for (let x = cx - CHUNK_RADIUS; x <= cx + CHUNK_RADIUS; x += 1) {
    for (let z = cz - CHUNK_RADIUS; z <= cz + CHUNK_RADIUS; z += 1) {
      const key = getChunkKey(x, z);
      needed.add(key);
      if (!chunks.has(key)) {
        createChunk(x, z);
      }
    }
  }

  chunks.forEach((_, key) => {
    if (!needed.has(key)) {
      removeChunk(key);
    }
  });
}

createHouse(-8, -6);
createHouse(10, -4);
createHouse(-12, 8);
createHouse(6, 10);
createTree(-4, -12);
createTree(12, 14);
createTree(-16, 2);
createTree(4, -16);
createCrate(-6, 2);
createCrate(8, 3);
createBarrel(-10, -2);
createBarrel(2, -8);
createLantern(14, 4);
createLantern(16, 0);
createLantern(14, -4);

const player = new THREE.Group();
const playerBody = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.45, 0.9, 6, 10),
  new THREE.MeshStandardMaterial({ color: 0x3a6ea5, roughness: 0.55, metalness: 0.1 })
);
playerBody.position.y = 1.25;
playerBody.castShadow = true;
playerBody.receiveShadow = true;
player.add(playerBody);
player.position.set(0, 0, 6);
scene.add(player);

const npc = new THREE.Group();
const npcBody = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.4, 0.8, 6, 10),
  new THREE.MeshStandardMaterial({ color: 0x9b6d3a, roughness: 0.6, metalness: 0.05 })
);
npcBody.position.y = 1.2;
npcBody.castShadow = true;
npcBody.receiveShadow = true;
const npcHat = new THREE.Mesh(
  new THREE.CylinderGeometry(0.55, 0.65, 0.35, 12),
  new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.7, metalness: 0.0 })
);
npcHat.position.y = 2.2;
npcHat.castShadow = true;
npcHat.receiveShadow = true;
npc.add(npcBody, npcHat);
npc.position.set(-2, 0, -2);
scene.add(npc);
addObstacle(-2, -2, 1.0);

const startModal = document.getElementById('start');
const startBtn = document.getElementById('startBtn');
const nameInput = document.getElementById('playerName');
const nearPrompt = document.getElementById('nearPrompt');
const dialogModal = document.getElementById('dialog');
const dialogText = document.getElementById('dialogText');
const dialogOptions = document.getElementById('dialogOptions');
const npcName = document.getElementById('npcName');
const emote = document.getElementById('emote');

npcName.textContent = 'Elda';

let playerName = 'Traveler';
let gameStarted = false;
let dialogOpen = false;
let activeStep = null;

const dialogs = {
  start: {
    text: 'Welcome, {name}. I am Elda, chronicler of Kaldbach. What brings you here?',
    options: [
      { label: 'Tell me about the village.', next: 'town' },
      { label: 'I am looking for work.', next: 'work' },
      { label: 'Just passing through.', next: 'bye' }
    ]
  },
  town: {
    text: 'Our people live from the wind trade and the herbs of the moor. Every traveler brings new stories.',
    options: [
      { label: 'I might have one.', next: 'work' },
      { label: 'I will look around.', next: null }
    ]
  },
  work: {
    text: 'If you want to help: Three lanterns on the east road have gone dark. Bring back the light, and your name will be remembered.',
    options: [
      { label: 'I will take care of it.', next: 'thanks' },
      { label: 'Maybe later.', next: null }
    ]
  },
  complete: {
    text: 'You brought back the light, {name}. People are already talking about it.',
    options: [
      { label: 'Glad to help.', next: null }
    ]
  },
  thanks: {
    text: 'Then walk with steady steps. The village trusts you.',
    options: [
      { label: 'Goodbye.', next: null }
    ]
  },
  bye: {
    text: 'May the road carry you kindly. If you return, there is a place by the fire.',
    options: [
      { label: 'Goodbye.', next: null }
    ]
  }
};

function openDialog(step) {
  const entry = dialogs[step];
  if (!entry) return;
  dialogOpen = true;
  activeStep = step;
  dialogModal.classList.add('show');
  dialogText.textContent = entry.text.replace('{name}', playerName);
  dialogOptions.innerHTML = '';
  entry.options.forEach((option) => {
    const btn = document.createElement('button');
    btn.textContent = option.label;
    btn.addEventListener('click', () => {
      if (option.next) {
        openDialog(option.next);
      } else {
        closeDialog();
      }
    });
    dialogOptions.appendChild(btn);
  });
}

function closeDialog() {
  dialogOpen = false;
  activeStep = null;
  dialogModal.classList.remove('show');
}

function showEmote(message) {
  emote.textContent = message;
  emote.style.opacity = '1';
  clearTimeout(showEmote.timeoutId);
  showEmote.timeoutId = setTimeout(() => {
    emote.textContent = '';
  }, 1600);
}

function getNearbyLantern() {
  let nearest = null;
  let nearestDist = Infinity;
  lanterns.forEach((lantern) => {
    lantern.group.getWorldPosition(tempVector);
    const dist = player.position.distanceTo(tempVector);
    if (dist < 2.4 && dist < nearestDist) {
      nearest = lantern;
      nearestDist = dist;
    }
  });
  return nearest;
}

function lightLantern(lantern) {
  if (lantern.lit) return;
  lantern.lit = true;
  lantern.light.intensity = 1.35;
  lantern.glass.material.emissive = new THREE.Color(0xffc580);
  lantern.glass.material.emissiveIntensity = 1.2;
  lanternsLit += 1;
  if (lanternsLit >= lanternGoal) {
    showEmote('All lanterns are burning again.');
  } else {
    showEmote(`Lantern lit (${lanternsLit}/${lanternGoal}).`);
  }
}

startBtn.addEventListener('click', () => {
  const rawName = nameInput.value.trim();
  if (rawName.length > 0) {
    playerName = rawName;
  }
  gameStarted = true;
  startModal.classList.remove('show');
  nameInput.blur();
});

nameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    startBtn.click();
  }
});

const keys = new Set();
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
const mouseSensitivity = 0.0032;

renderer.domElement.addEventListener('mousedown', (event) => {
  if (event.button !== 0) return;
  isDragging = true;
  lastMouseX = event.clientX;
  lastMouseY = event.clientY;
  renderer.domElement.style.cursor = 'grabbing';
});

window.addEventListener('mouseup', () => {
  isDragging = false;
  renderer.domElement.style.cursor = 'grab';
});

window.addEventListener('mousemove', (event) => {
  if (!isDragging) return;
  const deltaX = event.clientX - lastMouseX;
  const deltaY = event.clientY - lastMouseY;
  lastMouseX = event.clientX;
  lastMouseY = event.clientY;

  cameraYaw -= deltaX * mouseSensitivity;
  cameraPitch += deltaY * mouseSensitivity;
  cameraPitch = THREE.MathUtils.clamp(cameraPitch, pitchMin, pitchMax);
});

window.addEventListener('keydown', (event) => {
  if (!gameStarted) return;
  if (event.repeat) return;

  if (event.key === 'Escape' && dialogOpen) {
    closeDialog();
    return;
  }

  if (event.key.toLowerCase() === 'e' && !dialogOpen) {
    if (isNearNpc()) {
      const step = lanternsLit >= lanternGoal ? 'complete' : activeStep || 'start';
      openDialog(step);
      return;
    }
    const lantern = getNearbyLantern();
    if (lantern && !lantern.lit) {
      lightLantern(lantern);
      return;
    }
  }

  if (event.key.toLowerCase() === 'f' && !dialogOpen) {
    showEmote('You wave into the evening sun.');
    return;
  }

  keys.add(event.key.toLowerCase());
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.key.toLowerCase());
});

function isNearNpc() {
  return player.position.distanceTo(npc.position) < 2.6;
}

function resolveCollisions(position) {
  obstacles.forEach((obstacle) => {
    const delta = position.clone().sub(obstacle.position);
    const minDist = obstacle.radius + playerRadius;
    const dist = delta.length();
    if (dist < minDist) {
      if (dist < 0.0001) {
        delta.set(minDist, 0, 0);
      } else {
        delta.setLength(minDist);
      }
      position.copy(obstacle.position).add(delta);
    }
  });
}

function updatePrompt() {
  if (!gameStarted || dialogOpen) {
    nearPrompt.classList.remove('show');
    return;
  }
  if (isNearNpc()) {
    nearPrompt.textContent = 'Press E to talk to Elda';
    nearPrompt.classList.add('show');
    return;
  }
  const lantern = getNearbyLantern();
  if (lantern && !lantern.lit) {
    nearPrompt.textContent = 'Press E to light the lantern';
    nearPrompt.classList.add('show');
    return;
  }
  nearPrompt.classList.remove('show');
}

const clock = new THREE.Clock();

updateChunks(true);

function updatePlayer(delta) {
  const inputX = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
  const inputZ = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0);

  const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
  const right = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
  const direction = new THREE.Vector3()
    .addScaledVector(forward, inputZ)
    .addScaledVector(right, inputX);
  if (direction.lengthSq() > 0) {
    direction.normalize();
    const speed = 4.2;
    const velocity = direction.multiplyScalar(speed * delta);
    const proposed = player.position.clone().add(velocity);
    resolveCollisions(proposed);
    player.position.copy(proposed);

    const angle = Math.atan2(direction.x, direction.z);
    player.rotation.y = angle;
  }

}

function updateCamera() {
  const cosPitch = Math.cos(cameraPitch);
  const sinPitch = Math.sin(cameraPitch);
  const offset = new THREE.Vector3(
    Math.sin(cameraYaw) * orbitDistance * cosPitch,
    orbitDistance * sinPitch + orbitHeight,
    Math.cos(cameraYaw) * orbitDistance * cosPitch
  );
  const desired = player.position.clone().add(offset);
  camera.position.lerp(desired, 0.08);
  camera.lookAt(player.position.x, player.position.y + 1.2, player.position.z);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (gameStarted && !dialogOpen) {
    updatePlayer(delta);
  }

  updateChunks();
  updateCamera();

  updatePrompt();

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
