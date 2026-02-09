import { THREE } from './core/three.js';
import { initEngine } from './core/engine.js';
import { createWorld } from './world/world.js';
import { createPlayer, updatePlayer, setPlayerHat } from './world/player.js';
import { createNpcs, getNearestNpc, updateNpcs } from './world/npc.js';
import { setupUI } from './ui/ui.js';
import { createInput } from './systems/input.js';
import { createMultiplayer } from './systems/multiplayer.js';
import { createDayNight } from './systems/daynight.js';
import { createAudio } from './systems/audio.js';
import { createGameState } from './systems/gamestate.js';
import { createCombat } from './systems/combat.js';
import { createWeather } from './systems/weather.js';
import { createParticleSystem } from './systems/particles.js';
import { SERVER_URL } from './core/config.js';

const ui = setupUI();
const audio = createAudio();
const gameState = createGameState();

let renderer, scene, camera, maxAnisotropy, lights;
try {
  ({ renderer, scene, camera, maxAnisotropy, lights } = initEngine(document.body));
} catch (err) {
  ui.showEmote('Failed to start 3D engine. Try reloading.');
  throw err;
}

const DAY_NIGHT_CYCLE_SECONDS = 180;
const dayNight = createDayNight({ scene, renderer, lights, cycleSeconds: DAY_NIGHT_CYCLE_SECONDS });
const world = createWorld({ scene, maxAnisotropy });
const player = createPlayer(scene);
const npcs = createNpcs(scene, world.addObstacle);
const multiplayer = createMultiplayer(scene, {
  onChat: (message) => ui.addChatMessage(message),
  onSystem: (text) => ui.addChatMessage({ system: true, text }),
  onPlayers: (count) => ui.setPlayerCount(count)
});
const combat = createCombat({ scene, gameState, audio });
const weather = createWeather({ scene });
const particles = createParticleSystem({ scene });

// Register chimney smoke emitters from village houses
world.getHouses().forEach((house) => {
  if (house.chimneyPosition) {
    particles.addSmokeEmitter(house.chimneyPosition);
  }
});

window.addEventListener(
  'pointerdown',
  () => {
    audio.start();
  },
  { once: true }
);

// ── Shop Items ───────────────────────────────────────────────
const SHOP_ITEMS = [
  { id: 'hat_wizard', name: 'Wizard Hat', price: 15, description: 'A pointy hat of mystery.', type: 'cosmetic', slot: 'hat', hatId: 'wizard' },
  { id: 'hat_crown', name: 'Golden Crown', price: 30, description: 'Fit for royalty.', type: 'cosmetic', slot: 'hat', hatId: 'crown' },
  { id: 'hat_straw', name: 'Straw Hat', price: 8, description: 'Simple but charming.', type: 'cosmetic', slot: 'hat', hatId: 'straw' },
  { id: 'hat_knight', name: 'Knight Helm', price: 25, description: 'Protection and prestige.', type: 'cosmetic', slot: 'hat', hatId: 'knight' },
  { id: 'speed_boost', name: 'Speed Tonic', price: 10, description: '50% faster for 60 seconds.', type: 'consumable' },
  { id: 'health_potion', name: 'Health Potion', price: 5, description: 'Restores 10 HP.', type: 'consumable' }
];

