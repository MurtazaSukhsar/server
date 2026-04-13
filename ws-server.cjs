const http = require("http");
const WebSocket = require("ws");

const server = http.createServer((req, res) => {

  // Allow all websites to access this server
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  res.writeHead(200);
  res.end("Sensor server running");
});

const wss = new WebSocket.Server({ server });

let clients = [];

wss.on("connection", (ws) => {
  console.log("Client connected");

  clients.push(ws);

  ws.on("message", (message) => {

    // broadcast sensor data to all clients
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });

  });

  ws.on("close", () => {
    clients = clients.filter(c => c !== ws);
    console.log("Client disconnected");
  });
});

server.listen(3000, () => {
  console.log("WebSocket server running");
});
