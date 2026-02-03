import { THREE } from './three.js';

const CHUNK_SIZE = 40;
const CHUNK_RADIUS = 2;
const LANTERN_GOAL = 3;
const HERB_GOAL = 5;
const FIREFLY_COUNT = 14;

function makeCanvas(size, drawFn) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, size);
  return canvas;
}

function makeTexture(canvas, repeat, maxAnisotropy) {
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

function createGroundMaps(maxAnisotropy) {
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
  const map = makeTexture(canvas, 18, maxAnisotropy);
  return { map, roughnessMap: makeRoughness(map) };
}

function createWallMaps(maxAnisotropy) {
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
  const map = makeTexture(canvas, 2.6, maxAnisotropy);
  return { map, roughnessMap: makeRoughness(map) };
}

function createRoofMaps(maxAnisotropy) {
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
  const map = makeTexture(canvas, 3.2, maxAnisotropy);
  return { map, roughnessMap: makeRoughness(map) };
}

function createMaterialMaps(maxAnisotropy) {
  return {
    groundMaps: createGroundMaps(maxAnisotropy),
    wallMaps: createWallMaps(maxAnisotropy),
    roofMaps: createRoofMaps(maxAnisotropy)
  };
}

function createMaterials(maps) {
  return {
    ground: new THREE.MeshStandardMaterial({
      map: maps.groundMaps.map,
      roughnessMap: maps.groundMaps.roughnessMap,
      color: 0xffffff,
      roughness: 1,
      metalness: 0.0
    }),
    wall: new THREE.MeshStandardMaterial({
      map: maps.wallMaps.map,
      roughnessMap: maps.wallMaps.roughnessMap,
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.0
    }),
    roof: new THREE.MeshStandardMaterial({
      map: maps.roofMaps.map,
      roughnessMap: maps.roofMaps.roughnessMap,
      color: 0xffffff,
      roughness: 0.75,
      metalness: 0.0
    }),
    treeTrunk: new THREE.MeshStandardMaterial({ color: 0x7b4f2a, roughness: 0.9, metalness: 0.0 }),
    treeLeaves: new THREE.MeshStandardMaterial({ color: 0x2f5d43, roughness: 0.8, metalness: 0.0 }),
    crate: new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.85, metalness: 0.0 }),
    barrel: new THREE.MeshStandardMaterial({ color: 0x7c4a2a, roughness: 0.8, metalness: 0.0 }),
    rock: new THREE.MeshStandardMaterial({ color: 0x6a6d72, roughness: 0.95, metalness: 0.0 }),
    bush: new THREE.MeshStandardMaterial({ color: 0x2f6b4a, roughness: 0.9, metalness: 0.0 }),
    fence: new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.85, metalness: 0.0 }),
    bench: new THREE.MeshStandardMaterial({ color: 0x6f4b2a, roughness: 0.85, metalness: 0.0 }),
    wellStone: new THREE.MeshStandardMaterial({ color: 0x7f878c, roughness: 0.95, metalness: 0.0 }),
    path: new THREE.MeshStandardMaterial({ color: 0x5b584c, roughness: 0.95, metalness: 0.0 }),
    lanternPole: new THREE.MeshStandardMaterial({ color: 0x3f3a34, roughness: 0.85, metalness: 0.1 }),
    lanternGlassBase: new THREE.MeshStandardMaterial({
      color: 0xffd9a1,
      emissive: 0x1a1208,
      emissiveIntensity: 0.15,
      roughness: 0.4,
      metalness: 0.0
    }),
    herbStem: new THREE.MeshStandardMaterial({ color: 0x3b6a44, roughness: 0.8, metalness: 0.0 }),
    herbLeaf: new THREE.MeshStandardMaterial({ color: 0x4f8f5c, roughness: 0.7, metalness: 0.0 }),
    fire: new THREE.MeshStandardMaterial({
      color: 0xffa85d,
      emissive: 0xff6a2a,
      emissiveIntensity: 1.1,
      roughness: 0.4,
      metalness: 0.0
    }),
    firefly: new THREE.MeshStandardMaterial({
      color: 0xfff2b2,
      emissive: 0xfff2b2,
      emissiveIntensity: 1.2,
      roughness: 0.2,
      metalness: 0.0,
      transparent: true,
      opacity: 0.0
    }),
    markerStone: new THREE.MeshStandardMaterial({ color: 0x6f7780, roughness: 0.9, metalness: 0.0 }),
    markerRune: new THREE.MeshStandardMaterial({
      color: 0x9cc6ff,
      emissive: 0x4b6fff,
      emissiveIntensity: 0.35,
      roughness: 0.4,
      metalness: 0.0
    })
  };
}

