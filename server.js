// server.js (Improved WebRTC signaling + late join + safer flow)

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static PWA client
app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();       // roomId → Set<socket>
const lastOffer = new Map();   // roomId → SDP offer
const lastAnswer = new Map();  // roomId → SDP answer

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }

    const { type, room, payload } = data;
    if (!room) return;

    // Create room if not exists
    if (!rooms.has(room)) rooms.set(room, new Set());
    rooms.get(room).add(ws);

    // Save last offer/answer for late join
    if (type === "offer") lastOffer.set(room, payload);
    if (type === "answer") lastAnswer.set(room, payload);

    // 💥 FIXED: Correct join logic FIRST then send offer/answer
    if (type === "join") {
      if (lastOffer.has(room)) {
        ws.send(JSON.stringify({ type: "offer", payload: lastOffer.get(room) }));
      }
      if (lastAnswer.has(room)) {
        ws.send(JSON.stringify({ type: "answer", payload: lastAnswer.get(room) }));
      }
      return;
    }

    // 💥 FIXED: Proper broadcast with room info
    rooms.get(room).forEach((peer) => {
      if (peer !== ws && peer.readyState === WebSocket.OPEN) {
        peer.send(JSON.stringify({ type, room, payload }));
      }
    });
  });

  ws.on("close", () => {
    for (const [roomId, peers] of rooms) {
      peers.delete(ws);

      if (peers.size === 0) {
        rooms.delete(roomId);
        lastOffer.delete(roomId);
        lastAnswer.delete(roomId);
      }
    }
  });
});

server.listen(3000, () =>
  console.log("Signaling server running at http://localhost:3000")
);
