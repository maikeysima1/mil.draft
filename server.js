// MIL-DRAFT server: static files + JSON API + SSE live updates + autopilot for units without an online user.
const http = require('http');
const fs = require('fs');
const path = require('path');
const C = require('./config');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { /* ignore */ }
const DATA_FILE = path.join(DATA_DIR, 'state.json');
const ACCESS_CODE = process.env.ACCESS_CODE || '';
const PUB = path.join(__dirname, 'public');
const CLOCK_SECONDS = 120;   // time a human unit has to pick
const BOT_DELAY_MS = 1500;   // delay between automatic picks

// ---------- users (demo users, as in the mockup login screen) ----------
const USERS = [
  { id: 'u1', title: 'שלישות גבעתי', unit: 'חטיבת גבעתי', corps: 'combat', role: 'שלישות', initial: 'ש' },
  { id: 'u2', title: 'שלישות מודיעין א׳', unit: 'יחידת מודיעין א׳', corps: 'intel', role: 'שלישות', initial: 'ש' },
  { id: 'u6', title: 'שלישות גדוד תקשוב א׳', unit: 'גדוד תקשוב א׳', corps: 'signals', role: 'שלישות', initial: 'ש' },
  { id: 'u3', title: 'מפקד/ת הכשרה', unit: 'בסיס הדרכה לדוגמה', corps: null, role: 'מפקד/ת הכשרה', initial: 'מה' },
  { id: 'u4', title: 'מגבש/ת רגלים', unit: 'גיבוש לוחמה', corps: 'combat', group: 3, role: 'מגבש/ת', initial: 'מג' },
  { id: 'u5', title: 'מגבש/ת מודיעין', unit: 'סדנת מיון מודיעין', corps: 'intel', group: 2, role: 'מגבש/ת', initial: 'מג' },
  { id: 'u7', title: 'מגבש/ת קשר', unit: 'סדנת מיון קשר ותקשוב', corps: 'signals', group: 1, role: 'מגבש/ת', initial: 'מג' },
];
// one שלישות user per unit, so every unit can have its own person in a shared draft
Object.keys(C.corps).forEach((k) => C.corps[k].units.forEach((u, i) => {
  if (USERS.some((x) => x.role === 'שלישות' && x.unit === u.name)) return;
  USERS.push({ id: 's-' + k + '-' + i, title: 'שלישות ' + u.name.replace(/^(חטיבת|יחידת|גדוד) /, ''), unit: u.name, corps: k, role: 'שלישות', initial: 'ש' });
}));
const userById = (id) => USERS.find((u) => u.id === id);

