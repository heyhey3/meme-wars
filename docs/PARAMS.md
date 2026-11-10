# Meme Wars — Parameters and 60-day simulation

Status: **production recipe chosen from the simulation; demo deployment uses a
scaled variant**. The demo contract is `war-demo.testnet`. The production
recipe is in `config/prod.json`; the executable simulation is
`sim/simulate.py`.

## 1. Why simulate first

The game is a sink: losers burn 20% of their stake, the daily mint is fixed,
and the treasury pays a season bonus. The questions were:

1. Does supply run away or collapse?
2. Does the treasury survive cold days and season bonuses?
3. Is a minimum-stake sybil raid profitable?

Answering those on paper is not enough; the parameters were chosen after
running five scenarios and a sensitivity sweep.

## 2. Production recipe (`config/prod.json`)

| Parameter | Value | Notes |
|---|---:|---|
| Genesis supply | 1,000,000,000 WAR | 24 decimals |
| Treasury | 200,000,000 WAR | 20% of genesis |
| Community | 800,000,000 WAR | 80%; no faucet in production |
| Day length | 86,400,000,000,000 ns | 24 hours |
| Season | 30 days | map resets |
| Daily mint pool | 100,000 WAR | 0.01% of genesis/day |
| Loss burn | 20% (`2000` bp) | losing side's aggregate stake |
| Underdog | 2.00× (`20000` bp) | applied to the weaker side's base power |
| Cold line | 3,750,000 WAR | total base power below this = cold |
| Cold burn | 250,000 WAR | from treasury |
| Min / max stake | 1,000 / 100,000 WAR | per account, per day |
| Streak | +5%/day, cap 20 days | max 2.00× |
| Season bonus | 2% of treasury | split by season power |
| Claim window | 7 days | rewards can be closed; stakes never expire |
| Markets | not shipped in MVP | see limitations |

### Demo deployment (`config/demo.json`)

The 60-second demo is intentionally scaled for a five-minute testnet show:

| Parameter | Demo value |
|---|---:|
| Day length | 60 seconds |
| Daily mint pool | 500,000 WAR |
| Underdog | 1.50× |
| Cold line | 150,000 WAR |
| Cold burn | 25,000 WAR |
| Season bonus | 5% of treasury |
| Demo faucet | 100,000 WAR / account |

Both configurations are fixed in `new()` and readable with `get_config`.
The demo uses a lower cold line so two testnet wallets can start a real
battle without 200 seeded players.

## 3. Simulation model

`sim/simulate.py` is pure Python (standard library), fixed-seed, and mirrors
the contract formulas:

```
multiplier_bp = 10000 + min(streak, streak_cap_days) * streak_step_bp
power         = stake * multiplier_bp // 10000
effective     = weaker_base * underdog_bonus_bp // 10000
burn          = loser_total_stake * loss_burn_bp // 10000
reward_i      = daily_mint_pool * power_i // winner_base_power
season_i      = season_bonus * season_power_i // winner_season_power
```

Players are assigned a log-normal stake (median 25,000 WAR, sigma 0.8),
clipped to `[min_stake, max_stake_per_day]`. Each player participates with
the scenario's probability if their balance covers a stake. Streaks reset on
a missed day. Settlement, burns, mints, reward-vault dust, season bonuses and
claim-window burns are modelled. The accounting invariant is checked **every
day**:

```
genesis + minted - burned
  == sum(player balances) + external community + locked stake
     + treasury + reward_vault + season_vault
```

The simulator also verifies itself against the same fixtures as the Rust
tests before running (`self-test: contract formulas match`).

### Scenarios

| Key | Players | Faction split | Participation | Extra |
|---|---:|---:|---:|---|
| `balanced` | 200 | 50/50 | 60% | — |
| `imbalance` | 300 | 70/30 | 55% | — |
| `sybil` | 200 | 50/50 | 60% | +30% DOGS sybils at min stake for days 1–10 |
| `cold_start` | 30 | 50/50 | 40% | — |
| `churn` | 200 | 50/50 | 60% | 20% of players leave each week |

Scenario definitions live in `sim/scenarios/*.json` and in the
`SCENARIOS` list at the top of `sim/simulate.py`.

### Run

```bash
python3 sim/simulate.py
```

Outputs: `sim/results/summary.json`, per-scenario CSVs, and six SVG charts.
No pip install is required.

## 4. Results — fixed seed 42, 60 days

