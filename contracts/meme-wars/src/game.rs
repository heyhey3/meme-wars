use crate::events::fields;
use crate::*;
use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::{env, require};

#[near]
impl Contract {
    /// Join DOGS (0) or CATS (1). Exactly once per account; there is no faction
    /// switching, so season power can be keyed by `(season, account)`.
    pub fn join_faction(&mut self, faction: u8) {
        let account = env::predecessor_account_id();
        require!(valid_faction(faction), "faction must be 0 (DOGS) or 1 (CATS)");
        require!(self.is_registered(&account), "storage_deposit required first");
        require!(!self.members.contains_key(&account), "already joined a faction");

        let day = self.current_day();
        self.members.insert(
            account.clone(),
            Member {
                faction,
                locked_stake: U128(0),
                last_enlist_day: 0,
                streak: 0,
                longest_streak: 0,
                joined_day: day,
                total_enlistments: 0,
            },
        );
        self.emit_event(
            day,
            "join_faction",
            Some(account),
            Some(faction),
            None,
            fields([("joined_day", json!(day))]),
        );
    }

    /// Demo-only starter tokens. Disabled outside `demo_mode` deployments.
    pub fn claim_faucet(&mut self) {
        let account = env::predecessor_account_id();
        require!(self.config.demo_mode, "faucet is disabled on this deployment");
        require!(self.is_registered(&account), "storage_deposit required first");
        require!(
            !self.faucet_claimed.get(&account).copied().unwrap_or(false),
            "faucet already claimed"
        );

        let amount = self.config.demo_faucet_amount.0;
        require!(self.faucet_balance.0 >= amount, "faucet is empty");
        self.faucet_balance = U128(self.faucet_balance.0 - amount);
        self.faucet_claimed.insert(account.clone(), true);
        self.internal_credit(&account, amount);

        self.emit_event(
            self.current_day(),
            "faucet_claim",
            Some(account),
            None,
            Some(amount),
            fields([("remaining", json!(self.faucet_balance.0.to_string()))]),
        );
    }

    /// Stake once per day. Automatically settles up to `MAX_SETTLE_DAYS`
    /// overdue days, so the game heals itself without a cron job.
    pub fn enlist(&mut self, stake: U128) {
        let account = env::predecessor_account_id();
        let stake = stake.0;
        require!(self.is_registered(&account), "storage_deposit required first");

        let mut member = self
            .members
            .get(&account)
            .cloned()
            .unwrap_or_else(|| env::panic_str("join_faction first"));
        let faction = member.faction;
        require!(valid_faction(faction), "invalid faction in member state");

        let today = self.current_day();
        require!(today >= 1, "game has not started");
        require!(
            stake >= self.config.min_stake.0 && stake <= self.config.max_stake_per_day.0,
            "stake must be within min_stake and max_stake_per_day"
        );
        require!(
            !self.enlistments.contains_key(&(today, account.clone())),
            "already enlisted today"
        );

        self.auto_settle(today);

        let next_streak = if member.last_enlist_day.checked_add(1) == Some(today) {
            member
                .streak
                .checked_add(1)
                .unwrap_or_else(|| env::panic_str("streak overflow"))
        } else {
            1
        };
        let capped = next_streak.min(self.config.streak_cap_days);
        let multiplier = BP_DENOM as u128
            + (capped as u128)
                .checked_mul(self.config.streak_step_bp as u128)
                .unwrap_or_else(|| env::panic_str("multiplier overflow"));
        let multiplier_bp = u32::try_from(multiplier)
            .unwrap_or_else(|_| env::panic_str("multiplier overflow"));
        let power = stake
            .checked_mul(multiplier)
            .unwrap_or_else(|| env::panic_str("power overflow"))
            / BP_DENOM as u128;
        require!(power > 0, "power must be positive");

        self.internal_lock(&account, stake);

        let season = self.season_of_day(today);
        let mut season_state = self.get_or_create_season(season);
        require!(!season_state.settled, "season already settled");
        season_state.total_power[faction as usize] = U128(
            season_state.total_power[faction as usize]
                .0
                .checked_add(power)
                .unwrap_or_else(|| env::panic_str("season power overflow")),
        );
        self.seasons.insert(season, season_state);

        let season_key = (season, account.clone());
        let account_season_power = self
            .season_power
            .get(&season_key)
            .copied()
            .unwrap_or(U128(0))
            .0
            .checked_add(power)
            .unwrap_or_else(|| env::panic_str("account season power overflow"));
        self.season_power.insert(season_key, U128(account_season_power));

        let mut day = self.days.get(&today).cloned().unwrap_or_else(|| DayState::new(today));
        day.total_power[faction as usize] = U128(
            day.total_power[faction as usize]
                .0
                .checked_add(power)
                .unwrap_or_else(|| env::panic_str("day power overflow")),
        );
        day.total_stake[faction as usize] = U128(
            day.total_stake[faction as usize]
                .0
                .checked_add(stake)
                .unwrap_or_else(|| env::panic_str("day stake overflow")),
        );
        day.contributors[faction as usize] = day.contributors[faction as usize]
            .checked_add(1)
            .unwrap_or_else(|| env::panic_str("contributor overflow"));
        self.days.insert(today, day);

        self.enlistments.insert(
            (today, account.clone()),
            Enlistment {
                faction,
                stake: U128(stake),
                streak: next_streak,
                multiplier_bp,
                power: U128(power),
                claimed_stake: false,
                claimed_reward: false,
            },
        );

        member.last_enlist_day = today;
        member.streak = next_streak;
        member.longest_streak = member.longest_streak.max(next_streak);
        member.locked_stake = U128(
            member
                .locked_stake
                .0
                .checked_add(stake)
                .unwrap_or_else(|| env::panic_str("locked overflow")),
        );
        member.total_enlistments = member
            .total_enlistments
            .checked_add(1)
            .unwrap_or_else(|| env::panic_str("enlistment count overflow"));
        self.members.insert(account.clone(), member);

        self.factions[faction as usize].total_enlistments = self.factions[faction as usize]
            .total_enlistments
            .checked_add(1)
            .unwrap_or_else(|| env::panic_str("enlistment count overflow"));

        self.emit_event(
            today,
            "enlist",
            Some(account),
            Some(faction),
            Some(stake),
            fields([
                ("streak", json!(next_streak)),
                ("multiplier_bp", json!(multiplier_bp)),
                ("power", json!(power.to_string())),
                ("season", json!(season)),
            ]),
        );
    }

