---
name: run-mil-draft
description: Run, start, build, test, screenshot, and drive MIL-DRAFT (Hebrew/RTL draft-room web app for assigning candidates to units - Node server + vanilla JS, installable PWA). Use when asked to run the app, take a screenshot of a screen as a given role, check permissions, run the smoke test, or build the standalone index.html.
---

MIL-DRAFT is a zero-dependency Node server (`server.js`, serves `public/`, JSON API + SSE) with a vanilla-JS RTL UI. There is no desktop window: the app is driven by headless Chromium through `.claude/skills/run-mil-draft/driver.cjs` (Playwright; `chromium-cli` is not installed here) plus `curl` for the API.
All paths below are relative to the repo root (the directory that contains `server.js`).

## Prerequisites

- Node >= 18 (verified on 22). **No `npm install`**: there are no runtime dependencies (`xlsx` is vendored in `public/xlsx.min.js`).
- Python 3 - only to build the single-file version.
- `lsof` (stopping the server), `curl`.
- Playwright + Chromium: `require('playwright')` resolves out of the box in the cloud container, which is all the driver needs.

## Build

The server needs no build. The standalone/GitHub-Pages file `index.html` is generated from `public/` by:

```bash
python3 build-standalone.py        # writes dist/mil-draft.html (identical to the committed index.html when public/ is unchanged)
```

After editing anything in `public/`, `server.js` or `config.js`, rebuild and copy `dist/mil-draft.html` to `index.html` before committing.

## Run (agent path)

Start the server (fresh state), wait for it, drive it, stop it:

```bash
rm -f data/state.json                                   # state persists here between runs
(PORT=3000 node server.js > /tmp/mil-server.log 2>&1 &)
timeout 20 bash -c 'until curl -sf http://localhost:3000/healthz >/dev/null; do sleep 0.3; done'

D=.claude/skills/run-mil-draft/driver.cjs
node $D users                                           # id / layer / role / pages of every demo user
node $D flow                                            # real flow: שלישות גבעתי picks a candidate -> board shows it (exit 1 on failure)
node $D shot u1 room                                    # login as u1, open #/room, screenshot -> /tmp/mil-shots/u1-room.png
node $D shot u1 board --phone --dark                    # iPhone 13 emulation + dark theme
node $D shot u4 eval --full                             # evaluator (team 3) sheet, full page
node $D smoke                                           # nav per role, login steps, no timer, API denials, pick, favorites privacy

lsof -ti:3000 -sTCP:LISTEN | xargs -r kill              # stop (never pkill -f: it can match your own shell)
```

- Routes for `shot`: `room`, `board`, `eval`, `command`, `results`, `import`, `settings` (admin only). Users are the ids printed by `users` (`u1` שלישות גבעתי, `u3` מפקד/ת הכשרה, `u4` מגבש צוות 3, `e-combat-1..4`, `h1` ראש מטה, `o1` צופה, `a1` מנהל). A route the role may not open redirects to its home page.
- Flags: `--base <url>` (default `http://localhost:3000/`), `--out <dir>` (default `/tmp/mil-shots`), `--phone`, `--dark`, `--full`. The driver prints the screenshot path and any page errors; **open the PNG and look at it.**
- Standalone build (no server): `node $D shot u1 board --base file://$PWD/dist/mil-draft.html` works. `flow` and `smoke` need the server (they call `/api`).
- Server with an access code: `ACCESS_CODE=1234 PORT=3000 node server.js ...`, then run the driver with `MIL_CODE=1234`.

### Direct API (no browser)

Identity is the `X-User` header (demo auth, no passwords). Permissions are enforced server-side, so this is also the quickest way to test a rule:

```bash
curl -s localhost:3000/api/state -H 'X-User: u1'
curl -s -X POST localhost:3000/api/pick -H 'Content-Type: application/json' -H 'X-User: u1' -d '{"corps":"combat","id":"C-2101"}'      # {"ok":true} only on u1's turn
curl -s -X POST localhost:3000/api/pick -H 'Content-Type: application/json' -H 'X-User: o1' -d '{"corps":"combat","id":"C-2102"}'      # {"error":...} (observer)
curl -s -X POST localhost:3000/api/factory-reset -H 'Content-Type: application/json' -H 'X-User: a1' -d '{}'                              # admin only; also the quick "reset to demo data"
```

