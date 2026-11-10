#!/usr/bin/env bash
# CI: fresh server -> smoke test -> standalone build must match committed index.html
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-3123}"; DIR="$(mktemp -d)"
cleanup() { lsof -ti:"$PORT" -sTCP:LISTEN 2>/dev/null | xargs -r kill || true; rm -rf "$DIR"; }
trap cleanup EXIT

python3 build-standalone.py >/dev/null
if ! cmp -s dist/mil-draft.html index.html; then
  echo "index.html is out of date: run 'python3 build-standalone.py && cp dist/mil-draft.html index.html' and commit"; exit 1
fi
echo "OK index.html is up to date"

DATA_DIR="$DIR" PORT="$PORT" node server.js >"$DIR/server.log" 2>&1 &
timeout 30 bash -c "until curl -sf http://localhost:$PORT/healthz >/dev/null; do sleep 0.3; done" || { cat "$DIR/server.log"; exit 1; }
node .claude/skills/run-mil-draft/driver.cjs smoke --base "http://localhost:$PORT/"
