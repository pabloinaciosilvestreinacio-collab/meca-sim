"""Modelo ideal diferencial, SI, yaw positivo anti-horário, frente +Y em yaw=0."""
from dataclasses import dataclass, field
import math

GRAVITY = 9.81


def encoder_scale(ticks_per_revolution, reduction, diameter_m):
    values = (ticks_per_revolution, reduction, diameter_m)
    if not all(math.isfinite(v) and v > 0 for v in values):
        raise ValueError("Ticks, redução e diâmetro devem ser positivos e finitos")
    return ticks_per_revolution * reduction / (math.pi * diameter_m)


def rotate(x, y, angle):
    return x * math.cos(angle) - y * math.sin(angle), x * math.sin(angle) + y * math.cos(angle)


def trajectory(height, speed, angle_deg, distance):
    a = math.radians(angle_deg)
    if not all(math.isfinite(v) for v in (height, speed, angle_deg, distance)) or height < 0 or distance < 0 or speed <= 0 or not 0 <= angle_deg < 90:
        raise ValueError("Velocidade positiva e ângulo entre 0 e 89 graus são necessários")
    return height + distance * math.tan(a) - 9.81 * distance**2 / (2 * speed**2 * math.cos(a)**2)


@dataclass
class Motor:
    side: str = "aux"
    mount: int = 1
    direction: int = 1
    power: float = 0
    raw_ticks: float = 0
    zero: float = 0
    target: int = 0
    mode: str = "RUN_WITHOUT_ENCODER"
    brake: str = "FLOAT"
    gain: float = 1
    slip: float = 0
    encoder_frozen: bool = False
    frozen_ticks: float = 0
    velocity: float = 0

    def position(self):
        ticks = self.frozen_ticks if self.encoder_frozen else self.raw_ticks
        return math.floor((ticks - self.zero) * self.direction + .5)

    def speed(self, maximum, ticks_per_m, dt=.01):
        if self.mode == "STOP_AND_RESET_ENCODER":
            return 0
        if self.mode == "RUN_TO_POSITION":
            error = self.target - (self.raw_ticks - self.zero) * self.direction
            if abs(error) <= 2:
                return 0
            return math.copysign(min(abs(self.power) * maximum * self.gain, abs(error) / ticks_per_m / dt), error) * self.direction
        return self.power * self.direction * maximum * self.gain


@dataclass
class World:
    track: float = .45
    width: float = .45
    length: float = .45
    max_speed: float = 1.0
    ticks_per_m: float = 1980.6
    x: float = 1.83
    y: float = .65
    yaw: float = 0
    elapsed: float = 0
    yaw_zero: float = 0
    motors: dict = field(default_factory=lambda: {"ME": Motor("left", 1), "MD": Motor("right", -1), "MS": Motor(), "MI": Motor()})
    trail: list = field(default_factory=list)
    acceleration: float = 0
    walls: bool = False
    field_size: float = 3.66
    collision: bool = False
    imu_frozen: bool = False
    imu_delay: float = 0
    imu_drift: float = 0
    sensor_history: list = field(default_factory=list)
    frozen_yaw: float | None = None

    def inside(self, x=None, y=None, yaw=None):
        x, y, yaw = (self.x if x is None else x, self.y if y is None else y, self.yaw if yaw is None else yaw)
        hx = (abs(math.cos(yaw))*self.width + abs(math.sin(yaw))*self.length)/2
        hy = (abs(math.sin(yaw))*self.width + abs(math.cos(yaw))*self.length)/2
        return hx <= x <= self.field_size-hx and hy <= y <= self.field_size-hy

    def sensor_yaw(self):
        if self.frozen_yaw is None:
            self.frozen_yaw = self.yaw
        if self.imu_frozen:
            return self.frozen_yaw
        observed = self.yaw
        if self.imu_delay and self.sensor_history:
            threshold = self.elapsed - self.imu_delay
            observed = self.sensor_history[0][1]
            for t, yaw in reversed(self.sensor_history):
                if t <= threshold + 1e-12:
                    observed = yaw
                    break
        return observed + math.radians(self.imu_drift)*self.elapsed

    def step(self, dt):
        if not math.isfinite(dt) or dt <= 0 or dt > 1:
            raise ValueError("Passo deve estar entre 0 e 1 segundo")
        # Subpassos também limitam a penetração aproximada contra as paredes.
        count = max(1, math.ceil(dt/.01))
        for _ in range(count):
            self._step(dt/count)

    def _step(self, dt):
        if not self.sensor_history:
            self.sensor_history.append((self.elapsed, self.yaw))
        if self.frozen_yaw is None:
            self.frozen_yaw = self.yaw
        sides = {"left": [], "right": []}
        for motor in self.motors.values():
            desired = motor.speed(self.max_speed, self.ticks_per_m, dt)
            speed = desired
            if self.acceleration and motor.mode not in ("STOP_AND_RESET_ENCODER", "RUN_TO_POSITION"):
                rate = self.acceleration * (4 if motor.power == 0 and motor.brake == "BRAKE" else 1)
                speed = motor.velocity + max(-rate*dt, min(rate*dt, desired-motor.velocity))
            delta = speed * self.ticks_per_m * dt
            if motor.mode == "RUN_TO_POSITION":
                remaining = motor.target * motor.direction - (motor.raw_ticks - motor.zero)
                delta = math.copysign(min(abs(delta), abs(remaining)), remaining) if speed else 0
                speed = delta / self.ticks_per_m / dt
            motor.raw_ticks += delta
            motor.velocity = speed
            if motor.side in sides:
                sides[motor.side].append(speed * motor.mount * (1-motor.slip))
        vl = sum(sides["left"]) / max(1, len(sides["left"]))
        vr = sum(sides["right"]) / max(1, len(sides["right"]))
        v, w = (vl + vr) / 2, (vr - vl) / self.track
        # Integração exata de arco: frente do robô = vetor (-sin(yaw), cos(yaw)).
        half_turn = w*dt/2
        sinc = math.sin(half_turn)/half_turn if abs(half_turn) > 1e-8 else 1-half_turn**2/6
        distance = v*dt*sinc
        heading = self.yaw + math.pi/2 + half_turn
        x, y = self.x + distance*math.cos(heading), self.y + distance*math.sin(heading)
        yaw = (self.yaw + w*dt + math.pi) % (2*math.pi)-math.pi
        self.collision = self.walls and not self.inside(x, y, yaw)
        if not self.collision:
            self.x, self.y, self.yaw = x, y, yaw
        self.elapsed += dt
        self.sensor_history.append((self.elapsed, self.yaw))
        self.sensor_history = self.sensor_history[-250:]
        if not self.trail or math.hypot(self.x-self.trail[-1][0], self.y-self.trail[-1][1]) > .01:
            self.trail.append([self.x, self.y])
            self.trail = self.trail[-3000:]

    def snapshot(self):
        return {"x": self.x, "y": self.y, "yaw": math.degrees(self.yaw), "time": self.elapsed,
                "collision": self.collision, "walls": self.walls,
                "width": self.width, "length": self.length, "trail": self.trail[:],
                "motors": {name: {"power": m.power, "encoder": m.position(), "direction": m.direction,
                                  "mount": m.mount, "side": m.side, "mode": m.mode} for name, m in self.motors.items()}}
