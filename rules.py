"""Regras simplificadas BIOBUZZ separadas da física do campo.

A disponibilidade de NECTAR segue o fluxo de G426; o evento de tipagem do
HIVE vem do modelo didático do simulador e não é uma decisão oficial de árbitro.
"""
from __future__ import annotations

from dataclasses import dataclass
import math
from hive import cell_load, cell_contents

MAX_ALLIANCE_NECTAR = 5
ENDGAME_REMAINING_SECONDS = 60.0
ALLIANCES = ("red", "blue")
RULE_FLAGS = ("penalties", "g410", "nectar-release", "score-hive", "score-flower", "score-garden")
MANUAL_PHASES = ("auto", "teleop", "endgame")


def rule_profile(settings=None):
    """Perfil efetivo. O modo oficial nunca aceita flags personalizadas ocultas."""
    settings = settings or {}
    mode = settings.get("rules-mode", "official")
    if mode not in ("official", "custom"):
        raise ValueError("Perfil de regras deve ser official ou custom")
    flags = {}
    for name in RULE_FLAGS:
        value = settings.get("rule-" + name, True)
        if type(value) is not bool:
            raise ValueError("rule-" + name + " deve ser booleano")
        flags[name] = True if mode == "official" else value
    return {"mode": mode, **flags}


def in_endgame(remaining_seconds, endgame=None):
    if endgame is not None:
        return bool(endgame)
    return remaining_seconds is not None and remaining_seconds <= ENDGAME_REMAINING_SECONDS

FIELD_SIZE = 3.66
HIVE_CELLS = {"red": {"lower": "red-lower", "upper": "red-upper"},
              "blue": {"lower": "blue-lower", "upper": "blue-upper"}}
# Coordenadas esquemáticas alinhadas às zonas desenhadas em web/arena.mjs.
GARDEN_ZONES = {
    "red": ((0.0, 2.43, .29, .62), (0.0, 0.0, .584, .051)),
    "blue": ((FIELD_SIZE-.28, .6, .28, .62),
             (FIELD_SIZE-.584, FIELD_SIZE-.051, .584, .051)),
}


