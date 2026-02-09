import { THREE } from '../core/three.js';

// ---------------------------------------------------------------------------
// Enemy type definitions
// ---------------------------------------------------------------------------

const ENEMY_TYPES = {
  slime: {
    hp: 8,
    damage: 2,
    speed: 1.2,
    xp: 5,
    coinsMin: 1,
    coinsMax: 3,
    spawnWeight: { day: 1, night: 1 },
    buildMesh: () => {
      const geo = new THREE.SphereGeometry(0.35, 12, 10);
      const mat = new THREE.MeshStandardMaterial({ color: 0x44cc44 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.position.y = 0.35;
      return mesh;
    },
  },
  wolf: {
    hp: 15,
    damage: 5,
    speed: 2.8,
    xp: 12,
    coinsMin: 2,
    coinsMax: 5,
    spawnWeight: { day: 1, night: 0.2 },
    buildMesh: () => {
      const group = new THREE.Group();
      const bodyGeo = new THREE.CapsuleGeometry(0.25, 0.6, 6, 10);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.castShadow = true;
      body.rotation.z = Math.PI / 2;
      body.position.y = 0.4;
      group.add(body);
      return group;
    },
  },
  skeleton: {
    hp: 20,
    damage: 7,
    speed: 2.0,
    xp: 18,
    coinsMin: 3,
    coinsMax: 7,
    spawnWeight: { day: 0, night: 1 },
    buildMesh: () => {
      const group = new THREE.Group();
      const bodyGeo = new THREE.CapsuleGeometry(0.2, 0.8, 6, 10);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.castShadow = true;
      body.position.y = 0.6;
      group.add(body);
      return group;
    },
  },
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ENEMIES = 12;
const SPAWN_DIST_MIN = 15;
const SPAWN_DIST_MAX = 30;
const DESPAWN_DIST = 45;

const CHASE_RANGE = 10;
const ATTACK_RANGE = 1.8;
const ATTACK_INTERVAL = 1.2;

const PLAYER_ATTACK_RANGE = 2.5;
const PLAYER_ATTACK_COOLDOWN = 0.5;
const PLAYER_BASE_DAMAGE = 5;
const PLAYER_DAMAGE_PER_LEVEL = 2;

const DEATH_DURATION = 0.4;
const HIT_FLASH_DURATION = 0.15;

const IDLE_WANDER_SPEED = 0.4;
const IDLE_CHANGE_DIR_TIME = 2.5;

const HP_BAR_WIDTH = 0.6;
const HP_BAR_HEIGHT = 0.07;
const HP_BAR_OFFSET_Y = 1.3;

const BASE_SPAWN_INTERVAL = 4;
const MIN_SPAWN_INTERVAL = 1;

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function randRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomAngle() {
  return Math.random() * Math.PI * 2;
}

function pickEnemyType(nightAmount) {
  const weights = [];
  let total = 0;

  for (const [name, def] of Object.entries(ENEMY_TYPES)) {
    const w =
      def.spawnWeight.day * (1 - nightAmount) +
      def.spawnWeight.night * nightAmount;
    weights.push({ name, w });
    total += w;
  }

  let r = Math.random() * total;
  for (const entry of weights) {
    r -= entry.w;
    if (r <= 0) return entry.name;
  }
  return weights[weights.length - 1].name;
}

// ---------------------------------------------------------------------------
// HP bar helper
// ---------------------------------------------------------------------------

function createHpBar() {
  const bgGeo = new THREE.PlaneGeometry(HP_BAR_WIDTH, HP_BAR_HEIGHT);
  const bgMat = new THREE.MeshBasicMaterial({
    color: 0x333333,
    side: THREE.DoubleSide,
    depthTest: false,
  });
  const bg = new THREE.Mesh(bgGeo, bgMat);
  bg.renderOrder = 999;

  const fgGeo = new THREE.PlaneGeometry(HP_BAR_WIDTH, HP_BAR_HEIGHT);
  const fgMat = new THREE.MeshBasicMaterial({
    color: 0xcc2222,
    side: THREE.DoubleSide,
    depthTest: false,
  });
  const fg = new THREE.Mesh(fgGeo, fgMat);
  fg.renderOrder = 1000;
  fg.position.z = 0.001;

  const group = new THREE.Group();
  group.add(bg);
  group.add(fg);
  group.position.y = HP_BAR_OFFSET_Y;

  return { group, fg };
}

function updateHpBar(hpBar, ratio, camera) {
  hpBar.fg.scale.x = Math.max(ratio, 0);
  hpBar.fg.position.x = -(1 - ratio) * HP_BAR_WIDTH * 0.5;

  if (camera) {
    hpBar.group.lookAt(camera.position);
  }
}

// ---------------------------------------------------------------------------
// Enemy entity
// ---------------------------------------------------------------------------

function createEnemy(typeName, position) {
  const def = ENEMY_TYPES[typeName];
  const mesh = def.buildMesh();
  mesh.position.copy(position);

  const hpBar = createHpBar();
  mesh.add(hpBar.group);

  return {
    typeName,
    mesh,
    hp: def.hp,
    maxHp: def.hp,
    hpBar,
    state: 'idle',                // 'idle' | 'chase' | 'attack' | 'dying'
    attackTimer: 0,
    wanderDir: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
    wanderTimer: Math.random() * IDLE_CHANGE_DIR_TIME,
    hitFlashTimer: 0,
    deathTimer: 0,
    originalScale: mesh.scale.clone(),
  };
}

// ---------------------------------------------------------------------------
// Main factory
// ---------------------------------------------------------------------------

export function createCombat({ scene, gameState, audio }) {
  const enemies = [];
  let spawnTimer = 0;
  let playerAttackCooldown = 0;
  let wolvesKilled = 0;

  // Shared temp vectors to reduce allocations
  const _dir = new THREE.Vector3();
  const _spawnPos = new THREE.Vector3();

  // Reference to the active camera (grabbed lazily from the scene)
  let _camera = null;

  function getCamera() {
    if (!_camera) {
      scene.traverse((obj) => {
        if (obj.isCamera) _camera = obj;
      });
    }
    return _camera;
  }

  // -----------------------------------------------------------------------
  // Spawning
  // -----------------------------------------------------------------------

  function spawnEnemy(playerPosition, nightAmount) {
    if (enemies.length >= MAX_ENEMIES) return;

    const typeName = pickEnemyType(nightAmount);
    const angle = randomAngle();
    const dist = SPAWN_DIST_MIN + Math.random() * (SPAWN_DIST_MAX - SPAWN_DIST_MIN);

    _spawnPos.set(
      playerPosition.x + Math.cos(angle) * dist,
      0,
      playerPosition.z + Math.sin(angle) * dist,
    );

    const enemy = createEnemy(typeName, _spawnPos);
    scene.add(enemy.mesh);
    enemies.push(enemy);
  }

  // -----------------------------------------------------------------------
  // Damage / death
  // -----------------------------------------------------------------------

  function damageEnemy(enemy, amount) {
    if (enemy.state === 'dying') return;

    enemy.hp -= amount;
    enemy.hitFlashTimer = HIT_FLASH_DURATION;

    // Apply red emissive flash to all mesh materials in the enemy group
    enemy.mesh.traverse((child) => {
      if (child.isMesh && child.material && child.material.emissive) {
        child.material.emissive.set(0xff0000);
      }
    });

    audio.play('enemyHit');

    if (enemy.hp <= 0) {
      killEnemy(enemy);
    }
  }

  function killEnemy(enemy) {
    enemy.state = 'dying';
    enemy.deathTimer = DEATH_DURATION;

    const def = ENEMY_TYPES[enemy.typeName];
    const coins = randRange(def.coinsMin, def.coinsMax);

    gameState.addCoins(coins);
    gameState.addXp(def.xp);
    gameState.incrementStat('enemiesKilled');

    if (enemy.typeName === 'wolf') {
      wolvesKilled++;
    }

    audio.play('enemyDeath');
  }

  function removeEnemy(enemy) {
    scene.remove(enemy.mesh);

    // Dispose geometry / materials
    enemy.mesh.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });

    const idx = enemies.indexOf(enemy);
    if (idx !== -1) enemies.splice(idx, 1);
  }

  // -----------------------------------------------------------------------
  // AI update per enemy
  // -----------------------------------------------------------------------

  function updateEnemyAI(enemy, delta, playerPosition) {
    const def = ENEMY_TYPES[enemy.typeName];
    const pos = enemy.mesh.position;
    const distToPlayer = pos.distanceTo(playerPosition);

    // --- Dying ---
    if (enemy.state === 'dying') {
      enemy.deathTimer -= delta;
      const t = 1 - enemy.deathTimer / DEATH_DURATION;
      const s = Math.max(1 - t, 0);
      enemy.mesh.scale.set(
        enemy.originalScale.x * s,
        enemy.originalScale.y * s,
        enemy.originalScale.z * s,
      );
      if (enemy.deathTimer <= 0) {
        removeEnemy(enemy);
      }
      return;
    }

    // --- Hit flash ---
    if (enemy.hitFlashTimer > 0) {
      enemy.hitFlashTimer -= delta;
      if (enemy.hitFlashTimer <= 0) {
        enemy.mesh.traverse((child) => {
          if (child.isMesh && child.material && child.material.emissive) {
            child.material.emissive.set(0x000000);
          }
        });
      }
    }

    // --- State transitions ---
    if (distToPlayer <= ATTACK_RANGE) {
      enemy.state = 'attack';
    } else if (distToPlayer <= CHASE_RANGE) {
      enemy.state = 'chase';
    } else {
      enemy.state = 'idle';
    }

    // --- Behaviour ---
    switch (enemy.state) {
      case 'chase': {
        _dir.subVectors(playerPosition, pos).normalize();
        _dir.y = 0;
        pos.addScaledVector(_dir, def.speed * delta);
        enemy.mesh.lookAt(playerPosition.x, pos.y, playerPosition.z);
        break;
      }

      case 'attack': {
        enemy.mesh.lookAt(playerPosition.x, pos.y, playerPosition.z);
        enemy.attackTimer -= delta;
        if (enemy.attackTimer <= 0) {
          enemy.attackTimer = ATTACK_INTERVAL;
          gameState.takeDamage(def.damage);
        }
        break;
      }

      case 'idle':
      default: {
        enemy.wanderTimer -= delta;
        if (enemy.wanderTimer <= 0) {
          enemy.wanderTimer = IDLE_CHANGE_DIR_TIME + Math.random() * 1.5;
          enemy.wanderDir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        }
        pos.addScaledVector(enemy.wanderDir, IDLE_WANDER_SPEED * delta);
        break;
      }
    }

    // --- HP bar ---
    updateHpBar(enemy.hpBar, enemy.hp / enemy.maxHp, getCamera());
  }

  // -----------------------------------------------------------------------
  // Player attack
  // -----------------------------------------------------------------------

  function requestAttack() {
    if (playerAttackCooldown > 0) return;

    playerAttackCooldown = PLAYER_ATTACK_COOLDOWN;

    const level = gameState.getLevel();
    const damage = PLAYER_BASE_DAMAGE + (level - 1) * PLAYER_DAMAGE_PER_LEVEL;

    audio.play('playerAttack');

    // We need the current player position; it was passed to update this frame.
    // Grab it from the closure set in update().
    const origin = _lastPlayerPosition;
    if (!origin) return;

    // Find the closest enemy within attack range
    let closest = null;
    let closestDist = Infinity;

    for (const enemy of enemies) {
      if (enemy.state === 'dying') continue;
      const d = enemy.mesh.position.distanceTo(origin);
      if (d <= PLAYER_ATTACK_RANGE && d < closestDist) {
        closest = enemy;
        closestDist = d;
      }
    }

    if (closest) {
      damageEnemy(closest, damage);
    }
  }

  // -----------------------------------------------------------------------
  // Clear all enemies (e.g. on scene change)
  // -----------------------------------------------------------------------

  function clearAllEnemies() {
    // Iterate in reverse so removal doesn't skip indices
    for (let i = enemies.length - 1; i >= 0; i--) {
      removeEnemy(enemies[i]);
    }
  }

  // -----------------------------------------------------------------------
  // Main update
  // -----------------------------------------------------------------------

  let _lastPlayerPosition = null;

  function update(delta, playerPosition, nightAmount, isInsideHouse) {
    _lastPlayerPosition = playerPosition;

    // Tick player attack cooldown
    if (playerAttackCooldown > 0) {
      playerAttackCooldown -= delta;
    }

    // --- Despawn enemies too far away ---
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      if (
        enemy.state !== 'dying' &&
        enemy.mesh.position.distanceTo(playerPosition) > DESPAWN_DIST
      ) {
        removeEnemy(enemy);
      }
    }

    // --- Spawn timer ---
    if (!isInsideHouse) {
      const spawnInterval =
        BASE_SPAWN_INTERVAL -
        (BASE_SPAWN_INTERVAL - MIN_SPAWN_INTERVAL) * nightAmount;

      spawnTimer += delta;
      if (spawnTimer >= spawnInterval) {
        spawnTimer = 0;
        spawnEnemy(playerPosition, nightAmount);
      }
    }

    // --- Update each enemy ---
    // Iterate over a copy because enemies may be removed during update
    const snapshot = [...enemies];
    for (const enemy of snapshot) {
      updateEnemyAI(enemy, delta, playerPosition);
    }
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  return {
    update,
    requestAttack,
    clearAllEnemies,
    getEnemies: () => enemies,
    getWolvesKilled: () => wolvesKilled,
  };
}
