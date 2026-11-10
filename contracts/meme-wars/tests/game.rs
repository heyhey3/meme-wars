use meme_wars::{Config, Contract, FactionState};
use near_contract_standards::fungible_token::core::FungibleTokenCore;
use near_contract_standards::fungible_token::metadata::FungibleTokenMetadataProvider;
use near_contract_standards::storage_management::StorageManagement;
use near_sdk::json_types::U128 as JsonU128;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::testing_env;
use near_sdk::{AccountId, NearToken};

const T0: u64 = 1_700_000_000_000_000_000;
const DAY: u64 = 60_000_000_000;

const DOGS: u8 = 0;
const CATS: u8 = 1;

fn acct(name: &str) -> AccountId {
    format!("{name}.testnet").parse().unwrap()
}

fn war() -> AccountId {
    acct("war")
}

fn set_ctx(now: u64, who: &str, deposit: u128) {
    let mut b = VMContextBuilder::new();
    b.current_account_id(war())
        .predecessor_account_id(acct(who))
        .block_timestamp(now)
        .attached_deposit(NearToken::from_yoctonear(deposit));
    testing_env!(b.build());
}

fn base_config() -> Config {
    Config {
        name: "Meme Wars".to_string(),
        symbol: "WAR".to_string(),
        decimals: 6,
        icon: None,
        genesis_supply: JsonU128(1_000_000_000),
        treasury_allocation: JsonU128(200_000_000),
        community_allocation: JsonU128(700_000_000),
        demo_faucet_pool: JsonU128(100_000_000),
        demo_faucet_amount: JsonU128(1_000_000),
        demo_mode: true,
        day_length_ns: DAY,
        epoch_start_ns: 0,
        season_days: 3,
        daily_mint_pool: JsonU128(5_000_000),
        loss_burn_bp: 2_000,
        underdog_bonus_bp: 15_000,
        cold_line: JsonU128(1),
        cold_burn: JsonU128(1_000_000),
        min_stake: JsonU128(10_000),
        max_stake_per_day: JsonU128(100_000_000),
        streak_step_bp: 500,
        streak_cap_days: 20,
        claim_window_days: 1,
        season_bonus_bp: 500,
    }
}

fn deploy(config: Config) -> Contract {
    set_ctx(T0, "deployer", 0);
    Contract::new(config)
}

fn register(c: &mut Contract, who: &str, now: u64) {
    set_ctx(now, who, NearToken::from_near(1).as_yoctonear());
    c.storage_deposit(Some(acct(who)), Some(true));
}

fn register_and_fund(c: &mut Contract, who: &str, now: u64) {
    register(c, who, now);
    set_ctx(now, who, 0);
    c.claim_faucet();
    assert_eq!(c.ft_balance_of(acct(who)).0, 1_000_000);
}

fn join(c: &mut Contract, who: &str, faction: u8, now: u64) {
    set_ctx(now, who, 0);
    c.join_faction(faction);
}

fn enlist(c: &mut Contract, who: &str, amount: u128, now: u64) {
    set_ctx(now, who, 0);
    c.enlist(JsonU128(amount));
}

fn claim_stake(c: &mut Contract, who: &str, day: u64, now: u64) {
    set_ctx(now, who, 0);
    c.claim_stake(day);
}

fn claim_reward(c: &mut Contract, who: &str, day: u64, now: u64) {
    set_ctx(now, who, 0);
    c.claim_reward(day);
}

fn settle(c: &mut Contract, day: u64, now: u64) {
    set_ctx(now, "settler", 0);
    c.settle_day(day);
}

fn expect_panic<F: FnOnce()>(f: F, needle: &str) {
    let err = std::panic::catch_unwind(std::panic::AssertUnwindSafe(f))
        .expect_err("expected a panic, none happened");
    let msg = err
        .downcast_ref::<String>()
        .map(|s| s.as_str())
        .or_else(|| err.downcast_ref::<&str>().copied())
        .unwrap_or("<non-string panic>");
    assert!(msg.contains(needle), "panic {msg:?} did not contain {needle:?}");
}

fn assert_invariant(c: &Contract) {
    assert!(c.check_supply(), "supply identity broken");
    let stats = c.get_stats();
    let accounted = stats.treasury_balance.0
        + stats.faucet_balance.0
        + stats.reward_vault.0
        + stats.season_reward_vault.0
        + stats.locked_total.0;
    assert!(
        stats.total_supply.0 >= accounted,
        "vaults+locked ({accounted}) exceed supply ({})",
        stats.total_supply.0
    );
}

// ---------------------------------------------------------------------------
// Initialization, NEP-141, storage
// ---------------------------------------------------------------------------

