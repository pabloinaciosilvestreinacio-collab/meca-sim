"""Modelo leve de peças BIOBUZZ e coleta por intake.

Posições de FIELD ELEMENTS são uma aproximação 2D dos diagramas oficiais.
Pollen em FLOWERS/HIVEs e Nectar reservado ficam como estados de estoque,
não como colisões 3D dos mecanismos reais.
"""
from dataclasses import dataclass
import math

FIELD_SIZE = 3.66
POLLEN_RADIUS = .0355  # manual: aprox. 7,1 cm de diâmetro
NECTAR_RADIUS = .0455  # manual: aprox. 9,1 cm de diâmetro
FLOWERS = ((.09, 1.82), (1.22, 3.57), (3.56, 2.43), (2.44, .09))
HIVE_CELLS = {
    "red": {"id": "red-lower", "x": 1.27, "y": 1.43},
    "blue": {"id": "blue-upper", "x": 1.89, "y": 1.90},
}


@dataclass
class ScoringElement:
    id: str
    kind: str
    team: str | None
    x: float
    y: float
    status: str
    location: str
    radius: float
    vx: float = 0.0
    vy: float = 0.0

    def snapshot(self):
        return {"id": self.id, "kind": self.kind, "team": self.team,
                "x": self.x, "y": self.y, "status": self.status,
                "location": self.location, "radius": self.radius}


