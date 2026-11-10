#!/usr/bin/env python3
"""Meme Wars — 60-day economic simulation.

No third-party dependencies. Fixed seeds. The formulas mirror
contracts/meme-wars/src/{game,settlement}.rs exactly:

  multiplier_bp = 10000 + min(streak, cap) * step
  power         = stake * multiplier_bp // 10000
  effective     = weaker_side_power * underdog_bp // 10000
  loser burn    = loser_total_stake * loss_burn_bp // 10000
  reward share  = reward_pool * power // winner_base_power
  season share  = bonus_pool * season_power // winner_season_power

The self-test at the top pins the same numbers the Rust tests assert.

Usage:
    python3 sim/simulate.py            # run all scenarios + charts
    python3 sim/simulate.py --days 90  # longer horizon
"""

from __future__ import annotations

import argparse
import csv
import glob
import json
import math
import os
import random
import sys
from dataclasses import asdict, dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple

ROOT = os.path.dirname(os.path.abspath(__file__))
RESULTS = os.path.join(ROOT, "results")

DOGS = 0
CATS = 1
FACTION_NAMES = {DOGS: "DOGS", CATS: "CATS"}
BP = 10_000
TILE_COUNT = 25


# ---------------------------------------------------------------------------
# Parameters (keep in sync with config/prod.json)
# ---------------------------------------------------------------------------

@dataclass
class Params:
    seed: int = 42
    genesis_supply: int = 1_000_000_000
    treasury_allocation: int = 200_000_000
    community_allocation: int = 800_000_000
    season_days: int = 30
    daily_mint_pool: int = 100_000
    loss_burn_bp: int = 2_000
    underdog_bonus_bp: int = 20_000
    cold_line: int = 3_750_000
    cold_burn: int = 250_000
    min_stake: int = 1_000
    max_stake_per_day: int = 100_000
    streak_step_bp: int = 500
    streak_cap_days: int = 20
    season_bonus_bp: int = 200
    claim_window_days: int = 7


@dataclass
class Scenario:
    key: str
    label: str
    n_players: int
    dogs_ratio: float
    participation: float
    days: int = 60
    sybil_fraction: float = 0.0   # fraction of DOGS replaced by sybils
    sybil_days: int = 0
    churn_weekly: float = 0.0
    initial_balance: int = 2_000_000
    sybil_balance: int = 50_000


SCENARIO_ORDER = ["balanced", "imbalance", "sybil", "cold_start", "churn"]


def load_scenarios() -> List[Scenario]:
    """Load sim/scenarios/<key>.json in a stable order. Falls back to defaults."""
    path = os.path.join(ROOT, "scenarios")
    loaded: List[Scenario] = []
    for key in SCENARIO_ORDER:
        file_path = os.path.join(path, f"{key}.json")
        if os.path.exists(file_path):
            with open(file_path, encoding="utf-8") as f:
                loaded.append(Scenario(**json.load(f)))
    if not loaded:
        return [
            Scenario("balanced", "Balanced", 200, 0.50, 0.60),
            Scenario("imbalance", "Imbalance 70/30", 300, 0.70, 0.55),
            Scenario("sybil", "Sybil raid (+30% DOGS, 10d)", 200, 0.50, 0.60,
                     sybil_fraction=0.30, sybil_days=10),
            Scenario("cold_start", "Cold start (30 players)", 30, 0.50, 0.40),
            Scenario("churn", "Churn (20%/week)", 200, 0.50, 0.60,
                     churn_weekly=0.20),
        ]
    return loaded


# ---------------------------------------------------------------------------
# Pure formula helpers (cross-checked with the Rust contract tests)
# ---------------------------------------------------------------------------

def mul_bp(amount: int, bp: int) -> int:
    return amount * bp // BP


def mul_div(a: int, b: int, c: int) -> int:
    if c <= 0:
        raise ValueError("division by zero")
    return a * b // c


def streak_multiplier_bp(streak: int, step_bp: int, cap_days: int) -> int:
    return BP + min(streak, cap_days) * step_bp


def power_for(stake: int, streak: int, params: Params) -> int:
    return stake * streak_multiplier_bp(streak, params.streak_step_bp,
                                        params.streak_cap_days) // BP


