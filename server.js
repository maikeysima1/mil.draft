// MIL-DRAFT server: static files + JSON API + SSE live updates + autopilot for units without an online user.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const C = require('./config');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { /* ignore */ }
const DATA_FILE = path.join(DATA_DIR, 'state.json');
// optional encryption at rest (DATA_KEY=<passphrase>): state.json and auth.json are stored as AES-256-GCM. Without DATA_KEY files are plain JSON.
const DATA_KEY = process.env.DATA_KEY ? crypto.scryptSync(process.env.DATA_KEY, 'mil-draft/data-at-rest/v1', 32) : null;
function sealJson(obj) {
  const txt = JSON.stringify(obj); if (!DATA_KEY) return txt;
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', DATA_KEY, iv), data = Buffer.concat([c.update(txt, 'utf8'), c.final()]);
  return JSON.stringify({ enc: 'aes-256-gcm', iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') });
}
function openJson(txt) { // reads both plain and encrypted files (so enabling DATA_KEY later migrates on the next save)
  const o = JSON.parse(txt); if (!o || o.enc !== 'aes-256-gcm') return o;
  if (!DATA_KEY) throw new Error('the data file is encrypted but DATA_KEY is not set');
  const d = crypto.createDecipheriv('aes-256-gcm', DATA_KEY, Buffer.from(o.iv, 'base64')); d.setAuthTag(Buffer.from(o.tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(o.data, 'base64')), d.final()]).toString('utf8'));
}
const ACCESS_CODE = process.env.ACCESS_CODE || '';
const PUB = path.join(__dirname, 'public');
const CLOCK_SECONDS = Number(process.env.CLOCK_SECONDS) || 0;   // 0 = no time pressure (default). Opt in with CLOCK_SECONDS=<seconds>: a human unit that does not pick in time is auto-picked
const BOT_DELAY_MS = 1000;   // delay between automatic picks

