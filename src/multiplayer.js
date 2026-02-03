import { THREE } from './three.js';

const UPDATE_INTERVAL = 100;

function lerpAngle(from, to, t) {
  let diff = to - from;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return from + diff * t;
}

function hashString(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function createNameTag(name) {
  const fontSize = 24;
  const paddingX = 16;
  const paddingY = 10;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `600 ${fontSize}px "Space Grotesk", sans-serif`;
  const textWidth = ctx.measureText(name).width;
  canvas.width = Math.ceil(textWidth + paddingX * 2);
  canvas.height = fontSize + paddingY * 2;
  ctx.font = `600 ${fontSize}px "Space Grotesk", sans-serif`;
  ctx.fillStyle = 'rgba(10, 12, 16, 0.75)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f6f1e7';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, paddingX, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(canvas.width / 80, canvas.height / 80, 1);

  return { sprite, texture, material };
}

export function createMultiplayer(scene, options = {}) {
  const onChat = options.onChat ?? (() => {});
  const onSystem = options.onSystem ?? (() => {});
  const onPlayers = options.onPlayers ?? (() => {});

  let socket = null;
  let myId = null;
  let lastSend = 0;
  const lastSentPos = new THREE.Vector3();
  let lastSentRot = 0;

  const remotes = new Map();
  const remoteGeometry = new THREE.CapsuleGeometry(0.45, 0.9, 6, 10);
  const baseRemoteMaterial = new THREE.MeshStandardMaterial({
    color: 0x7c86b3,
    roughness: 0.6,
    metalness: 0.08
  });

  function createRemotePlayer(player) {
    if (!player || !player.id) return null;
    if (player.id === myId) return null;

    const group = new THREE.Group();
    const material = baseRemoteMaterial.clone();
    const hue = (hashString(player.id) % 360) / 360;
    material.color.setHSL(hue, 0.35, 0.55);
    const body = new THREE.Mesh(remoteGeometry, material);
    body.position.y = 1.25;
    body.castShadow = true;
    body.receiveShadow = true;

    const nameTag = createNameTag(player.name || 'Traveler');
    nameTag.sprite.position.y = 2.9;

    group.add(body, nameTag.sprite);
    group.position.set(player.x ?? 0, player.y ?? 0, player.z ?? 0);
    group.rotation.y = player.r ?? 0;
    scene.add(group);

    const remote = {
      id: player.id,
      name: player.name || 'Traveler',
      group,
      body,
      nameTag,
      targetPosition: new THREE.Vector3(player.x ?? 0, player.y ?? 0, player.z ?? 0),
      targetRotation: player.r ?? 0
    };
    remotes.set(player.id, remote);
    return remote;
  }

  function removeRemotePlayer(id) {
    const remote = remotes.get(id);
    if (!remote) return;
    scene.remove(remote.group);
    if (remote.body.material && remote.body.material !== baseRemoteMaterial) {
      remote.body.material.dispose();
    }
    if (remote.nameTag) {
      if (remote.nameTag.texture) remote.nameTag.texture.dispose();
      if (remote.nameTag.material) remote.nameTag.material.dispose();
    }
    remotes.delete(id);
  }

  function clearRemotes() {
    Array.from(remotes.keys()).forEach((id) => removeRemotePlayer(id));
  }

  function handleWelcome(message) {
    myId = message.id;
    onSystem('Connected.');
    if (Array.isArray(message.players)) {
      message.players.forEach((player) => {
        if (player.id !== myId) {
          createRemotePlayer(player);
        }
      });
    }
    onPlayers(remotes.size + 1);
  }

  function handlePlayerJoined(message) {
    if (!message.player) return;
    createRemotePlayer(message.player);
    onPlayers(remotes.size + 1);
    onSystem(`${message.player.name || 'Player'} joined.`);
  }

  function handlePlayerLeft(message) {
    if (!message.id) return;
    removeRemotePlayer(message.id);
    onPlayers(remotes.size + 1);
  }

  function handlePlayerMoved(message) {
    if (!message.id || message.id === myId) return;
    const remote = remotes.get(message.id);
    if (!remote) {
      createRemotePlayer(message);
      return;
    }
    remote.targetPosition.set(message.x ?? 0, message.y ?? 0, message.z ?? 0);
    remote.targetRotation = message.r ?? 0;
  }

  function handleChat(message) {
    if (!message.name || !message.text) return;
    onChat({ name: message.name, text: message.text });
  }

  function handleState(message) {
    if (!Array.isArray(message.players)) return;
    const seen = new Set();
    message.players.forEach((player) => {
      if (!player || !player.id || player.id === myId) return;
      seen.add(player.id);
      const remote = remotes.get(player.id) || createRemotePlayer(player);
      if (!remote) return;
      remote.targetPosition.set(player.x ?? 0, player.y ?? 0, player.z ?? 0);
      remote.targetRotation = player.r ?? 0;
      if (player.name && player.name !== remote.name) {
        remote.name = player.name;
        if (remote.nameTag) {
          if (remote.nameTag.texture) remote.nameTag.texture.dispose();
          if (remote.nameTag.material) remote.nameTag.material.dispose();
          remote.group.remove(remote.nameTag.sprite);
        }
        const nameTag = createNameTag(player.name);
        nameTag.sprite.position.y = 2.9;
        remote.group.add(nameTag.sprite);
        remote.nameTag = nameTag;
      }
    });

    remotes.forEach((remote, id) => {
      if (!seen.has(id)) {
        removeRemotePlayer(id);
      }
    });

    onPlayers(remotes.size + 1);
  }

  function connect({ name, serverUrl }) {
    disconnect();
    if (!serverUrl || serverUrl.includes('YOUR_SERVER_HOST')) {
      onSystem('Server not configured. Please set SERVER_URL in src/config.js.');
      return;
    }

    try {
      socket = new WebSocket(serverUrl);
    } catch (error) {
      onSystem('Invalid server URL.');
      return;
    }

    onSystem(`Connecting to ${serverUrl}...`);

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ type: 'join', name }));
    });

    socket.addEventListener('message', (event) => {
      let message = null;
      try {
        message = JSON.parse(event.data);
      } catch (error) {
        return;
      }
      if (!message || !message.type) return;

      switch (message.type) {
        case 'welcome':
          handleWelcome(message);
          break;
        case 'player-joined':
          handlePlayerJoined(message);
          break;
        case 'player-left':
          handlePlayerLeft(message);
          break;
        case 'player-moved':
          handlePlayerMoved(message);
          break;
        case 'chat':
          handleChat(message);
          break;
        case 'state':
          handleState(message);
          break;
        case 'server-full':
          onSystem('Server is full (10 players).');
          disconnect();
          break;
        default:
          break;
      }
    });

    socket.addEventListener('close', () => {
      onSystem('Disconnected from server.');
      myId = null;
      clearRemotes();
      onPlayers(1);
    });

    socket.addEventListener('error', () => {
      onSystem('Connection error.');
    });
  }

  function disconnect() {
    if (socket) {
      socket.close();
      socket = null;
    }
    myId = null;
    clearRemotes();
  }

  function sendChat(text) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: 'chat', text }));
  }

  function sendMove(player) {
    if (!socket || socket.readyState !== WebSocket.OPEN || !myId) return;
    const now = performance.now();
    if (now - lastSend < UPDATE_INTERVAL) return;

    const pos = player.position;
    const rot = player.rotation.y;
    if (pos.distanceToSquared(lastSentPos) < 0.0004 && Math.abs(rot - lastSentRot) < 0.01) {
      return;
    }

    lastSend = now;
    lastSentPos.copy(pos);
    lastSentRot = rot;
    socket.send(
      JSON.stringify({
        type: 'move',
        x: pos.x,
        y: pos.y,
        z: pos.z,
        r: rot
      })
    );
  }

  function updateRemotes(delta) {
    remotes.forEach((remote) => {
      const distance = remote.group.position.distanceTo(remote.targetPosition);
      if (distance > 6) {
        remote.group.position.copy(remote.targetPosition);
      } else {
        remote.group.position.lerp(remote.targetPosition, Math.min(1, delta * 6));
      }
      remote.group.rotation.y = lerpAngle(remote.group.rotation.y, remote.targetRotation, Math.min(1, delta * 8));
    });
  }

  function update(delta, player) {
    sendMove(player);
    updateRemotes(delta);
  }

  return {
    connect,
    disconnect,
    sendChat,
    update
  };
}
