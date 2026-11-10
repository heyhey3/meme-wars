use crate::events::fields;
use crate::*;
use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::{env, require};

#[near]
impl Contract {
    /// Settle one finished day. Permissionless and idempotent: repeating a
    /// settled day panics without changing state, and days must be settled in
    /// order so the underdog/streak/season bookkeeping stays deterministic.
    pub fn settle_day(&mut self, day: u64) {
        require!(day >= 1, "day must be >= 1");
        require!(day > self.last_settled_day, "day already settled");
        require!(
            day == self.last_settled_day.saturating_add(1),
            "days must be settled in order"
        );
        require!(day < self.current_day(), "day has not ended yet");
        self.settle_day_internal(day);
    }
}

impl Contract {
    /// Called from `enlist` so a quiet game catches up without a cron job.
    /// Each transaction settles at most `MAX_SETTLE_DAYS` days.
    pub(crate) fn auto_settle(&mut self, today: u64) {
        let mut count = 0u64;
        while self.last_settled_day.saturating_add(1) < today && count < MAX_SETTLE_DAYS {
            let next = self.last_settled_day.saturating_add(1);
            self.settle_day_internal(next);
            count += 1;
        }
        require!(
            self.last_settled_day.saturating_add(1) >= today,
            "too many unsettled days; call settle_day first"
        );
    }

    pub(crate) fn settle_day_internal(&mut self, day: u64) {
        let mut day_state =
            self.days.get(&day).cloned().unwrap_or_else(|| DayState::new(day));
        require!(!day_state.settled, "day already settled");

        let p0 = day_state.total_power[0].0;
        let p1 = day_state.total_power[1].0;
        let total_power = p0
            .checked_add(p1)
            .unwrap_or_else(|| env::panic_str("total power overflow"));
        let cold = total_power < self.config.cold_line.0;

        let mut winner: Option<u8> = None;
        let mut burned = 0u128;
        let mut minted = 0u128;
        let mut tile: Option<u8> = None;
        let mut previous_owner: u8 = 0;
        let mut loser: Option<u8> = None;

        if cold {
            day_state.cold = true;
            day_state.effective_power = [U128(p0), U128(p1)];
            self.factions[0].win_streak = 0;
            self.factions[1].win_streak = 0;

            let burn = self.config.cold_burn.0.min(self.treasury_balance.0);
            if burn > 0 {
                self.treasury_balance = U128(self.treasury_balance.0 - burn);
                self.internal_burn_supply(burn);
            }
            burned = burn;
        } else {
            let mut effective = [p0, p1];
            if p0 < p1 {
                effective[0] = mul_bp(p0, self.config.underdog_bonus_bp);
            } else if p1 < p0 {
                effective[1] = mul_bp(p1, self.config.underdog_bonus_bp);
            }
            day_state.effective_power = [U128(effective[0]), U128(effective[1])];

            if effective[0] == effective[1] {
                // Tie: everyone gets their stake back; no mint, no burn, no tile.
                self.factions[0].win_streak = 0;
                self.factions[1].win_streak = 0;
            } else {
                let w = if effective[0] > effective[1] { 0u8 } else { 1u8 };
                let l = 1u8 - w;
                winner = Some(w);
                loser = Some(l);

                let burn = mul_bp(
                    day_state.total_stake[l as usize].0,
                    self.config.loss_burn_bp,
                );
                require!(
                    burn <= self.locked_total.0,
                    "burn exceeds locked stake"
                );
                self.locked_total = U128(self.locked_total.0 - burn);
                self.internal_burn_supply(burn);
                burned = burn;

                minted = self.config.daily_mint_pool.0;
                self.internal_mint_reward(minted);
                day_state.reward_pool = U128(minted);
                day_state.base_power_winner = day_state.total_power[w as usize];

                let t = ((day - 1) % MAP_TILES as u64) as u8;
                let tile_index = t as usize;
                previous_owner = self.map[tile_index];

                // Maintain exact current ownership counts. A later capture of
                // the same tile moves it from the old owner to the new one.
                if previous_owner != w + 1 {
                    if previous_owner != 0 {
                        let previous = &mut self.factions[(previous_owner - 1) as usize];
                        previous.season_tiles = previous.season_tiles.saturating_sub(1);
                    }
                    let winner_state = &mut self.factions[w as usize];
                    winner_state.season_tiles = winner_state
                        .season_tiles
                        .checked_add(1)
                        .unwrap_or_else(|| env::panic_str("tile overflow"));
                }
                self.map[tile_index] = w + 1;
                tile = Some(t);

                let faction = &mut self.factions[w as usize];
                faction.win_streak = faction
                    .win_streak
                    .checked_add(1)
                    .unwrap_or_else(|| env::panic_str("win streak overflow"));
                faction.longest_win_streak = faction.longest_win_streak.max(faction.win_streak);
                faction.total_wins = faction
                    .total_wins
                    .checked_add(1)
                    .unwrap_or_else(|| env::panic_str("win count overflow"));
                self.factions[l as usize].win_streak = 0;
            }
        }

        day_state.winner = winner;
        day_state.tile = tile;
        day_state.burned = U128(burned);
        day_state.settled = true;
        self.days.insert(day, day_state.clone());
        self.last_settled_day = day;

        // Keep the season record's tile counts equal to the live map at all
        // times, not only at season close. This is what the UI reads between
        // settlements.
        let season_index = self.season_of_day(day);
        let mut season_state = self.get_or_create_season(season_index);
        season_state.tiles = [
            self.factions[0].season_tiles,
            self.factions[1].season_tiles,
        ];
        self.seasons.insert(season_index, season_state);

        // --- events -----------------------------------------------------------
        if cold {
            self.emit_event(
                day,
                "cold_day",
                None,
                None,
                Some(burned),
                fields([
                    ("cold_line", json!(self.config.cold_line.0.to_string())),
                    ("total_power", json!(total_power.to_string())),
                ]),
            );
        }
        if minted > 0 {
            self.emit_event(
                day,
                "reward_mint",
                None,
                winner,
                Some(minted),
                fields([("reward_pool", json!(minted.to_string()))]),
            );
        }
        if burned > 0 && !cold {
            self.emit_event(
                day,
                "stake_burn",
                None,
                loser,
                Some(burned),
                fields([("loss_burn_bp", json!(self.config.loss_burn_bp))]),
            );
        }
        if let Some(t) = tile {
            self.emit_event(
                day,
                "map_capture",
                None,
                winner,
                None,
                fields([
                    ("tile", json!(t)),
                    ("previous_owner", json!(previous_owner)),
                ]),
            );
        }
        self.emit_event(
            day,
            "day_settled",
            None,
            winner,
            None,
            fields([
                ("winner", json!(winner)),
                ("cold", json!(cold)),
                ("total_power", json!(day_state.total_power)),
                ("effective_power", json!(day_state.effective_power)),
                ("total_stake", json!(day_state.total_stake)),
                ("contributors", json!(day_state.contributors)),
                ("reward_pool", json!(day_state.reward_pool.0.to_string())),
                ("burned", json!(burned.to_string())),
                ("tile", json!(tile)),
                ("base_power_winner", json!(day_state.base_power_winner.0.to_string())),
            ]),
        );

        // Season rollover happens after the final day's tile is captured.
        if day == self.season_end_day(season_index) {
            self.settle_season_internal(season_index, day);
        }
    }

