from collections import deque
from typing import Deque, Dict, Any, List

class MovementAnalyzer:
    def __init__(self):
        self.angle_history: Deque[float] = deque(maxlen=50)
        self.velocity_history: Deque[float] = deque(maxlen=50)
        self.accel_history: Deque[float] = deque(maxlen=50)

    def analyze(self, angle: float, velocity: float, accel_z: float) -> Dict[str, Any]:
        self.angle_history.append(angle)
        self.velocity_history.append(velocity)
        self.accel_history.append(accel_z)

        # 1. Basic Risk
        risk = "safe"
        reason = "Normal movement"

        if angle > 120 or velocity > 80:
            risk = "danger"
            reason = "Extreme ROM or fast movement"
        elif velocity > 50:
            risk = "warning"
            reason = "High velocity detected"

        # 2. Stability
        stability = 100.0
        if len(self.angle_history) > 10:
            # Simple stability: inverse of variance
            avg = sum(self.angle_history) / len(self.angle_history)
            variance = sum((x - avg)**2 for x in self.angle_history) / len(self.angle_history)
            stability = float(max(0.0, 100.0 - (float(variance) * 2.0)))

        # 3. Fall Detection
        is_fall = False
        accel_spike = accel_z > 2.5 or accel_z < 0.2
        
        sudden_angle_drop = False
        if len(self.angle_history) > 5:
            hist_list: List[float] = list(self.angle_history)
            h_len = len(hist_list)
            recent_angles = [hist_list[i] for i in range(h_len - 6, h_len - 1)]
            avg_prev = sum(recent_angles) / 5
            if (avg_prev - angle) > 30:
                sudden_angle_drop = True

        is_inactive = False
        if len(self.velocity_history) > 10:
            v_list = list(self.velocity_history)
            v_len = len(v_list)
            recent_velocities = [v_list[i] for i in range(v_len - 10, v_len)]
            if all(v < 5 for v in recent_velocities):
                is_inactive = True

        if accel_spike and sudden_angle_drop and is_inactive:
            is_fall = True
            risk = "danger"
            reason = "FALL DETECTED!"

        return {
            "risk": risk,
            "reason": reason,
            "stability": int(float(stability) * 10) / 10.0,
            "is_fall": is_fall,
            "fall_risk_score": int((100.0 - float(stability)) * 10) / 10.0
        }
