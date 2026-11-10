//! Meme Wars ($WAR) — a NEP-141 token whose supply is a function of a daily
//! two-faction war.
//!
//! Invariants enforced by construction:
//! * Parameters are set once in `new()`; there is no admin, setter, pause,
//!   upgrade or treasury-withdraw path anywhere in this contract.
//! * Settlement and claims are O(1): no iteration over participants.
//! * `ft_total_supply == genesis_supply + reward_minted_total - burned_total`.
//! * A stake locked by `enlist` is not part of `ft_balance_of`, so `ft_transfer`
//!   can never move it.

use near_contract_standards::fungible_token::core_impl::FungibleToken;
use near_contract_standards::fungible_token::metadata::{
    FungibleTokenMetadata, FungibleTokenMetadataProvider, FT_METADATA_SPEC,
};
use near_contract_standards::fungible_token::resolver::FungibleTokenResolver;
use near_contract_standards::fungible_token::FungibleTokenCore;
use near_contract_standards::storage_management::{
    StorageBalance, StorageBalanceBounds, StorageManagement,
};
use near_sdk::json_types::U128;
use near_sdk::store::{LookupMap, Vector};
use near_sdk::{
    env, near, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault, PromiseOrValue,
};

mod config;
mod events;
mod game;
mod settlement;
mod types;
mod views;

pub use config::Config;
pub use types::*;

#[near(serializers = [borsh])]
#[derive(BorshStorageKey)]
pub enum StorageKey {
    FtAccounts,
    Members,
    Days,
    Enlistments,
    SeasonPower,
    Seasons,
    SeasonClaimed,
    FaucetClaimed,
    Log,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    pub ft: FungibleToken,
    pub config: Config,
    pub factions: [FactionState; 2],

    pub members: LookupMap<AccountId, Member>,
    pub days: LookupMap<u64, DayState>,
    pub enlistments: LookupMap<(u64, AccountId), Enlistment>,
    pub season_power: LookupMap<(u32, AccountId), U128>,
    pub seasons: LookupMap<u32, SeasonState>,
    pub season_claimed: LookupMap<(u32, AccountId), bool>,
    pub faucet_claimed: LookupMap<AccountId, bool>,

    pub log: Vector<LogEntry>,
    pub next_log_id: u64,

    // Vaults / accounting. These are supply buckets, not token accounts.
    pub treasury_balance: U128,
    pub faucet_balance: U128,
    pub locked_total: U128,
    pub reward_vault: U128,
    pub season_reward_vault: U128,
    pub burned_total: U128,
    pub reward_minted_total: U128,

    pub last_settled_day: u64,
    /// map[i] = 0 empty, 1 DOGS, 2 CATS. Reset when a season settles.
    pub map: [u8; MAP_TILES],
}

#[near]
impl Contract {
    /// The only initialization entry point. There is no second call and no
    /// way to change any field afterwards.
    #[init]
    pub fn new(config: Config) -> Self {
        let mut config = config;
        if config.epoch_start_ns == 0 {
            config.epoch_start_ns = env::block_timestamp();
        }
        require!(
            config.epoch_start_ns <= env::block_timestamp(),
            "epoch_start_ns must not be in the future"
        );
        config.validate();

        let mut ft = FungibleToken::new(StorageKey::FtAccounts);
        let deployer = env::predecessor_account_id();
        ft.internal_register_account(&deployer);
        ft.internal_deposit(&deployer, config.community_allocation.0);

        // Treasury and faucet are supply held by the contract under fixed rules.
        let vault_allocations = config
            .treasury_allocation
            .0
            .checked_add(config.demo_faucet_pool.0)
            .unwrap_or_else(|| env::panic_str("allocation overflow"));
        ft.total_supply = ft
            .total_supply
            .checked_add(vault_allocations)
            .unwrap_or_else(|| env::panic_str("supply overflow"));
        require!(ft.total_supply == config.genesis_supply.0, "genesis supply mismatch");

        Self {
            ft,
            treasury_balance: config.treasury_allocation,
            faucet_balance: config.demo_faucet_pool,
            config,
            factions: [FactionState::new(FACTION_DOGS), FactionState::new(FACTION_CATS)],
            members: LookupMap::new(StorageKey::Members),
            days: LookupMap::new(StorageKey::Days),
            enlistments: LookupMap::new(StorageKey::Enlistments),
            season_power: LookupMap::new(StorageKey::SeasonPower),
            seasons: LookupMap::new(StorageKey::Seasons),
            season_claimed: LookupMap::new(StorageKey::SeasonClaimed),
            faucet_claimed: LookupMap::new(StorageKey::FaucetClaimed),
            log: Vector::new(StorageKey::Log),
            next_log_id: 0,
            locked_total: U128(0),
            reward_vault: U128(0),
            season_reward_vault: U128(0),
            burned_total: U128(0),
            reward_minted_total: U128(0),
            last_settled_day: 0,
            map: [0u8; MAP_TILES],
        }
    }
}

