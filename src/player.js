import { THREE } from './three.js';

export const PLAYER_RADIUS = 0.6;

export function createPlayer(scene) {
  const player = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.45, 0.9, 6, 10),
    new THREE.MeshStandardMaterial({ color: 0x3a6ea5, roughness: 0.55, metalness: 0.1 })
  );
  body.position.y = 1.25;
  body.castShadow = true;
  body.receiveShadow = true;
  player.add(body);
  player.position.set(0, 0, 6);
  scene.add(player);
  return player;
}

export function updatePlayer(player, delta, keys, cameraYaw, resolveCollisions, options = {}) {
  const inputX = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
  const inputZ = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0);
  const flyEnabled = options.flyEnabled ?? false;
  const vertical =
    (keys.has(' ') || keys.has('space') ? 1 : 0) - (keys.has('shift') ? 1 : 0);

  const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
  const right = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
  const direction = new THREE.Vector3().addScaledVector(forward, inputZ).addScaledVector(right, inputX);
  if (direction.lengthSq() > 0) {
    direction.normalize();
    const speed = flyEnabled ? 6.2 : 4.2;
    const velocity = direction.multiplyScalar(speed * delta);
    const proposed = player.position.clone().add(velocity);
    if (!flyEnabled) {
      resolveCollisions(proposed, PLAYER_RADIUS);
    }
    player.position.copy(proposed);

    const angle = Math.atan2(direction.x, direction.z);
    player.rotation.y = angle;
  }

  if (flyEnabled) {
    if (vertical !== 0) {
      player.position.y += vertical * 3.6 * delta;
    }
  } else {
    player.position.y = 0;
  }
}
