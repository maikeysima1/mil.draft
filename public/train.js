// Training follow-up screens: soldiers in training who are candidates for a special unit.
// Core events: intake (גיוס המועמד), dismissal review (בדיקת הדחה), periodic status (רבעון / חציון) – plus a short daily entry.
const TR = () => A.cfg.TR;
const ST_CLS = { 'בהכשרה': 'p-green', 'במעקב': 'p-orange', 'בבדיקת הדחה': 'p-red', 'הודח/ה': 'p-gray', 'סיים/ה הכשרה': 'p-blue' };
const LV_CLS = ['p-orange', 'p-gray', 'p-green'];
// mirrors the server: a dismissed soldier moves one level down in the same track, to the unit with the largest open need
const needOf = (k, name) => ((cs(k).needs || {})[name]) || 0;
const byNeed = (k, us) => { const t = Math.min.apply(null, us.map((u) => u.tier || 1)); return us.filter((u) => (u.tier || 1) === t).sort((a, b) => needOf(k, b.name) - needOf(k, a.name))[0].name; };
function nextPlace(k, c) { // { k, unit } or null (leaves to the fallback)
  const us = cf(k).units, t = (us.find((u) => u.name === c.unit) || {}).tier || 1, lower = us.filter((u) => (u.tier || 1) > t && needOf(k, u.name) > 0);
  if (lower.length) return { k, unit: byNeed(k, lower) };
  const seen = [k]; let n = cf(k).nextTrack;
  while (n && A.cfg.corps[n] && !seen.includes(n)) { const open = cf(n).units.filter((u) => needOf(n, u.name) > 0); if (open.length) return { k: n, unit: byNeed(n, open) }; seen.push(n); n = cf(n).nextTrack; }
  return null;
}
const placeTxt = (k, pl) => (pl ? pl.unit + (pl.k !== k ? ' (' + cf(pl.k).corps + ')' : '') : '');
// daily levels over the last 4 weeks: one dot per day with an entry (average when several people wrote), gaps stay gaps. No verdict, only the picture.
function trend(c, w) {
  const DAYS = 28, W = w || 300, H = 54, x0 = 8, x1 = W - 8, y = (l) => 44 - l * 17, by = {};
  (c.daily || []).forEach((e) => { const d = daysAgo(e.ts); if (d >= 0 && d < DAYS) (by[d] || (by[d] = [])).push(e); });
  const pts = Object.keys(by).map(Number).sort((a, b) => b - a).map((d) => { const es = by[d], avg = es.reduce((a, e) => a + e.level, 0) / es.length; return { d, avg, x: x0 + (x1 - x0) * (DAYS - 1 - d) / (DAYS - 1), tip: fmtD(es[0].ts) + '|' + es.map((e) => TR().daily[e.level] + ' · ' + e.by).join(' / ') }; });
  if (!pts.length) return '<div class="mut small">אין מעקב יומי ב-4 השבועות האחרונים.</div>';
  let line = ''; pts.forEach((p, i) => { if (i && pts[i - 1].d - p.d === 1) line += `<line x1="${pts[i - 1].x.toFixed(1)}" y1="${y(pts[i - 1].avg).toFixed(1)}" x2="${p.x.toFixed(1)}" y2="${y(p.avg).toFixed(1)}" stroke="var(--s1)" stroke-width="2"/>`; });
  const mean = (a) => (a.length ? (a.reduce((x, p) => x + p.avg, 0) / a.length) : null), last = pts.filter((p) => p.d < 7), prev = pts.filter((p) => p.d >= 7), lbl = (v) => (v == null ? '—' : (v + 1).toFixed(1));
  return `<div class="row" style="gap:12px;align-items:center;flex-wrap:nowrap"><svg viewBox="0 0 ${W} ${H}" width="${W}" style="max-width:100%;flex:1" role="img" aria-label="מעקב יומי ב-4 השבועות האחרונים" dir="ltr">${[0, 1, 2].map((l) => `<line x1="${x0}" x2="${x1}" y1="${y(l)}" y2="${y(l)}" stroke="var(--line)" stroke-width="1"/>`).join('')}${line}${pts.map((p) => `<g data-tip="${esc(p.tip)}" tabindex="0"><rect x="${(p.x - 7).toFixed(1)}" y="2" width="14" height="${H - 4}" fill="transparent"/><circle cx="${p.x.toFixed(1)}" cy="${y(p.avg).toFixed(1)}" r="4" fill="var(--s1)" stroke="var(--card)" stroke-width="2"/></g>`).join('')}</svg>
   <div class="small" style="min-width:108px"><div class="mut">מצטיין ↑ · מתקשה ↓</div><div>${pts.length} ימים עם רישום</div><div class="mut">ממוצע (1–3): 7 ימים <b>${lbl(mean(last))}</b> · לפני <b>${lbl(mean(prev))}</b></div></div></div>`;
}
const stPill = (c) => `<span class="pill ${ST_CLS[c.tstatus] || 'p-gray'}">${esc(c.tstatus)}</span>`;
const isActive = (c) => !['הודח/ה', 'סיים/ה הכשרה'].includes(c.tstatus);
const openDis = (c) => (c.dismiss || []).find((d) => d.status === 'פתוחה');
const fmtD = (ts) => new Date(ts).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
const daysAgo = (ts) => Math.floor((nowS() - ts) / 86400e3);
const agoTxt = (ts) => { const d = daysAgo(ts); return d <= 0 ? 'היום' : (d === 1 ? 'אתמול' : 'לפני ' + d + ' ימים'); };
const lastDaily = (c) => (c.daily || []).slice().sort((a, b) => b.ts - a.ts)[0];
const todayAll = (c) => (c.daily || []).filter((e) => e.d === A.S.today);
const myToday = (c) => (c.daily || []).find((e) => e.d === A.S.today && e.byId === A.me.id);
const periodRv = (c) => (c.reviews || []).find((r) => r.period === A.S.period.key);
const lastRv = (c) => (c.reviews || []).slice().sort((a, b) => b.ts - a.ts)[0];
// soldiers the current user may see: an evaluator sees only the own team
const visible = (k) => cs(k).cands.filter((c) => A.me.role !== 'מגבש/ת' || c.group === A.me.group);
const dailyPill = (e) => (e ? `<span class="pill ${LV_CLS[e.level]}" title="${esc(e.by)} · ${esc(e.text || '')}">${esc(TR().daily[e.level])}</span> <span class="mut small">${agoTxt(e.ts)}</span>` : '<span class="mut small">אין רישום</span>');

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
  (c.daily || []).forEach((e) => ev.push({ ts: e.ts, t: 'מעקב יומי', cls: LV_CLS[e.level], by: e.by, body: `<b>${esc(TR().daily[e.level])}</b>${e.att !== TR().attend[0] ? ' · ' + esc(e.att) : ''}${e.text ? ' – ' + esc(e.text) : ''}` }));
  (c.reviews || []).forEach((r) => ev.push({ ts: r.ts, t: 'סטטוס ' + r.label, cls: r.rec === TR().periodRec[0] ? 'p-green' : (r.rec === TR().periodRec[1] ? 'p-orange' : 'p-red'), by: r.by, body: `<b>${esc(r.rec)}</b> – ${esc(r.summary)}` }));
  (c.dismiss || []).forEach((d) => { ev.push({ ts: d.openedTs, t: 'נפתחה בדיקת הדחה', cls: 'p-red', by: d.openedBy, body: esc(d.reason) }); (d.opinions || []).forEach((o) => ev.push({ ts: o.ts, t: 'נימוק בחדר ההדחה', cls: stanceCls(o.stance), by: o.by, body: `<b>${esc(o.stance)}</b> – ${esc(o.text)}` })); if (d.status === 'נסגרה') ev.push({ ts: d.decidedTs, t: 'החלטה בבדיקת הדחה', cls: d.decision === TR().decisions[2] ? 'p-gray' : 'p-green', by: d.decidedBy, body: `<b>${esc(d.decision)}</b>${d.movedTo ? ' · הועבר/ה אוטומטית מ' + esc(d.from) + ' ל' + esc(d.movedTo) + (d.movedTrack ? ' (' + esc(d.movedTrack) + ')' : '') : (d.exitTo ? ' · יצא/ה מהמסלול ל' + esc(d.exitTo) : '')} – ${esc(d.note)}` }); });
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
  if (f.type === 'daily') { title = 'מעקב יומי – היום'; btn = 'שמירת הרישום'; body = `<label>איך היה היום?</label>${seg('level', TR().daily, f.level)}<label>נוכחות ${sel('att', TR().attend, f.att)}</label>${ta('text', 'משפט או שניים על היום (לא חובה)', f.text)}`; }
  if (f.type === 'periodic') {
    const prev = (c.reviews || []).filter((y) => y.period !== A.S.period.key).sort((a, b) => b.ts - a.ts)[0], t1 = (field, label, ph) => `<label>${label}<textarea id="cf-${field}" data-inp="cfSet" data-f="${field}" rows="2" placeholder="${ph}" style="width:100%">${esc(f[field] || '')}</textarea></label>`;
    title = 'סטטוס ' + A.S.period.label; btn = 'שמירת הסטטוס';
    body = `<div class="pctx"><div class="mut small">מעקב יומי – 4 שבועות אחרונים</div>${trend(c, 300)}${prev ? `<div class="mut small" style="margin-top:6px">${esc(prev.label)} · ${esc(prev.by)}</div><div class="small"><b>${esc(prev.rec)}</b> – ${esc(prev.summary)}</div>` : '<div class="mut small" style="margin-top:6px">אין סטטוס מתקופה קודמת.</div>'}</div>
     <div class="mut small">רמה בכל תחום (לא חובה – תחום שלא סומן נשאר כפי שהיה)</div>${cf(k).traits.map((t, i) => `<div class="row spread" style="padding:4px 0"><span>${esc(t)}</span><div class="seg">${WORDS.map((w, j) => `<button type="button" class="${f.lv[i] === j ? 'on l' + j : ''}" data-act="cfLv" data-i="${i}" data-v="${j}">${w}</button>`).join('')}</div></div>`).join('')}
     ${t1('strong', 'חוזקות', 'מה בלט לטובה בתקופה')}${t1('improve', 'לשיפור', 'מה דורש חיזוק')}${t1('plan', 'המלצה להמשך (חובה)', 'מה עושים בתקופה הבאה')}
     <label>סיכום התקופה ${sel('rec', TR().periodRec, f.rec, 'בחרו…')}</label>${f.rec === TR().periodRec[2] ? '<div class="demo-note">בחירה ב"מועמד/ת להדחה" תפתח בדיקת הדחה.</div>' : ''}`;
  }
  if (f.type === 'open') { title = 'פתיחת בדיקת הדחה'; btn = 'פתיחת הבדיקה'; body = `<div class="demo-note">פתיחת בדיקה אינה הדחה. ההחלטה מתקבלת בנפרד ע״י מפקד/ת ההכשרה, ומתועדת בתיק.</div>${ta('reason', 'מה הסיבה לבדיקה? עובדות ומקרים, לא התרשמות כללית', f.reason)}`; }
  if (f.type === 'decide') { const d = openDis(c); title = 'החלטה בבדיקת הדחה'; btn = 'שמירת ההחלטה'; body = `<div class="card" style="background:var(--bg2);padding:10px"><div class="mut small">נפתחה ע״י ${esc(d.openedBy)} · ${fmtD(d.openedTs)}</div>${esc(d.reason)}</div><label>החלטה ${sel('decision', TR().decisions, f.decision, 'בחרו…')}</label>${ta('note', 'נימוק ההחלטה (חובה)', f.note)}`; }
  return `<div class="card" style="border:2px solid var(--blue)"><h3 style="margin:0 0 8px">${title}</h3><div style="display:flex;flex-direction:column;gap:10px">${body}<div class="row"><button class="btn" data-act="cfSave">${btn}</button>${f.type === 'periodic' && nextMissing(k, c.id) ? `<button class="btn sec" data-act="cfSaveNext">שמירה ומעבר ל${esc(candOf(k, nextMissing(k, c.id)).name)} ←</button>` : ''}<button class="btn sec" data-act="cfCancel">ביטול</button></div></div></div>`;
}
function drawer(k, id) {
  const c = candOf(k, id); if (!c) return '';
  const od = openDis(c), act = isActive(c), mine = A.me.role !== 'מגבש/ת' || c.group === A.me.group, miss = missingOf(k, c);
  const b = (type, label, cls) => `<button class="btn ${cls || 'sec'} sm" data-act="cfOpen" data-t="${type}">${label}</button>`;
  const actions = !mine || !act ? '' : [can('daily', k) ? b('daily', myToday(c) ? 'עדכון המעקב של היום' : 'מעקב יומי') : '', can('periodic', k) ? b('periodic', periodRv(c) ? 'עדכון סטטוס ' + A.S.period.label : 'סטטוס ' + A.S.period.label) : '', !od && can('dismiss', k) ? b('open', 'פתיחת בדיקת הדחה') : '', od && (can('opine', k) || can('decide', k)) ? '<button class="btn sm" data-act="goRoom">לחדר ההדחה</button>' : '', !od && can('complete', k) ? '<button class="btn sec sm" data-act="complete">סיום הכשרה</button>' : ''].join('');
  return `<div class="drawer-bg" data-act="closeCand"><aside class="drawer" role="dialog" aria-label="תיק חייל/ת">
   <div class="row spread" style="flex-wrap:nowrap;align-items:flex-start">${can('fav', k) ? favBtn(k, id, 'lg') : ''}<div class="row" style="flex:1;flex-wrap:nowrap;gap:14px;align-items:center">${avatar(c, 72)}<div style="flex:1"><div class="small" style="color:var(--orange);font-weight:600">תיק חייל/ת · ${esc(cf(k).corps)}</div><h2 style="margin:0;font-size:24px">${esc(c.name)}</h2><div class="mut small"><bdi>${c.id}</bdi> · ${esc(c.role)} · צוות ${c.group}</div></div></div><button class="btn sec sm" data-act="closeCand">סגירה ✕</button></div>
   ${navBar(id)}
   <div class="row">${stPill(c)}<span class="pill p-gray">${esc(c.unit || 'יחידה לא נקבעה')}</span><span class="pill p-violet">${esc(cf(k).targetLabel)}: ${esc(c.target || 'לא נקבע')}</span>${c.exitTo ? `<span class="pill p-gray">יצא/ה ל${esc(c.exitTo)}</span>` : ''}${(c.transfers || []).length ? `<span class="pill p-orange">הועבר/ה מ${esc(c.transfers[c.transfers.length - 1].from)}${c.prevIds ? ' · מס׳ קודם ' + esc(c.prevIds[c.prevIds.length - 1]) : ''}</span>` : ''}<span class="pill p-gray">${c.profile == null ? 'פרופיל לא הוזן' : 'פרופיל ' + c.profile} · ${esc(c.med)}</span></div>
   ${od ? `<div class="demo-note" style="border-color:var(--red)"><b>בדיקת הדחה פתוחה</b> · ${esc(od.openedBy)} · ${fmtD(od.openedTs)}<div>${esc(od.reason)}</div><div style="margin-top:4px">${tallyHtml(od)}</div></div>` : ''}
   ${miss.length ? `<div class="demo-note">חסר בתיק: ${esc(miss.join(', '))}</div>` : ''}
   ${actions ? `<div class="row no-print">${actions}</div>` : ''}${cardForm(k, c)}
   <div class="card"><h3 style="margin:0 0 6px">מעקב יומי – 4 שבועות אחרונים</h3>${trend(c, 320)}</div>
   <div class="card"><h3 style="margin:0 0 6px">ציר זמן</h3>${timeline(k, c)}</div>
   <div class="card"><h3 style="margin:0 0 6px">מדדים</h3>${statList(k, c)}</div>
   <div class="card"><h3 style="margin:0 0 6px">רמות לפי תחום</h3>${traitLevels(k, c.lv)}</div>
   <div class="card"><h3 style="margin:0 0 6px">סיכום המגבש/ת מהגיבוש</h3><div>${recPill(c.rec)}</div><p style="margin:6px 0">${esc(c.obs) || '<span class="mut">טרם הוזן</span>'}</p>${c.summary ? `<p class="mut" style="margin:0">${esc(c.summary)}</p>` : ''}</div>
   </aside></div>`;
}
Object.assign(ACTIONS, {
  openCand: (d) => { const f = (A.ui.list || []); A.ui.nav = f.includes(d.id) ? f : [d.id]; A.ui.cf = null; A.ui.tlAll = false; A.ui.cand = d.id; rerender(); },
  cand: (d) => ACTIONS.openCand(d),
  navPrev: () => navStep(-1), navNext: () => navStep(1),
  closeCand: () => { A.ui.cand = null; A.ui.cf = null; rerender(); },
  goRoom: () => { A.ui.cand = null; A.ui.cf = null; go('dismiss'); },
  tlAll: () => { A.ui.tlAll = !A.ui.tlAll; rerender(); },
  fav: async (d, t, e) => { e.stopPropagation(); const k = corpsKey(); try { await api('fav', { corps: k, id: d.id, on: !isFav(k, d.id) }); } catch (x) { /* toast shown */ } },
  cfOpen: (d) => { const k = corpsKey(), c = candOf(k, A.ui.cand), m = myToday(c), r = periodRv(c); A.ui.cf = { type: d.t, id: c.id, level: m ? m.level : null, att: m ? m.att : TR().attend[0], text: m ? m.text : '', lv: r ? r.lv.slice() : c.lv.map(() => null), rec: r ? r.rec : '', summary: r ? r.summary : '', strong: r && r.parts ? r.parts.strong : '', improve: r && r.parts ? r.parts.improve : '', plan: r ? (r.parts ? r.parts.plan : r.summary) : '', reason: '', decision: '', note: '' }; rerender(); },
  cfCancel: () => { A.ui.cf = null; rerender(); },
  cfSet: (d, t) => { if (A.ui.cf) { A.ui.cf[d.f] = t.value; if (t.tagName === 'SELECT') rerender(); } },
  cfSeg: (d) => { A.ui.cf[d.f] = +d.v; rerender(); },
  cfLv: (d) => { const f = A.ui.cf; f.lv[+d.i] = f.lv[+d.i] === +d.v ? null : +d.v; rerender(); },
  cfSaveNext: () => ACTIONS.cfSave(null, null, null, true),
  cfSave: async (d0, t0, e0, goNext) => {
    const k = corpsKey(), f = A.ui.cf, c = candOf(k, f.id);
    try {
      if (f.type === 'daily') { if (f.level == null) { toast('בחרו איך היה היום', true); return; } await api('daily', { corps: k, id: f.id, level: f.level, att: f.att, text: f.text }); toast('המעקב היומי נשמר'); }
      if (f.type === 'periodic') { const r = await api('periodic', { corps: k, id: f.id, lv: f.lv, rec: f.rec, strong: f.strong, improve: f.improve, plan: f.plan }); toast(r.opened ? 'הסטטוס נשמר ונפתחה בדיקת הדחה' : 'הסטטוס נשמר'); const nx = goNext && nextMissing(k, f.id); if (nx) { A.ui.cand = nx; A.ui.cf = null; ACTIONS.cfOpen({ t: 'periodic' }); return; } if (goNext) toast('הוזן סטטוס לכל הרשימה'); }
      if (f.type === 'open') { await api('dismiss-open', { corps: k, id: f.id, reason: f.reason }); toast('נפתחה בדיקת הדחה ל' + c.name); }
      if (f.type === 'decide') { if (f.decision === TR().decisions[2] && !confirm('להדיח את ' + c.name + ' מההכשרה? ההחלטה נרשמת בתיק ואי אפשר לבטל אותה מהמערכת.')) return; await api('dismiss-decide', { corps: k, id: f.id, decision: f.decision, note: f.note }); toast('ההחלטה נשמרה: ' + f.decision); }
      A.ui.cf = null; rerender();
    } catch (x) { /* toast shown */ }
  },
  complete: async () => { const k = corpsKey(), c = candOf(k, A.ui.cand); if (!confirm('לסמן ש' + c.name + ' סיים/ה את ההכשרה? אחרי הסימון אי אפשר להזין לו/לה מעקב.')) return; try { await api('complete', { corps: k, id: c.id }); toast('סומן סיום הכשרה'); } catch (x) { /* toast shown */ } },
});

