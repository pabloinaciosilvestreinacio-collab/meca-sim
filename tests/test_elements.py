import unittest

from elements import inventory_counts, starting_elements, starting_inventory, update_elements, deposit_to_flower
from server import Session
from physics import World


class ElementSimulationTests(unittest.TestCase):
    def test_official_starting_counts_and_states(self):
        pieces = starting_elements("red")
        self.assertEqual(sum(piece.kind == "POLLEN" for piece in pieces), 40)
        self.assertEqual(sum(piece.kind == "NECTAR" for piece in pieces), 16)
        self.assertEqual(sum(piece.status == "flower" for piece in pieces), 16)
        self.assertEqual(sum(piece.status == "hive" for piece in pieces), 6)
        self.assertEqual(sum(piece.status == "reserved" and piece.kind == "NECTAR" for piece in pieces), 10)
        stock = starting_inventory(pieces)
        self.assertEqual(inventory_counts(pieces, stock), {"POLLEN": 4, "NECTAR": 0})

    def test_intake_collects_only_when_mi_is_forward_and_region_overlaps(self):
        world = World()
        world.inventory = []
        piece = next(item for item in world.elements if item.status == "field")
        piece.x, piece.y = world.x, world.y + world.length/2 + .10
        world.motors["MI"].power = 1
        update_elements(world, .01)
        self.assertEqual(piece.status, "robot")
        self.assertIn(piece.id, world.inventory)
        self.assertEqual(world.collection_events, 1)

    def test_full_capacity_does_not_capture_piece(self):
        world = World()
        world.inventory = starting_inventory(world.elements)
        piece = next(item for item in world.elements if item.status == "field")
        piece.x, piece.y = world.x, world.y + world.length/2 + .10
        world.motors["MI"].power = 1
        update_elements(world, .01)
        self.assertEqual(piece.status, "field")
        self.assertEqual(len(world.inventory), 4)

    def test_side_contact_pushes_piece_instead_of_collecting_or_erasing(self):
        world = World()
        world.inventory = []
        piece = next(item for item in world.elements if item.status == "field")
        piece.x, piece.y = world.x + world.width/2 + .02, world.y
        world.motors["MI"].power = 1
        update_elements(world, .01)
        self.assertEqual(piece.status, "field")
        self.assertAlmostEqual(piece.x, world.x + world.width/2 + piece.radius, places=6)

    def test_field_piece_bounces_from_wall_and_damps(self):
        world = World()
        piece = next(item for item in world.elements if item.status == "field")
        piece.x, piece.y, piece.vx = .02, 1.0, -1.0
        update_elements(world, .01)
        self.assertAlmostEqual(piece.x, piece.radius)
        self.assertGreater(piece.vx, 0)
        self.assertLess(piece.vx, 1.0)

    def test_free_piece_pair_collision_resolves_overlap(self):
        world = World()
        a, b = [item for item in world.elements if item.status == "field"][:2]
        a.x, a.y, b.x, b.y = 1.0, 1.0, 1.05, 1.0
        update_elements(world, .01)
        self.assertGreaterEqual(((b.x-a.x)**2+(b.y-a.y)**2)**.5, a.radius+b.radius-1e-9)


    def test_flower_deposit_consumes_inventory_and_records_sequence(self):
        world = World(x=.45, y=1.82)
        world.inventory = starting_inventory(world.elements)
        first = deposit_to_flower(world)
        second = deposit_to_flower(world)
        self.assertEqual((first["sequence"], first["kind"], first["flower"]), (1, "POLLEN", 1))
        self.assertEqual(second["sequence"], 2)
        self.assertEqual(len(world.inventory), 2)
        self.assertEqual(world.flower_events[-1]["element_id"], second["element_id"])
        deposited = next(piece for piece in world.elements if piece.id == first["element_id"])
        self.assertEqual((deposited.status, deposited.location), ("flower", "flower-0"))

    def test_flower_deposit_requires_inventory_and_proximity(self):
        world = World(x=1.83, y=.65)
        world.inventory = []
        self.assertIsNone(deposit_to_flower(world))
        world.inventory = starting_inventory(world.elements)
        before = list(world.inventory)
        self.assertIsNone(deposit_to_flower(world))
        self.assertEqual(world.inventory, before)
        self.assertEqual(world.flower_events, [])

    def test_opmode_servo_edge_triggers_one_flower_deposit(self):
        session = Session({"x": .45, "y": 1.82, "flower-servo-name": "deposit"})
        session.started = True
        session.status = "executando"
        session.rpc("servo", "deposit", "set", .8)
        self.assertEqual(len(session.world.flower_events), 1)
        session.rpc("servo", "deposit", "set", 1.0)
        self.assertEqual(len(session.world.flower_events), 1)
        session.rpc("servo", "deposit", "set", .2)
        session.rpc("servo", "deposit", "set", .8)
        self.assertEqual(len(session.world.flower_events), 2)

    def test_flower_servo_does_not_deposit_when_opmode_is_not_running(self):
        session = Session({"x": .45, "y": 1.82, "flower-servo-name": "deposit"})
        session.rpc("servo", "deposit", "set", .8)
        self.assertEqual(session.world.flower_events, [])
        self.assertEqual(len(session.world.inventory), 4)

    def test_ms_and_mi_consume_one_piece_per_feed_interval(self):
        world = World()
        world.inventory = starting_inventory(world.elements)
        world.motors["MS"].power = world.motors["MI"].power = 1
        world.elapsed = .8
        update_elements(world, .01)
        self.assertEqual(world.launch_count, 1)
        self.assertEqual(len(world.inventory), 3)
        self.assertEqual(world.launches[-1]["kind"], "POLLEN")
        self.assertEqual(world.launches[-1]["hive"], "red-lower")
        world.elapsed = 1.59
        update_elements(world, .01)
        self.assertEqual(world.launch_count, 1)
        world.elapsed = 1.6
        update_elements(world, .01)
        self.assertEqual(world.launch_count, 2)
        self.assertEqual(len(world.inventory), 2)

    def test_empty_inventory_never_creates_launch(self):
        world = World()
        world.inventory = []
        world.motors["MS"].power = world.motors["MI"].power = 1
        world.elapsed = .8
        update_elements(world, .01)
        self.assertEqual(world.launches, [])
        self.assertEqual(world.launch_count, 0)
        self.assertEqual(world.empty_feed_attempts, 1)


if __name__ == "__main__":
    unittest.main()
