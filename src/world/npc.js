import { THREE } from '../core/three.js';

const PATROL_SPEED = 0.8;
const PATROL_WAIT_TIME = 2.5;

function buildNpc(scene, addObstacle, options) {
  const name = options.name ?? 'NPC';
  const bodyColor = options.bodyColor ?? 0x9b6d3a;
  const hatColor = options.hatColor ?? 0x2b2b2b;
  const position = options.position ?? new THREE.Vector3(0, 0, 0);

  const npc = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, 0.8, 6, 10),
    new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.6, metalness: 0.05 })
  );
  body.position.y = 1.2;
  body.castShadow = true;
  body.receiveShadow = true;

  const hat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.65, 0.35, 12),
    new THREE.MeshStandardMaterial({ color: hatColor, roughness: 0.7, metalness: 0.0 })
  );
  hat.position.y = 2.2;
  hat.castShadow = true;
  hat.receiveShadow = true;

  npc.add(body, hat);
  npc.position.copy(position);
  scene.add(npc);
  addObstacle(position.x, position.z, 1.0);

  const patrolPath = options.patrolPath ?? [];
  const isShop = options.isShop ?? false;

  return {
    name,
    group: npc,
    position: npc.position,
    isShop,
    patrolPath,
    patrolIndex: 0,
    patrolWaitTimer: 0,
    patrolMoving: false,
    homePosition: position.clone()
  };
}

export function createNpcs(scene, addObstacle) {
  const elda = buildNpc(scene, addObstacle, {
    name: 'Elda',
    bodyColor: 0x9b6d3a,
    hatColor: 0x2b2b2b,
    position: new THREE.Vector3(-2, 0, -2),
    patrolPath: [
      { x: -2, z: -2 },
      { x: -3, z: 0 },
      { x: -1, z: 1 },
      { x: -2, z: -2 }
    ]
  });

  const jori = buildNpc(scene, addObstacle, {
    name: 'Jori',
    bodyColor: 0x6a8f6a,
    hatColor: 0x3b2f25,
    position: new THREE.Vector3(5.5, 0, 2.5),
    patrolPath: [
      { x: 5.5, z: 2.5 },
      { x: 4, z: 1 },
      { x: 6, z: 0 },
      { x: 5.5, z: 2.5 }
    ]
  });

  const mara = buildNpc(scene, addObstacle, {
    name: 'Mara',
    bodyColor: 0x4f6b8a,
    hatColor: 0x1f2b3a,
    position: new THREE.Vector3(-4.5, 0, 4.5),
    patrolPath: [
      { x: -4.5, z: 4.5 },
      { x: -3, z: 5.5 },
      { x: -5, z: 6 },
      { x: -4.5, z: 4.5 }
    ]
  });

  const gareth = buildNpc(scene, addObstacle, {
    name: 'Gareth',
    bodyColor: 0x7a4a3a,
    hatColor: 0x4a4a4a,
    position: new THREE.Vector3(8, 0, -6),
    patrolPath: [
      { x: 8, z: -6 },
      { x: 10, z: -4 },
      { x: 12, z: -6 },
      { x: 10, z: -8 },
      { x: 8, z: -6 }
    ]
  });

  const ryn = buildNpc(scene, addObstacle, {
    name: 'Ryn',
    bodyColor: 0x5a3a7a,
    hatColor: 0x8a6a2a,
    position: new THREE.Vector3(0, 0, -4),
    isShop: true,
    patrolPath: [
      { x: 0, z: -4 },
      { x: 1, z: -3 },
      { x: 0, z: -4 }
    ]
  });

  return [elda, jori, mara, gareth, ryn];
}

export function getNearestNpc(playerPosition, npcs, range = 2.8) {
  let nearest = null;
  let nearestDist = range;
  npcs.forEach((npc) => {
    const dist = playerPosition.distanceTo(npc.position);
    if (dist < nearestDist) {
      nearest = npc;
      nearestDist = dist;
    }
  });
  return nearest;
}

const _dir = new THREE.Vector3();

export function updateNpcs(npcs, delta) {
  for (const npc of npcs) {
    if (!npc.patrolPath || npc.patrolPath.length < 2) continue;

    if (!npc.patrolMoving) {
      npc.patrolWaitTimer += delta;
      if (npc.patrolWaitTimer >= PATROL_WAIT_TIME) {
        npc.patrolWaitTimer = 0;
        npc.patrolMoving = true;
        npc.patrolIndex = (npc.patrolIndex + 1) % npc.patrolPath.length;
      }
      continue;
    }

    const target = npc.patrolPath[npc.patrolIndex];
    _dir.set(target.x - npc.position.x, 0, target.z - npc.position.z);
    const dist = _dir.length();

    if (dist < 0.2) {
      npc.patrolMoving = false;
      npc.patrolWaitTimer = 0;
      continue;
    }

    _dir.normalize();
    const step = PATROL_SPEED * delta;
    if (step >= dist) {
      npc.position.x = target.x;
      npc.position.z = target.z;
      npc.patrolMoving = false;
    } else {
      npc.position.x += _dir.x * step;
      npc.position.z += _dir.z * step;
    }

    // Face movement direction
    npc.group.rotation.y = Math.atan2(_dir.x, _dir.z);
  }
}