def effective_powers(p0: int, p1: int, underdog_bp: int) -> Tuple[int, int, Optional[int]]:
    e0, e1 = p0, p1
    if p0 < p1:
        e0 = mul_bp(p0, underdog_bp)
    elif p1 < p0:
        e1 = mul_bp(p1, underdog_bp)
    if e0 > e1:
        return e0, e1, DOGS
    if e1 > e0:
        return e0, e1, CATS
    return e0, e1, None


def self_test() -> None:
    """Pins the same fixtures as contracts/meme-wars/tests/game.rs."""
    p = Params()
    assert streak_multiplier_bp(1, 500, 20) == 10_500
    assert streak_multiplier_bp(10, 500, 20) == 15_000
    assert streak_multiplier_bp(20, 500, 20) == 20_000
    assert streak_multiplier_bp(21, 500, 20) == 20_000
    assert power_for(10_000, 1, p) == 10_500
    assert power_for(10_000, 10, p) == 15_000

    # Rust: underdog flips 10_000 DOGS vs 12_000 CATS at genesis streak.
    e0, e1, winner = effective_powers(10_500, 12_600, 15_000)
    assert (e0, e1, winner) == (15_750, 12_600, DOGS)
    assert mul_bp(12_000, 2_000) == 2_400

    # Rust season test: 79_000 / 89_500 of a 10m bonus.
    assert mul_div(10_000_000, 79_000, 89_500) == 8_826_815
    assert mul_div(10_000_000, 10_500, 89_500) == 1_173_184

    assert power_for(50_000, 3, p) == 57_500
    print("self-test: contract formulas match (Rust fixtures pinned)")


# ---------------------------------------------------------------------------
# Simulation
# ---------------------------------------------------------------------------

@dataclass
class Player:
    pid: int
    faction: int
    balance: int
    initial_balance: int
    is_sybil: bool = False
    active: bool = True
    streak: int = 0
    last_day: int = 0
    total_staked: int = 0
    total_claimed: int = 0
    total_rewards: int = 0
    season_power: int = 0


@dataclass
class DayRow:
    day: int
    season: int
    dogs_power: int
    cats_power: int
    dogs_effective: int
    cats_effective: int
    dogs_stake: int
    cats_stake: int
    dogs_players: int
    cats_players: int
    winner: Optional[int]
    cold: bool
    tie: bool
    minted: int
    burned: int
    total_supply: int
    treasury: int
    reward_vault: int
    season_vault: int
    locked_total: int
    tiles_dogs: int
    tiles_cats: int
    season_winner: Optional[int] = None


@dataclass
class Result:
    scenario: Scenario
    params: Params
    rows: List[DayRow]
    players: List[Player]
    external_balance: int
    minted_total: int
    burned_stake: int
    burned_cold: int
    burned_rewards: int
    burned_seasons: int
    season_results: List[dict] = field(default_factory=list)

    @property
    def total_burned(self) -> int:
        return (self.burned_stake + self.burned_cold
                + self.burned_rewards + self.burned_seasons)

    @property
    def final_supply(self) -> int:
        return self.params.genesis_supply + self.minted_total - self.total_burned

    @property
    def cold_days(self) -> int:
        return sum(1 for r in self.rows if r.cold)

    @property
    def tie_days(self) -> int:
        return sum(1 for r in self.rows if r.tie)

    @property
    def dogs_win_days(self) -> int:
        return sum(1 for r in self.rows if r.winner == DOGS)

    @property
    def cats_win_days(self) -> int:
        return sum(1 for r in self.rows if r.winner == CATS)

    def summary(self) -> dict:
        n = len(self.rows)
        honest = [p for p in self.players if not p.is_sybil]
        sybils = [p for p in self.players if p.is_sybil]

        def roi(player: Player) -> float:
            return ((player.balance - player.initial_balance) / player.total_staked
                    if player.total_staked else 0.0)

        def gini_rewards(players: List[Player]) -> float:
            rewards = sorted(max(0, p.total_rewards) for p in players)
            if not rewards or sum(rewards) == 0:
                return 0.0
            cum = 0
            total = sum(rewards)
            for i, r in enumerate(rewards, 1):
                cum += i * r
            return (2 * cum) / (len(rewards) * total) - (len(rewards) + 1) / len(rewards)

        honest_roi = sum(roi(p) for p in honest) / len(honest) if honest else 0.0
        sybil_roi = sum(roi(p) for p in sybils) / len(sybils) if sybils else None
        min_treasury = min((r.treasury for r in self.rows), default=0)

        return {
            "scenario": self.scenario.key,
            "label": self.scenario.label,
            "days": n,
            "players": len(self.players),
            "sybils": len(sybils),
            "final_supply": self.final_supply,
            "supply_change_pct": round(100 * (self.final_supply - self.params.genesis_supply)
                                       / self.params.genesis_supply, 4),
            "annualized_inflation_pct": round(
                100 * (self.final_supply - self.params.genesis_supply)
                / self.params.genesis_supply * 365 / max(n, 1), 3),
            "minted_rewards": self.minted_total,
            "burned_total": self.total_burned,
            "burned_stake": self.burned_stake,
            "burned_cold": self.burned_cold,
            "burned_rewards": self.burned_rewards,
            "burned_seasons": self.burned_seasons,
            "final_treasury": self.rows[-1].treasury if self.rows else 0,
            "min_treasury": min_treasury,
            "cold_days": self.cold_days,
            "cold_day_pct": round(100 * self.cold_days / max(n, 1), 2),
            "tie_days": self.tie_days,
            "dogs_win_pct": round(100 * self.dogs_win_days / max(n, 1), 2),
            "cats_win_pct": round(100 * self.cats_win_days / max(n, 1), 2),
            "final_locked_dust": self.rows[-1].locked_total if self.rows else 0,
            "honest_roi_pct": round(100 * honest_roi, 2),
            "sybil_roi_pct": round(100 * sybil_roi, 2) if sybil_roi is not None else None,
            "reward_gini": round(gini_rewards(honest), 4),
            "season_results": self.season_results,
        }


