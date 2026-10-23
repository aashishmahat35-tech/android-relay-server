const http = require('http');
const WebSocket = require('ws');

const port = process.env.PORT || 8080;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Relay server is running\n');
});

const wss = new WebSocket.Server({ server });
const rooms = new Map(); // room_id -> { controller: ws, target: ws }

wss.on('connection', (ws) => {
  let userRoom = null;
  let userRole = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);

      // Registration: { action: "REGISTER", role: "controller"|"target", room: "1234" }
      if (msg.action === 'REGISTER') {
        userRoom = msg.room;
        userRole = msg.role;

        if (!rooms.has(userRoom)) {
          rooms.set(userRoom, { controller: null, target: null });
        }
        rooms.get(userRoom)[userRole] = ws;

        ws.send(JSON.stringify({ status: 'REGISTERED', role: userRole, room: userRoom }));
        return;
      }

      // Relay: Forward to the other party in the same room
      if (userRoom && rooms.has(userRoom)) {
        const room = rooms.get(userRoom);
        const recipient = userRole === 'controller' ? room.target : room.controller;

        if (recipient && recipient.readyState === WebSocket.OPEN) {
          recipient.send(data.toString());
        } else {
          ws.send(JSON.stringify({ status: 'ERROR', message: 'Other device not connected' }));
        }
      }
    } catch (err) {
      console.error('Invalid JSON received:', err);
    }
  });

  ws.on('close', () => {
    if (userRoom && rooms.has(userRoom)) {
      const room = rooms.get(userRoom);
      if (room[userRole] === ws) {
        room[userRole] = null;
      }
      if (!room.controller && !room.target) {
        rooms.delete(userRoom);
      }
    }
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Relay server running on port ${port}`);
});
