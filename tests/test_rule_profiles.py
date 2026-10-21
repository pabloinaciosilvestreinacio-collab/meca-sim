"""Perfis e relógio de regras: decisões normativas não substituem a física."""
import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from elements import FLOWERS, update_elements
from rules import RULE_FLAGS
from server import App, Session, handler_for


def running(**settings):
    session = Session({'match-mode': 'teleop', **settings})
    session.started, session.status = True, 'executando'
    return session


def deposit_nectar(session, index=0):
    # Fixture explícita para testar apenas servo -> regras -> estado/pontos.
    for piece in session.world.elements:
        if piece.status == 'robot':
            piece.status, piece.location = 'reserved', 'test-preload'
    piece = next(p for p in session.world.elements if p.id == f'nectar-alliance-red-{index}')
    piece.status, piece.location = 'robot', 'inventory'
    session.world.inventory = [piece.id]
    session.world.x, session.world.y = FLOWERS[0]
    session.rpc('servo', 'flower', 'set', .5)
    session.rpc('servo', 'flower', 'set', .8)
    return piece


class RuleProfileTests(unittest.TestCase):
    def test_official_ignores_custom_flags_and_unknown_values_fail_closed(self):
        s = Session({'rules-mode': 'official', **{'rule-'+key: False for key in RULE_FLAGS}})
        self.assertTrue(all(s.rules.config[key] for key in RULE_FLAGS))
        for settings in ({'rules-mode': 'typo'}, {'rule-penalties': 'false'},
                         {'rule-g410': 0}, {'manual-phase': 'transition'}, {'timer-enabled': 'false'}):
            with self.subTest(settings=settings), self.assertRaises(ValueError):
                Session(settings)

    def test_free_time_never_advances_phase_or_invents_remaining_time(self):
        for phase in ('auto', 'teleop'):
            s = running(**{'timer-enabled': False, 'manual-phase': phase})
            for elapsed in (0, 60, 120, 3600):
                s.world.elapsed = elapsed
                r = s.snapshot()['rules']
                self.assertEqual(r['phase'], phase)
                self.assertEqual(r['phase_source'], 'manual')
                self.assertIsNone(r['remaining_seconds'])
                self.assertFalse(r['endgame_unlocked'])
                self.assertEqual(r['nectar_available'], 0)

    def test_timed_boundary_and_manual_override_rejection(self):
        s = running()
        for elapsed, phase in ((59.999, 'teleop'), (60, 'endgame'), (61, 'endgame')):
            s.world.elapsed = elapsed
            self.assertEqual(s.match_phase(), phase)
        with self.assertRaisesRegex(ValueError, 'cronômetro'):
            s.set_manual_phase('auto')
        auto = running(**{'match-mode': 'auto'})
        auto.world.elapsed = 30
        self.assertEqual(auto.match_phase(), 'auto')
        self.assertEqual(auto.snapshot()['rules']['nectar_available'], 0)

    def test_manual_phase_changes_preserve_world_clock_inventory_and_program(self):
        s = running(**{'timer-enabled': False})
        s.world.elapsed, s.clock = 900, 902
        s.world.motors['ME'].power = .3
        before = s.world.snapshot()
        token = object(); s.process = token
        s.set_manual_phase('endgame')
        self.assertEqual(s.world.snapshot(), before)
        self.assertIs(s.process, token)
        self.assertEqual((s.clock, s.status, s.started), (902, 'executando', True))
        self.assertEqual(s.snapshot()['rules']['nectar_available'], 5)
        s.set_manual_phase('teleop')
        self.assertEqual(s.snapshot()['rules']['nectar_available'], 0)
        self.assertEqual([e['phase'] for e in s.rules.events], ['endgame', 'teleop'])
        with self.assertRaises(ValueError): s.set_manual_phase('invalid')
        s.process = None; s.stop()
        with self.assertRaises(ValueError): s.set_manual_phase('endgame')

    def test_returning_to_early_phase_never_recalls_released_nectar(self):
        s = running(**{'timer-enabled': False})
        ids = {p.id for p in s.world.elements}
        s.set_manual_phase('endgame'); event = s.introduce_nectar()
        s.set_manual_phase('auto')
        s.world.elapsed = 1; update_elements(s.world, .01)
        piece = next(p for p in s.world.elements if p.id == event['element_id'])
        self.assertEqual(piece.status, 'field')
        self.assertEqual(s.rules.nectar_entered['red'], 1)
        self.assertEqual({p.id for p in s.world.elements}, ids)
        with self.assertRaises(ValueError): s.introduce_nectar()

    def test_disabled_g426_releases_only_existing_five_reserves(self):
        s = running(**{'rules-mode': 'custom', 'rule-nectar-release': False})
        for _ in range(5): s.introduce_nectar()
        with self.assertRaises(ValueError): s.introduce_nectar()
        self.assertEqual(len({p.id for p in s.world.elements}), 56)
        self.assertEqual(sum(p.status == 'entering' for p in s.world.elements), 5)
        self.assertEqual(sum(p.status == 'hive' and p.kind == 'NECTAR' for p in s.world.elements), 6)
        self.assertEqual(sum(p.status == 'reserved' and p.kind == 'NECTAR' for p in s.world.elements), 5)

    def test_penalty_switches_do_not_disable_g426(self):
        for flag in ('penalties', 'g410'):
            s = running(**{'rules-mode': 'custom', 'rule-'+flag: False})
            self.assertEqual(s.snapshot()['rules']['nectar_available'], 0)
            with self.assertRaises(ValueError): s.introduce_nectar()

    def test_g410_switches_preserve_physical_deposit_and_flower_score(self):
        for settings, expected in (({}, 20), ({'rule-penalties': False}, 0), ({'rule-g410': False}, 0)):
            s = running(**{'rules-mode': 'custom', **settings})
            s.world.elapsed = 10
            piece = deposit_nectar(s)
            self.assertEqual((piece.status, piece.location), ('deposited', 'flower-0'))
            self.assertEqual(s.world.inventory, [])
            score = s.snapshot()['scoring']['by_alliance']
            self.assertEqual(score['red']['flowers'], 2)
            self.assertEqual(score['red']['bottom_nectar_bonus'], 5)
            self.assertEqual(score['blue']['penalties_received'], expected)
            self.assertEqual(s.rules.penalty_count, int(expected > 0))

    def test_manual_endgame_controls_g410_without_changing_elapsed(self):
        s = running(**{'timer-enabled': False, 'manual-phase': 'endgame'})
        deposit_nectar(s)
        self.assertEqual(s.rules.penalty_count, 0)
        s.set_manual_phase('teleop'); deposit_nectar(s, 1)
        self.assertEqual(s.rules.penalty_count, 1)
        self.assertEqual(s.world.elapsed, 0)

    def test_score_groups_do_not_stop_hive_tip_release_or_deposit(self):
        s = running(**{'rules-mode': 'custom', 'rule-score-hive': False,
                       'rule-score-flower': False, 'rule-score-garden': False})
        piece = deposit_nectar(s)
        s.world.hive_tip_load = 4  # Test fixture: three initial NECTAR already meet training load.
        s.rules.update_hives(s.world)
        self.assertEqual(s.rules.hive_tips, {'red': 1, 'blue': 1})
        self.assertEqual(sum(p.status == 'falling' for p in s.world.elements), 6)
        self.assertEqual(piece.status, 'deposited')
        score = s.snapshot()['scoring']['by_alliance']
        for values in score.values():
            for category in ('hive_tips', 'hive_elements', 'flowers', 'bottom_nectar_bonus', 'gardens'):
                self.assertEqual(values[category], 0)
        self.assertEqual(score['blue']['total'], 20)  # Penalidade independente da pontuação de elementos.
        self.assertEqual(len({p.id for p in s.world.elements}), 56)

    def test_extended_free_training_does_not_lose_foul_points_when_log_rolls(self):
        s = running(**{'timer-enabled': False})
        for i in range(105):
            s.rules.record_flower_deposit({'kind': 'NECTAR', 'time': i}, None, 'red', endgame=False)
        self.assertEqual(len(s.rules.penalties), 100)
        self.assertEqual(s.snapshot()['rules']['penalty_count'], 105)
        self.assertEqual(s.snapshot()['scoring']['by_alliance']['blue']['penalties_received'], 2100)

    def test_phase_endpoint_validates_runtime_state_and_returns_recorded_event(self):
        app = App(); app.session = running(**{'timer-enabled': False})
        httpd = ThreadingHTTPServer(('127.0.0.1', 0), handler_for(app))
        thread = threading.Thread(target=httpd.serve_forever, daemon=True); thread.start()
        def post(phase):
            request = Request(f'http://127.0.0.1:{httpd.server_port}/api/rules',
                              data=json.dumps({'action': 'set_phase', 'phase': phase}).encode(),
                              headers={'Content-Type': 'application/json', 'X-Sim-Token': app.token})
            with urlopen(request) as response: return json.load(response)
        try:
            result = post('endgame')
            self.assertEqual(result['event'], app.session.rules.events[-1])
            with self.assertRaises(HTTPError) as error: post('typo')
            self.assertEqual(error.exception.code, 400)
            self.assertEqual(app.session.manual_phase, 'endgame')
        finally:
            httpd.shutdown(); httpd.server_close(); thread.join(2)


if __name__ == '__main__': unittest.main()
