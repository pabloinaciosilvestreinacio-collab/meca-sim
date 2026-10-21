"""Percurso que o jogador executa sem configurar mira nem alterar o Java."""
import math
import unittest
from elements import update_elements
from physics import World
from server import Session


class UserPathTests(unittest.TestCase):
    def test_default_teleop_shots_tip_and_physically_release_same_seven_ids(self):
        s = Session({'match-mode': 'teleop'})
        w = s.world
        preloads = set(w.inventory)
        nectar = {p.id for p in w.elements if p.status == 'hive' and p.location == 'red-lower'}
        self.assertEqual((len(preloads), len(nectar), w.intake_capacity), (4, 3, 8))
        w.motors['MI'].power = w.motors['MS'].power = 1
        for _ in range(500):
            w.step(.01); s.rules.update_hives(w)
            if s.rules.hive_tips['red']: break
        self.assertEqual(s.rules.hive_tips['red'], 1)
        self.assertEqual((w.launch_count, w.launch_hits, w.launch_misses), (4, 4, 0))
        self.assertEqual({p.id for p in w.elements if p.status == 'falling'}, preloads | nectar)
        self.assertEqual(w.inventory, [])
        w.motors['MI'].power = w.motors['MS'].power = 0
        for _ in range(70): w.step(.01); s.rules.update_hives(w)
        self.assertTrue(all(p.status == 'field' for p in w.elements if p.id in preloads | nectar))
        self.assertEqual(len({p.id for p in w.elements}), 56)

    def test_initial_legacy_miss_is_visible_without_auto_scoring(self):
        s = Session({'launcher': {'shot-mode': 'force', 'force': 8, 'azimuth': 0}})
        w = s.world
        w.motors['MI'].power = w.motors['MS'].power = 1
        for _ in range(450): w.step(.01); s.rules.update_hives(w)
        self.assertEqual((w.launch_count, w.launch_hits, s.rules.hive_tips['red']), (4, 0, 0))
        self.assertEqual(w.launch_misses, 4)
        self.assertEqual(sum(p.status == 'field' for p in w.elements if p.id.startswith('pollen-preload-red-0-')), 4)

    def test_shooter_adjustment_affects_next_shot_only_and_is_atomic(self):
        s = Session({'launcher': {'shot-mode': 'force', 'force': 8, 'azimuth': 0}})
        s.started, s.status = True, 'executando'
        w = s.world
        w.motors['MI'].power = w.motors['MS'].power = 1
        for _ in range(81): w.step(.01); s.rules.update_hives(w)
        first = next(p for p in w.elements if p.status == 'launched')
        old_flight = first.flight.copy()
        old_conf = w.launcher.copy()
        with self.assertRaisesRegex(ValueError, 'azimuth'):
            s.update_launcher({'azimuth': 500})
        self.assertEqual(w.launcher, old_conf)
        updated = s.update_launcher({'shot-mode': 'force', 'force': 7.921,
                                     'elevation': 78, 'azimuth': 29.82})
        self.assertAlmostEqual(updated['speed'], 5.558, places=2)
        self.assertEqual(first.flight, old_flight)
        for _ in range(80): w.step(.01); s.rules.update_hives(w)
        self.assertEqual((w.launch_count, w.launch_hits), (2, 0))
        self.assertEqual(w.launches[0]['azimuth'], 0)
        self.assertEqual(w.launches[1]['azimuth'], 29.82)
        for _ in range(310): w.step(.01); s.rules.update_hives(w)
        self.assertEqual((w.launch_count, w.launch_hits, w.launch_misses), (4, 3, 1))
        self.assertEqual(s.rules.hive_tips['red'], 0)  # 3 Pollen + 3 Nectar < 8 unidades de treino.
        s.stop()
        with self.assertRaisesRegex(ValueError, 'Inicialize'):
            s.update_launcher({'azimuth': 0})

    def test_flower_piece_hit_outside_intake_detaches_without_duplicate(self):
        w = World()
        w.inventory = []
        p = next(piece for piece in w.elements if piece.id == 'pollen-flower-0-0')
        original = {piece.id for piece in w.elements}
        w.x, w.y, w.yaw = p.x - w.width/2 - .02, p.y, 0
        w.motors['MI'].power = 1
        update_elements(w, .01)
        self.assertEqual((p.status, p.location), ('field', 'field'))
        self.assertEqual(len(w.inventory), 0)
        self.assertGreaterEqual(math.hypot(p.x-w.x-w.width/2, p.y-w.y), p.radius-1e-6)
        self.assertEqual({piece.id for piece in w.elements}, original)
        w.x, w.y = p.x, p.y - w.length/2 - .08
        update_elements(w, .01)
        self.assertEqual(p.status, 'robot')
        self.assertIn(p.id, w.inventory)
        self.assertTrue(all(piece.status == "robot" for piece in w.elements if piece.id in w.inventory))
        self.assertEqual(len({piece.id for piece in w.elements}), 56)


if __name__ == '__main__': unittest.main()
