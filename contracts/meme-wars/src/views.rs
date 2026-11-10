use crate::*;
use near_sdk::json_types::U128;
use near_sdk::{env, near, AccountId};

#[near]
impl Contract {
    pub fn get_config(&self) -> Config {
        self.config.clone()
    }

    pub fn get_version(&self) -> String {
        env!("CARGO_PKG_VERSION").to_string()
    }

    pub fn get_clock(&self) -> ClockInfo {
        let current_day = self.current_day().max(1);
        ClockInfo {
            now_ns: env::block_timestamp(),
            epoch_start_ns: self.config.epoch_start_ns,
            day_length_ns: self.config.day_length_ns,
            current_day,
            day_start_ns: self.day_start_ns(current_day),
            day_end_ns: self.day_end_ns(current_day),
            last_settled_day: self.last_settled_day,
            current_season: self.season_of_day(current_day),
            season_days: self.config.season_days,
        }
    }

    pub fn get_current_day(&self) -> u64 {
        self.current_day()
    }

    pub fn get_current_season(&self) -> u32 {
        self.season_of_day(self.current_day().max(1))
    }

    pub fn get_member(&self, account_id: AccountId) -> Option<Member> {
        self.members.get(&account_id).cloned()
    }

    pub fn get_faction(&self, faction: u8) -> Option<FactionState> {
        self.factions.get(faction as usize).cloned()
    }

    pub fn get_factions(&self) -> Vec<FactionState> {
        self.factions.to_vec()
    }

    pub fn get_day(&self, day: u64) -> Option<DayState> {
        self.days.get(&day).cloned()
    }

    /// Inclusive range, at most `MAX_SCAN_DAYS` days. Free view.
    pub fn get_days(&self, from: u64, to: u64) -> Vec<DayState> {
        let start = from.max(1);
        let end = to.min(start.saturating_add(MAX_SCAN_DAYS - 1));
        if start > end {
            return Vec::new();
        }
        let mut out = Vec::new();
        let mut day = start;
        while day <= end {
            if let Some(state) = self.days.get(&day) {
                out.push(state.clone());
            }
            day += 1;
        }
        out
    }

    pub fn get_season(&self, season: u32) -> Option<SeasonState> {
        self.seasons.get(&season).cloned()
    }

    pub fn get_seasons(&self, from: u32, to: u32) -> Vec<SeasonState> {
        let end = to.min(from.saturating_add(29));
        if from > end {
            return Vec::new();
        }
        let mut out = Vec::new();
        let mut season = from;
        while season <= end {
            if let Some(state) = self.seasons.get(&season) {
                out.push(state.clone());
            }
            season += 1;
        }
        out
    }

    /// map[i]: 0 = empty, 1 = DOGS, 2 = CATS.
    pub fn get_map(&self) -> Vec<u8> {
        self.map.to_vec()
    }

    /// Most recent `limit` events, oldest-first. For the live event feed.
    pub fn get_log_tail(&self, limit: u64) -> Vec<LogEntry> {
        let limit = limit.min(100);
        let start = self.next_log_id.saturating_sub(limit);
        let mut out = Vec::new();
        let mut id = start;
        while id < self.next_log_id {
            if let Some(entry) = self.log.get((id % MAX_LOG_ENTRIES) as u32) {
                out.push(entry.clone());
            }
            id += 1;
        }
        out
    }

    /// `from` is a global log id, not a ring index. Newest entries have the
    /// highest ids. `limit` is clamped to 100.
    pub fn get_log(&self, from: u64, limit: u64) -> Vec<LogEntry> {
        let first_available = self.next_log_id.saturating_sub(MAX_LOG_ENTRIES);
        let start = from.max(first_available);
        let end = start
            .saturating_add(limit.min(100))
            .min(self.next_log_id);
        let mut out = Vec::new();
        let mut id = start;
        while id < end {
            if let Some(entry) = self.log.get((id % MAX_LOG_ENTRIES) as u32) {
                out.push(entry.clone());
            }
            id += 1;
        }
        out
    }