class Game:
    def __init__(self, params: Params, scenario: Scenario):
        self.params = params
        self.scenario = scenario
        self.rng = random.Random(f"meme-wars:{params.seed}:{scenario.key}")
        self.players = self._build_players()
        self.external_balance = params.community_allocation - sum(
            p.initial_balance for p in self.players)

        self.treasury = params.treasury_allocation
        self.reward_vault = 0
        self.season_vault = 0
        self.locked_total = 0

        self.minted_total = 0
        self.burned_stake = 0
        self.burned_cold = 0
        self.burned_rewards = 0
        self.burned_seasons = 0

        self.reward_leftovers: Dict[int, int] = {}
        self.season_leftover = 0

        self.faction_win_streak = [0, 0]
        self.map = [0] * TILE_COUNT
        self.season_tiles = [0, 0]
        self.season_total_power = [0, 0]
        self.season_results: List[dict] = []

    def _build_players(self) -> List[Player]:
        s = self.scenario
        n_dogs = round(s.n_players * s.dogs_ratio)
        n_cats = s.n_players - n_dogs
        n_sybils = round(n_dogs * s.sybil_fraction)
        players: List[Player] = []
        pid = 0
        for _ in range(n_dogs):
            players.append(Player(pid, DOGS, s.initial_balance, s.initial_balance))
            pid += 1
        for _ in range(n_cats):
            players.append(Player(pid, CATS, s.initial_balance, s.initial_balance))
            pid += 1
        for _ in range(n_sybils):
            players.append(Player(pid, DOGS, s.sybil_balance, s.sybil_balance,
                                  is_sybil=True))
            pid += 1
        return players

    def _churn(self) -> None:
        active = [p for p in self.players if p.active and not p.is_sybil]
        n = int(len(active) * self.scenario.churn_weekly)
        for p in self.rng.sample(active, n):
            p.active = False

    def _stake_for(self, p: Player, day: int) -> Optional[int]:
        if p.balance < self.params.min_stake:
            return None
        if p.is_sybil:
            if day > self.scenario.sybil_days:
                return None
            stake = self.params.min_stake
        else:
            raw = self.rng.lognormvariate(math.log(25_000), 0.8)
            stake = int(raw // 500 * 500)
            stake = max(self.params.min_stake, min(self.params.max_stake_per_day, stake))
        if stake > p.balance:
            stake = (p.balance // 500) * 500
        return stake if stake >= self.params.min_stake else None

    def _accounting(self) -> None:
        left = self.params.genesis_supply + self.minted_total - (
            self.burned_stake + self.burned_cold
            + self.burned_rewards + self.burned_seasons)
        right = (sum(p.balance for p in self.players) + self.external_balance
                 + self.treasury + self.reward_vault + self.season_vault
                 + self.locked_total)
        if left != right:
            raise AssertionError(
                f"accounting broken: supply={left} buckets={right} "
                f"(treasury={self.treasury}, reward={self.reward_vault}, "
                f"season={self.season_vault}, locked={self.locked_total})")

    def _settle_season(self, day: int) -> None:
        season = day // self.params.season_days
        tiles = list(self.season_tiles)
        winner = (DOGS if tiles[0] > tiles[1]
                  else CATS if tiles[1] > tiles[0] else None)
        totals = list(self.season_total_power)
        final_map = list(self.map)

        # Previous season's unclaimed bonus is burned when the next one ends.
        if self.season_leftover > 0:
            self.season_vault -= self.season_leftover
            self.burned_seasons += self.season_leftover
            self.season_leftover = 0

        bonus = 0
        if winner is not None:
            bonus = min(self.treasury, mul_bp(self.treasury, self.params.season_bonus_bp))
            self.treasury -= bonus
            self.season_vault += bonus
            denom = totals[winner]
            shares = 0
            if denom > 0:
                for p in self.players:
                    if p.faction != winner or p.season_power <= 0:
                        continue
                    share = mul_div(bonus, p.season_power, denom)
                    if share:
                        p.balance += share
                        p.total_claimed += share
                        p.total_rewards += share
                        shares += share
            self.season_vault -= shares
            self.season_leftover = bonus - shares

        self.season_results.append({
            "season": season,
            "end_day": day,
            "winner": FACTION_NAMES.get(winner) if winner is not None else None,
            "tiles": f"{tiles[0]}-{tiles[1]}",
            "bonus_pool": bonus,
            "bonus_leftover": self.season_leftover,
            "final_map": final_map,
        })

        # New season state.
        self.season_tiles = [0, 0]
        self.map = [0] * TILE_COUNT
        self.season_total_power = [0, 0]
        for p in self.players:
            p.season_power = 0

    def run(self) -> Result:
        p = self.params
        rows: List[DayRow] = []

        for day in range(1, self.scenario.days + 1):
            if self.scenario.churn_weekly > 0 and day > 1 and (day - 1) % 7 == 0:
                self._churn()

            power = [0, 0]
            stake_total = [0, 0]
            count = [0, 0]
            enlisted: List[Tuple[Player, int, int]] = []

            for player in self.players:
                if not player.active:
                    continue
                if player.is_sybil and day > self.scenario.sybil_days:
                    continue
                if not player.is_sybil and self.rng.random() >= self.scenario.participation:
                    continue
                stake = self._stake_for(player, day)
                if stake is None:
                    continue

                streak = player.streak + 1 if player.last_day == day - 1 else 1
                pow_ = power_for(stake, streak, p)
                player.balance -= stake
                player.streak = streak
                player.last_day = day
                player.total_staked += stake
                player.season_power += pow_
                self.locked_total += stake

                power[player.faction] += pow_
                stake_total[player.faction] += stake
                count[player.faction] += 1
                self.season_total_power[player.faction] += pow_
                enlisted.append((player, stake, pow_))

            total_power = power[0] + power[1]
            cold = total_power < p.cold_line
            winner: Optional[int] = None
            tie = False
            minted = 0
            burned_today = 0
            e0, e1 = power

            if cold:
                # Full refunds, treasury burn, both streaks reset.
                for player, stake, _ in enlisted:
                    player.balance += stake
                    self.locked_total -= stake
                burn = min(self.treasury, p.cold_burn)
                if burn:
                    self.treasury -= burn
                    self.burned_cold += burn
                    burned_today += burn
                self.faction_win_streak = [0, 0]
            else:
                e0, e1, winner = effective_powers(power[0], power[1],
                                                  p.underdog_bonus_bp)
                if winner is None:
                    tie = True
                    for player, stake, _ in enlisted:
                        player.balance += stake
                        self.locked_total -= stake
                    self.faction_win_streak = [0, 0]
                else:
                    loser = 1 - winner
                    # Winners get their stake back immediately.
                    for player, stake, _ in enlisted:
                        if player.faction == winner:
                            player.balance += stake
                            self.locked_total -= stake
                    # Losers: per-account floor payout; aggregate floor burn.
                    aggregate_burn = mul_bp(stake_total[loser], p.loss_burn_bp)
                    self.burned_stake += aggregate_burn
                    burned_today += aggregate_burn
                    self.locked_total -= aggregate_burn
                    for player, stake, _ in enlisted:
                        if player.faction == loser:
                            payout = mul_bp(stake, BP - p.loss_burn_bp)
                            player.balance += payout
                            player.total_claimed += payout
                            self.locked_total -= payout
                    # Daily mint and reward shares.
                    minted = p.daily_mint_pool
                    self.minted_total += minted
                    self.reward_vault += minted
                    denom = power[winner]
                    shares = 0
                    if denom > 0:
                        for player, _, pow_ in enlisted:
                            if player.faction != winner:
                                continue
                            share = mul_div(minted, pow_, denom)
                            if share:
                                player.balance += share
                                player.total_claimed += share
                                player.total_rewards += share
                                shares += share
                    self.reward_vault -= shares
                    leftover = minted - shares
                    if leftover:
                        self.reward_leftovers[day] = leftover

                    self.faction_win_streak[winner] += 1
                    self.faction_win_streak[loser] = 0
                    tile = (day - 1) % TILE_COUNT
                    previous = self.map[tile]
                    if previous != winner + 1:
                        if previous != 0:
                            self.season_tiles[previous - 1] -= 1
                        self.season_tiles[winner] += 1
                    self.map[tile] = winner + 1

            # Reward claims closed after the window; leftover dust burns.
            close_day = day - p.claim_window_days - 1
            if close_day in self.reward_leftovers:
                leftover = self.reward_leftovers.pop(close_day)
                self.reward_vault -= leftover
                self.burned_rewards += leftover

            season_winner = None
            if day % p.season_days == 0:
                self._settle_season(day)
                name = self.season_results[-1]["winner"]
                season_winner = DOGS if name == "DOGS" else CATS if name == "CATS" else None

            self._accounting()

            rows.append(DayRow(
                day=day,
                season=(day - 1) // p.season_days + 1,
                dogs_power=power[0],
                cats_power=power[1],
                dogs_effective=e0,
                cats_effective=e1,
                dogs_stake=stake_total[0],
                cats_stake=stake_total[1],
                dogs_players=count[0],
                cats_players=count[1],
                winner=winner,
                cold=cold,
                tie=tie,
                minted=minted,
                burned=burned_today,
                total_supply=(p.genesis_supply + self.minted_total
                              - self.burned_stake - self.burned_cold
                              - self.burned_rewards - self.burned_seasons),
                treasury=self.treasury,
                reward_vault=self.reward_vault,
                season_vault=self.season_vault,
                locked_total=self.locked_total,
                tiles_dogs=self.season_tiles[0],
                tiles_cats=self.season_tiles[1],
                season_winner=season_winner,
            ))

        return Result(
            scenario=self.scenario,
            params=p,
            rows=rows,
            players=self.players,
            external_balance=self.external_balance,
            minted_total=self.minted_total,
            burned_stake=self.burned_stake,
            burned_cold=self.burned_cold,
            burned_rewards=self.burned_rewards,
            burned_seasons=self.burned_seasons,
            season_results=self.season_results,
        )


# ---------------------------------------------------------------------------
# Sensitivity analysis
# ---------------------------------------------------------------------------

def sensitivity(base: Result, params: Params) -> List[dict]:
    variations = [
        ("daily_mint_pool -20%", {"daily_mint_pool": int(params.daily_mint_pool * 0.8)}),
        ("daily_mint_pool +20%", {"daily_mint_pool": int(params.daily_mint_pool * 1.2)}),
        ("loss_burn_bp -20%", {"loss_burn_bp": int(params.loss_burn_bp * 0.8)}),
        ("loss_burn_bp +20%", {"loss_burn_bp": int(params.loss_burn_bp * 1.2)}),
        ("underdog -20%", {"underdog_bonus_bp": int(params.underdog_bonus_bp * 0.8)}),
        ("underdog +20%", {"underdog_bonus_bp": int(params.underdog_bonus_bp * 1.2)}),
        ("cold_line -20%", {"cold_line": int(params.cold_line * 0.8)}),
        ("cold_line +20%", {"cold_line": int(params.cold_line * 1.2)}),
    ]
    out = [{
        "variation": "base",
        "final_supply": base.final_supply,
        "supply_change_pct": round(100 * (base.final_supply - params.genesis_supply)
                                   / params.genesis_supply, 4),
        "cold_days": base.cold_days,
        "dogs_win_pct": round(100 * base.dogs_win_days / len(base.rows), 2),
        "final_treasury": base.rows[-1].treasury,
    }]
    for label, override in variations:
        p = Params(**{**asdict(params), **override})
        scenario = Scenario(f"sens_{label}", label, 200, 0.50, 0.60, days=base.scenario.days)
        result = Game(p, scenario).run()
        out.append({
            "variation": label,
            "final_supply": result.final_supply,
            "supply_change_pct": round(100 * (result.final_supply - p.genesis_supply)
                                       / p.genesis_supply, 4),
            "cold_days": result.cold_days,
            "dogs_win_pct": round(100 * result.dogs_win_days / len(result.rows), 2),
            "final_treasury": result.rows[-1].treasury,
        })
    return out


# ---------------------------------------------------------------------------
# SVG charts (no dependencies)
# ---------------------------------------------------------------------------

COLORS = ["#ff5a3c", "#2dd4ff", "#ffd166", "#7cf29c", "#c084fc", "#94a3b8"]


def _esc(text: str) -> str:
    return (text.replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def line_chart(path: str, title: str, series: Sequence[Tuple[str, List[Tuple[int, float]]]],
               y_label: str, zero_based: bool = False) -> None:
    width, height = 960, 440
    left, right, top, bottom = 78, 24, 64, 52
    plot_w = width - left - right
    plot_h = height - top - bottom

    xs = [x for _, points in series for x, _ in points]
    ys = [y for _, points in series for _, y in points]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    if zero_based:
        min_y = 0
    span = max_y - min_y
    if span <= 0:
        span = max(1.0, abs(max_y) * 0.1)
    lo = 0 if zero_based else min_y - span * 0.12
    hi = max_y + span * 0.12

    def px(x: float) -> float:
        return left + (x - min_x) / max(1, max_x - min_x) * plot_w

    def py(y: float) -> float:
        return top + (1 - (y - lo) / (hi - lo)) * plot_h

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
        f'font-family="ui-monospace,SFMono-Regular,Menlo,monospace" role="img">',
        f'<rect width="{width}" height="{height}" fill="#0b1020"/>',
        f'<text x="{left}" y="32" fill="#e2e8f0" font-size="20" font-weight="700">{_esc(title)}</text>',
        f'<text x="{left}" y="50" fill="#8b98b8" font-size="12">{_esc(y_label)}</text>',
    ]
    # Horizontal grid + y labels.
    for i in range(6):
        y = lo + (hi - lo) * i / 5
        yy = py(y)
        parts.append(f'<line x1="{left}" y1="{yy:.1f}" x2="{width-right}" y2="{yy:.1f}" '
                     f'stroke="#24304d" stroke-width="1"/>')
        parts.append(f'<text x="{left-8}" y="{yy+4:.1f}" fill="#8b98b8" font-size="11" '
                     f'text-anchor="end">{y:,.1f}</text>')
    # X labels.
    step = max(1, (max_x - min_x) // 6)
    x = min_x
    while x <= max_x:
        xx = px(x)
        parts.append(f'<text x="{xx:.1f}" y="{height-bottom+20}" fill="#8b98b8" '
                     f'font-size="11" text-anchor="middle">{int(x)}</text>')
        x += step
    parts.append(f'<line x1="{left}" y1="{height-bottom}" x2="{width-right}" '
                 f'y2="{height-bottom}" stroke="#3b4a6b"/>')
    parts.append(f'<text x="{width-right}" y="{height-12}" fill="#8b98b8" font-size="11" '
                 f'text-anchor="end">day</text>')

    for i, (label, points) in enumerate(series):
        color = COLORS[i % len(COLORS)]
        d = " ".join(f"{px(x):.1f},{py(y):.1f}" for x, y in points)
        parts.append(f'<polyline points="{d}" fill="none" stroke="{color}" '
                     f'stroke-width="2.4" stroke-linejoin="round" '
                     f'stroke-linecap="round"/>')
        lx = left + 4 + i * 190
        parts.append(f'<line x1="{lx}" y1="58" x2="{lx+22}" y2="58" stroke="{color}" '
                     f'stroke-width="3"/>')
        parts.append(f'<text x="{lx+28}" y="62" fill="#cbd5e1" font-size="12">{_esc(label)}</text>')

    parts.append("</svg>")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(parts))


def bar_chart(path: str, title: str, labels: Sequence[str], values: Sequence[float],
              y_label: str, value_fmt: str = "{:.0f}", negative: bool = True) -> None:
    width, height = 960, 420
    left, right, top, bottom = 78, 24, 64, 64
    plot_w = width - left - right
    plot_h = height - top - bottom
    lo = min(0, min(values)) if negative else 0
    hi = max(values + [0])
    span = max(hi - lo, 1e-9)
    hi = hi + span * 0.1

    def py(y: float) -> float:
        return top + (1 - (y - lo) / (hi - lo)) * plot_h

    n = len(labels)
    slot = plot_w / n
    bar_w = min(70, slot * 0.55)
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
        f'font-family="ui-monospace,SFMono-Regular,Menlo,monospace" role="img">',
        f'<rect width="{width}" height="{height}" fill="#0b1020"/>',
        f'<text x="{left}" y="32" fill="#e2e8f0" font-size="20" font-weight="700">{_esc(title)}</text>',
        f'<text x="{left}" y="50" fill="#8b98b8" font-size="12">{_esc(y_label)}</text>',
    ]
    if lo < 0:
        y0 = py(0)
        parts.append(f'<line x1="{left}" y1="{y0:.1f}" x2="{width-right}" y2="{y0:.1f}" '
                     f'stroke="#3b4a6b"/>')
    for i in range(6):
        y = lo + (hi - lo) * i / 5
        yy = py(y)
        parts.append(f'<line x1="{left}" y1="{yy:.1f}" x2="{width-right}" y2="{yy:.1f}" '
                     f'stroke="#1c263f"/>')
        parts.append(f'<text x="{left-8}" y="{yy+4:.1f}" fill="#8b98b8" font-size="11" '
                     f'text-anchor="end">{y:,.1f}</text>')

    for i, (label, value) in enumerate(zip(labels, values)):
        cx = left + slot * i + slot / 2
        top_y = py(max(value, 0))
        bot_y = py(min(value, 0))
        color = COLORS[1] if value >= 0 else COLORS[0]
        parts.append(f'<rect x="{cx-bar_w/2:.1f}" y="{top_y:.1f}" width="{bar_w:.1f}" '
                     f'height="{abs(bot_y-top_y):.1f}" fill="{color}" fill-opacity="0.85" '
                     f'rx="3"/>')
        ty = top_y - 8 if value >= 0 else bot_y + 16
        parts.append(f'<text x="{cx:.1f}" y="{ty:.1f}" fill="#e2e8f0" font-size="11" '
                     f'text-anchor="middle">{value_fmt.format(value)}</text>')
        parts.append(f'<text x="{cx:.1f}" y="{height-bottom+22}" fill="#8b98b8" '
                     f'font-size="10" text-anchor="middle">{_esc(label)}</text>')

    parts.append("</svg>")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(parts))


