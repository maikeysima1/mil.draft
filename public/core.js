// Core: state, helpers, API, shell (nav), login, router
const A = { cfg: null, S: null, me: null, ui: {}, skew: 0 };
const $ = (s, r) => (r || document).querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WORDS = ['בסיסי', 'טוב', 'בולט'];
const LVCLS = ['p-gray', 'p-blue', 'p-green'];
const REC_CLS = { 'מומלץ': 'p-green', 'מומלץ בהסתייגות': 'p-orange', 'לא מומלץ': 'p-red' };

function toast(msg, err) {
  const t = $('#toast'); t.textContent = msg; t.className = 'show' + (err ? ' err' : '');
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.className = ''; }, 3200);
}
async function api(path, body) {
  const r = await fetch('/api/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-User': A.me ? A.me.id : '' }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { toast(j.error || 'שגיאה', true); throw new Error(j.error); }
  return j;
}
async function refresh() { A.S = await (await fetch('/api/state')).json(); A.skew = A.S.serverNow - Date.now(); }
const nowS = () => Date.now() + A.skew;

// ---- domain helpers ----
const cfRaw = (k) => A.cfg.corps[k];
// corps config with each unit's live overrides (quota / thresholds) applied
function cf(k) { const base = A.cfg.corps[k]; if (!A.S || !A.S.corps[k]) return base; return Object.assign({}, base, { units: base.units.map((u) => unitOf(k, u.name)) }); }
const cs = (k) => A.S.corps[k];
function unitOf(k, name) {
  const base = cfRaw(k).units.find((u) => u.name === name);
  const ov = cs(k).units.find((u) => u.name === name);
  return Object.assign({}, base, ov ? { th: ov.th, noMed: ov.noMed, quota: ov.quota || base.quota } : {});
}
function orderOf(k) {
  const c = cf(k), o = [];
  for (let r = 0; r < c.rounds; r++) { (r % 2 === 0 ? c.units : c.units.slice().reverse()).forEach((u) => o.push({ r: r + 1, u: u.name })); }
  return o;
}
function fitOf(k, c, u) {
  const out = [];
  cf(k).stats.forEach((s) => {
    const t = u.th[s.k]; if (t == null) return;
    const v = c.stats[s.k], miss = v == null;
    out.push({ l: s.l + (s.low ? ' עד ' : ' לפחות ') + t + (miss ? ' (חסר נתון)' : ''), s: s.l.split(' ')[0], ok: !miss && (s.low ? v <= t : v >= t) });
  });
  if (u.noMed) out.push({ l: 'ללא מגבלות רפואיות', s: 'רפואי', ok: c.med === 'ללא מגבלות' });
  out.push({ l: 'המלצת מגבש לא שלילית', s: 'המלצה', ok: !!c.rec && c.rec !== 'לא מומלץ' });
  return out;
}
const fitBad = (k, c, u) => fitOf(k, c, u).filter((x) => !x.ok);
const strengths = (k, c) => cf(k).traits.filter((t, i) => c.lv[i] === 2);
const missingOf = (k, c) => { const m = cf(k).stats.filter((s) => c.stats[s.k] == null).map((s) => s.l); if (!c.rec) m.push('המלצה'); return m; };
function draftInfo(k) {
  const order = orderOf(k), picks = cs(k).picks, finished = picks.length >= order.length;
  const takenBy = {}; picks.forEach((p) => { takenBy[p.id] = p; });
  return { order, picks, finished, slot: finished ? null : order[picks.length], takenBy };
}
const countRole = (k, unit, role) => cs(k).picks.filter((p) => p.unit === unit && cs(k).cands.find((c) => c.id === p.id).role === role).length;
const candOf = (k, id) => cs(k).cands.find((c) => c.id === id);
function fmtStat(s, v) { return v == null ? 'חסר' : v + ' ' + s.u; }

// ---- permissions / routing ----
const PAGES = [
  { id: 'room', name: 'חדר בחירה', full: true },
  { id: 'board', name: 'לוח הדראפט', full: true },
  { id: 'eval', name: 'דף מגבש', full: false },
  { id: 'command', name: 'תמונת מצב', full: true },
  { id: 'import', name: 'הזנה וייבוא', full: true },
];
const allowed = (p) => !!A.me && (A.me.role !== 'מגבש/ת' || !p.full);
const homeFor = () => (A.me.role === 'מגבש/ת' ? 'eval' : 'room');
function route() { return (location.hash.replace('#/', '') || '').split('?')[0]; }
function go(r) { location.hash = '#/' + r; }

