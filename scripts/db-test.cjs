// Storage tests: node scripts/db-test.cjs [port]. Starts its own servers on a temp data dir.
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const { DatabaseSync } = require('node:sqlite');
const PORT = +(process.argv[2] || 3124), B = 'http://localhost:' + PORT, ROOT = path.join(__dirname, '..');
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function start(dir, env) {
  const p = spawn('node', ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(PORT), DATA_DIR: dir }, env || {}), stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { out += d; }); p.out = () => out;
  for (let i = 0; i < 60; i++) { if (p.exitCode != null) return p; try { if ((await fetch(B + '/healthz')).ok) return p; } catch (e) { /* not up yet */ } await sleep(150); }
  return p;
}
const stop = async (p) => { if (p.exitCode == null) { p.kill(); await new Promise((r) => p.once('exit', r)); } await sleep(150); };
const api = async (pth, user, body) => { const r = await fetch(B + '/api/' + pth, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-User': user }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => ({})) }; };
const K = 'recon', find = async (id) => (await api('state', 'a1')).json.corps[K].cands.find((c) => c.id === id);
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mildb-')), dbf = path.join(dir, 'mil.db');
  let p = await start(dir); ok(/storage: .*mil\.db/.test(p.out()) && fs.existsSync(dbf), 'server starts on the SQLite database');
  const s0 = (await api('state', 'a1')).json, c0 = s0.corps[K].cands.find((c) => c.tstatus === 'בהכשרה'), n0 = s0.corps[K].cands.length, t0 = Date.now(); await sleep(20);
  await api('daily', 'u3', { corps: K, id: c0.id, level: 2, text: 'נשמר במסד' });
  await stop(p);
  let db = new DatabaseSync(dbf);
  ok(db.prepare('SELECT COUNT(*) n FROM soldiers WHERE updated_ts > ?').get(t0).n === 1, 'one change rewrites one soldier row, not the whole state');
  ok(db.prepare('SELECT COUNT(*) n FROM log').get().n >= 1, 'the activity log is stored in the database');
  ok(fs.readdirSync(path.join(dir, 'backups')).some((f) => /^mil-\d{4}-\d{2}-\d{2}\.db$/.test(f)), 'a dated backup copy is created');
  // simulate older stored data: lower data version + a field the current code expects is missing
  db.prepare("UPDATE meta SET value = '8' WHERE key = 'data_version'").run(); db.prepare("UPDATE corps_state SET data = ? WHERE corps = ?").run(JSON.stringify({ favs: {} }), K); db.close();
  p = await start(dir); let c1 = await find(c0.id), s1 = (await api('state', 'a1')).json;
  ok(!/demo data/.test(p.out()) && s1.corps[K].cands.length === n0 && c1.daily.some((e) => e.text === 'נשמר במסד'), 'restart keeps the data, and older stored data is upgraded instead of wiped');
  ok(s1.corps[K].cands.every((x) => Array.isArray(x.events) && Array.isArray(x.daily)), 'fields missing in stored data are filled in on load');
  await stop(p); db = new DatabaseSync(dbf); ok(db.prepare("SELECT value FROM meta WHERE key = 'data_version'").get().value !== '8', 'the stored data version is brought up to date');
  db.prepare("UPDATE meta SET value = '99' WHERE key = 'data_version'").run(); db.close();
  p = await start(dir); await sleep(300); ok(p.exitCode === 1 && /newer than this server/.test(p.out()), 'data from a newer version: the server refuses to start instead of damaging it'); await stop(p);
  // JSON fallback, then import into the database
  const d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'mildb-'));
  p = await start(d2, { STORAGE: 'json' }); await api('daily', 'u3', { corps: K, id: c0.id, level: 0, text: 'מהקובץ הישן' }); await sleep(400); await stop(p);
  ok(/JSON file/.test(p.out()) && fs.existsSync(path.join(d2, 'state.json')) && !fs.existsSync(path.join(d2, 'mil.db')), 'STORAGE=json keeps working with the JSON file');
  p = await start(d2); c1 = await find(c0.id);
  ok(/imported/.test(p.out()) && c1.daily.some((e) => e.text === 'מהקובץ הישן') && fs.existsSync(path.join(d2, 'state.json.imported')), 'first run on the database imports the existing JSON file');
  await stop(p);
  // encryption at rest
  const d3 = fs.mkdtempSync(path.join(os.tmpdir(), 'mildb-'));
  p = await start(d3, { DATA_KEY: 'correct horse battery staple' }); await api('daily', 'u3', { corps: K, id: c0.id, level: 1, text: 'סודי-ביותר-123' }); await stop(p);
  const raw = ['mil.db', 'mil.db-wal'].filter((f) => fs.existsSync(path.join(d3, f))).map((f) => fs.readFileSync(path.join(d3, f)).toString('latin1')).join('') + fs.readdirSync(path.join(d3, 'backups')).map((f) => fs.readFileSync(path.join(d3, 'backups', f)).toString('latin1')).join('');
  ok(!raw.includes(Buffer.from(c0.name, 'utf8').toString('latin1')) && !raw.includes(Buffer.from('סודי-ביותר-123', 'utf8').toString('latin1')) && !raw.includes('tstatus'), 'with DATA_KEY the database and its backups hold no readable soldier data');
  p = await start(d3, { DATA_KEY: 'correct horse battery staple' }); ok((await find(c0.id)).daily.some((e) => e.text === 'סודי-ביותר-123'), 'restart with the same key reads the encrypted database'); await stop(p);
  p = await start(d3, { DATA_KEY: 'a different key' }); await sleep(300); ok(p.exitCode === 1, 'wrong key: the server refuses to start'); await stop(p);
  [dir, d2, d3].forEach((d) => fs.rmSync(d, { recursive: true, force: true }));
  console.log(bad ? `\n${bad} FAILED` : '\nALL STORAGE TESTS PASSED'); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
