"""Regressões de partida: física sem callbacks do navegador, IDs e carga."""
import json
import math
from pathlib import Path
import subprocess
import unittest

from elements import update_elements, resolve_launch
from hive import CELLS, impact_on_cell, cell_load
from server import Session

ROOT = Path(__file__).resolve().parents[1]


def aimed_session(yaw=0):
    session = Session({'yaw': yaw, 'timer-enabled': False,
                       'launcher': {'shot-mode': 'speed', 'speed': 5}})
    w = session.world
    dx = .1125*math.cos(w.yaw)-.225*math.sin(w.yaw)
    dy = .1125*math.sin(w.yaw)+.225*math.cos(w.yaw)
    origin = (w.x+dx, w.y+dy)
    cell = CELLS['red-lower']
    tx, ty = cell['x']+cell['w']/2, cell['y']+cell['h']/2
    distance = math.hypot(tx-origin[0], ty-origin[1])
    # Solução independente: z=z0+d*tan(theta)-g*d²/(2*v²*cos²(theta)).
    height = 1.1165+.52*math.sin(math.radians(34))+.312*math.cos(math.radians(34))
    angle = math.radians(78)
    speed = math.sqrt(9.81*distance**2/(2*math.cos(angle)**2*(.3+distance*math.tan(angle)-height)))
    w.launcher.update(speed=speed, azimuth=math.degrees(math.atan2(-(tx-origin[0]),ty-origin[1]))-yaw)
    return session


def advance(session, seconds):
    for _ in range(round(seconds/.01)):
        session.world.step(.01)
        session.rules.update_hives(session.world)


class HiveCycleTests(unittest.TestCase):
    def assert_conserved(self, w):
        self.assertEqual(len(w.elements), 56)
        self.assertEqual(len({p.id for p in w.elements}), 56)
        self.assertEqual(sum(p.kind == 'POLLEN' for p in w.elements), 40)
        self.assertEqual(sum(p.kind == 'NECTAR' for p in w.elements), 16)
        self.assertEqual(set(w.inventory), {p.id for p in w.elements if p.status == 'robot'})
        self.assertEqual(len(w.inventory), len(set(w.inventory)))

    def test_four_real_shots_plus_three_nectar_tip_release_and_recapture(self):
        s = aimed_session(); w = s.world
        initial = set(w.inventory)
        nectar = {p.id for p in w.elements if p.location == 'red-lower'}
        self.assertEqual(cell_load(w, 'red-lower')['load'], 4)
        w.motors['MI'].power = w.motors['MS'].power = 1
        saw_falling = False
        saw_stock = set()
        for _ in range(600):
            advance(s, .01)
            saw_stock.add(len(w.inventory))
            self.assert_conserved(w)
            if s.rules.hive_tips['red']:
                falling = {p.id for p in w.elements if p.status == 'falling'}
                self.assertEqual(falling, initial | nectar)
                saw_falling = True
                break
        self.assertTrue(saw_falling)
        self.assertEqual(saw_stock, {0,1,2,3,4})
        self.assertEqual(w.launch_count, 4)
        self.assertEqual(s.rules.hive_tips['red'], 1)
        self.assertEqual(w.hive_active_cells['red'], 'red-upper')
        self.assertEqual(s.rules.available_nectar('red', 100), 1)
        self.assertEqual(sum(p.status == 'reserved' and p.kind == 'NECTAR' for p in w.elements), 10)
        self.assertEqual(s.rules.score_snapshot(w)['by_alliance']['red']['hive_elements'], 0)
        self.assertEqual(s.rules.score_snapshot(w)['by_alliance']['red']['hive_tips'], 20)
        # Não se cria quinto tiro vazio e todos os sete objetos chegam ao piso.
        w.motors['MI'].power = w.motors['MS'].power = 0
        advance(s, 1)
        self.assertTrue(all(p.status == 'field' for p in w.elements if p.id in initial | nectar))
        picked = next(p for p in w.elements if p.id in nectar)
        # Aproximar o robô da peça caída; a captura continua pelo MI físico.
        w.x, w.y, w.yaw = picked.x, picked.y-w.length/2-.1, 0
        w.motors['MI'].power = 1
        advance(s, .01)
        self.assertIn(picked.id, w.inventory)
        self.assertEqual(picked.status, 'robot')
        self.assertEqual(sum(p.id == picked.id for p in w.elements), 1)
        self.assert_conserved(w)
        with self.assertRaises(ValueError):
            resolve_launch(w, next(iter(initial)), 1, 'scored', 1.4, 1.5)
        # A coleta da peça liberada não consome o NECTAR reservado do Human Player.
        self.assertEqual(s.rules.available_nectar('red', 100), 1)

    def test_yaw_in_radians_matches_independent_horizontal_motion(self):
        s = Session({'yaw': 90, 'launcher': {'shot-mode': 'speed', 'speed': 5, 'azimuth': 0}})
        w=s.world; w.motors['MI'].power=w.motors['MS'].power=1
        advance(s, .81)
        event=w.launches[0];piece=next(p for p in w.elements if p.id==event['piece_id'])
        w.motors['MI'].power=w.motors['MS'].power=0
        advance(s, .1)
        t=w.elapsed-event['time']
        self.assertAlmostEqual(piece.x, event['x']-5*math.cos(math.radians(78))*t)
        self.assertAlmostEqual(piece.y, event['y'])

    def test_backend_and_js_ballistic_geometry_agree(self):
        for yaw in [0, 45, 90, -60]:
            s=aimed_session(yaw);w=s.world
            w.motors['MI'].power=w.motors['MS'].power=1
            advance(s, .81); event=w.launches[0]
            hit=impact_on_cell(event,'red-lower',.0355)
            self.assertIsNotNone(hit)
            script="""import {hiveShotImpact} from './web/model.mjs';
import {hiveCellById} from './web/arena.mjs';
const e=JSON.parse(process.argv[1]);
console.log(JSON.stringify(hiveShotImpact({...e,origin:[e.x,e.y],hiveAngle:-34},hiveCellById('red-lower'))));"""
            result=subprocess.run(['node','--input-type=module','-e',script,json.dumps(event)],cwd=ROOT,text=True,capture_output=True,check=True)
            js=json.loads(result.stdout)
            self.assertTrue(js['hit'])
            for key in ['time','x','y','height']:
                self.assertAlmostEqual(hit[key],js[key],places=9)

    def test_nectar_weight_changes_load_and_empty_cell_threshold_is_configurable(self):
        s=Session({'hive-nectar-load':2,'hive-tip-load':7})
        w=s.world
        self.assertEqual(cell_load(w,'red-lower')['load'],6)
        s.rules.update_hives(w)
        self.assertEqual(s.rules.hive_tips['red'],0)
        piece_id=w.inventory.pop()
        p=next(p for p in w.elements if p.id==piece_id)
        p.status,p.score_zone='scored','red-lower'
        s.rules.update_hives(w)
        self.assertEqual(s.rules.hive_tips['red'],1)
        self.assert_conserved(w)
        for bad in [0, float('nan'), 101]:
            with self.assertRaises(ValueError): Session({'hive-tip-load':bad})

    def test_served_teleop_matches_source_and_uses_real_sdk_motors(self):
        source=(ROOT/'examples/TeleOpDemo.java').read_text()
        self.assertEqual(json.loads((ROOT/'examples.json').read_text())['TeleOp · gamepad / teclado'],source)
        for token in ['"MI"','"MS"','gamepad1.left_bumper','gamepad1.right_bumper','MI.setPower(0)','MS.setPower(0)']:
            self.assertIn(token,source)

if __name__=='__main__': unittest.main()