    /// Return a stake. Winners and cold/tie days pay 100%; the losing faction
    /// receives `100% - loss_burn_bp`. The burn already happened at settlement,
    /// so this only moves the survivor from `locked_total` back to balance.
    pub fn claim_stake(&mut self, day: u64) {
        let account = env::predecessor_account_id();
        require!(self.is_registered(&account), "storage_deposit required first");

        let mut enlistment = self
            .enlistments
            .get(&(day, account.clone()))
            .cloned()
            .unwrap_or_else(|| env::panic_str("no enlistment for this day"));
        require!(!enlistment.claimed_stake, "stake already claimed");

        let mut day_state =
            self.days.get(&day).cloned().unwrap_or_else(|| env::panic_str("day is not settled"));
        require!(day_state.settled, "day is not settled");

        let faction = enlistment.faction as usize;
        let is_winner = day_state.winner == Some(enlistment.faction);
        let payout = if day_state.cold || day_state.winner.is_none() || is_winner {
            enlistment.stake.0
        } else {
            mul_bp(enlistment.stake.0, BP_DENOM - self.config.loss_burn_bp)
        };

        enlistment.claimed_stake = true;
        self.enlistments.insert((day, account.clone()), enlistment.clone());

        day_state.claimed_stake[faction] = U128(
            day_state.claimed_stake[faction]
                .0
                .checked_add(payout)
                .unwrap_or_else(|| env::panic_str("claimed stake overflow")),
        );
        self.days.insert(day, day_state);

        self.locked_total = U128(
            self.locked_total
                .0
                .checked_sub(payout)
                .unwrap_or_else(|| env::panic_str("locked_total underflow")),
        );

        let mut member = self
            .members
            .get(&account)
            .cloned()
            .unwrap_or_else(|| env::panic_str("member state missing"));
        member.locked_stake = U128(
            member
                .locked_stake
                .0
                .checked_sub(enlistment.stake.0)
                .unwrap_or_else(|| env::panic_str("member locked underflow")),
        );
        self.members.insert(account.clone(), member);

        self.internal_credit(&account, payout);
        self.emit_event(
            day,
            "stake_claim",
            Some(account),
            Some(enlistment.faction),
            Some(payout),
            fields([("stake", json!(enlistment.stake.0.to_string()))]),
        );
    }

