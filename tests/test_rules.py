import unittest
from types import SimpleNamespace

from elements import FLOWERS, starting_elements
from rules import BioBuzzRules
from server import Session


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
        self.assertEqual(first_piece.status, "field")
        self.assertEqual(first_piece.location, "loading-zone-red")
        with self.assertRaisesRegex(ValueError, "Nenhum NECTAR disponível"):
            session.introduce_nectar()
        session.world.elapsed = 61
        self.assertEqual(session.match_remaining_seconds(), 59)
        for _ in range(4):
            session.introduce_nectar()
        self.assertEqual(session.rules.nectar_entered["red"], 5)

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


if __name__ == "__main__":
    unittest.main()