// ---------- users (demo users, as in the mockup login screen) ----------
const USERS = [
  { id: 'u1', title: 'שלישות גבעתי', unit: 'חטיבת גבעתי', corps: 'combat', role: 'שלישות', initial: 'ש' },
  { id: 'u2', title: 'שלישות מודיעין א׳', unit: 'יחידת מודיעין א׳', corps: 'intel', role: 'שלישות', initial: 'ש' },
  { id: 'u6', title: 'שלישות גדוד תקשוב א׳', unit: 'גדוד תקשוב א׳', corps: 'signals', role: 'שלישות', initial: 'ש' },
];
const canDo = C.canDo;
// one evaluator per team (צוות 1..4) in every corps: "מגבש צוות 1 אחראי על צוות 1" and so on
const TEAMS = [1, 2, 3, 4];
const LEGACY_EVAL = { 'combat|3': 'u4', 'intel|2': 'u5', 'signals|1': 'u7' };
const CORPS_SHORT_S = { combat: 'לוחמים', intel: 'מודיעין', signals: 'קשר' };
Object.keys(C.corps).forEach((k) => TEAMS.forEach((g) => USERS.push({ id: LEGACY_EVAL[k + '|' + g] || 'e-' + k + '-' + g, title: 'מגבש/ת צוות ' + g + ' · ' + CORPS_SHORT_S[k], unit: C.corps[k].eventName, corps: k, group: g, role: 'מגבש/ת', initial: 'מג' })));
// extra evaluator-sheet values (kept separate from the 5 traits that drive the radar)
function makeExtra(cf, role, lv, rec, rnd2) {
  const sum = lv.reduce((a, b) => a + b, 0), others = cf.roles.filter((r) => r !== role);
  return { motivation: Math.max(1, Math.min(5, 2 + Math.floor(rnd2() * 3) + (sum >= 6 ? 1 : 0))), discipline: Math.min(2, Math.floor(rnd2() * 2.4) + (sum >= 7 ? 1 : 0)), potential: sum >= 7 ? 2 : (sum >= 5 ? 1 : (rnd2() < .3 ? 1 : 0)), confidence: 1 + (rnd2() > .45 ? 1 : 0), second: rnd2() < .55 ? others[Math.floor(rnd2() * others.length)] : '', follow: rec === C.RECS[2] || rnd2() < .14, medNote: '' };
}
// soldier's own wishes (informational): preferred role + up to 3 ranked units. The draft itself follows unit needs.
function makeWish(cf, role, pref, rnd2, motivation) {
  const others = cf.units.map((u) => u.name).filter((n) => n !== pref), units = [pref];
  while (units.length < 3 && others.length) { if (rnd2() < .7 || units.length < 2) units.push(others.splice(Math.floor(rnd2() * others.length), 1)[0]); else break; }
  const wr = rnd2() < .62 ? role : cf.roles[Math.floor(rnd2() * cf.roles.length)], r = rnd2();
  // willingness for a combat role: 0 = not interested, 1 = open, 2 = interested (loosely tied to motivation)
  const combat = motivation >= 4 ? (r < .72 ? 2 : (r < .93 ? 1 : 0)) : (motivation === 3 ? (r < .38 ? 2 : (r < .72 ? 1 : 0)) : (r < .16 ? 1 : 0.0 + (r < .5 ? 0 : 1)));
  return { role: wr, units, combat };
}
function cleanWish(cf, w) {
  const names = cf.units.map((u) => u.name), units = [];
  (Array.isArray(w.units) ? w.units : []).forEach((n) => { if (names.includes(n) && !units.includes(n) && units.length < 3) units.push(n); });
  return { role: cf.roles.includes(w.role) ? w.role : '', units, combat: [0, 1, 2].includes(parseInt(w.combat, 10)) ? parseInt(w.combat, 10) : null };
}
// ---- Excel uploads: reference data ("previous cycle") and updates to existing candidates ----
const toNum = (v) => { if (v === '' || v == null) return null; const x = Number(String(v).replace(',', '.')); return isFinite(x) ? x : null; };
// reference rows are anonymous: names are never stored, only the fields needed for analysis
function cleanBaseline(cf, rows) {
  const out = [];
  (Array.isArray(rows) ? rows : []).slice(0, 3000).forEach((r) => {
    if (!cf.roles.includes(r.role)) return;
    const stats = {}; cf.stats.forEach((s) => { stats[s.k] = toNum((r.stats || {})[s.k]); });
    const mot = toNum(r.motivation), cb = toNum(r.combat);
    out.push({ role: r.role, rec: C.RECS.includes(r.rec) ? r.rec : null, med: C.MEDS.includes(r.med) ? r.med : null, profile: toNum(r.profile), stats,
      motivation: mot >= 1 && mot <= 5 ? Math.round(mot) : null, combat: cb === 0 || cb === 1 || cb === 2 ? cb : null, unit: cf.units.some((u) => u.name === r.unit) ? r.unit : '' });
  });
  return out;
}
// candidate photo: small JPEG data URL produced by the browser (resized before upload); anything else is ignored
const cleanPhoto = (v) => (typeof v === 'string' && v.length <= 60000 && /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(v) ? v : null);
// apply uploaded values onto a candidate (only fields that were provided)
function applyUpdate(cf, c, r) {
  let n = 0;
  if (cleanPhoto(r.photo)) { c.photo = r.photo; n++; }
  if (cf.roles.includes(r.role) && r.role !== c.role) { c.role = r.role; c.skills = cf.skills[r.role] || c.skills; n++; }
  if (C.RECS.includes(r.rec)) { c.rec = r.rec; n++; }
  if (C.MEDS.includes(r.med)) { c.med = r.med; n++; }
  if (toNum(r.profile) != null) { c.profile = toNum(r.profile); n++; }
  cf.stats.forEach((s) => { const v = toNum((r.stats || {})[s.k]); if (v != null) { c.stats[s.k] = v; n++; } });
  const mot = toNum(r.motivation); if (mot >= 1 && mot <= 5) { c.extra = Object.assign({}, c.extra, { motivation: Math.round(mot) }); n++; }
  const cb = toNum(r.combat); if (cb === 0 || cb === 1 || cb === 2) { c.wish = Object.assign({ role: '', units: [] }, c.wish, { combat: cb }); n++; }
  return n;
}
// ---- evaluator intake: one function used by the sheet form and by Excel uploads ----
// only the fields present in `b` are applied (empty cells in an upload never erase data)
function applyEval(cf, c, b, who) {
  let n = 0;
  if (Array.isArray(b.lv)) b.lv.forEach((v, i) => { if (i < cf.traits.length && v != null && v !== '' && isFinite(parseInt(v, 10))) { c.lv[i] = Math.max(0, Math.min(2, parseInt(v, 10))); n++; } });
  if (b.role && cf.roles.includes(b.role)) { c.role = b.role; c.skills = Array.isArray(b.skills) ? b.skills : (cf.skills[b.role] || []); n++; }
  if (Array.isArray(b.skills)) { c.skills = b.skills.slice(0, 6).map(String); n++; }
  if (b.stats) cf.stats.forEach((s) => { if (s.k in b.stats) { c.stats[s.k] = toNum(b.stats[s.k]); n++; } });
  if (C.RECS.includes(b.rec)) { c.rec = b.rec; n++; }
  if (C.MEDS.includes(b.med)) { c.med = b.med; c.profile = b.med === C.MEDS[0] ? 97 : (b.med === C.MEDS[1] ? 72 : 64); n++; }
  if (typeof b.obs === 'string') { c.obs = b.obs.slice(0, 1500); n++; }
  if (typeof b.summary === 'string') { c.summary = b.summary.slice(0, 600); n++; }
  if (b.extra && Object.keys(b.extra).length) { c.extra = cleanExtra(cf, b.extra, c.extra); n++; }
  if (b.wish && Object.keys(b.wish).length) {
    const o = Object.assign({ role: '', units: [], combat: null }, c.wish), w = b.wish;
    if ('role' in w) o.role = cf.roles.includes(w.role) ? w.role : '';
    if ('units' in w) o.units = cleanWish(cf, { units: w.units }).units;
    if (w.combat === 0 || w.combat === 1 || w.combat === 2) o.combat = w.combat;
    c.wish = o; c.pref = o.units[0] || '—'; n++;
  }
  if (n) { c.evaluated = true; c.evalBy = who; c.evalAt = Date.now(); }
  return n;
}
function newCand(cf, cst, name, role, group, source) {
  const max = cst.cands.reduce((m, c) => Math.max(m, parseInt(c.id.slice(cf.prefix.length), 10) || 0), 0) + 1, stats = {}; cf.stats.forEach((s) => { stats[s.k] = null; });
  const c = { id: cf.prefix + max, name, role, lv: cf.traits.map(() => null), stats, rec: null, med: C.MEDS[0], profile: 97, area: '—', pref: '—', wish: { role: '', units: [], combat: null }, group, skills: cf.skills[role] || [], obs: '', summary: '', evaluated: false, source: source || 'ייבוא' };
  cst.cands.push(c); return c;
}
function cleanExtra(cf, x, old) { // only the fields present in x are touched; unknown stays unknown (null/undefined), never a made-up default
  const o = Object.assign({}, old || {}), num = (v, lo, hi) => { v = parseInt(v, 10); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : undefined; };
  [['motivation', 1, 5], ['discipline', 0, 2], ['potential', 0, 2], ['confidence', 0, 2]].forEach(([key, lo, hi]) => { if (key in x) { const v = num(x[key], lo, hi); if (v !== undefined) o[key] = v; else if (x[key] === null) o[key] = null; } });
  if ('second' in x) o.second = cf.roles.includes(x.second) ? x.second : '';
  if ('follow' in x) o.follow = !!x.follow;
  if ('medNote' in x) o.medNote = String(x.medNote || '').slice(0, 200);
  return o;
}
// one שלישות user per unit, so every unit can have its own person in a shared draft
Object.keys(C.corps).forEach((k) => C.corps[k].units.forEach((u, i) => {
  if (USERS.some((x) => x.role === 'שלישות' && x.unit === u.name)) return;
  USERS.push({ id: 's-' + k + '-' + i, title: 'שלישות ' + u.name.replace(/^(חטיבת|יחידת|גדוד) /, ''), unit: u.name, corps: k, role: 'שלישות', initial: 'ש' });
}));
// staff users: login corps "משאבי אנוש" (units: משאבי אנוש / מטה / ראש אכ״א) and "פיתוח" (system roles). Legacy ids kept: u3, h1, o1, a1.
const INITIALS = { 'מפקד/ת הכשרה': 'מה', 'ראש מטה': 'רמ', 'צופה/ת': 'צו', 'מנהל/ת מערכת': 'מנ' };
[['u3', 'hr', 'משאבי אנוש', 'מפקד/ת הכשרה'], ['hr-0-1', 'hr', 'משאבי אנוש', 'ראש מטה'], ['hr-1-0', 'hr', 'מטה', 'מפקד/ת הכשרה'], ['h1', 'hr', 'מטה', 'ראש מטה'], ['hr-2-0', 'hr', 'ראש אכ״א', 'מפקד/ת הכשרה'], ['hr-2-1', 'hr', 'ראש אכ״א', 'ראש מטה'],
 ['a1', 'dev', 'צוות פיתוח', 'מנהל/ת מערכת'], ['o1', 'dev', 'צוות פיתוח', 'צופה/ת']].forEach(([id, org, unit, role]) => USERS.push({ id, title: role + ' · ' + unit, unit, corps: null, role, initial: INITIALS[role], org, orgUnit: unit, roleLabel: role }));
