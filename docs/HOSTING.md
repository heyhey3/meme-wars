# Publish the demo: GitHub → Vercel → X → submission

This is the human-operated path. Nothing here changes the contract; the demo
contract is already live at `war-demo.testnet`. The agent must not push,
publish, post or submit without an explicit human confirmation.

## 0. What you need

| Account | What it is used for | Who acts |
|---|---|---|
| GitHub | public repository judges can read | human confirms; agent can run `gh` if authorized |
| Vercel | public frontend URL | human logs in; agent can run `npx vercel` after login |
| X | required demo post | human posts only |
| NEAR mainnet | payout account for the prize | human creates/provides |
| NEAR testnet | already done (`war-demo.testnet`) | — |

The local repo is your checkout of this project, branch `main`.
The frontend points at `war-demo.testnet`; the demo keeper is currently running
on this machine (`node scripts/keeper.mjs`).

## 1. Publish the repository on another GitHub account

### 1a. Authenticate the target account

The machine is currently logged into one GitHub account. To use a different
one, run the interactive login yourself (the `!` prefix runs it in this
session so the output lands here):

```bash
! gh auth login
```

Choose **GitHub.com**, **HTTPS**, **Login with a web browser**, and the target
account. If the other account is already added, switch instead:

```bash
! gh auth switch
```

Check:

```bash
gh auth status
```

### 1b. Create the repo and push

Private first; make it public only after the checks below.

```bash
cd /path/to/meme-wars

# Before pushing: no secrets, no .env files, no keys
./scripts/check-secrets.sh

# Create <owner>/<repo> on the active account and push main.
# This pushes. Run it yourself, or tell the agent the exact owner/repo and
# confirm that it may push.
gh repo create <owner>/<repo> --private --source=. --remote=origin --push
```

If you prefer the website: create an empty repository (no README, no
`.gitignore`, no license), then:

```bash
cd /path/to/meme-wars
git remote add origin git@github.com:<owner>/<repo>.git
git push -u origin main
```

### 1c. Make it public (required by the hackathon)

Only after `check-secrets.sh` passes and you have reviewed the repo:

```bash
gh repo edit <owner>/<repo> --visibility public \
  --accept-visibility-change-consequences
```

Then the repository URL is the submission's `projectUrl`.

## 2. Deploy the frontend to Vercel

### 2a. Dashboard (easiest)

1. Open <https://vercel.com/new> and sign in with the target Vercel account.
2. **Import Git Repository** → choose the GitHub repo. If it is private, grant
   the Vercel GitHub app access to that repo.
3. Set **Root Directory** to `frontend` (important: this is a monorepo).
4. Framework Preset: **Next.js**. Build Command: default (`next build`).
   Output: default. Do **not** choose a static export.
5. Add the environment variables below (Production, Preview and Development).
6. **Deploy**. Open the URL. Connect a testnet wallet and run the acceptance
   path.
7. Copy the deployment URL into `README.md` (Live section) and
   `docs/SUBMISSION.md` / Vercel project notes.

### 2b. CLI

```bash
! cd /path/to/meme-wars/frontend && npx vercel login
```

Then, after login:

```bash
cd /path/to/meme-wars/frontend
npx vercel --prod
```

The prompts: link to existing project? **N**; project name `meme-wars`; root
directory `./` (you are already in `frontend`); build settings default.
Set env vars in the Vercel dashboard (Project → Settings → Environment
Variables) or with `npx vercel env add <NAME> production` and redeploy.

### 2c. Environment variables

The code has working defaults for the demo, but set these explicitly:

| Name | Value | Scope |
|---|---|---|
| `NEXT_PUBLIC_NETWORK_ID` | `testnet` | all |
| `NEXT_PUBLIC_CONTRACT_ID` | `war-demo.testnet` | all |
| `NEXT_PUBLIC_RPC_URL` | `https://test.rpc.fastnear.com` | all |
| `NEXT_PUBLIC_EXPLORER_URL` | `https://explorer.testnet.near.org` | all |
| `NEAR_RPC_URL` | `https://test.rpc.fastnear.com` | server (`/api/rpc`) |
| `NEXT_PUBLIC_REPO_URL` | the public GitHub URL | all, optional footer link |