#[test]
fn init_allocates_supply_exactly_once() {
    let c = deploy(base_config());
    let cfg = c.get_config();
    assert_eq!(cfg.epoch_start_ns, T0);
    assert_eq!(c.get_current_day(), 1);
    assert_eq!(c.last_settled_day, 0);
    assert_eq!(c.ft_total_supply().0, 1_000_000_000);
    assert_eq!(c.ft_balance_of(acct("deployer")).0, 700_000_000);
    assert_eq!(c.ft_balance_of(acct("nobody")).0, 0);

    let stats = c.get_stats();
    assert_eq!(stats.treasury_balance.0, 200_000_000);
    assert_eq!(stats.faucet_balance.0, 100_000_000);
    assert_eq!(stats.locked_total.0, 0);
    assert_eq!(stats.reward_vault.0, 0);
    assert!(stats.demo_mode);
    assert!(c.check_supply());
}

#[test]
fn bad_config_is_rejected() {
    let mut cfg = base_config();
    cfg.epoch_start_ns = T0;
    cfg.genesis_supply = JsonU128(999);
    expect_panic(|| cfg.validate(), "genesis_supply must equal");

    let mut cfg = base_config();
    cfg.epoch_start_ns = T0;
    cfg.streak_cap_days = 21; // 21 * 5% > 2x
    expect_panic(|| cfg.validate(), "cap at 2x");

    let mut cfg = base_config();
    cfg.epoch_start_ns = T0;
    cfg.demo_mode = false;
    expect_panic(|| cfg.validate(), "demo_faucet_pool = 0");
}

#[test]
fn ft_metadata_and_transfer_work() {
    let mut c = deploy(base_config());
    register(&mut c, "alice", T0);
    register(&mut c, "bob", T0);
    set_ctx(T0, "alice", 0);
    c.claim_faucet();

    let meta = c.ft_metadata();
    assert_eq!(meta.spec, "ft-1.0.0");
    assert_eq!(meta.symbol, "WAR");
    assert_eq!(meta.decimals, 6);

    set_ctx(T0, "alice", 1);
    c.ft_transfer(acct("bob"), JsonU128(250_000), None);
    assert_eq!(c.ft_balance_of(acct("alice")).0, 750_000);
    assert_eq!(c.ft_balance_of(acct("bob")).0, 250_000);
    assert_eq!(c.ft_total_supply().0, 1_000_000_000);
    assert_invariant(&c);
}

#[test]
fn ft_transfer_requires_one_yocto() {
    let mut c = deploy(base_config());
    register(&mut c, "alice", T0);
    register(&mut c, "bob", T0);
    set_ctx(T0, "alice", 0);
    c.claim_faucet();
    expect_panic(
        || {
            set_ctx(T0, "alice", 0);
            c.ft_transfer(acct("bob"), JsonU128(1_000), None);
        },
        "Requires attached deposit of exactly 1 yoctoNEAR",
    );
}

#[test]
fn storage_is_required_before_joining() {
    let mut c = deploy(base_config());
    expect_panic(
        || {
            set_ctx(T0, "alice", 0);
            c.join_faction(DOGS);
        },
        "storage_deposit required",
    );
    register(&mut c, "alice", T0);
    join(&mut c, "alice", DOGS, T0);
    assert_eq!(c.get_member(acct("alice")).unwrap().faction, DOGS);
}

#[test]
fn faucet_is_once_per_account() {
    let mut c = deploy(base_config());
    register_and_fund(&mut c, "alice", T0);
    expect_panic(
        || {
            set_ctx(T0, "alice", 0);
            c.claim_faucet();
        },
        "faucet already claimed",
    );
}

#[test]
fn faucet_is_disabled_in_production_mode() {
    let mut cfg = base_config();
    cfg.demo_mode = false;
    cfg.demo_faucet_pool = JsonU128(0);
    cfg.demo_faucet_amount = JsonU128(0);
    cfg.community_allocation = JsonU128(800_000_000);
    let mut c = deploy(cfg);
    register(&mut c, "alice", T0);
    expect_panic(
        || {
            set_ctx(T0, "alice", 0);
            c.claim_faucet();
        },
        "faucet is disabled",
    );
}

// ---------------------------------------------------------------------------
// Joining and enlisting
// ---------------------------------------------------------------------------

#[test]
fn join_is_exactly_once() {
    let mut c = deploy(base_config());
    register(&mut c, "alice", T0);
    join(&mut c, "alice", DOGS, T0);
    expect_panic(
        || {
            set_ctx(T0, "alice", 0);
            c.join_faction(CATS);
        },
        "already joined",
    );
    expect_panic(
        || {
            set_ctx(T0, "bob", 0);
            c.join_faction(7);
        },
        "faction must be 0",
    );
}

