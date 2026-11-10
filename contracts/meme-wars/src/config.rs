use near_sdk::json_types::U128;
use near_sdk::{near, require};

/// All game parameters. Written once in `new()` and never mutable.
///
/// Amounts are in the token's smallest unit. Ratios are basis points
/// (10_000 = 100%). There is deliberately no `set_config`, `pause`,
/// `upgrade` or treasury-withdraw method anywhere in the contract.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Config {
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub icon: Option<String>,

    // Genesis allocation. Must satisfy:
    // genesis_supply == treasury_allocation + community_allocation + demo_faucet_pool
    pub genesis_supply: U128,
    pub treasury_allocation: U128,
    pub community_allocation: U128,
    pub demo_faucet_pool: U128,

    // Demo-only faucet. `demo_mode = false` requires both to be zero.
    pub demo_faucet_amount: U128,
    pub demo_mode: bool,

    // Clock. `epoch_start_ns = 0` is resolved to the deploy block timestamp.
    pub day_length_ns: u64,
    pub epoch_start_ns: u64,

    // War parameters.
    pub season_days: u32,
    pub daily_mint_pool: U128,
    pub loss_burn_bp: u32,
    pub underdog_bonus_bp: u32,
    pub cold_line: U128,
    pub cold_burn: U128,
    pub min_stake: U128,
    pub max_stake_per_day: U128,
    pub streak_step_bp: u32,
    pub streak_cap_days: u32,
    pub claim_window_days: u32,
    pub season_bonus_bp: u32,
}

impl Config {
    /// Panics on any parameter set that could brick the game or violate an
    /// invariant. Called exactly once, inside `new()`.
    pub fn validate(&self) {
        require!(!self.name.is_empty() && self.name.len() <= 64, "name must be 1..=64 chars");
        require!(!self.symbol.is_empty() && self.symbol.len() <= 16, "symbol must be 1..=16 chars");
        require!(self.decimals <= 24, "decimals must be <= 24");

        let treasury = self.treasury_allocation.0;
        let community = self.community_allocation.0;
        let faucet = self.demo_faucet_pool.0;
        let allocated = treasury
            .checked_add(community)
            .and_then(|v| v.checked_add(faucet))
            .unwrap_or_else(|| near_sdk::env::panic_str("allocation overflow"));
        require!(allocated == self.genesis_supply.0, "genesis_supply must equal the three allocations");
        require!(self.genesis_supply.0 > 0, "genesis_supply must be positive");

        require!(self.day_length_ns >= 1_000_000_000, "day_length_ns must be >= 1 second");
        require!(
            self.day_length_ns <= 30 * 24 * 60 * 60 * 1_000_000_000,
            "day_length_ns must be <= 30 days"
        );
        require!(self.epoch_start_ns > 0, "epoch_start_ns must be resolved or zero");

        require!(self.season_days >= 1 && self.season_days <= 365, "season_days must be 1..=365");
        require!(self.daily_mint_pool.0 > 0, "daily_mint_pool must be positive");
        require!(self.loss_burn_bp <= 5_000, "loss_burn_bp must be <= 5000");
        require!(
            self.underdog_bonus_bp >= 10_000 && self.underdog_bonus_bp <= 20_000,
            "underdog_bonus_bp must be 10000..=20000"
        );
        require!(self.cold_burn.0 <= treasury, "cold_burn must not exceed the treasury");
        require!(self.min_stake.0 > 0, "min_stake must be positive");
        require!(
            self.max_stake_per_day.0 >= self.min_stake.0,
            "max_stake_per_day must be >= min_stake"
        );
        require!(
            self.max_stake_per_day.0 <= self.genesis_supply.0,
            "max_stake_per_day must not exceed genesis supply"
        );
        require!(
            self.streak_step_bp > 0 && self.streak_step_bp <= 2_000,
            "streak_step_bp must be 1..=2000"
        );
        require!(
            self.streak_cap_days >= 1 && self.streak_cap_days <= 365,
            "streak_cap_days must be 1..=365"
        );
        require!(
            (self.streak_cap_days as u64) * (self.streak_step_bp as u64) <= 10_000,
            "streak multiplier must cap at 2x"
        );
        require!(
            self.claim_window_days >= 1 && self.claim_window_days <= 365,
            "claim_window_days must be 1..=365"
        );
        require!(self.season_bonus_bp <= 1_000, "season_bonus_bp must be <= 1000");

        if self.demo_mode {
            require!(faucet > 0, "demo_mode needs a demo_faucet_pool");
            require!(
                self.demo_faucet_amount.0 > 0 && self.demo_faucet_amount.0 <= faucet,
                "demo_faucet_amount must be positive and <= the pool"
            );
        } else {
            require!(faucet == 0, "production config must have demo_faucet_pool = 0");
            require!(
                self.demo_faucet_amount.0 == 0,
                "production config must have demo_faucet_amount = 0"
            );
        }
    }
}
