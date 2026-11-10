#!/usr/bin/env bash
# CI: fresh server -> smoke test -> standalone build must match committed index.html
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-3123}"; DIR="$(mktemp -d)"
cleanup() { lsof -ti:"$PORT" -sTCP:LISTEN 2>/dev/null | xargs -r kill || true; rm -rf "$DIR"; }
trap cleanup EXIT

python3 build-standalone.py >/dev/null
if ! cmp -s dist/mil-draft.html training-experiment.html; then
  echo "training-experiment.html is out of date: run 'python3 build-standalone.py && cp dist/mil-draft.html training-experiment.html' and commit"; exit 1
fi
echo "OK training-experiment.html is up to date (index.html is the untouched draft version)"

DATA_DIR="$DIR" PORT="$PORT" node server.js >"$DIR/server.log" 2>&1 &
timeout 30 bash -c "until curl -sf http://localhost:$PORT/healthz >/dev/null; do sleep 0.3; done" || { cat "$DIR/server.log"; exit 1; }
node .claude/skills/run-mil-draft/driver.cjs smoke --base "http://localhost:$PORT/"

# authentication mode (AUTH=1): separate server on a separate data dir
lsof -ti:"$PORT" -sTCP:LISTEN | xargs -r kill; sleep 1
AUTH=1 ADMIN_PASSWORD='Admin-Test-2024x' DATA_DIR="$DIR/auth" PORT="$PORT" node server.js >"$DIR/server-auth.log" 2>&1 &
timeout 30 bash -c "until curl -sf http://localhost:$PORT/healthz >/dev/null; do sleep 0.3; done" || { cat "$DIR/server-auth.log"; exit 1; }
node scripts/auth-test.cjs "http://localhost:$PORT" 'Admin-Test-2024x'

# encryption at rest: files must not contain readable data, and a restart with the same key must keep working
lsof -ti:"$PORT" -sTCP:LISTEN | xargs -r kill; sleep 1
start_enc() { DATA_KEY="$1" AUTH=1 ADMIN_PASSWORD='Admin-Test-2024x' DATA_DIR="$DIR/enc" PORT="$PORT" node server.js >"$DIR/server-enc.log" 2>&1 & }
start_enc 'correct horse battery staple'
timeout 30 bash -c "until curl -sf http://localhost:$PORT/healthz >/dev/null; do sleep 0.3; done" || { cat "$DIR/server-enc.log"; exit 1; }
curl -s -X POST "http://localhost:$PORT/api/login" -H 'Content-Type: application/json' -H 'X-Requested-With: mil-draft' -d '{"id":"a1","password":"Admin-Test-2024x"}' | grep -q '"ok":true'
sleep 1; lsof -ti:"$PORT" -sTCP:LISTEN | xargs -r kill; sleep 1
if grep -q "candidates\|\"cands\"\|\"salt\"\|\"hash\"" "$DIR/enc/state.json" "$DIR/enc/auth.json"; then echo "FAIL data files are readable"; exit 1; fi
echo "PASS state.json and auth.json are encrypted at rest"
start_enc 'correct horse battery staple'
timeout 30 bash -c "until curl -sf http://localhost:$PORT/healthz >/dev/null; do sleep 0.3; done" || { cat "$DIR/server-enc.log"; exit 1; }
curl -s -X POST "http://localhost:$PORT/api/login" -H 'Content-Type: application/json' -H 'X-Requested-With: mil-draft' -d '{"id":"a1","password":"Admin-Test-2024x"}' | grep -q '"ok":true' && echo "PASS restart with the same key keeps the accounts"
lsof -ti:"$PORT" -sTCP:LISTEN | xargs -r kill; sleep 1
start_enc 'a different key' ; sleep 2
if curl -sf "http://localhost:$PORT/healthz" >/dev/null; then echo "FAIL server started with the wrong key"; exit 1; fi
echo "PASS wrong key: server refuses to start"