export function createWorld({ scene, maxAnisotropy }) {
  const maps = createMaterialMaps(maxAnisotropy);
  const materials = createMaterials(maps);

  const groundGeometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE);

  const obstacles = [];
  const lanterns = [];
  let lanternsLit = 0;
  const herbs = [];
  let herbsCollected = 0;
  const fireflies = [];
  const campfires = [];
  let marker = null;
  const chunks = new Map();
  const tempVector = new THREE.Vector3();

  function addObstacle(x, z, radius, chunkKey = null) {
    const obstacle = { position: new THREE.Vector3(x, 0, z), radius, chunkKey };
    obstacles.push(obstacle);
    return obstacle;
  }

  function resolveCollisions(position, radius) {
    obstacles.forEach((obstacle) => {
      const delta = position.clone().sub(obstacle.position);
      const minDist = obstacle.radius + radius;
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

  function createHouse(x, z, options = {}) {
    const parent = options.parent ?? scene;
    const chunkKey = options.chunkKey ?? null;
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3, 3.6), materials.wall);
    base.position.y = 1.5;
    base.castShadow = true;
    base.receiveShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 2, 4), materials.roof);
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
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 2.2, 8), materials.treeTrunk);
    trunk.position.y = 1.1;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.8, 3.2, 8), materials.treeLeaves);
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
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materials.crate);
    crate.position.set(x - parent.position.x, 0.5, z - parent.position.z);
    crate.castShadow = true;
    crate.receiveShadow = true;
    parent.add(crate);
    addObstacle(x, z, 0.75, chunkKey);
  }

  function createBarrel(x, z, options = {}) {
    const parent = options.parent ?? scene;
    const chunkKey = options.chunkKey ?? null;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 1.1, 14), materials.barrel);
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
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6, 0), materials.rock);
    rock.position.set(x - parent.position.x, 0.35, z - parent.position.z);
    rock.scale.set(0.8 + rand() * 0.5, 0.6 + rand() * 0.4, 0.8 + rand() * 0.5);
    rock.castShadow = true;
    rock.receiveShadow = true;
    parent.add(rock);
    addObstacle(x, z, 0.7, chunkKey);
  }

  function createBush(x, z, options = {}) {
    const parent = options.parent ?? scene;
    const chunkKey = options.chunkKey ?? null;
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 10), materials.bush);
    bush.position.set(x - parent.position.x, 0.55, z - parent.position.z);
    bush.scale.set(1.2, 0.9, 1.1);
    bush.castShadow = true;
    bush.receiveShadow = true;
    parent.add(bush);
    addObstacle(x, z, 0.6, chunkKey);
  }

  function createFence(x, z, options = {}) {
    const parent = options.parent ?? scene;
    const group = new THREE.Group();
    const postA = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1, 0.15), materials.fence);
    const postB = postA.clone();
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), materials.fence);
    postA.position.set(-0.8, 0.5, 0);
    postB.position.set(0.8, 0.5, 0);
    rail.position.set(0, 0.7, 0);
    group.add(postA, postB, rail);
    group.position.set(x - parent.position.x, 0, z - parent.position.z);
    group.rotation.y = options.rotation ?? 0;
    group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    parent.add(group);
  }

  function createBench(x, z, options = {}) {
    const parent = options.parent ?? scene;
    const group = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.5), materials.bench);
    const legA = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), materials.bench);
    const legB = legA.clone();
    seat.position.set(0, 0.45, 0);
    legA.position.set(-0.6, 0.2, -0.15);
    legB.position.set(0.6, 0.2, 0.15);
    group.add(seat, legA, legB);
    group.position.set(x - parent.position.x, 0, z - parent.position.z);
    group.rotation.y = options.rotation ?? 0;
    group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    parent.add(group);
  }

  function createWell(x, z, options = {}) {
    const parent = options.parent ?? scene;
    const group = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 0.6, 16), materials.wellStone);
    ring.position.y = 0.3;
    ring.castShadow = true;
    ring.receiveShadow = true;
    group.add(ring);
    group.position.set(x - parent.position.x, 0, z - parent.position.z);
    parent.add(group);
    addObstacle(x, z, 1.0, options.chunkKey ?? null);
  }

  function createHerb(x, z, options = {}) {
    const parent = options.parent ?? scene;
    const chunkKey = options.chunkKey ?? null;
    const group = new THREE.Group();
    for (let i = 0; i < 3; i += 1) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.35, 6), materials.herbStem);
      stem.position.set((i - 1) * 0.08, 0.18, 0);
      stem.castShadow = true;
      stem.receiveShadow = true;
      group.add(stem);
    }
    const leafA = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 6), materials.herbLeaf);
    leafA.position.set(0.1, 0.3, 0.1);
    leafA.rotation.z = Math.PI / 6;
    const leafB = leafA.clone();
    leafB.position.set(-0.12, 0.28, -0.05);
    leafB.rotation.z = -Math.PI / 5;
    group.add(leafA, leafB);
    group.position.set(x - parent.position.x, 0, z - parent.position.z);
    parent.add(group);
    const herb = { group, collected: false, chunkKey };
    herbs.push(herb);
    return herb;
  }

  function createCampfire(x, z, options = {}) {
    const parent = options.parent ?? scene;
    const group = new THREE.Group();
    for (let i = 0; i < 6; i += 1) {
      const stone = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), materials.rock);
      const angle = (i / 6) * Math.PI * 2;
      stone.position.set(Math.cos(angle) * 0.45, 0.16, Math.sin(angle) * 0.45);
      stone.castShadow = true;
      stone.receiveShadow = true;
      group.add(stone);
    }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 8), materials.fire);
    flame.position.y = 0.45;
    flame.castShadow = true;
    group.add(flame);

    const light = new THREE.PointLight(0xffa05f, 1.6, 9, 2);
    light.position.set(0, 0.9, 0);
    light.castShadow = true;
    group.add(light);

    group.position.set(x - parent.position.x, 0, z - parent.position.z);
    parent.add(group);
    const campfire = { group, flame, light, flicker: Math.random() * 100 };
    campfires.push(campfire);
    addObstacle(x, z, 0.9, options.chunkKey ?? null);
    return campfire;
  }

  function createFireflies(centerX, centerZ) {
    for (let i = 0; i < FIREFLY_COUNT; i += 1) {
      const bug = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), materials.firefly);
      bug.position.set(centerX + (Math.random() - 0.5) * 8, 1.8 + Math.random(), centerZ + (Math.random() - 0.5) * 8);
      scene.add(bug);
      fireflies.push({
        mesh: bug,
        base: bug.position.clone(),
        speed: 0.6 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function createLantern(x, z, options = {}) {
    const parent = options.parent ?? scene;
    const chunkKey = options.chunkKey ?? null;
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.2, 10), materials.lanternPole);
    pole.position.y = 1.6;
    pole.castShadow = true;
    pole.receiveShadow = true;

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.08), materials.lanternPole);
    arm.position.set(0.25, 2.9, 0);
    arm.castShadow = true;
    arm.receiveShadow = true;

    const glassMaterial = materials.lanternGlassBase.clone();
    glassMaterial.userData.disposable = true;
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), glassMaterial);
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

    const lantern = { group, glass, light, lit: false, chunkKey, baseIntensity: 1.35 };
    lanterns.push(lantern);
    return lantern;
  }

  function createMarker(x, z, options = {}) {
    const parent = options.parent ?? scene;
    const group = new THREE.Group();
    const stone = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.4), materials.markerStone);
    stone.position.y = 0.9;
    stone.castShadow = true;
    stone.receiveShadow = true;
    const rune = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.1), materials.markerRune);
    rune.position.set(0, 1.0, 0.26);
    rune.castShadow = false;
    group.add(stone, rune);
    group.position.set(x - parent.position.x, 0, z - parent.position.z);
    parent.add(group);
    addObstacle(x, z, 0.8, options.chunkKey ?? null);
    marker = { group, rune, inspected: false };
    return marker;
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
      if (pick < 0.55) {
        createTree(x, z, { parent, chunkKey });
      } else if (pick < 0.75) {
        createBush(x, z, { parent, chunkKey });
      } else {
        createRock(x, z, { parent, chunkKey, rng: rand });
      }
      if (rand() < 0.35) {
        createHerb(x + (rand() - 0.5) * 2, z + (rand() - 0.5) * 2, { parent, chunkKey });
      }
    }
  }

  function createChunk(cx, cz) {
    const chunkKey = getChunkKey(cx, cz);
    if (chunks.has(chunkKey)) return;

    const group = new THREE.Group();
    group.position.set(cx * CHUNK_SIZE + CHUNK_SIZE / 2, 0, cz * CHUNK_SIZE + CHUNK_SIZE / 2);

    const ground = new THREE.Mesh(groundGeometry, materials.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    group.add(ground);

    scene.add(group);
    chunks.set(chunkKey, { group, cx, cz });

    populateChunk(cx, cz, chunkKey, group);
  }

  function removeByChunk(list, chunkKey) {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (list[i].chunkKey === chunkKey) {
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
        const materialsList = Array.isArray(child.material) ? child.material : [child.material];
        materialsList.forEach((material) => {
          if (material.userData?.disposable) {
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
    removeByChunk(lanterns, chunkKey);
    removeByChunk(herbs, chunkKey);
    chunks.delete(chunkKey);
  }

  let currentChunkKey = null;
  function updateChunks(playerPosition, force = false) {
    const [cx, cz] = getChunkCoords(playerPosition.x, playerPosition.z);
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

  function getNearbyLantern(playerPosition) {
    let nearest = null;
    let nearestDist = Infinity;
    lanterns.forEach((lantern) => {
      lantern.group.getWorldPosition(tempVector);
      const dist = playerPosition.distanceTo(tempVector);
      if (dist < 2.4 && dist < nearestDist) {
        nearest = lantern;
        nearestDist = dist;
      }
    });
    return nearest;
  }

  function lightLantern(lantern) {
    if (lantern.lit) return { changed: false, complete: lanternsLit >= LANTERN_GOAL };
    lantern.lit = true;
    lantern.light.intensity = lantern.baseIntensity;
    lantern.glass.material.emissive = new THREE.Color(0xffc580);
    lantern.glass.material.emissiveIntensity = 1.2;
    lanternsLit += 1;
    return {
      changed: true,
      lit: lanternsLit,
      goal: LANTERN_GOAL,
      complete: lanternsLit >= LANTERN_GOAL
    };
  }

  function isLanternQuestComplete() {
    return lanternsLit >= LANTERN_GOAL;
  }

  function getLanternProgress() {
    return lanternsLit;
  }

  function getNearbyHerb(playerPosition) {
    let nearest = null;
    let nearestDist = Infinity;
    herbs.forEach((herb) => {
      if (herb.collected) return;
      herb.group.getWorldPosition(tempVector);
      const dist = playerPosition.distanceTo(tempVector);
      if (dist < 2.2 && dist < nearestDist) {
        nearest = herb;
        nearestDist = dist;
      }
    });
    return nearest;
  }

  function collectHerb(herb) {
    if (!herb || herb.collected) return { changed: false };
    herb.collected = true;
    herb.group.visible = false;
    herbsCollected += 1;
    return {
      changed: true,
      count: herbsCollected,
      goal: HERB_GOAL,
      complete: herbsCollected >= HERB_GOAL
    };
  }

  function getHerbProgress() {
    return herbsCollected;
  }

  function isHerbQuestComplete() {
    return herbsCollected >= HERB_GOAL;
  }

  function getNearbyMarker(playerPosition) {
    if (!marker) return null;
    marker.group.getWorldPosition(tempVector);
    const dist = playerPosition.distanceTo(tempVector);
    if (dist < 2.4) return marker;
    return null;
  }

  function inspectMarker(target) {
    if (!target || target.inspected) return { changed: false };
    target.inspected = true;
    if (target.rune && target.rune.material) {
      target.rune.material.emissiveIntensity = 0.85;
    }
    return { changed: true };
  }

  function isMarkerInspected() {
    return marker ? marker.inspected : false;
  }

  function updateAmbient(delta, elapsed, nightFactor = 0) {
    campfires.forEach((campfire) => {
      campfire.flicker += delta * 3;
      const flicker = 0.7 + Math.sin(campfire.flicker * 4) * 0.2 + Math.random() * 0.1;
      const nightBoost = 0.6 + nightFactor * 0.9;
      campfire.light.intensity = (1.1 + flicker) * nightBoost;
      campfire.flame.scale.y = 0.9 + Math.sin(campfire.flicker * 5) * 0.15;
    });

    lanterns.forEach((lantern) => {
      if (!lantern.lit) return;
      const glow = 0.6 + nightFactor * 0.8;
      lantern.light.intensity = lantern.baseIntensity * glow;
      if (lantern.glass.material) {
        lantern.glass.material.emissiveIntensity = 0.5 + nightFactor * 0.9;
      }
    });

    const fireflyGlow = 0.05 + nightFactor * 0.95;
    materials.firefly.opacity = fireflyGlow;
    materials.firefly.emissiveIntensity = 0.3 + nightFactor * 1.1;

    fireflies.forEach((fly) => {
      const offset = elapsed * fly.speed + fly.phase;
      fly.mesh.position.x = fly.base.x + Math.cos(offset) * 0.6;
      fly.mesh.position.z = fly.base.z + Math.sin(offset * 0.8) * 0.6;
      fly.mesh.position.y = fly.base.y + Math.sin(offset * 1.3) * 0.4;
    });
  }

  const pathA = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 34), materials.path);
  pathA.rotation.x = -Math.PI / 2;
  pathA.position.set(0, 0.01, -2);
  pathA.receiveShadow = true;
  scene.add(pathA);

  const pathB = new THREE.Mesh(new THREE.PlaneGeometry(18, 4.2), materials.path);
  pathB.rotation.x = -Math.PI / 2;
  pathB.position.set(2, 0.01, 2);
  pathB.receiveShadow = true;
  scene.add(pathB);

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

  createFence(-1, 4.6, { rotation: Math.PI / 2 });
  createFence(1.6, 4.6, { rotation: Math.PI / 2 });
  createFence(-5.5, -0.5, { rotation: Math.PI / 3 });
  createBench(-1.5, 1.6, { rotation: Math.PI / 2 });
  createBench(3.5, 1.2, { rotation: -Math.PI / 4 });
  createWell(-3.2, 5.2);
  createCampfire(2.4, -3.6);
  createBush(-6.2, 6.5);
  createBush(6.2, -1.4);
  createHerb(7.5, -9.5);
  createHerb(9.2, -10.8);
  createHerb(11.3, -9.2);
  createHerb(8.6, -12.2);
  createHerb(10.1, -12.8);
  createMarker(18, 14);

  createFireflies(1, -4);

  return {
    obstacles,
    lanterns,
    lanternGoal: LANTERN_GOAL,
    herbGoal: HERB_GOAL,
    addObstacle,
    resolveCollisions,
    updateChunks,
    updateAmbient,
    getNearbyLantern,
    lightLantern,
    isLanternQuestComplete,
    getLanternProgress,
    getNearbyHerb,
    collectHerb,
    getHerbProgress,
    isHerbQuestComplete,
    getNearbyMarker,
    inspectMarker,
    isMarkerInspected
  };
}