// corps shown on screens: שלישות/מגבש fixed to their corps; commander can switch
function corpsKey() {
  if (A.me.corps) return A.me.corps;
  return A.ui.corps || 'combat';
}
function corpsSwitcher() {
  if (A.me.corps) return `<span class="chip navy">${esc(cf(A.me.corps).corps)}</span>`;
  return `<div class="row"><span class="mut small">חיל:</span><div class="tabs">${A.cfg.corps && Object.keys(A.cfg.corps).map((k) => `<button class="${corpsKey() === k ? 'on' : ''}" data-act="corps" data-k="${k}">${esc(cf(k).corps)}</button>`).join('')}</div></div>`;
}
function roleStyle(role) {
  return { 'שלישות': ['background:#3F5530;color:#fff', 'p-green'], 'מפקד/ת הכשרה': ['background:#2F5A8A;color:#fff', 'p-blue'], 'מגבש/ת': ['background:#C2741F;color:#fff', 'p-orange'] }[role];
}

// ---- shell ----
function shell(inner) {
  const nav = PAGES.filter(allowed).map((p) => `<a href="#/${p.id}" class="${route() === p.id ? 'on' : ''}">${p.name}</a>`).join('');
  return `<header class="top"><span class="brand">MIL-DRAFT</span><nav class="nav">${nav}</nav>
   <div class="who"><span class="avatar" style="${roleStyle(A.me.role)[0]}">${esc(A.me.initial)}</span><span>${esc(A.me.title)}<small>${esc(A.me.unit)}${A.me.corps ? ' · ' + esc(cf(A.me.corps).corps) : ' · כל החילות'}</small></span>
   <button class="btn link sm" data-act="logout">החלפת משתמש</button></div></header>
   <main><div class="demo-note">אב־טיפוס לדמו – כל השמות והנתונים פיקטיביים. במערכת אמיתית הכניסה תהיה בהזדהות מאובטחת.</div>${inner}</main>`;
}

// ---- login ----
function loginView() {
  const sel = A.ui.sel || 'u1';
  const u = A.cfg.users.find((x) => x.id === sel);
  const perms = PAGES.map((p) => { const ok = u.role !== 'מגבש/ת' || !p.full; return `<div class="row spread" style="padding:4px 0"><span>${p.name}</span><span class="pill ${ok ? 'p-green' : 'p-gray'}">${ok ? 'פתוח' : 'נעול'}</span></div>`; }).join('');
  const desc = { 'שלישות': 'גישה מלאה: חדר בחירה, לוח הדראפט, תמונת מצב, ייבוא וצפייה בדפי מגבש. רואה רק את מועמדי החיל שלה.', 'מפקד/ת הכשרה': 'גישה מלאה לצפייה בכל המסכים, כולל דפי המגבש, כדי להכיר את החיילים לפני תחילת ההכשרה.', 'מגבש/ת': 'גישה לדף המגבש בלבד: הזנת התרשמות על מועמדי הקבוצה שלו/ה. אין גישה לחדר הבחירה ולתוצאות הדראפט.' }[u.role];
  const target = u.role === 'מגבש/ת' ? 'דף מגבש' : 'חדר בחירה';
  return `<div class="login"><section style="display:flex;flex-direction:column;gap:18px"><div class="brand" style="color:var(--navy);font-size:22px">MIL-DRAFT</div>
   <h1 style="font-size:38px;font-weight:900;line-height:1.2">מהגיבוש ועד השיבוץ – תמונה אחת של כל מועמד</h1>
   <p class="mut" style="font-size:16px">מגבשים מזינים התרשמות מקצועית, יחידות בוחרות בחדר בחירה משותף לפי מערך, ומפקדי ההכשרה מקבלים את התמונה המלאה.</p>
   <div class="demo-note">אב־טיפוס לדמו – המשתמשים פיקטיביים. במערכת אמיתית הכניסה תהיה בהזדהות מאובטחת.</div></section>
   <section style="display:flex;flex-direction:column;gap:12px"><h2 style="font-size:28px;font-weight:800">כניסה למערכת</h2><p class="mut" style="margin:0">בחרו משתמש. ההרשאות נקבעות לפי הסיווג שלו.</p>
   ${A.cfg.users.map((x) => `<button class="user ${x.id === sel ? 'on' : ''}" data-act="sel" data-id="${x.id}"><span class="avatar" style="${roleStyle(x.role)[0]}">${esc(x.initial)}</span><span style="flex:1"><b>${esc(x.title)}</b><span class="mut small" style="display:block">${esc(x.unit)}${x.corps ? ' · ' + esc(cf(x.corps).corps) : ' · כל החילות'}${x.group ? ' · קבוצה ' + x.group : ''}</span></span><span class="pill ${roleStyle(x.role)[1]}">סיווג: ${esc(x.role)}</span></button>`).join('')}
   <div class="card"><h3 style="margin-bottom:6px">הרשאות – ${esc(u.role)}</h3>${perms}<p class="mut small" style="margin:8px 0 0">${desc}</p></div>
   <div class="row"><button class="btn" style="padding:13px 26px;font-size:17px" data-act="login">כניסה כ${esc(u.title)} ←</button><span class="mut small">ייפתח: ${target}</span></div></section></div>`;
}