// ── Item Registry ────────────────────────────────────────────
const ITEM_REGISTRY = {
  health_potion: { name: 'Health Potion', icon: '\u2764\uFE0F', category: 'consumable', description: 'A bubbling red elixir. Restores 10 HP.', action: 'Click to drink' },
  speed_boost: { name: 'Speed Tonic', icon: '\u26A1', category: 'consumable', description: 'A fizzing yellow tonic. 50% faster for 60 seconds.', action: 'Click to drink' },
  herb: { name: 'Marsh Herb', icon: '\uD83C\uDF3F', category: 'material', description: 'A fragrant herb from the marshlands. Used in crafting.', action: null },
  mushroom: { name: 'Cave Mushroom', icon: '\uD83C\uDF44', category: 'material', description: 'A glowing mushroom. Prized by alchemists.', action: null },
  bread: { name: 'Fresh Bread', icon: '\uD83C\uDF5E', category: 'material', description: 'A warm loaf from Jori. Deliver it to Mara.', action: null },
  hat_wizard: { name: 'Wizard Hat', icon: '\uD83E\uDDD9', category: 'equipment', description: 'A pointy hat of mystery.', action: 'Click to equip', slot: 'hat', hatId: 'wizard' },
  hat_crown: { name: 'Golden Crown', icon: '\uD83D\uDC51', category: 'equipment', description: 'Fit for royalty.', action: 'Click to equip', slot: 'hat', hatId: 'crown' },
  hat_straw: { name: 'Straw Hat', icon: '\uD83D\uDC52', category: 'equipment', description: 'Simple but charming.', action: 'Click to equip', slot: 'hat', hatId: 'straw' },
  hat_knight: { name: 'Knight Helm', icon: '\u2694\uFE0F', category: 'equipment', description: 'Protection and prestige.', action: 'Click to equip', slot: 'hat', hatId: 'knight' }
};

function useItem(itemId) {
  const reg = ITEM_REGISTRY[itemId];
  if (!reg) return;

  if (itemId === 'health_potion') {
    if (gameState.getHp() >= gameState.getMaxHp()) {
      ui.showEmote('Already at full health.');
      return;
    }
    gameState.removeItem('health_potion');
    gameState.heal(10);
    ui.showEmote('You drink a health potion. +10 HP');
    audio.play('loot');
    return;
  }

  if (itemId === 'speed_boost') {
    gameState.removeItem('speed_boost');
    gameState.activateSpeedBoost(60000);
    ui.showEmote('Speed boost activated!');
    audio.play('loot');
    return;
  }

  if (reg.category === 'equipment' && reg.slot === 'hat') {
    gameState.equip('hat', reg.hatId);
    setPlayerHat(player, reg.hatId);
    ui.showEmote(`Equipped ${reg.name}.`);
    audio.play('loot');
  }
}

// ── Achievements ─────────────────────────────────────────────
const ACHIEVEMENTS = {
  first_blood: 'First Blood',
  slayer: 'Monster Slayer',
  quest_master: 'Quest Master',
  level_5: 'Seasoned Adventurer',
  max_level: 'Village Legend',
  rich: 'Moneybags',
  survivor: 'Night Survivor'
};

// ── Quests ───────────────────────────────────────────────────
const QUESTS = {
  lanterns: {
    id: 'lanterns', title: 'Relight the lanterns', npc: 'Elda',
    reward: 5, xpReward: 20, goal: () => world.lanternGoal
  },
  herbs: {
    id: 'herbs', title: 'Gather marsh herbs', npc: 'Jori',
    reward: 8, xpReward: 30, requires: 'lanterns', goal: () => world.herbGoal
  },
  scout: {
    id: 'scout', title: 'Scout the old marker', npc: 'Mara',
    reward: 6, xpReward: 25, requires: 'herbs', goal: () => 1
  },
  wolves: {
    id: 'wolves', title: 'Clear the wolf pack', npc: 'Gareth',
    reward: 12, xpReward: 40, requires: 'scout', goal: () => 3
  },
  mushrooms: {
    id: 'mushrooms', title: 'Collect rare mushrooms', npc: 'Elda',
    reward: 10, xpReward: 35, requires: 'lanterns', goal: () => world.mushroomGoal
  },
  nightwatch: {
    id: 'nightwatch', title: 'Survive the night watch', npc: 'Gareth',
    reward: 15, xpReward: 50, requires: 'wolves', goal: () => 1
  },
  delivery: {
    id: 'delivery', title: 'Deliver bread to Mara', npc: 'Jori',
    reward: 6, xpReward: 15, requires: 'herbs'
  },
  explore_ruins: {
    id: 'explore_ruins', title: 'Find the forgotten ruins', npc: 'Mara',
    reward: 14, xpReward: 45, requires: 'scout', goal: () => 1
  },
  craft_potion: {
    id: 'craft_potion', title: 'Brew a healing potion', npc: 'Jori',
    reward: 8, xpReward: 30, requires: 'mushrooms'
  },
  escort: {
    id: 'escort', title: 'Escort Elda to the marker', npc: 'Elda',
    reward: 18, xpReward: 60, requires: 'explore_ruins', goal: () => 1
  }
};

