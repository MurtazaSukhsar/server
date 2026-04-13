from flask_socketio import SocketIO, emit

class SocketHandler:
    def __init__(self, socketio: SocketIO):
        self.socketio = socketio
        self.setup_events()

    def setup_events(self):
        @self.socketio.on('connect')
        def handle_connect():
            print("Client connected")

        @self.socketio.on('sensor_data')
        def handle_sensor(data):
            # To be handled in app.py via broadcast or direct logic
            pass

    def broadcast_live(self, data):
        self.socketio.emit('live_update', data)

    def broadcast_emergency(self, data):
        self.socketio.emit('emergency', data)
