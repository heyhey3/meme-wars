# Partner integrations

Status: **explored only. No partner is integrated into the core contract.**
This is intentional. The track rules say partner integration is not required;
the mechanic is the score. Nothing in `enlist`, `settle_day` or the claims
calls a partner, and no partner can pause the game, change a parameter or move
the treasury.

| Partner | Status | Role considered | Why / evidence |
|---|---|---|---|
| meme.cooking | explored, not integrated | launchpad / exposure | The mechanic needs native mint/burn. The demo is a self-deployed NEP-141 (`war-demo.testnet`). A launchpad import would be a listing decision, not a contract dependency. No launchpad URL or fake token page is claimed. |
| NEAR Intents | explored, not integrated | cross-chain buy / deposit | 1Click has no testnet (live HACKATHON.md Q-007), so a truthful testnet swap cannot be shown. No API keys or fake quotes are in the repo. A production frontend can add a 1Click quote/deposit adapter without touching the contract. |
| HOT | explored, not integrated | chain-abstraction login | Wallet Selector with MyNearWallet and Meteor is the current onboarding path. HOT can be added as another wallet module; the contract does not care how the wallet signs. No login recording is claimed. |
| Rhea | explored, not integrated | $WAR/NEAR liquidity | No mainnet liquidity was created for a testnet demo. A production launch can point a buy button at a Rhea/Ref pool. No pool address is claimed. |
| NEAR.AI | explored, not shipped | AI War Prophet analyst | A predictor would read views and be a player/analyst, never an admin. Not shipped in the MVP; no model output is presented as real. |
| BRRRAIN | explored, not shipped | fallback AI inference | Same as NEAR.AI. No API key, no generated prediction file. |
| OutLayer | explored, not shipped | agent custody/signing | Not needed for the MVP; the demo keeper uses ordinary testnet keys. |
| Agent Market | explored, not shipped | list the Prophet agent | No listing. |
| Trezu | ops only | team multisig | Not used by the contract or the demo. |
| SputnikDAO | ops only | community grants | Not used. |
| NEAR Business | ops only | confidential multisig | Not used. |
| Aurora | not used | EVM mirror | Out of scope; would need a separate EVM token. |
| HEX | not used | cross-chain swap alternative | Intents is the considered path; neither is integrated. |
| SVRN | not used | sovereign tech | No relevance to the mechanic. |
| GoMining | not used | Bitcoin mining | No relevance. |
| Gulf Labs | not used | investor | Not a technical dependency. |
| NEAR Builders | community | feedback / promotion | Not a code dependency. |

## Rules this follows

1. **Core independence.** Partner outages cannot break enlist/settle/claim.
2. **No fake integrations.** Only “explored, not integrated” or “not used.”
3. **No extra complexity for partner points.** The mechanic is the deliverable.
4. **No partner admin.** No partner account gets a key to the game contract.
5. **Fallbacks are documented** for the optional production adapters
   (Intents → Rhea/Ref; HOT → Wallet Selector; NEAR.AI → BRRRAIN/cache).

## If a partner adapter is added later

- Put it in the frontend/scripts/AI layer, never in the contract.
- Keep the game path working when the partner is down.
- Put any API key in `.env` only; never commit it.
- Update this table only after a real transaction/response exists to cite.