#[test]
fn enlist_enforces_bounds_and_once_per_day() {
    let mut c = deploy(base_config());
    register_and_fund(&mut c, "alice", T0);
    join(&mut c, "alice", DOGS, T0);

    expect_panic(
        || {
            set_ctx(T0, "alice", 0);
            c.enlist(JsonU128(9_999));
        },
        "stake must be within",
    );
    expect_panic(
        || {
            set_ctx(T0, "alice", 0);
            c.enlist(JsonU128(100_000_001));
        },
        "stake must be within",
    );
    // Within the configured max, but above the account's balance.
    expect_panic(
        || {
            set_ctx(T0, "alice", 0);
            c.enlist(JsonU128(2_000_000));
        },
        "insufficient available balance",
    );

    enlist(&mut c, "alice", 10_000, T0);
    expect_panic(
        || {
            set_ctx(T0, "alice", 0);
            c.enlist(JsonU128(10_000));
        },
        "already enlisted today",
    );

    let day = c.get_day(1).unwrap();
    assert_eq!(day.total_stake[DOGS as usize].0, 10_000);
    assert_eq!(day.total_power[DOGS as usize].0, 10_500);
    let member = c.get_member(acct("alice")).unwrap();
    assert_eq!(member.streak, 1);
    assert_eq!(member.locked_stake.0, 10_000);
    assert_eq!(c.get_locked_balance(acct("alice")).0, 10_000);
    assert_invariant(&c);
}

#[test]
fn locked_stake_cannot_be_transferred() {
    let mut c = deploy(base_config());
    register_and_fund(&mut c, "alice", T0);
    register(&mut c, "bob", T0);
    join(&mut c, "alice", DOGS, T0);
    enlist(&mut c, "alice", 100_000, T0);
    assert_eq!(c.ft_balance_of(acct("alice")).0, 900_000);

    expect_panic(
        || {
            set_ctx(T0, "alice", 1);
            c.ft_transfer(acct("bob"), JsonU128(1_000_000), None);
        },
        "doesn't have enough balance",
    );

    set_ctx(T0, "alice", 1);
    c.ft_transfer(acct("bob"), JsonU128(900_000), None);
    assert_eq!(c.ft_balance_of(acct("alice")).0, 0);
    assert_eq!(c.get_locked_balance(acct("alice")).0, 100_000);
    assert_eq!(c.get_total_balance(acct("alice")).0, 100_000);
    assert_invariant(&c);
}

#[test]
fn consecutive_enlistments_increase_power_and_streak() {
    let mut c = deploy(base_config());
    register_and_fund(&mut c, "alice", T0);
    register_and_fund(&mut c, "bob", T0);
    join(&mut c, "alice", DOGS, T0);
    join(&mut c, "bob", CATS, T0);

    enlist(&mut c, "alice", 10_000, T0);
    enlist(&mut c, "bob", 10_000, T0);
    settle(&mut c, 1, T0 + DAY);

    let second = T0 + DAY;
    enlist(&mut c, "alice", 10_000, second);
    enlist(&mut c, "bob", 10_000, second);
    let day = c.get_day(2).unwrap();
    assert_eq!(day.total_power[DOGS as usize].0, 11_000);
    assert_eq!(c.get_member(acct("alice")).unwrap().streak, 2);
    assert_eq!(c.get_member(acct("alice")).unwrap().longest_streak, 2);

    // Break the streak by skipping day 3.
    let fourth = T0 + 3 * DAY;
    enlist(&mut c, "alice", 10_000, fourth);
    let member = c.get_member(acct("alice")).unwrap();
    assert_eq!(member.streak, 1);
    assert_eq!(member.longest_streak, 2);
    assert_eq!(c.get_day(4).unwrap().total_power[DOGS as usize].0, 10_500);
    assert_invariant(&c);
}

#[test]
fn preview_matches_enlist_math() {
    let mut c = deploy(base_config());
    register_and_fund(&mut c, "alice", T0);
    join(&mut c, "alice", DOGS, T0);
    let p = c.get_enlist_preview(acct("alice"), JsonU128(10_000)).unwrap();
    assert_eq!(p.next_streak, 1);
    assert_eq!(p.multiplier_bp, 10_500);
    assert_eq!(p.power.0, 10_500);
    assert_eq!(p.available_balance.0, 1_000_000);
    assert!(!p.already_enlisted);
    enlist(&mut c, "alice", 10_000, T0);
    let p = c.get_enlist_preview(acct("alice"), JsonU128(10_000)).unwrap();
    assert!(p.already_enlisted);
}

// ---------------------------------------------------------------------------
// Settlement: winner, burn, mint, underdog, tie, cold
// ---------------------------------------------------------------------------

