import { THREE } from './three.js';
import { initEngine } from './engine.js';
import { createWorld } from './world.js';
import { createPlayer, updatePlayer } from './player.js';
import { createNpcs, getNearestNpc } from './npc.js';
import { setupUI } from './ui.js';
import { createInput } from './input.js';
import { createMultiplayer } from './multiplayer.js';
import { SERVER_URL } from './config.js';

const { renderer, scene, camera, maxAnisotropy } = initEngine(document.body);

const ui = setupUI();

const world = createWorld({ scene, maxAnisotropy });
const player = createPlayer(scene);
const npcs = createNpcs(scene, world.addObstacle);
const multiplayer = createMultiplayer(scene, {
  onChat: (message) => ui.addChatMessage(message),
  onSystem: (text) => ui.addChatMessage({ system: true, text }),
  onPlayers: (count) => ui.setPlayerCount(count)
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
      const nearestNpc = getNearestNpc(player.position, npcs);
      if (nearestNpc) {
        if (nearestNpc.name === 'Elda') {
          if (world.isLanternQuestComplete()) {
            if (!lanternRewarded) {
              lanternRewarded = true;
              coins += 5;
              ui.updateStats({ coins });
              ui.showEmote('You received 5 coins.');
            }
            ui.openDialog('complete', 'elda', { name: ui.getPlayerName(), coins: 5 });
          } else {
            ui.openDialog('start', 'elda', { name: ui.getPlayerName() });
          }
          return;
        }
        if (nearestNpc.name === 'Jori') {
          const herbs = world.getHerbProgress();
          if (world.isHerbQuestComplete()) {
            if (!herbRewarded) {
              herbRewarded = true;
              coins += 8;
              ui.updateStats({ coins });
              ui.showEmote('You received 8 coins.');
            }
            ui.openDialog('complete', 'jori', { herbs, herbGoal: world.herbGoal, coins: 8 });
          } else if (herbs > 0) {
            ui.openDialog('progress', 'jori', { herbs, herbGoal: world.herbGoal });
          } else {
            ui.openDialog('start', 'jori', { herbGoal: world.herbGoal });
          }
          return;
        }
      }

      const herb = world.getNearbyHerb(player.position);
      if (herb) {
        const result = world.collectHerb(herb);
        if (result.changed) {
          ui.updateStats({ herbs: result.count, herbGoal: result.goal });
          ui.showEmote(`Herb collected (${result.count}/${result.goal}).`);
        }
        return;
      }

      const lantern = world.getNearbyLantern(player.position);
      if (lantern && !lantern.lit) {
        const result = world.lightLantern(lantern);
        if (result.changed) {
          lanternProgress = result.lit;
          ui.updateStats({ lanterns: result.lit, lanternGoal: result.goal });
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
let coins = 0;
let lanternRewarded = false;
let herbRewarded = false;
let lanternProgress = 0;

world.updateChunks(player.position, true);
ui.updateStats({
  lanterns: lanternProgress,
  lanternGoal: world.lanternGoal,
  herbs: world.getHerbProgress(),
  herbGoal: world.herbGoal,
  coins
});
ui.setPlayerCount(1);

ui.onStartGame(({ name }) => {
  multiplayer.connect({ name, serverUrl: SERVER_URL });
});

ui.onChatSendMessage((text) => {
  multiplayer.sendChat(text);
});

ui.onLogoutGame(() => {
  flyEnabled = false;
  player.position.set(0, 0, 6);
  player.rotation.set(0, 0, 0);
  world.updateChunks(player.position, true);
  coins = 0;
  lanternRewarded = false;
  herbRewarded = false;
  lanternProgress = 0;
  ui.updateStats({
    lanterns: lanternProgress,
    lanternGoal: world.lanternGoal,
    herbs: world.getHerbProgress(),
    herbGoal: world.herbGoal,
    coins
  });
  ui.setPlayerCount(1);
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
  world.updateAmbient(delta, clock.elapsedTime);
  updateCamera(yaw, pitch);
  if (ui.isGameStarted()) {
    multiplayer.update(delta, player);
  }

  if (!ui.isGameStarted() || ui.isDialogOpen()) {
    ui.setPrompt('');
  } else {
    const nearestNpc = getNearestNpc(player.position, npcs);
    const nearbyHerb = world.getNearbyHerb(player.position);
    const nearbyLantern = world.getNearbyLantern(player.position);
    if (nearestNpc) {
      ui.setPrompt(`Press E to talk to ${nearestNpc.name}`);
    } else if (nearbyHerb) {
      ui.setPrompt('Press E to gather herbs');
    } else if (nearbyLantern && !nearbyLantern.lit) {
      ui.setPrompt('Press E to light the lantern');
    } else {
      ui.setPrompt('');
    }
  }

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