def stacked_win_chart(path: str, results: Sequence[Result]) -> None:
    width, height = 960, 420
    left, right, top = 190, 36, 64
    row_h = 52
    plot_w = width - left - right
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
        f'font-family="ui-monospace,SFMono-Regular,Menlo,monospace" role="img">',
        f'<rect width="{width}" height="{height}" fill="#0b1020"/>',
        f'<text x="36" y="32" fill="#e2e8f0" font-size="20" font-weight="700">'
        f'Day outcomes by scenario</text>',
        f'<text x="36" y="50" fill="#8b98b8" font-size="12">% of simulated days</text>',
    ]
    legend = [("DOGS win", "#ff5a3c"), ("CATS win", "#2dd4ff"),
              ("Tie", "#ffd166"), ("Cold", "#64748b")]
    lx = 36
    for label, color in legend:
        parts.append(f'<rect x="{lx}" y="58" width="12" height="12" fill="{color}" rx="2"/>')
        parts.append(f'<text x="{lx+18}" y="68" fill="#cbd5e1" font-size="12">{label}</text>')
        lx += 130

    for i, r in enumerate(results):
        y = top + i * row_h
        n = max(1, len(r.rows))
        dogs = 100 * r.dogs_win_days / n
        cats = 100 * r.cats_win_days / n
        ties = 100 * r.tie_days / n
        cold = 100 * r.cold_days / n
        parts.append(f'<text x="{left-12}" y="{y+20}" fill="#cbd5e1" font-size="12" '
                     f'text-anchor="end">{_esc(r.scenario.label)}</text>')
        x = left
        for value, color in [(dogs, "#ff5a3c"), (cats, "#2dd4ff"),
                             (ties, "#ffd166"), (cold, "#64748b")]:
            w = plot_w * value / 100
            if w > 0:
                parts.append(f'<rect x="{x:.1f}" y="{y}" width="{w:.1f}" height="26" '
                             f'fill="{color}" fill-opacity="0.9"/>')
                if value >= 4:
                    parts.append(f'<text x="{x+w/2:.1f}" y="{y+17}" fill="#0b1020" '
                                 f'font-size="10" font-weight="700" text-anchor="middle">'
                                 f'{value:.0f}%</text>')
            x += w

    parts.append("</svg>")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(parts))


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

