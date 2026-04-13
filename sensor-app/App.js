import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Dimensions, TouchableOpacity } from 'react-native';
import { DeviceMotion } from 'expo-sensors';

const WS_URL = 'wss://rehab-hub.onrender.com';

export default function App() {
  const [data, setData] = useState({ pitch: 0, roll: 0, yaw: 0 });
  const [connected, setConnected] = useState(false);
  const [ws, setWs] = useState(null);

  useEffect(() => {
    const socket = new WebSocket(WS_URL);
    
    socket.onopen = () => setConnected(true);
    socket.onclose = () => {
      setConnected(false);
      // Reconnect logic
      setTimeout(() => setWs(new WebSocket(WS_URL)), 3000);
    };
    socket.onerror = (e) => console.log('WS Error: ', e.message);
    
    setWs(socket);
    
    // Set 60Hz update rate (16ms)
    DeviceMotion.setUpdateInterval(16);
    
    const subscription = DeviceMotion.addListener(motionData => {
      if (!motionData.rotation) return;
      
      // Get 3D rotation angles in degrees
      const pitch = Math.round(motionData.rotation.beta * (180 / Math.PI));
      const roll = Math.round(motionData.rotation.gamma * (180 / Math.PI));
      const yaw = Math.round(motionData.rotation.alpha * (180 / Math.PI));
      
      setData({ pitch, roll, yaw });

      // Stream full 3D data to server
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          pitch,
          roll,
          yaw,
          angle: pitch, // Backward compatibility
          timestamp: Date.now(),
          deviceId: 'LimbSensor-3D'
        }));
      }
    });

    return () => {
      subscription.remove();
      socket.close();
    };
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: connected ? '#2ECC71' : '#E74C3C' }]}>
      <View style={styles.card}>
        <Text style={styles.status}>
          {connected ? 'CORE SENSOR CONNECTED ✓' : 'DISCONNECTED! CHECK IP'}
        </Text>
        <Text style={styles.angleLabel}>LIVE ANGLE</Text>
        <Text style={styles.angle}>{angle}°</Text>
        <Text style={styles.stats}>X: {data.x.toFixed(2)} | Y: {data.y.toFixed(2)} | Z: {data.z.toFixed(2)}</Text>
      </View>
      <Text style={styles.hint}>Mount this device on your limb</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '85%',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 30,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  status: {
    fontSize: 12,
    fontWeight: '900',
    color: '#8E8E93',
    letterSpacing: 1,
    marginBottom: 40,
  },
  angleLabel: {
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '800',
  },
  angle: {
    fontSize: 80,
    fontWeight: '900',
    color: '#1C1C1E',
    marginVertical: 10,
  },
  stats: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
    marginTop: 20,
  },
  hint: {
    color: '#fff',
    marginTop: 30,
    fontWeight: '700',
    opacity: 0.8,
  }
});