// ---------- seed data ----------
const CLOSERS = { 'מומלץ': 'מומלץ לשבץ ביחידה עם מכסה פתוחה בתפקיד.', 'מומלץ בהסתייגות': 'מומלץ בהסתייגות – כדאי לוודא התאמה לתנאי הסף לפני בחירה.', 'לא מומלץ': 'לא מומלץ לשיבוץ בשלב זה.' };
function makeSummary(cf, role, lv, rec) {
  const str = cf.traits.filter((t, j) => lv[j] === 2), low = cf.traits.filter((t, j) => lv[j] === 0);
  return 'מתאים/ה לתפקיד ' + role + '. ' + (str.length ? 'חוזקות בולטות: ' + str.join(', ') + '.' : 'ביצוע טוב ברוב המשימות, ללא חוזקה בולטת במיוחד.') + (low.length ? ' לחיזוק: ' + low.join(', ') + '.' : '') + ' ' + CLOSERS[rec];
}
function seedCands() {
  let seed = 11;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  let n = 0;
  const out = {};
  Object.keys(C.corps).forEach((key) => {
    const cf = C.corps[key];
    out[key] = [];
    for (let i = 0; i < cf.size; i++) {
      const role = cf.mix[i % cf.mix.length];
      const lv = cf.traits.map(() => { const r = rnd(); return r > 0.6 ? 2 : (r > 0.18 ? 1 : 0); });
      const sum = lv.reduce((a, b) => a + b, 0);
      const stats = {};
      cf.stats.forEach((s) => {
        const t = Math.min(1, 0.55 * rnd() + 0.45 * sum / 10);
        const raw = s.low ? s.max - (s.max - s.min) * t : s.min + (s.max - s.min) * t;
        const f = Math.pow(10, s.d);
        stats[s.k] = Math.round(raw * f) / f;
      });
      if (i % 9 === 7) stats[cf.stats[i % cf.stats.length].k] = null;
      const mr = rnd();
      const med = mr < 0.78 ? C.MEDS[0] : (mr < 0.94 ? C.MEDS[1] : C.MEDS[2]);
      const top = lv.indexOf(Math.max.apply(null, lv));
      const weak = lv.indexOf(Math.min.apply(null, lv));
      out[key].push({
        id: cf.prefix + String(101 + i), name: C.NAMES[n % C.NAMES.length], role, lv, stats,
        rec: sum >= 7 ? C.RECS[0] : (sum >= 4 ? C.RECS[1] : C.RECS[2]), med,
        profile: med === C.MEDS[0] ? (rnd() < 0.75 ? 97 : 82) : (med === C.MEDS[1] ? 72 : 64),
        area: C.AREAS[Math.floor(rnd() * C.AREAS.length)], pref: cf.units[Math.floor(rnd() * cf.units.length)].name,
        group: 1 + (i % 4), skills: cf.skills[role] || [],
        obs: cf.obs[role] + ' ' + cf.good[top] + (lv[weak] < 2 ? ' ' + cf.weak[weak] : ''),
        summary: makeSummary(cf, role, lv, sum >= 7 ? C.RECS[0] : (sum >= 4 ? C.RECS[1] : C.RECS[2])), evaluated: true, evalBy: 'מגבש/ת קבוצה ' + (1 + (i % 4)), source: 'מאגר קיים',
      });
      n++;
    }
  });
  return out;
}

function freshState() {
  const cands = seedCands();
  const st = { corps: {}, log: [], version: 1, schema: 2 };
  Object.keys(C.corps).forEach((k) => {
    st.corps[k] = {
      cands: cands[k], picks: [], turnStartedAt: Date.now(),
      units: C.corps[k].units.map((u) => ({ name: u.name, th: Object.assign({}, u.th), noMed: u.noMed, quota: Object.assign({}, u.quota) })),
    };
  });
  return st;
}

let state;
try { state = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); if (state.schema !== 2) state = null; } catch (e) { state = null; }
let saveTimer = null;
function save() {
  state.version++;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { fs.writeFileSync(DATA_FILE, JSON.stringify(state)); } catch (e) { console.error('save failed', e.message); } }, 200);
  broadcast();
}

// ---------- draft logic ----------
const cfg = (k) => C.corps[k];
const unitCfg = (k, name) => {
  const base = cfg(k).units.find((u) => u.name === name);
  const ov = state.corps[k].units.find((u) => u.name === name);
  return Object.assign({}, base, ov ? { th: ov.th, noMed: ov.noMed, quota: ov.quota || base.quota } : {});
};
function orderOf(k) {
  const c = cfg(k), o = [];
  for (let r = 0; r < c.rounds; r++) {
    const us = r % 2 === 0 ? c.units : c.units.slice().reverse();
    us.forEach((u) => o.push({ r: r + 1, u: u.name }));
  }
  return o;
}
function fitOf(k, cand, u) {
  const out = [];
  cfg(k).stats.forEach((s) => {
    const t = u.th[s.k];
    if (t == null) return;
    const v = cand.stats[s.k];
    const miss = v == null;
    out.push({ l: s.l + (s.low ? ' עד ' : ' לפחות ') + t + (miss ? ' (חסר נתון)' : ''), s: s.l.split(' ')[0], ok: !miss && (s.low ? v <= t : v >= t) });
  });
  if (u.noMed) out.push({ l: 'ללא מגבלות רפואיות', s: 'רפואי', ok: cand.med === 'ללא מגבלות' });
  out.push({ l: 'המלצת מגבש לא שלילית', s: 'המלצה', ok: cand.rec !== 'לא מומלץ' });
  return out;
}
function chooseFor(k, unitName) {
  const cs = state.corps[k], u = unitCfg(k, unitName);
  const taken = {}; cs.picks.forEach((p) => { taken[p.id] = 1; });
  const have = {};
  cs.picks.filter((p) => p.unit === unitName).forEach((p) => { const c = cs.cands.find((x) => x.id === p.id); if (c) have[c.role] = (have[c.role] || 0) + 1; });
  let best = null, bs = -1e9;
  cs.cands.forEach((c) => {
    if (taken[c.id]) return;
    const need = (u.quota[c.role] || 0) - (have[c.role] || 0);
    const bad = fitOf(k, c, u).filter((x) => !x.ok).length;
    const s = (need > 0 ? 20 : 0) - bad * 6 + c.lv.reduce((a, b) => a + b, 0) + (c.pref === unitName ? 1.5 : 0) + Math.random() * 2;
    if (s > bs) { bs = s; best = c; }
  });
  return best;
}
function doPick(k, unitName, candId, auto) {
  const cs = state.corps[k];
  const order = orderOf(k);
  const slot = order[cs.picks.length];
  if (!slot) throw new Error('הדראפט הסתיים');
  if (slot.u !== unitName) throw new Error('זה לא התור של היחידה');
  const c = cs.cands.find((x) => x.id === candId);
  if (!c) throw new Error('מועמד לא נמצא');
  if (cs.picks.some((p) => p.id === candId)) throw new Error('המועמד כבר נבחר');
  cs.picks.push({ id: candId, unit: unitName, auto: !!auto, round: slot.r, n: cs.picks.length + 1, ts: Date.now() });
  cs.turnStartedAt = Date.now();
  state.log.push({ ts: Date.now(), corps: k, text: `${unitName} בחרה את ${c.name} (${c.role})${auto ? ' · אוטומטי' : ''}` });
  if (state.log.length > 300) state.log.shift();
  save();
}