Why a proxy: browser reads go to `/api/rpc` (same origin), which validates
that the call is a view call to `war-demo.testnet`, caches responses, and
forwards to FastNear. This avoids CORS/429 on the public RPC. Writes are
signed by the wallet and go directly to the chain.

The frontend needs a Node/serverless runtime for `/api/rpc`; it is not a pure
static site. Vercel supports this by default for Next.js. If the public RPC is
slow or rate-limited, put a provider key behind `NEAR_RPC_URL` (the browser
never sees it).

### 2d. Keep the demo alive (optional but recommended)

Vercel hosts only the frontend. The seeded players are driven by
`scripts/keeper.mjs`; while it runs on this machine (or a small server with
the two demo keys), the bots settle, claim and re-enlist every 30 seconds.
If the keeper stops, the game still works: any wallet can press **Settle**,
`enlist` auto-settles up to 7 overdue days, and the contract never depends on
the keeper. The bots just stop playing after their current day.

Keys live in `~/.near-credentials/testnet/`; never upload them to Vercel or
commit them. If you want a self-running hosted demo without this laptop, the
clean next step is a Vercel Cron + a server-only keeper key in Vercel env;
that is demo automation, not part of the game contract.

### 2e. Post-deploy smoke test

```bash
# replace with the Vercel URL
curl -s -X POST https://<your-app>.vercel.app/api/rpc \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"query","params":{"request_type":"call_function","finality":"final","account_id":"war-demo.testnet","method_name":"check_supply","args_base64":"e30="}}'
```

It should return `true` in the base64 result. Then open the app, connect a
testnet wallet, pick a side, enlist, settle, claim, and open Map + Season.

## 3. Post the demo on X

The human publishes it. The agent only prepares the draft. Required by the
rules:

- say it was **built at NEAR HACKATHON**;
- tag `@NEARProtocol` and `#NEARHackathon`;
- attach a video or screenshots.

Suggested post:

```text
built at NEAR HACKATHON — Meme Wars: pick DOGS or CATS, stake $WAR in a daily
on-chain war, and the supply reacts. Winners mint, losers burn, the map
remembers. 60-second testnet demo: <VERCEL URL>

@NEARProtocol #NEARHackathon @NearLegion @NearBuilders

[video or screenshots]
```

Good attachments (already in the repo):

- `docs/screenshots/battle.png`
- `docs/screenshots/map.png`
- `docs/screenshots/season.png`
- `docs/screenshots/log.png`

A 60–90 second screen recording works better: open the Vercel URL, connect,
pick a faction, enlist, wait for the day, settle, claim, show the map tile and
the event log. Mention the contract address and the 60-second demo days.
After posting, copy the post URL; it becomes the submission's `demoUrl`.

## 4. Final submission

Gather these values (the human decides every one):

- project name
- lead name
- contact email
- team size (`1`, `2 - 4`, `4 - 6`, `6 - 8`, `8+`)
- tracks (`memecoins`; `games` is optional)
- mainnet payout account
- public repository URL (`projectUrl`)
- X post URL (`demoUrl`)
- description (`idea`, 20–2000 chars)
- consent to the contact notice
- one UUID `requestId`, reused on retries

Then ask the agent to print the **complete JSON payload**. Check it together.
Nothing is sent until the human says yes. Do not add a `website` field; it is
a spam trap. Deadline: **2026-11-14 23:59 UTC**. Full checklist:
`docs/SUBMISSION.md`.

## 5. One-page order of operations

```text
1. gh auth login / switch to the target GitHub account
2. ./scripts/check-secrets.sh
3. gh repo create <owner>/<repo> --private --source=. --remote=origin --push
4. make the repo public
5. Vercel: import repo, root=frontend, add env vars, deploy
6. curl the deployed /api/rpc, then test the wallet flow in a browser
7. keep `node scripts/keeper.mjs` running while the demo is public
8. post on X with the required phrase/tags/video
9. fill the submission values, print the payload, get explicit OK, send once
```