// ---------------------------------------------------------------------------
// NEP-141
// ---------------------------------------------------------------------------

#[near]
impl FungibleTokenCore for Contract {
    #[payable]
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) {
        self.ft.ft_transfer(receiver_id, amount, memo)
    }

    #[payable]
    fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<U128> {
        self.ft.ft_transfer_call(receiver_id, amount, memo, msg)
    }

    fn ft_total_supply(&self) -> U128 {
        self.ft.total_supply.into()
    }

    fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        self.ft.accounts.get(&account_id).unwrap_or(0).into()
    }
}

#[near]
impl FungibleTokenResolver for Contract {
    #[private]
    fn ft_resolve_transfer(
        &mut self,
        sender_id: AccountId,
        receiver_id: AccountId,
        amount: U128,
    ) -> U128 {
        let (used_amount, burned_amount) =
            self.ft.internal_ft_resolve_transfer(&sender_id, receiver_id, amount);
        if burned_amount > 0 {
            env::log_str(&format!("Account @{sender_id} burned {burned_amount}"));
        }
        used_amount.into()
    }
}

#[near]
impl FungibleTokenMetadataProvider for Contract {
    fn ft_metadata(&self) -> FungibleTokenMetadata {
        FungibleTokenMetadata {
            spec: FT_METADATA_SPEC.to_string(),
            name: self.config.name.clone(),
            symbol: self.config.symbol.clone(),
            icon: self.config.icon.clone(),
            reference: None,
            reference_hash: None,
            decimals: self.config.decimals,
        }
    }
}

// ---------------------------------------------------------------------------
// NEP-145 storage
// ---------------------------------------------------------------------------

#[near]
impl StorageManagement for Contract {
    #[payable]
    fn storage_deposit(
        &mut self,
        account_id: Option<AccountId>,
        registration_only: Option<bool>,
    ) -> StorageBalance {
        self.ft.storage_deposit(account_id, registration_only)
    }

    #[payable]
    fn storage_withdraw(&mut self, amount: Option<NearToken>) -> StorageBalance {
        self.ft.storage_withdraw(amount)
    }

    /// This token does not support force deregistration: a positive balance is
    /// never silently burned. Keep `force` in the signature for NEP-145.
    #[payable]
    fn storage_unregister(&mut self, _force: Option<bool>) -> bool {
        self.ft.internal_storage_unregister(Some(false)).is_some()
    }

    fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        self.ft.storage_balance_bounds()
    }

    fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        self.ft.storage_balance_of(account_id)
    }
}

// ---------------------------------------------------------------------------
// Internal helpers shared by game / settlement / views
// ---------------------------------------------------------------------------

impl Contract {
    pub(crate) fn current_day(&self) -> u64 {
        let now = env::block_timestamp();
        let epoch = self.config.epoch_start_ns;
        if now < epoch {
            return 0;
        }
        (now - epoch) / self.config.day_length_ns + 1
    }

