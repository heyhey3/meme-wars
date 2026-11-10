# Progress

Date: 2026-11-10 (UTC). Project: Meme Wars ($WAR), NEAR HACKATHON 2026,
track `memecoins`.

## Status at a glance

| Phase | Status | Notes |
|---|---|---|
| P0 setup / rules | Done | Read live `HACKATHON.md`, track 11, `00-setup.md`, `SUBMITTING.md`; installed the official NEAR agent skills. |
| P1 contract core | Done | NEP-141 + game + settlement + claims + seasons; 28 tests pass; testnet deploy. |
| P2 frontend core | Done locally | Battle page, wallet, stake, countdown, tug bar, claims, log, demo banner. Hosted URL pending. |
| P3 map / season | Done | 5×5 map with recapture ownership, living season tiles, hall of fame. |
| P4 spectator markets | Not shipped | Optional P1 layer; documented as future work. |
| P5 60-day simulation | Done | Five scenarios, sensitivity, fixed seed, SVG/CSV/JSON. |
| P6 partners / AI | Explored only | No fake integrations; core has zero partner dependencies. |
| P7 submission | Pending human | Payload and X draft prepared; not sent. |

## Deployments

### Demo (the one judges should use)

- Contract: **`war-demo.testnet`** (testnet)
- Config: `config/demo.json` / `config/demo.init.json`
  - 60-second days, 30-day season, demo faucet 100,000 WAR/account
  - daily mint 500,000 WAR, 20% loss burn, 1.50× underdog
  - cold line 150,000 WAR, cold burn 25,000 WAR, season bonus 5%
- Account creation tx: `EA35WdKkX2EuJ3A6Jd5jaK2ucWtsCxikdxK3pC9pBJYu`
- Initial code deploy tx:
  `8r6kL3SKBQ3J7waB2PkUHGbRQjKa5HnQKCL91cpJGyr4`
- Current code deploy tx (path-sanitized, state-preserving):
  `6x5uW8keTApyfiyBZF3bPb4rPXgRzkdR2LaEVxxz8d6o`
- On-chain code hash:
  `FUPGHgqHTidZM9RMWj9Pg7wbAn2twZz4Fsa6YnuxoGgV`
- Matching local artifact: `artifacts/meme_wars.wasm`
  (SHA-256 `d70778ea505882540cdf22cd463502f9134b83e39c06bb20ff717eae33d019ee`)
- Seeded demo players:
  - `meme-wars-dogs.testnet` (DOGS)
  - `meme-wars-cats.testnet` (CATS)
  - First enlist txs:
    `72vpLeTiLsK4uznKwJfV2vBsVvdcidYavmsPxPbzB3en` (DOGS),
    `FskvRmtjvowHbAMyWvTojFugG2UBdyYbQxZQ7CkrAZCm` (CATS)
  - Top-up `ft_transfer` txs:
    `E8wvCSspQ42UWn8DyLcYqxHuaZWLYETytVGbwwXiwEty`,
    `EcQVYYZ7EP41592TcNWq4bNNSxEKWLwa6GxYPFUsmqaj`
- Example keeper txs:
  - settle: `6RJsPTJ2ZVt2kjtbNZXmWH87p3hfdcktuFBQ3N4wt2iH`
  - enlist: `7xNwyXyA43V1HBwedpxpnRQZ528HJJrCsNNdonEfTQgd`
  - claim_reward: `5gmW5wWFDw7ZGWGbBnArhSPpu1u48S4WFGsHStKgRxpK`
  - claim_stake: `HWgMPbYCtc8yJZVQUWFMw5LCSxYyNR9vh2P5wToabvAA`
- Demo keeper: `scripts/keeper.mjs` (running locally during development;
  keys in `~/.near-credentials`, never in the repo).
- Demo state is real chain state. The two seeded players are demo bots and are
  labeled as such in the README and UI log.
- Season 1 closed at day 30 in an **11–11 final-map tie** (3 tiles unclaimed),
  so no season bonus was released. The hall of fame records it. Later seasons
  continue on the same contract; the page reads the current season live rather
  than assuming a fixed one. This is a good demonstration of the final-map
  rule, including the tie case.

### Earlier staging (not for judges)