#[test]
fn winner_mints_rewards_and_loser_is_burned() {
    let mut c = deploy(base_config());
    register_and_fund(&mut c, "alice", T0);
    register_and_fund(&mut c, "bob", T0);
    join(&mut c, "alice", DOGS, T0);
    join(&mut c, "bob", CATS, T0);

    enlist(&mut c, "alice", 10_000, T0);
    enlist(&mut c, "bob", 12_000, T0);

    let before = T0 + DAY;
    settle(&mut c, 1, before);

    let day = c.get_day(1).unwrap();
    assert!(day.settled);
    assert!(!day.cold);
    assert_eq!(day.winner, Some(DOGS));
    assert_eq!(day.effective_power[DOGS as usize].0, 15_750); // underdog 1.5x
    assert_eq!(day.effective_power[CATS as usize].0, 12_600);
    assert_eq!(day.burned.0, 2_400); // 20% of 12k
    assert_eq!(day.reward_pool.0, 5_000_000);
    assert_eq!(day.tile, Some(0));
    assert_eq!(c.get_map()[0], DOGS + 1);

    let stats = c.get_stats();
    assert_eq!(stats.total_supply.0, 1_000_000_000 + 5_000_000 - 2_400);
    assert_eq!(stats.reward_vault.0, 5_000_000);
    assert_eq!(stats.locked_total.0, 22_000 - 2_400);
    assert_eq!(stats.burned_total.0, 2_400);
    assert_eq!(c.get_faction(DOGS).unwrap().win_streak, 1);
    assert_eq!(c.get_faction(CATS).unwrap().win_streak, 0);
    assert_invariant(&c);

    // Winner gets the whole pool because alice is the only winning staker.
    claim_stake(&mut c, "alice", 1, before);
    claim_reward(&mut c, "alice", 1, before);
    assert_eq!(c.ft_balance_of(acct("alice")).0, 1_000_000 + 5_000_000);
    assert_eq!(c.get_locked_balance(acct("alice")).0, 0);
    assert_eq!(c.get_stats().reward_vault.0, 0);
    assert_invariant(&c);

    // Loser gets 80% and cannot claim a reward.
    claim_stake(&mut c, "bob", 1, before);
    assert_eq!(c.ft_balance_of(acct("bob")).0, 1_000_000 - 2_400);
    expect_panic(
        || {
            set_ctx(before, "bob", 0);
            c.claim_reward(1);
        },
        "only the winning faction",
    );
    assert_eq!(c.get_locked_total().0, 0);
    assert_invariant(&c);
}

#[test]
fn claims_are_once_only() {
    let mut c = deploy(base_config());
    register_and_fund(&mut c, "alice", T0);
    register_and_fund(&mut c, "bob", T0);
    join(&mut c, "alice", DOGS, T0);
    join(&mut c, "bob", CATS, T0);
    enlist(&mut c, "alice", 10_000, T0);
    enlist(&mut c, "bob", 12_000, T0);
    settle(&mut c, 1, T0 + DAY);

    claim_stake(&mut c, "alice", 1, T0 + DAY);
    expect_panic(
        || {
            set_ctx(T0 + DAY, "alice", 0);
            c.claim_stake(1);
        },
        "stake already claimed",
    );
    claim_reward(&mut c, "alice", 1, T0 + DAY);
    expect_panic(
        || {
            set_ctx(T0 + DAY, "alice", 0);
            c.claim_reward(1);
        },
        "reward already claimed",
    );
    assert_eq!(c.ft_balance_of(acct("alice")).0, 6_000_000);
    assert_invariant(&c);
}

#[test]
fn underdog_bonus_can_flip_a_smaller_side() {
    let mut c = deploy(base_config());
    register_and_fund(&mut c, "alice", T0);
    register_and_fund(&mut c, "bob", T0);
    join(&mut c, "alice", DOGS, T0);
    join(&mut c, "bob", CATS, T0);
    enlist(&mut c, "alice", 10_000, T0); // base 10,500
    enlist(&mut c, "bob", 12_000, T0); // base 12,600
    settle(&mut c, 1, T0 + DAY);

    let day = c.get_day(1).unwrap();
    assert_eq!(day.total_power[DOGS as usize].0, 10_500);
    assert_eq!(day.total_power[CATS as usize].0, 12_600);
    assert_eq!(day.winner, Some(DOGS));
    assert_eq!(day.base_power_winner.0, 10_500);
}

