#!/usr/bin/env bash
# Build + deploy the Meme Wars contract with near-cli-rs.
#
# This script is intentionally a thin wrapper: near-cli-rs prompts for the
# signing tool/network confirmation, so it cannot be fully headless without
# credentials. Run it yourself and read the transaction preview.
#
# Fresh demo (testnet):
#   near account create-account sponsor-by-faucet-service <account>.testnet \
#     autogenerate-new-keypair --signature-scheme ed25519 save-to-keychain \
#     network-config testnet
#   ACCOUNT=<account>.testnet FRESH=1 ./scripts/deploy.sh
#
# Re-deploy code without re-initializing (state-compatible update):
#   ACCOUNT=war-demo.testnet FRESH=0 ./scripts/deploy.sh
#
# Production recipe (fresh account only):
#   ACCOUNT=<new-account> FRESH=1 CONFIG=config/prod.init.json ./scripts/deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NETWORK="${NETWORK:-testnet}"
ACCOUNT="${ACCOUNT:-}"
FRESH="${FRESH:-1}"
CONFIG="${CONFIG:-$ROOT/config/demo.init.json}"
WASM="$ROOT/contracts/meme-wars/target/near/meme_wars.wasm"

if [ -z "$ACCOUNT" ]; then
  echo "ACCOUNT is required (e.g. ACCOUNT=war-demo.testnet)" >&2
  exit 1
fi
if [ ! -f "$CONFIG" ]; then
  echo "config not found: $CONFIG" >&2
  exit 1
fi
if [ "$NETWORK" = "mainnet" ] && [ "${I_MEAN_MAINNET:-0}" != "1" ]; then
  echo "Refusing mainnet without I_MEAN_MAINNET=1. Testnet first." >&2
  exit 1
fi

cd "$ROOT/contracts/meme-wars"
echo "== build =="
cargo near build non-reproducible-wasm

echo "== deploy $ACCOUNT ($NETWORK, fresh=$FRESH) =="
if [ "$FRESH" = "1" ]; then
  # near-cli-rs prompts for the network and signing tool here.
  near contract deploy "$ACCOUNT" use-file "$WASM" \
    with-init-call new file-args "$CONFIG"
else
  # near-cli-rs prompts for the network and signing tool here.
  near contract deploy "$ACCOUNT" use-file "$WASM" without-init-call
fi

echo "== verify =="
CONTRACT="$ACCOUNT" "$ROOT/scripts/verify.sh"
