import { THREE } from '../core/three.js';

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

  // Hat mount point
  const hatMount = new THREE.Group();
  hatMount.position.y = 2.2;
  player.add(hatMount);
  player.userData.hatMount = hatMount;

  player.position.set(0, 0, 6);
  scene.add(player);
  return player;
}

export function updatePlayer(player, delta, keys, cameraYaw, resolveCollisions, options = {}) {
  const inputX = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
  const inputZ = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0);
  const speedMultiplier = options.speedMultiplier ?? 1.0;

  const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
  const right = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
  const direction = new THREE.Vector3().addScaledVector(forward, inputZ).addScaledVector(right, inputX);
  if (direction.lengthSq() > 0) {
    direction.normalize();
    const speed = 4.2 * speedMultiplier;
    const velocity = direction.multiplyScalar(speed * delta);
    const proposed = player.position.clone().add(velocity);
    resolveCollisions(proposed, PLAYER_RADIUS);
    player.position.copy(proposed);

    const angle = Math.atan2(direction.x, direction.z);
    player.rotation.y = angle;
  }

  player.position.y = 0;
}

const HAT_FACTORIES = {
  wizard: () => {
    const mesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 0.8, 8),
      new THREE.MeshStandardMaterial({ color: 0x2b1a50, roughness: 0.7 })
    );
    mesh.castShadow = true;
    return mesh;
  },
  crown: () => {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.35, 0.08, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.3, metalness: 0.8 })
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.castShadow = true;
    return mesh;
  },
  straw: () => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.7, 0.2, 12),
      new THREE.MeshStandardMaterial({ color: 0xc4a55a, roughness: 0.9 })
    );
    mesh.castShadow = true;
    return mesh;
  },
  knight: () => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.4, metalness: 0.7 })
    );
    mesh.castShadow = true;
    return mesh;
  }
};

export function setPlayerHat(player, hatId) {
  const mount = player.userData.hatMount;
  if (!mount) return;
  while (mount.children.length > 0) {
    const child = mount.children[0];
    mount.remove(child);
    if (child.isMesh) {
      child.geometry.dispose();
      child.material.dispose();
    }
  }
  if (!hatId) return;
  const factory = HAT_FACTORIES[hatId];
  if (factory) {
    mount.add(factory());
  }
}