    pub(crate) fn season_of_day(&self, day: u64) -> u32 {
        let days = self.config.season_days as u64;
        ((day.saturating_sub(1) / days) + 1) as u32
    }

    pub(crate) fn season_start_day(&self, season: u32) -> u64 {
        (season as u64 - 1) * self.config.season_days as u64 + 1
    }

    pub(crate) fn season_end_day(&self, season: u32) -> u64 {
        season as u64 * self.config.season_days as u64
    }

    pub(crate) fn day_start_ns(&self, day: u64) -> u64 {
        self.config
            .epoch_start_ns
            .checked_add(
                day.saturating_sub(1)
                    .checked_mul(self.config.day_length_ns)
                    .unwrap_or_else(|| env::panic_str("day overflow")),
            )
            .unwrap_or_else(|| env::panic_str("timestamp overflow"))
    }

    pub(crate) fn day_end_ns(&self, day: u64) -> u64 {
        self.config
            .epoch_start_ns
            .checked_add(
                day.checked_mul(self.config.day_length_ns)
                    .unwrap_or_else(|| env::panic_str("day overflow")),
            )
            .unwrap_or_else(|| env::panic_str("timestamp overflow"))
    }

    pub(crate) fn is_registered(&self, account_id: &AccountId) -> bool {
        self.ft.accounts.contains_key(account_id)
    }

    /// Move tokens from a contract vault into a user's available balance without
    /// changing total supply. The account must be registered.
    pub(crate) fn internal_credit(&mut self, account_id: &AccountId, amount: u128) {
        if amount == 0 {
            return;
        }
        let balance = self.ft.internal_unwrap_balance_of(account_id);
        let new_balance = balance
            .checked_add(amount)
            .unwrap_or_else(|| env::panic_str("balance overflow"));
        self.ft.accounts.insert(account_id, &new_balance);
    }

    /// Move available balance into the locked bucket. Total supply is unchanged;
    /// `ft_balance_of` immediately excludes the locked amount.
    pub(crate) fn internal_lock(&mut self, account_id: &AccountId, amount: u128) {
        require!(amount > 0, "stake must be positive");
        let balance = self.ft.internal_unwrap_balance_of(account_id);
        require!(balance >= amount, "insufficient available balance");
        self.ft.accounts.insert(account_id, &(balance - amount));
        self.locked_total = U128(
            self.locked_total
                .0
                .checked_add(amount)
                .unwrap_or_else(|| env::panic_str("locked overflow")),
        );
    }

    /// Burn supply that belongs to a contract vault (not to a token account).
    pub(crate) fn internal_burn_supply(&mut self, amount: u128) {
        if amount == 0 {
            return;
        }
        self.ft.total_supply = self
            .ft
            .total_supply
            .checked_sub(amount)
            .unwrap_or_else(|| env::panic_str("burn exceeds total supply"));
        self.burned_total = U128(
            self.burned_total
                .0
                .checked_add(amount)
                .unwrap_or_else(|| env::panic_str("burned overflow")),
        );
    }

    /// Mint reward tokens into the reward vault; winners later move them to
    /// their balances. Supply increases here, exactly once per settled day.
    pub(crate) fn internal_mint_reward(&mut self, amount: u128) {
        if amount == 0 {
            return;
        }
        self.ft.total_supply = self
            .ft
            .total_supply
            .checked_add(amount)
            .unwrap_or_else(|| env::panic_str("mint overflow"));
        self.reward_vault = U128(
            self.reward_vault
                .0
                .checked_add(amount)
                .unwrap_or_else(|| env::panic_str("reward vault overflow")),
        );
        self.reward_minted_total = U128(
            self.reward_minted_total
                .0
                .checked_add(amount)
                .unwrap_or_else(|| env::panic_str("minted overflow")),
        );
    }
}
