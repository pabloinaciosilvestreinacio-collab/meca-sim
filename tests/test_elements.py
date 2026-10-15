import unittest

from elements import inventory_counts, starting_elements, starting_inventory, update_elements
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


if __name__ == "__main__":
    unittest.main()
