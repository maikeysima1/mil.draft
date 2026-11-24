// Training follow-up screens: soldiers in training who are candidates for a special unit.
// Core events: intake (גיוס המועמד), dismissal review (בדיקת הדחה), periodic status (רבעון / חציון) – plus a short daily entry.
const TR = () => A.cfg.TR;
const ST_CLS = { 'בהכשרה': 'p-green', 'במעקב': 'p-orange', 'בבדיקת הדחה': 'p-red', 'הודח/ה': 'p-gray', 'סיים/ה הכשרה': 'p-blue' };
const LV_CLS = ['p-orange', 'p-gray', 'p-green'];
// daily levels over the last 4 weeks: one dot per day with an entry (average when several people wrote), gaps stay gaps. No verdict, only the picture.
function trend(c, w) {
  const DAYS = 28, W = w || 300, H = 54, x0 = 8, x1 = W - 8, y = (l) => 44 - l * 17, by = {};
  (c.daily || []).forEach((e) => { const d = daysAgo(e.ts); if (d >= 0 && d < DAYS) (by[d] || (by[d] = [])).push(e); });
  const pts = Object.keys(by).map(Number).sort((a, b) => b - a).map((d) => { const es = by[d], avg = es.reduce((a, e) => a + e.level, 0) / es.length; return { d, avg, x: x0 + (x1 - x0) * (DAYS - 1 - d) / (DAYS - 1), tip: fmtD(es[0].ts) + '|' + es.map((e) => TR().daily[e.level] + ' · ' + e.by).join(' / ') }; });
  if (!pts.length) return '<div class="mut small">אין התנסויות מתועדות ב-4 השבועות האחרונים.</div>';
  let line = ''; pts.forEach((p, i) => { if (i && pts[i - 1].d - p.d === 1) line += `<line x1="${pts[i - 1].x.toFixed(1)}" y1="${y(pts[i - 1].avg).toFixed(1)}" x2="${p.x.toFixed(1)}" y2="${y(p.avg).toFixed(1)}" stroke="var(--s1)" stroke-width="2"/>`; });
  const mean = (a) => (a.length ? (a.reduce((x, p) => x + p.avg, 0) / a.length) : null), last = pts.filter((p) => p.d < 7), prev = pts.filter((p) => p.d >= 7), lbl = (v) => (v == null ? '—' : (v + 1).toFixed(1));
  return `<div class="row" style="gap:12px;align-items:center;flex-wrap:nowrap"><svg viewBox="0 0 ${W} ${H}" width="${W}" style="max-width:100%;flex:1" role="img" aria-label="התנסויות ב-4 השבועות האחרונים" dir="ltr">${[0, 1, 2].map((l) => `<line x1="${x0}" x2="${x1}" y1="${y(l)}" y2="${y(l)}" stroke="var(--line)" stroke-width="1"/>`).join('')}${line}${pts.map((p) => `<g data-tip="${esc(p.tip)}" tabindex="0"><rect x="${(p.x - 7).toFixed(1)}" y="2" width="14" height="${H - 4}" fill="transparent"/><circle cx="${p.x.toFixed(1)}" cy="${y(p.avg).toFixed(1)}" r="4" fill="var(--s1)" stroke="var(--card)" stroke-width="2"/></g>`).join('')}</svg>
   <div class="small" style="min-width:108px"><div class="mut">מצטיין ↑ · מתקשה ↓</div><div>${pts.length} ימים עם התנסות</div><div class="mut">ממוצע (1–3): 7 ימים <b>${lbl(mean(last))}</b> · לפני <b>${lbl(mean(prev))}</b></div></div></div>`;
}
const stPill = (c) => `<span class="pill ${ST_CLS[c.tstatus] || 'p-gray'}">${esc(c.tstatus)}</span>`;
const isActive = (c) => !['הודח/ה', 'סיים/ה הכשרה'].includes(c.tstatus);
const openDis = (c) => (c.dismiss || []).find((d) => d.status === 'פתוחה');
const fmtD = (ts) => new Date(ts).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
const daysAgo = (ts) => Math.floor((nowS() - ts) / 86400e3);
const agoTxt = (ts) => { const d = daysAgo(ts); return d <= 0 ? 'היום' : (d === 1 ? 'אתמול' : 'לפני ' + d + ' ימים'); };
const recentExp = (c) => (c.daily || []).some((e) => daysAgo(e.ts) <= 7);
const lastDaily = (c) => (c.daily || []).slice().sort((a, b) => b.ts - a.ts)[0];
const todayAll = (c) => (c.daily || []).filter((e) => e.d === A.S.today);
const myToday = (c) => (c.daily || []).find((e) => e.d === A.S.today && e.byId === A.me.id);
const periodRv = (c) => (c.reviews || []).find((r) => r.period === A.S.period.key);
const lastRv = (c) => (c.reviews || []).slice().sort((a, b) => b.ts - a.ts)[0];
// soldiers the current user may see: an evaluator sees only the own team
const visible = (k) => cs(k).cands.filter((c) => !teamOnly() || c.group === A.me.group);
const dailyPill = (e) => (e ? `<span class="pill ${LV_CLS[e.level]}" title="${esc((e.exp ? e.exp + ' · ' : '') + e.by)} · ${esc(e.text || '')}">${esc(e.exp ? e.exp + ': ' + TR().daily[e.level] : TR().daily[e.level])}</span> <span class="mut small">${agoTxt(e.ts)}</span>` : '<span class="mut small">אין רישום</span>');

