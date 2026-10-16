import unittest
import math
import json
import threading
from http.server import ThreadingHTTPServer
from urllib.request import Request, urlopen

from elements import inventory_counts, starting_elements, starting_inventory, update_elements, deposit_to_flower, resolve_launch
from server import App, Session, handler_for
from physics import World
from rules import BioBuzzRules


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
        self.assertEqual((deposited.status, deposited.location), ("deposited", "flower-0"))

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
        launched = next(piece for piece in world.elements if piece.id == world.launches[-1]["piece_id"])
        self.assertEqual((launched.status, launched.location), ("launched", "projectile"))
        self.assertAlmostEqual(launched.x, world.launches[-1]["x"])
        self.assertAlmostEqual(launched.y, world.launches[-1]["y"])
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

    def test_preload_ids_are_renderable_inventory_elements(self):
        world = World()
        world.inventory = starting_inventory(world.elements)
        preload_ids = [piece.id for piece in world.elements if piece.status == "robot"]
        self.assertEqual(len(preload_ids), 4)
        self.assertEqual(set(preload_ids), set(world.inventory))
        self.assertEqual(set(world.snapshot()["inventory_ids"]), set(preload_ids))
        self.assertTrue(all(next(p for p in world.elements if p.id == piece_id).x == -1 for piece_id in preload_ids))

    def test_same_pollen_id_moves_inventory_to_shooter_flight_and_scored_state(self):
        world = World()
        # Libera o teste de ciclo completo, mantendo os quatro elementos
        # preloaded rastreados em estado reservado.
        for item in world.elements:
            if item.status == "robot":
                item.status, item.location = "reserved", "test-preload"
        world.inventory = []
        captured = next(item for item in world.elements if item.status == "field")
        captured.x, captured.y = world.x, world.y + world.length/2 + .10
        world.motors["MI"].power = 1
        update_elements(world, .01)
        launched_id = captured.id
        self.assertEqual((captured.status, captured.location), ("robot", "inventory"))
        self.assertEqual(world.inventory, [launched_id])

        world.motors["MS"].power = world.motors["MI"].power = 1
        world.elapsed = .8
        update_elements(world, .01)
        piece = next(item for item in world.elements if item.id == launched_id)
        self.assertNotIn(launched_id, world.inventory)
        self.assertEqual((piece.status, piece.location, piece.launch_id), ("launched", "projectile", 1))
        self.assertEqual(sum(item.id == launched_id for item in world.elements), 1)
        origin = (world.x + .1125, world.y + .225)
        self.assertAlmostEqual(piece.x, origin[0])
        self.assertAlmostEqual(piece.y, origin[1])
        with self.assertRaisesRegex(ValueError, "não corresponde"):
            resolve_launch(world, launched_id, 0, "scored", 1.2, 1.3)
        self.assertEqual(piece.status, "launched")

        # Solução cinemática independente para t=0,1 s: x/y seguem a velocidade
        # horizontal e z usa z0 + v*sin(a)*t - g*t²/2.
        world.elapsed += .1
        update_elements(world, .1)
        angle = math.radians(78)
        speed = 5.0
        expected_distance = speed * math.cos(angle) * .1
        self.assertAlmostEqual(piece.x, origin[0], places=6)
        self.assertAlmostEqual(piece.y, origin[1] + expected_distance, places=6)
        self.assertAlmostEqual(piece.flight["z"], .30 + speed*math.sin(angle)*.1 - 9.81*.1**2/2, places=6)

        result = resolve_launch(world, launched_id, 1, "scored", 1.2, 1.3)
        self.assertTrue(result["changed"])
        self.assertEqual((piece.status, piece.location, piece.x, piece.y), ("scored", "hive", 1.2, 1.3))
        self.assertIsNone(piece.flight)
        self.assertFalse(resolve_launch(world, launched_id, 1, "scored", 1.2, 1.3)["changed"])
        self.assertEqual(sum(item.kind == "POLLEN" for item in world.elements), 40)
        self.assertEqual(len({item.id for item in world.elements}), len(world.elements))

    def test_nectar_launch_keeps_identity_and_counts_in_hive_cell(self):
        world = World()
        nectar = next(item for item in world.elements
                      if item.id == "nectar-alliance-red-0")
        nectar.status, nectar.location = "robot", "inventory"
        world.inventory = [nectar.id]
        world.motors["MS"].power = world.motors["MI"].power = 1
        world.elapsed = .8
        update_elements(world, .01)
        self.assertEqual((nectar.status, nectar.location), ("launched", "projectile"))
        result = resolve_launch(world, nectar.id, 1, "scored", 1.4, 1.5)
        self.assertEqual(result["status"], "scored")
        self.assertEqual(nectar.score_zone, "red-lower")
        self.assertEqual(sum(item.id == nectar.id for item in world.elements), 1)

        score = BioBuzzRules("red").score_snapshot(world)["by_alliance"]
        # Três NECTAR iniciais mais o NECTAR lançado permanecem na CELL ativa.
        self.assertEqual(score["red"]["hive_elements"], 8)

    def test_missed_projectile_returns_to_field_as_the_same_element(self):
        world = World()
        world.inventory = starting_inventory(world.elements)
        piece_id = world.inventory[0]
        world.motors["MS"].power = world.motors["MI"].power = 1
        world.elapsed = .8
        update_elements(world, .01)
        piece = next(item for item in world.elements if item.id == piece_id)
        world.elapsed += 1.2
        update_elements(world, 1.2)
        self.assertEqual((piece.status, piece.location), ("field", "field"))
        self.assertGreaterEqual(piece.x, piece.radius)
        self.assertLessEqual(piece.x, world.field_size-piece.radius)
        self.assertIsNone(piece.flight)
        # A previsão do HIVE pode finalizar no polling após o instante de pouso;
        # o mesmo ID segue resolvível sem criar um segundo objeto.
        late_result = resolve_launch(world, piece_id, 1, "scored", 1.2, 1.3)
        self.assertTrue(late_result["changed"])
        self.assertEqual((piece.status, piece.location), ("scored", "hive"))


class ElementResultHttpTests(unittest.TestCase):
    def test_scoring_endpoint_resolves_the_launched_element_id(self):
        app = App()
        app.session = Session()
        world = app.session.world
        piece_id = world.inventory[0]
        world.motors["MS"].power = world.motors["MI"].power = 1
        world.elapsed = .8
        update_elements(world, .01)
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler_for(app))
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            body = json.dumps({"element_id": piece_id, "launch_id": 1, "result": "scored", "x": 1.2, "y": 1.3}).encode()
            request = Request(f"http://127.0.0.1:{httpd.server_port}/api/element-result", data=body,
                              headers={"Content-Type": "application/json", "X-Sim-Token": app.token})
            with urlopen(request) as response:
                result = json.loads(response.read())
            self.assertEqual(result, {"element_id": piece_id, "status": "scored", "changed": True})
            piece = next(item for item in world.elements if item.id == piece_id)
            self.assertEqual((piece.status, piece.location), ("scored", "hive"))
            self.assertNotIn(piece_id, world.inventory)
        finally:
            httpd.shutdown()
            httpd.server_close()
            thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