#[test]
fn exact_power_tie_is_a_full_refund() {
    let mut c = deploy(base_config());
    register_and_fund(&mut c, "alice", T0);
    register_and_fund(&mut c, "bob", T0);
    join(&mut c, "alice", DOGS, T0);
    join(&mut c, "bob", CATS, T0);
    enlist(&mut c, "alice", 10_000, T0);
    enlist(&mut c, "bob", 10_000, T0);
    set_ctx(T0 + DAY, "deployer", 0);
    c.settle_day(1);

    let day = c.get_day(1).unwrap();
    assert!(day.settled);
    assert!(!day.cold);
    assert_eq!(day.winner, None);
    assert_eq!(day.burned.0, 0);
    assert_eq!(day.reward_pool.0, 0);
    assert_eq!(c.get_stats().total_supply.0, 1_000_000_000);
    assert_eq!(c.get_stats().locked_total.0, 20_000);
    assert_eq!(c.get_faction(DOGS).unwrap().win_streak, 0);
    assert_eq!(c.get_faction(CATS).unwrap().win_streak, 0);

    claim_stake(&mut c, "alice", 1, T0 + DAY);
    claim_stake(&mut c, "bob", 1, T0 + DAY);
    assert_eq!(c.ft_balance_of(acct("alice")).0, 1_000_000);
    assert_eq!(c.ft_balance_of(acct("bob")).0, 1_000_000);
    assert_eq!(c.get_stats().locked_total.0, 0);
    assert_invariant(&c);
}

#[test]
fn cold_day_refunds_stakes_and_burns_treasury() {
    let mut cfg = base_config();
    cfg.cold_line = JsonU128(1_000_000);
    cfg.cold_burn = JsonU128(1_000_000);
    let mut c = deploy(cfg);
    register_and_fund(&mut c, "alice", T0);
    register_and_fund(&mut c, "bob", T0);
    join(&mut c, "alice", DOGS, T0);
    join(&mut c, "bob", CATS, T0);
    enlist(&mut c, "alice", 10_000, T0);
    enlist(&mut c, "bob", 30_000, T0);
    settle(&mut c, 1, T0 + DAY);

    let day = c.get_day(1).unwrap();
    assert!(day.cold);
    assert_eq!(day.winner, None);
    assert_eq!(day.burned.0, 1_000_000);
    assert_eq!(day.reward_pool.0, 0);
    let stats = c.get_stats();
    assert_eq!(stats.treasury_balance.0, 199_000_000);
    assert_eq!(stats.total_supply.0, 999_000_000);
    assert_eq!(stats.burned_total.0, 1_000_000);

    claim_stake(&mut c, "alice", 1, T0 + DAY);
    claim_stake(&mut c, "bob", 1, T0 + DAY);
    assert_eq!(c.ft_balance_of(acct("bob")).0, 1_000_000);
    assert_eq!(c.get_stats().locked_total.0, 0);
    assert_invariant(&c);
}

#[test]
fn settle_is_ordered_and_idempotent() {
    let mut c = deploy(base_config());
    register_and_fund(&mut c, "alice", T0);
    register_and_fund(&mut c, "bob", T0);
    join(&mut c, "alice", DOGS, T0);
    join(&mut c, "bob", CATS, T0);
    enlist(&mut c, "alice", 10_000, T0);
    enlist(&mut c, "bob", 12_000, T0);

    expect_panic(
        || {
            set_ctx(T0 + 2 * DAY, "settler", 0);
            c.settle_day(2);
        },
        "days must be settled in order",
    );
    expect_panic(
        || {
            set_ctx(T0, "settler", 0);
            c.settle_day(1);
        },
        "day has not ended yet",
    );

    settle(&mut c, 1, T0 + DAY);
    expect_panic(
        || {
            set_ctx(T0 + DAY, "settler", 0);
            c.settle_day(1);
        },
        "day already settled",
    );
}

#[test]
fn auto_settle_catches_up_before_enlisting() {
    let mut c = deploy(base_config());
    register_and_fund(&mut c, "alice", T0);
    register_and_fund(&mut c, "bob", T0);
    join(&mut c, "alice", DOGS, T0);
    join(&mut c, "bob", CATS, T0);

    enlist(&mut c, "alice", 10_000, T0);
    enlist(&mut c, "bob", 12_000, T0);
    // Day 2 enlistment auto-settles day 1.
    enlist(&mut c, "alice", 10_000, T0 + DAY);
    enlist(&mut c, "bob", 12_000, T0 + DAY);
    assert_eq!(c.last_settled_day, 1);
    // Day 3 enlistment auto-settles day 2.
    enlist(&mut c, "alice", 10_000, T0 + 2 * DAY);
    assert_eq!(c.last_settled_day, 2);
    assert!(c.get_day(1).unwrap().settled);
    assert!(c.get_day(2).unwrap().settled);
    assert_eq!(c.get_member(acct("alice")).unwrap().streak, 3);
    assert_invariant(&c);
}