def write_csv(path: str, rows: Sequence[DayRow]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(list(asdict(rows[0]).keys()) if rows else [])
        for row in rows:
            writer.writerow(list(asdict(row).values()))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=60)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", default=RESULTS)
    args = parser.parse_args()

    self_test()
    os.makedirs(args.out, exist_ok=True)

    params = Params(seed=args.seed)
    results: List[Result] = []
    summaries: List[dict] = []

    for scenario in load_scenarios():
        scenario.days = args.days
        result = Game(params, scenario).run()
        results.append(result)
        summaries.append(result.summary())
        write_csv(os.path.join(args.out, f"{scenario.key}.csv"), result.rows)
        print(f"{scenario.label:38s} supply Δ {result.final_supply - params.genesis_supply:>+12,}"
              f"  cold {result.cold_days:>3} d  DOGS {result.dogs_win_days:>3} / CATS "
              f"{result.cats_win_days:>3}  treasury {result.rows[-1].treasury:>13,}")

    # Charts.
    line_chart(
        os.path.join(args.out, "supply.svg"),
        f"Total supply over {args.days} days",
        [(r.scenario.label, [(row.day, row.total_supply / 1e6) for row in r.rows])
         for r in results],
        "WAR supply, millions (the whole 1B genesis is included)",
    )
    line_chart(
        os.path.join(args.out, "treasury.svg"),
        "Treasury balance over time",
        [(r.scenario.label, [(row.day, row.treasury / 1e6) for row in r.rows])
         for r in results],
        "Treasury, millions of WAR",
    )
    bar_chart(
        os.path.join(args.out, "cold_days.svg"),
        "Cold days per scenario",
        [r.scenario.label for r in results],
        [r.cold_days for r in results],
        "Days below cold_line (of 60)",
        value_fmt="{:.0f}",
    )
    stacked_win_chart(os.path.join(args.out, "win_rates.svg"), results)

    sybil_result = next(r for r in results if r.scenario.key == "sybil")
    honest = [p for p in sybil_result.players if not p.is_sybil]
    sybils = [p for p in sybil_result.players if p.is_sybil]

    def mean_roi(players: Sequence[Player]) -> float:
        vals = [((p.balance - p.initial_balance) / p.total_staked)
                for p in players if p.total_staked]
        return 100 * sum(vals) / len(vals) if vals else 0.0

    bar_chart(
        os.path.join(args.out, "sybil_roi.svg"),
        "Sybil raid: return on staked capital",
        ["Honest DOGS", "Sybil DOGS"],
        [mean_roi(honest), mean_roi(sybils)],
        "Average P&L / staked capital, % (raids days 1-10 only)",
        value_fmt="{:+.1f}%",
    )

    sens = sensitivity(results[0], params)
    with open(os.path.join(args.out, "sensitivity.csv"), "w", newline="",
              encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(sens[0].keys()))
        writer.writeheader()
        writer.writerows(sens)
    bar_chart(
        os.path.join(args.out, "sensitivity.svg"),
        "Parameter sensitivity: final supply change",
        [s["variation"] for s in sens],
        [s["supply_change_pct"] for s in sens],
        "Supply change vs genesis, %",
        value_fmt="{:+.2f}%",
    )

    payload = {
        "params": asdict(params),
        "scenarios": summaries,
        "sensitivity": sens,
        "notes": [
            "All rewards and stakes are assumed claimed promptly; only floor dust remains.",
            "Burns include losing-stake burns, cold-day treasury burns, closed reward dust, and closed season dust.",
            "Player P&L excludes the untouched community allocation held outside the player set.",
        ],
    }
    with open(os.path.join(args.out, "summary.json"), "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print("\nWrote results to", args.out)
    print("  supply.svg, treasury.svg, cold_days.svg, win_rates.svg, sybil_roi.svg,")
    print("  sensitivity.svg, sensitivity.csv, summary.json, <scenario>.csv")
    return 0


if __name__ == "__main__":
    sys.exit(main())
