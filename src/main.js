import { THREE } from './three.js';
import { initEngine } from './engine.js';
import { createWorld } from './world.js';
import { createPlayer, updatePlayer } from './player.js';
import { createNpc, isNearNpc } from './npc.js';
import { setupUI } from './ui.js';
import { createInput } from './input.js';
import { createMultiplayer } from './multiplayer.js';

const { renderer, scene, camera, maxAnisotropy } = initEngine(document.body);

const ui = setupUI();
ui.setNpcName('Elda');

const world = createWorld({ scene, maxAnisotropy });
const player = createPlayer(scene);
const npc = createNpc(scene, world.addObstacle);
const multiplayer = createMultiplayer(scene, {
  onChat: (message) => ui.addChatMessage(message),
  onSystem: (text) => ui.addChatMessage({ system: true, text })
});

const input = createInput(renderer.domElement, {
  shouldCaptureKey: () => ui.isGameStarted() && !ui.isChatTyping(),
  onActionKey: (key) => {
    if (!ui.isGameStarted()) return;
    if (ui.isChatTyping()) return;

    if (key === 'escape' && ui.isDialogOpen()) {
      ui.closeDialog();
      return;
    }

    if (key === 'e' && !ui.isDialogOpen()) {
      if (isNearNpc(player.position, npc.position)) {
        const step = world.isLanternQuestComplete() ? 'complete' : 'start';
        ui.openDialog(step);
        return;
      }
      const lantern = world.getNearbyLantern(player.position);
      if (lantern && !lantern.lit) {
        const result = world.lightLantern(lantern);
        if (result.changed) {
          if (result.complete) {
            ui.showEmote('All lanterns are burning again.');
          } else {
            ui.showEmote(`Lantern lit (${result.lit}/${result.goal}).`);
          }
        }
        return;
      }
    }

    if (key === 'g' && !ui.isDialogOpen()) {
      if (ui.isFlyUnlocked()) {
        flyEnabled = !flyEnabled;
        ui.showEmote(flyEnabled ? 'Fly mode enabled.' : 'Fly mode disabled.');
      } else {
        ui.showEmote('Fly mode locked.');
      }
      return;
    }

    if (key === 'f' && !ui.isDialogOpen()) {
      ui.showEmote('You wave into the evening sun.');
    }
  }
});

const orbitDistance = 7.2;
const orbitHeight = 1.2;
const clock = new THREE.Clock();
let flyEnabled = false;

world.updateChunks(player.position, true);

ui.onStartGame(({ name, serverUrl }) => {
  multiplayer.connect({ name, serverUrl });
});

ui.onChatSendMessage((text) => {
  multiplayer.sendChat(text);
});

ui.onLogoutGame(() => {
  flyEnabled = false;
  player.position.set(0, 0, 6);
  player.rotation.set(0, 0, 0);
  world.updateChunks(player.position, true);
  multiplayer.disconnect();
});

function updateCamera(yaw, pitch) {
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const offset = new THREE.Vector3(
    Math.sin(yaw) * orbitDistance * cosPitch,
    orbitDistance * sinPitch + orbitHeight,
    Math.cos(yaw) * orbitDistance * cosPitch
  );
  const desired = player.position.clone().add(offset);
  camera.position.lerp(desired, 0.08);
  camera.lookAt(player.position.x, player.position.y + 1.2, player.position.z);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const { yaw, pitch } = input.getCameraAngles();

  if (ui.isGameStarted() && !ui.isDialogOpen() && !ui.isChatTyping()) {
    updatePlayer(player, delta, input.keys, yaw, world.resolveCollisions, { flyEnabled });
  }

  world.updateChunks(player.position);
  updateCamera(yaw, pitch);
  if (ui.isGameStarted()) {
    multiplayer.update(delta, player);
  }

  const nearNpc = isNearNpc(player.position, npc.position);
  const nearbyLantern = world.getNearbyLantern(player.position);
  ui.updatePrompt({
    nearNpc,
    nearLantern: Boolean(nearbyLantern && !nearbyLantern.lit)
  });

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
