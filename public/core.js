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
const HDR = () => Object.assign({ 'X-Code': codeVal(), 'X-Requested-With': 'mil-draft' }, A.auth ? {} : { 'X-User': A.me ? A.me.id : '' });
function sessionLost(j) { // auth mode: cookie expired / revoked, or a forced password change is pending
  if (j && j.mustChange) { if (A.me) A.me.mustChange = true; rerender(); return true; }
  if (A.auth && A.me) { A.me = null; A.ui = {}; if (A.es) A.es.close(); toast('ההתחברות פגה – יש להיכנס מחדש', true); rerender(); return true; }
  return false;
}
async function api(path, body) {
  const r = await fetch('/api/' + path, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, HDR()), body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && j.error === 'קוד גישה שגוי') { localStorage.removeItem('mil-code'); location.reload(); }
  if ((r.status === 401 || (r.status === 403 && j.mustChange)) && path !== 'login' && sessionLost(j)) throw new Error(j.error);
  if (!r.ok) { toast(j.error || 'שגיאה', true); throw new Error(j.error); }
  return j;
}
const codeVal = () => localStorage.getItem('mil-code') || '';
async function refresh() {
  const r = await fetch('/api/state', { headers: HDR() });
  if (r.status === 401) { const j = await r.json().catch(() => ({})); if (j.error === 'קוד גישה שגוי') { localStorage.removeItem('mil-code'); location.reload(); return; } if (A.auth) { sessionLost(j); return; } }
  if (r.status === 403) { const j = await r.json().catch(() => ({})); if (j.mustChange) { sessionLost(j); return; } }
  if (!r.ok) return; A.S = await r.json(); A.skew = A.S.serverNow - Date.now();
}
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
// draft settings (admin-configurable): rounds, order (snake / linear), optional hard rules for manual picks
const STG_DEFAULT = { order: 'snake', strictThresholds: false, strictQuotas: false, blockNotRecommended: false };
const stg = (k) => Object.assign({ rounds: cf(k).rounds }, STG_DEFAULT, cs(k).settings);
function orderOf(k) {
  const c = cf(k), S = stg(k), o = [];
  for (let r = 0; r < S.rounds; r++) { (S.order === 'snake' && r % 2 === 1 ? c.units.slice().reverse() : c.units).forEach((u) => o.push({ r: r + 1, u: u.name })); }
  return o;
}
function fitOf(k, c, u) {
  const out = [];
  cf(k).stats.forEach((s) => {
    const t = u.th[s.k]; if (t == null) return;
    const v = c.stats[s.k], miss = v == null;
    out.push({ l: s.l + (s.low ? ' עד ' : ' לפחות ') + fmtVal(s, t) + (miss ? ' (חסר נתון)' : ''), s: s.l.split(' ')[0], ok: !miss && (s.low ? v <= t : v >= t) });
  });
  if (u.noMed) out.push({ l: 'ללא מגבלות רפואיות', s: 'רפואי', ok: c.med === 'ללא מגבלות' });
  out.push({ l: 'המלצת מגבש לא שלילית', s: 'המלצה', ok: !!c.rec && c.rec !== 'לא מומלץ' });
  return out;
}
const fitBad = (k, c, u) => fitOf(k, c, u).filter((x) => !x.ok);
const strengths = (k, c) => cf(k).traits.filter((t, i) => c.lv[i] === 2);
const missingOf = (k, c) => { const m = cf(k).stats.filter((s) => c.stats[s.k] == null).map((s) => s.l); if (!c.rec) m.push('המלצה'); if (c.lv.some((v) => v == null)) m.push('חוזקות'); return m; };
function draftInfo(k) {
  const order = orderOf(k), picks = cs(k).picks, finished = picks.length >= order.length;
  const takenBy = {}; picks.forEach((p) => { takenBy[p.id] = p; });
  return { order, picks, finished, slot: finished ? null : order[picks.length], takenBy };
}
const countRole = (k, unit, role) => cs(k).picks.filter((p) => p.unit === unit && cs(k).cands.find((c) => c.id === p.id).role === role).length;
const candOf = (k, id) => cs(k).cands.find((c) => c.id === id);
// run / fault-finding times are stored as decimal minutes (12.5) but always shown and typed as minutes:seconds (12:30)
const isTime = (s) => s.u === 'דק׳';
function fmtTime(v) { const t = Math.round(v * 60); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }
function fmtVal(s, v) { return v == null || v === '' ? '—' : (isTime(s) ? fmtTime(v) : String(Math.round(v * 100) / 100)); }
function fmtStat(s, v) { return v == null ? 'חסר' : fmtVal(s, v) + ' ' + s.u; }
const cellVal = (s, v) => (v == null || v === '' ? '' : (isTime(s) ? fmtTime(v) : v)); // for Excel/CSV cells (times as text, so Excel keeps mm:ss)
// accepts "12:30", "12.5", "12,5" or an Excel time cell; returns decimal minutes / number, or null when invalid or empty
function parseStat(s, raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return !isFinite(raw) ? null : (isTime(s) && raw > 0 && raw < 1 ? raw * 24 : raw); // Excel stores 12:30 as a fraction of a day (12h30m)
  const t = String(raw).trim().replace(',', '.'); if (t === '') return null;
  if (isTime(s) && t.includes(':')) { const p = t.split(':').map(Number); if (p.some((x) => !isFinite(x) || x < 0)) return null; const sec = p.length > 1 ? p[1] : 0; return sec >= 60 ? null : p[0] + sec / 60; }
  const v = Number(t); return isFinite(v) ? v : null;
}
// does the candidate's value meet this unit's threshold for the metric? null = no threshold or no value
function statPass(s, v, unit) { const t = unit && unit.th ? unit.th[s.k] : null; if (t == null || v == null) return null; return s.low ? v <= t : v >= t; }

