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

  let playerName = 'Traveler';
  let gameStarted = false;
  let dialogOpen = false;
  let activeStep = null;
  let onStart = null;
  let onLogout = null;
  let adminUnlocked = false;
  let pendingStart = false;
  const nameRequiredText = 'Enter a name to play.';
  const ADMIN_NAME = 'RpAdmin';
  const ADMIN_PASS = 'Admin@2024!';
  const SESSION_KEY = 'polorp.session';

  const dialogs = {
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
    complete: {
      text: 'You brought back the light, {name}. People are already talking about it.',
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
  };

  function openDialog(step) {
    const entry = dialogs[step];
    if (!entry) return;
    dialogOpen = true;
    activeStep = step;
    dialogModal.classList.add('show');
    dialogText.textContent = entry.text.replace('{name}', playerName);
    dialogOptions.innerHTML = '';
    entry.options.forEach((option) => {
      const btn = document.createElement('button');
      btn.textContent = option.label;
      btn.addEventListener('click', () => {
        if (option.next) {
          openDialog(option.next);
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

  function updatePrompt({ nearNpc, nearLantern }) {
    if (!gameStarted || dialogOpen) {
      nearPrompt.classList.remove('show');
      return;
    }
    if (nearNpc) {
      nearPrompt.textContent = 'Press E to talk to Elda';
      nearPrompt.classList.add('show');
      return;
    }
    if (nearLantern) {
      nearPrompt.textContent = 'Press E to light the lantern';
      nearPrompt.classList.add('show');
      return;
    }
    nearPrompt.classList.remove('show');
  }

  function setNpcName(name) {
    npcName.textContent = name;
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

  function getActiveStep() {
    return activeStep;
  }

  function getPlayerName() {
    return playerName;
  }

  function onStartGame(callback) {
    onStart = callback;
    if (pendingStart) {
      pendingStart = false;
      onStart(playerName);
    }
  }

  function onLogoutGame(callback) {
    onLogout = callback;
  }

  function updateStartState() {
    const hasName = nameInput.value.trim().length > 0;
    startBtn.disabled = !hasName;
    if (!hasName) {
      startBtn.title = nameRequiredText;
    } else {
      startBtn.title = '';
    }
  }

  startBtn.addEventListener('click', () => {
    const rawName = nameInput.value.trim();
    if (rawName.length === 0) {
      nameInput.focus();
      return;
    }
    playerName = rawName;
    adminUnlocked = playerName === ADMIN_NAME && adminPassInput.value === ADMIN_PASS;
    gameStarted = true;
    startModal.classList.remove('show');
    nameInput.blur();
    adminPassInput.blur();
    logoutBtn.classList.remove('hidden');
    try {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ name: playerName, adminUnlocked })
      );
    } catch (error) {
      // Ignore storage errors.
    }
    if (onStart) {
      onStart(playerName);
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
    updateStartState();
    logoutBtn.classList.add('hidden');
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (error) {
      // Ignore storage errors.
    }
    if (onLogout) {
      onLogout();
    }
  });

  nameInput.addEventListener('input', updateStartState);
  updateStartState();
  logoutBtn.classList.add('hidden');

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
        if (onStart) {
          onStart(playerName);
        } else {
          pendingStart = true;
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
    updatePrompt,
    setNpcName,
    isDialogOpen,
    isGameStarted,
    isFlyUnlocked,
    getActiveStep,
    getPlayerName,
    onStartGame,
    onLogoutGame
  };
}