def starting_elements(alliance="red"):
    if alliance not in ("red", "blue"):
        raise ValueError("Aliança deve ser red ou blue")
    pieces = []
    # 16 Pollen inicialmente nos quatro FLOWERS; o estado especial mantém a
    # distinção entre peça dentro da estrutura e peça livre no piso.
    for flower, (x, y) in enumerate(FLOWERS):
        for index, (dx, dy) in enumerate(((-.045, -.045), (.045, -.045), (-.045, .045), (.045, .045))):
            pieces.append(ScoringElement(f"pollen-flower-{flower}-{index}", "POLLEN", None,
                                         x + dx, y + dy, "flower", f"flower-{flower}",
                                         POLLEN_RADIUS))
    # 4 POLLEN em cada GARDEN, aproximadamente alinhados na faixa de fita.
    for team, positions in (
        ("red", [(0.085 + i*.12, .092) for i in range(4)]),
        ("blue", [(3.575 - i*.12, 3.568) for i in range(4)]),
    ):
        for i, (x, y) in enumerate(positions):
            pieces.append(ScoringElement(f"pollen-garden-{team}-{i}", "POLLEN", None,
                                         x, y, "field", f"garden-{team}", POLLEN_RADIUS))
    # Quatro preloads no robô virtual; os outros três ROBOTS sem representação
    # mantêm seus preloads em estado reservado na ALLIANCE AREA.
    for team in ("red", "blue"):
        for robot in range(2):
            status = "robot" if team == alliance and robot == 0 else "reserved"
            location = "inventory" if status == "robot" else f"alliance-{team}-preload-{robot}"
            for i in range(4):
                pieces.append(ScoringElement(f"pollen-preload-{team}-{robot}-{i}", "POLLEN", None,
                                             -1, -1, status, location, POLLEN_RADIUS))
    # 3 NECTAR na CELL inicialmente ascendente de cada HIVE.
    for team, cell in HIVE_CELLS.items():
        for i in range(3):
            pieces.append(ScoringElement(f"nectar-hive-{team}-{i}", "NECTAR", team,
                                         cell["x"] + .12 + .12*(i%2), cell["y"] + .12 + .08*(i//2),
                                         "hive", cell["id"], NECTAR_RADIUS))
    # 5 NECTAR de cada cor permanecem reservados na ALLIANCE AREA.
    for team in ("red", "blue"):
        for i in range(5):
            pieces.append(ScoringElement(f"nectar-alliance-{team}-{i}", "NECTAR", team,
                                         -1, -1, "reserved", f"alliance-{team}", NECTAR_RADIUS))
    return pieces


def starting_inventory(elements):
    return [piece.id for piece in elements if piece.status == "robot"]


def inventory_counts(elements, inventory):
    held = set(inventory)
    return {kind: sum(piece.id in held and piece.kind == kind for piece in elements)
            for kind in ("POLLEN", "NECTAR")}


def _local(dx, dy, yaw):
    c, s = math.cos(yaw), math.sin(yaw)
    return dx*c + dy*s, -dx*s + dy*c


def _world(lx, ly, yaw):
    c, s = math.cos(yaw), math.sin(yaw)
    return lx*c - ly*s, lx*s + ly*c


def _in_intake(world, piece):
    lx, ly = _local(piece.x-world.x, piece.y-world.y, world.yaw)
    r = piece.radius
    return abs(lx) <= world.width/2 + r and world.length/2-r <= ly <= world.length/2+world.intake_reach+r


def _robot_collision(world, piece, robot_velocity):
    lx, ly = _local(piece.x-world.x, piece.y-world.y, world.yaw)
    hx, hy = world.width/2, world.length/2
    qx, qy = max(-hx, min(hx, lx)), max(-hy, min(hy, ly))
    dx, dy = lx-qx, ly-qy
    distance = math.hypot(dx, dy)
    if distance >= piece.radius:
        return
    if distance < 1e-9:
        # Centro dentro do chassi: expulsa pela face mais próxima.
        gaps = (hx-abs(lx), hy-abs(ly))
        if gaps[0] < gaps[1]:
            dx, dy = math.copysign(1, lx or 1), 0
        else:
            dx, dy = 0, math.copysign(1, ly or 1)
        distance = 0
    nx, ny = dx/math.hypot(dx, dy), dy/math.hypot(dx, dy)
    push = piece.radius-distance
    lx += nx*push
    ly += ny*push
    ox, oy = _world(lx, ly, world.yaw)
    piece.x, piece.y = world.x+ox, world.y+oy
    rvx, rvy = robot_velocity
    # Velocidade transferida no referencial do campo; o impulso físico detalhado
    # não é calibrado, mas a peça não some nem atravessa o chassi.
    piece.vx, piece.vy = rvx, rvy


def _try_launch(world):
    ms, mi = world.motors.get("MS"), world.motors.get("MI")
    if not (ms and mi and ms.power*ms.direction > .5 and mi.power*mi.direction > .5):
        return
    settings = world.launcher
    if world.elapsed-world.last_feed_time < settings["interval"]:
        return
    world.last_feed_time = world.elapsed
    if not world.inventory:
        world.empty_feed_attempts += 1
        return
    piece_id = world.inventory.pop(0)
    piece = next((item for item in world.elements if item.id == piece_id), None)
    if piece is None:
        world.empty_feed_attempts += 1
        return
    piece.status = "launched"
    piece.location = "shooter"
    dx, dy = _world(settings["lateral"], settings["forward"], world.yaw)
    world.launch_sequence += 1
    world.launch_count += 1
    event = {
        "id": world.launch_sequence, "piece_id": piece.id, "kind": piece.kind,
        "team": piece.team, "time": world.elapsed,
        "x": world.x+dx, "y": world.y+dy, "yaw": math.degrees(world.yaw),
        "hive": settings["hive"], "lateral": settings["lateral"],
        "forward": settings["forward"], "height": settings["height"],
        "speed": settings["speed"], "elevation": settings["elevation"],
        "azimuth": settings["azimuth"]
    }
    world.launches.append(event)
    world.launches = world.launches[-32:]


def deposit_to_flower(world):
    """Move uma peça do inventário ao FLOWER mais próximo, se houver alcance.

    A ação é didática: regras de sequência e pontuação oficial são arbitradas
    separadamente e ainda não fazem parte deste bloco.
    """
    if not world.inventory:
        return None
    candidates = [(math.hypot(world.x-x, world.y-y), index)
                  for index, (x, y) in enumerate(FLOWERS)]
    distance, index = min(candidates)
    if distance > world.flower_range:
        return None
    piece_id = world.inventory[0]
    piece = next((item for item in world.elements if item.id == piece_id), None)
    if piece is None:
        return None
    world.inventory.pop(0)
    x, y = FLOWERS[index]
    piece.status = "deposited"
    piece.location = f"flower-{index}"
    piece.x, piece.y = x, y
    piece.vx = piece.vy = 0.0
    world.flower_sequence += 1
    event = {"sequence": world.flower_sequence, "element_id": piece.id,
             "kind": piece.kind, "flower": index + 1, "time": world.elapsed}
    world.flower_events.append(event)
    world.flower_events = world.flower_events[-32:]
    return event


def update_elements(world, dt, robot_velocity=(0.0, 0.0)):
    """Integra peças soltas, colisões e captura enquanto MI gira para intake."""
    active = [p for p in world.elements if p.status == "field"]
    drag = math.exp(-3.0*dt)
    for piece in active:
        piece.x += piece.vx*dt
        piece.y += piece.vy*dt
        r = piece.radius
        if piece.x < r:
            piece.x, piece.vx = r, abs(piece.vx)*.25
        elif piece.x > FIELD_SIZE-r:
            piece.x, piece.vx = FIELD_SIZE-r, -abs(piece.vx)*.25
        if piece.y < r:
            piece.y, piece.vy = r, abs(piece.vy)*.25
        elif piece.y > FIELD_SIZE-r:
            piece.y, piece.vy = FIELD_SIZE-r, -abs(piece.vy)*.25
        piece.vx *= drag
        piece.vy *= drag
        speed = math.hypot(piece.vx, piece.vy)
        if speed < .015:
            piece.vx = piece.vy = 0.0

    # Colisão circular simplificada entre peças soltas (há só 40+16 objetos).
    for i, left in enumerate(active):
        for right in active[i+1:]:
            dx, dy = right.x-left.x, right.y-left.y
            distance = math.hypot(dx, dy)
            minimum = left.radius+right.radius
            if distance >= minimum:
                continue
            nx, ny = (dx/distance, dy/distance) if distance > 1e-9 else (1.0, 0.0)
            overlap = (minimum-distance)/2
            left.x -= nx*overlap
            left.y -= ny*overlap
            right.x += nx*overlap
            right.y += ny*overlap
            rel = (right.vx-left.vx)*nx+(right.vy-left.vy)*ny
            if rel < 0:
                impulse = -.55*rel/2
                left.vx -= impulse*nx
                left.vy -= impulse*ny
                right.vx += impulse*nx
                right.vy += impulse*ny

    mi = world.motors.get("MI")
    taking = bool(mi and mi.power*mi.direction > .25)
    for piece in world.elements:
        if piece.status not in ("field", "flower"):
            continue
        if taking and len(world.inventory) < world.intake_capacity and _in_intake(world, piece):
            piece.status = "robot"
            piece.location = "inventory"
            piece.vx = piece.vy = 0
            world.inventory.append(piece.id)
            world.collection_events += 1
            continue
        if piece.status == "field":
            _robot_collision(world, piece, robot_velocity)
    _try_launch(world)