// ---- dashboard ----
function attention(k) { // who needs a look, and why (transparent rules, no score)
  const out = [];
  visible(k).filter(isActive).forEach((c) => {
    const od = openDis(c), ld = lastDaily(c), why = [];
    if (od) why.push('בדיקת הדחה פתוחה ' + agoTxt(od.openedTs));
    else if (c.tstatus === 'במעקב') why.push('במעקב');
    const low = (c.daily || []).filter((e) => daysAgo(e.ts) <= 7 && e.level === 0).length; if (low >= 2) why.push(low + ' ימים "מתקשה" בשבוע האחרון');
    if (!ld) why.push('אין מעקב יומי'); else if (daysAgo(ld.ts) >= 3) why.push('אין מעקב יומי ' + daysAgo(ld.ts) + ' ימים');
    if (!periodRv(c)) why.push('חסר סטטוס ' + A.S.period.label);
    if (why.length) out.push({ c, why, w: (od ? 100 : 0) + (c.tstatus === 'במעקב' ? 50 : 0) + low * 10 + why.length });
  });
  return out.sort((a, b) => b.w - a.w);
}
SCREENS.dash = (k) => {
  const c = cf(k), all = cs(k).cands, act = all.filter(isActive), n = (s) => all.filter((x) => x.tstatus === s).length;
  const today = act.filter((x) => todayAll(x).length).length, per = act.filter(periodRv).length, names = canFile(), att = names ? attention(k) : [];
  const kpi = (v, l, sub) => `<div class="kpi"><b>${v}</b><span>${l}</span>${sub ? `<div class="mut small">${sub}</div>` : ''}</div>`;
  const byUnit = c.units.map((u) => { const g = all.filter((x) => x.unit === u.name), a = g.filter(isActive); return `<tr><td><b>${esc(u.name)}</b><div class="mut small">${esc(u.desc)}</div></td><td>${u.tier || 1}</td><td>${needOf(k, u.name) || '·'}</td><td>${a.length}</td><td>${g.filter((x) => x.tstatus === 'במעקב').length || '·'}</td><td>${g.filter((x) => x.tstatus === 'בבדיקת הדחה').length || '·'}</td><td>${g.filter((x) => x.tstatus === 'הודח/ה').length || '·'}</td><td>${g.filter((x) => x.tstatus === 'סיים/ה הכשרה').length || '·'}</td><td>${a.filter((x) => todayAll(x).length).length} / ${a.length}</td><td>${a.filter(periodRv).length} / ${a.length}</td></tr>`; }).join('');
  return `<div class="row spread"><div>${corpsSwitcher()}<h1 style="font-size:28px;font-weight:800;margin-top:6px">תמונת מצב – ${esc(c.label)}</h1><div class="mut small">חיילים בהכשרה שמועמדים ליחידה מיוחדת · ${fmtD(nowS())} · ${esc(A.S.period.label)}</div></div></div>
   <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${kpi(act.length, 'בהכשרה כעת', 'מתוך ' + all.length + ' שגויסו')}${kpi(n('במעקב'), 'במעקב')}${kpi(n('בבדיקת הדחה'), 'בבדיקת הדחה')}${kpi(all.filter((x) => (x.transfers || []).length).length, 'הועברו ליחידה אחרת', 'אחרי הדחה')}${kpi(n('הודח/ה'), 'יצאו מהמסלול', 'אחרי הדחה')}${kpi(n('סיים/ה הכשרה'), 'סיימו הכשרה')}</div>
   <div class="grid g2"><div class="card"><h2>מעקב יומי – היום</h2><div class="row"><div class="bar"><i style="width:${act.length ? today / act.length * 100 : 0}%"></i></div><b>${today} / ${act.length}</b></div><div class="mut small" style="margin-top:6px">חיילים פעילים שהוזן להם רישום היום</div></div>
    <div class="card"><h2>סטטוס ${esc(A.S.period.label)}</h2><div class="row"><div class="bar"><i style="width:${act.length ? per / act.length * 100 : 0}%;background:var(--blue)"></i></div><b>${per} / ${act.length}</b></div><div class="mut small" style="margin-top:6px">חיילים פעילים שהוזן להם סטטוס לתקופה הנוכחית</div></div></div>
   <div class="card"><h2>לפי יחידה</h2><div style="overflow:auto"><table><thead><tr><th>יחידה</th><th>דרגה</th><th>צורך פתוח</th><th>בהכשרה</th><th>במעקב</th><th>בבדיקת הדחה</th><th>יצאו</th><th>סיימו</th><th>מעקב היום</th><th>סטטוס תקופתי</th></tr></thead><tbody>${byUnit}</tbody></table></div></div>
   ${names ? `<div class="card"><h2>דורשים תשומת לב (${att.length})</h2><div class="mut small" style="margin-bottom:8px">לפי כללים גלויים: בדיקת הדחה פתוחה, מעקב, שני ימי "מתקשה" בשבוע, אין מעקב 3 ימים, או חסר סטטוס תקופתי. אין כאן ציון ואין המלצה.</div>${att.slice(0, 12).map((a) => `<div class="row spread" style="padding:7px 0;border-bottom:1px solid var(--line2)"><span class="row" style="gap:8px;flex-wrap:nowrap">${avatar(a.c, 32)}<span><b>${candLink(k, a.c.id, a.c.name)}</b> <span class="mut small">${esc(a.c.unit)} · צוות ${a.c.group}</span></span></span><span class="row" style="gap:6px;justify-content:flex-end">${a.why.map((w) => `<span class="pill ${/הדחה/.test(w) ? 'p-red' : 'p-orange'}">${esc(w)}</span>`).join('')}</span></div>`).join('') || '<span class="mut">אין כרגע חיילים שדורשים תשומת לב לפי הכללים.</span>'}${att.length > 12 ? `<div class="mut small" style="margin-top:6px">ועוד ${att.length - 12} – ברשימת החיילים</div>` : ''}</div>` : '<div class="demo-note">התפקיד שלך רואה מספרים מסכמים בלבד, ללא שמות ותיקים.</div>'}`;
};