    /// Claim a winner's share of the day's fixed mint pool. Shares are
    /// proportional to base power, so the underdog bonus never changes the split.
    pub fn claim_reward(&mut self, day: u64) {
        let account = env::predecessor_account_id();
        require!(self.is_registered(&account), "storage_deposit required first");

        let mut enlistment = self
            .enlistments
            .get(&(day, account.clone()))
            .cloned()
            .unwrap_or_else(|| env::panic_str("no enlistment for this day"));
        require!(!enlistment.claimed_reward, "reward already claimed");

        let mut day_state =
            self.days.get(&day).cloned().unwrap_or_else(|| env::panic_str("day is not settled"));
        require!(day_state.settled, "day is not settled");
        require!(!day_state.rewards_closed, "reward claim window is closed");
        let winner = day_state
            .winner
            .unwrap_or_else(|| env::panic_str("this day has no winning faction"));
        require!(enlistment.faction == winner, "only the winning faction earns rewards");
        require!(day_state.base_power_winner.0 > 0, "reward denominator is zero");

        let payout = mul_div(
            day_state.reward_pool.0,
            enlistment.power.0,
            day_state.base_power_winner.0,
        );

        enlistment.claimed_reward = true;
        self.enlistments.insert((day, account.clone()), enlistment.clone());

        day_state.claimed_reward = U128(
            day_state
                .claimed_reward
                .0
                .checked_add(payout)
                .unwrap_or_else(|| env::panic_str("claimed reward overflow")),
        );
        let base_power_winner = day_state.base_power_winner.0;
        self.days.insert(day, day_state);

        self.reward_vault = U128(
            self.reward_vault
                .0
                .checked_sub(payout)
                .unwrap_or_else(|| env::panic_str("reward vault underflow")),
        );
        self.internal_credit(&account, payout);

        self.emit_event(
            day,
            "reward_claim",
            Some(account),
            Some(enlistment.faction),
            Some(payout),
            fields([
                ("power", json!(enlistment.power.0.to_string())),
                ("base_power_winner", json!(base_power_winner.to_string())),
            ]),
        );
    }

    /// Claim a winning faction member's share of the season bonus.
    pub fn claim_season(&mut self, season: u32) {
        let account = env::predecessor_account_id();
        require!(self.is_registered(&account), "storage_deposit required first");

        let mut season_state =
            self.seasons.get(&season).cloned().unwrap_or_else(|| env::panic_str("unknown season"));
        require!(season_state.settled, "season is not settled");
        require!(!season_state.rewards_closed, "season rewards are closed");
        let winner = season_state
            .winner
            .unwrap_or_else(|| env::panic_str("season ended in a map tie"));

        let member = self
            .members
            .get(&account)
            .cloned()
            .unwrap_or_else(|| env::panic_str("join_faction first"));
        require!(member.faction == winner, "only the winning faction can claim");

        let key = (season, account.clone());
        require!(
            !self.season_claimed.get(&key).copied().unwrap_or(false),
            "season reward already claimed"
        );
        let power = self.season_power.get(&key).copied().unwrap_or(U128(0)).0;
        require!(power > 0, "no season power for this account");
        let denominator = season_state.total_power[winner as usize].0;
        require!(denominator > 0, "season power denominator is zero");

        let payout = mul_div(season_state.bonus_pool.0, power, denominator);
        self.season_claimed.insert(key, true);
        season_state.claimed = U128(
            season_state
                .claimed
                .0
                .checked_add(payout)
                .unwrap_or_else(|| env::panic_str("season claimed overflow")),
        );
        let end_day = season_state.end_day;
        self.seasons.insert(season, season_state);

        self.season_reward_vault = U128(
            self.season_reward_vault
                .0
                .checked_sub(payout)
                .unwrap_or_else(|| env::panic_str("season vault underflow")),
        );
        self.internal_credit(&account, payout);

        self.emit_event(
            end_day,
            "season_claim",
            Some(account),
            Some(winner),
            Some(payout),
            fields([
                ("season", json!(season)),
                ("power", json!(power.to_string())),
                ("denominator", json!(denominator.to_string())),
            ]),
        );
    }

    /// After `claim_window_days`, anyone can burn the unclaimed part of a day's
    /// reward pool. Stakes themselves never expire, so users can always reclaim
    /// their locked tokens (including on a cold/tie day).
    pub fn close_claims(&mut self, day: u64) {
        let mut day_state =
            self.days.get(&day).cloned().unwrap_or_else(|| env::panic_str("unknown day"));
        require!(day_state.settled, "day is not settled");
        require!(!day_state.rewards_closed, "rewards already closed");

        let window_end = day
            .checked_add(self.config.claim_window_days as u64)
            .unwrap_or_else(|| env::panic_str("day overflow"));
        require!(self.current_day() > window_end, "reward claim window is still open");

        let unclaimed = day_state.reward_pool.0.saturating_sub(day_state.claimed_reward.0);
        if unclaimed > 0 {
            self.reward_vault = U128(
                self.reward_vault
                    .0
                    .checked_sub(unclaimed)
                    .unwrap_or_else(|| env::panic_str("reward vault underflow")),
            );
            self.internal_burn_supply(unclaimed);
        }
        day_state.rewards_closed = true;
        self.days.insert(day, day_state);

        self.emit_event(
            day,
            "claims_closed",
            Some(env::predecessor_account_id()),
            None,
            Some(unclaimed),
            fields([]),
        );
    }

    pub(crate) fn get_or_create_season(&mut self, season: u32) -> SeasonState {
        if let Some(existing) = self.seasons.get(&season) {
            return existing.clone();
        }
        let state = SeasonState::new(
            season,
            self.season_start_day(season),
            self.season_end_day(season),
        );
        self.seasons.insert(season, state.clone());
        state
    }
}