| Scenario | Supply Δ | Annualized | Cold days | DOGS / CATS day wins | Final treasury | Sybil ROI |
|---|---:|---:|---:|---:|---:|---:|
| Balanced | −1.90% | −11.6% | 4 / 60 (6.7%) | 36.7% / 56.7% | 191.1M | — |
| Imbalance 70/30 | −1.67% | −10.2% | 0 | 80.0% / 20.0% | 192.1M | — |
| Sybil raid | −1.88% | −11.5% | 2 | 55.0% / 41.7% | 191.6M | **−1.42%** |
| Cold start | −1.50% | −9.1% | 60 / 60 | 0 / 0 | 185.0M | — |
| Churn | −1.56% | −9.5% | 51 / 60 | 6.7% / 8.3% | 183.4M | — |

Key readings:

- The supply does not run away. The balanced scenario is **deflationary**
  because losing-stake burns and cold burns exceed the small daily mint.
- The treasury stays above 180M in every scenario. Season bonuses and cold
  burns are funded; the treasury never gets close to zero in 60 days.
- The balanced day win split is 36.7% / 56.7%, inside the 35–65% target.
  The fixed underdog bonus creates a mild underdog bias, by design.
- Cold start is cold every day: 30 players at 40% participation cannot reach
  the production cold line. That is the intended warning, not a bug.
- Churn kills turnout and therefore most days; the treasury still survives.

Charts (open the SVG files directly):

- [`../sim/results/supply.svg`](../sim/results/supply.svg)
- [`../sim/results/treasury.svg`](../sim/results/treasury.svg)
- [`../sim/results/cold_days.svg`](../sim/results/cold_days.svg)
- [`../sim/results/win_rates.svg`](../sim/results/win_rates.svg)
- [`../sim/results/sybil_roi.svg`](../sim/results/sybil_roi.svg)
- [`../sim/results/sensitivity.svg`](../sim/results/sensitivity.svg)

### Sensitivity (±20%)

All variations stay deflationary in the committed run; the range of final
supply is roughly −1.5% to −2.4% over 60 days. The full table is
`sim/results/sensitivity.csv`. The largest lever is `loss_burn_bp`;
`daily_mint_pool` and `cold_line` are second-order at these values.

### Multi-seed robustness

A 30-seed run of the chosen recipe (seed 42 is the committed run) gives:

| Metric | Result |
|---|---|
| Sybil ROI negative | 22 / 30 seeds |
| Sybil ROI mean / median | −4.52% / −6.96% |
| Balanced DOGS win rate inside 35–65% | 29 / 30 seeds |
| Balanced cold days inside 3–12 days (5–20%) | 20 / 30 seeds |

The sybil deterrent is a cost, not a wall: some seeds turn positive. The
README and About page say so. In the committed run sybils on DOGS return
−1.42% on staked capital while honest DOGS players return +0.74%; the
minimum-stake raid does not beat honest participation in that run, which is
the relevant "no disproportionate advantage" result.

## 5. Cross-check with Rust

The Python self-test pins the same fixtures as
`contracts/meme-wars/tests/game.rs`:

| Fixture | Python | Rust |
|---|---|---|
| stake 10,000, streak 1 | power 10,500 | `enlist_enforces_bounds_and_once_per_day` |
| 10,500 vs 12,600, underdog 1.5× | DOGS 15,750 wins | `underdog_bonus_can_flip_a_smaller_side` |
| losing 12,000, 20% burn | 2,400 | `winner_mints_rewards_and_loser_is_burned` |
| season 10M, power 79,000/89,500 | 8,826,815 | `season_settles_bonus_map_and_claims` |
| map recapture | ownership moves | `map_ownership_moves_when_a_tile_is_recaptured` |

`cargo test` covers 28 tests (NEP-141, joins, stakes, streaks, settlement,
ties, cold days, burns, claims, seasons, map ownership, accounting and
ordering).

## 6. What was deliberately not shipped

- **Spectator markets** (the P1 "bet on the day" layer): not shipped. It would
  add a second economic surface and frontend work; the core loop is already
  complete and verifiable. The config has no market parameters.
- **Faction switching**: join is permanent. This keeps season power keyed by
  `(season, account)` and avoids a migration. The limitation is disclosed.
- **Mainnet launchpad**: the core needs native mint/burn, so the demo is a
  self-deployed NEP-141. meme.cooking is marked explored, not integrated.
- **24-hour production testnet deployment**: the demo is 60 seconds. The
  production recipe is reproducible from `config/prod.json`; deploying it
  now would start a dormant 24-hour game with no players.