    pub fn get_enlistment(&self, day: u64, account_id: AccountId) -> Option<Enlistment> {
        self.enlistments.get(&(day, account_id)).cloned()
    }

    /// Inclusive range, at most `MAX_SCAN_DAYS` days.
    pub fn get_enlistments(
        &self,
        account_id: AccountId,
        from_day: u64,
        limit: u64,
    ) -> Vec<EnlistmentAt> {
        let start = from_day.max(1);
        let end = start.saturating_add(limit.min(MAX_SCAN_DAYS).saturating_sub(1));
        let mut out = Vec::new();
        let mut day = start;
        while day <= end {
            if let Some(enlistment) = self.enlistments.get(&(day, account_id.clone())) {
                out.push(EnlistmentAt { day, enlistment: enlistment.clone() });
            }
            day += 1;
        }
        out
    }

    /// Claim previews for a settled-day range. At most `MAX_SCAN_DAYS` days.
    pub fn get_claims(
        &self,
        account_id: AccountId,
        from_day: u64,
        to_day: u64,
    ) -> Vec<ClaimItem> {
        let today = self.current_day();
        if today <= 1 {
            return Vec::new();
        }
        let start = from_day.max(1);
        let end = to_day
            .min(today.saturating_sub(1))
            .min(start.saturating_add(MAX_SCAN_DAYS - 1));
        if start > end {
            return Vec::new();
        }

        let mut out = Vec::new();
        let mut day = start;
        while day <= end {
            if let Some(enlistment) = self.enlistments.get(&(day, account_id.clone())) {
                let day_state = self.days.get(&day);
                let settled = day_state.map(|d| d.settled).unwrap_or(false);
                let winner = day_state.and_then(|d| d.winner);
                let cold = day_state.map(|d| d.cold).unwrap_or(false);
                let rewards_closed = day_state.map(|d| d.rewards_closed).unwrap_or(false);

                let stake_payout = if enlistment.claimed_stake || !settled {
                    0
                } else if cold || winner.is_none() || winner == Some(enlistment.faction) {
                    enlistment.stake.0
                } else {
                    mul_bp(enlistment.stake.0, BP_DENOM - self.config.loss_burn_bp)
                };

                let reward_payout = match day_state {
                    Some(d)
                        if settled
                            && !rewards_closed
                            && !enlistment.claimed_reward
                            && winner == Some(enlistment.faction)
                            && d.base_power_winner.0 > 0 =>
                    {
                        mul_div(d.reward_pool.0, enlistment.power.0, d.base_power_winner.0)
                    }
                    _ => 0,
                };

                out.push(ClaimItem {
                    day,
                    faction: enlistment.faction,
                    stake: enlistment.stake,
                    stake_payout: U128(stake_payout),
                    stake_claimed: enlistment.claimed_stake,
                    reward_payout: U128(reward_payout),
                    reward_claimed: enlistment.claimed_reward,
                    settled,
                    winner,
                    cold,
                    rewards_closed,
                });
            }
            day += 1;
        }
        out
    }

    pub fn get_locked_balance(&self, account_id: AccountId) -> U128 {
        self.members
            .get(&account_id)
            .map(|m| m.locked_stake)
            .unwrap_or(U128(0))
    }

    pub fn get_total_balance(&self, account_id: AccountId) -> U128 {
        let available = self.ft.accounts.get(&account_id).unwrap_or(0);
        let locked = self
            .members
            .get(&account_id)
            .map(|m| m.locked_stake.0)
            .unwrap_or(0);
        U128(available.saturating_add(locked))
    }

    pub fn get_player_balance(&self, account_id: AccountId) -> PlayerLocked {
        let available = self.ft.accounts.get(&account_id).unwrap_or(0);
        let locked = self
            .members
            .get(&account_id)
            .map(|m| m.locked_stake.0)
            .unwrap_or(0);
        PlayerLocked {
            available: U128(available),
            locked: U128(locked),
            total: U128(available.saturating_add(locked)),
        }
    }