const QUEST_ORDER = [
  'lanterns', 'herbs', 'scout', 'mushrooms', 'wolves',
  'delivery', 'nightwatch', 'explore_ruins', 'craft_potion', 'escort'
];

const MIN_ORBIT_DISTANCE = 3.4;
const MAX_ORBIT_DISTANCE = 14.5;
const HOUSE_MIN_ORBIT_DISTANCE = 2.6;
const HOUSE_MAX_ORBIT_DISTANCE = 6.0;
const HOUSE_MAX_PITCH = 0.62;
let orbitDistance = 7.2;

// ── Inventory Config ─────────────────────────────────────────
ui.setInventoryConfig({
  registry: ITEM_REGISTRY,
  getEquipment: () => gameState.getEquipment(),
  onUseItem: useItem
});

// ── Sync gameState with existing quest/coin state ────────────
let activeQuest = gameState.getActiveQuest();
const completedQuests = gameState.getCompletedQuests();
let nightwatchActive = false;
let nightwatchStart = 0;

const input = createInput(renderer.domElement, {
  shouldCaptureKey: () => ui.isGameStarted() && !ui.isChatTyping(),
  shouldCaptureWheel: (event) => {
    if (!ui.isGameStarted()) return false;
    if (ui.isChatTyping()) return false;
    if (ui.isDialogOpen()) return false;
    if (ui.isInventoryOpen()) return false;
    const target = event?.target;
    if (target && typeof target.closest === 'function') {
      if (target.closest('#chat')) return false;
      if (target.closest('input, textarea, select, button')) return false;
    }
    return true;
  },
  onZoom: (deltaY) => {
    const zoomSpeed = 0.01;
    const min = world.isInsideHouse() ? HOUSE_MIN_ORBIT_DISTANCE : MIN_ORBIT_DISTANCE;
    const max = world.isInsideHouse() ? HOUSE_MAX_ORBIT_DISTANCE : MAX_ORBIT_DISTANCE;
    orbitDistance = THREE.MathUtils.clamp(orbitDistance + deltaY * zoomSpeed, min, max);
  },
  onActionKey: (key) => {
    if (!ui.isGameStarted()) return;
    if (ui.isChatTyping()) return;

    if (key === 'escape') {
      if (ui.isDialogOpen()) {
        ui.closeDialog();
        return;
      }
      if (ui.isInventoryOpen()) {
        ui.closeInventory();
        return;
      }
    }

    if (key === 'i') {
      ui.toggleInventory();
      return;
    }

    // Attack key
    if (key === 'q' && !ui.isDialogOpen()) {
      combat.requestAttack();
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
            orbitDistance = THREE.MathUtils.clamp(orbitDistance, MIN_ORBIT_DISTANCE, MAX_ORBIT_DISTANCE);
          }
          return;
        }

        const target = world.getNearbyInteriorInteractable(player.position);
        if (target) {
          const result = world.interactInterior(target);
          if (result?.coinsDelta) {
            gameState.addCoins(result.coinsDelta);
          }
          if (result?.items) {
            result.items.forEach((item) => gameState.addItem(item));
          }
          if (result?.sleepToDay) {
            sleepToMorning();
          }
          if (result?.sound) {
            audio.play(result.sound);
          }
          if (result?.message) {
            ui.showEmote(result.message);
          }
        }
        return;
      }

      // World interactables checked before NPCs so nearby NPCs
      // don't block lantern/herb/mushroom collection.
      const lantern = world.getNearbyLantern(player.position);
      if (lantern && !lantern.lit) {
        const result = world.lightLantern(lantern);
        if (result.changed) {
          ui.updateStats({ lanterns: result.lit, lanternGoal: result.goal });
          audio.play('lantern');
          updateQuestUI();
          if (result.complete) {
            ui.showEmote('All lanterns are burning again! Return to Elda.');
          } else {
            ui.showEmote(`Lantern lit (${result.lit}/${result.goal}).`);
          }
        }
        return;
      }

      const herb = world.getNearbyHerb(player.position);
      if (herb) {
        const result = world.collectHerb(herb);
        if (result.changed) {
          gameState.addItem({ id: 'herb', name: 'Herb' });
          ui.updateStats({ herbs: result.count, herbGoal: result.goal });
          ui.showEmote(`Herb collected (${result.count}/${result.goal}).`);
          audio.play('herb');
          updateQuestUI();
        }
        return;
      }

      const mushroom = world.getNearbyMushroom?.(player.position);
      if (mushroom) {
        const result = world.collectMushroom(mushroom);
        if (result.changed) {
          gameState.addItem({ id: 'mushroom', name: 'Mushroom' });
          ui.showEmote(`Mushroom collected (${result.count}/${result.goal}).`);
          audio.play('herb');
          updateQuestUI();
        }
        return;
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

      const nearestNpc = getNearestNpc(player.position, npcs);
      if (nearestNpc) {
        if (nearestNpc.isShop) {
          handleShop();
          return;
        }
        if (activeQuest && QUESTS[activeQuest].npc !== nearestNpc.name) {
          if (isQuestComplete(activeQuest)) {
            finishQuest(activeQuest);
          } else {
            ui.showEmote('Finish your current quest first.');
            audio.play('deny');
            return;
          }
        }

        if (nearestNpc.name === 'Elda') { handleElda(); return; }
        if (nearestNpc.name === 'Jori') { handleJori(); return; }
        if (nearestNpc.name === 'Mara') { handleMara(); return; }
        if (nearestNpc.name === 'Gareth') { handleGareth(); return; }
      }

      const house = world.getNearbyHouseDoor(player.position);
      if (house) {
        const result = world.enterHouse(house, player.position);
        if (result.changed && result.teleport) {
          player.position.set(result.teleport.x, 0, result.teleport.z);
          ui.showEmote('You enter the house.');
          audio.play('door');
          orbitDistance = THREE.MathUtils.clamp(orbitDistance, HOUSE_MIN_ORBIT_DISTANCE, HOUSE_MAX_ORBIT_DISTANCE);
        }
        return;
      }
    }

    if (key === 'f' && !ui.isDialogOpen()) {
      if (gameState.hasItem('health_potion')) {
        useItem('health_potion');
      } else {
        ui.showEmote('No health potions.');
      }
    }
  }
});

