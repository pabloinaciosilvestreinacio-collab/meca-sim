"""Regras simplificadas BIOBUZZ separadas da física do campo.

A disponibilidade de NECTAR segue o fluxo de G426; o evento de tipagem do
HIVE vem do modelo didático do simulador e não é uma decisão oficial de árbitro.
"""
from __future__ import annotations

from dataclasses import dataclass

MAX_ALLIANCE_NECTAR = 5
ENDGAME_REMAINING_SECONDS = 60.0
ALLIANCES = ("red", "blue")


@dataclass
class BioBuzzRules:
    alliance: str = "red"

    def __post_init__(self):
        if self.alliance not in ALLIANCES:
            raise ValueError("Aliança deve ser red ou blue")
        self.hive_tips = {"red": 0, "blue": 0}
        self.nectar_entered = {"red": 0, "blue": 0}
        self.events = []
        self.penalties = []

    def register_hive_tip(self, team, elapsed):
        if team not in ALLIANCES:
            raise ValueError("Aliança do HIVE inválida")
        self.hive_tips[team] += 1
        event = {"type": "hive_tip", "team": team, "time": round(float(elapsed), 3),
                 "source": "simulated_hive_tip"}
        self._append(self.events, event)
        return event

    def available_nectar(self, team, remaining_seconds):
        if team not in ALLIANCES:
            raise ValueError("Aliança inválida")
        remaining = max(0, MAX_ALLIANCE_NECTAR - self.nectar_entered[team])
        if remaining_seconds <= ENDGAME_REMAINING_SECONDS:
            return remaining
        return min(remaining, max(0, self.hive_tips[team] - self.nectar_entered[team]))

    def enter_nectar(self, team, remaining_seconds, elapsed, world):
        if team != self.alliance:
            raise ValueError("Apenas o NECTAR da aliança selecionada pode ser introduzido")
        if self.available_nectar(team, remaining_seconds) < 1:
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
        piece.status = "field"
        piece.location = f"loading-zone-{team}"
        self.nectar_entered[team] += 1
        event = {"type": "human_player_entry", "team": team, "element_id": piece.id,
                 "location": piece.location, "time": round(float(elapsed), 3)}
        self._append(self.events, event)
        return event

    def record_flower_deposit(self, event, remaining_seconds):
        if not event or event.get("kind") != "NECTAR" or remaining_seconds <= ENDGAME_REMAINING_SECONDS:
            return None
        penalty = {"code": "G410", "severity": "major_foul",
                   "element_id": event.get("element_id"),
                   "time": round(float(event.get("time", 0)), 3),
                   "description": "NECTAR entrou no volume de pontuação da FLOWER antes dos últimos 60 segundos.",
                   "points_awarded": None, "adjudication": "recorded_not_awarded"}
        self._append(self.penalties, penalty)
        return penalty

    @staticmethod
    def _append(collection, event):
        collection.append(event)
        del collection[:-100]

    def snapshot(self, remaining_seconds, match_mode, timer_enabled):
        remaining = max(0.0, float(remaining_seconds))
        team = self.alliance
        available_by_tip = min(max(0, MAX_ALLIANCE_NECTAR - self.nectar_entered[team]),
                               max(0, self.hive_tips[team] - self.nectar_entered[team]))
        endgame_unlock = remaining <= ENDGAME_REMAINING_SECONDS
        return {
            "alliance": team,
            "match_mode": match_mode,
            "timer_enabled": bool(timer_enabled),
            "remaining_seconds": round(remaining, 2),
            "nectar_total": MAX_ALLIANCE_NECTAR,
            "nectar_entered": self.nectar_entered[team],
            "nectar_available": self.available_nectar(team, remaining),
            "eligible_from_hive_tips": max(0, available_by_tip),
            "endgame_unlocked": endgame_unlock,
            "hive_tips_didactic": self.hive_tips.copy(),
            "events": [event.copy() for event in self.events],
            "penalties": [penalty.copy() for penalty in self.penalties],
            "limitations": [
                "O TIP vem do modelo didático de 8 POLLEN; não representa critério físico oficial.",
                "A entrada ocorre por botão explícito do Human Player e inicia na Loading Zone aproximada.",
                "Faltas são registradas para relatório, sem atribuição automática de pontos."
            ]
        }