@dataclass
class BioBuzzRules:
    alliance: str = "red"
    settings: dict | None = None

    def __post_init__(self):
        if self.alliance not in ALLIANCES:
            raise ValueError("Aliança deve ser red ou blue")
        self.config = rule_profile(self.settings)
        self.hive_tips = {"red": 0, "blue": 0}
        self.nectar_entered = {"red": 0, "blue": 0}
        self.events = []
        self.penalties = []
        self.penalty_count = 0
        self.penalty_points = {team: 0 for team in ALLIANCES}

    def register_hive_tip(self, team, elapsed, world=None, cell_id=None):
        if team not in ALLIANCES:
            raise ValueError("Aliança do HIVE inválida")
        expected = self.active_hive_cell(team)
        if cell_id is not None and cell_id != expected:
            raise ValueError("O TIP não corresponde à CELL atualmente voltada para cima")
        cell_id = expected
        self.hive_tips[team] += 1
        # A CELL que estava para cima passa a apontar para baixo; as peças que
        # ficaram nela são liberadas como os mesmos objetos, em queda até o piso.
        if world is not None:
            world.hive_active_cells[team] = self.active_hive_cell(team)
            for index, piece in enumerate(cell_contents(world, cell_id)):
                piece.status, piece.location = "falling", "hive-release"
                piece.launch_id = None
                piece.vx = ((index % 3)-1)*.24
                piece.vy = -.45 if cell_id.endswith("lower") else .45
                piece.flight = {"mode": "hive_release", "started_at": float(elapsed),
                                "height": .75, "z": .75, "cell_id": cell_id,
                                "x": piece.x, "y": piece.y}
        event = {"type": "hive_tip", "team": team, "cell_id": cell_id,
                 "time": round(float(elapsed), 3),
                 "source": "simulated_hive_tip"}
        self._append(self.events, event)
        return event

    def update_hives(self, world):
        if world.arena != "biobuzz":
            return
        for team in ALLIANCES:
            cell_id = self.active_hive_cell(team)
            if cell_load(world, cell_id)["load"] + 1e-9 >= world.hive_tip_load:
                self.register_hive_tip(team, world.elapsed, world, cell_id)

    def hive_snapshot(self, world):
        return {team: {**cell_load(world, self.active_hive_cell(team)),
                       "tips": self.hive_tips[team], "nectar_load": world.hive_nectar_load}
                for team in ALLIANCES}

    def active_hive_cell(self, team):
        if team not in ALLIANCES:
            raise ValueError("Aliança inválida")
        initial = "lower" if team == "red" else "upper"
        if self.hive_tips[team] % 2:
            initial = "upper" if initial == "lower" else "lower"
        return HIVE_CELLS[team][initial]

    def score_snapshot(self, world):
        """Calcula uma estimativa por estado de peça e regras BIOBUZZ TU05."""
        points = {team: {"hive_tips": 20*self.hive_tips[team],
                         "hive_elements": 0, "flowers": 0, "bottom_nectar_bonus": 0,
                         "gardens": 0, "penalties_received": 0, "total": 0}
                  for team in ALLIANCES}

        for piece in world.elements:
            zone = piece.score_zone or piece.location
            if piece.status in ("hive", "scored") and zone == self.active_hive_cell(
                    "red" if zone.startswith("red-") else "blue"):
                alliance = "red" if zone.startswith("red-") else "blue"
                points[alliance]["hive_elements"] += 2

        deposited = [piece for piece in world.elements if piece.status == "deposited"
                     and piece.location.startswith("flower-")]
        flower_points, bonus_points = {team: 0 for team in ALLIANCES}, {team: 0 for team in ALLIANCES}
        for flower_index in range(4):
            contents = sorted((piece for piece in deposited
                               if piece.location == f"flower-{flower_index}"),
                              key=lambda piece: piece.deposit_sequence or 0)
            nectars = [piece for piece in contents if piece.kind == "NECTAR"
                       and piece.team in ALLIANCES]
            if not nectars:
                continue
            owner = nectars[-1].team
            flower_points[owner] += 2*len(contents)
            bonus_points[nectars[0].team] += 5
        for team in ALLIANCES:
            points[team]["flowers"] = flower_points[team]
            points[team]["bottom_nectar_bonus"] = bonus_points[team]

        for piece in world.elements:
            if piece.status != "field":
                continue
            radius = piece.radius
            for team in ALLIANCES:
                if any(_circle_intersects_rect(piece.x, piece.y, radius, zone)
                       for zone in GARDEN_ZONES[team]):
                    points[team]["gardens"] += 1
                    break

        for team in ALLIANCES:
            recipient = "blue" if team == "red" else "red"
            points[recipient]["penalties_received"] = self.penalty_points[team]

        for team in ALLIANCES:
            for flag, categories in (("score-hive", ("hive_tips", "hive_elements")),
                                     ("score-flower", ("flowers", "bottom_nectar_bonus")),
                                     ("score-garden", ("gardens",))):
                if not self.config[flag]:
                    for category in categories:
                        points[team][category] = 0
            points[team]["total"] = sum(value for category, value in points[team].items()
                                         if category != "total")
        return {"by_alliance": points,
                "limitations": [
                    "HIVE TIP usa carga ponderada configurável de treino; não é um limiar físico oficial.",
                    "FLOWER usa a ordem dos depósitos do OpMode como aproximação vertical do volume.",
                    "GARDEN usa círculos e zonas 2D esquemáticas; zonas oficiais/CAD e arbitragem não são reproduzidas.",
                    "Pontos por peças em CELL são uma projeção do estado atual da CELL voltada para cima."
                ]}

    def available_nectar(self, team, remaining_seconds, *, endgame=None):
        if team not in ALLIANCES:
            raise ValueError("Aliança inválida")
        remaining = max(0, MAX_ALLIANCE_NECTAR - self.nectar_entered[team])
        if not self.config["nectar-release"] or in_endgame(remaining_seconds, endgame):
            return remaining
        return min(remaining, max(0, self.hive_tips[team] - self.nectar_entered[team]))

    def enter_nectar(self, team, remaining_seconds, elapsed, world, *, endgame=None):
        if team != self.alliance:
            raise ValueError("Apenas o NECTAR da aliança selecionada pode ser introduzido")
        if self.available_nectar(team, remaining_seconds, endgame=endgame) < 1:
            raise ValueError("Nenhum NECTAR disponível: aguarde um TIP do seu HIVE ou os últimos 60 segundos")
        piece = next((item for item in world.elements
                      if item.id.startswith(f"nectar-alliance-{team}-")
                      and item.status == "reserved"), None)
        if piece is None:
            raise ValueError("Não há NECTAR reservado restante para esta aliança")
        # Centros aproximados dentro das Loading Zones já desenhadas pela arena.
        if team == "red":
            piece.x, piece.y = .14, 2.722
        else:
            piece.x, piece.y = 3.52025, .91
        piece.vx = piece.vy = 0.0
        # G426 libera uma entrada e G427 exige que ela aconteça na Loading
        # Zone. O estado transitório mantém o mesmo objeto visível enquanto
        # cai até o piso; não é uma ejeção do HIVE.
        piece.status = "entering"
        piece.location = f"loading-zone-{team}"
        piece.flight = {"mode": "human_entry", "started_at": float(elapsed),
                        "height": .45, "z": .45}
        self.nectar_entered[team] += 1
        event = {"type": "human_player_entry", "team": team, "element_id": piece.id,
                 "location": piece.location, "time": round(float(elapsed), 3)}
        self._append(self.events, event)
        return event

    def record_flower_deposit(self, event, remaining_seconds, robot_alliance=None, *, endgame=None):
        if not event or event.get("kind") != "NECTAR" or in_endgame(remaining_seconds, endgame):
            return None
        if not self.config["penalties"] or not self.config["g410"]:
            self._append(self.events, {"type": "penalty_disabled", "code": "G410",
                                      "element_id": event.get("element_id"),
                                      "time": round(float(event.get("time", 0)), 3)})
            return None
        penalized_team = robot_alliance or event.get("robot_alliance") or event.get("team")
        penalty = {"code": "G410", "severity": "major_foul",
                   "element_id": event.get("element_id"),
                   "team": penalized_team, "points_to_opponent": 20,
                   "time": round(float(event.get("time", 0)), 3),
                   "description": "NECTAR entrou no volume de pontuação da FLOWER antes dos últimos 60 segundos.",
                   "points_awarded": 20, "adjudication": "simulated"}
        self.penalty_count += 1
        if penalized_team in ALLIANCES:
            self.penalty_points[penalized_team] += 20
        self._append(self.penalties, penalty)
        return penalty

    @staticmethod
    def _append(collection, event):
        collection.append(event)
        del collection[:-100]

    def snapshot(self, remaining_seconds, match_mode, timer_enabled, *, phase=None, endgame=None):
        remaining = max(0.0, float(remaining_seconds)) if remaining_seconds is not None else None
        team = self.alliance
        available_by_tip = min(max(0, MAX_ALLIANCE_NECTAR - self.nectar_entered[team]),
                               max(0, self.hive_tips[team] - self.nectar_entered[team]))
        endgame_unlock = in_endgame(remaining, endgame)
        return {
            "alliance": team,
            "match_mode": match_mode,
            "timer_enabled": bool(timer_enabled),
            "remaining_seconds": round(remaining, 2) if remaining is not None else None,
            "phase": phase or ("endgame" if endgame_unlock else match_mode),
            "phase_source": "clock" if timer_enabled else "manual",
            "profile": self.config.copy(),
            "manual_reference": "BIOBUZZ TU05 · verificado em 16/10/2026",
            "scope": "Regras implementadas: G410, liberação G426, pontuação parcial de HIVE/FLOWER/GARDEN. Sem arbitragem completa.",
            "nectar_total": MAX_ALLIANCE_NECTAR,
            "nectar_entered": self.nectar_entered[team],
            "nectar_available": self.available_nectar(team, remaining, endgame=endgame_unlock),
            "eligible_from_hive_tips": max(0, available_by_tip),
            "endgame_unlocked": endgame_unlock,
            "hive_tips_didactic": self.hive_tips.copy(),
            "events": [event.copy() for event in self.events],
            "penalties": [penalty.copy() for penalty in self.penalties],
            "penalty_count": self.penalty_count,
            "penalty_points": self.penalty_points.copy(),
            "limitations": [
                "O TIP considera POLLEN e NECTAR presentes na CELL; cargas e limiar são calibrações de treino.",
                "G426 libera a entrada e G427 exige a Loading Zone; o botão do Human Player inicia uma queda visual aproximada de 0,45 m.",
                "Pontos BIOBUZZ são estimados de estados 2D; áreas verticais e julgamento de falta continuam aproximados."
            ]
        }


def _circle_intersects_rect(x, y, radius, rect):
    rx, ry, width, height = rect
    closest_x = max(rx, min(rx+width, x))
    closest_y = max(ry, min(ry+height, y))
    return math.hypot(x-closest_x, y-closest_y) <= radius