Earlier development deployments were used to validate `new()`, the 60-second
clock and the keeper. They are not referenced by the frontend or README and
can be deleted at the end of the hackathon. Their IDs are intentionally not
repeated here; the only demo a reviewer needs is `war-demo.testnet`.

### Production recipe

`config/prod.json` / `config/prod.init.json`: 24-hour days, 100,000 WAR daily
mint, 20% burn, 2.00× underdog, cold line 3,750,000, cold burn 250,000,
season bonus 2%, no faucet. Not deployed: a dormant 24-hour game would only
accumulate cold days. Deploy with a fresh account and remove full-access keys.

## Test and build results

- Contract: `cargo test` → **28 passed, 0 failed**.
  Coverage: NEP-141 transfer/storage/metadata; join once; min/max; daily
  enlist; streaks; underdog flip; tie; cold; burns; claims once-only; claim
  window; season bonus; season leftover burn; map recapture ownership;
  settlement ordering/idempotence; auto-settle; accounting invariants.
- Contract build: `cargo near build non-reproducible-wasm` with
  `--remap-path-prefix=${HOME}=/home/builder` → 326.9 KB wasm, SHA-256 above.
  The remap keeps local build paths out of the binary. Rust 1.95.0 pinned in
  `rust-toolchain.toml`.
- Frontend: `npx tsc --noEmit` clean; `npm run build` succeeds with 9 routes
  (including the dynamic `/api/rpc` proxy).
- Simulation: `python3 sim/simulate.py` self-test passes; results committed.
- Screenshots: `docs/screenshots/*.png` from the running demo.

## Decisions and deviations from the first draft spec

1. **Production underdog is 2.00×, not 1.50×.** The simulation shows the fixed
   1.50× bonus leaves a 70/30 community at 100% majority wins; 2.00× brings it
   to ~80/20. The balanced scenario stays inside 35–65% with either value.
   The demo keeps 1.50× because it is scaled for two bots.
2. **Daily mint is 100,000 WAR in production** (not 500,000). At 500,000 a
   minimum-stake sybil raid is profitable; at 100,000 with a 2% season bonus,
   the committed run returns −1.42% for sybils. The demo keeps 500,000 so a
   five-minute show has visible payouts.
3. **The season winner is decided by final map ownership, not daily win
   count.** A 30-day season over 25 tiles repeats tiles. The first
   implementation only incremented counts; this was fixed to decrement the
   previous owner on recapture and to keep `season.tiles` live between
   settlements. Tests cover the recapture.
4. **No spectator markets, faction switching, Intents/HOT/Rhea, or AI
   Prophet.** The core is complete and verifiable; the optional layers are
   documented as not shipped rather than stubbed or faked.
5. **Frontend reads through `/api/rpc`.** The public FastNear testnet RPC
   rate-limits browser bursts and does not support JSON-RPC batches. The
   proxy keeps reads same-origin and caches immutable/slow views. Polling is
   every 8 seconds; the countdown is local.
6. **Demo bots are labeled.** They are not presented as organic users. The
   keeper is optional and the contract works without it.
7. **Live HACKATHON.md fields differ from the first draft spec.** The actual
   submission API uses `leadName`, `size`, `idea`, `projectUrl` (repository)
   and `demoUrl` (X post), and says not to add extra fields; `website` is a
   spam trap. `docs/SUBMISSION.md` follows the live file, not the draft.

## Open items (human)

- Hosted frontend URL (Vercel/Netlify; no credentials in this environment).
- X demo post with “built at NEAR HACKATHON”, @NEARProtocol and
  #NEARHackathon, plus a video or screenshots.
- Project name, lead name, contact email, team size.
- Mainnet payout account.
- Public repository URL; explicit confirmation to push/make public.
- Track list: `memecoins` recommended; `games` is a judgment call.
- Final submission payload; show it and wait for an explicit OK. Do not send
  twice; use `/request-changes` for mistakes.
- Run `node scripts/keeper.mjs` on the demo host if the seeded bots should
  keep playing. The demo keys must be provisioned outside the repo.

## Reproduce

```bash
# contract
cd contracts/meme-wars
DEVELOPER_DIR=/Library/Developer/CommandLineTools cargo test

# frontend
cd frontend
npm install
npm run build

# simulation
python3 sim/simulate.py

# on-chain views + forbidden-method source check
CONTRACT=war-demo.testnet ./scripts/verify.sh
```
