#!/usr/bin/env bash
# On-chain acceptance checks for the deployed demo contract.
# Usage: CONTRACT=war-demo.testnet ./scripts/verify.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACT="${CONTRACT:-war-demo.testnet}"
RPC="${RPC:-https://test.rpc.fastnear.com}"
SRC="$ROOT/contracts/meme-wars/src"

b64() {
  printf '%s' "$1" | base64 | tr -d '\n'
}

view() {
  local method="$1"
  local args="${2:-}"
  if [ -z "$args" ]; then args='{}'; fi
  local body
  body=$(printf '{"jsonrpc":"2.0","id":1,"method":"query","params":{"request_type":"call_function","finality":"final","account_id":"%s","method_name":"%s","args_base64":"%s"}}' \
    "$CONTRACT" "$method" "$(b64 "$args")")
  local response
  response=$(curl -sf -m 20 "$RPC" -H 'Content-Type: application/json' -d "$body")
  echo "$response" | jq -r 'if .error then error("rpc: " + (.error.cause.name // .error.message)) else (.result.result | implode) end'
}

echo "== Meme Wars on-chain verification =="
echo "contract: $CONTRACT"
echo "rpc:      $RPC"
echo

echo "-- ft_metadata"
META=$(view ft_metadata)
echo "$META" | jq -e '.spec == "ft-1.0.0" and .symbol == "WAR"' >/dev/null
echo "   spec=ft-1.0.0 symbol=WAR"

echo "-- get_config"
CONFIG=$(view get_config)
python3 - "$CONFIG" <<'PY'
import json, sys
c = json.loads(sys.argv[1])
sum_alloc = int(c["treasury_allocation"]) + int(c["community_allocation"]) + int(c["demo_faucet_pool"])
assert int(c["genesis_supply"]) == sum_alloc, "genesis does not equal allocations"
assert 0 <= c["loss_burn_bp"] <= 5_000
assert 0 <= c["season_bonus_bp"] <= 1_000
print(f"   genesis={c['genesis_supply']} allocations=ok demo_mode={c['demo_mode']}")
PY

echo "-- check_supply"
SUPPLY_OK=$(view check_supply)
if [ "$SUPPLY_OK" != "true" ]; then
  echo "FAIL: check_supply returned $SUPPLY_OK" >&2
  exit 1
fi
echo "   true"

echo "-- get_clock / get_stats / get_map"
CLOCK=$(view get_clock)
echo "$CLOCK" | jq -e '.current_day >= 1 and .day_length_ns > 0' >/dev/null
STATS=$(view get_stats)
echo "$STATS" | jq -e '.total_supply != "0"' >/dev/null
MAP=$(view get_map)
[ "$(echo "$MAP" | jq 'length')" = "25" ]
echo "   current_day=$(echo "$CLOCK" | jq -r '.current_day') verified=$(echo "$STATS" | jq -r '.last_settled_day') map=25"

echo "-- get_log_tail"
LOG=$(view get_log_tail '{"limit":3}')
echo "$LOG" | jq -e 'type == "array"' >/dev/null
echo "   entries=$(echo "$LOG" | jq 'length')"

echo "-- source: no admin methods"
if grep -RInE 'fn[[:space:]]+(set_config|update_config|pause|upgrade|withdraw_treasury)[[:space:]]*\(' "$SRC"; then
  echo "FAIL: forbidden admin-like method found" >&2
  exit 1
fi
echo "   none"

echo "-- source: private FT resolver"
if ! grep -B2 'fn ft_resolve_transfer' "$SRC/lib.rs" | grep -q '#\[private\]'; then
  echo "FAIL: ft_resolve_transfer is not #[private]" >&2
  exit 1
fi
echo "   #[private]"

echo
echo "PASS: $CONTRACT views and invariants are consistent."