## Run (human path)

`npm start` (= `node server.js`) then open http://localhost:3000. `PORT=` changes the port. Useless headless - use the driver.

## Test

There is no unit-test suite; the test is `node $D smoke` against a fresh server (expect `ALL PASSED`). `bash scripts/ci.sh` does everything CI does (checks `index.html` is current, starts a server on a temp data dir, runs smoke); GitHub Actions runs it on every push (`.github/workflows/test.yml`).

## Gotchas

- **Draft settings** (admin, `#/settings`): rounds 1-8, snake/linear and 3 optional hard rules for manual picks. Rounds/order can only change while every pick so far is automatic (the bot picks are then recomputed).

- **State is persistent.** `data/state.json` survives restarts, so a previous run's picks/favorites leak into the next. Reset with `rm -f data/state.json` before starting, or `POST /api/factory-reset` as `a1`.
- **The draft only advances while a שלישות user of that corps is connected.** Other units auto-pick (every 1 s) only while someone from that corps is online over SSE; with nobody connected the draft stays frozen at its opening state (2 pre-played picks in combat). The driver's session counts as "connected".
- **No turn clock by default** (no time pressure). Opt in with `CLOCK_SECONDS=5 DATA_DIR=<tmpdir> PORT=3002 node server.js`: a human unit that does not pick in time is auto-picked (use a separate `DATA_DIR` so it does not touch `data/state.json`).
- **Login is three steps** (חיל -> יחידה -> תפקיד): click `[data-act=lorg][data-v=<org>]`, `[data-act=lunit][data-v="<unit>"]`, `[data-act=sel][data-id=<userId>]`, then `[data-act=login]`. The driver does this for any user id (`node $D users` prints each user's path). Steps with a single option are auto-selected, so `login` is disabled until a role is chosen.
- **`window.confirm()`** guards picking and resetting - the driver auto-accepts dialogs; a raw Playwright script must do `page.on('dialog', d => d.accept())`.
- **Rendering is async (rAF).** Wait ~300-500 ms after a click/route change before reading the DOM; `data-act="..."` attributes are the stable selectors (Hebrew text changes often).
- **Standalone build vs server build.** The standalone file keeps all state in `localStorage` per browser context and runs the "server" in-page, so two Playwright contexts never see each other's changes and `/api` does not exist on `file://`. Use the server build for multi-user behaviour.
- **Favorites are private per user**: `/api/state` only returns the caller's `favs`, so check them with the right `X-User`.
- **Fonts:** the Google Fonts `<link>` fails in the sandbox ("Failed to load resource"); the app falls back to system fonts, and the driver ignores those console errors.
- **Hovering the donut chart:** Playwright's `hover()` aims at the element centre, which is the hole of the ring, and times out. Hover a bar/`.seg` instead, or dispatch a `pointermove` on the circle.
- **Service worker** (`sw.js`) registers only on `http(s)`, is network-first and never touches `/api`, so rebuilds show up immediately; offline mode works for the standalone/Pages build only.
- Reading generated Excel files in a node script: use `XLSX.read(fs.readFileSync(p))` - `XLSX.readFile` fails with "Cannot access file" with the vendored browser build.

## Troubleshooting

- `driver error: fetch failed` -> the server is not running; start it (see Run) and check `/tmp/mil-server.log`.
- `Error: listen EADDRINUSE: address already in use 0.0.0.0:3000` -> an old server holds the port: `lsof -ti:3000 -sTCP:LISTEN | xargs -r kill`, or use another `PORT=` and pass `--base http://localhost:<port>/` to the driver.
- `driver error: 401 - the server was started with ACCESS_CODE; run the driver with MIL_CODE=<code>` (curl shows `{"error":"קוד גישה שגוי"}`) -> pass `MIL_CODE=<code>` to the driver or `-H 'X-Code: <code>'` to curl.