#[test]
fn too_many_missed_days_requires_manual_settlement() {
    let mut c = deploy(base_config());
    register_and_fund(&mut c, "alice", T0);
    join(&mut c, "alice", DOGS, T0);
    expect_panic(
        || {
            set_ctx(T0 + 9 * DAY, "alice", 0);
            c.enlist(JsonU128(10_000));
        },
        "too many unsettled days",
    );
}

// ---------------------------------------------------------------------------
// Claim window
// ---------------------------------------------------------------------------

#[test]
fn unclaimed_rewards_burn_after_the_window_but_stakes_remain_claimable() {
    let mut c = deploy(base_config());
    register_and_fund(&mut c, "alice", T0);
    register_and_fund(&mut c, "bob", T0);
    join(&mut c, "alice", DOGS, T0);
    join(&mut c, "bob", CATS, T0);
    enlist(&mut c, "alice", 10_000, T0);
    enlist(&mut c, "bob", 12_000, T0);
    settle(&mut c, 1, T0 + DAY);

    let after_window = T0 + 2 * DAY; // current day 3; window ends at day 2
    set_ctx(after_window, "settler", 0);
    c.close_claims(1);

    let stats = c.get_stats();
    assert_eq!(stats.reward_vault.0, 0);
    assert_eq!(stats.total_supply.0, 1_000_000_000 - 2_400);
    assert_eq!(stats.burned_total.0, 5_002_400);
    assert!(c.get_day(1).unwrap().rewards_closed);
    assert_invariant(&c);

    expect_panic(
        || {
            set_ctx(after_window, "alice", 0);
            c.claim_reward(1);
        },
        "reward claim window is closed",
    );
    claim_stake(&mut c, "alice", 1, after_window);
    assert_eq!(c.ft_balance_of(acct("alice")).0, 1_000_000);
    assert_invariant(&c);
}

#[test]
fn close_claims_rejects_an_early_call() {
    let mut c = deploy(base_config());
    register_and_fund(&mut c, "alice", T0);
    register_and_fund(&mut c, "bob", T0);
    join(&mut c, "alice", DOGS, T0);
    join(&mut c, "bob", CATS, T0);
    enlist(&mut c, "alice", 10_000, T0);
    enlist(&mut c, "bob", 12_000, T0);
    settle(&mut c, 1, T0 + DAY);
    expect_panic(
        || {
            set_ctx(T0 + DAY, "settler", 0);
            c.close_claims(1);
        },
        "reward claim window is still open",
    );
}

// ---------------------------------------------------------------------------
// Seasons
// ---------------------------------------------------------------------------

