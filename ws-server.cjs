const http = require("http");
const WebSocket = require("ws");

const server = http.createServer();
const wss = new WebSocket.Server({ server });

console.log("WebSocket server running...");

wss.on("connection", (ws) => {

  console.log("Client connected");

  ws.on("message", (message) => {

    console.log("Sensor:", message.toString());

    // broadcast to ALL clients
    wss.clients.forEach((client) => {

      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }

    });

  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });

});

server.listen(process.env.PORT || 3000);