// the training commander is also a role under every unit (same permissions as before: scope = all corps)
Object.keys(C.corps).forEach((k) => C.corps[k].units.map((u) => u.name).concat([C.corps[k].eventName]).forEach((unit, i) => USERS.push({ id: 'c-' + k + '-' + i, title: 'מפקד/ת הכשרה · ' + unit, unit, corps: null, role: 'מפקד/ת הכשרה', initial: 'מה', org: k, orgUnit: unit, roleLabel: 'מפקד/ת הכשרה' })));
// login structure for corps users: חיל ← יחידה ← תפקיד
USERS.forEach((u) => { if (u.org) return; u.org = u.corps; u.orgUnit = u.unit; u.roleLabel = u.role === 'מגבש/ת' ? 'מגבש/ת צוות ' + u.group : u.role; });
const userById = (id) => USERS.find((u) => u.id === id);

// ---------- seed data ----------
const CLOSERS = { 'מומלץ': 'מומלץ לשבץ ביחידה עם מכסה פתוחה בתפקיד.', 'מומלץ בהסתייגות': 'מומלץ בהסתייגות – כדאי לוודא התאמה לתנאי הסף לפני בחירה.', 'לא מומלץ': 'לא מומלץ לשיבוץ בשלב זה.' };
function makeSummary(cf, role, lv, rec) {
  const str = cf.traits.filter((t, j) => lv[j] === 2), low = cf.traits.filter((t, j) => lv[j] === 0);
  return 'מתאים/ה לתפקיד ' + role + '. ' + (str.length ? 'חוזקות בולטות: ' + str.join(', ') + '.' : 'ביצוע טוב ברוב המשימות, ללא חוזקה בולטת במיוחד.') + (low.length ? ' לחיזוק: ' + low.join(', ') + '.' : '') + ' ' + CLOSERS[rec];
}
function seedCands() {
  let seed = 11, seed2 = 77;
  const rnd2 = () => { seed2 = (seed2 * 9301 + 49297) % 233280; return seed2 / 233280; };
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
        extra: makeExtra(cf, role, lv, sum >= 7 ? C.RECS[0] : (sum >= 4 ? C.RECS[1] : C.RECS[2]), rnd2),
        summary: makeSummary(cf, role, lv, sum >= 7 ? C.RECS[0] : (sum >= 4 ? C.RECS[1] : C.RECS[2])), evaluated: true, evalBy: 'מגבש/ת צוות ' + (1 + (i % 4)), source: 'מאגר קיים',
      });
      { const cd = out[key][out[key].length - 1]; cd.wish = makeWish(cf, role, cd.pref, rnd2, cd.extra.motivation); }
      n++;
    }
  });
  return out;
}

function freshState() {
  const cands = seedCands();
  const st = { corps: {}, log: [], version: 1, schema: 5 };
  Object.keys(C.corps).forEach((k) => {
    st.corps[k] = {
      cands: cands[k], picks: [], turnStartedAt: Date.now(),
      units: C.corps[k].units.map((u) => ({ name: u.name, th: Object.assign({}, u.th), noMed: u.noMed, quota: Object.assign({}, u.quota) })),
      settings: Object.assign({ rounds: C.corps[k].rounds }, STG_DEFAULT),
    };
  });
  return st;
}

