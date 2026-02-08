import { THREE } from './core/three.js';
import { initEngine } from './core/engine.js';
import { createWorld } from './world/world.js';
import { createPlayer, updatePlayer } from './world/player.js';
import { createNpcs, getNearestNpc } from './world/npc.js';
import { setupUI } from './ui/ui.js';
import { createInput } from './systems/input.js';
import { createMultiplayer } from './systems/multiplayer.js';
import { createDayNight } from './systems/daynight.js';
import { createAudio } from './systems/audio.js';
import { SERVER_URL } from './core/config.js';

const { renderer, scene, camera, maxAnisotropy, lights } = initEngine(document.body);
const dayNight = createDayNight({ scene, renderer, lights });
const audio = createAudio();

const ui = setupUI();
const world = createWorld({ scene, maxAnisotropy });
const player = createPlayer(scene);
const npcs = createNpcs(scene, world.addObstacle);
const multiplayer = createMultiplayer(scene, {
  onChat: (message) => ui.addChatMessage(message),
  onSystem: (text) => ui.addChatMessage({ system: true, text }),
  onPlayers: (count) => ui.setPlayerCount(count)
});

window.addEventListener(
  'pointerdown',
  () => {
    audio.start();
  },
  { once: true }
);

const QUESTS = {
  lanterns: {
    id: 'lanterns',
    title: 'Relight the lanterns',
    npc: 'Elda',
    reward: 5,
    goal: () => world.lanternGoal
  },
  herbs: {
    id: 'herbs',
    title: 'Gather marsh herbs',
    npc: 'Jori',
    reward: 8,
    requires: 'lanterns',
    goal: () => world.herbGoal
  },
  scout: {
    id: 'scout',
    title: 'Scout the old marker',
    npc: 'Mara',
    reward: 6,
    requires: 'herbs',
    goal: () => 1
  }
};