function traitLevels(k, lv) {
  return `<div role="list" aria-label="רמות">${cf(k).traits.map((t, i) => { const v = lv[i], unk = v == null; return `<div class="tlv" role="listitem"><span>${esc(t)}</span><span class="pips" aria-hidden="true">${[0, 1, 2].map((n) => `<i class="${!unk && n <= v ? 'on' : ''}"></i>`).join('')}</span><span class="lvl ${unk ? 'mut' : ''}">${unk ? 'לא הוזן' : esc(WORDS[v])}</span></div>`; }).join('')}</div>`;
}
function statList(k, c) {
  return `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px">${cf(k).stats.map((s) => `<div class="kpi" style="padding:8px 12px"><span>${esc(s.l)}</span><b style="font-size:19px">${c.stats[s.k] == null ? '<span class="mut" style="font-size:14px">חסר נתון</span>' : `<bdi>${fmtVal(s, c.stats[s.k])}</bdi> <small class="mut" style="font-size:12px">${esc(s.u)}</small>`}</b></div>`).join('')}</div>`;
}
function navBar(id) {
  const nav = A.ui.nav || [], i = nav.indexOf(id); if (i < 0 || nav.length < 2) return '';
  const nm = (x) => { const c = candOf(corpsKey(), x); return c ? c.name : ''; };
  return `<div class="row spread" style="background:var(--bg2);border-radius:10px;padding:6px 8px"><button class="btn sec sm" data-act="navPrev" aria-label="הקודם">→ ${esc(nm(nav[(i - 1 + nav.length) % nav.length]))}</button><b class="small">${i + 1} מתוך ${nav.length}</b><button class="btn sec sm" data-act="navNext" aria-label="הבא">${esc(nm(nav[(i + 1) % nav.length]))} ←</button></div>`;
}
function navStep(dir) { const nav = A.ui.nav || [], i = nav.indexOf(A.ui.cand); if (i < 0 || nav.length < 2) return; A.ui.cand = nav[(i + dir + nav.length) % nav.length]; A.ui.cf = null; rerender(); }
document.addEventListener('keydown', (e) => {
  if (!A.ui.cand || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
  if (e.key === 'ArrowLeft') navStep(1); else if (e.key === 'ArrowRight') navStep(-1); else if (e.key === 'Escape') { A.ui.cand = null; A.ui.cf = null; rerender(); }
});

// ---- the soldier's file: facts, then one timeline of everything that happened since intake ----
function timeline(k, c) {
  const ev = [{ ts: c.intakeTs, t: 'גיוס למערכת', cls: 'p-blue', by: c.intakeBy, body: `שובץ/ה ל${esc(c.unit || 'יחידה לא נקבעה')}${c.target ? ' · ' + esc(cf(k).targetLabel) + ': ' + esc(c.target) : ''}` }];
  (c.events || []).forEach((e) => ev.push({ ts: e.ts, t: 'אירוע חריג · ' + e.kind, cls: e.kind === TR().eventKinds[0] ? 'p-green' : 'p-red', by: e.by, body: esc(e.text) }));
  (c.daily || []).forEach((e) => ev.push({ ts: e.ts, t: e.exp ? e.exp + (e.title && e.title !== e.exp ? ' – ' + e.title : '') : 'מעקב יומי', cls: LV_CLS[e.level], by: e.by, body: `<b>${esc(TR().daily[e.level])}</b>${e.score != null ? ' · ' + esc(e.score) + (expType(e.exp) && expType(e.exp).score ? ' ' + esc(expType(e.exp).score) : '') : ''}${e.att !== TR().attend[0] ? ' · ' + esc(e.att) : ''}${e.text ? ' – ' + esc(e.text) : ''}` }));
  (c.reviews || []).forEach((r) => ev.push({ ts: r.ts, t: 'סטטוס ' + r.label, cls: r.rec === TR().periodRec[0] ? 'p-green' : (r.rec === TR().periodRec[1] ? 'p-orange' : 'p-red'), by: r.by, body: `<b>${esc(r.rec)}</b> – ${esc(r.summary)}` }));
  (c.dismiss || []).forEach((d) => { ev.push({ ts: d.openedTs, t: 'נפתחה בדיקת הדחה', cls: 'p-red', by: d.openedBy, body: esc(d.reason) }); (d.opinions || []).forEach((o) => ev.push({ ts: o.ts, t: 'נימוק בחדר ההדחה', cls: stanceCls(o.stance), by: o.by, body: `<b>${esc(o.stance)}</b> – ${esc(o.text)}` })); (d.stages || []).forEach((r) => ev.push({ ts: r.ts, t: r.label, cls: r.rec ? stanceCls(r.rec) : outcomeCls(r.outcome), by: r.by, body: `<b>${esc(r.rec ? 'המלצה: ' + r.rec : r.outcome)}</b> – ${esc(r.summary)}` })); if (d.status === 'נסגרה' && !(d.stages || []).length) ev.push({ ts: d.decidedTs, t: 'החלטה בבדיקת הדחה', cls: d.decision === TR().decisions[2] ? 'p-gray' : 'p-green', by: d.decidedBy, body: `<b>${esc(d.decision)}</b>${d.movedTo ? ' · הועבר/ה אוטומטית מ' + esc(d.from) + ' ל' + esc(d.movedTo) + (d.movedTrack ? ' (' + esc(d.movedTrack) + ')' : '') : (d.exitTo ? ' · ' + esc(d.exitTo) : '')} – ${esc(d.note)}` }); });
  if (c.doneTs) ev.push({ ts: c.doneTs, t: 'סיום הכשרה', cls: 'p-blue', by: '', body: '' });
  ev.sort((a, b) => b.ts - a.ts);
  const all = A.ui.tlAll, list = all ? ev : ev.slice(0, 8);
  return list.map((e) => `<div class="tl"><div class="row" style="gap:8px"><span class="pill ${e.cls}">${esc(e.t)}</span><span class="mut small">${fmtD(e.ts)} · ${agoTxt(e.ts)}${e.by ? ' · ' + esc(e.by) : ''}</span></div>${e.body ? `<div style="margin-top:3px">${e.body}</div>` : ''}</div>`).join('') + (ev.length > 8 ? `<button class="btn sec sm" data-act="tlAll" style="margin-top:8px">${all ? 'הצגת האחרונים בלבד' : 'הצגת כל ' + ev.length + ' האירועים'}</button>` : '');
}
function cardForm(k, c) {
  const f = A.ui.cf; if (!f || f.id !== c.id) return '';
  const seg = (field, words, val) => `<div class="seg">${words.map((w, j) => `<button type="button" class="${val === j ? 'on l' + j : ''}" data-act="cfSeg" data-f="${field}" data-v="${j}">${esc(w)}</button>`).join('')}</div>`;
  const sel = (field, opts, val, ph) => `<select data-chg="cfSet" data-f="${field}">${ph ? `<option value="">${ph}</option>` : ''}${opts.map((o) => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  const ta = (field, ph, val) => `<textarea id="cf-${field}" data-inp="cfSet" data-f="${field}" rows="3" placeholder="${ph}" style="width:100%">${esc(val || '')}</textarea>`;
  let body = '', title = '', btn = '';
  if (f.type === 'daily') { const xt = expType(f.exp); title = 'תיעוד התנסות'; btn = 'שמירת ההתנסות'; body = `<label>סוג ההתנסות ${sel('exp', TR().expTypes.map((x) => x.l), f.exp, 'בחרו…')}</label><label>שם ההתנסות<input type="text" id="cf-title" data-inp="cfSet" data-f="title" value="${esc(f.title || '')}" placeholder="לדוגמה: מטווח 50 מ׳" style="width:100%"></label><label>רמה בהתנסות</label>${seg('level', TR().daily, f.level)}${xt && xt.score ? `<label>${esc(xt.score)} <input type="text" inputmode="decimal" id="cf-score" data-inp="cfSet" data-f="score" value="${esc(f.score == null ? '' : f.score)}" placeholder="לא חובה" style="width:110px"></label>` : ''}<label>נוכחות ${sel('att', TR().attend, f.att)}</label>${ta('text', 'משוב קצר (לא חובה)', f.text)}`; }
  if (f.type === 'event') { title = 'תיעוד אירוע חריג'; btn = 'שמירת האירוע'; body = `<label>סוג האירוע</label>${seg('kind', TR().eventKinds, f.kind)}${ta('evtext', 'מה קרה, מתי, ומה נעשה בעקבות זה', f.evtext)}`; }
  if (f.type === 'periodic') {
    const prev = (c.reviews || []).filter((y) => y.period !== A.S.period.key).sort((a, b) => b.ts - a.ts)[0], t1 = (field, label, ph) => `<label>${label}<textarea id="cf-${field}" data-inp="cfSet" data-f="${field}" rows="2" placeholder="${ph}" style="width:100%">${esc(f[field] || '')}</textarea></label>`;
    title = 'סטטוס ' + A.S.period.label; btn = 'שמירת הסטטוס';
    body = `<div class="pctx"><div class="mut small">התנסויות – 4 שבועות אחרונים</div>${trend(c, 300)}${prev ? `<div class="mut small" style="margin-top:6px">${esc(prev.label)} · ${esc(prev.by)}</div><div class="small"><b>${esc(prev.rec)}</b> – ${esc(prev.summary)}</div>` : '<div class="mut small" style="margin-top:6px">אין סטטוס מתקופה קודמת.</div>'}</div>
     <div class="mut small">רמה בכל תחום (לא חובה – תחום שלא סומן נשאר כפי שהיה)</div>${cf(k).traits.map((t, i) => `<div class="row spread" style="padding:4px 0"><span>${esc(t)}</span><div class="seg">${WORDS.map((w, j) => `<button type="button" class="${f.lv[i] === j ? 'on l' + j : ''}" data-act="cfLv" data-i="${i}" data-v="${j}">${w}</button>`).join('')}</div></div>`).join('')}
     ${t1('strong', 'חוזקות', 'מה בלט לטובה בתקופה')}${t1('improve', 'לשיפור', 'מה דורש חיזוק')}${t1('plan', 'המלצה להמשך (חובה)', 'מה עושים בתקופה הבאה')}
     <label>סיכום התקופה ${sel('rec', TR().periodRec, f.rec, 'בחרו…')}</label>${f.rec === TR().periodRec[2] ? '<div class="demo-note">בחירה ב"מועמד/ת להדחה" תפתח בדיקת הדחה.</div>' : ''}`;
  }
  if (f.type === 'open') { title = 'פתיחת בדיקת הדחה'; btn = 'פתיחת הבדיקה'; body = `<div class="demo-note">פתיחת בדיקה אינה הדחה. ההחלטה מתקבלת בנפרד ע״י מפקד/ת ההכשרה, ומתועדת בתיק.</div>${ta('reason', 'מה הסיבה לבדיקה? עובדות ומקרים, לא התרשמות כללית', f.reason)}`; }
  return `<div class="card" style="border:2px solid var(--blue)"><h3 style="margin:0 0 8px">${title}</h3><div style="display:flex;flex-direction:column;gap:10px">${body}<div class="row"><button class="btn" data-act="cfSave">${btn}</button>${f.type === 'periodic' && nextMissing(k, c.id) ? `<button class="btn sec" data-act="cfSaveNext">שמירה ומעבר ל${esc(candOf(k, nextMissing(k, c.id)).name)} ←</button>` : ''}<button class="btn sec" data-act="cfCancel">ביטול</button></div></div></div>`;
}
const canRoom = () => !!A.me && R().pages.includes('dismiss');
function focusRoom(id) { if (!id) return; setTimeout(() => { const el = document.getElementById('room-' + id); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1800); } }, 150); }
function drawer(k, id) {
  const c = candOf(k, id); if (!c) return '';
  const od = openDis(c), act = isActive(c), mine = !teamOnly() || c.group === A.me.group, miss = missingOf(k, c);
  const b = (type, label, cls) => `<button class="btn ${cls || 'sec'} sm" data-act="cfOpen" data-t="${type}">${label}</button>`;
  const actions = !mine || !act ? '' : [can('daily', k) ? b('daily', 'תיעוד התנסות') : '', can('daily', k) ? b('event', 'אירוע חריג') : '', can('periodic', k) ? b('periodic', periodRv(c) ? 'עדכון סטטוס ' + A.S.period.label : 'סטטוס ' + A.S.period.label) : '', !od && can('dismiss', k) && canRoom() ? `<button class="btn sec sm" data-act="goOpen" data-id="${c.id}">פתיחת בדיקת הדחה ←</button>` : (!od && can('dismiss', k) ? b('open', 'פתיחת בדיקת הדחה') : ''), od && canRoom() ? `<button class="btn sm" data-act="goRoom" data-id="${c.id}">לחדר ההדחה ←</button>` : '', !od && can('complete', k) ? '<button class="btn sec sm" data-act="complete">סיום הכשרה</button>' : ''].join('');
  return `<div class="drawer-bg" data-act="closeCand"><aside class="drawer" role="dialog" aria-label="תיק חייל/ת">
   <div class="row spread" style="flex-wrap:nowrap;align-items:flex-start"><div class="row" style="flex:1;flex-wrap:nowrap;gap:14px;align-items:center">${avatar(c, 72)}<div style="flex:1"><div class="small" style="color:var(--orange);font-weight:600">תיק חייל/ת · ${esc(cf(k).corps)}</div><h2 style="margin:0;font-size:24px">${esc(c.name)}</h2><div class="mut small"><bdi>${c.id}</bdi> · ${esc(c.role)} · צוות ${c.group}</div></div></div><button class="btn sec sm" data-act="closeCand">סגירה ✕</button></div>
   ${navBar(id)}
   <div class="row">${stPill(c)}<span class="pill p-gray">${esc(c.unit || 'יחידה לא נקבעה')}</span><span class="pill p-violet">${esc(cf(k).targetLabel)}: ${esc(c.target || 'לא נקבע')}</span>${c.exitTo ? `<span class="pill p-gray">יצא/ה ל${esc(c.exitTo)}</span>` : ''}${(c.transfers || []).length ? `<span class="pill p-orange">הועבר/ה מ${esc(c.transfers[c.transfers.length - 1].from)}${c.prevIds ? ' · מס׳ קודם ' + esc(c.prevIds[c.prevIds.length - 1]) : ''}</span>` : ''}</div>
   ${od ? `<div class="demo-note ${canRoom() ? 'clk' : ''}" style="border-color:var(--red)" ${canRoom() ? `data-act="goRoom" data-id="${c.id}" title="מעבר לחדר ההדחה"` : ''}><b>בדיקת הדחה פתוחה</b>${canRoom() ? ' · <u>לחדר ההדחה ←</u>' : ''} · ${esc(od.openedBy)} · ${fmtD(od.openedTs)}<div>${esc(od.reason)}</div><div style="margin-top:4px">${stagePill(od)}</div></div>` : ''}
   ${miss.length ? `<div class="demo-note">חסר בתיק: ${esc(miss.join(', '))}</div>` : ''}
   ${actions ? `<div class="row no-print">${actions}</div>` : ''}${cardForm(k, c)}
   <div class="card"><h3 style="margin:0 0 6px">התנסויות – 4 שבועות אחרונים</h3>${trend(c, 320)}</div>
   <div class="card"><h3 style="margin:0 0 6px">ציר זמן</h3>${timeline(k, c)}</div>
   <div class="card"><h3 style="margin:0 0 6px">מדדים</h3>${statList(k, c)}</div>
   <div class="card"><h3 style="margin:0 0 6px">רמות לפי תחום</h3>${traitLevels(k, c.lv)}</div>
   <div class="card"><h3 style="margin:0 0 6px">סיכום המגבש/ת מהגיבוש</h3><div>${recPill(c.rec)}</div><p style="margin:6px 0">${esc(c.obs) || '<span class="mut">המגבש/ת עוד לא כתב/ה סיכום.</span>'}</p>${c.summary ? `<p class="mut" style="margin:0">${esc(c.summary)}</p>` : ''}</div>
   </aside></div>`;
}
Object.assign(ACTIONS, {
  openCand: (d) => { const f = (A.ui.list || []); A.ui.nav = f.includes(d.id) ? f : [d.id]; A.ui.cf = null; A.ui.tlAll = false; A.ui.cand = d.id; rerender(); },
  cand: (d) => ACTIONS.openCand(d),
  navPrev: () => navStep(-1), navNext: () => navStep(1),
  closeCand: () => { A.ui.cand = null; A.ui.cf = null; rerender(); },
  // straight to the dismissal room, scrolled to this soldier (or to the "open a review" form when none is open yet)
  goRoom: (d, t, e) => { if (e) e.stopPropagation(); A.ui.cand = null; A.ui.cf = null; go('dismiss'); focusRoom(d && d.id); },
  goOpen: (d, t, e) => { if (e) e.stopPropagation(); A.ui.cand = null; A.ui.cf = null; A.ui.openFor = d.id; A.ui.openReason = ''; go('dismiss'); focusRoom('open'); },
  tlAll: () => { A.ui.tlAll = !A.ui.tlAll; rerender(); },
  cfOpen: (d) => { const k = corpsKey(), c = candOf(k, A.ui.cand), m = myToday(c), r = periodRv(c); A.ui.cf = { type: d.t, id: c.id, sid: newSid(), exp: '', title: '', score: null, kind: null, evtext: '', level: null, att: arriveToday(c) || TR().attend[0], text: '', lv: r ? r.lv.slice() : c.lv.map(() => null), rec: r ? r.rec : '', summary: r ? r.summary : '', strong: r && r.parts ? r.parts.strong : '', improve: r && r.parts ? r.parts.improve : '', plan: r ? (r.parts ? r.parts.plan : r.summary) : '', reason: '', decision: '', note: '' }; rerender(); },
  cfCancel: () => { A.ui.cf = null; rerender(); },
  cfSet: (d, t) => { if (A.ui.cf) { A.ui.cf[d.f] = t.value; if (t.tagName === 'SELECT') rerender(); } },
  cfSeg: (d) => { A.ui.cf[d.f] = +d.v; rerender(); },
  cfLv: (d) => { const f = A.ui.cf; f.lv[+d.i] = f.lv[+d.i] === +d.v ? null : +d.v; rerender(); },
  cfSaveNext: () => ACTIONS.cfSave(null, null, null, true),
  cfSave: async (d0, t0, e0, goNext) => {
    const k = corpsKey(), f = A.ui.cf, c = candOf(k, f.id);
    try {
      if (f.type === 'daily') { if (!f.exp) { toast('בחרו סוג התנסות', true); return; } if (f.level == null) { toast('בחרו רמה בהתנסות', true); return; } await api('daily', { corps: k, exp: f.exp, title: f.title || f.exp, sid: f.sid, rows: [{ id: f.id, level: f.level, att: f.att, text: f.text, score: f.score }] }); toast('ההתנסות תועדה בתיק'); }
      if (f.type === 'event') { if (f.kind == null) { toast('בחרו סוג אירוע', true); return; } await api('event', { corps: k, id: f.id, kind: TR().eventKinds[f.kind], text: f.evtext }); toast('האירוע החריג תועד בתיק'); }
      if (f.type === 'periodic') { const r = await api('periodic', { corps: k, id: f.id, lv: f.lv, rec: f.rec, strong: f.strong, improve: f.improve, plan: f.plan }); toast(r.opened ? 'הסטטוס נשמר ונפתחה בדיקת הדחה' : 'הסטטוס נשמר'); const nx = goNext && nextMissing(k, f.id); if (nx) { A.ui.cand = nx; A.ui.cf = null; ACTIONS.cfOpen({ t: 'periodic' }); return; } if (goNext) toast('הוזן סטטוס לכל הרשימה'); }
      if (f.type === 'open') { await api('dismiss-open', { corps: k, id: f.id, reason: f.reason }); toast('נפתחה בדיקת הדחה ל' + c.name); }
      A.ui.cf = null; rerender();
    } catch (x) { /* toast shown */ }
  },
  complete: async () => { const k = corpsKey(), c = candOf(k, A.ui.cand); if (!(await ask({ title: 'לסמן סיום הכשרה ל' + c.name + '?', body: 'אחרי הסימון אי אפשר לתעד התנסויות, סטטוס או בדיקת הדחה.', ok: 'סימון סיום', cancel: 'חזרה' }))) return; try { await api('complete', { corps: k, id: c.id }); toast('סומן סיום הכשרה'); } catch (x) { /* toast shown */ } },
});

// ---- dashboard ----
function attention(k) { // who needs a look, and why (transparent rules, no score)
  const out = [];
  visible(k).filter(isActive).forEach((c) => {
    const od = openDis(c), ld = lastDaily(c), why = [];
    if (od) why.push('בדיקת הדחה פתוחה ' + agoTxt(od.openedTs));
    else if (c.tstatus === 'במעקב') why.push('במעקב');
    const low = (c.daily || []).filter((e) => daysAgo(e.ts) <= 14 && e.level === 0).length; if (low >= 2) why.push(low + ' התנסויות "מתקשה" בשבועיים האחרונים');
    if (!ld) why.push('לא תועדו התנסויות'); else if (daysAgo(ld.ts) >= 10) why.push('לא תועדה התנסות ' + daysAgo(ld.ts) + ' ימים');
    if ((c.events || []).some((e) => e.kind === TR().eventKinds[1] && daysAgo(e.ts) <= 14)) why.push('אירוע חריג בשבועיים האחרונים');
    if (!periodRv(c)) why.push('חסר סטטוס ' + A.S.period.label);
    if (why.length) out.push({ c, why, w: (od ? 100 : 0) + (c.tstatus === 'במעקב' ? 50 : 0) + low * 10 + why.length });
  });
  return out.sort((a, b) => b.w - a.w);
}
SCREENS.dash = (k) => {
  const c = cf(k), all = cs(k).cands, act = all.filter(isActive), n = (s) => all.filter((x) => x.tstatus === s).length;
  const today = act.filter(recentExp).length, per = act.filter(periodRv).length, names = canFile(), att = names ? attention(k) : [];
  const kpi = (v, l, sub) => `<div class="kpi"><b>${v}</b><span>${l}</span>${sub ? `<div class="mut small">${sub}</div>` : ''}</div>`;
  const byUnit = c.units.map((u) => { const g = all.filter((x) => x.unit === u.name), a = g.filter(isActive); return `<tr><td><b>${esc(u.name)}</b><div class="mut small">${esc(u.desc)}</div></td><td>${a.length}</td><td>${g.filter((x) => x.tstatus === 'במעקב').length || '·'}</td><td>${g.filter((x) => x.tstatus === 'בבדיקת הדחה').length || '·'}</td><td>${g.filter((x) => x.tstatus === 'הודח/ה').length || '·'}</td><td>${g.filter((x) => x.tstatus === 'סיים/ה הכשרה').length || '·'}</td><td>${a.filter(recentExp).length} / ${a.length}</td><td>${a.filter(periodRv).length} / ${a.length}</td></tr>`; }).join('');
  return `<div class="row spread"><div>${corpsSwitcher()}<h1 style="font-size:28px;font-weight:800;margin-top:6px">תמונת מצב – ${esc(c.label)}</h1><div class="mut small">חיילים בהכשרה שמועמדים ליחידה מיוחדת · ${fmtD(nowS())} · ${esc(A.S.period.label)}</div></div></div>
   <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${kpi(act.length, 'בהכשרה כעת', 'מתוך ' + all.length + ' שגויסו')}${kpi(n('במעקב'), 'במעקב')}${kpi(n('בבדיקת הדחה'), 'בבדיקת הדחה')}${kpi(n('הודח/ה'), 'הודחו', TR().exitTo)}${kpi(n('סיים/ה הכשרה'), 'סיימו הכשרה')}</div>
   <div class="grid g2"><div class="card"><h2>התנסויות – 7 ימים אחרונים</h2><div class="row"><div class="bar"><i style="width:${act.length ? today / act.length * 100 : 0}%"></i></div><b>${today} / ${act.length}</b></div><div class="mut small" style="margin-top:6px">חיילים פעילים שתועדה להם התנסות בשבוע האחרון</div></div>
    <div class="card"><h2>סטטוס ${esc(A.S.period.label)}</h2><div class="row"><div class="bar"><i style="width:${act.length ? per / act.length * 100 : 0}%;background:var(--blue)"></i></div><b>${per} / ${act.length}</b></div><div class="mut small" style="margin-top:6px">חיילים פעילים שהוזן להם סטטוס לתקופה הנוכחית</div></div></div>
   <div class="card"><h2>לפי יחידה</h2><div style="overflow:auto"><table><thead><tr><th>יחידה</th><th>בהכשרה</th><th>במעקב</th><th>בבדיקת הדחה</th><th>יצאו</th><th>סיימו</th><th>התנסות ב-7 ימים</th><th>סטטוס תקופתי</th></tr></thead><tbody>${byUnit}</tbody></table></div></div>
   ${names ? `<div class="card"><h2>דורשים תשומת לב (${att.length})</h2><div class="mut small" style="margin-bottom:8px">לפי כללים גלויים: בדיקת הדחה פתוחה, מעקב, שתי התנסויות "מתקשה" בשבועיים, אירוע חריג, 10 ימים בלי תיעוד, או חסר סטטוס תקופתי. אין כאן ציון ואין המלצה.</div>${att.slice(0, 12).map((a) => `<div class="row spread" style="padding:7px 0;border-bottom:1px solid var(--line2)"><span class="row" style="gap:8px;flex-wrap:nowrap">${avatar(a.c, 32)}<span><b>${candLink(k, a.c.id, a.c.name)}</b> <span class="mut small">${esc(a.c.unit)} · צוות ${a.c.group}</span></span></span><span class="row" style="gap:6px;justify-content:flex-end">${a.why.map((w) => `<span class="pill ${/הדחה/.test(w) ? 'p-red' : 'p-orange'}">${esc(w)}</span>`).join('')}</span></div>`).join('') || '<span class="mut">אין כרגע חיילים שדורשים תשומת לב לפי הכללים.</span>'}${att.length > 12 ? `<div class="mut small" style="margin-top:6px">ועוד ${att.length - 12} – ברשימת החיילים</div>` : ''}</div>` : '<div class="demo-note">התפקיד שלך רואה מספרים מסכמים בלבד, ללא שמות ותיקים.</div>'}`;
};

// ---- "my day" for the team's evaluator: everything that waits for me, on one screen ----
SCREENS.today = (k) => {
  const team = visible(k), act = team.filter(isActive), wk = act.filter(recentExp), noRec = act.filter((x) => !recentExp(x)), mine = myExps(k).filter((g) => daysAgo(g.ts) <= 7);
  const room = team.filter((x) => { const d = openDis(x); return d && canStage(dueStage(d), x); }), inRoom = team.filter(openDis);
  const miss = team.filter((x) => isActive(x) && missingOf(k, x).length), att = attention(k).filter((a) => !/התנסו/.test(a.why.join(' ')) || a.why.length > 1).slice(0, 6);
  const step = (n, title, count, body, ok) => `<div class="card"><div class="row spread"><h2 style="margin:0">${n}. ${title}</h2><span class="pill ${ok ? 'p-green' : 'p-orange'}">${ok ? 'הושלם' : count}</span></div>${body}</div>`;
  return `<div class="row spread"><div><h1 style="font-size:28px;font-weight:800;margin:0">היום שלי – צוות ${A.me.group}</h1><div class="mut small">${fmtD(nowS())} · ${esc(cf(k).label)} · כל מה שמחכה לך, במסך אחד</div></div><div class="row"><b style="font-size:22px">${wk.length} / ${act.length}</b><span class="mut small">עם התנסות מתועדת השבוע</span></div></div>
   ${step(1, 'התנסויות', noRec.length + ' בלי תיעוד השבוע', `<div class="row" style="margin:8px 0"><a class="btn" href="#/daily">תיעוד התנסות חדשה</a><span class="mut small">כל הצוות במסך אחד, בלחיצה לכל חייל/ת</span></div>${mine.length ? mine.map((g) => `<div class="tl row spread"><span><b>${esc(g.exp || 'התנסות')}</b>${g.title && g.title !== g.exp ? ' – ' + esc(g.title) : ''}</span><span class="mut small">${fmtD(g.ts)} · ${g.n} חיילים</span></div>`).join('') : '<div class="mut small">עוד לא תיעדת התנסויות השבוע.</div>'}${noRec.length ? `<div class="mut small" style="margin-top:8px">בלי התנסות מתועדת ב-7 הימים האחרונים: ${noRec.map((x) => candLink(k, x.id, x.name)).join(', ')}</div>` : ''}`, !noRec.length)}
   ${step(2, 'חדר הדחה', room.length + ' ממתינים לתיעוד שלך', inRoom.length ? `${inRoom.map((x) => { const d = openDis(x), mine = canStage(dueStage(d), x); return `<div class="tl row spread"><span><b>${candLink(k, x.id, x.name)}</b> <span class="mut small">נפתחה ${agoTxt(d.openedTs)} · ${esc(stageTxt(d))}</span></span><span class="row" style="gap:6px">${mine ? '<span class="pill p-orange">ממתין לתיעוד שלך</span>' : '<span class="pill p-gray">בטיפול</span>'}</span></div>`; }).join('')}<div class="row" style="margin-top:8px"><a class="btn sec sm" href="#/dismiss">לחדר ההדחה</a></div>` : '<div class="mut" style="margin-top:6px">אין חיילים מהצוות בחדר ההדחה.</div>', !room.length)}
   ${step(3, 'דף מגבש', miss.length + ' תיקים עם נתונים חסרים', miss.length ? `${miss.slice(0, 6).map((x) => `<div class="tl row spread"><b>${candLink(k, x.id, x.name)}</b><span class="mut small">חסר: ${esc(missingOf(k, x).join(', '))}</span></div>`).join('')}<div class="row" style="margin-top:8px"><a class="btn sec sm" href="#/eval">לדף המגבש</a></div>` : '<div class="mut" style="margin-top:6px">כל התיקים של הצוות מלאים.</div>', !miss.length)}
   <div class="card"><h2>שווה מבט</h2><div class="mut small" style="margin-bottom:6px">חיילים מהצוות שעולים לפי הכללים הגלויים של תמונת המצב. אין כאן ציון.</div>${att.map((a) => `<div class="tl row spread"><b>${candLink(k, a.c.id, a.c.name)}</b><span class="row" style="gap:6px;justify-content:flex-end">${a.why.map((w) => `<span class="pill ${/הדחה/.test(w) ? 'p-red' : 'p-orange'}">${esc(w)}</span>`).join('')}</span></div>`).join('') || '<span class="mut">אין כרגע חיילים שדורשים תשומת לב מיוחדת.</span>'}</div>`;
};

// ---- automatic weekly summary for the training commander: this week against the week before, by stated rules ----
function weekly(k, unit) {
  const list = cs(k).cands.filter((x) => !unit || x.unit === unit), act = list.filter(isActive), W = (x, a, b) => (x.daily || []).filter((e) => { const d = daysAgo(e.ts); return d >= a && d <= b; });
  const avg = (es) => (es.length ? es.reduce((s, e) => s + e.level, 0) / es.length : null), rows = act.map((x) => { const a = W(x, 0, 6), b = W(x, 7, 13); return { x, a, b, av: avg(a), bv: avg(b), low: a.filter((e) => e.level === 0).length }; });
  const cmp = rows.filter((r) => r.a.length >= 2 && r.b.length >= 2), inWeek = (ts) => ts != null && daysAgo(ts) <= 6;
  const ev = { opened: [], decided: [], moved: [], intake: [], done: [], status: 0 };
  list.forEach((x) => { (x.dismiss || []).forEach((d) => { if (inWeek(d.openedTs)) ev.opened.push(x); if (d.status === 'נסגרה' && inWeek(d.decidedTs)) ev.decided.push({ x, d }); }); (x.transfers || []).forEach((t) => { if (inWeek(t.ts)) ev.moved.push({ x, t }); }); if (inWeek(x.intakeTs)) ev.intake.push(x); if (inWeek(x.doneTs)) ev.done.push(x); ev.status += (x.reviews || []).filter((r) => inWeek(r.ts)).length; });
  return { act, entries: rows.reduce((s, r) => s + r.a.length, 0), covered: rows.filter((r) => r.a.length).length, down: cmp.filter((r) => r.av <= r.bv - 0.5).sort((p, q) => (p.av - p.bv) - (q.av - q.bv)), up: cmp.filter((r) => r.av >= r.bv + 0.5).sort((p, q) => (q.av - q.bv) - (p.av - p.bv)), none: rows.filter((r) => !r.a.length), low: rows.filter((r) => r.low >= 2).sort((p, q) => q.low - p.low), compared: cmp.length, ev, missP: act.filter((x) => !periodRv(x)).length, inRoom: act.filter(openDis) };
}
const f1w = (v) => (v + 1).toFixed(1);
function weeklyText(k, unit) {
  const w = weekly(k, unit), L = [], nm = (a) => a.map((r) => (r.x || r).name).join(', ') || 'אין';
  L.push('סיכום שבועי – ' + cf(k).label + (unit ? ' · ' + unit : '') + ' · ' + fmtD(nowS() - 6 * 86400e3) + '–' + fmtD(nowS()));
  L.push('בהכשרה: ' + w.act.length + ' · רישומי מעקב השבוע: ' + w.entries + ' · חיילים עם רישום: ' + w.covered + ' מתוך ' + w.act.length);
  L.push('ירדו לעומת השבוע הקודם (' + w.down.length + '): ' + (w.down.map((r) => r.x.name + ' ' + f1w(r.bv) + '→' + f1w(r.av)).join(', ') || 'אין'));
  L.push('עלו לעומת השבוע הקודם (' + w.up.length + '): ' + (w.up.map((r) => r.x.name + ' ' + f1w(r.bv) + '→' + f1w(r.av)).join(', ') || 'אין'));
  L.push('שתי התנסויות "מתקשה" ומעלה (' + w.low.length + '): ' + nm(w.low));
  L.push('בלי התנסות מתועדת השבוע (' + w.none.length + '): ' + nm(w.none));
  L.push('חדר הדחה: ' + w.inRoom.length + ' פתוחות · נפתחו השבוע ' + w.ev.opened.length + ' · הוחלטו ' + w.ev.decided.length + (w.ev.decided.length ? ' (' + w.ev.decided.map((e) => e.x.name + ': ' + e.d.decision).join(', ') + ')' : ''));
  L.push('גויסו השבוע: ' + w.ev.intake.length + ' · הועברו יחידה: ' + w.ev.moved.length + ' · סיימו הכשרה: ' + w.ev.done.length);
  L.push('סטטוס ' + A.S.period.label + ': חסרים ' + w.missP + ' · נותרו ' + A.S.period.daysLeft + ' ימים');
  return L.join('\n');
}
SCREENS.weekly = (k) => {
  const c = cf(k), unit = c.units.some((u) => u.name === A.ui.wUnit) ? A.ui.wUnit : '', w = weekly(k, unit);
  const names = (rows, fn, empty) => rows.map((r) => `<div class="tl row spread"><b>${candLink(k, (r.x || r).id, (r.x || r).name)}</b><span class="mut small">${fn(r)}</span></div>`).join('') || `<span class="mut">${empty}</span>`;
  const kpi = (v, l, sub) => `<div class="kpi"><b>${v}</b><span>${l}</span>${sub ? `<div class="mut small">${sub}</div>` : ''}</div>`;
  return `<div class="row spread"><div>${corpsSwitcher()}<h1 style="font-size:28px;font-weight:800;margin-top:6px">סיכום שבועי – ${esc(c.label)}</h1><div class="mut small">${fmtD(nowS() - 6 * 86400e3)}–${fmtD(nowS())} · נוצר אוטומטית מהמעקב היומי, מהסטטוסים ומחדר ההדחה</div></div>
    <div class="row no-print"><label>יחידה<select data-chg="wUnit"><option value="">כל היחידות</option>${c.units.map((u) => `<option ${u.name === unit ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label><button class="btn" data-act="wCopy">העתקה כטקסט</button><button class="btn sec" data-act="expPrint">הדפסה / PDF</button></div></div>
   <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">${kpi(w.act.length, 'בהכשרה')}${kpi(w.covered + ' / ' + w.act.length, 'חיילים עם רישום השבוע', w.entries + ' רישומים')}${kpi(w.down.length, 'ירדו')}${kpi(w.up.length, 'עלו')}${kpi(w.inRoom.length, 'בחדר ההדחה')}</div>
   <div class="demo-note">איך זה מחושב: "ירד" / "עלה" = הפרש של חצי רמה ומעלה בין ממוצע 7 הימים האחרונים לממוצע 7 הימים שלפניהם, ורק לחייל/ת עם שני רישומים לפחות בכל שבוע (${w.compared} מתוך ${w.act.length}). מי שאין לו/לה מספיק רישומים לא מופיע/ה בהשוואה. זה סיכום של מה שנרשם, לא הערכה של החייל/ת.</div>
   <div class="grid g2"><div class="card"><h2>ירדו לעומת השבוע הקודם (${w.down.length})</h2>${names(w.down, (r) => 'ממוצע ' + f1w(r.bv) + ' ← ' + f1w(r.av) + ' · ' + r.a.length + ' רישומים', 'אף חייל/ת לא ירד/ה השבוע לפי הכלל.')}</div>
    <div class="card"><h2>עלו לעומת השבוע הקודם (${w.up.length})</h2>${names(w.up, (r) => 'ממוצע ' + f1w(r.bv) + ' ← ' + f1w(r.av) + ' · ' + r.a.length + ' רישומים', 'אף חייל/ת לא עלה/תה השבוע לפי הכלל.')}</div></div>
   <div class="grid g2"><div class="card"><h2>שתי התנסויות "מתקשה" ומעלה (${w.low.length})</h2>${names(w.low, (r) => r.low + ' מתוך ' + r.a.length + ' התנסויות', 'לאף חייל/ת אין שתי התנסויות "מתקשה" השבוע.')}</div>
    <div class="card"><h2>בלי התנסות מתועדת השבוע (${w.none.length})</h2><div class="mut small" style="margin-bottom:4px">אין מידע עליהם – לא "תקין".</div>${names(w.none.slice(0, 12), (r) => esc(r.x.unit) + ' · צוות ' + r.x.group, 'לכל החיילים הפעילים יש רישום השבוע.')}${w.none.length > 12 ? `<div class="mut small">ועוד ${w.none.length - 12}</div>` : ''}</div></div>
   <div class="card"><h2>אירועים השבוע</h2><div class="row" style="gap:8px">${[['נפתחו בדיקות הדחה', w.ev.opened.length], ['הוחלטו בדיקות', w.ev.decided.length], ['הועברו יחידה', w.ev.moved.length], ['גויסו', w.ev.intake.length], ['סיימו הכשרה', w.ev.done.length], ['סטטוסים תקופתיים הוזנו', w.ev.status]].map(([l, n]) => `<span class="pill ${n ? 'p-blue' : 'p-gray'}">${l}: ${n}</span>`).join('')}</div>
    ${w.ev.decided.map((e) => `<div class="tl"><b>${candLink(k, e.x.id, e.x.name)}</b> – ${esc(e.d.decision)}${e.d.movedTo ? ' · עבר/ה ל' + esc(e.d.movedTo) : ''} <span class="mut small">${esc(e.d.decidedBy)}</span></div>`).join('')}${w.ev.opened.map((x) => `<div class="tl"><b>${candLink(k, x.id, x.name)}</b> – נפתחה בדיקת הדחה</div>`).join('')}
    <div class="mut small" style="margin-top:8px">סטטוס ${esc(A.S.period.label)}: חסרים ${w.missP} · נותרו ${A.S.period.daysLeft} ימים.</div></div>`;
};
Object.assign(ACTIONS, {
  wUnit: (d, t) => { A.ui.wUnit = t.value; rerender(); },
  wCopy: async () => { const txt = weeklyText(corpsKey(), A.ui.wUnit || ''); auditEvent('export', 'weekly summary text'); try { await navigator.clipboard.writeText(txt); toast('הסיכום הועתק'); } catch (e) { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('הסיכום הועתק'); } catch (x) { toast('לא ניתן להעתיק מהדפדפן הזה', true); } ta.remove(); } },
});

// ---- roster ----
// filters: free text + one select per sub-topic (unit, role, target track, team, status, periodic status, arrival today, missing data)
const arriveToday = (x) => (x.arrive && x.arrive.d === A.S.today ? x.arrive.v : '');
const RF = (k) => { const c = cf(k); return [
  ['unit', 'יחידה', c.units.map((u) => u.name), (x) => x.unit],
  ['role', 'תפקיד', c.roles, (x) => x.role],
  ['target', c.targetLabel, A.cfg.TARGETS[k], (x) => x.target],
  ['team', 'צוות', teamList().map(String), (x) => String(x.group)],
  ['st', 'סטטוס', ['פעילים'].concat(TR().statuses), (x, v) => (v === 'פעילים' ? isActive(x) : x.tstatus === v)],
  ['per', 'סטטוס ' + A.S.period.label, ['הוזן', 'חסר'].concat(TR().periodRec), (x, v) => { const r = periodRv(x); return v === 'הוזן' ? !!r : (v === 'חסר' ? !r && isActive(x) : !!r && r.rec === v); }],
  ['arr', 'הגעה היום', TR().attend.concat(['לא עודכן']), (x, v) => (v === 'לא עודכן' ? !arriveToday(x) : arriveToday(x) === v)],
  ['miss', 'נתונים בתיק', ['חסר מידע', 'מלא'], (x, v) => (missingOf(k, x).length ? 'חסר מידע' : 'מלא') === v],
]; };
function rosterList(k) {
  const f = A.ui.rf || {}, q = (f.q || '').trim().toLowerCase(), fs = RF(k);
  return visible(k).filter((x) => (!q || (x.name + ' ' + x.id).toLowerCase().includes(q)) && fs.every(([key, , , get]) => { const v = f[key]; if (!v) return true; return get.length > 1 ? get(x, v) : String(get(x) || '') === v; }));
}
// one row per soldier, with every field that is useful for pulling data into other systems
function rosterAoa(k, rows) {
  const c = cf(k);
  return [['מס׳', 'שם', 'תפקיד', 'יחידה', c.targetLabel, 'צוות', 'סטטוס', 'תאריך גיוס', 'הגעה היום', 'התנסות אחרונה', 'רמה בהתנסות האחרונה', 'תאריך התנסות אחרונה', 'אירועים חריגים', 'סטטוס ' + A.S.period.label, 'המלצת מגבש']
    .concat(c.stats.map((s) => s.l + ' (' + s.u + ')'), c.traits.map((t) => 'רמה: ' + t), ['חסר בתיק', 'בדיקת הדחה פתוחה', 'מקור'])]
    .concat(rows.map((x) => { const l = lastDaily(x), r = periodRv(x), od = openDis(x), m = missingOf(k, x);
      return [x.id, x.name, x.role, x.unit || '', x.target || '', x.group, x.tstatus, x.intakeTs ? fmtD(x.intakeTs) : '', arriveToday(x), l ? (l.exp || 'מעקב יומי') + (l.title && l.title !== l.exp ? ' – ' + l.title : '') : '', l ? TR().daily[l.level] : '', l ? fmtD(l.ts) : '', (x.events || []).length || '', r ? r.rec : (isActive(x) ? 'חסר' : ''), x.rec || '']
        .concat(c.stats.map((s) => cellVal(s, x.stats[s.k])), c.traits.map((t, i) => (x.lv[i] == null ? '' : WORDS[x.lv[i]])), [m.join(', '), od ? 'כן' : '', x.source || '']); }));
}
SCREENS.roster = (k) => {
  const c = cf(k), f = A.ui.rf || {}, rows = rosterList(k), fs = RF(k), nf = fs.filter(([key]) => f[key]).length + (f.q ? 1 : 0); A.ui.list = rows.map((x) => x.id);
  const sel = ([key, label, opts]) => (key === 'team' && teamOnly() ? '' : `<label>${esc(label)}<select data-chg="rf" data-f="${key}" class="${f[key] ? 'on' : ''}"><option value="">הכול</option>${opts.map((o) => `<option ${String(o) === String(f[key] || '') ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`);
  const st = (x) => (openDis(x) && canRoom() ? `<span class="pill ${ST_CLS[x.tstatus] || 'p-gray'} linkpill" data-act="goRoom" data-id="${x.id}" title="מעבר לחדר ההדחה">${esc(x.tstatus)} ←</span>` : stPill(x));
  return `<div class="row spread"><div>${corpsSwitcher()}<h1 style="font-size:28px;font-weight:800;margin-top:6px">חיילים בהכשרה – ${esc(c.label)}</h1><div class="mut small">${rows.length} מתוך ${visible(k).length} · לחיצה על שורה פותחת את התיק</div></div>
    <div class="row no-print"><button class="btn" data-act="rosterXlsx" ${rows.length ? '' : 'disabled'}>${icon('file', 17)} ייצוא לאקסל (${rows.length})</button></div></div>
   <div class="card"><div class="filters"><label>חיפוש לפי שם / מספר<input type="search" id="rf-q" data-inp="rfq" value="${esc(f.q || '')}" placeholder="לדוגמה: כהן או C-2101" autocomplete="off" style="min-width:200px"></label>${fs.map(sel).join('')}${nf ? `<button class="btn sec sm" data-act="rfClear" style="align-self:flex-end">ניקוי ${nf} מסננים</button>` : ''}</div>
   <div class="mut small" style="margin:-4px 0 8px">הייצוא כולל רק את השורות שמוצגות לפי הסינון, עם כל המדדים, הרמות והסטטוסים.</div>
   <div style="overflow:auto"><table class="ctbl"><thead><tr><th>חייל/ת</th><th>תפקיד</th><th>יחידה</th><th>${esc(c.targetLabel)}</th><th>צוות</th><th>סטטוס</th><th>הגעה היום</th><th>התנסות אחרונה</th><th>${esc(A.S.period.label)}</th></tr></thead><tbody>${rows.map((x) => { const r = periodRv(x), av = arriveToday(x); return `<tr class="clk" data-act="cand" data-id="${x.id}"><td><span class="row" style="gap:10px;flex-wrap:nowrap">${avatar(x, 40)}<span style="white-space:nowrap"><b>${candLink(k, x.id, x.name)}</b> <bdi class="mut small" style="display:block">${x.id}</bdi></span></span></td><td>${esc(x.role)}</td><td>${esc(x.unit || '—')}</td><td>${esc(x.target || '—')}</td><td>${x.group}</td><td>${st(x)}</td><td>${!isActive(x) ? '<span class="mut">—</span>' : (av ? `<span class="pill ${av === TR().attend[0] ? 'p-green' : 'p-orange'}">${esc(av)}</span>` : '<span class="mut small">לא עודכן</span>')}</td><td>${isActive(x) ? dailyPill(lastDaily(x)) : '<span class="mut">—</span>'}</td><td>${!isActive(x) ? '<span class="mut">—</span>' : (r ? `<span class="pill p-green">${esc(r.rec)}</span>` : '<span class="pill p-orange">חסר</span>')}</td></tr>`; }).join('') || '<tr><td colspan="9" class="mut">אין חיילים שמתאימים לסינון. נסו להסיר מסנן.</td></tr>'}</tbody></table></div></div>`;
};
Object.assign(ACTIONS, {
  rf: (d, t) => { A.ui.rf = Object.assign({}, A.ui.rf, { [d.f]: t.type === 'checkbox' ? t.checked : t.value }); rerender(); },
  rfq: (d, t) => { A.ui.rf = Object.assign({}, A.ui.rf, { q: t.value }); rerender(); },
  rfClear: () => { A.ui.rf = {}; rerender(); },
  rosterXlsx: () => { const k = corpsKey(), rows = rosterList(k), name = 'soldiers-' + k + '-' + A.S.today + '.xlsx'; auditEvent('export', 'roster xlsx ' + rows.length); downloadBook(name, [['חיילים בהכשרה', rosterAoa(k, rows)]]); toast(name + ' הורד (' + rows.length + ' חיילים)'); },
});

// ---- daily follow-up: quick entry for a whole team ----
// ---- experiences (התנסויות): one screen per experience for the whole team, built for the phone in the field ----
// The working copy is kept on the device while it is being filled in, so a lost connection or a closed tab loses nothing.
const EXK = () => 'mil-exp-' + (A.me ? A.me.id : '');
const newSid = () => (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).slice(0, 20);
const expType = (l) => TR().expTypes.find((x) => x.l === l);
function exState() {
  if (!A.ui.ex) { let d = null; try { d = JSON.parse(localStorage.getItem(EXK())); } catch (e) { /* none */ } A.ui.ex = d && d.sid ? d : { sid: newSid(), type: '', title: '', rows: {} }; }
  return A.ui.ex;
}
function exPersist() { try { const x = A.ui.ex; if (x && Object.keys(x.rows).some((id) => x.rows[id].level != null)) localStorage.setItem(EXK(), JSON.stringify(x)); else localStorage.removeItem(EXK()); } catch (e) { /* storage unavailable */ } }
function dailyRows(k) { const f = A.ui.df || {}; return visible(k).filter(isActive).filter((x) => (!f.unit || x.unit === f.unit) && (!f.team || x.group === +f.team)); }
// my recent experiences (grouped by sid), newest first – they can be reopened and corrected
function myExps(k) {
  const m = {}; visible(k).forEach((x) => (x.daily || []).forEach((e) => { if (e.sid && e.byId === A.me.id && daysAgo(e.ts) <= 21) { const g = m[e.sid] || (m[e.sid] = { sid: e.sid, exp: e.exp || '', title: e.title || '', ts: e.ts, n: 0 }); g.n++; } }));
  return Object.values(m).sort((a, b) => b.ts - a.ts);
}
SCREENS.daily = (k) => {
  const c = cf(k), f = A.ui.df || {}, rows = dailyRows(k), ex = exState(), ev = teamOnly(), t = expType(ex.type); A.ui.list = rows.map((x) => x.id);
  const marked = rows.filter((x) => ex.rows[x.id] && ex.rows[x.id].level != null).length, P = TR().phrases;
  const sel = (key, label, opts, val) => `<label>${label}<select data-chg="dfSet" data-f="${key}"><option value="">הכול</option>${opts.map((o) => `<option ${String(o) === String(val || '') ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
  const chip = (x, r, ph, cls) => { const on = (r.text || '').includes(ph); return `<button type="button" class="phr ${cls} ${on ? 'on' : ''}" data-act="exPh" data-id="${x.id}" data-v="${esc(ph)}">${esc(ph)}</button>`; };
  const card = (x) => { const r = ex.rows[x.id] || {}, prev = lastDaily(x);
    return `<div class="excard ${r.level != null ? 'set' : ''}"><div class="row spread" style="flex-wrap:nowrap"><span class="row" style="gap:8px;flex-wrap:nowrap">${avatar(x, 38)}<span><b>${candLink(k, x.id, x.name)}</b><span class="mut small" style="display:block">${ev ? '' : esc(x.unit) + ' · צוות ' + x.group + ' · '}${prev ? 'אחרון: ' + esc(prev.exp || TR().daily[prev.level]) + ' ' + agoTxt(prev.ts) : 'עוד לא תועד'}</span></span></span>
      <select class="att" data-chg="exSet" data-f="att" data-id="${x.id}" aria-label="נוכחות">${TR().attend.map((o) => `<option ${o === (r.att || arriveToday(x) || TR().attend[0]) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>
     <div class="seg big">${TR().daily.map((w, j) => `<button type="button" class="${r.level === j ? 'on l' + j : ''}" data-act="exLv" data-id="${x.id}" data-v="${j}">${esc(w)}</button>`).join('')}</div>
     ${t && t.score ? `<label class="small mut row" style="gap:6px">${esc(t.score)}<input type="text" inputmode="decimal" id="exs-${x.id}" data-inp="exSet" data-f="score" data-id="${x.id}" value="${esc(r.score == null ? '' : r.score)}" placeholder="לא חובה" style="width:110px"></label>` : ''}
     <div class="phrases">${P.good.map((ph) => chip(x, r, ph, 'g')).join('')}${P.weak.map((ph) => chip(x, r, ph, 'w')).join('')}</div>
     <input type="text" id="ext-${x.id}" data-inp="exSet" data-f="text" data-id="${x.id}" value="${esc(r.text || '')}" placeholder="משוב קצר – אפשר להכתיב במקלדת של הטלפון 🎤" style="width:100%"></div>`; };
  const recent = myExps(k);
  return `<div class="row spread"><div>${corpsSwitcher()}<h1 style="font-size:28px;font-weight:800;margin-top:6px">תיעוד התנסות</h1><div class="mut small">${ev ? 'צוות ' + A.me.group + ' · ' : ''}בוחרים התנסות ומסמנים לכל חייל/ת בלחיצה. מי שלא סומן/ה לא נרשם/ה. הטיוטה נשמרת במכשיר עד השליחה.</div></div></div>
   ${A.ui.exPending ? '<div class="demo-note" style="border-color:var(--orange)"><b>לא נשלח – אין חיבור.</b> הרישום שמור במכשיר וישלח אוטומטית כשהחיבור יחזור. אפשר גם ללחוץ שוב על שמירה.</div>' : ''}
   <div class="card"><div class="mut small">סוג ההתנסות</div><div class="phrases" style="margin:6px 0 10px">${TR().expTypes.map((x) => `<button type="button" class="phr ${ex.type === x.l ? 'on' : ''}" data-act="exType" data-v="${esc(x.l)}">${esc(x.l)}</button>`).join('')}</div>
    <div class="filters"><label style="flex:1;min-width:200px">שם ההתנסות<input type="text" id="ex-title" data-inp="exTitle" value="${esc(ex.title)}" placeholder="לדוגמה: מטווח 50 מ׳ / מסע 8 ק״מ" style="width:100%"></label>${ev ? '' : sel('unit', 'יחידה', c.units.map((u) => u.name), f.unit) + sel('team', 'צוות', teamList(), f.team)}</div>
    <div class="row" style="margin-top:8px"><button class="btn sec sm" data-act="exAllOk">סימון "${esc(TR().daily[1])}" לכל מי שלא סומן/ה</button>${ex.saved ? '<span class="pill p-green">נשמר · אפשר לתקן ולשמור שוב</span>' : ''}</div></div>
   <div class="exlist">${rows.map(card).join('') || '<div class="card mut">אין חיילים שמתאימים לסינון.</div>'}</div>
   <div class="exbar"><b>${marked} / ${rows.length}</b><span class="mut small">סומנו</span><span style="flex:1"></span>${marked ? '<button class="btn sec" data-act="exNew">התנסות חדשה</button>' : ''}<button class="btn" data-act="exSave" ${marked && ex.type ? '' : 'disabled'}>${!ex.type ? 'בחרו סוג התנסות' : (marked ? 'שמירת ' + marked + ' רישומים' : 'סמנו רמה כדי לשמור')}</button></div>
   ${recent.length ? `<div class="card"><h2>ההתנסויות שתיעדת לאחרונה</h2>${recent.slice(0, 8).map((g) => `<div class="tl row spread"><span><b>${esc(g.exp || 'התנסות')}</b>${g.title && g.title !== g.exp ? ' – ' + esc(g.title) : ''} <span class="mut small">${fmtD(g.ts)} · ${g.n} חיילים</span></span><button class="btn sec sm" data-act="exOpen" data-sid="${esc(g.sid)}">פתיחה לתיקון</button></div>`).join('')}</div>` : ''}`;
};
Object.assign(ACTIONS, {
  dfSet: (d, t) => { A.ui.df = Object.assign({}, A.ui.df, { [d.f]: t.value }); rerender(); },
  exType: (d) => { const ex = exState(); ex.type = d.v; if (!ex.title || TR().expTypes.some((x) => x.l === ex.title)) ex.title = d.v; exPersist(); rerender(); },
  exTitle: (d, t) => { exState().title = t.value; exPersist(); },
  exLv: (d) => { const ex = exState(), r = ex.rows[d.id] || (ex.rows[d.id] = {}); r.level = r.level === +d.v ? null : +d.v; exPersist(); rerender(); },
  exSet: (d, t) => { const ex = exState(), r = ex.rows[d.id] || (ex.rows[d.id] = {}); r[d.f] = t.value; exPersist(); if (t.tagName === 'SELECT') rerender(); },
  exPh: (d) => { const ex = exState(), r = ex.rows[d.id] || (ex.rows[d.id] = {}), parts = (r.text || '').split(/\s*,\s*/).filter(Boolean), i = parts.indexOf(d.v); if (i >= 0) parts.splice(i, 1); else parts.push(d.v); r.text = parts.join(', '); exPersist(); rerender(); },
  exAllOk: () => { const k = corpsKey(), ex = exState(); dailyRows(k).forEach((x) => { const r = ex.rows[x.id] || (ex.rows[x.id] = {}); if (r.level == null) r.level = 1; }); exPersist(); rerender(); },
  exNew: async () => { const ex = exState(); if (!ex.saved && Object.values(ex.rows).some((r) => r.level != null) && !(await ask({ title: 'להתחיל התנסות חדשה?', body: 'הרישומים שסומנו כאן עוד לא נשמרו ויימחקו.', ok: 'התחלה מחדש', cancel: 'חזרה' }))) return; A.ui.ex = { sid: newSid(), type: '', title: '', rows: {} }; A.ui.exPending = false; exPersist(); rerender(); },
  exOpen: (d) => { const k = corpsKey(), rows = {}; let type = '', title = ''; visible(k).forEach((x) => (x.daily || []).forEach((e) => { if (e.sid === d.sid && e.byId === A.me.id) { rows[x.id] = { level: e.level, att: e.att, text: e.text || '', score: e.score }; type = e.exp || type; title = e.title || title; } })); A.ui.ex = { sid: d.sid, type, title, rows, saved: true }; rerender(); window.scrollTo(0, 0); },
  exSave: async () => {
    const k = corpsKey(), ex = exState(), ids = new Set(dailyRows(k).map((x) => x.id));
    const rows = Object.keys(ex.rows).filter((id) => ids.has(id) && ex.rows[id].level != null).map((id) => { const r = ex.rows[id], c = candOf(k, id); return { id, level: r.level, att: r.att || arriveToday(c) || undefined, text: r.text || '', score: r.score }; });
    if (!rows.length || !ex.type) return;
    try { const r = await api('daily', { corps: k, exp: ex.type, title: ex.title || ex.type, sid: ex.sid, rows }); ex.saved = true; A.ui.exPending = false; try { localStorage.removeItem(EXK()); } catch (e) { /* ignore */ } toast((ex.title || ex.type) + ': נשמרו ' + r.saved + ' רישומים'); rerender(); }
    catch (x) { if (x instanceof TypeError) { A.ui.exPending = true; exPersist(); if (!A._exRetry) { A._exRetry = true; window.addEventListener('online', () => { if (A.ui.exPending) ACTIONS.exSave(); }); } toast('אין חיבור – הרישום נשמר במכשיר וישלח כשהחיבור יחזור', true); rerender(); } }
  },
});

// ---- periodic status ----
// order of work: who has no status yet comes first, and among them whoever needs the most attention
const pLow = (x) => (x.daily || []).filter((e) => daysAgo(e.ts) <= 14 && e.level === 0).length;
const pPrio = (x) => (periodRv(x) ? 0 : 1000) + (x.tstatus === 'בבדיקת הדחה' ? 300 : (x.tstatus === 'במעקב' ? 200 : 0)) + pLow(x) * 10;
function periodicRows(k) { const f = A.ui.pf || {}; return visible(k).filter(isActive).filter((x) => (!f.unit || x.unit === f.unit) && (!f.team || x.group === +f.team) && (!f.miss || !periodRv(x))).sort((a, b) => pPrio(b) - pPrio(a) || a.name.localeCompare(b.name, 'he')); }
// the next soldier in the current list who still has no status for this period
function nextMissing(k, afterId) { const ids = periodicRows(k).map((x) => x.id), i = ids.indexOf(afterId), order = ids.slice(i + 1).concat(ids.slice(0, Math.max(i, 0))); return order.find((id) => id !== afterId && !periodRv(candOf(k, id))) || null; }
SCREENS.periodic = (k) => {
  const c = cf(k), f = A.ui.pf || {}, all = visible(k).filter(isActive), rows = periodicRows(k), done = all.filter(periodRv).length, P = A.S.period, left = P.daysLeft, missing = all.length - done, edit = can('periodic', k); A.ui.list = rows.map((x) => x.id);
  const sel = (key, label, opts, val) => `<label>${label}<select data-chg="pf" data-f="${key}"><option value="">הכול</option>${opts.map((o) => `<option ${String(o) === String(val || '') ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
  const first = rows.find((x) => !periodRv(x));
  const units = c.units.map((u) => { const g = all.filter((x) => x.unit === u.name), d = g.filter(periodRv).length; return g.length ? `<div class="frow3"><span>${esc(u.name)}</span><div class="bar"><i style="width:${d / g.length * 100}%;background:var(--blue)"></i></div><b>${d} / ${g.length}</b></div>` : ''; }).join('');
  return `<div class="row spread"><div>${corpsSwitcher()}<h1 style="font-size:28px;font-weight:800;margin-top:6px">סטטוס ${esc(P.label)} – ${esc(c.label)}</h1><div class="mut small">סיכום תקופתי לכל חייל/ת פעיל/ה: רמה בכל תחום, חוזקות, לשיפור והמלצה להמשך${edit ? '' : ' · צפייה בלבד'}</div></div>
    <div class="row">${edit && first ? `<button class="btn" data-act="pOpen" data-id="${first.id}">התחלת הזנה רציפה (${rows.filter((x) => !periodRv(x)).length})</button>` : ''}</div></div>
   <div class="grid g3" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))"><div class="kpi"><b>${done} / ${all.length}</b><span>הוזנו לתקופה</span></div><div class="kpi"><b>${missing}</b><span>חסרים</span></div><div class="kpi"><b>${left}</b><span>ימים עד סוף התקופה</span><div class="small ${missing && left <= 14 ? '' : 'mut'}" ${missing && left <= 14 ? 'style="color:var(--red);font-weight:700"' : ''}>${esc(P.end.slice(8) + '/' + P.end.slice(5, 7))}${missing && left <= 14 ? ' · נותרו ' + missing + ' להזנה' : ''}</div></div></div>
   <div class="card"><h2>התקדמות לפי יחידה</h2>${units}</div>
   <div class="card"><div class="filters">${teamOnly() ? '' : sel('unit', 'יחידה', c.units.map((u) => u.name), f.unit) + sel('team', 'צוות', teamList(), f.team)}<label><input type="checkbox" id="p-miss" data-chg="pf" data-f="miss" ${f.miss ? 'checked' : ''}> רק מי שחסר לו סטטוס (${missing})</label></div>
   <div class="mut small" style="margin-bottom:8px">הסדר: קודם מי שעוד לא הוזן, ובתוכם מי שבבדיקת הדחה, במעקב, או עם התנסויות "מתקשה" בשבועיים האחרונים.</div>
   <div style="overflow:auto"><table class="ctbl"><thead><tr><th>חייל/ת</th><th>יחידה · צוות</th><th>סטטוס נוכחי</th><th>שבועיים אחרונים</th><th>תקופה קודמת</th><th>${esc(P.label)}</th><th></th></tr></thead><tbody>${rows.map((x) => { const r = periodRv(x), pr = (x.reviews || []).filter((y) => y.period !== P.key).sort((a, b) => b.ts - a.ts)[0], w = (x.daily || []).filter((e) => daysAgo(e.ts) <= 14), wk = TR().daily.map((q, j) => w.filter((e) => e.level === j).length);
     return `<tr class="clk" data-act="cand" data-id="${x.id}"><td><span class="row" style="gap:8px;flex-wrap:nowrap">${avatar(x, 34)}<b>${candLink(k, x.id, x.name)}</b></span></td><td>${esc(x.unit)} · ${x.group}</td><td>${stPill(x)}</td><td>${w.length ? TR().daily.map((q, j) => (wk[j] ? `<span class="pill ${LV_CLS[j]}">${wk[j]} ${esc(q)}</span>` : '')).join(' ') : '<span class="mut small">אין רישום</span>'}</td><td>${pr ? `<span class="pill p-gray">${esc(pr.rec)}</span>` : '<span class="mut">—</span>'}</td><td>${r ? `<span class="pill ${r.rec === TR().periodRec[0] ? 'p-green' : (r.rec === TR().periodRec[1] ? 'p-orange' : 'p-red')}">${esc(r.rec)}</span> <span class="mut small">${fmtD(r.ts)}</span>` : '<span class="pill p-orange">חסר</span>'}</td><td>${edit ? `<button class="btn ${r ? 'sec' : ''} sm" data-act="pOpen" data-id="${x.id}">${r ? 'עדכון' : 'הזנה'}</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="7" class="mut">אין חיילים שמתאימים לסינון. נסו להסיר מסנן.</td></tr>'}</tbody></table></div></div>`;
};
// ---- dismissal room (חדר הדחה): the review goes stage by stage (TR().stages): talks with a recommendation, then committees that decide ----
const STANCE_CLS = ['p-red', 'p-orange', 'p-green'];
const stanceCls = (s) => STANCE_CLS[TR().stances.indexOf(s)] || 'p-gray';
const outcomeCls = (o) => (o === TR().decisions[2] ? 'p-red' : (o === TR().escalate ? 'p-violet' : (o === TR().decisions[1] ? 'p-orange' : 'p-green')));
// mirrors the server: the stage the review waits for (null when closed / nothing left)
function dueStage(d) {
  const T = TR(), rec = (key) => (d.stages || []).find((x) => x.key === key);
  for (const st of T.stages) { const r = rec(st.key); if (st.optional) { const pr = rec(T.stages[T.stages.indexOf(st) - 1].key); if (!pr || pr.outcome !== T.escalate) return null; } if (!r) return st; }
  return null;
}
const canStage = (st, x) => !!st && !!A.me && st.who.includes(A.me.role) && (!teamOnly() || x.group === A.me.group);
const stageTxt = (d) => { const due = dueStage(d); return due ? 'ממתין ל' + due.label : 'כל השלבים תועדו'; };
const stagePill = (d) => { const due = dueStage(d), n = (d.stages || []).length; return `<span class="pill ${due && due.kind === 'committee' ? 'p-violet' : 'p-orange'}">${n ? n + ' שלבים תועדו · ' : ''}${esc(stageTxt(d))}</span>`; };
// the stepper: every stage with its record (who, when, recommendation / outcome, summary); the optional stage only when it is in play
function stagesHtml(d, x) {
  const due = d.status === 'פתוחה' ? dueStage(d) : null, recs = d.stages || [];
  return `<ol class="stages">${TR().stages.filter((st) => !st.optional || recs.some((r) => r.key === st.key) || (due && due.key === st.key)).map((st, i) => {
    const r = recs.find((q) => q.key === st.key), cur = due && due.key === st.key;
    return `<li class="${r ? 'done' : (cur ? 'cur' : 'todo')}"><div class="row spread"><b>${i + 1}. ${esc(st.label)}</b>${r ? `<span class="pill ${r.rec ? stanceCls(r.rec) : outcomeCls(r.outcome)}">${esc(r.rec ? 'המלצה: ' + r.rec : r.outcome)}</span>` : `<span class="mut small">${cur ? 'השלב הנוכחי · ' : ''}מתעד/ת: ${esc(st.who.join(' / '))}</span>`}</div>${r ? `<div class="mut small">${fmtD(r.ts)} · ${esc(r.by)}</div><div>${esc(r.summary)}</div>` : ''}</li>`;
  }).join('')}</ol>${(d.opinions || []).length ? `<details class="small" style="margin-top:6px"><summary>נימוקים שנרשמו לפני המעבר לשלבים (${d.opinions.length})</summary>${d.opinions.map((o) => `<div class="opn"><span class="pill ${stanceCls(o.stance)}">${esc(o.stance)}</span> <b>${esc(o.by)}</b> <span class="mut">${fmtD(o.ts)}</span><div>${esc(o.text)}</div></div>`).join('')}</details>` : ''}`;
}
function stageForm(k, x, d) {
  const st = dueStage(d); if (!st) return '';
  if (!canStage(st, x)) return `<div class="demo-note" style="margin-top:10px">ממתין ל<b>${esc(st.label)}</b>. מתעד/ת: ${esc(st.who.join(' / '))}.</div>`;
  const f = (A.ui.stg || {})[x.id] || {}, talk = st.kind === 'talk', T = TR();
  const opts = talk ? T.stances : T.decisions.concat(T.stages.indexOf(st) < T.stages.length - 1 ? [T.escalate] : []);
  return `<div class="opform"><b>תיעוד: ${esc(st.label)}</b><div class="mut small">${talk ? 'סיכום השיחה עם החייל/ת והמלצה להמשך.' : 'החלטת הוועדה נרשמת בתיק. ' + (T.stages.indexOf(st) < T.stages.length - 1 ? 'אפשר להעביר לוועדה בדרג נוסף.' : '')}</div>
    <div class="seg" style="margin:6px 0;flex-wrap:wrap">${opts.map((w) => `<button type="button" class="${f.v === w ? 'on' : ''}" data-act="stgPick" data-id="${x.id}" data-v="${esc(w)}">${esc(w)}</button>`).join('')}</div>
    <textarea id="stg-${x.id}" data-inp="stgText" data-id="${x.id}" rows="3" placeholder="${talk ? 'מה עלה בשיחה, מה סוכם, איזה טיפול ניתן' : 'סיכום הוועדה והנימוק להחלטה'}" style="width:100%">${esc(f.text || '')}</textarea>
    <div class="row" style="margin-top:6px"><button class="btn sm" data-act="stgSave" data-id="${x.id}" data-stage="${st.key}">${talk ? 'שמירת סיכום השיחה' : 'שמירת החלטת הוועדה'}</button></div></div>`;
}
function roomCard(k, x) {
  const d = openDis(x), week = (x.daily || []).filter((e) => daysAgo(e.ts) <= 14), wk = TR().daily.map((w, j) => week.filter((e) => e.level === j).length), rv = lastRv(x);
  return `<div class="card room" id="room-${x.id}">
    <div class="row spread" style="align-items:flex-start"><span class="row" style="gap:12px;flex-wrap:nowrap">${avatar(x, 56)}<span><b style="font-size:19px">${candLink(k, x.id, x.name)}</b><div class="mut small"><bdi>${x.id}</bdi> · ${esc(x.role)} · ${esc(x.unit)} · צוות ${x.group}</div></span></span>${stagePill(d)}</div>
    <div class="grid g2" style="margin-top:12px"><div><div class="mut small">סיבת הבדיקה · ${esc(d.openedBy)} · ${fmtD(d.openedTs)}</div><div>${esc(d.reason)}</div>${d.treat ? `<div class="mut small" style="margin-top:6px">טיפול שניתן עד הפתיחה</div><div>${esc(d.treat)}</div>` : ''}</div>
     <div><div class="mut small">נתונים מהתיק</div><div class="row" style="gap:6px">${week.length ? TR().daily.map((w, j) => (wk[j] ? `<span class="pill ${LV_CLS[j]}">${wk[j]} ${esc(w)}</span>` : '')).join('') + '<span class="mut small">בהתנסויות של השבועיים האחרונים</span>' : '<span class="mut small">אין התנסויות מתועדות בשבועיים האחרונים</span>'}</div><div style="margin-top:4px">${rv ? `<span class="pill p-gray">${esc(rv.label)}: ${esc(rv.rec)}</span>` : '<span class="mut small">אין סטטוס תקופתי</span>'}${(x.events || []).length ? ` <span class="pill p-red">${x.events.length} אירועים חריגים</span>` : ''}</div></div></div>
    <div style="margin-top:12px"><div class="mut small">התנסויות – 4 שבועות אחרונים</div>${trend(x, 420)}</div>
    <h3 style="margin:14px 0 4px">שלבי התהליך</h3>${stagesHtml(d, x)}
    ${stageForm(k, x, d)}
   </div>`;
}
SCREENS.dismiss = (k) => {
  const c = cf(k), vis = visible(k), open = vis.filter(openDis).sort((a, b) => openDis(a).openedTs - openDis(b).openedTs), closed = []; vis.forEach((x) => (x.dismiss || []).filter((d) => d.status === 'נסגרה').forEach((d) => closed.push({ x, d }))); closed.sort((a, b) => b.d.decidedTs - a.d.decidedTs);
  A.ui.list = open.map((x) => x.id);
  const mine = open.filter((x) => canStage(dueStage(openDis(x)), x)).length, comm = open.filter((x) => { const s = dueStage(openDis(x)); return s && s.kind === 'committee'; }).length;
  return `<div>${corpsSwitcher()}<h1 style="font-size:28px;font-weight:800;margin-top:6px">חדר הדחה – ${esc(c.label)}</h1><div class="mut small">התהליך בשלבים: ${esc(TR().stages.map((s) => s.label + (s.optional ? ' (לפי החלטת הוועדה)' : '')).join(' ← '))}. כל שלב מתועד עם סיכום. אחרי הדחה: ${esc(TR().exitTo)}.</div></div>
   <div class="grid g3" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))"><div class="kpi"><b>${open.length}</b><span>בדיקות פתוחות</span></div><div class="kpi"><b>${comm}</b><span>ממתינים לוועדה</span></div><div class="kpi"><b>${mine}</b><span>ממתינים לתיעוד שלך</span></div></div>
   ${(() => { const x = A.ui.openFor && candOf(k, A.ui.openFor); if (!x || openDis(x) || !isActive(x) || !can('dismiss', k)) return ''; return `<div class="card room" id="room-open" style="border:2px solid var(--red)"><div class="row spread"><span class="row" style="gap:12px;flex-wrap:nowrap">${avatar(x, 48)}<span><div class="mut small">פתיחת בדיקת הדחה</div><b style="font-size:19px">${candLink(k, x.id, x.name)}</b><div class="mut small"><bdi>${x.id}</bdi> · ${esc(x.role)} · ${esc(x.unit)} · צוות ${x.group}</div></span></span><button class="btn sec sm" data-act="openCancel">ביטול</button></div><div class="demo-note" style="margin-top:10px">פתיחת בדיקה אינה הדחה. אחרי הפתיחה מתועדים השלבים: ${esc(TR().stages.filter((q) => !q.optional).map((q) => q.label).join(' ← '))}.</div><label style="display:block;margin-top:10px">סיבת הבדיקה (חובה)<textarea id="open-reason" data-inp="openReason" rows="3" placeholder="אירועים ועובדות, לא התרשמות כללית" style="width:100%">${esc(A.ui.openReason || '')}</textarea></label><label style="display:block;margin-top:8px">טיפול שניתן עד עכשיו<textarea id="open-treat" data-inp="openTreat" rows="2" placeholder="לדוגמה: שיחה אישית, תגבור, לימוד פרטני" style="width:100%">${esc(A.ui.openTreat || '')}</textarea></label><div class="row" style="margin-top:8px"><button class="btn" data-act="openSave" data-id="${x.id}">פתיחת הבדיקה</button></div></div>`; })()}
   ${open.map((x) => roomCard(k, x)).join('') || (A.ui.openFor ? '' : '<div class="card"><h2>החדר ריק</h2><p class="mut">אין כרגע בדיקות הדחה פתוחות. בדיקה נפתחת מתיק החייל/ת, או כשסטטוס תקופתי מסתכם ב"מועמד/ת להדחה".</p></div>')}
   <div class="card"><h2>בדיקות שנסגרו (${closed.length})</h2>${closed.map(({ x, d }) => `<details class="tl"><summary><span class="row spread" style="display:inline-flex;width:calc(100% - 24px)"><span><b>${candLink(k, x.id, x.name)}</b> <span class="mut small">${esc(x.unit)}</span></span><span class="row"><span class="pill ${outcomeCls(d.decision)}">${esc(d.decision)}</span>${d.exitTo ? `<span class="pill p-gray">${esc(d.exitTo)}</span>` : (d.movedTo ? `<span class="pill p-orange">עבר/ה ל${esc(d.movedTo)}</span>` : '')}<span class="mut small">${fmtD(d.decidedTs)} · ${esc(d.decidedBy)}</span></span></span></summary><div class="mut small" style="margin-top:6px">סיבת הבדיקה: ${esc(d.reason)}</div>${d.treat ? `<div class="mut small">טיפול: ${esc(d.treat)}</div>` : ''}${stagesHtml(d, x)}${(d.stages || []).length ? '' : `<div style="margin:2px 0 6px"><b>נימוק ההחלטה:</b> ${esc(d.note)}</div>`}</details>`).join('') || '<span class="mut">עדיין לא נסגרו בדיקות.</span>'}</div>`;
};
Object.assign(ACTIONS, {
  openReason: (d, t) => { A.ui.openReason = t.value; },
  openTreat: (d, t) => { A.ui.openTreat = t.value; },
  openCancel: () => { A.ui.openFor = null; A.ui.openReason = ''; A.ui.openTreat = ''; rerender(); },
  openSave: async (d) => { const k = corpsKey(), c = candOf(k, d.id); try { await api('dismiss-open', { corps: k, id: d.id, reason: A.ui.openReason || '', treat: A.ui.openTreat || '' }); A.ui.openFor = null; A.ui.openReason = ''; A.ui.openTreat = ''; toast('נפתחה בדיקת הדחה ל' + c.name); rerender(); focusRoom(d.id); } catch (x) { /* toast shown */ } },
  stgPick: (d) => { const o = A.ui.stg || (A.ui.stg = {}); (o[d.id] || (o[d.id] = {})).v = d.v; rerender(); },
  stgText: (d, t) => { const o = A.ui.stg || (A.ui.stg = {}); (o[d.id] || (o[d.id] = {})).text = t.value; },
  stgSave: async (d) => {
    const k = corpsKey(), c = candOf(k, d.id), st = TR().stages.find((q) => q.key === d.stage), f = (A.ui.stg || {})[d.id] || {};
    if (!f.v) { toast(st.kind === 'talk' ? 'בחרו המלצה' : 'בחרו את החלטת הוועדה', true); return; }
    if (f.v === TR().decisions[2] && !(await ask({ title: 'להדיח את ' + c.name + '?', body: 'החלטת ה' + st.label + ' נרשמת בתיק ואי אפשר לבטל אותה. אחרי ההדחה: ' + TR().exitTo + '.', ok: 'הדחה', cancel: 'חזרה', danger: true }))) return;
    try { const r = await api('dismiss-stage', { corps: k, id: d.id, stage: d.stage, summary: f.text || '', [st.kind === 'talk' ? 'rec' : 'outcome']: f.v }); if (A.ui.stg) delete A.ui.stg[d.id]; toast(r.closed ? 'הבדיקה של ' + c.name + ' נסגרה: ' + r.decision + (r.decision === TR().decisions[2] ? ' · ' + TR().exitTo : '') : st.label + ' של ' + c.name + ' תועד/ה'); rerender(); } catch (x) { /* toast shown */ }
  },
});
Object.assign(ACTIONS, {
  pf: (d, t) => { A.ui.pf = Object.assign({}, A.ui.pf, { [d.f]: t.type === 'checkbox' ? t.checked : t.value }); rerender(); },
  pOpen: (d, t, e) => { if (e) e.stopPropagation(); ACTIONS.openCand(d); ACTIONS.cfOpen({ t: 'periodic' }); },
});

// ---- intake (גיוס המועמד) ----
SCREENS.intake = (k) => {
  const c = cf(k), f = A.ui.inf || (A.ui.inf = {}), ok = can('intake', k), sh = A.me.role === 'שלישות';
  const sel = (key, label, opts, ph) => `<label>${label}<select data-chg="inSet" data-f="${key}" ${ok ? '' : 'disabled'}><option value="">${ph || 'בחרו…'}</option>${opts.map((o) => `<option ${String(o) === String(f[key] || '') ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
  return `<div>${corpsSwitcher()}<h1 style="font-size:28px;font-weight:800;margin-top:6px">גיוס מועמד – ${esc(c.label)}</h1><div class="mut small">הכנסת חייל/ת למעקב: יחידה, ${esc(c.targetLabel)} וצוות. אפשר אחד-אחד או מקובץ.</div></div>
   <div class="card"><h2>גיוס חייל/ת אחד/ת</h2>${ok ? '' : '<div class="demo-note">גיוס מועמדים זמין לשלישות ולמנהל/ת המערכת.</div>'}
    <div class="filters"><label>שם<input type="text" id="in-name" data-inp="inSet" data-f="name" value="${esc(f.name || '')}" placeholder="שם פרטי ואות משפחה" ${ok ? '' : 'disabled'}></label>${sel('role', 'תפקיד', c.roles)}${sh ? `<label>יחידה<input type="text" value="${esc(A.me.unit)}" disabled></label>` : sel('unit', 'יחידה', c.units.map((u) => u.name))}${sel('target', esc(c.targetLabel), A.cfg.TARGETS[k])}${sel('group', 'צוות', teamList())}</div>
    <div class="row"><button class="btn" data-act="inSave" ${ok ? '' : 'disabled'}>גיוס למערכת</button><span class="mut small">מדדים, תמונה ודף מגבש אפשר להשלים אחר כך. מה שלא הוזן נשאר "חסר".</span></div></div>
   ${SCREENS.import(k)}`;
};
Object.assign(ACTIONS, {
  inSet: (d, t) => { (A.ui.inf || (A.ui.inf = {}))[d.f] = t.value; },
  inSave: async () => { const k = corpsKey(), f = A.ui.inf || {}; try { await api('intake', Object.assign({ corps: k }, f)); toast((f.name || '') + ' גויס/ה למערכת'); A.ui.inf = {}; rerender(); } catch (x) { /* toast shown */ } },
});

// ---- log + export ----
function exportSheets(k) {
  const c = cf(k), v = visible(k);
  return [
    ['חיילים', [['מס׳', 'שם', 'תפקיד', 'יחידה', c.targetLabel, 'צוות', 'סטטוס', 'גיוס', 'מעקב אחרון', 'סטטוס ' + A.S.period.label].concat(c.stats.map((s) => s.l + ' (' + s.u + ')'))].concat(v.map((x) => { const l = lastDaily(x), r = periodRv(x); return [x.id, x.name, x.role, x.unit, x.target, x.group, x.tstatus, fmtD(x.intakeTs), l ? TR().daily[l.level] + ' · ' + fmtD(l.ts) : '', r ? r.rec : ''].concat(c.stats.map((s) => cellVal(s, x.stats[s.k]))); }))],
    ['התנסויות', [['תאריך', 'מס׳', 'שם', 'סוג', 'שם ההתנסות', 'רמה', 'ציון / תוצאה', 'נוכחות', 'משוב', 'מתעד/ת']].concat(v.flatMap((x) => (x.daily || []).map((e) => [e.d, x.id, x.name, e.exp || 'מעקב יומי', e.title || '', TR().daily[e.level], e.score == null ? '' : e.score, e.att, e.text, e.by])).sort((a, b) => (a[0] < b[0] ? 1 : -1)))],
    ['אירועים חריגים', [['תאריך', 'מס׳', 'שם', 'סוג', 'תיאור', 'מתעד/ת']].concat(v.flatMap((x) => (x.events || []).map((e) => [fmtD(e.ts), x.id, x.name, e.kind, e.text, e.by])))],
    ['סטטוס תקופתי', [['תקופה', 'מס׳', 'שם', 'המלצה', 'סיכום', 'מזין/ה', 'תאריך']].concat(v.flatMap((x) => (x.reviews || []).map((r) => [r.label, x.id, x.name, r.rec, r.summary, r.by, fmtD(r.ts)])))],
    ['בדיקות הדחה', [['מס׳', 'שם', 'מצב', 'נפתחה', 'פותח/ת', 'סיבה', 'החלטה', 'מחליט/ה', 'תאריך החלטה', 'נימוק ההחלטה', 'טיפול שניתן', 'שלבי התהליך', 'יעד אחרי הדחה']].concat(v.flatMap((x) => (x.dismiss || []).map((d) => [x.id, x.name, d.status, fmtD(d.openedTs), d.openedBy, d.reason, d.decision || '', d.decidedBy || '', d.decidedTs ? fmtD(d.decidedTs) : '', d.note || '', d.treat || '', (d.stages || []).map((r) => r.label + ' (' + fmtD(r.ts) + ', ' + r.by + ') – ' + (r.rec || r.outcome) + ': ' + r.summary).concat((d.opinions || []).map((o) => o.by + ' – ' + o.stance + ': ' + o.text)).join(' | '), d.exitTo || d.movedTo || ''])))],
    ['יומן פעילות', logRows(k)],
  ];
}
SCREENS.log = (k) => `<div class="row spread"><div>${corpsSwitcher()}<h1 style="font-size:28px;font-weight:800;margin-top:6px">יומן וייצוא – ${esc(cf(k).label)}</h1><div class="mut small">כל פעולה במערכת נרשמת כאן עם מי ומתי</div></div><div class="row no-print"><button class="btn" data-act="expAll">ייצוא Excel (6 גיליונות)</button><button class="btn sec" data-act="expPrint">הדפסה / PDF</button></div></div>
   <div class="card">${tbl(logRows(k))}</div>`;
Object.assign(ACTIONS, {
  expAll: () => { const k = corpsKey(); auditEvent('export', 'training xlsx'); downloadBook('training-' + k + '.xlsx', exportSheets(k)); toast('training-' + k + '.xlsx הורד'); },
  expPrint: () => { auditEvent('export', 'log print'); window.print(); },
});

// ---- settings (admin) ----
SCREENS.settings = () => `<div><h1 style="font-size:28px;font-weight:800">הגדרות</h1><div class="mut small">זמין למנהל/ת מערכת בלבד</div></div>
   <div class="card"><h2>סטטוס תקופתי</h2><div class="row"><label>תדירות<select data-chg="stPeriod">${TR().periods.map((p) => `<option ${p === A.S.settings.period ? 'selected' : ''}>${p}</option>`).join('')}</select></label><span class="mut small">התקופה הנוכחית: ${esc(A.S.period.label)}. שינוי התדירות לא מוחק סיכומים קיימים.</span></div></div>
   <div class="card"><h2>נתוני הדגמה</h2><div class="row"><button class="btn sec" data-act="factory">איפוס לנתוני ההדגמה</button><span class="mut small">מוחק את כל מה שהוזן ומחזיר את נתוני הדמו.</span></div></div>
   ${A.auth ? secCards() : ''}${A.ui.tempPw ? tempPwModal() : ''}`;
SCREENS.settings.after = () => { if (A.auth && !A.ui.adm) ACTIONS.admLoad(); };
Object.assign(ACTIONS, {
  stPeriod: async (d, t) => { try { await api('settings', { period: t.value }); toast('הסטטוס התקופתי יוזן לפי ' + t.value); } catch (x) { /* toast shown */ } },
  factory: async () => { if (!(await ask({ title: 'לאפס את כל המסלולים לנתוני ההדגמה?', body: 'כל מה שהוזן יימחק, כולל יומן הפעילות. אי אפשר לשחזר.', ok: 'איפוס', danger: true }))) return; try { await api('factory-reset', {}); toast('המערכת אופסה לנתוני ההדגמה'); } catch (x) { /* toast shown */ } },
});
