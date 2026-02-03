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

setInterval(() => {
  if (players.size === 0) return;
  broadcast({ type: 'state', players: Array.from(players.values()) });
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

      player = {
        id: String(nextId++),
        name: sanitizeName(message.name),
        x: 0,
        y: 0,
        z: 0,
        r: 0
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
      return;
    }

    if (!player) return;

    if (message.type === 'move') {
      const x = Number(message.x);
      const y = Number(message.y);
      const z = Number(message.z);
      const r = Number(message.r);
      if (Number.isFinite(x)) player.x = x;
      if (Number.isFinite(y)) player.y = y;
      if (Number.isFinite(z)) player.z = z;
      if (Number.isFinite(r)) player.r = r;

      broadcast(
        {
          type: 'player-moved',
          id: player.id,
          x: player.x,
          y: player.y,
          z: player.z,
          r: player.r
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
    if (!player) return;
    clients.delete(ws);
    players.delete(player.id);
    broadcast({ type: 'player-left', id: player.id });
    player = null;
  });
});

server.listen(PORT, () => {
  console.log(`PolloRP server listening on ${PORT}`);
});
