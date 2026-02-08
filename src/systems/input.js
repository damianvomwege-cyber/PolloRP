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

  // Wheel events can be captured by overlay UI; listen on window so zoom works reliably.
  window.addEventListener(
    'wheel',
    (event) => {
      if (options.shouldCaptureWheel && !options.shouldCaptureWheel(event)) {
        return;
      }
      if (options.onZoom) {
        // Prevent page scrolling while zooming the camera.
        event.preventDefault();
        options.onZoom(event.deltaY, event);
      }
    },
    { passive: false }
  );

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

