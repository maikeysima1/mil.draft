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
  { id: 'u1', title: 'שלישות גדס״ר גבעתי', unit: 'גדס״ר גבעתי', corps: 'combat', role: 'שלישות', initial: 'ש' },
  { id: 'u2', title: 'שלישות שייטת 13', unit: 'שייטת 13', corps: 'intel', role: 'שלישות', initial: 'ש' },
  { id: 'u6', title: 'שלישות קורס טיס – שלב בסיסי', unit: 'קורס טיס – שלב בסיסי', corps: 'signals', role: 'שלישות', initial: 'ש' },
];
const canDo = C.canDo;
// one evaluator per team (צוות 1..4) in every corps: "מגבש צוות 1 אחראי על צוות 1" and so on
const TEAMS = [1, 2, 3, 4];
const LEGACY_EVAL = { 'combat|3': 'u4', 'intel|2': 'u5', 'signals|1': 'u7' };
const CORPS_SHORT_S = {}; Object.keys(C.corps).forEach((k) => { CORPS_SHORT_S[k] = C.corps[k].short; });
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
  const c = { id: cf.prefix + max, name, role, lv: cf.traits.map(() => null), stats, rec: null, med: C.MEDS[0], profile: null, area: '—', pref: '—', wish: { role: '', units: [], combat: null }, group, skills: cf.skills[role] || [], obs: '', summary: '', evaluated: false, source: source || 'ייבוא' };
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
  USERS.push({ id: 's-' + k + '-' + i, title: 'שלישות ' + u.name, unit: u.name, corps: k, role: 'שלישות', initial: 'ש' });
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

