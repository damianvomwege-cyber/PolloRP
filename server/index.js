const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3001;
const MAX_PLAYERS = Number(process.env.MAX_PLAYERS || 10);

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('PolloRP WebSocket server');
});

const wss = new WebSocket.Server({ server });

let nextId = 1;
const clients = new Map();
const players = new Map();
const adminClients = new Set();
const bannedNames = new Set();
const ADMIN_NAME = 'Damian vom Wege';
const ADMIN_PASS = 'Admin@2024!';

function broadcastToAdmins(data) {
  const payload = JSON.stringify(data);
  adminClients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

setInterval(() => {
  const playerList = Array.from(players.values());
  if (playerList.length > 0) {
    broadcast({ type: 'state', players: playerList });
  }
  if (adminClients.size > 0) {
    broadcastToAdmins({ type: 'admin-update', players: playerList });
  }
}, 1000);

function sanitizeName(name) {
  if (typeof name !== 'string') return 'Traveler';
  const trimmed = name.trim();
  if (!trimmed) return 'Traveler';
  return trimmed.slice(0, 18);
}

function sanitizeChat(text) {
  if (typeof text !== 'string') return '';
  return text.trim().slice(0, 160);
}

function broadcast(data, except) {
  const payload = JSON.stringify(data);
  clients.forEach((player, ws) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (except && ws === except) return;
    ws.send(payload);
  });
}

wss.on('connection', (ws) => {
  let player = null;

  ws.on('message', (raw) => {
    let message = null;
    try {
      message = JSON.parse(raw.toString());
    } catch (error) {
      return;
    }
    if (!message || typeof message.type !== 'string') return;

    if (message.type === 'join') {
      if (players.size >= MAX_PLAYERS) {
        ws.send(JSON.stringify({ type: 'server-full' }));
        ws.close();
        return;
      }
      if (player) return;

      const name = sanitizeName(message.name);
      if (bannedNames.has(name.toLowerCase())) {
        ws.send(JSON.stringify({ type: 'banned' }));
        ws.close();
        return;
      }

      player = {
        id: String(nextId++),
        name,
        x: 0,
        y: 0,
        z: 0,
        r: 0,
        level: 1
      };
      clients.set(ws, player);
      players.set(player.id, player);

      ws.send(
        JSON.stringify({
          type: 'welcome',
          id: player.id,
          players: Array.from(players.values())
        })
      );

      broadcast({ type: 'player-joined', player }, ws);
      broadcastToAdmins({ type: 'admin-player-joined', player });
      return;
    }

    if (message.type === 'admin-join') {
      if (message.name === ADMIN_NAME && message.password === ADMIN_PASS) {
        adminClients.add(ws);
        ws.send(JSON.stringify({
          type: 'admin-welcome',
          players: Array.from(players.values()),
          bans: Array.from(bannedNames)
        }));
      } else {
        ws.send(JSON.stringify({ type: 'admin-denied' }));
      }
      return;
    }

    if (message.type === 'admin-kick' && adminClients.has(ws)) {
      const targetId = message.id;
      let kicked = false;
      clients.forEach((p, clientWs) => {
        if (p.id === targetId) {
          clientWs.send(JSON.stringify({ type: 'kicked' }));
          clientWs.close();
          kicked = true;
        }
      });
      ws.send(JSON.stringify({ type: 'admin-kick-result', success: kicked, id: targetId }));
      return;
    }

    if (message.type === 'admin-ban' && adminClients.has(ws)) {
      const banName = String(message.name || '').trim().toLowerCase();
      if (banName) {
        bannedNames.add(banName);
        // Kick any connected player with that name
        clients.forEach((p, clientWs) => {
          if (p.name.toLowerCase() === banName) {
            clientWs.send(JSON.stringify({ type: 'kicked' }));
            clientWs.close();
          }
        });
        broadcastToAdmins({
          type: 'admin-ban-update',
          bans: Array.from(bannedNames)
        });
      }
      return;
    }

    if (message.type === 'admin-unban' && adminClients.has(ws)) {
      const unbanName = String(message.name || '').trim().toLowerCase();
      bannedNames.delete(unbanName);
      broadcastToAdmins({
        type: 'admin-ban-update',
        bans: Array.from(bannedNames)
      });
      return;
    }

    if (!player) return;

    if (message.type === 'move') {
      const x = Number(message.x);
      const y = Number(message.y);
      const z = Number(message.z);
      const r = Number(message.r);
      const level = Number(message.level);
      if (Number.isFinite(x)) player.x = x;
      if (Number.isFinite(y)) player.y = y;
      if (Number.isFinite(z)) player.z = z;
      if (Number.isFinite(r)) player.r = r;
      if (Number.isFinite(level) && level >= 1) player.level = level;

      broadcast(
        {
          type: 'player-moved',
          id: player.id,
          x: player.x,
          y: player.y,
          z: player.z,
          r: player.r,
          level: player.level ?? 1
        },
        ws
      );
      return;
    }

    if (message.type === 'chat') {
      const text = sanitizeChat(message.text);
      if (!text) return;
      broadcast({ type: 'chat', id: player.id, name: player.name, text });
    }
  });

  ws.on('close', () => {
    adminClients.delete(ws);
    if (!player) return;
    clients.delete(ws);
    players.delete(player.id);
    broadcast({ type: 'player-left', id: player.id });
    broadcastToAdmins({ type: 'admin-player-left', id: player.id, name: player.name });
    player = null;
  });
});

server.listen(PORT, () => {
  console.log(`PolloRP server listening on ${PORT}`);
});
