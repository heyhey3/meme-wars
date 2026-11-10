# Security notes

Status: hackathon MVP on **testnet only**. It has not been audited by a third
party. This document is a manual review, the test evidence, and the known
limitations. The core contract is small enough to review in one sitting.

## Manual review against the NEAR audit checklist

The official `near-contract-audit` skill was installed and its quick-reference
list was checked by hand.

| Severity / detector | Status | Notes |
|---|---|---|
| High · `non-private-callback` | Pass | `ft_resolve_transfer` is `#[private]`; there are no other callbacks. |
| High · `reentrancy` | Pass | Core path (`join`, `enlist`, `settle`, `claim`) makes no cross-contract calls. `ft_transfer_call` uses the standard resolver. |
| High · `incorrect-argument-or-return-types` | Mostly pass | All token amounts use `U128` in JSON. Timestamps are `u64` JSON numbers; see the precision note below. |
| High · `unsaved-changes` | Pass | `store` collections flush on drop; tests read back every mutated map/vector. The near macro writes state after each call. |
| High · `owner-check` | N/A (intentional) | There is no owner. `settle_day` and `close_claims` are permissionless by design; they only apply fixed rules. |
| High · `yocto-attach` | Pass | `ft_transfer`, `ft_transfer_call`, `storage_withdraw`, `storage_unregister` use the standard 1-yocto guard. |
| High · `storage-collision` | Pass | `StorageKey` variants are unique; the FT accounts map uses its own prefix. |
| High · `required-initialization-macro` | Pass | `new` is `#[init]`; it can run once. |
| Medium · `gas-griefing` | Pass | Auto-settle is capped at 7 days; log/seed/claims views are capped (200/30/60); no unbounded loops. |
| Medium · `insecure-random` | Pass | No randomness or oracle. Outcomes are deterministic from on-chain state. |
| Medium · `prepaid-gas` | Pass | The only cross-contract path is the standard FT resolver with its own gas; the game does not call outward. |
| Low · `cover-storage-cost` | **Accepted risk** | FT storage is covered by NEP-145. Game records are paid by the contract account; see storage growth below. |
| Low · `unsafe-math` | Pass | `checked_*` for add/sub, `mul_div` with a 256-bit intermediate, basis points, no floats. |
| Low · `float-math` | Pass | None. |

## Contract-specific checks

- `genesis_supply == treasury + community + demo faucet` is asserted in
  `new()`.
- `ft_total_supply == genesis + reward_minted - burned` is exposed as
  `check_supply()` and asserted by tests and `scripts/verify.sh`.
- Locked stakes are moved out of `ft_balance_of` by a custom internal lock, not
  by `FungibleToken::internal_withdraw` (which decreases supply). This was a
  deliberate design choice after reading the near-contract-standards source.
- Winners' reward shares use a 256-bit multiply/divide; a plain `u128`
  multiplication could overflow at 24 decimals.
- Settlement is sequential and idempotent: a repeated day reverts; the
  sequential check also prevents season bookkeeping from running twice.
- Map recapture moves ownership counts from the old faction to the new faction;
  the final map decides the season. This is covered by a dedicated test.
- The reward claim window closes unclaimed *rewards* only; stakes never expire.
- `storage_unregister` ignores `force=true`, so a positive FT balance is never
  silently burned. A user with locked stakes can unregister at a zero available
  balance and must re-register before claiming; no funds are lost.
- The log ring is capped at 200; each event is also emitted as NEP-297.
- The tests exercise the accounting identity after wins, ties, cold days,
  claims and seasons.

## Known limitations and risks

1. **Demo deployer key.** The `war-demo.testnet` account still has the
   full-access key created for the hackathon. The contract has no upgrade
   method, but a key holder could redeploy the code or delete the account. The
   production checklist is to delete all full-access keys after deploy and
   record the transaction. This is disclosed; do not claim the demo account is
   fully immutable.
2. **Storage growth / griefing.** Each player writes a `Member`, one
   `Enlistment` per day, and season power. The contract account pays for game
   storage; NEP-145 deposits cover the FT account, not every game record. At
   hackathon scale this is small, but a funded attacker could add many accounts
   and grow storage until the contract's NEAR runs out. Production options:
   charge a one-time player storage deposit, prune old enlistments after the
   claim window, or move claims to a Merkle root. The demo contract holds
   enough NEAR for the hackathon; monitor it.
3. **Timestamp JSON precision.** `ClockInfo` and `Config` expose `u64`
   nanosecond timestamps as JSON numbers. JavaScript numbers lose precision
   above 2^53; at ~1.79e18 the error is under a microsecond. It affects display
   countdowns only; day boundaries and settlement are computed on-chain. Token
   amounts are `U128` strings and are not affected.
4. **Rounding dust.** Reward shares and loser refunds use floor division. Dust
   stays in `locked_total` / the reward vault. `close_claims` burns unclaimed
   reward dust after the window; stake dust is economically negligible but can
   remain locked. This is a known integer-math property.
5. **No personhood.** Stakes, caps, fixed pools, streaks and the underdog make
   sybil raids costly; they do not identify one person with many accounts. The
   30-seed simulation is negative on average but not on every seed.
6. **Extreme faction imbalance.** The MVP has no faction switching. A 70/30
   player split still favors the majority (~80/20 day wins with the 2.00×
   underdog). The season reset limits lock-in; the daily math remains.
7. **Demo faucet.** Only in `demo_mode`. It is a testnet convenience, not a
   production distribution.
8. **Frontend RPC proxy.** `/api/rpc` only proxies `call_function` queries for
   the configured contract. It caches view responses (1.2 s default; 1 h for
   `get_config`) and can serve a stale response for up to 120 s if the upstream
   RPC fails. Writes never go through the proxy; the wallet signs them.
   Wallet Selector is configured with the FastNear testnet node URL for CORS.
9. **Not audited.** No third-party audit. Review the 326 KB wasm and the Rust
   source against the deployed code hash before using real funds.
10. **Testnet only.** Tokens have no value. Do not send mainnet assets.

## Repository privacy

No personal GitHub/X/Vercel handles, email addresses, local home-directory
paths, SSH keys or API keys are committed to this repository. The only account
IDs in the repo are **project-owned testnet accounts** created for the demo
(`war-demo.testnet` and the two seeded players) plus the public contract
address. The demo players' signing keys live outside the repository in
`~/.near-credentials`; `.env*`, `.vercel/`, `.netlify/`, `*.pem`, `*.key` and
`near-credentials/` are gitignored. `scripts/check-secrets.sh` is run before
publishing.

The wallet addresses, GitHub repo URL, X post URL and Vercel app URL become
public only when the human chooses to publish them; the agent never posts or
pushes them on its own.

## Commands

```bash
# contract tests
cd contracts/meme-wars
DEVELOPER_DIR=/Library/Developer/CommandLineTools cargo test

# on-chain views + supply invariant + forbidden admin methods
CONTRACT=war-demo.testnet ./scripts/verify.sh

# repository secret scan (also checks .env files are ignored)
./scripts/check-secrets.sh
```

`scripts/verify.sh` also greps for `set_config`, `update_config`, `pause`,
`upgrade`, `withdraw_treasury` and requires the `#[private]` FT resolver.
