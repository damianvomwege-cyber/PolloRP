import { makeRandomName } from '../core/config.js';

export function setupUI() {
  const startModal = document.getElementById('start');
  const startBtn = document.getElementById('startBtn');
  const nameInput = document.getElementById('playerName');
  const logoutBtn = document.getElementById('logoutBtn');
  const nearPrompt = document.getElementById('nearPrompt');
  const dialogModal = document.getElementById('dialog');
  const dialogText = document.getElementById('dialogText');
  const dialogOptions = document.getElementById('dialogOptions');
  const npcName = document.getElementById('npcName');
  const emote = document.getElementById('emote');
  const chat = document.getElementById('chat');
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const lanternStat = document.getElementById('lanternStat');
  const herbStat = document.getElementById('herbStat');
  const coinStat = document.getElementById('coinStat');
  const playerCount = document.getElementById('playerCount');
  const questTitle = document.getElementById('questTitle');
  const questDetail = document.getElementById('questDetail');

  let playerName = 'Traveler';
  let gameStarted = false;
  let dialogOpen = false;
  let activeStep = null;
  let activeDialogKey = 'elda';
  let onStart = null;
  let onLogout = null;
  let onChatSend = null;
  let pendingPayload = null;
  let isTyping = false;
  let inventoryOpen = false;
  let inventoryConfig = null;
  let activeCategory = 'all';
  let currentItems = [];
  const SESSION_KEY = 'polorp.session';

  const dialogSets = {
    elda: {
      name: 'Elda',
      steps: {
        start: {
          text: 'Welcome, {name}. I am Elda, chronicler of Kaldbach. What brings you here?',
          options: [
            { label: 'Tell me about the village.', next: 'town' },
            { label: 'I am looking for work.', next: 'work' },
            { label: 'Just passing through.', next: 'bye' }
          ]
        },
        town: {
          text: 'Our people live from the wind trade and the herbs of the moor. Every traveler brings new stories.',
          options: [
            { label: 'I might have one.', next: 'work' },
            { label: 'I will look around.', next: null }
          ]
        },
        work: {
          text: 'If you want to help: Three lanterns on the east road have gone dark. Bring back the light, and your name will be remembered.',
          options: [
            { label: 'I will take care of it.', next: 'thanks' },
            { label: 'Maybe later.', next: null }
          ]
        },
        progress: {
          text: 'The road is still dim. You have lit {lit}/{goal} lanterns so far.',
          options: [
            { label: 'I will keep going.', next: null }
          ]
        },
        complete: {
          text: 'You brought back the light, {name}. The village honors you. Take these {coins} coins.',
          options: [
            { label: 'Glad to help.', next: null }
          ]
        },
        thanks: {
          text: 'Then walk with steady steps. The village trusts you.',
          options: [
            { label: 'Goodbye.', next: null }
          ]
        },
        bye: {
          text: 'May the road carry you kindly. If you return, there is a place by the fire.',
          options: [
            { label: 'Goodbye.', next: null }
          ]
        }
      }
    },
    jori: {
      name: 'Jori',
      steps: {
        start: {
          text: 'Ah, a fresh face! I am short on marsh herbs. Bring me {herbGoal} bundles and I will pay well.',
          options: [
            { label: 'I will gather them.', next: 'thanks' },
            { label: 'Maybe later.', next: null }
          ]
        },
        locked: {
          text: 'Elda still needs you. Come back after the lanterns are burning.',
          options: [
            { label: 'Understood.', next: null }
          ]
        },
        progress: {
          text: 'You have {herbs}/{herbGoal} herbs. The stew needs more.',
          options: [
            { label: 'I will keep looking.', next: null }
          ]
        },
        complete: {
          text: 'You did it! The village kitchen is saved. Here are {coins} coins.',
          options: [
            { label: 'Happy to help.', next: null }
          ]
        },
        thanks: {
          text: 'The marsh glows at dusk. You will find the herbs near the reeds.',
          options: [
            { label: 'On my way.', next: null }
          ]
        }
      }
    },
    mara: {
      name: 'Mara',
      steps: {
        start: {
          text: 'Traveler, I need a sharp eye. Find the old marker on the ridge and read its runes.',
          options: [
            { label: 'I will scout it.', next: 'thanks' },
            { label: 'Not now.', next: null }
          ]
        },
        locked: {
          text: 'Finish Jori�s request first. The village must eat.',
          options: [
            { label: 'I will return.', next: null }
          ]
        },
        progress: {
          text: 'Have you found the marker yet? It stands north of the village.',
          options: [
            { label: 'Not yet.', next: null }
          ]
        },
        complete: {
          text: 'You found it! These {coins} coins are yours.',
          options: [
            { label: 'Happy to help.', next: null }
          ]
        },
        thanks: {
          text: 'The marker is carved with blue runes. You cannot miss it at night.',
          options: [
            { label: 'I will find it.', next: null }
          ]
        }
      }
    },
    gareth: {
      name: 'Gareth',
      steps: {
        start: {
          text: 'You look strong enough. Wolves have been circling the village. Kill {goal} of them and I will reward you.',
          options: [
            { label: 'I will hunt them down.', next: 'thanks' },
            { label: 'Not yet.', next: null }
          ]
        },
        locked: {
          text: 'Prove yourself with the other tasks first. The village needs to know it can rely on you.',
          options: [
            { label: 'I understand.', next: null }
          ]
        },
        progress: {
          text: 'You have slain {killed}/{goal} wolves. Keep at it.',
          options: [
            { label: 'On it.', next: null }
          ]
        },
        complete: {
          text: 'The pack is thinned. You have earned these {coins} coins, warrior.',
          options: [
            { label: 'Glad to help.', next: null }
          ]
        },
        thanks: {
          text: 'They roam at the edges of the village, especially at dusk. Stay sharp.',
          options: [
            { label: 'I will be ready.', next: null }
          ]
        },
        nightwatch_start: {
          text: 'The nights grow dangerous. Survive an entire night cycle outside and I will pay handsomely.',
          options: [
            { label: 'I accept the challenge.', next: 'nightwatch_thanks' },
            { label: 'Maybe later.', next: null }
          ]
        },
        nightwatch_thanks: {
          text: 'Stay outside from dusk until dawn. Do not hide in a house. Good luck.',
          options: [
            { label: 'I am ready.', next: null }
          ]
        },
        nightwatch_progress: {
          text: 'The night is not over yet. Keep fighting.',
          options: [
            { label: 'I will endure.', next: null }
          ]
        },
        nightwatch_complete: {
          text: 'You survived the darkness! Here are {coins} coins. You are a true guardian.',
          options: [
            { label: 'That was intense.', next: null }
          ]
        },
        bye: {
          text: 'Stay vigilant, traveler. The night is not kind.',
          options: [
            { label: 'Goodbye.', next: null }
          ]
        }
      }
    },
    ryn: {
      name: 'Ryn the Merchant',
      steps: {
        shop: {
          text: 'What catches your eye, traveler? I have fine wares.',
          options: []
        },
        thanks: {
          text: 'A pleasure doing business. Come back anytime!',
          options: [
            { label: 'Goodbye.', next: null }
          ]
        }
      }
    }
  };

  function formatText(text, context) {
    if (!context) return text;
    return text.replace(/\{(\w+)\}/g, (match, key) => {
      if (context[key] === undefined) return match;
      return String(context[key]);
    });
  }

  function openDialog(step, dialogKey = activeDialogKey, context = {}) {
    const set = dialogSets[dialogKey];
    if (!set) return;
    const entry = set.steps[step];
    if (!entry) return;
    closeInventory();
    dialogOpen = true;
    activeStep = step;
    activeDialogKey = dialogKey;
    npcName.textContent = set.name;
    dialogModal.classList.add('show');
    dialogText.textContent = formatText(entry.text, context);
    dialogOptions.innerHTML = '';
    entry.options.forEach((option) => {
      const btn = document.createElement('button');
      btn.textContent = formatText(option.label, context);
      btn.addEventListener('click', () => {
        if (option.next) {
          openDialog(option.next, dialogKey, context);
        } else {
          closeDialog();
        }
      });
      dialogOptions.appendChild(btn);
    });
  }

  function closeDialog() {
    dialogOpen = false;
    activeStep = null;
    dialogModal.classList.remove('show');
  }

  function showEmote(message) {
    emote.textContent = message;
    emote.style.opacity = '1';
    clearTimeout(showEmote.timeoutId);
    showEmote.timeoutId = setTimeout(() => {
      emote.textContent = '';
    }, 1600);
  }

  function setPrompt(text) {
    if (text) {
      nearPrompt.textContent = text;
      nearPrompt.classList.add('show');
    } else {
      nearPrompt.classList.remove('show');
    }
  }

  const playerLevelEl = document.getElementById('playerLevel');
  const hpBarFill = document.getElementById('hpBarFill');
  const hpBarText = document.getElementById('hpBarText');
  const xpBarFill = document.getElementById('xpBarFill');
  const xpBarText = document.getElementById('xpBarText');
  const inventoryModal = document.getElementById('inventoryModal');
  const inventoryGrid = document.getElementById('inventoryGrid');
  const inventoryTooltip = document.getElementById('inventoryTooltip');
  const tooltipName = document.getElementById('tooltipName');
  const tooltipCategory = document.getElementById('tooltipCategory');
  const tooltipDesc = document.getElementById('tooltipDesc');
  const tooltipAction = document.getElementById('tooltipAction');
  const inventoryClose = document.getElementById('inventoryClose');
  const inventoryCategories = document.getElementById('inventoryCategories');
  const achievementToast = document.getElementById('achievementToast');
  const leaderboardPanel = document.getElementById('leaderboard');
  const leaderboardList = document.getElementById('leaderboardList');

  function updateStats({ lanterns, lanternGoal, herbs, herbGoal, coins, level }) {
    if (lanterns !== undefined && lanternGoal !== undefined) {
      lanternStat.textContent = `${lanterns}/${lanternGoal}`;
    }
    if (herbs !== undefined && herbGoal !== undefined) {
      herbStat.textContent = `${herbs}/${herbGoal}`;
    }
    if (coins !== undefined) {
      coinStat.textContent = `${coins}`;
    }
    if (level !== undefined && playerLevelEl) {
      playerLevelEl.textContent = `${level}`;
    }
  }

  function updateHpBar(hp, maxHp) {
    if (!hpBarFill || !hpBarText) return;
    const pct = maxHp > 0 ? Math.max(0, (hp / maxHp) * 100) : 0;
    hpBarFill.style.width = pct + '%';
    if (pct > 60) hpBarFill.style.background = '#4a8';
    else if (pct > 30) hpBarFill.style.background = '#da3';
    else hpBarFill.style.background = '#d44';
    hpBarText.textContent = `${hp}/${maxHp}`;
  }

  function updateXpBar(xp, xpNeeded, level) {
    if (!xpBarFill || !xpBarText) return;
    const pct = xpNeeded > 0 ? Math.min(100, (xp / xpNeeded) * 100) : 100;
    xpBarFill.style.width = pct + '%';
    xpBarText.textContent = `Lv ${level} \u00b7 ${xp}/${xpNeeded} XP`;
  }

  function setInventoryConfig(config) {
    inventoryConfig = config;
  }

  function renderInventoryGrid() {
    if (!inventoryConfig || !inventoryGrid) return;
    inventoryGrid.innerHTML = '';
    inventoryTooltip.classList.remove('show');

    const { registry, getEquipment } = inventoryConfig;
    const equipment = getEquipment();

    const filtered = activeCategory === 'all'
      ? currentItems
      : currentItems.filter((item) => {
          const reg = registry[item.id];
          return reg && reg.category === activeCategory;
        });

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'inventory-empty';
      empty.textContent = activeCategory === 'all'
        ? 'Your inventory is empty.'
        : 'No items in this category.';
      inventoryGrid.appendChild(empty);
      return;
    }

    filtered.forEach((item) => {
      const reg = registry[item.id] || {
        icon: '\u2753',
        name: item.name,
        category: 'unknown',
        description: 'An unknown item.',
        action: null
      };

      const slot = document.createElement('div');
      slot.className = 'inv-slot';

      if (reg.category === 'equipment' && reg.slot === 'hat' && equipment.hat === reg.hatId) {
        slot.classList.add('equipped');
      }

      const icon = document.createElement('div');
      icon.className = 'inv-slot-icon';
      icon.textContent = reg.icon;

      const name = document.createElement('div');
      name.className = 'inv-slot-name';
      name.textContent = reg.name || item.name;

      slot.appendChild(icon);
      slot.appendChild(name);

      if (item.qty > 1) {
        const qty = document.createElement('div');
        qty.className = 'inv-slot-qty';
        qty.textContent = `x${item.qty}`;
        slot.appendChild(qty);
      }

      slot.addEventListener('mouseenter', () => {
        tooltipName.textContent = reg.name || item.name;
        tooltipCategory.textContent = reg.category || '';
        tooltipDesc.textContent = reg.description || '';
        if (reg.category === 'equipment' && reg.slot === 'hat' && equipment.hat === reg.hatId) {
          tooltipAction.textContent = 'Currently equipped';
        } else if (reg.action) {
          tooltipAction.textContent = reg.action;
        } else {
          tooltipAction.textContent = '';
        }
        inventoryTooltip.classList.add('show');
      });

      slot.addEventListener('mouseleave', () => {
        inventoryTooltip.classList.remove('show');
      });

      slot.addEventListener('click', () => {
        if (inventoryConfig.onUseItem && reg.action) {
          inventoryConfig.onUseItem(item.id);
          requestAnimationFrame(() => renderInventoryGrid());
        }
      });

      inventoryGrid.appendChild(slot);
    });
  }

  function openInventory() {
    if (dialogOpen || !gameStarted) return;
    inventoryOpen = true;
    inventoryModal.classList.add('show');
    renderInventoryGrid();
  }

  function closeInventory() {
    inventoryOpen = false;
    if (inventoryModal) inventoryModal.classList.remove('show');
    if (inventoryTooltip) inventoryTooltip.classList.remove('show');
  }

  function toggleInventory() {
    if (inventoryOpen) {
      closeInventory();
    } else {
      openInventory();
    }
  }

  function isInventoryOpen() {
    return inventoryOpen;
  }

  function updateInventory(items) {
    currentItems = items || [];
    if (inventoryOpen) {
      renderInventoryGrid();
    }
  }

  if (inventoryCategories) {
    inventoryCategories.addEventListener('click', (event) => {
      const tab = event.target.closest('.inv-tab');
      if (!tab) return;
      activeCategory = tab.dataset.category;
      inventoryCategories.querySelectorAll('.inv-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      renderInventoryGrid();
    });
  }

  if (inventoryClose) {
    inventoryClose.addEventListener('click', () => closeInventory());
  }

  function showAchievement(title) {
    if (!achievementToast) return;
    achievementToast.textContent = `Achievement: ${title}`;
    achievementToast.classList.add('show');
    clearTimeout(showAchievement.timeoutId);
    showAchievement.timeoutId = setTimeout(() => {
      achievementToast.classList.remove('show');
    }, 3000);
  }

  function updateLeaderboard(players) {
    if (!leaderboardList || !leaderboardPanel) return;
    if (!players || players.length <= 1) {
      leaderboardPanel.classList.add('hidden');
      return;
    }
    leaderboardList.innerHTML = '';
    players.slice(0, 8).forEach((p, i) => {
      const div = document.createElement('div');
      div.className = 'panel-line';
      div.textContent = `${i + 1}. ${p.name} (Lv ${p.level})`;
      leaderboardList.appendChild(div);
    });
    leaderboardPanel.classList.remove('hidden');
  }

  function openShopDialog(shopItems, onBuy) {
    dialogOpen = true;
    npcName.textContent = 'Ryn the Merchant';
    dialogModal.classList.add('show');
    dialogText.textContent = 'What catches your eye, traveler?';
    dialogOptions.innerHTML = '';
    shopItems.forEach((item) => {
      const btn = document.createElement('button');
      btn.textContent = `${item.name} \u2014 ${item.price} coins`;
      btn.title = item.description || '';
      btn.addEventListener('click', () => {
        const success = onBuy(item.id);
        if (success) {
          dialogText.textContent = `You purchased ${item.name}!`;
        } else {
          dialogText.textContent = 'Not enough coins.';
        }
      });
      dialogOptions.appendChild(btn);
    });
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Leave shop';
    closeBtn.addEventListener('click', () => closeDialog());
    dialogOptions.appendChild(closeBtn);
  }

  function flashDamage() {
    let flash = document.querySelector('.damage-flash');
    if (!flash) {
      flash = document.createElement('div');
      flash.className = 'damage-flash';
      document.body.appendChild(flash);
    }
    flash.classList.add('show');
    clearTimeout(flashDamage.timeoutId);
    flashDamage.timeoutId = setTimeout(() => {
      flash.classList.remove('show');
    }, 200);
  }

  function setPlayerCount(count) {
    playerCount.textContent = `${count}`;
  }

  function setQuestStatus({ title, detail }) {
    if (questTitle) questTitle.textContent = title ?? '';
    if (questDetail) {
      questDetail.textContent = detail ?? '';
      questDetail.style.display = detail ? 'block' : 'none';
    }
  }

  function isDialogOpen() {
    return dialogOpen;
  }

  function isGameStarted() {
    return gameStarted;
  }

  function isChatTyping() {
    return isTyping;
  }

  function getActiveStep() {
    return activeStep;
  }

  function getPlayerName() {
    return playerName;
  }

  function onStartGame(callback) {
    onStart = callback;
    if (pendingPayload) {
      const payload = pendingPayload;
      pendingPayload = null;
      onStart(payload);
    }
  }

  function onLogoutGame(callback) {
    onLogout = callback;
  }

  function onChatSendMessage(callback) {
    onChatSend = callback;
  }

  function setChatEnabled(enabled) {
    if (enabled) {
      chat.classList.remove('hidden');
    } else {
      chat.classList.add('hidden');
    }
  }

  function addChatMessage({ name, text, system = false }) {
    const line = document.createElement('div');
    line.classList.add('chat-line');
    if (system) {
      line.classList.add('system');
      line.textContent = text;
    } else {
      const nameSpan = document.createElement('span');
      nameSpan.classList.add('name');
      nameSpan.textContent = `${name}:`;
      const textSpan = document.createElement('span');
      textSpan.textContent = text;
      line.appendChild(nameSpan);
      line.appendChild(textSpan);
    }
    chatMessages.appendChild(line);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function clearChat() {
    chatMessages.innerHTML = '';
  }

  startBtn.addEventListener('click', () => {
    const rawName = nameInput.value.trim();
    playerName = rawName.length > 0 ? rawName : makeRandomName();
    nameInput.value = playerName;
    gameStarted = true;
    startModal.classList.remove('show');
    nameInput.blur();
    logoutBtn.classList.remove('hidden');
    setChatEnabled(true);
    try {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ name: playerName })
      );
    } catch (error) {
      // Ignore storage errors.
    }
    const payload = { name: playerName };
    if (onStart) {
      onStart(payload);
    } else {
      pendingPayload = payload;
    }
  });

  nameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      startBtn.click();
    }
  });

  logoutBtn.addEventListener('click', () => {
    gameStarted = false;
    dialogOpen = false;
    activeStep = null;
    closeInventory();
    dialogModal.classList.remove('show');
    startModal.classList.add('show');
    nameInput.value = '';
    logoutBtn.classList.add('hidden');
    setChatEnabled(false);
    clearChat();
    chatInput.value = '';
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (error) {
      // Ignore storage errors.
    }
    if (onLogout) {
      onLogout();
    }
  });

  startBtn.disabled = false;
  logoutBtn.classList.add('hidden');
  setChatEnabled(false);

  chatInput.addEventListener('focus', () => {
    isTyping = true;
  });

  chatInput.addEventListener('blur', () => {
    isTyping = false;
  });

  chatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const text = chatInput.value.trim();
      if (text && onChatSend) {
        onChatSend(text);
      }
      chatInput.value = '';
      chatInput.blur();
    }
    if (event.key === 'Escape') {
      chatInput.blur();
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && gameStarted && !dialogOpen && !inventoryOpen && !isTyping) {
      chatInput.focus();
      event.preventDefault();
    }
  });

  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed.name === 'string' && parsed.name.trim().length > 0) {
        playerName = parsed.name.trim();
        gameStarted = true;
        startModal.classList.remove('show');
        logoutBtn.classList.remove('hidden');
        setChatEnabled(true);
        const payload = { name: playerName };
        if (onStart) {
          onStart(payload);
        } else {
          pendingPayload = payload;
        }
      }
    }
  } catch (error) {
    // Ignore storage errors.
  }

  return {
    openDialog,
    closeDialog,
    showEmote,
    setPrompt,
    updateStats,
    setPlayerCount,
    setQuestStatus,
    isDialogOpen,
    isGameStarted,
    isChatTyping,
    getActiveStep,
    getPlayerName,
    onStartGame,
    onLogoutGame,
    onChatSendMessage,
    addChatMessage,
    clearChat,
    setChatEnabled,
    updateHpBar,
    updateXpBar,
    setInventoryConfig,
    toggleInventory,
    openInventory,
    closeInventory,
    isInventoryOpen,
    updateInventory,
    showAchievement,
    updateLeaderboard,
    openShopDialog,
    flashDamage
  };
}

