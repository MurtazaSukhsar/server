const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

// create HTTP server
const server = http.createServer((req, res) => {

  // allow requests from any website (fix CORS)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  res.writeHead(200);
  res.end("Sensor WebSocket server running");
});

// create websocket server
const wss = new WebSocket.Server({ server });

console.log("WebSocket server starting...");

// when a client connects
wss.on("connection", (ws) => {

  console.log("Client connected");

  // when sensor data arrives
  ws.on("message", (message) => {

    console.log("Sensor data:", message.toString());

    // send the data to ALL connected clients (phone + unity)
    wss.clients.forEach((client) => {

      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
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

// start server
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});
