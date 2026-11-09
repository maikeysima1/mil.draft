// Core: state, helpers, API, shell (nav), login, router
const A = { cfg: null, S: null, me: null, ui: {}, skew: 0 };
const $ = (s, r) => (r || document).querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WORDS = ['בסיסי', 'טוב', 'בולט'];
const wishRank = (c, u) => ((c.wish && c.wish.units) || []).indexOf(u) + 1; // 0 = not wished, 1..3 = rank
const COMBAT = ['לא מעוניין/ת', 'פתוח/ה', 'מעוניין/ת']; // willingness for a combat role (0..2)
// chart tooltip: any element with data-tip="value|label" (hover or keyboard focus); text only, never innerHTML
(function () {
  let tip; const get = () => { if (!tip) { tip = document.createElement('div'); tip.id = 'charttip'; document.body.appendChild(tip); } return tip; };
  const fill = (t) => { const el = get(), p = (t.dataset.tip || '').split('|'); el.replaceChildren(); const b = document.createElement('b'); b.textContent = p[0]; b.dir = 'ltr'; b.style.textAlign = 'start'; const s = document.createElement('span'); s.textContent = p[1] || ''; el.append(b, s); el.style.display = 'block'; return el; };
  const place = (el, x, y) => { const r = el.getBoundingClientRect(); el.style.left = Math.max(8, Math.min(innerWidth - r.width - 8, x)) + 'px'; el.style.top = Math.max(8, y - r.height) + 'px'; };
  document.addEventListener('pointermove', (e) => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t) place(fill(t), e.clientX + 12, e.clientY - 12); else if (tip) tip.style.display = 'none'; });
  document.addEventListener('focusin', (e) => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t) { const r = t.getBoundingClientRect(); place(fill(t), r.left, r.top - 6); } });
  document.addEventListener('focusout', () => { if (tip) tip.style.display = 'none'; });
})();
const LOWHIGH = ['נמוך', 'בינוני', 'גבוה'];
const LVCLS = ['p-gray', 'p-blue', 'p-green'];
const REC_CLS = { 'מומלץ': 'p-green', 'מומלץ בהסתייגות': 'p-orange', 'לא מומלץ': 'p-red' };

function toast(msg, err) {
  const t = $('#toast'); t.textContent = msg; t.className = 'show' + (err ? ' err' : '');
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.className = ''; }, 3200);
}
async function api(path, body) {
  const r = await fetch('/api/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-User': A.me ? A.me.id : '', 'X-Code': codeVal() }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && j.error === 'קוד גישה שגוי') { localStorage.removeItem('mil-code'); location.reload(); }
  if (!r.ok) { toast(j.error || 'שגיאה', true); throw new Error(j.error); }
  return j;
}
const codeVal = () => localStorage.getItem('mil-code') || '';
async function refresh() { const r = await fetch('/api/state', { headers: { 'X-Code': codeVal(), 'X-User': A.me ? A.me.id : '' } }); if (r.status === 401) { localStorage.removeItem('mil-code'); location.reload(); return; } A.S = await r.json(); A.skew = A.S.serverNow - Date.now(); }
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
  { id: 'room', name: 'חדר בחירה', icon: 'users' },
  { id: 'board', name: 'לוח הדראפט', icon: 'grid' },
  { id: 'eval', name: 'דף מגבש', icon: 'clip' },
  { id: 'command', name: 'תמונת מצב', icon: 'chart' },
  { id: 'import', name: 'הזנה וייבוא', icon: 'upload' },
];
const ICONS = {
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  clip: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 16v-5"/><path d="M12 16V8"/><path d="M17 16v-9"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
};
const icon = (n, s) => `<svg class="ic" width="${s || 20}" height="${s || 20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
const R = () => A.cfg.roles[A.me.role];
// favorites (private, per user): ♥ marks candidates a unit/commander wants to keep an eye on
const favList = (k) => (cs(k).favs && A.me && cs(k).favs[A.me.id]) || [];
const isFav = (k, id) => favList(k).includes(id);
const heartIcon = (on, s) => `<svg class="ic" width="${s || 18}" height="${s || 18}" viewBox="0 0 24 24" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.heart}</svg>`;
const favBtn = (k, id, cls) => { const on = isFav(k, id), t = on ? 'הסר מהמועדפים' : 'הוסף למועדפים'; return `<button class="favbtn ${on ? 'on' : ''} ${cls || ''}" data-act="fav" data-id="${id}" data-tip="${t}" aria-pressed="${on}" aria-label="${t}">${heartIcon(on)}</button>`; };
const roleOf = (name) => A.cfg.roles[name];
const allowed = (p) => !!A.me && R().pages.includes(p.id);
const homeFor = () => R().home;
// can the current user run `action` on corps k (mirrors the server's canDo)
const can = (action, k) => !!A.me && R().can.includes(action) && (R().scope === 'all' || A.me.corps === k);
const canFile = () => !!A.me && R().pages.includes('room'); // may open candidate files
const SCOPE_TXT = { all: 'כל החילות', corps: 'החיל שלו/ה', group: 'הצוות שלו/ה' };
function route() { return (location.hash.replace('#/', '') || '').split('?')[0]; }
function go(r) { location.hash = '#/' + r; }

// corps shown on screens: users bound to a corps are fixed to it; others can switch
function corpsKey() {
  if (A.me.corps) return A.me.corps;
  return A.ui.corps || 'combat';
}
function corpsSwitcher() {
  if (A.me.corps) return `<span class="chip navy">${esc(cf(A.me.corps).corps)}</span>`;
  return `<div class="row"><span class="mut small">חיל:</span><div class="tabs">${A.cfg.corps && Object.keys(A.cfg.corps).map((k) => `<button class="${corpsKey() === k ? 'on' : ''}" data-act="corps" data-k="${k}">${esc(cf(k).corps)}</button>`).join('')}</div></div>`;
}
const LPILL = ['', 'p-dark', 'p-blue', 'p-violet', 'p-green', 'p-orange', 'p-gray'];
function roleStyle(role) { const l = roleOf(role).layer; return [`background:var(--l${l});color:#fff`, LPILL[l]]; }

