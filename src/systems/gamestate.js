export function createGameState() {
  const STORAGE_KEY = 'polorp.gamestate';
  const XP_TABLE = [0, 30, 80, 160, 280, 450, 700, 1050, 1500, 2100];
  const MAX_LEVEL = 10;

  const defaults = () => ({
    hp: 20,
    maxHp: 20,
    xp: 0,
    level: 1,
    coins: 0,
    inventory: [],
    equipment: { hat: null, tool: null },
    completedQuests: [],
    activeQuest: null,
    achievements: [],
    speedBoostUntil: 0,
    stats: {
      enemiesKilled: 0,
      questsCompleted: 0,
      coinsEarned: 0,
      deaths: 0,
      nightsSurvived: 0
    }
  });

  let state = defaults();

  const listeners = new Map();

  function emit(event, data) {
    const cbs = listeners.get(event);
    if (cbs) cbs.forEach((cb) => cb(data));
  }

  function on(event, callback) {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(callback);
  }

  function off(event, callback) {
    const cbs = listeners.get(event);
    if (!cbs) return;
    const idx = cbs.indexOf(callback);
    if (idx !== -1) cbs.splice(idx, 1);
  }

  // -- HP --
  function getHp() { return state.hp; }
  function getMaxHp() { return state.maxHp; }

  function takeDamage(amount) {
    state.hp = Math.max(0, state.hp - amount);
    emit('hpChanged', { hp: state.hp, maxHp: state.maxHp });
    if (state.hp <= 0) emit('death', {});
    return state.hp;
  }

  function heal(amount) {
    state.hp = Math.min(state.maxHp, state.hp + amount);
    emit('hpChanged', { hp: state.hp, maxHp: state.maxHp });
  }

  function fullHeal() {
    state.hp = state.maxHp;
    emit('hpChanged', { hp: state.hp, maxHp: state.maxHp });
  }

  // -- XP / Level --
  function getXp() { return state.xp; }
  function getLevel() { return state.level; }

  function getXpForNextLevel() {
    return XP_TABLE[state.level] ?? Infinity;
  }

  function addXp(amount) {
    state.xp += amount;
    while (state.level < MAX_LEVEL && state.xp >= XP_TABLE[state.level]) {
      state.xp -= XP_TABLE[state.level];
      state.level++;
      state.maxHp = 20 + (state.level - 1) * 5;
      state.hp = state.maxHp;
      emit('levelUp', { level: state.level });
      emit('hpChanged', { hp: state.hp, maxHp: state.maxHp });
    }
    emit('xpChanged', { xp: state.xp, level: state.level });
    save();
  }

  // -- Coins --
  function getCoins() { return state.coins; }

  function addCoins(amount) {
    state.coins += amount;
    state.stats.coinsEarned += amount;
    emit('coinsChanged', { coins: state.coins });
    save();
  }

  function spendCoins(amount) {
    if (state.coins < amount) return false;
    state.coins -= amount;
    emit('coinsChanged', { coins: state.coins });
    save();
    return true;
  }

  // -- Inventory --
  function getInventory() { return [...state.inventory]; }

  function addItem(item) {
    const existing = state.inventory.find((i) => i.id === item.id);
    if (existing) {
      existing.qty += item.qty ?? 1;
    } else {
      state.inventory.push({ ...item, qty: item.qty ?? 1 });
    }
    emit('inventoryChanged', { inventory: state.inventory });
    save();
  }

  function removeItem(id, qty = 1) {
    const existing = state.inventory.find((i) => i.id === id);
    if (!existing || existing.qty < qty) return false;
    existing.qty -= qty;
    if (existing.qty <= 0) {
      state.inventory = state.inventory.filter((i) => i.id !== id);
    }
    emit('inventoryChanged', { inventory: state.inventory });
    save();
    return true;
  }

  function hasItem(id, qty = 1) {
    const item = state.inventory.find((i) => i.id === id);
    return item ? item.qty >= qty : false;
  }

  function getItemQty(id) {
    const item = state.inventory.find((i) => i.id === id);
    return item ? item.qty : 0;
  }

  // -- Equipment --
  function getEquipment() { return { ...state.equipment }; }

  function equip(slot, itemId) {
    state.equipment[slot] = itemId;
    emit('equipmentChanged', { equipment: state.equipment });
    save();
  }

  // -- Quests --
  function getActiveQuest() { return state.activeQuest; }

  function setActiveQuest(id) {
    state.activeQuest = id;
    save();
  }

  function getCompletedQuests() { return new Set(state.completedQuests); }

  function completeQuest(id) {
    if (!state.completedQuests.includes(id)) {
      state.completedQuests.push(id);
      state.stats.questsCompleted++;
    }
    state.activeQuest = null;
    save();
  }

  function isQuestCompleted(id) {
    return state.completedQuests.includes(id);
  }

  // -- Achievements --
  function getAchievements() { return [...state.achievements]; }

  function unlockAchievement(id) {
    if (state.achievements.includes(id)) return false;
    state.achievements.push(id);
    emit('achievementUnlocked', { id });
    save();
    return true;
  }

  function hasAchievement(id) {
    return state.achievements.includes(id);
  }

  // -- Speed Boost --
  function hasSpeedBoost() { return Date.now() < state.speedBoostUntil; }

  function activateSpeedBoost(durationMs) {
    state.speedBoostUntil = Date.now() + durationMs;
    emit('speedBoostActivated', { until: state.speedBoostUntil });
  }

  // -- Death --
  function onDeath() {
    const lost = Math.floor(state.coins * 0.15);
    state.coins = Math.max(0, state.coins - lost);
    state.stats.deaths++;
    emit('coinsChanged', { coins: state.coins });
    save();
    return { coinsLost: lost };
  }

  // -- Stats --
  function getStats() { return { ...state.stats }; }

  function incrementStat(key) {
    state.stats[key] = (state.stats[key] || 0) + 1;
    save();
  }

  // -- Persistence --
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Ignore storage errors.
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.level === 'number') {
          Object.assign(state, parsed);
          // Ensure new fields exist after updates
          if (!state.stats) state.stats = defaults().stats;
          if (!state.equipment) state.equipment = defaults().equipment;
          if (!state.achievements) state.achievements = [];
          if (!state.inventory) state.inventory = [];
          // Recalculate maxHp from level
          state.maxHp = 20 + (state.level - 1) * 5;
          if (state.hp > state.maxHp) state.hp = state.maxHp;
        }
      }
    } catch (e) {
      // Ignore storage errors.
    }
  }

  function reset() {
    state = defaults();
    save();
    emit('hpChanged', { hp: state.hp, maxHp: state.maxHp });
    emit('xpChanged', { xp: state.xp, level: state.level });
    emit('coinsChanged', { coins: state.coins });
    emit('inventoryChanged', { inventory: state.inventory });
    emit('equipmentChanged', { equipment: state.equipment });
  }

  load();

  return {
    getHp, getMaxHp, takeDamage, heal, fullHeal,
    getXp, getLevel, getXpForNextLevel, addXp,
    getCoins, addCoins, spendCoins,
    getInventory, addItem, removeItem, hasItem, getItemQty,
    getEquipment, equip,
    getActiveQuest, setActiveQuest, getCompletedQuests, completeQuest, isQuestCompleted,
    getAchievements, unlockAchievement, hasAchievement,
    hasSpeedBoost, activateSpeedBoost,
    onDeath,
    getStats, incrementStat,
    save, load, reset,
    on, off
  };
}