#[test]
fn season_settles_bonus_map_and_claims() {
    let mut c = deploy(base_config()); // season_days = 3
    register_and_fund(&mut c, "alice", T0);
    register_and_fund(&mut c, "bob", T0);
    register_and_fund(&mut c, "carol", T0);
    join(&mut c, "alice", DOGS, T0);
    join(&mut c, "bob", CATS, T0);
    join(&mut c, "carol", DOGS, T0);

    // Day 1: DOGS 21k vs CATS 12.6k -> DOGS
    enlist(&mut c, "alice", 10_000, T0);
    enlist(&mut c, "carol", 10_000, T0);
    enlist(&mut c, "bob", 12_000, T0);
    settle(&mut c, 1, T0 + DAY);
    assert_eq!(c.get_day(1).unwrap().winner, Some(DOGS));

    // Day 2: DOGS 11k vs CATS 33k -> CATS
    enlist(&mut c, "alice", 10_000, T0 + DAY);
    enlist(&mut c, "bob", 30_000, T0 + DAY);
    settle(&mut c, 2, T0 + 2 * DAY);
    assert_eq!(c.get_day(2).unwrap().winner, Some(CATS));

    // Day 3: DOGS 57.5k vs CATS 11.5k -> DOGS
    enlist(&mut c, "alice", 50_000, T0 + 2 * DAY);
    enlist(&mut c, "bob", 10_000, T0 + 2 * DAY);
    settle(&mut c, 3, T0 + 3 * DAY);
    assert_eq!(c.get_day(3).unwrap().winner, Some(DOGS));

    let season = c.get_season(1).unwrap();
    assert!(season.settled);
    assert_eq!(season.winner, Some(DOGS));
    assert_eq!(season.tiles, [2, 1]);
    assert_eq!(season.final_map[0], DOGS + 1);
    assert_eq!(season.final_map[1], CATS + 1);
    assert_eq!(season.final_map[2], DOGS + 1);
    assert_eq!(season.final_map[3], 0);
    assert_eq!(season.bonus_pool.0, 10_000_000); // 5% of 200m treasury
    assert_eq!(c.get_map(), vec![0u8; 25], "map resets for the new season");
    assert_eq!(c.get_faction(DOGS).unwrap().season_tiles, 0);
    assert_eq!(c.get_stats().treasury_balance.0, 190_000_000);
    assert_eq!(c.get_stats().season_reward_vault.0, 10_000_000);
    assert_eq!(c.get_current_season(), 2);
    assert_invariant(&c);

    // season_power: alice 10.5 + 11 + 57.5 = 79k; carol 10.5k; total 89.5k.
    let expected_alice = 10_000_000u128 * 79_000 / 89_500;
    let expected_carol = 10_000_000u128 * 10_500 / 89_500;
    set_ctx(T0 + 3 * DAY, "alice", 0);
    c.claim_season(1);
    assert_eq!(
        c.ft_balance_of(acct("alice")).0,
        1_000_000 - 70_000 + expected_alice
    );
    assert_eq!(c.get_stats().season_reward_vault.0, 10_000_000 - expected_alice);

    set_ctx(T0 + 3 * DAY, "carol", 0);
    c.claim_season(1);
    assert_eq!(
        c.ft_balance_of(acct("carol")).0,
        1_000_000 - 10_000 + expected_carol
    );
    assert_eq!(c.get_stats().season_reward_vault.0, 1); // floor remainder
    assert_eq!(c.get_season(1).unwrap().claimed.0, expected_alice + expected_carol);

    expect_panic(
        || {
            set_ctx(T0 + 3 * DAY, "bob", 0);
            c.claim_season(1);
        },
        "only the winning faction",
    );
    expect_panic(
        || {
            set_ctx(T0 + 3 * DAY, "alice", 0);
            c.claim_season(1);
        },
        "already claimed",
    );

    // New season power lands in season 2. Alice is on a 4-day streak.
    enlist(&mut c, "alice", 10_000, T0 + 3 * DAY);
    assert_eq!(c.get_season(2).unwrap().total_power[DOGS as usize].0, 12_000);
    assert_invariant(&c);
}

#[test]
fn map_ownership_moves_when_a_tile_is_recaptured() {
    let mut cfg = base_config();
    cfg.season_days = 30;
    let mut c = deploy(cfg);
    register_and_fund(&mut c, "alice", T0);
    register_and_fund(&mut c, "bob", T0);
    join(&mut c, "alice", DOGS, T0);
    join(&mut c, "bob", CATS, T0);

    // Day 1: DOGS wins tile 0.
    enlist(&mut c, "alice", 10_000, T0);
    enlist(&mut c, "bob", 12_000, T0);
    settle(&mut c, 1, T0 + DAY);
    assert_eq!(c.get_map()[0], 1);
    assert_eq!(c.get_faction(DOGS).unwrap().season_tiles, 1);
    assert_eq!(c.get_faction(CATS).unwrap().season_tiles, 0);
    assert_eq!(c.get_season(1).unwrap().tiles, [1, 0]);

    // Days 2..25 are cold. Settle them so day 26 (same tile 0) is reachable.
    for day in 2..=25u64 {
        settle(&mut c, day, T0 + day * DAY);
    }
    enlist(&mut c, "alice", 10_000, T0 + 25 * DAY);
    enlist(&mut c, "bob", 50_000, T0 + 25 * DAY);
    settle(&mut c, 26, T0 + 26 * DAY);

    assert_eq!(c.get_day(26).unwrap().winner, Some(CATS));
    assert_eq!(c.get_map()[0], 2);
    assert_eq!(c.get_faction(DOGS).unwrap().season_tiles, 0);
    assert_eq!(c.get_faction(CATS).unwrap().season_tiles, 1);
    assert_eq!(c.get_season(1).unwrap().tiles, [0, 1]);
    assert_invariant(&c);

    // Days 27..30 are cold; day 30 closes the season on the final map.
    for day in 27..=30u64 {
        settle(&mut c, day, T0 + day * DAY);
    }
    let season = c.get_season(1).unwrap();
    assert_eq!(season.tiles, [0, 1]);
    assert_eq!(season.winner, Some(CATS));
    assert_eq!(season.final_map[0], 2);
    assert_eq!(c.get_map(), vec![0u8; 25]);
    assert_invariant(&c);
}

