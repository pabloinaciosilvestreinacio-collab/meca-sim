import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from types import SimpleNamespace
from urllib.request import Request, urlopen

from elements import FLOWERS, starting_elements
from elements import update_elements
from physics import World
from rules import BioBuzzRules
from server import App, Session, handler_for


class BioBuzzRulesTests(unittest.TestCase):
    def setUp(self):
        self.rules = BioBuzzRules("red")
        self.world = SimpleNamespace(elements=starting_elements("red"))

    def reserved_red(self):
        return [piece for piece in self.world.elements
                if piece.id.startswith("nectar-alliance-red-") and piece.status == "reserved"]

    def test_one_nectar_per_simulated_tip(self):
        self.rules.register_hive_tip("red", 12.0)
        self.assertEqual(self.rules.available_nectar("red", 100), 1)
        event = self.rules.enter_nectar("red", 100, 13.0, self.world)
        self.assertEqual(event["location"], "loading-zone-red")
        self.assertEqual(self.rules.nectar_entered["red"], 1)
        self.assertEqual(len(self.reserved_red()), 4)
        piece = next(item for item in self.world.elements if item.id == event["element_id"])
        self.assertEqual((piece.status, piece.flight["mode"]), ("entering", "human_entry"))

    def test_entry_without_tip_is_blocked_before_endgame(self):
        with self.assertRaisesRegex(ValueError, "Nenhum NECTAR disponível"):
            self.rules.enter_nectar("red", 100, 10.0, self.world)
        self.assertEqual(len(self.reserved_red()), 5)
        self.assertEqual(self.rules.events, [])

    def test_tips_cannot_unlock_more_than_five_staged_pieces(self):
        for i in range(8):
            self.rules.register_hive_tip("red", i)
        self.assertEqual(self.rules.available_nectar("red", 90), 5)
        for i in range(5):
            self.rules.enter_nectar("red", 90, i, self.world)
        self.assertEqual(self.rules.available_nectar("red", 90), 0)

    def test_last_sixty_seconds_unlock_all_remaining_nectar(self):
        self.rules.enter_nectar("red", 100, 1, self.world) if False else None
        self.assertEqual(self.rules.available_nectar("red", 60), 5)
        for i in range(5):
            self.rules.enter_nectar("red", 60, i, self.world)
        self.assertEqual(self.rules.available_nectar("red", 0), 0)
        self.assertTrue(self.rules.snapshot(60, "teleop", True)["endgame_unlocked"])

    def test_only_selected_alliance_can_enter_its_reserved_nectar(self):
        with self.assertRaisesRegex(ValueError, "aliança selecionada"):
            self.rules.enter_nectar("blue", 0, 1, self.world)
        self.assertEqual(len(self.reserved_red()), 5)

    def test_g410_records_early_nectar_but_not_pollen_or_endgame(self):
        early = {"kind": "NECTAR", "element_id": "nectar-red", "time": 20}
        penalty = self.rules.record_flower_deposit(early, 100)
        self.assertEqual(penalty["code"], "G410")
        self.assertEqual(penalty["severity"], "major_foul")
        self.assertIsNone(penalty["points_awarded"])
        self.assertIsNone(self.rules.record_flower_deposit({"kind": "POLLEN"}, 100))
        self.assertIsNone(self.rules.record_flower_deposit(early, 60))
        self.assertEqual(len(self.rules.penalties), 1)

    def test_session_uses_hive_tips_then_endgame_to_control_entries(self):
        session = Session({"alliance": "red", "match-mode": "teleop"})
        session.started, session.status = True, "executando"
        with self.assertRaisesRegex(ValueError, "Nenhum NECTAR disponível"):
            session.introduce_nectar()
        session.register_hive_tip("red")
        first = session.introduce_nectar()
        first_piece = next(piece for piece in session.world.elements if piece.id == first["element_id"])
        self.assertEqual(first_piece.status, "entering")
        self.assertEqual(first_piece.location, "loading-zone-red")
        with self.assertRaisesRegex(ValueError, "Nenhum NECTAR disponível"):
            session.introduce_nectar()
        session.world.elapsed = 61
        self.assertEqual(session.match_remaining_seconds(), 59)
        for _ in range(4):
            session.introduce_nectar()
        self.assertEqual(session.rules.nectar_entered["red"], 5)

    def test_entered_nectar_falls_then_remains_interactive_after_another_entry(self):
        world = World()
        # Libera os preloads do robô para o intake poder testar o NECTAR.
        for piece in world.elements:
            if piece.status == "robot":
                piece.status, piece.location = "reserved", "test-preload"
        world.inventory.clear()
        rules = BioBuzzRules("red")
        rules.register_hive_tip("red", 0)
        rules.register_hive_tip("red", 1)
        first = rules.enter_nectar("red", 100, 0, world)
        first_piece = next(piece for piece in world.elements if piece.id == first["element_id"])

        world.elapsed = .1
        update_elements(world, .1)
        self.assertEqual(first_piece.status, "entering")
        self.assertGreater(first_piece.flight["z"], 0)
        world.elapsed = .31
        update_elements(world, .21)
        self.assertEqual((first_piece.status, first_piece.location), ("field", "field"))
        self.assertIsNone(first_piece.flight)

        second = rules.enter_nectar("red", 100, .31, world)
        second_piece = next(piece for piece in world.elements if piece.id == second["element_id"])
        self.assertEqual(first_piece.status, "field")
        self.assertEqual(second_piece.status, "entering")
        self.assertEqual(sum(piece.kind == "NECTAR" for piece in world.elements), 16)
        self.assertEqual(len({piece.id for piece in world.elements}), len(world.elements))

        # MI coleta o ID que já estava no piso enquanto o outro NECTAR entra.
        world.x, world.y, world.yaw = first_piece.x, first_piece.y - .28, 0
        world.motors["MI"].power = 1
        update_elements(world, .01)
        self.assertEqual((first_piece.status, first_piece.location), ("robot", "inventory"))
        self.assertIn(first_piece.id, world.inventory)
        self.assertEqual(sum(piece.id == first_piece.id for piece in world.elements), 1)

    def test_session_records_g410_for_java_servo_deposit_outside_endgame(self):
        session = Session({"alliance": "red", "match-mode": "teleop"})
        session.started, session.status = True, "executando"
        nectar = next(piece for piece in session.world.elements
                      if piece.id == "nectar-alliance-red-0")
        nectar.status = "robot"
        session.world.inventory = [nectar.id]
        session.world.x, session.world.y = FLOWERS[0]
        session.rpc("servo", "flower", "set", .8)
        self.assertEqual(session.world.flower_events[-1]["kind"], "NECTAR")
        self.assertEqual(session.rules.penalties[-1]["code"], "G410")
        self.assertIsNone(session.rules.penalties[-1]["points_awarded"])
        session.rpc("servo", "flower", "set", .5)
        second = next(piece for piece in session.world.elements
                      if piece.id == "nectar-alliance-red-1")
        second.status = "robot"
        session.world.inventory = [second.id]
        session.world.elapsed = 60
        session.rpc("servo", "flower", "set", .8)
        self.assertEqual(len(session.rules.penalties), 1)


class RulesHttpTests(unittest.TestCase):
    def test_human_player_endpoint_returns_entry_event(self):
        app = App()
        session = Session({"alliance": "red", "match-mode": "teleop"})
        session.started, session.status = True, "executando"
        session.register_hive_tip("red")
        app.session = session
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler_for(app))
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            body = json.dumps({"action": "nectar_entry"}).encode()
            request = Request(f"http://127.0.0.1:{httpd.server_port}/api/rules", data=body,
                              headers={"Content-Type": "application/json",
                                       "X-Sim-Token": app.token})
            with urlopen(request) as response:
                result = json.loads(response.read())
            self.assertTrue(result["ok"])
            self.assertEqual(result["event"]["type"], "human_player_entry")
            self.assertEqual(result["event"]["location"], "loading-zone-red")
        finally:
            httpd.shutdown()
            httpd.server_close()
            thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
