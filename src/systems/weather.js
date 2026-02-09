import { THREE } from '../core/three.js';

/**
 * Weather system for PolloRP.
 *
 * Cycles through three weather states (clear, rain, overcast) on a random
 * timer.  Rain is rendered as 300 point-particles that fall around the
 * player.  Each state applies a multiplier to the scene fog distance.
 *
 * Usage:
 *   const weather = createWeather({ scene });
 *   // in game loop:
 *   weather.update(delta, playerPosition, nightAmount);
 *   weather.getWeather(); // => 'clear' | 'rain' | 'overcast'
 */

const WEATHER_STATES = ['clear', 'rain', 'overcast'];

const FOG_MULTIPLIERS = {
  clear: 1.0,
  rain: 0.6,
  overcast: 0.8,
};

const RAIN_COUNT = 300;
const RAIN_SPEED = 12;
const RAIN_AREA_X = 40;
const RAIN_AREA_Y = 20;

// How often weather changes (seconds).
const MIN_INTERVAL = 60;
const MAX_INTERVAL = 180;

function randomInterval() {
  return MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);
}

function pickNewState(current) {
  const candidates = WEATHER_STATES.filter((s) => s !== current);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ---------------------------------------------------------------
// Rain particle helpers
// ---------------------------------------------------------------

function createRainGeometry() {
  const positions = new Float32Array(RAIN_COUNT * 3);

  for (let i = 0; i < RAIN_COUNT; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * RAIN_AREA_X;
    positions[i3 + 1] = Math.random() * RAIN_AREA_Y;
    positions[i3 + 2] = (Math.random() - 0.5) * RAIN_AREA_X;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}

function createRainMaterial() {
  return new THREE.PointsMaterial({
    color: 0xaaaacc,
    size: 0.15,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
}

// ---------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------

export function createWeather({ scene }) {
  let currentWeather = 'clear';
  let timer = randomInterval();

  // Store original fog distance so we can scale it.
  const baseFogNear = scene.fog ? scene.fog.near : null;
  const baseFogFar = scene.fog ? scene.fog.far : null;

  // --- Rain points ---
  const rainGeometry = createRainGeometry();
  const rainMaterial = createRainMaterial();
  const rainPoints = new THREE.Points(rainGeometry, rainMaterial);
  rainPoints.visible = false;
  scene.add(rainPoints);

  // -------------------------------------------------------
  // Apply fog multiplier for the current weather state.
  // -------------------------------------------------------
  function applyFog() {
    if (!scene.fog) return;
    const m = FOG_MULTIPLIERS[currentWeather];
    scene.fog.near = baseFogNear * m;
    scene.fog.far = baseFogFar * m;
  }

  // -------------------------------------------------------
  // Update rain particle positions so they fall around the
  // player and reset when they drop below y = 0.
  // -------------------------------------------------------
  function updateRain(delta, playerPosition) {
    const positions = rainGeometry.attributes.position.array;
    const px = playerPosition ? playerPosition.x : 0;
    const pz = playerPosition ? playerPosition.z : 0;

    for (let i = 0; i < RAIN_COUNT; i++) {
      const i3 = i * 3;

      // Fall downward.
      positions[i3 + 1] -= RAIN_SPEED * delta;

      // Reset to the top when below ground level.
      if (positions[i3 + 1] < 0) {
        positions[i3] = px + (Math.random() - 0.5) * RAIN_AREA_X;
        positions[i3 + 1] = RAIN_AREA_Y;
        positions[i3 + 2] = pz + (Math.random() - 0.5) * RAIN_AREA_X;
      }
    }

    rainGeometry.attributes.position.needsUpdate = true;
  }

  // -------------------------------------------------------
  // Main update -- call once per frame.
  // -------------------------------------------------------
  function update(delta, playerPosition, _nightAmount) {
    // Weather state timer.
    timer -= delta;
    if (timer <= 0) {
      currentWeather = pickNewState(currentWeather);
      timer = randomInterval();
      applyFog();
      rainPoints.visible = currentWeather === 'rain';
    }

    // Centre rain around the player even between state switches.
    if (currentWeather === 'rain') {
      updateRain(delta, playerPosition);
    }
  }

  function getWeather() {
    return currentWeather;
  }

  // Initialise fog for the starting state.
  applyFog();

  return { update, getWeather };
}