// ---- theme ----
function applyTheme() { document.documentElement.dataset.theme = localStorage.getItem('mil-theme') === 'dark' ? 'dark' : 'light'; }
applyTheme();

// ---- shell ----
function shell(inner) {
  const nav = PAGES.filter(allowed).map((p) => `<a href="#/${p.id}" class="${route() === p.id ? 'on' : ''}">${icon(p.icon)}<span>${p.name}</span></a>`).join('');
  const page = PAGES.find((p) => p.id === route());
  const dark = document.documentElement.dataset.theme === 'dark';
  const k = A.me.corps || A.ui.corps;
  const scope = A.me.corps ? cf(A.me.corps).corps : 'כל החילות';
  return `<div class="app"><aside class="side"><div class="logo">${icon('shield', 26)}<span>MIL-DRAFT</span></div><nav class="nav">${nav}</nav>
    <div class="side-foot"><div class="meta">אב־טיפוס לדמו · כל הנתונים פיקטיביים</div>
    <div class="usercard"><span class="avatar" style="${roleStyle(A.me.role)[0]}">${esc(A.me.initial)}</span><span class="uc-t"><b>${esc(A.me.title)}</b><small>${esc(A.me.unit)}</small></span></div>
    <div class="row" style="gap:6px"><span class="lbadge">שכבה ${R().layer} · ${esc(A.me.role)}</span></div></div></aside>
   <div class="content"><header class="tbar"><div class="bar-t"><span class="bar-page">${page ? page.name : ''}</span><span class="bar-sub">${esc(scope)}</span></div>
    <div class="bar-r"><span class="live"><i></i>חי</span><button class="iconbtn" data-act="theme" title="מצב כהה / בהיר" aria-label="החלפת ערכת נושא">${icon(dark ? 'sun' : 'moon', 18)}</button><button class="iconbtn" data-act="logout" title="החלפת משתמש" aria-label="החלפת משתמש">${icon('out', 18)}</button></div></header>
    <main>${inner}</main></div></div>`;
}

