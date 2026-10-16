"""Modelo leve de peças BIOBUZZ e coleta por intake.

Posições de FIELD ELEMENTS são uma aproximação 2D dos diagramas oficiais.
Pollen em FLOWERS/HIVEs e Nectar reservado ficam como estados de estoque,
não como colisões 3D dos mecanismos reais.
"""
from dataclasses import dataclass
import math
from hive import first_impact

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
    flight: dict | None = None
    launch_id: int | None = None
    launch_result: str | None = None
    score_zone: str | None = None
    deposit_sequence: int | None = None

    def snapshot(self):
        return {"id": self.id, "kind": self.kind, "team": self.team,
                "x": self.x, "y": self.y, "status": self.status,
                "location": self.location, "radius": self.radius,
                "flight": self.flight.copy() if self.flight else None,
                "launch_id": self.launch_id, "score_zone": self.score_zone,
                "deposit_sequence": self.deposit_sequence}


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
        # Projeção completa até uma face, incluindo raio. Preferir a saída
        # mais curta que mantém a peça dentro do campo (não empurrar pela parede).
        r = piece.radius
        exits = [(hx+r, ly), (-hx-r, ly), (lx, hy+r), (lx, -hy-r)]
        candidates = []
        for ex, ey in exits:
            wx, wy = _world(ex, ey, world.yaw)
            if r <= world.x+wx <= world.field_size-r and r <= world.y+wy <= world.field_size-r:
                candidates.append((ex, ey))
        lx, ly = min(candidates or exits, key=lambda point: (point[0]-lx)**2+(point[1]-ly)**2)
    else:
        nx, ny = dx/distance, dy/distance
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
    piece.launch_result = None
    piece.status = "launched"
    piece.location = "projectile"
    piece.score_zone = None
    piece.deposit_sequence = None
    dx, dy = _world(settings["lateral"], settings["forward"], world.yaw)
    origin_x, origin_y = world.x+dx, world.y+dy
    angle = math.radians(settings["elevation"])
    direction = world.yaw + math.radians(settings["azimuth"])
    world.launch_sequence += 1
    world.launch_count += 1
    event = {
        "id": world.launch_sequence, "piece_id": piece.id, "kind": piece.kind,
        "team": piece.team, "time": world.elapsed,
        "x": origin_x, "y": origin_y, "yaw": math.degrees(world.yaw),
        "hive": settings["hive"], "lateral": settings["lateral"],
        "forward": settings["forward"], "height": settings["height"],
        "speed": settings["speed"], "elevation": settings["elevation"],
        "azimuth": settings["azimuth"]
    }
    piece.x, piece.y = origin_x, origin_y
    piece.vx = -settings["speed"] * math.cos(angle) * math.sin(direction)
    piece.vy = settings["speed"] * math.cos(angle) * math.cos(direction)
    piece.flight = {"started_at": world.elapsed, "x": origin_x, "y": origin_y,
                    "height": settings["height"], "speed": settings["speed"],
                    "elevation": settings["elevation"], "direction": direction,
                    "launch_id": world.launch_sequence}
    piece.flight["impact"] = first_impact(event, world.hive_active_cells, piece.radius) if world.arena == "biobuzz" else None
    piece.launch_id = world.launch_sequence
    world.launches.append(event)
    world.launches = world.launches[-32:]


def resolve_launch(world, element_id, launch_id, result, x=None, y=None):
    """Resolve a launched element by its stable ID; repeated results are harmless."""
    if result not in ("scored", "missed"):
        raise ValueError("Resultado de lançamento inválido")
    piece = next((item for item in world.elements if item.id == element_id), None)
    if piece is None or piece.kind not in ("POLLEN", "NECTAR") or piece.launch_id is None:
        raise ValueError("Elemento lançado não encontrado")
    if not isinstance(launch_id, int) or isinstance(launch_id, bool) or piece.launch_id != launch_id:
        raise ValueError("ID da trajetória não corresponde ao lançamento atual")
    if piece.status == "scored" or (piece.status == "field" and result == "missed"):
        return {"element_id": piece.id, "status": piece.status, "changed": False}
    if piece.status not in ("launched", "field"):
        raise ValueError("POLLEN não está em trajetória")
    if result == "scored":
        if x is None or y is None or not all(math.isfinite(v) for v in (x, y)):
            raise ValueError("Posição de pontuação inválida")
        launch = next((event for event in world.launches if event["id"] == launch_id
                       and event["piece_id"] == piece.id), None)
        if launch is None:
            raise ValueError("Registro do lançamento não encontrado")
        piece.x, piece.y = x, y
        piece.status, piece.location = "scored", "hive"
        piece.score_zone = launch.get("hive")
        launch["result"] = "scored"
        piece.vx = piece.vy = 0.0
    else:
        piece.status, piece.location = "field", "field"
    if piece.launch_result == "missed":
        world.launch_misses -= 1
    elif piece.launch_result == "scored":
        world.launch_hits -= 1
    piece.launch_result = result
    if result == "scored":
        world.launch_hits += 1
    else:
        world.launch_misses += 1
    piece.flight = None
    return {"element_id": piece.id, "status": piece.status, "changed": True}


