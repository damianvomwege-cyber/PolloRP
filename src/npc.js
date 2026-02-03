import { THREE } from './three.js';

export function createNpc(scene, addObstacle) {
  const npc = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, 0.8, 6, 10),
    new THREE.MeshStandardMaterial({ color: 0x9b6d3a, roughness: 0.6, metalness: 0.05 })
  );
  body.position.y = 1.2;
  body.castShadow = true;
  body.receiveShadow = true;

  const hat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.65, 0.35, 12),
    new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.7, metalness: 0.0 })
  );
  hat.position.y = 2.2;
  hat.castShadow = true;
  hat.receiveShadow = true;

  npc.add(body, hat);
  npc.position.set(-2, 0, -2);
  scene.add(npc);
  addObstacle(-2, -2, 1.0);
  return npc;
}

export function isNearNpc(playerPosition, npcPosition) {
  return playerPosition.distanceTo(npcPosition) < 2.6;
}