let state;
try { state = openJson(fs.readFileSync(DATA_FILE, 'utf8')); if (state.schema !== 5) state = null; } catch (e) { if (/DATA_KEY|authenticate/i.test(e.message)) { console.error('FATAL: cannot read ' + DATA_FILE + ' (' + e.message + ') - refusing to start with an empty state'); process.exit(1); } state = null; }
let saveTimer = null;
function save() {
  state.version++;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { fs.writeFileSync(DATA_FILE, sealJson(state), { mode: 0o600 }); } catch (e) { console.error('save failed', e.message); } }, 200);
  broadcast();
}

// ---------- draft logic ----------
const wishRank = (c, u) => ((c.wish && c.wish.units) || []).indexOf(u) + 1; // 0 = not wished, 1..3 = rank
const WISH_BONUS = [0, 1.5, 1, 0.5];
const cfg = (k) => C.corps[k];
const unitCfg = (k, name) => {
  const base = cfg(k).units.find((u) => u.name === name);
  const ov = state.corps[k].units.find((u) => u.name === name);
  return Object.assign({}, base, ov ? { th: ov.th, noMed: ov.noMed, quota: ov.quota || base.quota } : {});
};
// draft settings per corps (admin-editable): rounds, order (snake = reversed every other round, linear = same order), and optional hard rules for manual picks
const STG_DEFAULT = { order: 'snake', strictThresholds: false, strictQuotas: false, blockNotRecommended: false };
const stg = (k) => Object.assign({ rounds: cfg(k).rounds }, STG_DEFAULT, state.corps[k].settings);
function orderOf(k) {
  const c = cfg(k), S = stg(k), o = [];
  for (let r = 0; r < S.rounds; r++) {
    const us = S.order === 'snake' && r % 2 === 1 ? c.units.slice().reverse() : c.units;
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
    const s = (need > 0 ? 20 : 0) - bad * 6 + c.lv.reduce((a, b) => a + (b || 0), 0) + WISH_BONUS[wishRank(c, unitName)] + Math.random() * 2;
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
  if (!auto) { // hard rules (set by the admin) apply to manual picks; automatic picks stay soft so the demo never gets stuck
    const S = stg(k), u = unitCfg(k, unitName);
    if (S.blockNotRecommended && c.rec === 'לא מומלץ') throw new Error('המועמד אינו מומלץ – הדראפט מוגדר ללא אפשרות לבחור מועמד כזה');
    if (S.strictThresholds && fitOf(k, c, u).some((x) => !x.ok && x.s !== 'המלצה')) throw new Error('המועמד אינו עומד בתנאי הסף של היחידה – הדראפט מוגדר לדרוש עמידה בתנאי הסף');
    if (S.strictQuotas) { const q = u.quota[c.role] || 0, have = cs.picks.filter((p) => p.unit === unitName && (cs.cands.find((x) => x.id === p.id) || {}).role === c.role).length; if (have >= q) throw new Error('המכסה של היחידה לתפקיד ' + c.role + ' כבר מולאה (או שלא נתבקש) – הדראפט מוגדר לדרוש עמידה במכסות'); }
  }
  cs.picks.push({ id: candId, unit: unitName, auto: !!auto, round: slot.r, n: cs.picks.length + 1, ts: Date.now() });
  cs.turnStartedAt = Date.now();
  state.log.push({ ts: Date.now(), corps: k, text: `${unitName} בחרה את ${c.name} (${c.role})${auto ? ' · אוטומטי' : ''}` });
  if (state.log.length > 1000) state.log.shift();
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
    } else if (human && CLOCK_SECONDS && waited >= CLOCK_SECONDS * 1000) {
      const c = chooseFor(k, slot.u); if (c) { doPick(k, slot.u, c.id, true); changed = true; }
    }
  });
  if (!changed && Date.now() - lastBot > 1000) { lastBot = Date.now(); tick(); }
}, 500);

if (!state) { state = freshState(); Object.keys(C.corps).forEach(playUntilMine); }

// ---------- SSE ----------
// favorites are private: every client only receives its own list
function snapshot(userId) {
  const o = { version: state.version, serverNow: Date.now(), clockSeconds: CLOCK_SECONDS, corps: {}, log: state.log.slice(-400).reverse() };
  Object.keys(C.corps).forEach((k) => { const f = state.corps[k].favs || {}; o.corps[k] = Object.assign({}, state.corps[k], { favs: userId && f[userId] ? { [userId]: f[userId] } : {} }); });
  return o;
}
function broadcast() { const d = 'data: ' + JSON.stringify({ type: 'state', version: state.version }) + '\n\n'; clients.forEach((c) => c.res.write(d)); }
function tick() { const d = 'data: ' + JSON.stringify({ type: 'tick', now: Date.now() }) + '\n\n'; clients.forEach((c) => c.res.write(d)); }

// ---------- HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); }
function body(req) { return new Promise((ok, no) => { let b = ''; req.on('data', (d) => { b += d; if (b.length > 5e6) req.destroy(); }); req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { no(e); } }); }); }
const num = (v) => { if (v === '' || v == null) return null; const n = Number(String(v).replace(',', '.')); return isFinite(n) ? n : null; };