def deposit_to_flower(world):
    """Move uma peça do inventário ao FLOWER mais próximo, se houver alcance.

    O servo escolhe a FLOWER mais próxima dentro do alcance configurado. A
    sequência persistida permite calcular dono e bônus do modelo de pontuação.
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
    piece.score_zone = piece.location
    piece.x, piece.y = x, y
    piece.vx = piece.vy = 0.0
    world.flower_sequence += 1
    piece.deposit_sequence = world.flower_sequence
    event = {"sequence": world.flower_sequence, "element_id": piece.id,
             "kind": piece.kind, "team": piece.team, "flower": index + 1,
             "time": world.elapsed}
    world.flower_events.append(event)
    world.flower_events = world.flower_events[-32:]
    return event


def update_elements(world, dt, robot_velocity=(0.0, 0.0)):
    """Integra peças soltas, colisões e captura enquanto MI gira para intake."""
    # NECTAR da Loading Zone e peças liberadas por um HIVE tipped caem antes
    # de entrar no conjunto de colisões e captura no piso.
    for piece in world.elements:
        if piece.status not in ("entering", "falling") or not piece.flight or piece.flight.get(
                "mode") not in ("human_entry", "hive_release"):
            continue
        t = max(0.0, world.elapsed - piece.flight["started_at"])
        if piece.flight.get("mode") == "hive_release":
            piece.x = piece.flight["x"] + piece.vx*t
            piece.y = piece.flight["y"] + piece.vy*t
        z = piece.flight["height"] - 4.905*t*t
        piece.flight["z"] = max(0.0, z)
        piece.flight["elapsed"] = t
        if z <= 0:
            piece.status, piece.location = "field", "field"
            piece.flight = None

    # Avance os mesmos objetos que foram retirados do inventário. A UI só os
    # desenha; não cria uma segunda peça para representar o disparo.
    for piece in world.elements:
        if piece.status != "launched" or not piece.flight:
            continue
        data = piece.flight
        t = max(0.0, world.elapsed - data["started_at"])
        angle = math.radians(data["elevation"])
        horizontal_speed = data["speed"] * math.cos(angle)
        distance = horizontal_speed * t
        piece.x = data["x"] - distance * math.sin(data["direction"])
        piece.y = data["y"] + distance * math.cos(data["direction"])
        hit = data.get("impact")
        if hit and t >= hit["time"]:
            team = hit["cell_id"].split("-")[0]
            if world.hive_active_cells[team] == hit["cell_id"]:
                launch = next(e for e in world.launches if e["id"] == piece.launch_id)
                launch["hive"] = hit["cell_id"]
                resolve_launch(world, piece.id, piece.launch_id, "scored", hit["x"], hit["y"])
                continue
            data["impact"] = None
        z = data["height"] + data["speed"] * math.sin(angle) * t - 4.905*t*t
        data["z"] = max(0.0, z)
        data["elapsed"] = t
        if z <= 0 and t > 0:
            resolve_launch(world, piece.id, piece.launch_id, "missed")
            piece.vx = -horizontal_speed * math.sin(data["direction"])
            piece.vy = horizontal_speed * math.cos(data["direction"])
            piece.x = min(FIELD_SIZE-piece.radius, max(piece.radius, piece.x))
            piece.y = min(FIELD_SIZE-piece.radius, max(piece.radius, piece.y))

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
            piece.score_zone = None
            piece.deposit_sequence = None
            piece.launch_id = None
            piece.flight = None
            world.inventory.append(piece.id)
            world.collection_events += 1
            continue
        if piece.status == "field":
            _robot_collision(world, piece, robot_velocity)
    _try_launch(world)
