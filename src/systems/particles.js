import { THREE } from '../core/three.js';

/**
 * Chimney-smoke particle system for PolloRP.
 *
 * Register one or more emitter positions (e.g. chimney tops) with
 * addSmokeEmitter().  Each frame, active emitters spawn small gray
 * sphere particles that rise, drift sideways, grow, and fade out
 * over a 2-3 second lifetime.  Dead particles are removed from the
 * scene and their geometries / materials disposed.
 *
 * Usage:
 *   const ps = createParticleSystem({ scene });
 *   ps.addSmokeEmitter(new THREE.Vector3(10, 8, -5));
 *   // in game loop:
 *   ps.update(delta);
 */

const MAX_PARTICLES = 40;
const PARTICLE_RADIUS = 0.08;
const RISE_SPEED = 0.8;
const MIN_LIFETIME = 2;
const MAX_LIFETIME = 3;

// Shared geometry -- every smoke sphere uses the same shape.
const sharedGeometry = new THREE.SphereGeometry(PARTICLE_RADIUS, 6, 6);

// ---------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------

export function createParticleSystem({ scene }) {
  /** @type {{ mesh: THREE.Mesh, velocity: THREE.Vector3, age: number, lifetime: number, startScale: number }[]} */
  const particles = [];

  /** @type {THREE.Vector3[]} */
  const emitters = [];

  // Track time so we can throttle emission per emitter.
  let emitAccumulator = 0;

  // -------------------------------------------------------
  // Spawn a single smoke particle at `origin`.
  // -------------------------------------------------------
  function spawnParticle(origin) {
    if (particles.length >= MAX_PARTICLES) return;

    const material = new THREE.MeshBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.7,
    });

    const mesh = new THREE.Mesh(sharedGeometry, material);
    mesh.position.copy(origin);

    // Small random offset so particles don't all stack on the same spot.
    mesh.position.x += (Math.random() - 0.5) * 0.2;
    mesh.position.z += (Math.random() - 0.5) * 0.2;

    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.4, // sideways drift x
      RISE_SPEED,                   // upward
      (Math.random() - 0.5) * 0.4  // sideways drift z
    );

    const lifetime = MIN_LIFETIME + Math.random() * (MAX_LIFETIME - MIN_LIFETIME);

    scene.add(mesh);

    particles.push({
      mesh,
      velocity,
      age: 0,
      lifetime,
      startScale: 1,
    });
  }

  // -------------------------------------------------------
  // Register an emitter position (e.g. chimney top).
  // -------------------------------------------------------
  function addSmokeEmitter(position) {
    emitters.push(position.clone ? position.clone() : new THREE.Vector3(position.x, position.y, position.z));
  }

  // -------------------------------------------------------
  // Per-frame update.
  // -------------------------------------------------------
  function update(delta) {
    // --- Emission ---
    // Emit roughly one particle per emitter every 0.25 s, respecting
    // the global cap.
    emitAccumulator += delta;
    const emitInterval = 0.25;

    if (emitAccumulator >= emitInterval) {
      emitAccumulator -= emitInterval;
      for (let e = 0; e < emitters.length; e++) {
        spawnParticle(emitters[e]);
      }
    }

    // --- Simulation ---
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += delta;

      if (p.age >= p.lifetime) {
        // Remove and dispose.
        scene.remove(p.mesh);
        p.mesh.material.dispose();
        // Geometry is shared -- do NOT dispose it here.
        particles.splice(i, 1);
        continue;
      }

      const t = p.age / p.lifetime; // 0 -> 1

      // Move.
      p.mesh.position.x += p.velocity.x * delta;
      p.mesh.position.y += p.velocity.y * delta;
      p.mesh.position.z += p.velocity.z * delta;

      // Grow over lifetime (1x -> 3x).
      const scale = 1 + t * 2;
      p.mesh.scale.set(scale, scale, scale);

      // Fade out.
      p.mesh.material.opacity = 0.7 * (1 - t);
    }
  }

  return { addSmokeEmitter, update };
}
