import { THREE } from './three.js';

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

  return { name, group: npc, position: npc.position };
}

export function createNpcs(scene, addObstacle) {
  const elda = buildNpc(scene, addObstacle, {
    name: 'Elda',
    bodyColor: 0x9b6d3a,
    hatColor: 0x2b2b2b,
    position: new THREE.Vector3(-2, 0, -2)
  });

  const jori = buildNpc(scene, addObstacle, {
    name: 'Jori',
    bodyColor: 0x6a8f6a,
    hatColor: 0x3b2f25,
    position: new THREE.Vector3(5.5, 0, 2.5)
  });

  const mara = buildNpc(scene, addObstacle, {
    name: 'Mara',
    bodyColor: 0x4f6b8a,
    hatColor: 0x1f2b3a,
    position: new THREE.Vector3(-4.5, 0, 4.5)
  });

  return [elda, jori, mara];
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
