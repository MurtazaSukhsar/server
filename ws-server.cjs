const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

// HTTP server (needed for Render health checks)
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("WebSocket server is running");
});

const wss = new WebSocket.Server({ server });

console.log("WebSocket server starting...");

// When a client connects
wss.on("connection", (ws) => {

  console.log("Client connected");

  // When sensor data arrives
  ws.on("message", (message) => {

    const data = message.toString();
    console.log("Sensor:", data);

    // broadcast message to all connected clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });

  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });

  ws.on("error", (err) => {
    console.log("WebSocket error:", err);
  });

});

// Start server
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});