    pub fn get_stats(&self) -> Stats {
        Stats {
            total_supply: U128(self.ft.total_supply),
            genesis_supply: self.config.genesis_supply,
            treasury_balance: self.treasury_balance,
            faucet_balance: self.faucet_balance,
            locked_total: self.locked_total,
            reward_vault: self.reward_vault,
            season_reward_vault: self.season_reward_vault,
            burned_total: self.burned_total,
            reward_minted_total: self.reward_minted_total,
            current_day: self.current_day(),
            last_settled_day: self.last_settled_day,
            current_season: self.season_of_day(self.current_day().max(1)),
            demo_mode: self.config.demo_mode,
        }
    }

    pub fn get_faucet_state(&self, account_id: AccountId) -> FaucetState {
        let registered = self.is_registered(&account_id);
        let claimed = self.faucet_claimed.get(&account_id).copied().unwrap_or(false);
        let amount = self.config.demo_faucet_amount;
        let eligible = self.config.demo_mode
            && registered
            && !claimed
            && self.faucet_balance.0 >= amount.0;
        FaucetState {
            demo_mode: self.config.demo_mode,
            registered,
            claimed,
            amount,
            remaining: self.faucet_balance,
            eligible,
        }
    }

    pub fn get_season_player(&self, season: u32, account_id: AccountId) -> SeasonPlayer {
        let member = self.members.get(&account_id).cloned();
        let faction = member.map(|m| m.faction);
        let power = self
            .season_power
            .get(&(season, account_id.clone()))
            .copied()
            .unwrap_or(U128(0));
        let claimed = self
            .season_claimed
            .get(&(season, account_id))
            .copied()
            .unwrap_or(false);
        let season_state = self.seasons.get(&season).cloned();

        let mut eligible = false;
        let mut payout = U128(0);
        if let Some(state) = season_state {
            if state.settled
                && !state.rewards_closed
                && !claimed
                && state.winner.is_some()
                && faction == state.winner
                && power.0 > 0
            {
                let winner = state.winner.unwrap();
                let denominator = state.total_power[winner as usize].0;
                if denominator > 0 {
                    eligible = true;
                    payout = U128(mul_div(state.bonus_pool.0, power.0, denominator));
                }
            }
        }

        SeasonPlayer {
            season,
            faction,
            power,
            claimed,
            eligible,
            payout_preview: payout,
        }
    }

    pub fn get_enlist_preview(
        &self,
        account_id: AccountId,
        stake: U128,
    ) -> Option<EnlistPreview> {
        let member = self.members.get(&account_id)?;
        let today = self.current_day();
        let next_streak = if member.last_enlist_day.checked_add(1) == Some(today) {
            member.streak.saturating_add(1)
        } else {
            1
        };
        let capped = next_streak.min(self.config.streak_cap_days);
        let multiplier_bp = BP_DENOM
            .saturating_add(capped.saturating_mul(self.config.streak_step_bp));
        let power = mul_bp(stake.0, multiplier_bp);
        let available = self.ft.accounts.get(&account_id).unwrap_or(0);
        Some(EnlistPreview {
            day: today,
            faction: member.faction,
            stake,
            next_streak,
            multiplier_bp,
            power: U128(power),
            available_balance: U128(available),
            already_enlisted: self
                .enlistments
                .contains_key(&(today, account_id.clone())),
            min_stake: self.config.min_stake,
            max_stake_per_day: self.config.max_stake_per_day,
        })
    }

    /// Sanity check used by tests and the verification script. Anyone can call
    /// the view; it is intentionally cheap and does not iterate accounts.
    pub fn check_supply(&self) -> bool {
        self.ft.total_supply
            == self
                .config
                .genesis_supply
                .0
                .checked_add(self.reward_minted_total.0)
                .and_then(|v| v.checked_sub(self.burned_total.0))
                .unwrap_or(u128::MAX)
    }

    /// Guard used by tests: a positive stake on a settled day must never make
    /// `locked_total` negative. Returns the locked bucket for inspection.
    pub fn get_locked_total(&self) -> U128 {
        self.locked_total
    }
}
