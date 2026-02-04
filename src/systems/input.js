import { THREE } from '../core/three.js';

export function createInput(domElement, options = {}) {
  const keys = new Set();
  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;
  const mouseSensitivity = options.mouseSensitivity ?? 0.0032;
  const pitchMin = options.pitchMin ?? 0.1;
  const pitchMax = options.pitchMax ?? 0.75;
  let cameraYaw = options.initialYaw ?? Math.PI;
  let cameraPitch = options.initialPitch ?? 0.35;

  domElement.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });

  domElement.addEventListener('mousedown', (event) => {
    if (event.button !== 2) return;
    isDragging = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
    domElement.style.cursor = 'grabbing';
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    domElement.style.cursor = 'grab';
  });

  window.addEventListener('mousemove', (event) => {
    if (!isDragging) return;
    const deltaX = event.clientX - lastMouseX;
    const deltaY = event.clientY - lastMouseY;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;

    cameraYaw -= deltaX * mouseSensitivity;
    cameraPitch += deltaY * mouseSensitivity;
    cameraPitch = THREE.MathUtils.clamp(cameraPitch, pitchMin, pitchMax);
  });

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const key = event.key.toLowerCase();
    if (options.onActionKey) {
      options.onActionKey(key, event);
    }
    if (options.shouldCaptureKey && !options.shouldCaptureKey(key, event)) {
      return;
    }
    keys.add(key);
  });

  window.addEventListener('keyup', (event) => {
    keys.delete(event.key.toLowerCase());
  });

  return {
    keys,
    getCameraAngles() {
      return { yaw: cameraYaw, pitch: cameraPitch };
    }
  };
}