#[test]
fn previous_season_unclaimed_bonus_is_burned_at_next_season_end() {
    let mut cfg = base_config();
    cfg.season_days = 1; // each day is its own season, quicker to reach cleanup
    let mut c = deploy(cfg);
    register_and_fund(&mut c, "alice", T0);
    register_and_fund(&mut c, "bob", T0);
    join(&mut c, "alice", DOGS, T0);
    join(&mut c, "bob", CATS, T0);

    enlist(&mut c, "alice", 10_000, T0);
    enlist(&mut c, "bob", 12_000, T0);
    settle(&mut c, 1, T0 + DAY);
    assert_eq!(c.get_season(1).unwrap().winner, Some(DOGS));
    let bonus = c.get_season(1).unwrap().bonus_pool.0;
    assert_eq!(bonus, 10_000_000);
    assert_eq!(c.get_stats().season_reward_vault.0, bonus);

    // Alice never claims season 1. Season 2 ends and the leftover burns.
    enlist(&mut c, "alice", 10_000, T0 + DAY);
    enlist(&mut c, "bob", 12_000, T0 + DAY);
    settle(&mut c, 2, T0 + 2 * DAY);

    let season1 = c.get_season(1).unwrap();
    assert!(season1.rewards_closed);
    // Season 1's 10m unclaimed bonus burned; season 2's 5% of the now-190m
    // treasury (9.5m) sits in the vault awaiting claims.
    assert_eq!(c.get_stats().season_reward_vault.0, 9_500_000);
    assert_invariant(&c);

    expect_panic(
        || {
            set_ctx(T0 + 2 * DAY, "alice", 0);
            c.claim_season(1);
        },
        "season rewards are closed",
    );
}

// ---------------------------------------------------------------------------
// Views and logging
// ---------------------------------------------------------------------------

#[test]
fn log_records_events_and_claims_view_previews() {
    let mut c = deploy(base_config());
    register_and_fund(&mut c, "alice", T0);
    register_and_fund(&mut c, "bob", T0);
    join(&mut c, "alice", DOGS, T0);
    join(&mut c, "bob", CATS, T0);
    enlist(&mut c, "alice", 10_000, T0);
    enlist(&mut c, "bob", 12_000, T0);

    set_ctx(T0 + DAY, "viewer", 0); // day 1 has ended but is not settled
    let claims = c.get_claims(acct("alice"), 1, 7);
    assert_eq!(claims.len(), 1);
    assert_eq!(claims[0].stake_payout.0, 0);
    assert_eq!(claims[0].reward_payout.0, 0);
    assert!(!claims[0].settled);

    settle(&mut c, 1, T0 + DAY);
    let claims = c.get_claims(acct("alice"), 1, 7);
    assert!(claims[0].settled);
    assert_eq!(claims[0].reward_payout.0, 5_000_000);
    let bob_claims = c.get_claims(acct("bob"), 1, 7);
    assert_eq!(bob_claims[0].reward_payout.0, 0);
    assert_eq!(bob_claims[0].stake_payout.0, 9_600);

    let log = c.get_log(0, 50);
    assert!(log.iter().any(|e| e.event == "join_faction"));
    assert!(log.iter().any(|e| e.event == "enlist"));
    assert!(log.iter().any(|e| e.event == "day_settled"));
    let settled = log.iter().find(|e| e.event == "day_settled").unwrap();
    assert!(settled.data.contains("\"winner\":0"));
    assert!(settled.data.contains("\"cold\":false"));
    assert_eq!(c.get_clock().current_day, 2);
    assert_eq!(c.get_clock().last_settled_day, 1);
}

#[test]
fn clock_reports_day_boundaries() {
    let c = deploy(base_config());
    let clock = c.get_clock();
    assert_eq!(clock.epoch_start_ns, T0);
    assert_eq!(clock.day_length_ns, DAY);
    assert_eq!(clock.current_day, 1);
    assert_eq!(clock.day_start_ns, T0);
    assert_eq!(clock.day_end_ns, T0 + DAY);
    assert_eq!(clock.current_season, 1);
}

#[test]
fn factions_view_and_map_encoding() {
    let mut c = deploy(base_config());
    register_and_fund(&mut c, "alice", T0);
    register_and_fund(&mut c, "bob", T0);
    join(&mut c, "alice", DOGS, T0);
    join(&mut c, "bob", CATS, T0);
    enlist(&mut c, "alice", 10_000, T0);
    enlist(&mut c, "bob", 12_000, T0);
    settle(&mut c, 1, T0 + DAY);

    let factions: Vec<FactionState> = c.get_factions();
    assert_eq!(factions.len(), 2);
    assert_eq!(factions[0].id, DOGS);
    assert_eq!(factions[0].total_wins, 1);
    assert_eq!(factions[0].total_enlistments, 1);
    assert_eq!(factions[1].total_wins, 0);
    assert_eq!(c.get_map()[0], 1);
    assert!(c.get_map()[1..].iter().all(|&v| v == 0));
    assert!(c.get_faction(9).is_none());
}