// ---- permissions / routing ----
const PAGES = [
  { id: 'room', name: 'חדר בחירה', icon: 'users' },
  { id: 'board', name: 'לוח הדראפט', icon: 'grid' },
  { id: 'eval', name: 'דף מגבש', icon: 'clip' },
  { id: 'command', name: 'תמונת מצב', icon: 'chart' },
  { id: 'results', name: 'תוצאות ויומן', icon: 'file' },
  { id: 'import', name: 'הזנה וייבוא', icon: 'upload' },
  { id: 'settings', name: 'הגדרות דראפט', icon: 'gear' },
];
const ICONS = {
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  clip: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 16v-5"/><path d="M12 16V8"/><path d="M17 16v-9"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 9.2-9.2M16 7l3 3M14 9l2 2"/>',
  scale: '<path d="M12 3v18M5 7h14"/><path d="m5 7-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
};
const icon = (n, s) => `<svg class="ic" width="${s || 20}" height="${s || 20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
// generic, fictitious avatar: deterministic cartoon face drawn from the candidate id (illustration only, not a real photo)
function avatar(x, size) {
  if (x && x.photo) return `<img class="avatar-img" src="${x.photo}" width="${size || 40}" height="${size || 40}" alt="${esc(x.name || '')}" style="border-radius:50%;flex:none;object-fit:cover">`;
  let h = 0; const id = String((x && x.id) || x || ''); for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const pick = (a, n) => a[(h >>> n) % a.length];
  const skin = pick(['#F6D3B3', '#E8B98F', '#D39B6E', '#B97B4F', '#8D5A3A', '#6B4128'], 0), hair = pick(['#1B1B1E', '#3A2A1E', '#5B3A21', '#8A5A2B', '#B9892F', '#6E6E73'], 3);
  const bg = pick(['#DCE7F7', '#E3F1E8', '#FBEBD3', '#EADCF5', '#F7DDE0', '#D9EFF2'], 5), style = pick([0, 1, 2, 3], 8), mouth = pick([0, 1, 2], 10), brow = pick([0, 1], 12);
  const hairBack = style === 3 ? `<path d="M30 46q-2-26 20-26t20 26v18q-6 8-8 4V44H38v24q-2 4-8-4z" fill="${hair}"/>` : '';
  const hairTop = ['<path d="M31 42q1-20 19-20t19 20q-8-9-19-9t-19 9z"/>', '<path d="M30 46q-3-26 20-26t20 26q-4-12-12-15-12 6-28 15z"/>', '<path d="M33 40q2-18 17-18t17 18q-10-5-17-5t-17 5z"/>', '<path d="M31 44q0-23 19-23t19 23q-8-10-19-10t-19 10z"/>'][style];
  const m = ['<path d="M44 66q6 5 12 0" fill="none" stroke="#7A3B2E" stroke-width="2.2" stroke-linecap="round"/>', '<path d="M45 66h10" stroke="#7A3B2E" stroke-width="2.2" stroke-linecap="round"/>', '<path d="M44 65q6 8 12 0z" fill="#fff" stroke="#7A3B2E" stroke-width="1.6" stroke-linejoin="round"/>'][mouth];
  return `<svg class="avatar-img" width="${size || 40}" height="${size || 40}" viewBox="0 0 100 100" role="img" aria-label="תמונה להמחשה בלבד" style="border-radius:50%;flex:none"><rect width="100" height="100" fill="${bg}"/>${hairBack}<path d="M14 100q2-22 36-22t36 22z" fill="#4A5D3A"/><rect x="43" y="66" width="14" height="14" rx="5" fill="${skin}"/><ellipse cx="50" cy="52" rx="19" ry="22" fill="${skin}"/><ellipse cx="31" cy="54" rx="3.5" ry="5" fill="${skin}"/><ellipse cx="69" cy="54" rx="3.5" ry="5" fill="${skin}"/><g fill="${hair}">${hairTop}</g><circle cx="43" cy="53" r="2.4" fill="#222"/><circle cx="57" cy="53" r="2.4" fill="#222"/><path d="M39 ${brow ? 46 : 47}h8M53 ${brow ? 46 : 47}h8" stroke="${hair}" stroke-width="2.2" stroke-linecap="round"/>${m}</svg>`;
}
const R = () => A.cfg.roles[A.me.role];
// favorites (private, per user): ♥ marks candidates a unit/commander wants to keep an eye on
const favList = (k) => (cs(k).favs && A.me && cs(k).favs[A.me.id]) || [];
const isFav = (k, id) => favList(k).includes(id);
const heartIcon = (on, s) => `<svg class="ic" width="${s || 18}" height="${s || 18}" viewBox="0 0 24 24" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.heart}</svg>`;
const favBtn = (k, id, cls) => { const on = isFav(k, id), t = on ? 'הסר מהמועדפים' : 'הוסף למועדפים'; return `<button class="favbtn ${on ? 'on' : ''} ${cls || ''}" data-act="fav" data-id="${id}" data-tip="${t}" aria-pressed="${on}" aria-label="${t}">${heartIcon(on)}</button>`; };
// a candidate's name as a link to the candidate card (plain text for roles that cannot open candidate files)
const candLink = (k, id, name) => (canFile() ? `<a href="#/room" class="clink" data-act="openCand" data-id="${esc(id)}" data-k="${esc(k)}" title="פתיחת כרטיס מועמד">${esc(name)}</a>` : esc(name));
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
  const nav = PAGES.filter(allowed).map((p) => `<a href="#/${p.id}" class="${route() === p.id ? 'on' : ''}" ${route() === p.id ? 'aria-current="page"' : ''}>${icon(p.icon)}<span>${p.name}</span></a>`).join('');
  const page = PAGES.find((p) => p.id === route());
  const dark = document.documentElement.dataset.theme === 'dark';
  const k = A.me.corps || A.ui.corps;
  const scope = A.me.corps ? cf(A.me.corps).corps : 'כל החילות';
  return `<div class="app"><aside class="side"><div class="logo">${icon('shield', 26)}<span>MIL-DRAFT</span></div><nav class="nav">${nav}</nav>
    <div class="side-foot"><div class="meta">אב־טיפוס לדמו · כל הנתונים פיקטיביים</div>
    <div class="usercard"><span class="avatar" style="${roleStyle(A.me.role)[0]}">${esc(A.me.initial)}</span><span class="uc-t"><b>${esc(A.me.title)}</b><small>${esc(A.me.unit)}</small></span></div>
    <div class="row" style="gap:6px"><span class="lbadge">שכבה ${R().layer} · ${esc(A.me.role)}</span></div></div></aside>
   <div class="content"><header class="tbar"><div class="bar-t"><span class="bar-page">${page ? page.name : ''}</span><span class="bar-sub">${esc(scope)}</span></div>
    <div class="bar-r">${installBox(true)}<span class="live"><i></i>חי</span><button class="iconbtn" data-act="theme" title="מצב כהה / בהיר" aria-label="החלפת ערכת נושא">${icon(dark ? 'sun' : 'moon', 18)}</button>${A.auth ? `<button class="iconbtn" data-act="pwOpen" title="שינוי סיסמה" aria-label="שינוי סיסמה">${icon('key', 18)}</button>` : ''}<button class="iconbtn" data-act="logout" title="החלפת משתמש" aria-label="החלפת משתמש">${icon('out', 18)}</button></div></header>
    <main>${inner}</main></div>${A.ui.pw ? pwView(false) : ''}</div>`;
}

// ---- login ----
// three steps: חיל ← יחידה ← תפקיד (users carry org / orgUnit / roleLabel from the server)
const ROLE_ORDER = ['שלישות', 'מפקד/ת הכשרה', 'מגבש/ת', 'ראש מטה', 'מנהל/ת מערכת', 'צופה/ת'];
function loginUnits(org) { // a corps: its units in draft order, then its evaluation event; HR / dev: in config order
  const names = []; A.cfg.users.filter((u) => u.org === org).forEach((u) => { if (!names.includes(u.orgUnit)) names.push(u.orgUnit); });
  const corps = A.cfg.corps[org], idx = (n) => { const i = corps ? corps.units.findIndex((x) => x.name === n) : -1; return i < 0 ? 999 : i; };
  return corps ? names.sort((a, b) => idx(a) - idx(b)) : names;
}
// under every unit of a corps: the unit's שלישות, the training commander and the evaluators (teams 1-4) of that corps
const loginRoles = (org, unit) => A.cfg.users.filter((u) => u.org === org && (u.orgUnit === unit || (u.role === 'מגבש/ת' && A.cfg.corps[org]))).sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || (a.group || 0) - (b.group || 0));
function loginAuto() { // skip steps that have a single option
  const org = A.ui.lorg; if (!org) return;
  const units = loginUnits(org); if (!A.ui.lunit && units.length === 1) A.ui.lunit = units[0];
  if (A.ui.lunit && !A.ui.sel) { const rs = loginRoles(org, A.ui.lunit); if (rs.length === 1) A.ui.sel = rs[0].id; }
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
  loginAuto();
  const org = A.ui.lorg, unit = A.ui.lunit, u = A.ui.sel ? A.cfg.users.find((x) => x.id === A.ui.sel) : null, o = u && roleOf(u.role);
  const step = (n, title, done, body) => `<div class="step ${done ? 'done' : ''}"><div class="step-h"><span class="stepno">${done ? icon('check', 15) : n}</span><b>${title}</b></div>${body}</div>`;
  const s1 = A.cfg.orgs.map((g) => `<button class="orgbtn ${org === g.key ? 'on' : ''}" data-act="lorg" data-v="${g.key}">${esc(g.label)}</button>`).join('');
  const s2 = org ? loginUnits(org).map((n) => `<button class="choice ${unit === n ? 'on' : ''}" data-act="lunit" data-v="${esc(n)}">${esc(n)}</button>`).join('') : '<div class="mut small">בחרו חיל תחילה</div>';
  const s3 = org && unit ? loginRoles(org, unit).map((x) => `<button class="user ${x.id === A.ui.sel ? 'on' : ''}" data-act="sel" data-id="${x.id}"><span class="avatar" style="${roleStyle(x.role)[0]}">${esc(x.initial)}</span><span class="u-t"><b>${esc(x.roleLabel)}</b><small>${esc(x.title)}</small></span><span class="pill ${roleStyle(x.role)[1]}">שכבה ${roleOf(x.role).layer}</span></button>`).join('') : '<div class="mut small">בחרו יחידה תחילה</div>';
  const target = o ? PAGES.find((p) => p.id === o.home).name : '';
  return `<div class="login"><section class="hero"><div class="logo big">${icon('shield', 34)}<span>MIL-DRAFT</span></div>
   <h1>מהגיבוש ועד השיבוץ – <em>תמונה אחת</em> של כל מועמד</h1>
   <p>מגבשים מזינים התרשמות מקצועית, יחידות בוחרות בחדר בחירה משותף לפי מערך, ומפקדי ההכשרה מקבלים את התמונה המלאה.</p>
   <div class="chips"><span>דראפט חי</span><span>6 שכבות סיווג</span><span>5 חילות</span></div>
   ${layerMatrix(u ? u.role : null)}
   <div class="demo-note">${A.auth ? 'הכניסה מוגנת בסיסמה אישית. ניסיונות כושלים חוסמים את החשבון זמנית, וכל כניסה נרשמת ביומן אבטחה.' : 'אב־טיפוס לדמו – המשתמשים פיקטיביים. הפעלת <b>AUTH=1</b> בשרת מחליפה את הבחירה החופשית בכניסה עם סיסמה אישית.'}</div></section>
   <section class="picker"><div class="row spread"><h2>כניסה למערכת</h2><button class="iconbtn" data-act="theme" aria-label="החלפת ערכת נושא">${icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', 18)}</button></div>
   <p class="mut" style="margin:0">בחרו חיל, יחידה ותפקיד. ההרשאות נקבעות לפי שכבת הסיווג של התפקיד.</p>
   ${installBox()}
   ${step(1, 'חיל', !!org, `<div class="orgs">${s1}</div>`)}
   ${step(2, 'יחידה', !!unit, `<div class="choices">${s2}</div>`)}
   ${step(3, 'תפקיד', !!u, `<div class="roles">${s3}</div>`)}
   ${u ? `<div class="card sel-info"><div class="row spread"><b>שכבה ${o.layer} · ${esc(u.role)}</b><span class="pill ${LPILL[o.layer]}">${SCOPE_TXT[o.scope]}</span></div><p class="mut small" style="margin:6px 0 0">${esc(o.desc)}</p></div>` : ''}
   ${u && A.auth ? '<label style="margin-top:6px">סיסמה<input type="password" id="pw" autocomplete="current-password" placeholder="הקלידו סיסמה" data-inp="pwEnter"></label>' : ''}
   <div class="enter"><button class="btn lg" data-act="login" ${u ? '' : 'disabled'}>${u ? 'כניסה כ' + esc(u.title) + ' ←' : 'בחרו חיל, יחידה ותפקיד'}</button>${u ? `<span class="mut small">ייפתח: ${target}</span>` : ''}</div></section></div>`;
}

// ---- password change (forced at first login / after an admin reset, or from the header) ----
function pwView(forced) {
  const f = `<h2 style="margin:0">${forced ? 'יש לבחור סיסמה חדשה' : 'שינוי סיסמה'}</h2><p class="mut small" style="margin:0">${forced ? 'הסיסמה הנוכחית היא זמנית. ' : ''}לפחות 10 תווים, אותיות וספרות.</p>
   <label>סיסמה נוכחית<input type="password" id="pw-old" autocomplete="current-password"></label><label>סיסמה חדשה<input type="password" id="pw-new" autocomplete="new-password"></label><label>אימות סיסמה חדשה<input type="password" id="pw-new2" autocomplete="new-password"></label>
   <div class="row"><button class="btn" data-act="pwSave">שמירה</button>${forced ? '<button class="btn sec" data-act="logout">יציאה</button>' : '<button class="btn sec" data-act="pwClose">ביטול</button>'}</div>`;
  return forced ? `<div style="max-width:420px;margin:10vh auto;display:flex;flex-direction:column;gap:12px;padding:20px">${f}</div>` : `<div class="drawer-bg" style="align-items:center" data-act="pwClose"><div class="modal" role="dialog">${f}</div></div>`;
}

// ---- security log: reports sensitive reads (candidate file opened) and exports; the server records them when AUTH=1 ----
function auditEvent(ev, what) { try { fetch('/api/audit-event', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, HDR()), body: JSON.stringify({ ev, corps: A.me ? corpsKey() : '', what }) }).catch(() => {}); } catch (e) { /* never block the UI */ } }
function auditView() { const id = A.ui.cand; if (!id || !A.me || id === A._viewed) { if (!id) A._viewed = null; return; } A._viewed = id; auditEvent('view-candidate', id); }

// ---- render loop ----
const SCREENS = {}; // id -> fn(k) => html, registered by other files
let renderQueued = false;
function render() {
  const app = $('#app');
  if (!A.cfg || !A.S) { app.innerHTML = '<p style="padding:40px">טוען…</p>'; return; }
  if (!A.me) { app.innerHTML = loginView(); return; }
  if (A.auth && A.me.mustChange) { app.innerHTML = pwView(true); return; }
  let r = route();
  const page = PAGES.find((p) => p.id === r);
  if (!page || !allowed(page)) { go(homeFor()); return; }
  const keep = captureFocus();
  const dr = A.ui.cand && canFile() ? drawer(corpsKey(), A.ui.cand) : ''; // the candidate card opens on top of any screen
  app.innerHTML = (shell(SCREENS[r](corpsKey())) + dr).replace(/(\d+)\s?\/\s?(\d+)(?![^<]*>)/g, '<bdi dir="ltr">$1 / $2</bdi>'); // keep fractions readable in RTL
  restoreFocus(keep);
  if (SCREENS[r].after) SCREENS[r].after();
  auditView();
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
function rerender(live) { if (live && (A.ui.editTh || A.ui.cmpOpen)) return; /* don't wipe an open edit dialog on live updates */ if (renderQueued) return; renderQueued = true; requestAnimationFrame(() => { renderQueued = false; const y = window.scrollY; render(); window.scrollTo(0, y); }); }

// ---- global actions ----
const ACTIONS = {
  lorg: (d) => { A.ui.lorg = d.v; A.ui.lunit = null; A.ui.sel = null; rerender(); },
  lunit: (d) => { A.ui.lunit = d.v; A.ui.sel = null; rerender(); },
  sel: (d) => { A.ui.sel = d.id; rerender(); },
  login: async () => {
    const u = A.ui.sel ? A.cfg.users.find((x) => x.id === A.ui.sel) : null; if (!u) return;
    if (A.auth) {
      const pw = $('#pw') ? $('#pw').value : ''; if (!pw) { toast('הקלידו סיסמה', true); return; }
      let r; try { r = await api('login', { id: u.id, password: pw }); } catch (x) { return; }
      A.me = Object.assign({}, u, { mustChange: r.mustChange }); if (r.mustChange) { rerender(); return; }
    } else { A.me = u; localStorage.setItem('mil-user', A.me.id); }
    connectSSE(); await refresh(); go(homeFor()); render();
  },
  reload: () => location.reload(),
  theme: () => { localStorage.setItem('mil-theme', document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); applyTheme(); rerender(); },
  logout: async () => { if (A.auth) { try { await api('logout', {}); } catch (x) { /* already out */ } } localStorage.removeItem('mil-user'); A.me = null; A.ui = {}; if (A.es) A.es.close(); location.hash = ''; render(); },
  corps: (d) => { A.ui.corps = d.k; A.ui.cand = null; rerender(); },
};
Object.assign(ACTIONS, {
  pwEnter: (d, t, e) => { if (e.key === 'Enter') ACTIONS.login(); },
  pwOpen: () => { A.ui.pw = true; rerender(); }, pwClose: () => { A.ui.pw = false; rerender(); },
  pwSave: async () => {
    const o = $('#pw-old').value, n = $('#pw-new').value; if (n !== $('#pw-new2').value) { toast('האימות לא תואם לסיסמה החדשה', true); return; }
    try { await api('change-password', { old: o, next: n }); } catch (x) { return; }
    const forced = A.me.mustChange; A.me.mustChange = false; A.ui.pw = false; toast('הסיסמה עודכנה');
    if (forced) { connectSSE(); await refresh(); go(homeFor()); } render();
  },
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target && e.target.id === 'pw') ACTIONS.login(); });
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
  const k = corpsKey(), cst = cs(k); if (!cst || !A.S.clockSeconds) return ''; // no time pressure unless the server enables a clock
  const left = Math.max(0, A.S.clockSeconds - Math.floor((nowS() - cst.turnStartedAt) / 1000));
  return String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
}
function clockPct() { const k = corpsKey(), cst = cs(k); if (!cst || !A.S.clockSeconds) return 0; return Math.max(0, 100 - (nowS() - cst.turnStartedAt) / 10 / A.S.clockSeconds); }
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

// ---- installable app (PWA) ----
let deferredInstall = null;
const isStandaloneApp = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; rerender(); });
window.addEventListener('appinstalled', () => { deferredInstall = null; toast('האפליקציה הותקנה'); rerender(); });
ACTIONS.install = async () => { if (!deferredInstall) return; deferredInstall.prompt(); try { await deferredInstall.userChoice; } catch (e) { /* dismissed */ } deferredInstall = null; rerender(); };
ACTIONS.hideIos = () => { localStorage.setItem('mil-ios-hint', '1'); rerender(); };
function installBox(bar) { // install button (Android/desktop) anywhere; the longer iPhone how-to only on the login screen
  if (isStandaloneApp()) return '';
  if (deferredInstall) return '<button class="btn sm" data-act="install">התקנה</button>';
  if (!bar && isIOS() && !localStorage.getItem('mil-ios-hint')) return `<div class="install-hint"><b>להתקנה באייפון:</b> לחצו על כפתור השיתוף <span aria-hidden="true">⬆︎</span> בדפדפן Safari ובחרו <b>״הוסף למסך הבית״</b>.<button class="btn sec sm" data-act="hideIos">הבנתי</button></div>`;
  return '';
}
if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* offline mode unavailable */ }); });