// Attack on left-click
renderer.domElement.addEventListener('click', (event) => {
  if (event.button === 0 && ui.isGameStarted() && !ui.isDialogOpen() && !ui.isChatTyping() && !ui.isInventoryOpen()) {
    combat.requestAttack();
  }
});

const orbitHeight = 1.2;
const clock = new THREE.Clock();
let lastPlayerPosition = player.position.clone();
let timeOffset = 0;
const HOUSE_BG = new THREE.Color(0x05060a);
let frameCount = 0;

function sleepToMorning() {
  const elapsed = clock.elapsedTime + timeOffset;
  const t = ((elapsed % DAY_NIGHT_CYCLE_SECONDS) / DAY_NIGHT_CYCLE_SECONDS) * Math.PI * 2;
  const target = Math.PI / 2;
  let delta = target - t;
  while (delta < 0) delta += Math.PI * 2;
  timeOffset += (delta / (Math.PI * 2)) * DAY_NIGHT_CYCLE_SECONDS;
}

// ── Quest Helpers ────────────────────────────────────────────
function getQuestGoal(id) {
  const quest = QUESTS[id];
  return quest && quest.goal ? quest.goal() : 0;
}

function getQuestProgress(id) {
  switch (id) {
    case 'lanterns': return world.getLanternProgress();
    case 'herbs': return world.getHerbProgress();
    case 'scout': return world.isMarkerInspected() ? 1 : 0;
    case 'wolves': return combat.getWolvesKilled();
    case 'mushrooms': return world.getMushroomProgress?.() ?? 0;
    case 'nightwatch': return nightwatchActive && nightwatchStart > 0 ? 0 : 0;
    case 'explore_ruins': return world.isRuinsFound?.() ? 1 : 0;
    default: return 0;
  }
}