// ---- login ----
// selection order: training commander → שלישות (combat, intel, signals) → evaluators → oversight roles
const CORPS_ORDER = ['combat', 'intel', 'signals'];
const CORPS_SHORT = { combat: 'לוחמים', intel: 'מודיעין', signals: 'קשר' };
function loginGroups() {
  const us = A.cfg.users, unitIdx = (u) => cfRaw(u.corps).units.findIndex((x) => x.name === u.unit);
  const byCorps = (role, k) => us.filter((u) => u.role === role && u.corps === k).sort((a, b) => (role === 'מגבש/ת' ? a.group - b.group : unitIdx(a) - unitIdx(b)));
  const byRole = (r) => us.filter((u) => u.role === r);
  return [{ title: 'מפקד/ת הכשרה', users: byRole('מפקד/ת הכשרה') }]
    .concat(CORPS_ORDER.map((k) => ({ title: 'שלישות ' + CORPS_SHORT[k], users: byCorps('שלישות', k) })))
    .concat([{ title: 'מגבשים', users: [].concat(...CORPS_ORDER.map((k) => byCorps('מגבש/ת', k))) }])
    .concat([{ title: 'ניהול ופיקוח', users: byRole('ראש מטה').concat(byRole('צופה/ת'), byRole('מנהל/ת מערכת')) }])
    .filter((g) => g.users.length);
}
const loginOrder = () => [].concat(...loginGroups().map((g) => g.users));
function loginList(sel) {
  let n = 0;
  return loginGroups().map((g) => `<div class="grp"><div class="grp-t">${esc(g.title)}</div>` + g.users.map((x) => { n++; return `<button class="user ${x.id === sel ? 'on' : ''}" data-act="sel" data-id="${x.id}"><span class="num">${n}</span><span class="avatar" style="${roleStyle(x.role)[0]}">${esc(x.initial)}</span><span class="u-t"><b>${esc(x.title)}</b><small>${esc(x.unit)}${x.corps ? ' · ' + esc(cf(x.corps).corps) : ' · ' + SCOPE_TXT[roleOf(x.role).scope]}${x.group ? ' · צוות ' + x.group : ''}</small></span><span class="pill ${roleStyle(x.role)[1]}">שכבה ${roleOf(x.role).layer}</span></button>`; }).join('') + '</div>').join('');
}
const ACTION_TXT = { pick: 'בחירה', thresholds: 'עריכת מכסות', import: 'ייבוא', reset: 'איפוס', undo: 'ביטול בחירה', advance: 'הדמיה', eval: 'הזנת התרשמות', regroup: 'העברת מועמד בין צוותים', factory: 'איפוס מערכת' };
function layerMatrix(selRole) {
  const rows = Object.keys(A.cfg.roles).sort((a, b) => roleOf(a).layer - roleOf(b).layer);
  return `<div class="card matrix"><h2>שכבות סיווג והרשאות</h2><div class="mut small" style="margin-bottom:10px">כל שכבה רואה ומפעילה רק את מה שנקבע לה (העמודות: חדר בחירה, לוח, דף מגבש, תמונת מצב, ייבוא). השרת בודק כל פעולה מחדש.</div>
   <div style="overflow:auto"><table><thead><tr><th>שכבה</th>${PAGES.map((p) => `<th class="c" title="${p.name}">${icon(p.icon, 17)}</th>`).join('')}<th>היקף</th><th class="act">פעולות</th></tr></thead><tbody>
   ${rows.map((r) => { const o = roleOf(r); return `<tr class="${r === selRole ? 'sel' : ''}"><td><span class="pill ${LPILL[o.layer]}">${o.layer} · ${esc(r)}</span></td>${PAGES.map((p) => `<td class="c">${o.pages.includes(p.id) ? `<span class="ok">${icon('check', 15)}</span>` : '<span class="mut">—</span>'}</td>`).join('')}<td class="small">${SCOPE_TXT[o.scope]}</td><td class="small mut act">${o.can.map((a) => ACTION_TXT[a]).join(' · ') || 'צפייה בלבד'}</td></tr>`; }).join('')}
   </tbody></table></div></div>`;
}
function loginView() {
  const sel = A.ui.sel || loginOrder()[0].id;
  const u = A.cfg.users.find((x) => x.id === sel), o = roleOf(u.role);
  const target = PAGES.find((p) => p.id === o.home).name;
  return `<div class="login"><section class="hero"><div class="logo big">${icon('shield', 34)}<span>MIL-DRAFT</span></div>
   <h1>מהגיבוש ועד השיבוץ – <em>תמונה אחת</em> של כל מועמד</h1>
   <p>מגבשים מזינים התרשמות מקצועית, יחידות בוחרות בחדר בחירה משותף לפי מערך, ומפקדי ההכשרה מקבלים את התמונה המלאה.</p>
   <div class="chips"><span>דראפט חי</span><span>6 שכבות סיווג</span><span>3 חילות</span></div>
   ${layerMatrix(u.role)}
   <div class="demo-note">אב־טיפוס לדמו – המשתמשים פיקטיביים. במערכת אמיתית הכניסה תהיה בהזדהות מאובטחת.</div></section>
   <section class="picker"><div class="row spread"><h2>כניסה למערכת</h2><button class="iconbtn" data-act="theme" aria-label="החלפת ערכת נושא">${icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', 18)}</button></div><p class="mut" style="margin:0">בחרו משתמש. ההרשאות נקבעות לפי שכבת הסיווג שלו.</p>
   ${loginList(sel)}
   <div class="card sel-info"><div class="row spread"><b>שכבה ${o.layer} · ${esc(u.role)}</b><span class="pill ${LPILL[o.layer]}">${SCOPE_TXT[o.scope]}</span></div><p class="mut small" style="margin:6px 0 0">${esc(o.desc)}</p></div>
   <div class="enter"><button class="btn lg" data-act="login">כניסה כ${esc(u.title)} ←</button><span class="mut small">ייפתח: ${target}</span></div></section></div>`;
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
  login: async () => { A.me = A.cfg.users.find((x) => x.id === (A.ui.sel || loginOrder()[0].id)); localStorage.setItem('mil-user', A.me.id); connectSSE(); await refresh(); go(homeFor()); render(); },
  theme: () => { localStorage.setItem('mil-theme', document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); applyTheme(); rerender(); },
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
  A.es = new EventSource('/api/events?user=' + (A.me ? A.me.id : '') + '&code=' + encodeURIComponent(codeVal()));
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
function clockPct() { const k = corpsKey(), cst = cs(k); if (!cst) return 0; return Math.max(0, 100 - (nowS() - cst.turnStartedAt) / 10 / A.S.clockSeconds); }
setInterval(() => { const c = $('#clk'); if (c) c.textContent = clockText(); const r = $('#clkring'); if (r) r.style.setProperty('--p', clockPct().toFixed(1)); }, 1000);

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