// ---------- training model + api (shared with the standalone build) ----------
const cfg = (k) => C.corps[k];
const num = (v) => { if (v === '' || v == null) return null; const n = Number(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
const SCHEMA = 8;
const DAY = 86400e3;
const dayKey = (ts) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date(ts)); // YYYY-MM-DD, Israel time
// current review period: quarter (רבעון) or half-year (חציון)
function periodOf(ts, type) {
  const [y, m] = dayKey(ts).split('-').map(Number), n = type === 'חציון' ? Math.ceil(m / 6) : Math.ceil(m / 3);
  const lastM = n * (type === 'חציון' ? 6 : 3), end = y + '-' + String(lastM).padStart(2, '0') + '-' + new Date(Date.UTC(y, lastM, 0)).getUTCDate();
  return { key: y + (type === 'חציון' ? '-H' : '-Q') + n, label: (type === 'חציון' ? 'חציון ' : 'רבעון ') + n + ' / ' + y, type: type === 'חציון' ? 'חציון' : 'רבעון', end, daysLeft: Math.round((Date.parse(end) - Date.parse(dayKey(ts))) / DAY) };
}
const periodType = () => (state.settings && C.TR.periods.includes(state.settings.period) ? state.settings.period : 'רבעון');
const isActive = (c) => !['הודח/ה', 'סיים/ה הכשרה'].includes(c.tstatus);
const openDismiss = (c) => (c.dismiss || []).find((d) => d.status === 'פתוחה');
// where a dismissed soldier goes: the unit one level lower in the same track with the largest open need; null = leaves the track
const unitTier = (k, name) => { const u = cfg(k).units.find((x) => x.name === name); return (u && u.tier) || 1; };
const needOf = (k, name) => ((state.corps[k].needs || {})[name]) || 0;
const byNeed = (k, us) => { const t = Math.min.apply(null, us.map((u) => u.tier || 1)); return us.filter((u) => (u.tier || 1) === t).sort((a, b) => needOf(k, b.name) - needOf(k, a.name))[0].name; };
// { k, unit }: one level lower in the same track; if nothing is open there, the next track(s) in the chain; null = leaves to the fallback
function nextPlace(k, c) {
  const t = unitTier(k, c.unit), lower = cfg(k).units.filter((u) => (u.tier || 1) > t && needOf(k, u.name) > 0);
  if (lower.length) return { k, unit: byNeed(k, lower) };
  const seen = [k]; let n = cfg(k).nextTrack;
  while (n && C.corps[n] && !seen.includes(n)) { const open = cfg(n).units.filter((u) => needOf(n, u.name) > 0); if (open.length) return { k: n, unit: byNeed(n, open) }; seen.push(n); n = cfg(n).nextTrack; }
  return null;
}
// move a soldier to another track: new id, the track's default role, only measures that mean the same thing, levels unknown; the whole history stays
function moveTrack(k, c, k2, unit) {
  const src = state.corps[k], dst = state.corps[k2], cf2 = cfg(k2), cf1 = cfg(k);
  const max = dst.cands.reduce((m, x) => Math.max(m, parseInt(x.id.slice(cf2.prefix.length), 10) || 0), 0) + 1, stats = {};
  cf2.stats.forEach((s2) => { const s1 = cf1.stats.find((x) => x.l === s2.l && x.u === s2.u); stats[s2.k] = s1 && c.stats[s1.k] != null ? c.stats[s1.k] : null; });
  src.cands = src.cands.filter((x) => x.id !== c.id); Object.keys(src.favs || {}).forEach((u) => { src.favs[u] = src.favs[u].filter((id) => id !== c.id); });
  c.prevIds = (c.prevIds || []).concat([c.id]); c.prevRole = c.role; c.id = cf2.prefix + max; c.role = cf2.roles[0]; c.skills = cf2.skills[c.role] || []; c.stats = stats; c.lv = cf2.traits.map(() => null);
  c.unit = unit; c.target = ''; c.tstatus = 'בהכשרה'; dst.cands.push(c);
}
const logAct = (k, text) => { state.log.push({ ts: Date.now(), corps: k, text }); if (state.log.length > 1500) state.log.shift(); };
// training fields of a soldier who enters the system (event 1: intake)
function intakeFields(c, unit, target, who, ts) { c.unit = unit || ''; c.target = target || ''; c.tstatus = 'בהכשרה'; c.intakeTs = ts || Date.now(); c.intakeBy = who || ''; c.daily = []; c.reviews = []; c.dismiss = []; return c; }
// demo history so the screens are not empty: a few daily entries, last period's status, and three soldiers in / after a dismissal review
function seedTraining(k, cands) {
  const cf = cfg(k), now = Date.now(); let s = 5 + k.length;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const prev = periodOf(now - 92 * DAY, 'רבעון');
  cands.forEach((c, i) => {
    intakeFields(c, cf.units[i % cf.units.length].name, C.TARGETS[k][i % C.TARGETS[k].length], 'שלישות ' + cf.units[i % cf.units.length].name, now - (120 + Math.floor(rnd() * 60)) * DAY);
    const sum = c.lv.reduce((a, b) => a + (b || 0), 0), base = sum >= 7 ? 2 : (sum >= 4 ? 1 : 0), ev = 'מגבש/ת צוות ' + c.group, top = c.lv.indexOf(Math.max.apply(null, c.lv)), weak = c.lv.indexOf(Math.min.apply(null, c.lv));
    for (let d = 24; d >= 1; d--) { // the last weeks, with gaps like real life (today is left empty on purpose)
      if (rnd() < (d > 4 ? 0.4 : 0.2)) continue;
      const lvl = Math.max(0, Math.min(2, base + (rnd() < 0.25 ? -1 : (rnd() > 0.8 ? 1 : 0)))), att = rnd() < 0.06 ? C.TR.attend[2] : C.TR.attend[0];
      c.daily.push({ d: dayKey(now - d * DAY), ts: now - d * DAY, by: ev, byId: 'seed', level: lvl, att, text: lvl === 2 ? cf.good[top] : (lvl === 0 ? cf.weak[weak] : 'יום אימונים רגיל, עמד/ה במשימות.') });
    }
    if (i % 5 !== 4) c.reviews.push({ period: prev.key, label: prev.label, ts: now - (60 + Math.floor(rnd() * 20)) * DAY, by: 'מפקד/ת הכשרה · ' + c.unit, lv: c.lv.slice(), rec: sum <= 4 ? C.TR.periodRec[1] : C.TR.periodRec[0], summary: (cf.traits.filter((t, j) => c.lv[j] === 2).length ? 'חוזקות: ' + cf.traits.filter((t, j) => c.lv[j] === 2).join(', ') + '. ' : 'תפקוד תקין ברוב התחומים. ') + (cf.traits.filter((t, j) => c.lv[j] === 0).length ? 'לחיזוק: ' + cf.traits.filter((t, j) => c.lv[j] === 0).join(', ') + '.' : 'אין תחום חריג לחיזוק.') });
    if (sum <= 4 && c.reviews.length) c.tstatus = 'במעקב';
  });
  const low = cands.filter((c) => c.tstatus === 'במעקב');
  if (low[0]) { low[0].tstatus = 'בבדיקת הדחה'; low[0].dismiss.push({ id: 'd1', status: 'פתוחה', openedTs: now - 3 * DAY, openedBy: 'מגבש/ת צוות ' + low[0].group, reason: 'ירידה מתמשכת בתפקוד בשבועיים האחרונים וקושי לעמוד בעומס.', prev: 'במעקב', opinions: [{ byId: 'seed', by: 'מגבש/ת צוות ' + low[0].group, stance: C.TR.stances[0], text: 'שלושה תרגילים רצופים שבהם לא עמד/ה בקצב הצוות, גם אחרי שיחה אישית.', ts: now - 3 * DAY }] }); }
  if (low[1]) { low[1].tstatus = 'הודח/ה'; low[1].dismiss.push({ id: 'd1', status: 'נסגרה', openedTs: now - 30 * DAY, openedBy: 'מפקד/ת הכשרה · ' + low[1].unit, reason: 'אי עמידה ברף המקצועי לאחר תקופת מעקב.', prev: 'במעקב', decision: 'הודח/ה', decidedBy: 'מפקד/ת הכשרה · ' + low[1].unit, decidedTs: now - 24 * DAY, note: 'הוחלט לאחר שיחה עם החייל/ת ועם המגבש/ת. מומלץ לשיבוץ בתפקיד אחר.', from: low[1].unit, exitTo: cf.fallback }); low[1].exitTo = cf.fallback; }
  if (low[2]) { low[2].dismiss.push({ id: 'd1', status: 'נסגרה', openedTs: now - 45 * DAY, openedBy: 'מגבש/ת צוות ' + low[2].group, reason: 'קושי בעבודת צוות.', prev: 'בהכשרה', decision: 'נשאר/ת במעקב', decidedBy: 'מפקד/ת הכשרה · ' + low[2].unit, decidedTs: now - 40 * DAY, note: 'שיפור ניכר לאחר שיחה. ממשיך/ה במעקב צמוד.' }); }
  return cands;
}
function freshState() {
  const cands = seedCands();
  const st = { corps: {}, log: [], version: 1, schema: SCHEMA, settings: { period: 'רבעון' } };
  Object.keys(C.corps).forEach((k) => { const needs = {}; C.corps[k].units.forEach((u) => { needs[u.name] = u.need || 0; }); st.corps[k] = { cands: seedTraining(k, cands[k]), favs: {}, needs }; });
  return st;
}
// what a client receives. Favorites are private: every client only gets its own list.
function makeSnapshot(userId) {
  const now = Date.now(), o = { version: state.version, serverNow: now, today: dayKey(now), period: periodOf(now, periodType()), settings: { period: periodType() }, corps: {}, log: state.log.slice(-400).reverse() };
  Object.keys(C.corps).forEach((k) => { const f = state.corps[k].favs || {}; o.corps[k] = Object.assign({}, state.corps[k], { favs: userId && f[userId] ? { [userId]: f[userId] } : {} }); });
  return o;
}
// every state-changing action. Throws Error(hebrew message) on a refused action; returns the response object.
function apiHandle(p, b, user) {
  const k = b.corps, T = C.TR;
  const needCorps = () => { if (!C.corps[k]) throw new Error('חיל לא מוכר'); if (C.ROLES[user.role].scope !== 'all' && user.corps !== k) throw new Error('אין הרשאה לחיל זה'); };
  const allow = (action, msg) => { needCorps(); if (!canDo(user, action, k)) throw new Error(msg || 'הפעולה לא זמינה לתפקיד שלך'); };
  const cst = C.corps[k] ? state.corps[k] : null, cf = C.corps[k] ? cfg(k) : null;
  const soldier = (id) => { const c = cst.cands.find((x) => x.id === id); if (!c) throw new Error('החייל/ת לא נמצא/ה'); if (user.role === 'מגבש/ת' && c.group !== user.group) throw new Error('החייל/ת אינו/ה בצוות שלך'); return c; };
  const mustBeActive = (c) => { if (!isActive(c)) throw new Error(c.name + ' כבר אינו/ה בהכשרה (' + c.tstatus + ')'); };
  const text = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

  if (p === 'eval') {
    allow('eval', 'רק מגבש/ת מזינ/ה דף מגבש'); const c = soldier(b.id);
    applyEval(cf, c, b, user.title); logAct(k, `${user.title} עדכנ/ה דף מגבש של ${c.name}`); save(); return { ok: true, cand: c };
  }
  if (p === 'eval-bulk') {
    allow('evalbulk', 'אין הרשאה להעלות נתוני מגבש');
    const isEv = user.role === 'מגבש/ת', grp = isEv ? user.group : parseInt(b.group, 10);
    let updated = 0, added = 0, skipped = 0, foreign = 0, notFound = 0;
    (b.rows || []).slice(0, 500).forEach((r) => {
      const c = cst.cands.find((x) => (r.id && x.id === String(r.id).trim()) || (r.name && x.name === String(r.name).trim()));
      if (c) { if (isEv && c.group !== user.group) { foreign++; return; } if (applyEval(cf, c, r, user.title)) updated++; else skipped++; return; }
      if (b.addNew && r.name && cf.roles.includes(r.role) && TEAMS.includes(grp)) { const nc = intakeFields(newCand(cf, cst, String(r.name).trim(), r.role, grp, 'מגבש'), '', '', user.title); applyEval(cf, nc, r, user.title); added++; } else notFound++;
    });
    logAct(k, `${user.title} קלט/ה קובץ מגבש: ${updated} עודכנו, ${added} נוספו`); save(); return { ok: true, updated, added, skipped, foreign, notFound };
  }
  if (p === 'regroup') {
    allow('regroup', 'אין הרשאה להעביר חיילים בין צוותים'); const c = soldier(b.id);
    const g = parseInt(b.group, 10); if (!TEAMS.includes(g)) throw new Error('צוות לא תקין');
    const from = c.group; c.group = g; logAct(k, `${user.title} העביר/ה את ${c.name} מצוות ${from} לצוות ${g}`); save(); return { ok: true };
  }
  // ---- event 1: intake (גיוס המועמד) ----
  if (p === 'intake') {
    allow('intake', 'רק שלישות או מנהל/ת מערכת מגייסים מועמדים למערכת');
    const name = text(b.name, 60); if (name.length < 2) throw new Error('חסר שם');
    if (cst.cands.some((c) => c.name === name)) throw new Error(name + ' כבר קיים/ת במערכת');
    if (!cf.roles.includes(b.role)) throw new Error('תפקיד לא מוכר');
    const unit = user.role === 'שלישות' ? user.unit : b.unit; if (!cf.units.some((u) => u.name === unit)) throw new Error('יש לבחור יחידה');
    if (!C.TARGETS[k].includes(b.target)) throw new Error('יש לבחור את היחידה המיוחדת שאליה החייל/ת מועמד/ת');
    const g = parseInt(b.group, 10); if (!TEAMS.includes(g)) throw new Error('צוות לא תקין');
    const c = intakeFields(newCand(cf, cst, name, b.role, g, 'גיוס'), unit, b.target, user.title);
    applyUpdate(cf, c, { med: b.med, profile: b.profile, stats: b.stats || {}, photo: b.photo });
    logAct(k, `${user.title} גייס/ה את ${c.name} (${c.role}) ל${unit} · מועמד/ת ל${b.target}`); save(); return { ok: true, id: c.id };
  }
  if (p === 'import') {
    allow('import', 'אין הרשאה לייבא מועמדים');
    let added = 0, skipped = 0, updated = 0, notFound = 0; const used = new Set(cst.cands.map((c) => c.name));
    if (b.mode === 'update') {
      (b.rows || []).forEach((r) => { const c = cst.cands.find((x) => (r.id && x.id === String(r.id).trim()) || (r.name && x.name === String(r.name).trim())); if (!c) { notFound++; return; } if (applyUpdate(cf, c, r)) updated++; else skipped++; });
      logAct(k, `${user.title} עדכנ/ה ${updated} חיילים מקובץ`); save(); return { ok: true, updated, skipped, notFound };
    }
    (b.rows || []).slice(0, 1000).forEach((r) => {
      const name = text(r.name, 60); if (!name || used.has(name) || !cf.roles.includes(r.role)) { skipped++; return; }
      used.add(name);
      const unit = user.role === 'שלישות' ? user.unit : (cf.units.some((u) => u.name === r.unit) ? r.unit : ''); // unknown stays unknown
      const c = intakeFields(newCand(cf, cst, name, r.role, 1 + (cst.cands.length % 4), 'ייבוא'), unit, C.TARGETS[k].includes(r.target) ? r.target : '', user.title);
      applyUpdate(cf, c, r); added++;
    });
    logAct(k, `${user.title} גייס/ה ${added} מועמדים מקובץ`); save(); return { ok: true, added, skipped };
  }
  if (p === 'fav') {
    allow('fav', 'אין הרשאה לסמן מעקב אישי'); soldier(b.id);
    cst.favs = cst.favs || {}; const set = new Set(cst.favs[user.id] || []); if (b.on) set.add(b.id); else set.delete(b.id); cst.favs[user.id] = Array.from(set);
    save(); return { ok: true };
  }
  // ---- daily follow-up: one entry per author per soldier per day (a second save the same day replaces the first) ----
  if (p === 'daily') {
    allow('daily', 'מעקב יומי מוזן ע״י מפקד/ת הכשרה או מגבש/ת הצוות');
    const rows = Array.isArray(b.rows) ? b.rows.slice(0, 300) : [b], now = Date.now(), d = dayKey(now); let n = 0;
    rows.forEach((r) => {
      const c = soldier(r.id); mustBeActive(c);
      const level = parseInt(r.level, 10); if (![0, 1, 2].includes(level)) throw new Error('יש לבחור רמה יומית ל' + c.name);
      const e = { d, ts: now, by: user.title, byId: user.id, level, att: T.attend.includes(r.att) ? r.att : T.attend[0], text: text(r.text, 500) };
      const i = c.daily.findIndex((x) => x.d === d && x.byId === user.id); if (i >= 0) c.daily[i] = e; else c.daily.push(e);
      if (c.daily.length > 400) c.daily.shift(); n++;
    });
    logAct(k, `${user.title} הזינ/ה מעקב יומי ל-${n} חיילים`); save(); return { ok: true, saved: n };
  }
  // ---- event 3: periodic status (רבעון / חציון) ----
  if (p === 'periodic') {
    allow('periodic', 'סטטוס תקופתי מוזן ע״י מפקד/ת הכשרה'); const c = soldier(b.id); mustBeActive(c);
    if (!T.periodRec.includes(b.rec)) throw new Error('יש לבחור סיכום: ממשיך/ה, במעקב או מועמד/ת להדחה');
    // structured summary (strengths / to improve / plan); a single free-text summary is still accepted
    const parts = { strong: text(b.strong, 500), improve: text(b.improve, 500), plan: text(b.plan, 500) }, hasParts = !!(parts.strong || parts.improve || parts.plan);
    if (hasParts && !parts.plan) throw new Error('יש למלא "המלצה להמשך"');
    const summary = hasParts ? [parts.strong && 'חוזקות: ' + parts.strong, parts.improve && 'לשיפור: ' + parts.improve, 'המלצה להמשך: ' + parts.plan].filter(Boolean).join(' · ') : text(b.summary, 1500);
    if (summary.length < 10 || (hasParts && (parts.strong + parts.improve + parts.plan).length < 10)) throw new Error('יש לכתוב סיכום קצר (לפחות 10 תווים)');
    const lv = cf.traits.map((t, i) => { const v = parseInt((b.lv || [])[i], 10); return [0, 1, 2].includes(v) ? v : null; });
    const per = periodOf(Date.now(), periodType()), rv = { period: per.key, label: per.label, ts: Date.now(), by: user.title, lv, rec: b.rec, summary, parts: hasParts ? parts : null };
    const i = c.reviews.findIndex((x) => x.period === per.key); if (i >= 0) c.reviews[i] = rv; else c.reviews.push(rv);
    lv.forEach((v, j) => { if (v != null) c.lv[j] = v; }); // the card always shows the latest known level
    let opened = false;
    if (b.rec === T.periodRec[2]) { if (!openDismiss(c)) { c.dismiss.push({ id: 'd' + (c.dismiss.length + 1), status: 'פתוחה', openedTs: Date.now(), openedBy: user.title, reason: 'סטטוס ' + per.label + ': ' + summary.slice(0, 300), prev: c.tstatus === 'בבדיקת הדחה' ? 'במעקב' : c.tstatus }); opened = true; } c.tstatus = 'בבדיקת הדחה'; }
    else if (!openDismiss(c)) c.tstatus = b.rec === T.periodRec[1] ? 'במעקב' : 'בהכשרה';
    logAct(k, `${user.title} הזינ/ה סטטוס ${per.label} ל${c.name}: ${b.rec}${opened ? ' · נפתחה בדיקת הדחה' : ''}`); save(); return { ok: true, opened };
  }
  // ---- event 2: dismissal review (בדיקת מועמד להדחה) ----
  if (p === 'dismiss-open') {
    allow('dismiss', 'אין הרשאה לפתוח בדיקת הדחה'); const c = soldier(b.id); mustBeActive(c);
    if (openDismiss(c)) throw new Error('כבר פתוחה בדיקת הדחה ל' + c.name);
    const reason = text(b.reason, 1000); if (reason.length < 10) throw new Error('יש לפרט את הסיבה לבדיקה (לפחות 10 תווים)');
    c.dismiss.push({ id: 'd' + (c.dismiss.length + 1), status: 'פתוחה', openedTs: Date.now(), openedBy: user.title, reason, prev: c.tstatus, opinions: [] }); c.tstatus = 'בבדיקת הדחה';
    logAct(k, `${user.title} פתח/ה בדיקת הדחה ל${c.name}`); save(); return { ok: true };
  }
  // the dismissal room: one reasoned position per person per review (saving again replaces it)
  if (p === 'dismiss-opinion') {
    allow('opine', 'נימוק בחדר ההדחה נרשם ע״י מפקד/ת הכשרה או מגבש/ת הצוות'); const c = soldier(b.id), d = openDismiss(c);
    if (!d) throw new Error('אין בדיקת הדחה פתוחה ל' + c.name);
    if (!T.stances.includes(b.stance)) throw new Error('יש לבחור עמדה');
    const txt = text(b.text, 1000); if (txt.length < 10) throw new Error('יש לנמק את העמדה (לפחות 10 תווים)');
    d.opinions = d.opinions || []; const o = { byId: user.id, by: user.title, stance: b.stance, text: txt, ts: Date.now() }, i = d.opinions.findIndex((x) => x.byId === user.id);
    if (i >= 0) d.opinions[i] = o; else d.opinions.push(o);
    logAct(k, `${user.title} רשמ/ה נימוק בחדר ההדחה על ${c.name}: ${b.stance}`); save(); return { ok: true };
  }
  if (p === 'dismiss-decide') {
    allow('decide', 'הדחה והחלטה בבדיקה – רק באישור מפקד/ת ההכשרה'); const c = soldier(b.id), d = openDismiss(c);
    if (!d) throw new Error('אין בדיקת הדחה פתוחה ל' + c.name);
    if (!T.decisions.includes(b.decision)) throw new Error('יש לבחור החלטה');
    const note = text(b.note, 1000); if (note.length < 10) throw new Error('יש לנמק את ההחלטה (לפחות 10 תווים)');
    const nOp = (d.opinions || []).length; if (b.decision === T.decisions[2] && nOp < T.minOpinions) throw new Error('אי אפשר להדיח לפני שנרשמו לפחות ' + T.minOpinions + ' נימוקים בחדר ההדחה (נרשמו ' + nOp + ')');
    Object.assign(d, { status: 'נסגרה', decision: b.decision, decidedBy: user.title, decidedTs: Date.now(), note });
    let movedTo = null, movedTrack = null;
    if (b.decision === T.decisions[2]) { // dismissed from this unit: move one level down by the system's needs, or leave the track
      const pl = nextPlace(k, c); d.from = c.unit;
      if (pl) {
        movedTo = pl.unit; state.corps[pl.k].needs[pl.unit]--; d.movedTo = pl.unit; if (pl.k !== k) { d.movedTrack = cfg(pl.k).corps; movedTrack = cfg(pl.k).corps; }
        c.transfers = (c.transfers || []).concat([{ ts: Date.now(), from: c.unit, to: pl.unit, track: pl.k !== k ? cfg(pl.k).corps : '', by: user.title }]);
        if (pl.k !== k) moveTrack(k, c, pl.k, pl.unit); else { c.unit = pl.unit; c.target = ''; c.tstatus = 'בהכשרה'; }
      } else { d.exitTo = cf.fallback; c.exitTo = cf.fallback; c.tstatus = 'הודח/ה'; }
    } else c.tstatus = b.decision === T.decisions[1] ? 'במעקב' : 'בהכשרה';
    logAct(k, `${user.title} החליט/ה בבדיקת ההדחה של ${c.name}: ${b.decision}${b.decision === T.decisions[2] ? (movedTo ? ' · הועבר/ה אוטומטית ל' + movedTo + (movedTrack ? ' (' + movedTrack + ')' : '') : ' · יוצא/ת מהמסלול ל' + cf.fallback) : ''}`); save(); return { ok: true, movedTo, movedTrack, newId: movedTrack ? c.id : null, exitTo: movedTo ? null : (b.decision === T.decisions[2] ? cf.fallback : null) };
  }
  if (p === 'complete') {
    allow('complete', 'סיום הכשרה מסומן ע״י מפקד/ת הכשרה'); const c = soldier(b.id); mustBeActive(c);
    if (openDismiss(c)) throw new Error('יש לסגור קודם את בדיקת ההדחה הפתוחה');
    c.tstatus = 'סיים/ה הכשרה'; c.doneTs = Date.now(); logAct(k, `${user.title} סימנ/ה סיום הכשרה ל${c.name}`); save(); return { ok: true };
  }
  if (p === 'needs') { // open places per unit ("צורכי מערכת"), used to place dismissed soldiers
    needCorps(); if (!canDo(user, 'settings', null)) throw new Error('רק מנהל/ת מערכת מעדכן/ת את צורכי היחידות');
    if (!cf.units.some((u) => u.name === b.unit)) throw new Error('יחידה לא מוכרת');
    const n = parseInt(b.need, 10); if (!(n >= 0 && n <= 99)) throw new Error('מספר לא תקין');
    cst.needs = cst.needs || {}; cst.needs[b.unit] = n; logAct(k, `${user.title} עדכנ/ה צורך פתוח ב${b.unit}: ${n}`); save(); return { ok: true };
  }
  if (p === 'settings') {
    if (!canDo(user, 'settings', null)) throw new Error('רק מנהל/ת מערכת יכול/ה לשנות הגדרות');
    if (!T.periods.includes(b.period)) throw new Error('תקופה לא מוכרת');
    state.settings = Object.assign({}, state.settings, { period: b.period }); logAct(null, `${user.title} קבע/ה סטטוס תקופתי לפי ${b.period}`); save(); return { ok: true };
  }
  if (p === 'factory-reset') {
    if (!canDo(user, 'factory', null)) throw new Error('רק מנהל/ת מערכת יכול/ה לאפס את המערכת');
    const fresh = freshState(); state.corps = fresh.corps; state.settings = fresh.settings; state.log = []; save(); return { ok: true };
  }
  if (p === 'audit-event') return { ok: true };
  throw new Error('פעולה לא מוכרת');
}
// ---------- end shared ----------

let state;
try { state = openJson(fs.readFileSync(DATA_FILE, 'utf8')); if (state.schema !== SCHEMA) state = null; } catch (e) { if (/DATA_KEY|authenticate/i.test(e.message)) { console.error('FATAL: cannot read ' + DATA_FILE + ' (' + e.message + ') - refusing to start with an empty state'); process.exit(1); } state = null; }
let saveTimer = null;
function save() {
  state.version++;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { fs.writeFileSync(DATA_FILE, sealJson(state), { mode: 0o600 }); } catch (e) { console.error('save failed', e.message); } }, 200);
  broadcast();
}
if (!state) { state = freshState(); try { fs.writeFileSync(DATA_FILE, sealJson(state), { mode: 0o600 }); } catch (e) { console.error('save failed', e.message); } }

// ---------- SSE ----------
const clients = new Set();
const snapshot = makeSnapshot;
function broadcast() { const d = 'data: ' + JSON.stringify({ type: 'state', version: state.version }) + '\n\n'; clients.forEach((c) => c.res.write(d)); }

// ---------- HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); }
function body(req) { return new Promise((ok, no) => { let b = ''; req.on('data', (d) => { b += d; if (b.length > 5e6) req.destroy(); }); req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { no(e); } }); }); }

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
    if (p === '/api/config') return json(res, 200, { orgs: C.ORGS, roles: C.ROLES, TR: C.TR, TARGETS: C.TARGETS, corps: C.corps, users: USERS, words: C.WORDS, MEDS: C.MEDS, RECS: C.RECS });
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
      return json(res, 200, apiHandle(p.slice(5), b, user));
    }
    // static
    let f = p === '/' ? '/index.html' : p;
    f = path.normalize(path.join(PUB, f));
    if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(f).pipe(res);
  } catch (e) { json(res, 400, { error: e.message }); }
}).listen(PORT, () => console.log('MIL-DRAFT running on http://localhost:' + PORT));