    fn settle_season_internal(&mut self, season: u32, end_day: u64) {
        let mut season_state = self.get_or_create_season(season);
        require!(!season_state.settled, "season already settled");

        season_state.end_day = end_day;
        season_state.settled = true;
        season_state.tiles = [
            self.factions[0].season_tiles,
            self.factions[1].season_tiles,
        ];
        season_state.final_map = self.map.to_vec();
        season_state.winner = if season_state.tiles[0] > season_state.tiles[1] {
            Some(0)
        } else if season_state.tiles[1] > season_state.tiles[0] {
            Some(1)
        } else {
            None
        };

        if season_state.winner.is_some() {
            let treasury = self.treasury_balance.0;
            let bonus = mul_bp(treasury, self.config.season_bonus_bp).min(treasury);
            self.treasury_balance = U128(treasury - bonus);
            self.season_reward_vault = U128(
                self.season_reward_vault
                    .0
                    .checked_add(bonus)
                    .unwrap_or_else(|| env::panic_str("season vault overflow")),
            );
            season_state.bonus_pool = U128(bonus);
        }

        // The previous season's unclaimed bonus is burned when the next season
        // ends. This gives winners a full season to claim and keeps the vault
        // from accumulating dead supply forever.
        if season > 1 {
            let previous_key = season - 1;
            if let Some(mut previous) = self.seasons.get(&previous_key).cloned() {
                if previous.settled && !previous.rewards_closed {
                    let unclaimed = previous.bonus_pool.0.saturating_sub(previous.claimed.0);
                    if unclaimed > 0 {
                        self.season_reward_vault = U128(
                            self.season_reward_vault
                                .0
                                .checked_sub(unclaimed)
                                .unwrap_or_else(|| {
                                    env::panic_str("season vault underflow on close")
                                }),
                        );
                        self.internal_burn_supply(unclaimed);
                    }
                    previous.rewards_closed = true;
                    self.seasons.insert(previous_key, previous);
                    self.emit_event(
                        end_day,
                        "season_claims_closed",
                        None,
                        None,
                        Some(unclaimed),
                        fields([("season", json!(previous_key))]),
                    );
                }
            }
        }

        let winner = season_state.winner;
        let bonus = season_state.bonus_pool;
        let tiles = season_state.tiles;
        let totals = season_state.total_power;
        let final_map = season_state.final_map.clone();
        self.seasons.insert(season, season_state);

        // New season, empty map. Tile counts reset on the faction states.
        self.map = [0u8; MAP_TILES];
        self.factions[0].season_tiles = 0;
        self.factions[1].season_tiles = 0;

        self.emit_event(
            end_day,
            "season_end",
            None,
            winner,
            Some(bonus.0),
            fields([
                ("season", json!(season)),
                ("bonus_pool", json!(bonus.0.to_string())),
                ("tiles", json!(tiles)),
                ("total_power", json!(totals)),
                ("final_map", json!(final_map)),
            ]),
        );
    }
}
