import { THREE } from '../core/three.js';

export function createDayNight({ scene, renderer, lights, cycleSeconds = 180 }) {
  const daySky = new THREE.Color(0x9bb7d1);
  const nightSky = new THREE.Color(0x0b1020);
  const dayFog = new THREE.Color(0x9bb7d1);
  const nightFog = new THREE.Color(0x06080f);
  const dayHemiSky = new THREE.Color(0xfff4d6);
  const nightHemiSky = new THREE.Color(0x2a3c5c);
  const dayHemiGround = new THREE.Color(0x41545e);
  const nightHemiGround = new THREE.Color(0x0b0f16);
  const daySun = new THREE.Color(0xfff1d4);
  const nightSun = new THREE.Color(0x7aa1ff);

  const sky = new THREE.Color();
  const fog = new THREE.Color();
  const hemiSky = new THREE.Color();
  const hemiGround = new THREE.Color();
  const sunColor = new THREE.Color();

  const hemisphere = lights?.hemisphere;
  const sun = lights?.sun;
  const fill = lights?.fill;

  function update(elapsed) {
    const t = ((elapsed % cycleSeconds) / cycleSeconds) * Math.PI * 2;
    const daylight = 0.5 + 0.5 * Math.sin(t);
    const dayAmount = THREE.MathUtils.smoothstep(daylight, 0.12, 0.88);
    const nightAmount = 1 - dayAmount;

    sky.lerpColors(nightSky, daySky, dayAmount);
    fog.lerpColors(nightFog, dayFog, dayAmount);
    scene.background = sky;
    if (scene.fog) {
      scene.fog.color.copy(fog);
    }

    if (hemisphere) {
      hemiSky.lerpColors(nightHemiSky, dayHemiSky, dayAmount);
      hemiGround.lerpColors(nightHemiGround, dayHemiGround, dayAmount);
      hemisphere.color.copy(hemiSky);
      hemisphere.groundColor.copy(hemiGround);
      hemisphere.intensity = THREE.MathUtils.lerp(0.08, 0.55, dayAmount);
    }

    if (sun) {
      sunColor.lerpColors(nightSun, daySun, dayAmount);
      sun.color.copy(sunColor);
      sun.intensity = THREE.MathUtils.lerp(0.1, 1.45, dayAmount);
      sun.position.set(Math.cos(t) * 16, 6 + Math.sin(t) * 18, Math.sin(t) * 16);
    }

    if (fill) {
      fill.intensity = THREE.MathUtils.lerp(0.05, 0.28, dayAmount);
      fill.position.set(-Math.cos(t) * 10, 5 + Math.sin(t) * 8, -Math.sin(t) * 10);
    }

    if (renderer) {
      renderer.toneMappingExposure = THREE.MathUtils.lerp(0.75, 1.08, dayAmount);
    }

    return { day: dayAmount, night: nightAmount };
  }

  return { update };
}