const QUEST_ORDER = ['lanterns', 'herbs', 'scout'];
let activeQuest = null;
const completedQuests = new Set();

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
      if (world.isInsideHouse()) {
        if (world.getNearbyHouseExit(player.position)) {
          const result = world.exitHouse();
          if (result.changed && result.teleport) {
            player.position.set(result.teleport.x, 0, result.teleport.z);
            ui.showEmote('You step back outside.');
            audio.play('door');
          }
        }
        return;
      }

      const nearestNpc = getNearestNpc(player.position, npcs);
      if (nearestNpc) {
        if (activeQuest && QUESTS[activeQuest].npc !== nearestNpc.name) {
          ui.showEmote('Finish your current quest first.');
          audio.play('deny');
          return;
        }

        if (nearestNpc.name === 'Elda') {
          handleElda();
          return;
        }
        if (nearestNpc.name === 'Jori') {
          handleJori();
          return;
        }
        if (nearestNpc.name === 'Mara') {
          handleMara();
          return;
        }
      }

      const marker = world.getNearbyMarker(player.position);
      if (marker) {
        const result = world.inspectMarker(marker);
        if (result.changed) {
          ui.showEmote('You study the glowing runes.');
          audio.play('marker');
          updateQuestUI();
        }
        return;
      }

      const herb = world.getNearbyHerb(player.position);
      if (herb) {
        const result = world.collectHerb(herb);
        if (result.changed) {
          ui.updateStats({ herbs: result.count, herbGoal: result.goal });
          ui.showEmote(`Herb collected (${result.count}/${result.goal}).`);
          audio.play('herb');
          updateQuestUI();
        }
        return;
      }

      const lantern = world.getNearbyLantern(player.position);
      if (lantern && !lantern.lit) {
        const result = world.lightLantern(lantern);
        if (result.changed) {
          ui.updateStats({ lanterns: result.lit, lanternGoal: result.goal });
          audio.play('lantern');
          updateQuestUI();
          if (result.complete) {
            ui.showEmote('All lanterns are burning again.');
          } else {
            ui.showEmote(`Lantern lit (${result.lit}/${result.goal}).`);
          }
        }
        return;
      }

      const house = world.getNearbyHouseDoor(player.position);
      if (house) {
        const result = world.enterHouse(house, player.position);
        if (result.changed && result.teleport) {
          player.position.set(result.teleport.x, 0, result.teleport.z);
          ui.showEmote('You enter the house.');
          audio.play('door');
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
let lastPlayerPosition = player.position.clone();

function getQuestGoal(id) {
  const quest = QUESTS[id];
  return quest ? quest.goal() : 0;
}

function getQuestProgress(id) {
  switch (id) {
    case 'lanterns':
      return world.getLanternProgress();
    case 'herbs':
      return world.getHerbProgress();
    case 'scout':
      return world.isMarkerInspected() ? 1 : 0;
    default:
      return 0;
  }
}

function isQuestComplete(id) {
  return getQuestProgress(id) >= getQuestGoal(id);
}

function getNextQuestId() {
  return QUEST_ORDER.find((id) => !completedQuests.has(id)) ?? null;
}

function updateQuestUI() {
  if (!ui.isGameStarted()) {
    ui.setQuestStatus({ title: 'Press Play', detail: 'Choose a name to begin.' });
    return;
  }

  if (activeQuest) {
    const quest = QUESTS[activeQuest];
    const progress = getQuestProgress(activeQuest);
    const goal = getQuestGoal(activeQuest);
    const detail = progress >= goal ? `Return to ${quest.npc}` : `${progress}/${goal}`;
    ui.setQuestStatus({ title: quest.title, detail });
    return;
  }

  const nextQuest = getNextQuestId();
  if (!nextQuest) {
    ui.setQuestStatus({ title: 'No active quest', detail: 'All quests completed.' });
    return;
  }

  ui.setQuestStatus({
    title: 'No active quest',
    detail: `Talk to ${QUESTS[nextQuest].npc} to begin.`
  });
}

function startQuest(id) {
  const quest = QUESTS[id];
  if (!quest) return false;
  if (completedQuests.has(id)) return false;
  if (activeQuest && activeQuest !== id) return false;
  if (quest.requires && !completedQuests.has(quest.requires)) return false;
  activeQuest = id;
  updateQuestUI();
  ui.showEmote(`Quest started: ${quest.title}.`);
  return true;
}

function finishQuest(id) {
  const quest = QUESTS[id];
  if (!quest) return;
  if (completedQuests.has(id)) return;
  completedQuests.add(id);
  activeQuest = null;
  coins += quest.reward;
  ui.updateStats({ coins });
  ui.showEmote(`Quest complete! +${quest.reward} coins.`);
  audio.play('quest');
  updateQuestUI();
}

function handleElda() {
  if (completedQuests.has('lanterns')) {
    ui.openDialog('bye', 'elda', { name: ui.getPlayerName() });
    return;
  }

  const progress = world.getLanternProgress();
  if (world.isLanternQuestComplete()) {
    finishQuest('lanterns');
    ui.openDialog('complete', 'elda', { name: ui.getPlayerName(), coins: QUESTS.lanterns.reward });
    return;
  }

  if (!activeQuest) {
    startQuest('lanterns');
    ui.openDialog('start', 'elda', { name: ui.getPlayerName() });
    return;
  }

  if (progress > 0) {
    ui.openDialog('progress', 'elda', { lit: progress, goal: world.lanternGoal });
  } else {
    ui.openDialog('start', 'elda', { name: ui.getPlayerName() });
  }
}

function handleJori() {
  if (!completedQuests.has('lanterns')) {
    ui.openDialog('locked', 'jori');
    audio.play('deny');
    return;
  }

  if (completedQuests.has('herbs')) {
    ui.openDialog('thanks', 'jori');
    return;
  }

  const progress = world.getHerbProgress();
  if (world.isHerbQuestComplete()) {
    finishQuest('herbs');
    ui.openDialog('complete', 'jori', {
      herbs: progress,
      herbGoal: world.herbGoal,
      coins: QUESTS.herbs.reward
    });
    return;
  }

  if (!activeQuest) {
    startQuest('herbs');
    ui.openDialog('start', 'jori', { herbGoal: world.herbGoal });
    return;
  }

  if (progress > 0) {
    ui.openDialog('progress', 'jori', { herbs: progress, herbGoal: world.herbGoal });
  } else {
    ui.openDialog('start', 'jori', { herbGoal: world.herbGoal });
  }
}

function handleMara() {
  if (!completedQuests.has('herbs')) {
    ui.openDialog('locked', 'mara');
    audio.play('deny');
    return;
  }

  if (completedQuests.has('scout')) {
    ui.openDialog('thanks', 'mara');
    return;
  }

  if (world.isMarkerInspected()) {
    finishQuest('scout');
    ui.openDialog('complete', 'mara', { coins: QUESTS.scout.reward });
    return;
  }

  if (!activeQuest) {
    startQuest('scout');
    ui.openDialog('start', 'mara');
    return;
  }

  ui.openDialog('progress', 'mara');
}

world.updateChunks(player.position, true);
ui.updateStats({
  lanterns: world.getLanternProgress(),
  lanternGoal: world.lanternGoal,
  herbs: world.getHerbProgress(),
  herbGoal: world.herbGoal,
  coins
});
ui.setPlayerCount(1);
updateQuestUI();

ui.onStartGame(({ name }) => {
  multiplayer.connect({ name, serverUrl: SERVER_URL });
  audio.start();
  updateQuestUI();
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
  completedQuests.clear();
  activeQuest = null;
  ui.updateStats({
    lanterns: world.getLanternProgress(),
    lanternGoal: world.lanternGoal,
    herbs: world.getHerbProgress(),
    herbGoal: world.herbGoal,
    coins
  });
  ui.setPlayerCount(1);
  updateQuestUI();
  multiplayer.disconnect();
  audio.stop();
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

  if (!world.isInsideHouse()) {
    world.updateChunks(player.position);
  }
  const dayState = dayNight.update(clock.elapsedTime);
  world.updateAmbient(delta, clock.elapsedTime, dayState.night);
  updateCamera(yaw, pitch);
  if (ui.isGameStarted()) {
    multiplayer.update(delta, player);
  }

  const distance = player.position.distanceTo(lastPlayerPosition);
  const speed = delta > 0 ? distance / delta : 0;
  lastPlayerPosition.copy(player.position);
  audio.update({ night: dayState.night, moving: speed > 0.1, speed });

  if (!ui.isGameStarted() || ui.isDialogOpen()) {
    ui.setPrompt('');
  } else {
    if (world.isInsideHouse()) {
      if (world.getNearbyHouseExit(player.position)) {
        ui.setPrompt('Press E to exit the house');
      } else {
        ui.setPrompt('');
      }
      renderer.render(scene, camera);
      return;
    }

    const nearestNpc = getNearestNpc(player.position, npcs);
    const nearbyHerb = world.getNearbyHerb(player.position);
    const nearbyLantern = world.getNearbyLantern(player.position);
    const nearbyMarker = world.getNearbyMarker(player.position);
    const nearbyHouse = world.getNearbyHouseDoor(player.position);

    if (nearestNpc) {
      if (activeQuest && QUESTS[activeQuest].npc !== nearestNpc.name) {
        ui.setPrompt('Finish your current quest first');
      } else {
        ui.setPrompt(`Press E to talk to ${nearestNpc.name}`);
      }
    } else if (activeQuest === 'scout' && nearbyMarker && !world.isMarkerInspected()) {
      ui.setPrompt('Press E to inspect the marker');
    } else if (nearbyHerb) {
      ui.setPrompt('Press E to gather herbs');
    } else if (nearbyLantern && !nearbyLantern.lit) {
      ui.setPrompt('Press E to light the lantern');
    } else if (nearbyHouse) {
      ui.setPrompt('Press E to enter the house');
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