function isQuestComplete(id) {
  const goal = getQuestGoal(id);
  if (!goal) return false;
  return getQuestProgress(id) >= goal;
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
    const detail = goal && progress >= goal
      ? `Return to ${quest.npc}`
      : goal ? `${progress}/${goal}` : `In progress`;
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
  gameState.setActiveQuest(id);
  updateQuestUI();
  ui.showEmote(`Quest started: ${quest.title}.`);
  return true;
}

function finishQuest(id) {
  const quest = QUESTS[id];
  if (!quest) return;
  if (completedQuests.has(id)) return;
  completedQuests.add(id);
  gameState.completeQuest(id);
  activeQuest = null;
  gameState.addCoins(quest.reward);
  gameState.addXp(quest.xpReward || 0);
  ui.updateStats({ coins: gameState.getCoins() });
  ui.showEmote(`Quest complete! +${quest.reward} coins, +${quest.xpReward} XP.`);
  audio.play('quest');
  updateQuestUI();
}

// ── NPC Handlers ─────────────────────────────────────────────
function handleElda() {
  if (completedQuests.has('lanterns') && !completedQuests.has('mushrooms') && activeQuest !== 'mushrooms') {
    if (QUESTS.mushrooms.requires && completedQuests.has(QUESTS.mushrooms.requires)) {
      startQuest('mushrooms');
      ui.openDialog('start', 'elda', { name: ui.getPlayerName(), goal: world.mushroomGoal });
      return;
    }
  }

  if (completedQuests.has('lanterns') && completedQuests.has('mushrooms')) {
    // Check for escort quest
    if (!completedQuests.has('escort') && completedQuests.has('explore_ruins')) {
      if (activeQuest === 'escort') {
        finishQuest('escort');
        ui.openDialog('complete', 'elda', { name: ui.getPlayerName(), coins: QUESTS.escort.reward });
        return;
      }
      startQuest('escort');
      ui.openDialog('work', 'elda', { name: ui.getPlayerName() });
      return;
    }
    ui.openDialog('bye', 'elda', { name: ui.getPlayerName() });
    return;
  }

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

  // Delivery quest
  if (completedQuests.has('herbs') && !completedQuests.has('delivery') && activeQuest !== 'delivery') {
    startQuest('delivery');
    gameState.addItem({ id: 'bread', name: 'Bread', qty: 1 });
    ui.showEmote('Jori hands you a loaf of bread.');
    ui.openDialog('start', 'jori', { herbGoal: world.herbGoal });
    return;
  }

  // Craft potion quest
  if (completedQuests.has('herbs') && completedQuests.has('mushrooms') && !completedQuests.has('craft_potion') && activeQuest !== 'craft_potion') {
    if (gameState.hasItem('herb', 3) && gameState.hasItem('mushroom', 2)) {
      gameState.removeItem('herb', 3);
      gameState.removeItem('mushroom', 2);
      gameState.addItem({ id: 'health_potion', name: 'Health Potion', qty: 1 });
      finishQuest('craft_potion');
      ui.openDialog('complete', 'jori', { coins: QUESTS.craft_potion.reward });
      return;
    }
    if (activeQuest !== 'craft_potion') {
      startQuest('craft_potion');
    }
    ui.openDialog('progress', 'jori', { herbs: gameState.getItemQty('herb'), herbGoal: 3 });
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

  // Accept delivery
  if (activeQuest === 'delivery' && gameState.hasItem('bread')) {
    gameState.removeItem('bread');
    finishQuest('delivery');
    ui.openDialog('complete', 'mara', { coins: QUESTS.delivery.reward });
    return;
  }

  // Explore ruins quest
  if (completedQuests.has('scout') && !completedQuests.has('explore_ruins') && activeQuest !== 'explore_ruins') {
    startQuest('explore_ruins');
    ui.openDialog('start', 'mara');
    return;
  }

  if (activeQuest === 'explore_ruins' && (world.isRuinsFound?.() ?? false)) {
    finishQuest('explore_ruins');
    ui.openDialog('complete', 'mara', { coins: QUESTS.explore_ruins.reward });
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

function handleGareth() {
  if (!completedQuests.has('scout')) {
    ui.openDialog('locked', 'gareth');
    audio.play('deny');
    return;
  }

  // Wolf quest
  if (!completedQuests.has('wolves')) {
    const killed = combat.getWolvesKilled();
    if (killed >= 3) {
      finishQuest('wolves');
      ui.openDialog('complete', 'gareth', { coins: QUESTS.wolves.reward });
      return;
    }
    if (!activeQuest || activeQuest === 'wolves') {
      if (!activeQuest) startQuest('wolves');
      if (killed > 0) {
        ui.openDialog('progress', 'gareth', { killed, goal: 3 });
      } else {
        ui.openDialog('start', 'gareth', { goal: 3 });
      }
      return;
    }
  }

  // Nightwatch quest
  if (completedQuests.has('wolves') && !completedQuests.has('nightwatch')) {
    if (activeQuest === 'nightwatch') {
      ui.openDialog('nightwatch_progress', 'gareth');
      return;
    }
    startQuest('nightwatch');
    nightwatchActive = true;
    nightwatchStart = clock.elapsedTime + timeOffset;
    ui.openDialog('nightwatch_start', 'gareth');
    return;
  }

  ui.openDialog('bye', 'gareth');
}

function handleShop() {
  ui.openShopDialog(SHOP_ITEMS, (itemId) => {
    const item = SHOP_ITEMS.find((i) => i.id === itemId);
    if (!item) return false;
    if (!gameState.spendCoins(item.price)) return false;

    if (item.type === 'cosmetic' && item.slot === 'hat') {
      gameState.equip('hat', item.hatId);
      gameState.addItem({ id: item.id, name: item.name });
      setPlayerHat(player, item.hatId);
      audio.play('loot');
    } else if (item.id === 'speed_boost') {
      gameState.addItem({ id: 'speed_boost', name: 'Speed Tonic' });
      audio.play('loot');
    } else if (item.id === 'health_potion') {
      gameState.addItem({ id: 'health_potion', name: 'Health Potion' });
      audio.play('loot');
    }

    ui.updateStats({ coins: gameState.getCoins() });
    ui.updateInventory(gameState.getInventory());
    return true;
  });
}

// ── GameState Event Listeners ────────────────────────────────
gameState.on('hpChanged', ({ hp, maxHp }) => {
  ui.updateHpBar(hp, maxHp);
  if (hp < maxHp) ui.flashDamage();
});

gameState.on('death', () => {
  const result = gameState.onDeath();
  combat.clearAllEnemies();
  player.position.set(0, 0, 6);
  gameState.fullHeal();
  ui.showEmote(`You died! Lost ${result.coinsLost} coins.`);
  ui.updateStats({ coins: gameState.getCoins() });
  audio.play('death');
  world.updateChunks(player.position, true);
});

gameState.on('levelUp', ({ level }) => {
  ui.showEmote(`Level up! You are now level ${level}.`);
  ui.updateStats({ level });
  audio.play('levelUp');
  multiplayer.setLevel(level);
});

gameState.on('coinsChanged', ({ coins }) => {
  ui.updateStats({ coins });
});

gameState.on('inventoryChanged', ({ inventory }) => {
  ui.updateInventory(inventory);
});

gameState.on('achievementUnlocked', ({ id }) => {
  const title = ACHIEVEMENTS[id] || id;
  ui.showAchievement(title);
  audio.play('quest');
});

// ── Achievement Checking ─────────────────────────────────────
function checkAchievements() {
  const stats = gameState.getStats();
  if (stats.enemiesKilled >= 1) gameState.unlockAchievement('first_blood');
  if (stats.enemiesKilled >= 50) gameState.unlockAchievement('slayer');
  if (stats.questsCompleted >= 10) gameState.unlockAchievement('quest_master');
  if (gameState.getLevel() >= 5) gameState.unlockAchievement('level_5');
  if (gameState.getLevel() >= 10) gameState.unlockAchievement('max_level');
  if (gameState.getCoins() >= 100) gameState.unlockAchievement('rich');
  if (stats.nightsSurvived >= 1) gameState.unlockAchievement('survivor');
}

// ── Initialize ───────────────────────────────────────────────
world.updateChunks(player.position, true);

// Restore hat from saved equipment
const savedEquip = gameState.getEquipment();
if (savedEquip.hat) setPlayerHat(player, savedEquip.hat);

ui.updateStats({
  lanterns: world.getLanternProgress(),
  lanternGoal: world.lanternGoal,
  herbs: world.getHerbProgress(),
  herbGoal: world.herbGoal,
  coins: gameState.getCoins(),
  level: gameState.getLevel()
});
ui.updateHpBar(gameState.getHp(), gameState.getMaxHp());
ui.updateXpBar(gameState.getXp(), gameState.getXpForNextLevel(), gameState.getLevel());
ui.updateInventory(gameState.getInventory());
ui.setPlayerCount(1);
updateQuestUI();

ui.onStartGame(({ name }) => {
  multiplayer.connect({ name, serverUrl: SERVER_URL });
  multiplayer.setLevel(gameState.getLevel());
  audio.start();
  updateQuestUI();
});

ui.onChatSendMessage((text) => {
  multiplayer.sendChat(text);
});

ui.onLogoutGame(() => {
  player.position.set(0, 0, 6);
  player.rotation.set(0, 0, 0);
  world.updateChunks(player.position, true);
  combat.clearAllEnemies();
  world.resetChestStates();
  gameState.reset();
  activeQuest = null;
  completedQuests.clear();
  nightwatchActive = false;
  ui.updateStats({
    lanterns: world.getLanternProgress(),
    lanternGoal: world.lanternGoal,
    herbs: world.getHerbProgress(),
    herbGoal: world.herbGoal,
    coins: 0,
    level: 1
  });
  ui.updateHpBar(20, 20);
  ui.updateXpBar(0, 30, 1);
  ui.updateInventory([]);
  ui.setPlayerCount(1);
  updateQuestUI();
  multiplayer.disconnect();
  audio.stop();
});

// ── Camera ───────────────────────────────────────────────────
function updateCamera(yaw, pitch) {
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const offset = new THREE.Vector3(
    Math.sin(yaw) * orbitDistance * cosPitch,
    orbitDistance * sinPitch + orbitHeight,
    Math.cos(yaw) * orbitDistance * cosPitch
  );
  const desired = player.position.clone().add(offset);
  if (world.isInsideHouse()) {
    world.clampCameraPosition(desired);
  }
  camera.position.lerp(desired, 0.08);
  if (world.isInsideHouse()) {
    world.clampCameraPosition(camera.position);
  }
  camera.lookAt(player.position.x, player.position.y + 1.2, player.position.z);
}

// ── Nightwatch Tracking ──────────────────────────────────────
let lastNightState = false;

function checkNightwatch(elapsed, night) {
  const isNight = night > 0.6;

  if (activeQuest === 'nightwatch' && nightwatchActive) {
    if (isNight && !lastNightState) {
      nightwatchStart = elapsed;
    }
    if (!isNight && lastNightState && nightwatchStart > 0) {
      // Survived a full night
      nightwatchActive = false;
      gameState.incrementStat('nightsSurvived');
      finishQuest('nightwatch');
    }
  }

  lastNightState = isNight;
}

// ── Game Loop ────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const { yaw, pitch } = input.getCameraAngles();
  const effectivePitch = world.isInsideHouse()
    ? THREE.MathUtils.clamp(pitch, 0.1, HOUSE_MAX_PITCH)
    : pitch;

  // Player movement
  if (ui.isGameStarted() && !ui.isDialogOpen() && !ui.isChatTyping() && !ui.isInventoryOpen()) {
    const speedMultiplier = gameState.hasSpeedBoost() ? 1.5 : 1.0;
    updatePlayer(player, delta, input.keys, yaw, world.resolveCollisions, {
      speedMultiplier
    });
  }

  // World chunks
  if (!world.isInsideHouse()) {
    world.updateChunks(player.position);
  }

  // Day/night cycle
  const elapsed = clock.elapsedTime + timeOffset;
  const dayState = dayNight.update(elapsed);
  if (world.isInsideHouse()) {
    scene.background = HOUSE_BG;
    if (scene.fog) scene.fog.color.copy(HOUSE_BG);
  }

  // World ambient + animals + NPC patrols
  world.updateAmbient(delta, elapsed, dayState.night);
  world.updateAnimals(delta);
  updateNpcs(npcs, delta);

  // Check ruins proximity for explore_ruins quest
  if (activeQuest === 'explore_ruins') {
    world.checkRuinsProximity(player.position);
  }

  // Weather + particles
  weather.update(delta, player.position, dayState.night);
  particles.update(delta);

  // Combat
  if (ui.isGameStarted() && !world.isInsideHouse()) {
    combat.update(delta, player.position, dayState.night, world.isInsideHouse());
  }

  // Nightwatch quest tracking
  checkNightwatch(elapsed, dayState.night);

  // Camera
  updateCamera(yaw, effectivePitch);

  // Multiplayer
  if (ui.isGameStarted()) {
    multiplayer.update(delta, player);
  }

  // Audio
  const distance = player.position.distanceTo(lastPlayerPosition);
  const speed = delta > 0 ? distance / delta : 0;
  lastPlayerPosition.copy(player.position);
  audio.update({
    night: dayState.night,
    moving: speed > 0.1,
    speed,
    weather: weather.getWeather()
  });

  // UI updates
  frameCount++;
  if (frameCount % 30 === 0) {
    ui.updateHpBar(gameState.getHp(), gameState.getMaxHp());
    ui.updateXpBar(gameState.getXp(), gameState.getXpForNextLevel(), gameState.getLevel());
  }

  // Achievement checking (throttled)
  if (frameCount % 120 === 0) {
    checkAchievements();
  }

  // Leaderboard update (throttled)
  if (frameCount % 180 === 0 && multiplayer.getLeaderboard) {
    const leaderData = multiplayer.getLeaderboard();
    leaderData.unshift({ name: ui.getPlayerName(), level: gameState.getLevel() });
    leaderData.sort((a, b) => b.level - a.level);
    ui.updateLeaderboard(leaderData.slice(0, 8));
  }

  // Interaction prompts
  if (!ui.isGameStarted() || ui.isDialogOpen()) {
    ui.setPrompt('');
  } else {
    if (world.isInsideHouse()) {
      if (world.getNearbyHouseExit(player.position)) {
        ui.setPrompt('Press E to exit the house');
      } else {
        const target = world.getNearbyInteriorInteractable(player.position);
        if (target === 'chest') {
          ui.setPrompt('Press E to open the chest');
        } else if (target === 'bed') {
          ui.setPrompt('Press E to rest');
        } else {
          ui.setPrompt('');
        }
      }
      renderer.render(scene, camera);
      return;
    }

    const nearestNpc = getNearestNpc(player.position, npcs);
    const nearbyHerb = world.getNearbyHerb(player.position);
    const nearbyLantern = world.getNearbyLantern(player.position);
    const nearbyMarker = world.getNearbyMarker(player.position);
    const nearbyHouse = world.getNearbyHouseDoor(player.position);
    const nearbyMushroom = world.getNearbyMushroom?.(player.position);

    if (nearbyLantern && !nearbyLantern.lit) {
      ui.setPrompt('Press E to light the lantern');
    } else if (nearbyHerb) {
      ui.setPrompt('Press E to gather herbs');
    } else if (nearbyMushroom) {
      ui.setPrompt('Press E to pick the mushroom');
    } else if (nearestNpc) {
      if (nearestNpc.isShop) {
        ui.setPrompt(`Press E to trade with ${nearestNpc.name}`);
      } else if (activeQuest && QUESTS[activeQuest].npc !== nearestNpc.name && !isQuestComplete(activeQuest)) {
        ui.setPrompt('Finish your current quest first');
      } else {
        ui.setPrompt(`Press E to talk to ${nearestNpc.name}`);
      }
    } else if (activeQuest === 'scout' && nearbyMarker && !world.isMarkerInspected()) {
      ui.setPrompt('Press E to inspect the marker');
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
