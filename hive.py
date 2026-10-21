"""Geometria balística compartilhada com o corte 2D em web/arena.mjs.

Carga é uma calibração de treino, NÃO massa/limiar oficial FIRST.
Calibração padrão: 3 NECTAR + 4 POLLEN; alterável para treino.
"""
import math

CELL_X = (3.66 - 1.2565)/2
CELL_Y = (3.66 - .9895)/2
CELLS = {f'{team}-{end}': {'x': CELL_X+x, 'y': CELL_Y+y, 'w': .52, 'h': .32}
         for team, x in [('red', .065), ('blue', .68)]
         for end, y in [('lower', .105), ('upper', .575)]}
DEFAULT_NECTAR_LOAD = 4/3
DEFAULT_TIP_LOAD = 8.0


def impact_on_cell(event, cell_id, radius):
    cell = CELLS[cell_id]
    # A CELL avaliada está voltada para cima.
    angle = math.radians(-34 if cell_id.endswith('lower') else 34)
    sign = -1 if cell_id.endswith('lower') else 1
    opening = 1.1165 + sign*.52*math.sin(angle) + .312*math.cos(angle)
    direction = math.radians(event['yaw'] + event['azimuth'])
    dx, dy = -math.sin(direction), math.cos(direction)
    rx = cell['x'] + cell['w']/2 - event['x']
    ry = cell['y'] + cell['h']/2 - event['y']
    distance, cross = rx*dx+ry*dy, abs(rx*dy-ry*dx)
    if distance <= 0 or cross >= .508/2-radius:
        return None
    elevation = math.radians(event['elevation'])
    vx, vy = event['speed']*math.cos(elevation), event['speed']*math.sin(elevation)
    slope = math.tan(angle)
    relative = vy-vx*slope
    discriminant = relative**2-2*9.81*(opening-slope*distance-event['height'])
    if discriminant < 0:
        return None
    t = (relative+math.sqrt(discriminant))/9.81
    ground_time = (vy+math.sqrt(vy*vy+2*9.81*event['height']))/9.81
    forward = vx*t
    if (t <= 0 or t > ground_time or abs(forward-distance) >= .305/2-radius
            or vy-9.81*t >= 0 or relative-9.81*t >= 0):
        return None
    return {'time': t, 'x': event['x']+dx*forward, 'y': event['y']+dy*forward,
            'height': event['height']+vy*t-4.905*t*t, 'cell_id': cell_id}


def first_impact(event, active_cells, radius):
    hits = [impact_on_cell(event, cell, radius) for cell in active_cells.values()]
    return min((hit for hit in hits if hit), key=lambda hit: hit['time'], default=None)


def cell_contents(world, cell_id):
    return [p for p in world.elements if p.status in ('hive', 'scored')
            and (p.score_zone or p.location) == cell_id]


def cell_load(world, cell_id):
    pieces = cell_contents(world, cell_id)
    pollen = sum(p.kind == 'POLLEN' for p in pieces)
    nectar = sum(p.kind == 'NECTAR' for p in pieces)
    return {'POLLEN': pollen, 'NECTAR': nectar,
            'load': pollen + nectar*world.hive_nectar_load,
            'threshold': world.hive_tip_load, 'cell_id': cell_id}
