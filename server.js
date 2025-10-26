// server.js
// Simple signaling server with "late join" support

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static client
app.use(express.static(path.join(__dirname, "public")));


// Keep track of room members and last offer
const rooms = new Map(); // roomId -> Set of sockets
const lastOffers = new Map(); // roomId -> last SDP offer (for late joiners)

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      const { type, room, payload } = data;
      if (!room) return;

      if (!rooms.has(room)) rooms.set(room, new Set());
      rooms.get(room).add(ws);

      // 💡 Store last offer (for late join)
      if (type === "offer") {
        lastOffers.set(room, payload);
      }

      if (type === 'disconnect') {
  const peers = rooms.get(room);
  peers.forEach(peer => {
    if (peer.readyState === WebSocket.OPEN) {
      peer.send(JSON.stringify({ type: 'disconnect' }));
    }
  });
  return; // stop further broadcasting
}


      // Broadcast message to other peers
      const peers = rooms.get(room);
      peers.forEach((peer) => {
        if (peer !== ws && peer.readyState === WebSocket.OPEN) {
          peer.send(JSON.stringify({ type, payload }));
        }
      });

      // 💡 If new receiver joined, send last offer automatically
      if (type === "join" && lastOffers.has(room)) {
        const offer = lastOffers.get(room);
        ws.send(JSON.stringify({ type: "offer", payload: offer }));
      }
    } catch (e) {
      console.error("Invalid message", e);
    }
  });

  ws.on("close", () => {
    for (const [roomId, set] of rooms.entries()) {
      set.delete(ws);
      if (set.size === 0) {
        rooms.delete(roomId);
        lastOffers.delete(roomId);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Signaling server running on http://localhost:${PORT}`));