// presence: units with an online human get a clock instead of autopilot
const clients = new Set();
function onlineUnits() {
  const s = new Set();
  clients.forEach((c) => { if (c.user && c.user.role === 'שלישות') s.add(c.user.corps + '|' + c.user.unit); });
  return s;
}
const anyHuman = (k) => { let f = false; clients.forEach((c) => { if (c.user && c.user.role === 'שלישות' && c.user.corps === k) f = true; }); return f; };
// pre-play the draft until it is the demo unit's turn (like the mockup's opening state)
function playUntilMine(k) {
  const cs = state.corps[k], order = orderOf(k);
  while (cs.picks.length < order.length && order[cs.picks.length].u !== cfg(k).myUnit) {
    const slot = order[cs.picks.length], c = chooseFor(k, slot.u); if (!c) break;
    doPick(k, slot.u, c.id, true);
  }
  cs.turnStartedAt = Date.now();
}
let lastBot = 0;
setInterval(() => {
  const online = onlineUnits();
  let changed = false;
  Object.keys(C.corps).forEach((k) => {
    const cs = state.corps[k], order = orderOf(k), slot = order[cs.picks.length];
    if (!slot) return;
    if (!anyHuman(k)) return;
    const human = online.has(k + '|' + slot.u);
    const waited = Date.now() - cs.turnStartedAt;
    if (!human && waited >= BOT_DELAY_MS) {
      const c = chooseFor(k, slot.u); if (c) { doPick(k, slot.u, c.id, true); changed = true; }
    } else if (human && waited >= CLOCK_SECONDS * 1000) {
      const c = chooseFor(k, slot.u); if (c) { doPick(k, slot.u, c.id, true); changed = true; }
    }
  });
  if (!changed && Date.now() - lastBot > 1000) { lastBot = Date.now(); tick(); }
}, 500);

if (!state) { state = freshState(); Object.keys(C.corps).forEach(playUntilMine); }

// ---------- SSE ----------
function snapshot() {
  const o = { version: state.version, serverNow: Date.now(), clockSeconds: CLOCK_SECONDS, corps: {}, log: state.log.slice(-60).reverse() };
  Object.keys(C.corps).forEach((k) => { o.corps[k] = state.corps[k]; });
  return o;
}
function broadcast() { const d = 'data: ' + JSON.stringify({ type: 'state', version: state.version }) + '\n\n'; clients.forEach((c) => c.res.write(d)); }
function tick() { const d = 'data: ' + JSON.stringify({ type: 'tick', now: Date.now() }) + '\n\n'; clients.forEach((c) => c.res.write(d)); }

