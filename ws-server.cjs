const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 3000 });

let sensorData = { pitch: 0, roll: 0 };

wss.on("connection", (ws) => {

    ws.on("message", (message) => {

        try {

            const data = JSON.parse(message);

            sensorData.pitch = data.pitch;
            sensorData.roll = data.roll;

            // broadcast to all clients
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(sensorData));
                }
            });

        } catch (e) {
            console.log("Invalid data");
        }

    });

});

console.log("WebSocket server running");
