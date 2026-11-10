# Scripts

These scripts are demo automation and verification. They are **not** part of
the contract and the game works without them.

## Keys

`seed.mjs` and `keeper.mjs` read testnet keys from
`~/.near-credentials/testnet/<account>.json`. Create the two demo players with
near-cli-rs and `save-to-legacy-keychain`:

```bash
near account create-account sponsor-by-faucet-service meme-wars-dogs.testnet \
  autogenerate-new-keypair --signature-scheme ed25519 \
  save-to-legacy-keychain network-config testnet
near account create-account sponsor-by-faucet-service meme-wars-cats.testnet \
  autogenerate-new-keypair --signature-scheme ed25519 \
  save-to-legacy-keychain network-config testnet
```

Never put a private key in this repository or in `.env`. The default contract
is `war-demo.testnet`; override it with `CONTRACT=<id>`.

## Commands

```bash
cd scripts
npm install

# one-time: register both players, claim the demo faucet, join and enlist
node seed.mjs

# optional live demo: settle, claim, re-enlist every 30s
node keeper.mjs
```

The keeper's alternating stake pattern (100k vs 80k) makes the underdog side
alternate, so the map is contested. The contract does not depend on this; a
judge can settle manually and any wallet can call `settle_day`.

`deploy.sh`, `verify.sh`, and `check-secrets.sh` are at this level. `verify.sh`
is read-only and safe to run against any deployment.
