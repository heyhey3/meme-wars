# Submission — draft only, **not sent**

The hackathon API and rules are at
<https://nearhackathon.com/HACKATHON.md>. The live file overrides the older
`docs/AI_DEV_SPEC.md` field list. Deadline: **2026-11-14 23:59 UTC**. One
submission per project. Submit only after the human has seen the full JSON and
said yes.

## Live API fields (copied from HACKATHON.md)

`POST https://nearhackathon.com/api/applications`,
`Content-Type: application/json`, body up to 12,000 bytes.

| Field | Type | Rule |
|---|---|---|
| `requestId` | string | UUID, generated once and reused on retries |
| `projectName` | string | 2–80 chars |
| `leadName` | string | 2–80 chars |
| `email` | string | valid email, max 160 chars; max 2 submissions per email |
| `size` | string | one of `1`, `2 - 4`, `4 - 6`, `6 - 8`, `8+` |
| `tracks` | string[] | ids from the 13 tracks, each once |
| `nearAddress` | string | mainnet payout account, 2–64 chars, lowercase |
| `projectUrl` | string | public repository URL, ≤300 chars, unique per repo |
| `demoUrl` | string | public demo post URL (the X post), ≤300 chars |
| `idea` | string | 20–2000 chars |
| `consent` | boolean | `true` only after the human agreed verbatim |

**Do not add other fields.** `website` is a spam trap: any non-empty value
rejects the submission. The older draft's `website` field must be omitted.

`nearAddress` is a **mainnet** payout account (named or 64-character implicit),
never `war-demo.testnet` or any other testnet account. `demoUrl` is the public
**X post** URL, not the Vercel URL; put the hosted frontend link in the post and
README.

### Contact consent (read verbatim before setting `true`)

> “I agree that the organizers may use these details to review our submission
> and contact us about this hackathon.”

## Placeholders the human must fill

| Value | Status |
|---|---|
| `projectName` | `Meme Wars` proposed; human decides |
| `leadName` | **TBD** |
| `email` | **TBD** |
| `size` | **TBD** (`1`, `2 - 4`, `4 - 6`, `6 - 8`, `8+`) |
| `tracks` | `["memecoins"]` recommended. `games` arguably fits the loop; add only if the human is comfortable defending both. |
| `nearAddress` | **TBD** — a mainnet named or implicit account the human controls |
| `projectUrl` | **TBD** — public repository URL; repository must be public and pushed |
| `demoUrl` | **TBD** — the X post URL (human publishes) |
| `idea` | draft below; human edits |
| consent | only after reading the exact notice to the human |
| `requestId` | generate a UUID once; reuse on 400/503 retries |

### Draft `idea` (under 2000 chars)

> Meme Wars is a NEP-141 memecoin whose supply is a function of a daily
> two-faction war. Players join DOGS or CATS, stake $WAR once a day, and the
> weaker side gets an underdog bonus. The winner splits a fixed daily mint and
> captures a tile on a 5×5 map; the loser's stake is burned 20%. Cold days burn
> the treasury instead of minting. After 30 days the faction owning the most
> tiles takes a slice of the treasury, split by season power. Settlement and
> claims are O(1), parameters are fixed in `new()` with no admin/pause/upgrade
> method, and every mint, burn and capture is a NEP-297 event. The repo includes
> a pure-Python 60-day simulation (five scenarios, fixed seed, sensitivity
> analysis) that chose the production parameters: the balanced case is
> deflationary, the treasury survives, and a minimum-stake sybil raid returns
> −1.42% in the committed run. The testnet demo is 60 seconds per day and is
> live at `war-demo.testnet`; the frontend shows the countdown, personal streak,
> tug bar, map, season and full mint/burn/claim ledger.

## X demo post (human publishes)

Required by the rules: say it was built at NEAR HACKATHON, tag
`@NEARProtocol` and `#NEARHackathon`, and attach a video or screenshots.
Optional: `@NearLegion`, `@NearBuilders`.

Draft:

```text
built at NEAR HACKATHON — Meme Wars: pick DOGS or CATS, stake $WAR in a daily
on-chain war, and the supply reacts. Winners mint, losers burn, the map
remembers. 60-second testnet demo: <HOSTED FRONTEND URL>

@NEARProtocol #NEARHackathon @NearLegion @NearBuilders

[video or screenshots]
```

The demo post URL goes in `demoUrl`. Do not post it from an agent.

## Pre-submit checklist

- [ ] Repository is public and pushed by the human; keep it public through judging.
- [ ] README has the “do X, see Y” path, the track fit and the hard-requirements evidence.
- [x] README discloses AI assistance, open-source building blocks, prior work and demo bots.
- [ ] `LICENSE` present (MIT).
- [ ] No secrets in the repo or its history (`scripts/check-secrets.sh`).
- [x] Hosted frontend is live at <https://meme-wars-iota.vercel.app>; keep it live through 2026-11-18 (ideally 2026-11-25).
- [ ] X post is live, public, says “built at NEAR HACKATHON”, tags `@NEARProtocol` and `#NEARHackathon`, attaches a video/screenshots, and links the hosted demo + repo.
- [ ] `nearAddress` is a **mainnet** payout account, supplied by the human; not `war-demo.testnet`.
- [ ] `tracks` includes every track the project genuinely fits (`memecoins`; `games` optional/human decision).
- [ ] `idea` is 20–2000 chars and mentions the problem, product and NEAR fit.
- [ ] `projectUrl` is the public repository URL; `demoUrl` is the X post URL, not the Vercel URL.
- [ ] If submitting a second independent project, both READMEs name each other.
- [ ] The full JSON payload has been printed and the human said OK.
- [ ] No `website` field; no extra fields.
- [ ] `requestId` saved for retries.
- [ ] The live `HACKATHON.md` has been re-read just before sending.

## Sending (after explicit OK only)

1. Print the complete JSON with the real values.
2. Wait for an unambiguous human “yes”.
3. Send once. Handle status codes:
   - `201` saved → tell the human.
   - `400` → fix the listed fields, reuse the `requestId`.
   - `403` → stop; submissions may be closed or the request looked cross-site.
   - `409` → repository already submitted or email limit; do not work around it.
   - `413` → shorten `idea`.
   - `503` → wait a minute, resend with the same `requestId`.
4. Save the response/screenshot to `docs/SUBMISSION.md` or a separate record.
5. Mistakes are fixed via <https://nearhackathon.com/request-changes>, not by
   submitting again.
