from typing import Optional, Deque, cast
from collections import deque
import time

class MovingAverageFilter:
    def __init__(self, size: int = 10):
        self.buffer: Deque[float] = deque(maxlen=size)

    def add(self, value: float) -> float:
        self.buffer.append(value)
        return sum(self.buffer) / len(self.buffer)

class VelocityCalculator:
    def __init__(self):
        self.last_val: Optional[float] = None
        self.last_ts: Optional[float] = None

    def calculate(self, val: float) -> float:
        now = time.time()
        if self.last_val is None or self.last_ts is None:
            self.last_val, self.last_ts = val, now
            return 0.0
        
        dt = now - cast(float, self.last_ts)
        if dt < 0.001: return 0.0
        
        vel = abs(val - cast(float, self.last_val)) / dt
        self.last_val, self.last_ts = val, now
        return vel
