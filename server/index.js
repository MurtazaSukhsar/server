import { WebSocketServer } from 'ws';
import express from 'express';
import path from 'path';
import https from 'https';
import http from 'http';
import fs from 'fs';
import forge from 'node-forge';
import { fileURLToPath } from 'url';
import { io } from 'socket.io-client';
import os from 'os';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- STATE ---
let latestPitch = 0; // Up / Down (Beta)
let latestRoll = 0;  // Left / Right (Gamma)
let latestYaw = 0;   // Twisting (Alpha)

// Helper to get local IP address
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  let fallback = 'localhost';

  // Sort interfaces to prioritize Wi-Fi/Ethernet over VPN/Virtual adapters
  const interfaceNames = Object.keys(interfaces).sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    if (aLower.includes('wi-fi') || aLower.includes('ethernet')) return -1;
    if (bLower.includes('wi-fi') || bLower.includes('ethernet')) return 1;
    return 0;
  });

  for (const name of interfaceNames) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        // Prioritize common LAN ranges
        if (iface.address.startsWith('192.168.') || 
            iface.address.startsWith('10.') || 
            iface.address.startsWith('172.')) {
          return iface.address;
        }
        if (fallback === 'localhost') fallback = iface.address;
      }
    }
  }
  return fallback;
}

const IS_PROD = process.env.NODE_ENV === 'production';
const SERVER_IP = IS_PROD ? '0.0.0.0' : getLocalIp();
const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

app.use(cors());
app.use(express.json());

// Socket.io context for bridging to Python Backend
const backendSocket = io(BACKEND_URL);
backendSocket.on('connect', () => console.log(`✓ Bridged to Python Backend at ${BACKEND_URL}`));

// Generate SSL Certificates
const keyPath = path.join(__dirname, 'key.pem');
const certPath = path.join(__dirname, 'cert.pem');

function generateCerts() {
  console.log('Generating fresh SSL certificates using Forge...');
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  
  const attrs = [{
    name: 'commonName',
    value: SERVER_IP
  }, {
    name: 'countryName',
    value: 'US'
  }, {
    shortName: 'ST',
    value: 'State'
  }, {
    name: 'localityName',
    value: 'City'
  }, {
    name: 'organizationName',
    value: 'RehabHub'
  }, {
    shortName: 'OU',
    value: 'Dev'
  }];
  
  cert.setSubject(attrs);
  cert.setIssuer(attrs);

  cert.setExtensions([{
    name: 'basicConstraints',
    cA: true
  }, {
    name: 'keyUsage',
    keyCertSign: true,
    digitalSignature: true,
    nonRepudiation: true,
    keyEncipherment: true,
    dataEncipherment: true
  }, {
    name: 'extKeyUsage',
    serverAuth: true,
    clientAuth: true
  }, {
    name: 'subjectAltName',
    altNames: [{
      type: 7, // IP
      ip: SERVER_IP
    }, {
      type: 2, // DNS
      value: 'localhost'
    }]
  }]);

  cert.sign(keys.privateKey);
  
  const pemKey = forge.pki.privateKeyToPem(keys.privateKey);
  const pemCert = forge.pki.certificateToPem(cert);
  
  fs.writeFileSync(keyPath, pemKey);
  fs.writeFileSync(certPath, pemCert);
  
  return { key: pemKey, cert: pemCert };
}

let options = null;
if (!IS_PROD) {
  try {
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      const key = fs.readFileSync(keyPath, 'utf8');
      const cert = fs.readFileSync(certPath, 'utf8');
      if (key.includes('-----BEGIN') && cert.includes('-----BEGIN')) {
          options = { key, cert, minVersion: 'TLSv1.2' };
      } else {
          const pems = generateCerts();
          options = { ...pems, minVersion: 'TLSv1.2' };
      }
    } else {
      const pems = generateCerts();
      options = { ...pems, minVersion: 'TLSv1.2' };
    }
  } catch (e) {
    const pems = generateCerts();
    options = { ...pems, minVersion: 'TLSv1.2' };
  }
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sensor.html'));
});

// --- REST API FOR UNITY ---
// POST /sensor : Phone (Sensor) sends JSON { "pitch": 74, "roll": 10 }
app.post('/sensor', (req, res) => {
  if (req.body) {
    if (req.body.pitch !== undefined) latestPitch = Math.round(Number(req.body.pitch));
    if (req.body.roll !== undefined) latestRoll = Math.round(Number(req.body.roll));
    res.sendStatus(200);
  } else {
    res.status(400).send('Missing data');
  }
});

// GET /sensor : Unity (CURL) fetches "pitch,roll,yaw"
app.get('/sensor', (req, res) => {
  res.type('text/plain').send(`${latestPitch},${latestRoll},${latestYaw}`);
});

// --- OPTIONAL: UNITY GAME HOSTING ---
const webBuildPath = path.join(__dirname, '../web build');
if (fs.existsSync(webBuildPath)) {
  app.use('/game', express.static(webBuildPath));
  app.get('/game', (req, res) => {
    res.sendFile(path.join(webBuildPath, 'index.html'));
  });
  console.log('✓ Found Unity Build: Serving locally at /game');
} else {
  console.log('ℹ No local Unity Build found. (Expected in production if hosting game on Vercel)');
}

// --- START SERVERS ---
let server;

if (IS_PROD || !options) {
  // Production (Cloud) or No SSL available -> Standard HTTP
  // The cloud provider (Render/Railway/Nginx) will provide the HTTPS wrapper
  server = http.createServer(app).listen(PORT, () => {
    console.log('--- REHAB HUB (PRODUCTION) ---');
    console.log(`📡 Listening on Port: ${PORT}`);
    console.log(`🔗 Local Access: http://localhost:${PORT}`);
    console.log(`🌐 Network Access: http://${getLocalIp()}:${PORT}`);
  });
} else {
  // Local Development with Self-Signed SSL
  server = https.createServer(options, app).listen(PORT, () => {
    console.log('--- REHAB HUB (LOCAL DEV) ---');
    console.log(`📡 WEB SENSOR (PHONE A): https://${SERVER_IP}:${PORT}`);
  });
}

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('✓ New Mobile/Browser Sensor Client Connected to Secure Hub (3001)');
  ws.on('message', (message) => {
    try {
        const data = JSON.parse(message);
        if (data.pitch !== undefined) latestPitch = data.pitch;
        if (data.roll !== undefined) latestRoll = data.roll;
        if (data.yaw !== undefined) latestYaw = data.yaw;
        if (data.angle !== undefined && data.pitch === undefined) latestPitch = data.angle;
        
        // 1. Broadcast to all local WebSocket clients (e.g., other mobile views)
        wss.clients.forEach((client) => {
          if (client.readyState === 1) client.send(JSON.stringify(data));
        });

        // 2. Bridge to Flask Backend (for Analysis and Doctor Dashboard)
        if (backendSocket.connected) {
            backendSocket.emit('sensor_data', data);
        }

        // --- DEBUG LOGGING (Cloud only) ---
        if (IS_PROD && Math.random() > 0.99) {
            console.log(`[DEBUG] Received from ${data.deviceId || 'Unknown'}: P:${data.pitch} R:${data.roll} Y:${data.yaw}`);
        }
    } catch (e) {
        console.error('[HUB] Error parsing message:', e);
    }
  });
});
