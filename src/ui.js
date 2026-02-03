import { makeRandomName } from './config.js';

export function setupUI() {
  const startModal = document.getElementById('start');
  const startBtn = document.getElementById('startBtn');
  const nameInput = document.getElementById('playerName');
  const adminPassInput = document.getElementById('adminPass');
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
  let adminUnlocked = false;
  let pendingPayload = null;
  let isTyping = false;
  const ADMIN_NAME = 'RpAdmin';
  const ADMIN_PASS = 'Admin@2024!';
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
          text: 'Finish Jori’s request first. The village must eat.',
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

  function updateStats({ lanterns, lanternGoal, herbs, herbGoal, coins }) {
    if (lanterns !== undefined && lanternGoal !== undefined) {
      lanternStat.textContent = `${lanterns}/${lanternGoal}`;
    }
    if (herbs !== undefined && herbGoal !== undefined) {
      herbStat.textContent = `${herbs}/${herbGoal}`;
    }
    if (coins !== undefined) {
      coinStat.textContent = `${coins}`;
    }
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

  function isFlyUnlocked() {
    return adminUnlocked;
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
    adminUnlocked = playerName === ADMIN_NAME && adminPassInput.value === ADMIN_PASS;
    gameStarted = true;
    startModal.classList.remove('show');
    nameInput.blur();
    adminPassInput.blur();
    logoutBtn.classList.remove('hidden');
    setChatEnabled(true);
    try {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ name: playerName, adminUnlocked })
      );
    } catch (error) {
      // Ignore storage errors.
    }
    const payload = { name: playerName, adminUnlocked };
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

  adminPassInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      startBtn.click();
    }
  });

  logoutBtn.addEventListener('click', () => {
    gameStarted = false;
    dialogOpen = false;
    activeStep = null;
    adminUnlocked = false;
    dialogModal.classList.remove('show');
    startModal.classList.add('show');
    nameInput.value = '';
    adminPassInput.value = '';
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
    if (event.key === 'Enter' && gameStarted && !dialogOpen && !isTyping) {
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
        adminUnlocked = Boolean(parsed.adminUnlocked);
        gameStarted = true;
        startModal.classList.remove('show');
        logoutBtn.classList.remove('hidden');
        setChatEnabled(true);
        const payload = {
          name: playerName,
          adminUnlocked
        };
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
    isFlyUnlocked,
    isChatTyping,
    getActiveStep,
    getPlayerName,
    onStartGame,
    onLogoutGame,
    onChatSendMessage,
    addChatMessage,
    clearChat,
    setChatEnabled
  };
}
