use near_sdk::json_types::U128;
use near_sdk::{near, require, AccountId};
use primitive_types::U256;

pub const FACTION_DOGS: u8 = 0;
pub const FACTION_CATS: u8 = 1;
pub const FACTION_COUNT: usize = 2;
pub const MAP_TILES: usize = 25;
pub const BP_DENOM: u32 = 10_000;
pub const MAX_LOG_ENTRIES: u64 = 200;
/// How many overdue days a single `enlist` may settle before demanding an
/// explicit `settle_day` call. Bounded so one transaction cannot loop forever.
pub const MAX_SETTLE_DAYS: u64 = 7;
/// Upper bound for claim-scanning views; views are free but RPC responses are not.
pub const MAX_SCAN_DAYS: u64 = 60;

#[inline]
pub fn mul_bp(amount: u128, bp: u32) -> u128 {
    amount
        .checked_mul(bp as u128)
        .unwrap_or_else(|| near_sdk::env::panic_str("amount * bp overflow"))
        / BP_DENOM as u128
}

/// Computes `a * b / c` with a 256-bit intermediate. Reward shares multiply a
/// vault-sized number by a power-sized number, which can exceed u128.
pub fn mul_div(a: u128, b: u128, c: u128) -> u128 {
    require!(c > 0, "division by zero");
    let q = U256::from(a) * U256::from(b) / U256::from(c);
    require!(q <= U256::from(u128::MAX), "mul_div overflow");
    q.as_u128()
}

#[inline]
pub fn valid_faction(faction: u8) -> bool {
    (faction as usize) < FACTION_COUNT
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Member {
    pub faction: u8,
    /// Nominal stake still locked on this account's unclaimed enlistments.
    /// Losers receive 80% of a stake, but the full stake is removed here on claim.
    pub locked_stake: U128,
    pub last_enlist_day: u64,
    pub streak: u32,
    pub longest_streak: u32,
    pub joined_day: u64,
    pub total_enlistments: u64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct FactionState {
    pub id: u8,
    pub win_streak: u32,
    pub longest_win_streak: u32,
    /// Tiles captured in the active season; reset when the season settles.
    pub season_tiles: u8,
    pub total_wins: u64,
    pub total_enlistments: u64,
}

impl FactionState {
    pub fn new(id: u8) -> Self {
        Self { id, ..Default::default() }
    }
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct DayState {
    pub day: u64,
    /// Sum of individual base power (stake * streak multiplier).
    pub total_power: [U128; 2],
    /// Power after the underdog bonus; this is what decides the winner.
    pub effective_power: [U128; 2],
    pub total_stake: [U128; 2],
    pub contributors: [u32; 2],
    pub winner: Option<u8>,
    pub cold: bool,
    pub settled: bool,
    pub reward_pool: U128,
    /// Base power of the winning faction, used as the reward-share denominator.
    pub base_power_winner: U128,
    pub burned: U128,
    pub tile: Option<u8>,
    pub claimed_reward: U128,
    pub claimed_stake: [U128; 2],
    /// Set once the reward claim window closes; unclaimed rewards are burned.
    pub rewards_closed: bool,
}

impl DayState {
    pub fn new(day: u64) -> Self {
        Self { day, ..Default::default() }
    }
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Enlistment {
    pub faction: u8,
    pub stake: U128,
    pub streak: u32,
    pub multiplier_bp: u32,
    pub power: U128,
    pub claimed_stake: bool,
    pub claimed_reward: bool,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct SeasonState {
    pub season: u32,
    pub start_day: u64,
    pub end_day: u64,
    pub winner: Option<u8>,
    pub bonus_pool: U128,
    pub claimed: U128,
    pub total_power: [U128; 2],
    pub tiles: [u8; 2],
    pub final_map: Vec<u8>,
    pub settled: bool,
    /// Set when the next season's settlement burns any unclaimed bonus.
    pub rewards_closed: bool,
}

impl SeasonState {
    pub fn new(season: u32, start_day: u64, end_day: u64) -> Self {
        Self {
            season,
            start_day,
            end_day,
            final_map: vec![0u8; MAP_TILES],
            ..Default::default()
        }
    }
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LogEntry {
    pub id: u64,
    pub day: u64,
    pub event: String,
    pub account: Option<AccountId>,
    pub faction: Option<u8>,
    pub amount: Option<U128>,
    /// Extra event fields as a JSON object string. The frontend parses this.
    pub data: String,
}

// ---------------------------------------------------------------------------
// View-only types (JSON only; never persisted)
// ---------------------------------------------------------------------------

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ClockInfo {
    pub now_ns: u64,
    pub epoch_start_ns: u64,
    pub day_length_ns: u64,
    pub current_day: u64,
    pub day_start_ns: u64,
    pub day_end_ns: u64,
    pub last_settled_day: u64,
    pub current_season: u32,
    pub season_days: u32,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Stats {
    pub total_supply: U128,
    pub genesis_supply: U128,
    pub treasury_balance: U128,
    pub faucet_balance: U128,
    pub locked_total: U128,
    pub reward_vault: U128,
    pub season_reward_vault: U128,
    pub burned_total: U128,
    pub reward_minted_total: U128,
    pub current_day: u64,
    pub last_settled_day: u64,
    pub current_season: u32,
    pub demo_mode: bool,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FaucetState {
    pub demo_mode: bool,
    pub registered: bool,
    pub claimed: bool,
    pub amount: U128,
    pub remaining: U128,
    pub eligible: bool,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PlayerLocked {
    pub available: U128,
    pub locked: U128,
    pub total: U128,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EnlistmentAt {
    pub day: u64,
    pub enlistment: Enlistment,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ClaimItem {
    pub day: u64,
    pub faction: u8,
    pub stake: U128,
    /// What `claim_stake` would pay right now (0 if already claimed or unsettled).
    pub stake_payout: U128,
    pub stake_claimed: bool,
    /// What `claim_reward` would pay right now (0 if none/already claimed/closed).
    pub reward_payout: U128,
    pub reward_claimed: bool,
    pub settled: bool,
    pub winner: Option<u8>,
    pub cold: bool,
    pub rewards_closed: bool,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SeasonPlayer {
    pub season: u32,
    pub faction: Option<u8>,
    pub power: U128,
    pub claimed: bool,
    pub eligible: bool,
    /// What `claim_season` would pay right now.
    pub payout_preview: U128,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EnlistPreview {
    pub day: u64,
    pub faction: u8,
    pub stake: U128,
    pub next_streak: u32,
    pub multiplier_bp: u32,
    pub power: U128,
    pub available_balance: U128,
    pub already_enlisted: bool,
    pub min_stake: U128,
    pub max_stake_per_day: U128,
}