// ---------- authentication (AUTH=1): scrypt passwords, signed HttpOnly session cookie, lockout, rate limit, audit ----------
// Without AUTH=1 the server stays in open demo mode (identity = X-User header). With AUTH=1 that header is ignored completely.
const AUTH = /^(1|true)$/i.test(process.env.AUTH || '');
const AUTH_FILE = path.join(DATA_DIR, 'auth.json'), AUDIT_FILE = path.join(DATA_DIR, 'audit.log');
const SESSION_HOURS = +process.env.SESSION_HOURS || 8, MAX_FAILS = 5, LOCK_MIN = 15, TRUST_PROXY = /^(1|true)$/i.test(process.env.TRUST_PROXY || '');
let authData = { secret: crypto.randomBytes(32).toString('hex'), users: {} };
try { authData = Object.assign(authData, openJson(fs.readFileSync(AUTH_FILE, 'utf8'))); } catch (e) { if (/DATA_KEY|authenticate/i.test(e.message)) { console.error('FATAL: cannot read ' + AUTH_FILE + ' (' + e.message + ')'); process.exit(1); } /* first run */ }
function saveAuth() { const t = AUTH_FILE + '.tmp'; fs.writeFileSync(t, sealJson(authData), { mode: 0o600 }); fs.renameSync(t, AUTH_FILE); }
const hashPw = (pw, salt) => crypto.scryptSync(String(pw), salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
function setPassword(id, pw, mustChange) {
  const salt = crypto.randomBytes(16).toString('hex'), old = authData.users[id] || {};
  authData.users[id] = { salt, hash: hashPw(pw, salt), mustChange: !!mustChange, ver: (old.ver || 0) + 1, fails: 0, lockedUntil: 0 }; saveAuth();
}
function checkPw(rec, pw) { // constant-time; unknown users cost the same as known ones
  const salt = rec ? rec.salt : 'x'.repeat(32), h = Buffer.from(hashPw(pw, salt), 'hex'), r = rec ? Buffer.from(rec.hash, 'hex') : Buffer.alloc(64);
  return crypto.timingSafeEqual(h, r) && !!rec;
}
function pwProblem(pw, id) {
  pw = String(pw || '');
  if (pw.length < 10) return 'הסיסמה חייבת להכיל לפחות 10 תווים';
  if (!/[A-Za-zא-ת]/.test(pw) || !/\d/.test(pw)) return 'הסיסמה חייבת להכיל אותיות וגם ספרות';
  if (pw.toLowerCase().includes(String(id).toLowerCase())) return 'הסיסמה לא יכולה להכיל את שם המשתמש';
  return null;
}
const tempPw = () => crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, 'x') + '7';
function audit(ev, user, req, ok, detail) {
  try { fs.appendFileSync(AUDIT_FILE, JSON.stringify({ ts: Date.now(), ev, user: user || null, ip: ipOf(req), ok: ok !== false, detail: detail || '' }) + '\n', { mode: 0o600 }); } catch (e) { /* never block on logging */ }
}
function ipOf(req) { return (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || (req.socket && req.socket.remoteAddress) || '?'; }
const b64u = (b) => Buffer.from(b).toString('base64url');
function signToken(id) {
  const rec = authData.users[id], pl = b64u(JSON.stringify({ u: id, v: rec.ver, e: Date.now() + SESSION_HOURS * 3600e3 }));
  return pl + '.' + crypto.createHmac('sha256', authData.secret).update(pl).digest('base64url');
}
function cookieOf(req, name) { const m = String(req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(name + '=')); return m ? m.slice(name.length + 1) : ''; }
function sessionUser(req) {
  const t = cookieOf(req, 'mil_session'), i = t.indexOf('.'); if (i < 1) return null;
  const pl = t.slice(0, i), sig = Buffer.from(t.slice(i + 1)), ok = Buffer.from(crypto.createHmac('sha256', authData.secret).update(pl).digest('base64url'));
  if (sig.length !== ok.length || !crypto.timingSafeEqual(sig, ok)) return null;
  let d; try { d = JSON.parse(Buffer.from(pl, 'base64url').toString()); } catch (e) { return null; }
  const rec = authData.users[d.u], u = userById(d.u);
  if (!rec || !u || d.e < Date.now() || d.v !== rec.ver) return null;
  return Object.assign({}, u, { _mustChange: !!rec.mustChange });
}
const isHttps = (req) => !!(req.socket && req.socket.encrypted) || String(req.headers['x-forwarded-proto'] || '') === 'https';
function setSession(req, res, id) { res.setHeader('Set-Cookie', `mil_session=${signToken(id)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}${isHttps(req) ? '; Secure' : ''}`); }
const clearSession = (res) => res.setHeader('Set-Cookie', 'mil_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
const loginHits = new Map(); // ip -> timestamps of recent login attempts
function tooMany(req) { const ip = ipOf(req), now = Date.now(), a = (loginHits.get(ip) || []).filter((t) => now - t < 600e3); a.push(now); loginHits.set(ip, a); if (loginHits.size > 5000) loginHits.clear(); return a.length > 20; }
const reqUser = (req) => (AUTH ? sessionUser(req) : userById(req.headers['x-user']));
const isAdminUser = (u) => !!u && C.ROLES[u.role].can.includes('settings');
if (AUTH && !DATA_KEY) console.log('NOTE: DATA_KEY is not set - state.json and auth.json are stored unencrypted. Set DATA_KEY=<long passphrase> to encrypt them at rest.');
if (AUTH && !authData.users.a1) { // bootstrap the admin account
  const env = process.env.ADMIN_PASSWORD, ok = env && !pwProblem(env, 'a1'), pw = ok ? env : tempPw();
  setPassword('a1', pw, !ok);
  if (!ok) console.log('\n*** AUTH: initial admin password for user a1 (shown once, must be changed at first login): ' + pw + ' ***\n');
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()'); res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  if (isHttps(req)) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (p.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  try {
    if (p === '/healthz') return json(res, 200, { ok: true });
    if (p === '/api/ping') return json(res, 200, { needCode: !!ACCESS_CODE, auth: AUTH });
    if (ACCESS_CODE && p.startsWith('/api/') && (req.headers['x-code'] || url.searchParams.get('code')) !== ACCESS_CODE) return json(res, 401, { error: 'קוד גישה שגוי' });
    const gate = () => { const u = reqUser(req); if (AUTH && !u) { json(res, 401, { error: 'לא מחובר' }); return null; } if (AUTH && u._mustChange) { json(res, 403, { error: 'נדרש שינוי סיסמה', mustChange: true }); return null; } return u || true; };
    if (AUTH && p === '/api/me') { const u = sessionUser(req); return u ? json(res, 200, { id: u.id, mustChange: u._mustChange }) : json(res, 401, { error: 'לא מחובר' }); }
    if (AUTH && p === '/api/admin/users') {
      const u = sessionUser(req); if (!isAdminUser(u) || u._mustChange) return json(res, 403, { error: 'אין הרשאה' });
      return json(res, 200, { users: USERS.map((x) => { const r = authData.users[x.id]; return { id: x.id, title: x.title, role: x.role, unit: x.unit, hasPassword: !!r, mustChange: !!(r && r.mustChange), locked: !!(r && r.lockedUntil > Date.now()) }; }) });
    }
    if (AUTH && p === '/api/admin/audit') {
      const u = sessionUser(req); if (!isAdminUser(u) || u._mustChange) return json(res, 403, { error: 'אין הרשאה' });
      let lines = []; try { lines = fs.readFileSync(AUDIT_FILE, 'utf8').trim().split('\n').slice(-150); } catch (e) { /* none yet */ }
      return json(res, 200, { events: lines.map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean).reverse() });
    }
    if (p === '/api/config') return json(res, 200, { orgs: C.ORGS, roles: C.ROLES, corps: C.corps, users: USERS, words: C.WORDS, MEDS: C.MEDS, RECS: C.RECS });
    if (p === '/api/state') { const gu = gate(); if (!gu) return; return json(res, 200, snapshot(AUTH ? gu.id : req.headers['x-user'])); }
    if (p === '/api/events') {
      const gu = gate(); if (!gu) return;
      const user = AUTH ? gu : userById(url.searchParams.get('user'));
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write('retry: 2000\n\n');
      const c = { res, user }; clients.add(c);
      req.on('close', () => clients.delete(c));
      return;
    }
    if (req.method === 'POST' && p.startsWith('/api/')) {
      if (AUTH && req.headers['x-requested-with'] !== 'mil-draft') return json(res, 403, { error: 'בקשה לא תקינה' });
      const b = await body(req);
      if (AUTH && p === '/api/login') {
        if (tooMany(req)) { audit('login', b.id, req, false, 'rate-limit'); return json(res, 429, { error: 'יותר מדי ניסיונות – נסו שוב בעוד מספר דקות' }); }
        const u = userById(b.id), rec = u ? authData.users[u.id] : null, now = Date.now();
        if (rec && rec.lockedUntil > now) { audit('login', u.id, req, false, 'locked'); return json(res, 423, { error: 'החשבון נעול זמנית עקב ניסיונות כושלים – נסו שוב מאוחר יותר או פנו למנהל/ת המערכת' }); }
        if (!u || !rec || !checkPw(rec, b.password)) {
          if (rec) { rec.fails = (rec.fails || 0) + 1; if (rec.fails >= MAX_FAILS) { rec.lockedUntil = now + LOCK_MIN * 60e3; rec.fails = 0; } saveAuth(); }
          audit('login', b.id, req, false, rec ? (rec.lockedUntil > now ? 'locked-now' : 'bad-password') : 'no-credentials');
          return json(res, 401, { error: 'פרטי הכניסה שגויים' });
        }
        rec.fails = 0; rec.lockedUntil = 0; saveAuth(); setSession(req, res, u.id); audit('login', u.id, req, true);
        return json(res, 200, { ok: true, id: u.id, mustChange: !!rec.mustChange });
      }
      if (AUTH && p === '/api/logout') { const u = sessionUser(req); if (u) audit('logout', u.id, req, true); clearSession(res); return json(res, 200, { ok: true }); }
      const user = reqUser(req);
      if (!user) return json(res, 401, { error: 'לא מחובר' });
      if (AUTH && p === '/api/change-password') {
        const rec = authData.users[user.id];
        if (!checkPw(rec, b.old)) { audit('change-password', user.id, req, false, 'bad-old'); return json(res, 400, { error: 'הסיסמה הנוכחית שגויה' }); }
        const bad = pwProblem(b.next, user.id); if (bad) return json(res, 400, { error: bad });
        if (b.next === b.old) return json(res, 400, { error: 'הסיסמה החדשה זהה לנוכחית' });
        setPassword(user.id, b.next, false); setSession(req, res, user.id); audit('change-password', user.id, req, true); return json(res, 200, { ok: true });
      }
      if (p === '/api/audit-event') { // sensitive reads/exports done in the browser are reported here (only whitelisted events; logged in AUTH mode)
        const ev = ['view-candidate', 'export'].includes(b.ev) ? b.ev : null; if (!ev) return json(res, 400, { error: 'אירוע לא מוכר' });
        const k0 = C.corps[b.corps] ? b.corps : '', scope = C.ROLES[user.role].scope;
        if (AUTH && !(user._mustChange) && (scope === 'all' || user.corps === k0)) audit(ev, user.id, req, true, [k0, String(b.what || '').slice(0, 80)].filter(Boolean).join(' · '));
        return json(res, 200, { ok: true });
      }
      if (AUTH && user._mustChange) return json(res, 403, { error: 'נדרש שינוי סיסמה', mustChange: true });
      if (AUTH && p === '/api/admin/reset-password') {
        if (!isAdminUser(user)) return json(res, 403, { error: 'אין הרשאה' });
        const t = userById(b.id); if (!t) return json(res, 400, { error: 'משתמש לא מוכר' });
        const pw = tempPw(); setPassword(t.id, pw, true); audit('admin-reset-password', user.id, req, true, t.id); return json(res, 200, { ok: true, password: pw });
      }
      const k = b.corps;
      const needCorps = () => { if (!C.corps[k]) throw new Error('חיל לא מוכר'); };
      const canView = () => { if (C.ROLES[user.role].scope !== 'all' && user.corps !== k) throw new Error('אין הרשאה לחיל זה'); };
      if (p === '/api/pick') {
        needCorps(); if (!canDo(user, 'pick', k)) throw new Error('רק שלישות היחידה יכולה לבחור');
        doPick(k, user.unit, b.id, false); return json(res, 200, { ok: true });
      }
      if (p === '/api/eval') {
        needCorps(); canView();
        if (!canDo(user, 'eval', k)) throw new Error('רק מגבש/ת מזינ/ה התרשמות');
        const c = state.corps[k].cands.find((x) => x.id === b.id);
        if (!c) throw new Error('מועמד לא נמצא');
        if (c.group !== user.group) throw new Error('המועמד אינו בצוות שלך');
        applyEval(cfg(k), c, b, user.title);
        state.log.push({ ts: Date.now(), corps: k, text: `${user.title} הזינ/ה התרשמות על ${c.name}` });
        save(); return json(res, 200, { ok: true, cand: c });
      }
      if (p === '/api/eval-bulk') {
        needCorps(); if (!canDo(user, 'evalbulk', k)) throw new Error('אין הרשאה להעלות נתוני מגבש');
        const cf = cfg(k), cst = state.corps[k], isEv = user.role === 'מגבש/ת', grp = isEv ? user.group : parseInt(b.group, 10);
        let updated = 0, added = 0, skipped = 0, foreign = 0, notFound = 0;
        (b.rows || []).slice(0, 500).forEach((r) => {
          const c = cst.cands.find((x) => (r.id && x.id === String(r.id).trim()) || (r.name && x.name === String(r.name).trim()));
          if (c) { if (isEv && c.group !== user.group) { foreign++; return; } if (applyEval(cf, c, r, user.title)) updated++; else skipped++; return; }
          if (b.addNew && r.name && cf.roles.includes(r.role) && TEAMS.includes(grp)) { const nc = newCand(cf, cst, String(r.name).trim(), r.role, grp, 'מגבש'); applyEval(cf, nc, r, user.title); added++; } else notFound++;
        });
        state.log.push({ ts: Date.now(), corps: k, text: `${user.title} קלט/ה קובץ: ${updated} עודכנו, ${added} נוספו` });
        save(); return json(res, 200, { ok: true, updated, added, skipped, foreign, notFound });
      }
      if (p === '/api/regroup') {
        needCorps(); if (!canDo(user, 'regroup', k)) throw new Error('אין הרשאה להעביר מועמדים בין צוותים');
        const c = state.corps[k].cands.find((x) => x.id === b.id); if (!c) throw new Error('מועמד לא נמצא');
        const g = parseInt(b.group, 10); if (!TEAMS.includes(g)) throw new Error('צוות לא תקין');
        if (user.role === 'מגבש/ת' && c.group !== user.group) throw new Error('המועמד אינו בצוות שלך');
        const from = c.group; c.group = g;
        state.log.push({ ts: Date.now(), corps: k, text: `${user.title} העביר/ה את ${c.name} מצוות ${from} לצוות ${g}` });
        save(); return json(res, 200, { ok: true });
      }
      if (p === '/api/settings') {
        needCorps(); if (!canDo(user, 'settings', k)) throw new Error('רק מנהל/ת מערכת יכול/ה לשנות הגדרות דראפט');
        const cst = state.corps[k], cur = stg(k), nw = Object.assign({}, cur);
        if ('rounds' in b) nw.rounds = Math.max(1, Math.min(8, parseInt(b.rounds, 10) || cur.rounds));
        if (b.order === 'snake' || b.order === 'linear') nw.order = b.order;
        ['strictThresholds', 'strictQuotas', 'blockNotRecommended'].forEach((f) => { if (f in b) nw[f] = !!b[f]; });
        const structural = nw.rounds !== cur.rounds || nw.order !== cur.order;
        if (structural && cst.picks.some((p) => !p.auto)) throw new Error('אי אפשר לשנות מספר סבבים או סדר אחרי שיחידה בחרה ידנית – אפסו את הדראפט קודם');
        if (structural) cst.picks = [];
        cst.settings = nw; if (structural) playUntilMine(k); state.log.push({ ts: Date.now(), corps: k, text: `${user.title} עדכן/ה הגדרות דראפט: ${nw.rounds} סבבים, סדר ${nw.order === 'snake' ? 'מתחלף' : 'רגיל'}` });
        save(); return json(res, 200, { ok: true, settings: nw });
      }
      if (p === '/api/thresholds') {
        needCorps(); const own = canDo(user, 'thresholds', k); if (!own && !canDo(user, 'settings', k)) throw new Error('אין הרשאה');
        const ov = state.corps[k].units.find((u) => u.name === (own ? user.unit : b.unit)); if (!ov) throw new Error('יחידה לא נמצאה');
        const th = {}; cfg(k).stats.forEach((s) => { const v = num((b.th || {})[s.k]); if (v != null) th[s.k] = v; });
        ov.th = th; ov.noMed = !!b.noMed;
        if (b.quota) { const q = {}; cfg(k).roles.forEach((r) => { const n = Math.max(0, Math.min(9, parseInt((b.quota || {})[r], 10) || 0)); if (n) q[r] = n; }); ov.quota = q; }
        save(); return json(res, 200, { ok: true });
      }
      if (p === '/api/import') {
        needCorps(); if (!canDo(user, 'import', k)) throw new Error('אין הרשאה לייבא מועמדים');
        const cf = cfg(k), cs = state.corps[k];
        let max = cs.cands.reduce((m, c) => Math.max(m, parseInt(c.id.slice(cf.prefix.length), 10) || 0), 0);
        const used = new Set(cs.cands.map((c) => c.name));
        let added = 0, skipped = 0, updated = 0, notFound = 0;
        if (b.mode === 'update') {
          (b.rows || []).forEach((r) => { const c = cs.cands.find((x) => (r.id && x.id === String(r.id).trim()) || (r.name && x.name === String(r.name).trim())); if (!c) { notFound++; return; } if (applyUpdate(cf, c, r)) updated++; else skipped++; });
          state.log.push({ ts: Date.now(), corps: k, text: `${user.title} עדכנה ${updated} מועמדים מקובץ` });
          save(); return json(res, 200, { ok: true, updated, skipped, notFound });
        }
        (b.rows || []).forEach((r) => {
          const name = String(r.name || '').trim();
          if (!name || used.has(name) || !cf.roles.includes(r.role)) { skipped++; return; }
          used.add(name); max++;
          const stats = {}; cf.stats.forEach((s) => { stats[s.k] = num((r.stats || {})[s.k]); });
          const med = C.MEDS.includes(r.med) ? r.med : C.MEDS[0];
          cs.cands.push({
            id: cf.prefix + max, name, role: r.role, lv: cf.traits.map(() => null), stats,
            rec: C.RECS.includes(r.rec) ? r.rec : null, med, profile: num(r.profile) || (med === C.MEDS[0] ? 97 : 72),
            area: '—', pref: '—', wish: { role: '', units: [], combat: null }, group: 1 + (max % 4), skills: cf.skills[r.role] || [], obs: '', summary: '', evaluated: false, source: 'ייבוא',
          });
          applyUpdate(cf, cs.cands[cs.cands.length - 1], { motivation: r.motivation, combat: r.combat, photo: r.photo });
          added++;
        });
        state.log.push({ ts: Date.now(), corps: k, text: `${user.title} ייבאה ${added} מועמדים` });
        save(); return json(res, 200, { ok: true, added, skipped });
      }
      if (p === '/api/baseline') {
        needCorps(); if (!canDo(user, 'import', k)) throw new Error('אין הרשאה להעלות נתוני ייחוס');
        const rows = cleanBaseline(cfg(k), b.rows); if (!rows.length) throw new Error('לא נמצאו שורות תקינות בקובץ (בדקו את עמודת התפקיד)');
        state.corps[k].baseline = { label: String(b.label || 'מחזור קודם').slice(0, 60), uploadedAt: Date.now(), by: user.title, rows };
        state.log.push({ ts: Date.now(), corps: k, text: `${user.title} העלתה נתוני ייחוס (${rows.length} שורות)` });
        save(); return json(res, 200, { ok: true, count: rows.length, skipped: (b.rows || []).length - rows.length });
      }
      if (p === '/api/baseline-clear') {
        needCorps(); if (!canDo(user, 'import', k)) throw new Error('אין הרשאה'); delete state.corps[k].baseline;
        state.log.push({ ts: Date.now(), corps: k, text: `${user.title} מחקה את נתוני הייחוס` }); save(); return json(res, 200, { ok: true });
      }
      if (p === '/api/fav') {
        needCorps(); if (!canDo(user, 'fav', k)) throw new Error('אין הרשאה לסמן מועדפים');
        const cst = state.corps[k]; if (!cst.cands.some((x) => x.id === b.id)) throw new Error('מועמד לא נמצא');
        cst.favs = cst.favs || {}; const set = new Set(cst.favs[user.id] || []); if (b.on) set.add(b.id); else set.delete(b.id); cst.favs[user.id] = Array.from(set);
        save(); return json(res, 200, { ok: true });
      }
      if (p === '/api/undo') {
        needCorps(); if (!canDo(user, 'undo', k)) throw new Error('אין הרשאה');
        const cst = state.corps[k]; if (!cst.picks.length) throw new Error('אין בחירות לביטול');
        const last = cst.picks.pop(), c = cst.cands.find((x) => x.id === last.id);
        cst.turnStartedAt = Date.now();
        state.log.push({ ts: Date.now(), corps: k, text: `${user.title} ביטל/ה את הבחירה של ${last.unit}: ${c ? c.name : last.id}` });
        save(); return json(res, 200, { ok: true });
      }
      if (p === '/api/reset') {
        needCorps(); if (!canDo(user, 'reset', k)) throw new Error('אין הרשאה');
        state.corps[k].picks = []; playUntilMine(k);
        state.log.push({ ts: Date.now(), corps: k, text: `${user.title} איפסה את הדראפט` });
        save(); return json(res, 200, { ok: true });
      }
      if (p === '/api/factory-reset') {
        if (!canDo(user, 'factory', null)) throw new Error('רק מנהל/ת מערכת יכול/ה לאפס את המערכת');
        const fresh = freshState(); state.corps = fresh.corps; state.log = []; Object.keys(C.corps).forEach(playUntilMine); save(); return json(res, 200, { ok: true });
      }
      if (p === '/api/advance') { // demo helper: auto-play the draft up to the end of round N (0 = reset, 4 = finish)
        needCorps(); if (!canDo(user, 'advance', k)) throw new Error('אין הרשאה');
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
