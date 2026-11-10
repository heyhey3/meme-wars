#!/usr/bin/env bash
# Lightweight repository secret scan. Run before committing/publishing.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

EXCLUDES=(
  --exclude-dir=.git
  --exclude-dir=node_modules
  --exclude-dir=target
  --exclude-dir=.next
  --exclude-dir=.claude
  --exclude-dir=screenshots
  --exclude-dir=results
  --exclude-dir=sim
  --exclude='*.wasm'
  --exclude='*.png'
  --exclude='*.svg'
  --exclude='package-lock.json'
  --exclude='check-secrets.sh'
  --exclude='.env.example'
)

PATTERN='private_key|privateKey|seed_phrase|seedPhrase|mnemonic|NEAR_PRIVATE_KEY|BRRRAIN_API_KEY|NEAR_AI_API_KEY|NEAR_INTENTS_API_KEY|ed25519:[1-9A-HJ-NP-Za-km-z]{40,}'

echo "== secret scan =="

if grep -RInE "${EXCLUDES[@]}" "$PATTERN" . ; then
  echo
  echo "FAIL: possible secret found above. Remove it and rotate the key." >&2
  exit 1
fi
echo "   no secret patterns in the working tree"

# The template may name variables but must not contain key material.
if grep -nE 'ed25519:[1-9A-HJ-NP-Za-km-z]{40,}|BEGIN (RSA|OPENSSH|EC|PRIVATE) KEY' .env.example 2>/dev/null; then
  echo "FAIL: key material in .env.example" >&2
  exit 1
fi
echo "   .env.example has no key material"

# Environment files must never be tracked; example files are fine.
ENV_FILES=$(find . -type f \( -name '.env' -o -name '.env.*' \) \
  -not -path './node_modules/*' -not -path './.next/*' \
  -not -name '*.example' 2>/dev/null || true)
if [ -n "$ENV_FILES" ]; then
  echo "$ENV_FILES" | while read -r file; do
    if git ls-files --error-unmatch "$file" >/dev/null 2>&1; then
      echo "FAIL: tracked env file: $file" >&2
      exit 1
    fi
  done
  echo "   env files exist locally but are not tracked:"
  echo "$ENV_FILES" | sed 's/^/     /'
fi

# Privacy: tracked files (including the wasm) must not embed a local home path.
# The script itself contains the pattern, so it is excluded.
echo "== local path scan =="
for pat in "${HOME:-}" "/Use""rs/"; do
  [ -z "$pat" ] && continue
  [ "$pat" = "/home/builder" ] && continue
  if git grep -a -l -F "$pat" -- . ':!scripts/check-secrets.sh' >/dev/null 2>&1; then
    echo "FAIL: local path '$pat' found in tracked files:" >&2
    git grep -a -l -F "$pat" -- . ':!scripts/check-secrets.sh' >&2
    exit 1
  fi
done
echo "   no local home paths"

echo "PASS: no secrets found."