// ---- render loop ----
const SCREENS = {}; // id -> fn(k) => html, registered by other files
let renderQueued = false;
function render() {
  const app = $('#app');
  if (!A.cfg || !A.S) { app.innerHTML = '<p style="padding:40px">טוען…</p>'; return; }
  if (!A.me) { app.innerHTML = loginView(); return; }
  let r = route();
  const page = PAGES.find((p) => p.id === r);
  if (!page || !allowed(page)) { go(homeFor()); return; }
  const keep = captureFocus();
  app.innerHTML = shell(SCREENS[r](corpsKey())).replace(/(\d+)\s?\/\s?(\d+)/g, '<bdi dir="ltr">$1 / $2</bdi>'); // keep fractions readable in RTL
  restoreFocus(keep);
  if (SCREENS[r].after) SCREENS[r].after();
}
function captureFocus() {
  const e = document.activeElement;
  if (!e || !e.id || !/INPUT|TEXTAREA|SELECT/.test(e.tagName)) return null;
  return { id: e.id, s: e.selectionStart, e: e.selectionEnd, y: window.scrollY };
}
function restoreFocus(k) {
  if (!k) return;
  const e = document.getElementById(k.id); if (!e) return;
  e.focus(); try { e.setSelectionRange(k.s, k.e); } catch (x) { /* not text */ }
}
function rerender(live) { if (live && A.ui.editTh) return; /* don't wipe an open edit dialog on live updates */ if (renderQueued) return; renderQueued = true; requestAnimationFrame(() => { renderQueued = false; const y = window.scrollY; render(); window.scrollTo(0, y); }); }

// ---- global actions ----
const ACTIONS = {
  sel: (d) => { A.ui.sel = d.id; rerender(); },
  login: () => { A.me = A.cfg.users.find((x) => x.id === (A.ui.sel || 'u1')); localStorage.setItem('mil-user', A.me.id); connectSSE(); go(homeFor()); render(); },
  logout: () => { localStorage.removeItem('mil-user'); A.me = null; A.ui = {}; if (A.es) A.es.close(); location.hash = ''; render(); },
  corps: (d) => { A.ui.corps = d.k; A.ui.cand = null; rerender(); },
};
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  if (t.classList.contains('drawer-bg') && e.target !== t) return; // click inside the dialog, not on the backdrop
  const fn = ACTIONS[t.dataset.act]; if (fn) { e.preventDefault(); fn(t.dataset, t, e); }
});
document.addEventListener('change', (e) => { const t = e.target.closest('[data-chg]'); if (t && ACTIONS[t.dataset.chg]) ACTIONS[t.dataset.chg](t.dataset, t, e); });
document.addEventListener('input', (e) => { const t = e.target.closest('[data-inp]'); if (t && ACTIONS[t.dataset.inp]) ACTIONS[t.dataset.inp](t.dataset, t, e); });
window.addEventListener('hashchange', () => { A.ui.cand = null; render(); });

// ---- live updates ----
function connectSSE() {
  if (A.es) A.es.close();
  A.es = new EventSource('/api/events?user=' + (A.me ? A.me.id : ''));
  A.es.onmessage = async (e) => {
    const m = JSON.parse(e.data);
    if (m.type === 'state') { await refresh(); rerender(true); }
    else if (m.type === 'tick') { const c = $('#clk'); if (c) c.textContent = clockText(); }
  };
}
function clockText() {
  const k = corpsKey(), cst = cs(k); if (!cst) return '';
  const left = Math.max(0, A.S.clockSeconds - Math.floor((nowS() - cst.turnStartedAt) / 1000));
  return String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
}
setInterval(() => { const c = $('#clk'); if (c) c.textContent = clockText(); }, 1000);

// ---- small UI pieces ----
function recPill(r) { return r ? `<span class="pill ${REC_CLS[r]}">${esc(r)}</span>` : '<span class="pill p-red">חסר: המלצה</span>'; }
function fitCell(k, c, u) {
  const bad = fitBad(k, c, u);
  return bad.length ? `<span class="pill p-orange">חסר: ${esc(bad.map((x) => x.s).join(', '))}</span>` : '<span class="pill p-green">עומד/ת בתנאי הסף</span>';
}
function strengthChips(k, c) { const s = strengths(k, c); return s.length ? s.map((t) => `<span class="pill p-blue">${esc(t)}</span>`).join(' ') : '—'; }
function csvDownload(name, rows) {
  const csv = '﻿' + rows.map((r) => r.map((v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click();
}