// ---- roster ----
function rosterList(k) {
  const f = A.ui.rf || {}, q = (f.q || '').trim().toLowerCase();
  return visible(k).filter((x) => (!q || (x.name + ' ' + x.id).toLowerCase().includes(q)) && (!f.unit || x.unit === f.unit) && (!f.st || (f.st === 'פעילים' ? isActive(x) : x.tstatus === f.st)) && (!f.team || x.group === +f.team) && (!f.fav || isFav(k, x.id)));
}
SCREENS.roster = (k) => {
  const c = cf(k), f = A.ui.rf || {}, rows = rosterList(k); A.ui.list = rows.map((x) => x.id);
  const sel = (key, label, opts, val) => `<label>${label}<select data-chg="rf" data-f="${key}"><option value="">הכול</option>${opts.map((o) => `<option ${String(o) === String(val || '') ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
  return `<div>${corpsSwitcher()}<h1 style="font-size:28px;font-weight:800;margin-top:6px">חיילים בהכשרה – ${esc(c.label)}</h1><div class="mut small">${rows.length} מתוך ${visible(k).length} · לחיצה על שם פותחת את התיק</div></div>
   <div class="card"><div class="filters"><label>חיפוש לפי שם / מספר<input type="search" id="rf-q" data-inp="rfq" value="${esc(f.q || '')}" placeholder="לדוגמה: כהן או C-2101" autocomplete="off" style="min-width:200px"></label>${sel('unit', 'יחידה', c.units.map((u) => u.name), f.unit)}${sel('st', 'סטטוס', ['פעילים'].concat(TR().statuses), f.st)}${sel('team', 'צוות', [1, 2, 3, 4], f.team)}${can('fav', k) ? `<label><input type="checkbox" id="rf-fav" data-chg="rf" data-f="fav" ${f.fav ? 'checked' : ''}> במעקב אישי שלי (${favList(k).length})</label>` : ''}</div>
   <div style="overflow:auto"><table class="ctbl"><thead><tr><th>חייל/ת</th><th>תפקיד</th><th>יחידה</th><th>${esc(c.targetLabel)}</th><th>צוות</th><th>סטטוס</th><th>מעקב אחרון</th><th>${esc(A.S.period.label)}</th><th></th></tr></thead><tbody>${rows.map((x) => { const r = periodRv(x); return `<tr class="clk" data-act="cand" data-id="${x.id}"><td><span class="row" style="gap:10px;flex-wrap:nowrap">${avatar(x, 40)}<span style="white-space:nowrap"><b>${candLink(k, x.id, x.name)}</b> <bdi class="mut small" style="display:block">${x.id}</bdi></span></span></td><td>${esc(x.role)}</td><td>${esc(x.unit || '—')}</td><td>${esc(x.target || '—')}</td><td>${x.group}</td><td>${stPill(x)}</td><td>${isActive(x) ? dailyPill(lastDaily(x)) : '<span class="mut">—</span>'}</td><td>${!isActive(x) ? '<span class="mut">—</span>' : (r ? `<span class="pill p-green">${esc(r.rec)}</span>` : '<span class="pill p-orange">חסר</span>')}</td><td>${can('fav', k) ? favBtn(k, x.id) : ''}</td></tr>`; }).join('') || '<tr><td colspan="9" class="mut">אין חיילים לפי הסינון. נסו להסיר מסנן.</td></tr>'}</tbody></table></div></div>`;
};
Object.assign(ACTIONS, {
  rf: (d, t) => { A.ui.rf = Object.assign({}, A.ui.rf, { [d.f]: t.type === 'checkbox' ? t.checked : t.value }); rerender(); },
  rfq: (d, t) => { A.ui.rf = Object.assign({}, A.ui.rf, { q: t.value }); rerender(); },
});

// ---- daily follow-up: quick entry for a whole team ----
function dailyRows(k) { const f = A.ui.df || {}; return visible(k).filter(isActive).filter((x) => (!f.unit || x.unit === f.unit) && (!f.team || x.group === +f.team)); }
SCREENS.daily = (k) => {
  const c = cf(k), f = A.ui.df || {}, rows = dailyRows(k), dd = A.ui.dd || (A.ui.dd = {}), ev = A.me.role === 'מגבש/ת'; A.ui.list = rows.map((x) => x.id);
  const done = rows.filter(myToday).length, pending = rows.filter((x) => dd[x.id] && dd[x.id].level != null).length;
  const sel = (key, label, opts, val) => `<label>${label}<select data-chg="dfSet" data-f="${key}"><option value="">הכול</option>${opts.map((o) => `<option ${String(o) === String(val || '') ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
  return `<div class="row spread"><div>${corpsSwitcher()}<h1 style="font-size:28px;font-weight:800;margin-top:6px">מעקב יומי – ${fmtD(nowS())}</h1><div class="mut small">${ev ? 'צוות ' + A.me.group + ' · ' : ''}רישום קצר לכל חייל/ת. אפשר להזין רק את מי שיש מה לומר עליו היום.</div></div><div class="row"><b>${done} / ${rows.length}</b><span class="mut small">הוזנו על ידך היום</span></div></div>
   <div class="card">${ev ? '' : `<div class="filters">${sel('unit', 'יחידה', c.units.map((u) => u.name), f.unit)}${sel('team', 'צוות', [1, 2, 3, 4], f.team)}</div>`}
   <div style="overflow:auto"><table class="ctbl"><thead><tr><th>חייל/ת</th><th>איך היה היום?</th><th>נוכחות</th><th>הערה</th><th>רישום קודם</th></tr></thead><tbody>${rows.map((x) => { const m = myToday(x), d = dd[x.id] || {}, lvl = d.level != null ? d.level : (m ? m.level : null), prev = (x.daily || []).filter((e) => !(e.d === A.S.today && e.byId === A.me.id)).sort((a, b) => b.ts - a.ts)[0];
     return `<tr><td><span class="row" style="gap:8px;flex-wrap:nowrap">${avatar(x, 34)}<span style="white-space:nowrap"><b>${candLink(k, x.id, x.name)}</b>${m ? ' <span class="pill p-green">נשמר</span>' : ''}<span class="mut small" style="display:block">${esc(x.unit)} · צוות ${x.group}</span></span></span></td>
      <td><div class="seg">${TR().daily.map((w, j) => `<button type="button" class="${lvl === j ? 'on l' + j : ''}" data-act="ddLv" data-id="${x.id}" data-v="${j}">${esc(w)}</button>`).join('')}</div></td>
      <td><select data-chg="ddSet" data-f="att" data-id="${x.id}" aria-label="נוכחות">${TR().attend.map((o) => `<option ${o === (d.att || (m && m.att) || TR().attend[0]) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></td>
      <td><input type="text" id="dd-${x.id}" data-inp="ddSet" data-f="text" data-id="${x.id}" value="${esc(d.text != null ? d.text : (m ? m.text : ''))}" placeholder="לא חובה" style="min-width:220px;width:100%"></td>
      <td>${dailyPill(prev)}</td></tr>`; }).join('') || '<tr><td colspan="5" class="mut">אין חיילים פעילים לפי הסינון</td></tr>'}</tbody></table></div>
   <div class="row" style="margin-top:12px"><button class="btn" data-act="ddSave" ${pending ? '' : 'disabled'}>${pending ? 'שמירת ' + pending + ' רישומים' : 'סמנו רמה כדי לשמור'}</button>${pending ? '<button class="btn sec" data-act="ddClear">ניקוי</button>' : ''}</div></div>`;
};
Object.assign(ACTIONS, {
  dfSet: (d, t) => { A.ui.df = Object.assign({}, A.ui.df, { [d.f]: t.value }); rerender(); },
  ddLv: (d) => { const dd = A.ui.dd || (A.ui.dd = {}), o = dd[d.id] || (dd[d.id] = {}); o.level = o.level === +d.v ? null : +d.v; rerender(); },
  ddSet: (d, t) => { const dd = A.ui.dd || (A.ui.dd = {}), o = dd[d.id] || (dd[d.id] = {}); o[d.f] = t.value; },
  ddClear: () => { A.ui.dd = {}; rerender(); },
  ddSave: async () => {
    const k = corpsKey(), dd = A.ui.dd || {}, rows = Object.keys(dd).filter((id) => dd[id].level != null).map((id) => { const c = candOf(k, id), m = myToday(c); return { id, level: dd[id].level, att: dd[id].att || (m && m.att), text: dd[id].text != null ? dd[id].text : (m ? m.text : '') }; });
    if (!rows.length) return; try { const r = await api('daily', { corps: k, rows }); A.ui.dd = {}; toast('נשמרו ' + r.saved + ' רישומים'); rerender(); } catch (x) { /* toast shown */ }
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
   <div class="card"><div class="filters">${A.me.role === 'מגבש/ת' ? '' : sel('unit', 'יחידה', c.units.map((u) => u.name), f.unit) + sel('team', 'צוות', [1, 2, 3, 4], f.team)}<label><input type="checkbox" id="p-miss" data-chg="pf" data-f="miss" ${f.miss ? 'checked' : ''}> רק מי שחסר לו סטטוס (${missing})</label></div>
   <div class="mut small" style="margin-bottom:8px">הסדר: קודם מי שעוד לא הוזן, ובתוכם מי שבבדיקת הדחה, במעקב, או עם ימי "מתקשה" בשבועיים האחרונים.</div>
   <div style="overflow:auto"><table class="ctbl"><thead><tr><th>חייל/ת</th><th>יחידה · צוות</th><th>סטטוס נוכחי</th><th>שבועיים אחרונים</th><th>תקופה קודמת</th><th>${esc(P.label)}</th><th></th></tr></thead><tbody>${rows.map((x) => { const r = periodRv(x), pr = (x.reviews || []).filter((y) => y.period !== P.key).sort((a, b) => b.ts - a.ts)[0], w = (x.daily || []).filter((e) => daysAgo(e.ts) <= 14), wk = TR().daily.map((q, j) => w.filter((e) => e.level === j).length);
     return `<tr class="clk" data-act="cand" data-id="${x.id}"><td><span class="row" style="gap:8px;flex-wrap:nowrap">${avatar(x, 34)}<b>${candLink(k, x.id, x.name)}</b></span></td><td>${esc(x.unit)} · ${x.group}</td><td>${stPill(x)}</td><td>${w.length ? TR().daily.map((q, j) => (wk[j] ? `<span class="pill ${LV_CLS[j]}">${wk[j]} ${esc(q)}</span>` : '')).join(' ') : '<span class="mut small">אין רישום</span>'}</td><td>${pr ? `<span class="pill p-gray">${esc(pr.rec)}</span>` : '<span class="mut">—</span>'}</td><td>${r ? `<span class="pill ${r.rec === TR().periodRec[0] ? 'p-green' : (r.rec === TR().periodRec[1] ? 'p-orange' : 'p-red')}">${esc(r.rec)}</span> <span class="mut small">${fmtD(r.ts)}</span>` : '<span class="pill p-orange">חסר</span>'}</td><td>${edit ? `<button class="btn ${r ? 'sec' : ''} sm" data-act="pOpen" data-id="${x.id}">${r ? 'עדכון' : 'הזנה'}</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="7" class="mut">אין חיילים לפי הסינון</td></tr>'}</tbody></table></div></div>`;
};
// ---- dismissal room (חדר הדחה): every commander writes a reasoned position per candidate, then the decision is taken on that basis ----
const STANCE_CLS = ['p-red', 'p-orange', 'p-green'];
const stanceCls = (s) => STANCE_CLS[TR().stances.indexOf(s)] || 'p-gray';
const tally = (d) => TR().stances.map((s) => ({ s, n: (d.opinions || []).filter((o) => o.stance === s).length }));
const tallyHtml = (d) => tally(d).filter((t) => t.n).map((t) => `<span class="pill ${stanceCls(t.s)}">${t.n} ${esc(t.s)}</span>`).join(' ') || '<span class="mut small">עדיין אין נימוקים</span>';
function opinionsHtml(d) { return (d.opinions || []).slice().sort((a, b) => a.ts - b.ts).map((o) => `<div class="opn"><div class="row" style="gap:8px"><span class="pill ${stanceCls(o.stance)}">${esc(o.stance)}</span><b class="small">${esc(o.by)}</b><span class="mut small">${fmtD(o.ts)} · ${agoTxt(o.ts)}</span></div><div style="margin-top:3px">${esc(o.text)}</div></div>`).join(''); }
function roomCard(k, x) {
  const d = openDis(x), ops = d.opinions || [], mine = ops.find((o) => o.byId === A.me.id), min = TR().minOpinions;
  const week = (x.daily || []).filter((e) => daysAgo(e.ts) <= 7), wk = TR().daily.map((w, j) => week.filter((e) => e.level === j).length), rv = lastRv(x);
  const st = (A.ui.op || {})[x.id] || {}, stance = st.stance != null ? st.stance : (mine ? mine.stance : ''), txt = st.text != null ? st.text : (mine ? mine.text : '');
  const dc = (A.ui.dec || {})[x.id] || {}, canDismiss = ops.length >= min;
  return `<div class="card room" id="room-${x.id}">
    <div class="row spread" style="align-items:flex-start"><span class="row" style="gap:12px;flex-wrap:nowrap">${avatar(x, 56)}<span><b style="font-size:19px">${candLink(k, x.id, x.name)}</b><div class="mut small"><bdi>${x.id}</bdi> · ${esc(x.role)} · ${esc(x.unit)} · צוות ${x.group}</div></span></span><span class="row" style="gap:6px">${tallyHtml(d)}<span class="pill ${canDismiss ? 'p-blue' : 'p-gray'}">${ops.length} מתוך ${min} נימוקים נדרשים</span></span></div>
    <div class="grid g2" style="margin-top:12px"><div><div class="mut small">סיבת הבדיקה · ${esc(d.openedBy)} · ${fmtD(d.openedTs)}</div><div>${esc(d.reason)}</div></div>
     <div><div class="mut small">נתונים מהתיק</div><div class="row" style="gap:6px">${week.length ? TR().daily.map((w, j) => (wk[j] ? `<span class="pill ${LV_CLS[j]}">${wk[j]} ${esc(w)}</span>` : '')).join('') + '<span class="mut small">ב-7 הימים האחרונים</span>' : '<span class="mut small">אין מעקב יומי ב-7 הימים האחרונים</span>'}</div><div style="margin-top:4px">${rv ? `<span class="pill p-gray">${esc(rv.label)}: ${esc(rv.rec)}</span>` : '<span class="mut small">אין סטטוס תקופתי</span>'}</div></div></div>
    <div style="margin-top:12px"><div class="mut small">מעקב יומי – 4 שבועות אחרונים</div>${trend(x, 420)}</div>
    <h3 style="margin:14px 0 4px">נימוקי המפקדים (${ops.length})</h3>${opinionsHtml(d) || '<div class="mut">עדיין לא נרשמו נימוקים לבדיקה הזו.</div>'}
    ${can('opine', k) ? `<div class="opform"><b>${mine ? 'הנימוק שלי (עדכון)' : 'הנימוק שלי'}</b><div class="seg" style="margin:6px 0">${TR().stances.map((w) => `<button type="button" class="${stance === w ? 'on' : ''}" data-act="opStance" data-id="${x.id}" data-v="${esc(w)}">${esc(w)}</button>`).join('')}</div><textarea id="op-${x.id}" data-inp="opText" data-id="${x.id}" rows="2" placeholder="עובדות ומקרים שמבססים את העמדה שלך" style="width:100%">${esc(txt)}</textarea><div class="row" style="margin-top:6px"><button class="btn sec sm" data-act="opSave" data-id="${x.id}">${mine ? 'עדכון הנימוק' : 'רישום הנימוק'}</button></div></div>` : ''}
    ${can('decide', k) ? `<div class="decide"><b>החלטה – באישור מפקד/ת ההכשרה בלבד</b><div class="mut small">${canDismiss ? 'נרשמו מספיק נימוקים. ההחלטה נרשמת בתיק עם הנימוק שלך.' : 'כדי להדיח נדרשים לפחות ' + min + ' נימוקים. אפשר כבר להחליט להשאיר.'}</div><div class="small" style="margin-top:4px">במקרה של הדחה: ${(() => { const pl = nextPlace(k, x); return pl ? `<b>מעבר אוטומטי ל${esc(placeTxt(k, pl))}</b> <span class="mut">(${pl.k === k ? 'דרגה אחת מתחת באותו מסלול' : 'אין מקום פתוח במסלול – מעבר למסלול הבא'}, צורך פתוח ${needOf(pl.k, pl.unit)})</span>` : `<b>יציאה ל${esc(cf(k).fallback)}</b> <span class="mut">(אין יחידה עם צורך פתוח במסלול הזה ובמסלולים שאחריו)</span>`; })()}</div><div class="row" style="margin-top:6px;align-items:flex-end"><label>החלטה<select data-chg="decSet" data-f="decision" data-id="${x.id}"><option value="">בחרו…</option>${TR().decisions.map((o) => `<option ${o === dc.decision ? 'selected' : ''} ${o === TR().decisions[2] && !canDismiss ? 'disabled' : ''}>${esc(o)}</option>`).join('')}</select></label><label style="flex:1;min-width:220px">נימוק ההחלטה<input type="text" id="dec-${x.id}" data-inp="decSet" data-f="note" data-id="${x.id}" value="${esc(dc.note || '')}" placeholder="חובה" style="width:100%"></label><button class="btn sm" data-act="decSave" data-id="${x.id}">שמירת ההחלטה</button></div></div>` : ''}
   </div>`;
}
SCREENS.dismiss = (k) => {
  const c = cf(k), vis = visible(k), open = vis.filter(openDis).sort((a, b) => openDis(a).openedTs - openDis(b).openedTs), closed = []; vis.forEach((x) => (x.dismiss || []).filter((d) => d.status === 'נסגרה').forEach((d) => closed.push({ x, d }))); closed.sort((a, b) => b.d.decidedTs - a.d.decidedTs);
  A.ui.list = open.map((x) => x.id);
  return `<div>${corpsSwitcher()}<h1 style="font-size:28px;font-weight:800;margin-top:6px">חדר הדחה – ${esc(c.label)}</h1><div class="mut small">כל מפקד/ת רושם/ת נימוק על כל מועמד/ת להדחה, ועל בסיס הנימוקים מתקבלת ההחלטה. פתיחת בדיקה אינה הדחה.${can('opine', k) || can('decide', k) ? '' : ' צפייה בלבד.'}</div></div>
   <div class="grid g3" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))"><div class="kpi"><b>${open.length}</b><span>מועמדים להדחה בחדר</span></div><div class="kpi"><b>${open.filter((x) => (openDis(x).opinions || []).length >= TR().minOpinions).length}</b><span>מוכנים להחלטה</span></div><div class="kpi"><b>${can('opine', k) ? open.filter((x) => !(openDis(x).opinions || []).some((o) => o.byId === A.me.id)).length : '—'}</b><span>ממתינים לנימוק שלך</span></div></div>
   ${open.map((x) => roomCard(k, x)).join('') || '<div class="card"><h2>החדר ריק</h2><p class="mut">אין כרגע מועמדים להדחה. בדיקה נפתחת מתיק החייל/ת, או כשסטטוס תקופתי מסתכם ב"מועמד/ת להדחה".</p></div>'}
   <div class="card"><h2>בדיקות שנסגרו (${closed.length})</h2>${closed.map(({ x, d }) => `<details class="tl"><summary><span class="row spread" style="display:inline-flex;width:calc(100% - 24px)"><span><b>${candLink(k, x.id, x.name)}</b> <span class="mut small">${esc(x.unit)}</span></span><span class="row"><span class="pill ${d.decision === TR().decisions[2] ? 'p-gray' : 'p-green'}">${esc(d.decision)}</span>${d.movedTo ? `<span class="pill p-orange">עבר/ה ל${esc(d.movedTo)}</span>` : (d.exitTo ? `<span class="pill p-gray">יצא/ה ל${esc(d.exitTo)}</span>` : '')}<span class="mut small">${fmtD(d.decidedTs)} · ${esc(d.decidedBy)} · ${(d.opinions || []).length} נימוקים</span></span></span></summary><div class="mut small" style="margin-top:6px">סיבת הבדיקה: ${esc(d.reason)}</div><div style="margin:2px 0 6px"><b>נימוק ההחלטה:</b> ${esc(d.note)}</div>${opinionsHtml(d)}</details>`).join('') || '<span class="mut">עדיין לא נסגרו בדיקות.</span>'}</div>`;
};
Object.assign(ACTIONS, {
  opStance: (d) => { const o = A.ui.op || (A.ui.op = {}); (o[d.id] || (o[d.id] = {})).stance = d.v; rerender(); },
  opText: (d, t) => { const o = A.ui.op || (A.ui.op = {}); (o[d.id] || (o[d.id] = {})).text = t.value; },
  opSave: async (d) => {
    const k = corpsKey(), c = candOf(k, d.id), mine = (openDis(c).opinions || []).find((o) => o.byId === A.me.id), st = (A.ui.op || {})[d.id] || {};
    try { await api('dismiss-opinion', { corps: k, id: d.id, stance: st.stance != null ? st.stance : (mine ? mine.stance : ''), text: st.text != null ? st.text : (mine ? mine.text : '') }); if (A.ui.op) delete A.ui.op[d.id]; toast('הנימוק נרשם'); rerender(); } catch (x) { /* toast shown */ }
  },
  decSet: (d, t) => { const o = A.ui.dec || (A.ui.dec = {}); (o[d.id] || (o[d.id] = {}))[d.f] = t.value; },
  decSave: async (d) => {
    const k = corpsKey(), c = candOf(k, d.id), v = (A.ui.dec || {})[d.id] || {};
    const nu = placeTxt(k, nextPlace(k, c));
    if (v.decision === TR().decisions[2] && !confirm('להדיח את ' + c.name + ' מ' + c.unit + '? ' + (nu ? 'החייל/ת יעבור/תעבור אוטומטית ל' + nu + '.' : 'החייל/ת ייצא/תצא מהמסלול ל' + cf(k).fallback + '.') + ' ההחלטה נרשמת בתיק ואי אפשר לבטל אותה מהמערכת.')) return;
    try { const r = await api('dismiss-decide', { corps: k, id: d.id, decision: v.decision || '', note: v.note || '' }); if (A.ui.dec) delete A.ui.dec[d.id]; toast(r.movedTo ? c.name + ' הודח/ה והועבר/ה ל' + r.movedTo + (r.movedTrack ? ' (' + r.movedTrack + ')' : '') : (r.exitTo ? c.name + ' הודח/ה ויוצא/ת ל' + r.exitTo : 'ההחלטה נשמרה: ' + v.decision)); rerender(); } catch (x) { /* toast shown */ }
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
    <div class="filters"><label>שם<input type="text" id="in-name" data-inp="inSet" data-f="name" value="${esc(f.name || '')}" placeholder="שם פרטי ואות משפחה" ${ok ? '' : 'disabled'}></label>${sel('role', 'תפקיד', c.roles)}${sh ? `<label>יחידה<input type="text" value="${esc(A.me.unit)}" disabled></label>` : sel('unit', 'יחידה', c.units.map((u) => u.name))}${sel('target', esc(c.targetLabel), A.cfg.TARGETS[k])}${sel('group', 'צוות', [1, 2, 3, 4])}${sel('med', 'מגבלות רפואיות', A.cfg.MEDS, 'לא הוזן')}<label>פרופיל<input type="text" inputmode="numeric" id="in-profile" data-inp="inSet" data-f="profile" value="${esc(f.profile || '')}" placeholder="לא חובה" style="width:110px" ${ok ? '' : 'disabled'}></label></div>
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
    ['מעקב יומי', [['תאריך', 'מס׳', 'שם', 'רמה', 'נוכחות', 'הערה', 'מזין/ה']].concat(v.flatMap((x) => (x.daily || []).map((e) => [e.d, x.id, x.name, TR().daily[e.level], e.att, e.text, e.by])).sort((a, b) => (a[0] < b[0] ? 1 : -1)))],
    ['סטטוס תקופתי', [['תקופה', 'מס׳', 'שם', 'המלצה', 'סיכום', 'מזין/ה', 'תאריך']].concat(v.flatMap((x) => (x.reviews || []).map((r) => [r.label, x.id, x.name, r.rec, r.summary, r.by, fmtD(r.ts)])))],
    ['בדיקות הדחה', [['מס׳', 'שם', 'מצב', 'נפתחה', 'פותח/ת', 'סיבה', 'החלטה', 'מחליט/ה', 'תאריך החלטה', 'נימוק ההחלטה', 'נימוקי המפקדים']].concat(v.flatMap((x) => (x.dismiss || []).map((d) => [x.id, x.name, d.status, fmtD(d.openedTs), d.openedBy, d.reason, d.decision || '', d.decidedBy || '', d.decidedTs ? fmtD(d.decidedTs) : '', d.note || '', (d.opinions || []).map((o) => o.by + ' – ' + o.stance + ': ' + o.text).join(' | ')])))],
    ['יומן פעילות', logRows(k)],
  ];
}
SCREENS.log = (k) => `<div class="row spread"><div>${corpsSwitcher()}<h1 style="font-size:28px;font-weight:800;margin-top:6px">יומן וייצוא – ${esc(cf(k).label)}</h1><div class="mut small">כל פעולה במערכת נרשמת כאן עם מי ומתי</div></div><div class="row no-print"><button class="btn" data-act="expAll">ייצוא Excel (5 גיליונות)</button><button class="btn sec" data-act="expPrint">הדפסה / PDF</button></div></div>
   <div class="card">${tbl(logRows(k))}</div>`;
Object.assign(ACTIONS, {
  expAll: () => { const k = corpsKey(); auditEvent('export', 'training xlsx'); downloadBook('training-' + k + '.xlsx', exportSheets(k)); toast('הקובץ הורד'); },
  expPrint: () => { auditEvent('export', 'log print'); window.print(); },
});

// ---- settings (admin) ----
SCREENS.settings = () => `<div><h1 style="font-size:28px;font-weight:800">הגדרות</h1><div class="mut small">זמין למנהל/ת מערכת בלבד</div></div>
   <div class="card"><h2>סטטוס תקופתי</h2><div class="row"><label>תדירות<select data-chg="stPeriod">${TR().periods.map((p) => `<option ${p === A.S.settings.period ? 'selected' : ''}>${p}</option>`).join('')}</select></label><span class="mut small">התקופה הנוכחית: ${esc(A.S.period.label)}. שינוי התדירות לא מוחק סיכומים קיימים.</span></div></div>
   <div class="card"><h2>צורכי מערכת – מקומות פתוחים ביחידות</h2><div class="mut small" style="margin-bottom:8px">חייל/ת שמודח/ת עובר/ת אוטומטית ליחידה בדרגה אחת נמוכה יותר באותו מסלול, לזו שיש בה הכי הרבה מקומות פתוחים. אם אין מקום במסלול – למסלול הבא${cf(corpsKey()).nextTrack ? ' (' + esc(cf(cf(corpsKey()).nextTrack).corps) + ')' : ' (אין)'}, ואם גם שם אין – ל"${esc(cf(corpsKey()).fallback)}". הדרגות וסדר המסלולים כאן להמחשה בלבד ואינם דירוג רשמי.</div>${corpsSwitcher()}<div style="overflow:auto;margin-top:8px"><table><thead><tr><th>יחידה</th><th>דרגה</th><th>מקומות פתוחים</th></tr></thead><tbody>${cf(corpsKey()).units.map((u) => `<tr><td><b>${esc(u.name)}</b></td><td>${u.tier || 1}</td><td><input type="number" min="0" max="99" value="${needOf(corpsKey(), u.name)}" data-chg="needSet" data-u="${esc(u.name)}" aria-label="מקומות פתוחים" style="width:90px"></td></tr>`).join('')}</tbody></table></div></div>
   <div class="card"><h2>נתוני הדגמה</h2><div class="row"><button class="btn sec" data-act="factory">איפוס לנתוני ההדגמה</button><span class="mut small">מוחק את כל מה שהוזן ומחזיר את נתוני הדמו.</span></div></div>
   ${A.auth ? secCards() : ''}${A.ui.tempPw ? tempPwModal() : ''}`;
SCREENS.settings.after = () => { if (A.auth && !A.ui.adm) ACTIONS.admLoad(); };
Object.assign(ACTIONS, {
  needSet: async (d, t) => { try { await api('needs', { corps: corpsKey(), unit: d.u, need: t.value }); toast('הצורך עודכן'); } catch (x) { /* toast shown */ } },
  stPeriod: async (d, t) => { try { await api('settings', { period: t.value }); toast('הסטטוס התקופתי יוזן לפי ' + t.value); } catch (x) { /* toast shown */ } },
  factory: async () => { if (!confirm('לאפס את כל הנתונים בכל המסלולים לנתוני ההדגמה? כל מה שהוזן יימחק.')) return; try { await api('factory-reset', {}); toast('המערכת אופסה לנתוני ההדגמה'); } catch (x) { /* toast shown */ } },
});