// ---------- HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml' };
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); }
function body(req) { return new Promise((ok, no) => { let b = ''; req.on('data', (d) => { b += d; if (b.length > 5e6) req.destroy(); }); req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { no(e); } }); }); }
const num = (v) => { if (v === '' || v == null) return null; const n = Number(String(v).replace(',', '.')); return isFinite(n) ? n : null; };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  try {
    if (p === '/healthz') return json(res, 200, { ok: true });
    if (p === '/api/ping') return json(res, 200, { needCode: !!ACCESS_CODE });
    if (ACCESS_CODE && p.startsWith('/api/') && (req.headers['x-code'] || url.searchParams.get('code')) !== ACCESS_CODE) return json(res, 401, { error: 'קוד גישה שגוי' });
    if (p === '/api/config') return json(res, 200, { corps: C.corps, users: USERS, words: C.WORDS, MEDS: C.MEDS, RECS: C.RECS });
    if (p === '/api/state') return json(res, 200, snapshot());
    if (p === '/api/events') {
      const user = userById(url.searchParams.get('user'));
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write('retry: 2000\n\n');
      const c = { res, user }; clients.add(c);
      req.on('close', () => clients.delete(c));
      return;
    }
    if (req.method === 'POST' && p.startsWith('/api/')) {
      const b = await body(req);
      const user = userById(req.headers['x-user']);
      if (!user) return json(res, 401, { error: 'לא מחובר' });
      const k = b.corps;
      const needCorps = () => { if (!C.corps[k]) throw new Error('חיל לא מוכר'); };
      const canView = () => { if (user.role !== 'מפקד/ת הכשרה' && user.corps !== k) throw new Error('אין הרשאה לחיל זה'); };
      if (p === '/api/pick') {
        needCorps(); if (user.role !== 'שלישות' || user.corps !== k) throw new Error('רק שלישות היחידה יכולה לבחור');
        doPick(k, user.unit, b.id, false); return json(res, 200, { ok: true });
      }
      if (p === '/api/eval') {
        needCorps(); canView();
        if (user.role !== 'מגבש/ת') throw new Error('רק מגבש/ת מזינ/ה התרשמות');
        const c = state.corps[k].cands.find((x) => x.id === b.id);
        if (!c) throw new Error('מועמד לא נמצא');
        if (c.group !== user.group) throw new Error('המועמד אינו בקבוצה שלך');
        const cf = cfg(k);
        if (Array.isArray(b.lv) && b.lv.length === cf.traits.length) c.lv = b.lv.map((x) => Math.max(0, Math.min(2, x | 0)));
        if (b.role && cf.roles.includes(b.role)) { c.role = b.role; c.skills = Array.isArray(b.skills) ? b.skills : (cf.skills[b.role] || []); }
        if (Array.isArray(b.skills)) c.skills = b.skills.slice(0, 6).map(String);
        if (b.stats) cf.stats.forEach((s) => { if (s.k in b.stats) c.stats[s.k] = num(b.stats[s.k]); });
        if (C.RECS.includes(b.rec)) c.rec = b.rec;
        if (C.MEDS.includes(b.med)) { c.med = b.med; c.profile = b.med === C.MEDS[0] ? 97 : (b.med === C.MEDS[1] ? 72 : 64); }
        if (typeof b.obs === 'string') c.obs = b.obs.slice(0, 1500);
        if (typeof b.summary === 'string') c.summary = b.summary.slice(0, 600);
        c.evaluated = true; c.evalBy = user.title; c.evalAt = Date.now();
        state.log.push({ ts: Date.now(), corps: k, text: `${user.title} הזינ/ה התרשמות על ${c.name}` });
        save(); return json(res, 200, { ok: true, cand: c });
      }
      if (p === '/api/thresholds') {
        needCorps(); if (user.role !== 'שלישות' || user.corps !== k) throw new Error('אין הרשאה');
        const ov = state.corps[k].units.find((u) => u.name === user.unit);
        const th = {}; cfg(k).stats.forEach((s) => { const v = num((b.th || {})[s.k]); if (v != null) th[s.k] = v; });
        ov.th = th; ov.noMed = !!b.noMed;
        if (b.quota) { const q = {}; cfg(k).roles.forEach((r) => { const n = Math.max(0, Math.min(9, parseInt((b.quota || {})[r], 10) || 0)); if (n) q[r] = n; }); ov.quota = q; }
        save(); return json(res, 200, { ok: true });
      }
      if (p === '/api/import') {
        needCorps(); if (user.role !== 'שלישות' || user.corps !== k) throw new Error('רק שלישות החיל מייבאת מועמדים');
        const cf = cfg(k), cs = state.corps[k];
        let max = cs.cands.reduce((m, c) => Math.max(m, parseInt(c.id.slice(cf.prefix.length), 10) || 0), 0);
        const used = new Set(cs.cands.map((c) => c.name));
        let added = 0, skipped = 0;
        (b.rows || []).forEach((r) => {
          const name = String(r.name || '').trim();
          if (!name || used.has(name) || !cf.roles.includes(r.role)) { skipped++; return; }
          used.add(name); max++;
          const stats = {}; cf.stats.forEach((s) => { stats[s.k] = num((r.stats || {})[s.k]); });
          const med = C.MEDS.includes(r.med) ? r.med : C.MEDS[0];
          cs.cands.push({
            id: cf.prefix + max, name, role: r.role, lv: cf.traits.map(() => 1), stats,
            rec: C.RECS.includes(r.rec) ? r.rec : null, med, profile: num(r.profile) || (med === C.MEDS[0] ? 97 : 72),
            area: '—', pref: '—', group: 1 + (max % 4), skills: cf.skills[r.role] || [], obs: '', summary: '', evaluated: false, source: 'ייבוא',
          });
          added++;
        });
        state.log.push({ ts: Date.now(), corps: k, text: `${user.title} ייבאה ${added} מועמדים` });
        save(); return json(res, 200, { ok: true, added, skipped });
      }
      if (p === '/api/undo') {
        needCorps(); if (!(user.role === 'מפקד/ת הכשרה' || (user.role === 'שלישות' && user.corps === k))) throw new Error('אין הרשאה');
        const cst = state.corps[k]; if (!cst.picks.length) throw new Error('אין בחירות לביטול');
        const last = cst.picks.pop(), c = cst.cands.find((x) => x.id === last.id);
        cst.turnStartedAt = Date.now();
        state.log.push({ ts: Date.now(), corps: k, text: `${user.title} ביטל/ה את הבחירה של ${last.unit}: ${c ? c.name : last.id}` });
        save(); return json(res, 200, { ok: true });
      }
      if (p === '/api/reset') {
        needCorps(); if (user.role !== 'שלישות' || user.corps !== k) throw new Error('אין הרשאה');
        state.corps[k].picks = []; playUntilMine(k);
        state.log.push({ ts: Date.now(), corps: k, text: `${user.title} איפסה את הדראפט` });
        save(); return json(res, 200, { ok: true });
      }
      if (p === '/api/factory-reset') {
        const fresh = freshState(); state.corps = fresh.corps; state.log = []; Object.keys(C.corps).forEach(playUntilMine); save(); return json(res, 200, { ok: true });
      }
      if (p === '/api/advance') { // demo helper: auto-play the draft up to the end of round N (0 = reset, 4 = finish)
        needCorps(); if (user.role === 'מגבש/ת') throw new Error('אין הרשאה');
        const cs = state.corps[k], order = orderOf(k), target = b.steps ? Math.min(order.length, cs.picks.length + (b.steps | 0)) : Math.max(0, Math.min(4, b.rounds | 0)) * cfg(k).units.length;
        if (target < cs.picks.length) cs.picks = cs.picks.slice(0, target);
        while (cs.picks.length < target) { const slot = order[cs.picks.length]; const c = chooseFor(k, slot.u); if (!c) break; doPick(k, slot.u, c.id, true); }
        cs.turnStartedAt = Date.now(); save(); return json(res, 200, { ok: true });
      }
    }
    // static
    let f = p === '/' ? '/index.html' : p;
    f = path.normalize(path.join(PUB, f));
    if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(f).pipe(res);
  } catch (e) { json(res, 400, { error: e.message }); }
}).listen(PORT, () => console.log('MIL-DRAFT running on http://localhost:' + PORT));
