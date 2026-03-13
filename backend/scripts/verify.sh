#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

PORT="${PORT:-8115}"
BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:${PORT}}"
API_KEY="${API_KEY:-verify-key}"
SOLANA_RPC_URL="${SOLANA_RPC_URL:-http://127.0.0.1:8899}"
AUTHORITY_KEYPAIR_PATH="${AUTHORITY_KEYPAIR_PATH:-$HOME/.config/solana/id.json}"

if [[ -z "${STABLECOIN_CONFIG:-}" ]]; then
  STABLECOIN_CONFIG="$(node -e "const fs=require('fs');const p=process.env.HOME+'/.sss-token/active.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));process.stdout.write(j.config||j.configPda||j.stablecoinConfig||'');")"
fi

if [[ -z "$STABLECOIN_CONFIG" ]]; then
  echo "ERROR: STABLECOIN_CONFIG is not set and could not be derived from ~/.sss-token/active.json"
  exit 1
fi

export PORT BACKEND_URL API_KEY SOLANA_RPC_URL AUTHORITY_KEYPAIR_PATH STABLECOIN_CONFIG

echo "==> Building backend"
npm run build >/dev/null

LOG_FILE="/tmp/sss-backend-verify.log"
echo "==> Starting backend on ${BACKEND_URL}"
node dist/main.js >"$LOG_FILE" 2>&1 &
BACKEND_PID=$!

cleanup() {
  if kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "==> Waiting for readiness"
for _ in $(seq 1 30); do
  if curl --proxy "" -sS "${BACKEND_URL}/health/ready" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

curl --proxy "" -sS "${BACKEND_URL}/health/ready" >/dev/null

echo "==> Running smoke checks"
BACKEND_URL="$BACKEND_URL" API_KEY="$API_KEY" npm run test:smoke >/dev/null

assert_status_success() {
  local file="$1"
  node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));if(j.status!=='success'){console.error(j);process.exit(1)}" "$file"
}

echo "==> Running authenticated write checks"
RECIPIENT="$(solana address)"
TS="$(date +%s)"

MINT_OUT="/tmp/verify-mint.json"
curl --proxy "" -sS -X POST "${BACKEND_URL}/api/mint" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d "{\"recipient\":\"${RECIPIENT}\",\"amount\":\"1\",\"idempotencyKey\":\"verify-mint-${TS}\"}" >"$MINT_OUT"
assert_status_success "$MINT_OUT"

BURN_OUT="/tmp/verify-burn.json"
curl --proxy "" -sS -X POST "${BACKEND_URL}/api/burn" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d "{\"amount\":\"1\",\"idempotencyKey\":\"verify-burn-${TS}\"}" >"$BURN_OUT"
assert_status_success "$BURN_OUT"

TMP_WALLET="/tmp/sss-verify-wallet.json"
solana-keygen new --no-bip39-passphrase --force -o "$TMP_WALLET" >/dev/null
TEST_ADDR="$(solana-keygen pubkey "$TMP_WALLET")"

ADD_OUT="/tmp/verify-blacklist-add.json"
curl --proxy "" -sS -X POST "${BACKEND_URL}/api/blacklist" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d "{\"address\":\"${TEST_ADDR}\",\"reason\":\"verify\"}" >"$ADD_OUT"
assert_status_success "$ADD_OUT"

sleep 2
CHECK_OUT="/tmp/verify-blacklist-check.json"
curl --proxy "" -sS "${BACKEND_URL}/api/blacklist/${TEST_ADDR}" \
  -H "x-api-key: ${API_KEY}" >"$CHECK_OUT"
node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));if(!j.blacklisted){console.error(j);process.exit(1)}" "$CHECK_OUT"

REMOVE_OUT="/tmp/verify-blacklist-remove.json"
curl --proxy "" -sS -X DELETE "${BACKEND_URL}/api/blacklist/${TEST_ADDR}" \
  -H "x-api-key: ${API_KEY}" >"$REMOVE_OUT"
assert_status_success "$REMOVE_OUT"

echo "==> Verifying write guard rejects missing API key"
HTTP_CODE="$(curl --proxy "" -s -o /tmp/verify-no-key.json -w "%{http_code}" -X POST "${BACKEND_URL}/api/mint" -H "Content-Type: application/json" -d "{\"recipient\":\"${RECIPIENT}\",\"amount\":\"1\"}")"
if [[ "$HTTP_CODE" != "401" ]]; then
  echo "ERROR: expected 401 without API key, got ${HTTP_CODE}"
  cat /tmp/verify-no-key.json
  exit 1
fi

echo "✅ verify passed"
