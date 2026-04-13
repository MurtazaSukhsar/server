from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO
import time, threading, sqlite3
from typing import Dict, Any, cast

# Custom modules
from filters import MovingAverageFilter, VelocityCalculator
from analysis import MovementAnalyzer
from socket_handler import SocketHandler

app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = 'rehab-secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

# State
state: Dict[str, Any] = {
    "angle": 0.0,
    "max_angle": 0.0,
    "reps": 0,
    "risk": "safe",
    "reason": "Ready",
    "stability": 100.0,
    "velocity": 0.0,
    "is_fall": False,
    "deviceId": "None",
    "session_start": time.time(),
    "db_buffer": []
}

# Engines
filters = {
    "angle": MovingAverageFilter(10),
    "vel": VelocityCalculator()
}
analyzer = MovementAnalyzer()
sh = SocketHandler(socketio)

@app.route('/')
def index():
    return "<h1>VR Rehab Backend</h1><p>Status: Running</p><p>SocketIO: Active on port 5000</p>"

def db_worker():
    # Ensure table exists
    try:
        conn = sqlite3.connect("rehab.db")
        c = conn.cursor()
        c.execute("CREATE TABLE IF NOT EXISTS readings (angle REAL, risk TEXT, reason TEXT, t REAL)")
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"DB Init Error: {e}")

    while True:
        if state["db_buffer"]:
            try:
                conn = sqlite3.connect("rehab.db")
                c = conn.cursor()
                batch = state["db_buffer"][:]
                state["db_buffer"] = []
                c.executemany("INSERT INTO readings (angle, risk, reason, t) VALUES (?, ?, ?, ?)", batch)
                conn.commit()
                conn.close()
            except Exception as e:
                print(f"DB Error: {e}")
        time.sleep(0.3)

threading.Thread(target=db_worker, daemon=True).start()

@app.route('/api/latest')
def get_latest():
    return jsonify({
        **state,
        "session_elapsed": int(time.time() - cast(float, state["session_start"]))
    })

@socketio.on('sensor_data')
def handle_sensor(data):
    print(f"✓ Backend Received: P:{data.get('pitch', 0)}° R:{data.get('roll', 0)}°") 
    raw_angle = float(data.get('pitch', data.get('angle', 0)))
    accel_z = float(data.get('accel_z', 1.0))
    
    # 1. Processing
    angle = filters["angle"].add(raw_angle)
    vel = filters["vel"].calculate(angle)
    
    # 2. Analysis
    res = analyzer.analyze(angle, vel, accel_z)
    
    # 3. Update State
    state.update({
        "angle": round(angle, 1),
        "velocity": round(vel, 1),
        "accel_z": accel_z,
        "deviceId": data.get('deviceId', 'WebSensor'),
        **res
    })
    
    if angle > state["max_angle"]:
        state["max_angle"] = angle
        
    # Rep counting (simple threshold)
    if angle > 90 and not state.get("_in_rep", False):
        state["_in_rep"] = True
    elif angle < 30 and state.get("_in_rep", False):
        state["_in_rep"] = False
        state["reps"] += 1

    # 4. Persistence
    state["db_buffer"].append((state["angle"], state["risk"], state["reason"], time.time()))

    # 5. Broadcast
    sh.broadcast_live(state)
    if res["is_fall"]:
        sh.broadcast_emergency(state)

if __name__ == '__main__':
    import os
    port = int(os.environ.get("PORT", 5000))
    # debug=True only if we're not in production (not on cloud)
    socketio.run(app, host='0.0.0.0', port=port, debug=not os.environ.get("PORT"))
