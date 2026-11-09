// Draft room + live board
function myUnitName(k) { return A.me.role === 'שלישות' && A.me.corps === k ? A.me.unit : cf(k).myUnit; }
const isHumanMine = (k) => A.me.role === 'שלישות' && A.me.corps === k;

function clockCard(k) {
  const d = draftInfo(k), mine = isHumanMine(k);
  if (d.finished) return `<div class="clock done"><div><div class="small">הדראפט הסתיים</div><h2 style="color:#fff;margin:0">${esc(cf(k).label)}</h2><div class="small">כל הבחירות בחדר בוצעו</div></div><div class="t">✓</div></div>`;
  const myTurn = mine && d.slot.u === A.me.unit;
  const next = d.order[d.picks.length + 1];
  return `<div class="clock ${myTurn ? 'me' : ''}"><div><div class="small">${myTurn ? 'התור שלכם לבחור' : 'על השעון'}</div><h2 style="color:#fff;margin:0">${esc(d.slot.u)}</h2>
   <div class="small">סבב ${d.slot.r} · בחירה ${d.picks.length + 1} מתוך ${d.order.length} · הבאה בתור: ${esc(next ? next.u : '—')}</div></div>
   <div class="ringwrap"><div class="ring" id="clkring" style="--p:${clockPct().toFixed(1)}"><div class="t" id="clk">${clockText()}</div></div><div class="small">זמן לבחירה</div></div></div>`;
}

function unitChips(k) {
  const d = draftInfo(k), me = myUnitName(k);
  return `<div class="row"><span class="mut small">יחידות בחדר:</span>${cf(k).units.map((u) => {
    const turn = d.slot && d.slot.u === u.name;
    return `<span class="pill ${u.name === me ? 'p-green' : 'p-gray'}" style="${turn ? 'outline:2px solid var(--amber)' : ''}">${esc(u.name)}${u.name === me ? ' · שלכם' : ''}${turn ? ' · בוחרת' : ''}</span>`;
  }).join('')}</div>`;
}

function needsCard(k) {
  const unit = unitOf(k, myUnitName(k)), c = cf(k);
  const roles = Object.keys(unit.quota);
  const total = roles.reduce((a, r) => a + unit.quota[r], 0), got = roles.reduce((a, r) => a + Math.min(unit.quota[r], countRole(k, unit.name, r)), 0);
  const th = c.stats.filter((s) => unit.th[s.k] != null).map((s) => s.l + (s.low ? ' עד ' : ' לפחות ') + unit.th[s.k] + ' ' + s.u);
  if (unit.noMed) th.push('ללא מגבלות רפואיות');
  return `<div class="card"><div class="row spread"><h2 style="margin:0">צורכי ${esc(unit.name)}</h2><span class="mut small">${esc(unit.desc)} · קדימות ${A.cfg.PR ? '' : ['גבוהה', 'רגילה', 'נמוכה'][unit.prio]}</span></div>
   <div class="row" style="margin:12px 0"><div><div class="mut small">מכסות שמולאו</div><b style="font-size:26px">${got} / ${total}</b></div>
   ${roles.map((r) => { const h = countRole(k, unit.name, r), q = unit.quota[r]; return `<div class="kpi" style="padding:8px 14px"><b style="font-size:20px">${h} / ${q}</b><span>${esc(r)}</span></div>`; }).join('')}</div>
   <div><b>תנאי סף של היחידה</b><div class="mut">${th.length ? esc(th.join(' · ')) : 'אין תנאי סף'}</div></div>
   <div class="mut small" style="margin-top:6px">נימוק הביקוש: ${esc(unit.why)}</div>
   <div class="row spread" style="margin-top:10px"><span class="mut small">המערכת בודקת עמידה בתנאי סף ומסמנת פערים. היא לא מדרגת אנשים ולא מחשבת ציון מסכם.</span>
   ${isHumanMine(k) ? '<button class="btn sec sm" data-act="editTh">עריכת מכסות ותנאי סף</button>' : ''}</div></div>`;
}

function filtered(k) {
  const f = A.ui.f || {}, unit = unitOf(k, myUnitName(k)), d = draftInfo(k), c = cf(k);
  const ti = c.traits.indexOf(f.trait);
  return cs(k).cands.filter((x) => {
    if (f.role && f.role !== 'הכול' && x.role !== f.role) return false;
    if (ti >= 0 && x.lv[ti] !== 2) return false;
    if (f.rec && f.rec !== 'הכול' && x.rec !== f.rec) return false;
    if (f.fit && fitBad(k, x, unit).length) return false;
    if (f.free && d.takenBy[x.id]) return false;
    return true;
  });
}

SCREENS.room = (k) => {
  const c = cf(k), d = draftInfo(k), f = A.ui.f || {}, unit = unitOf(k, myUnitName(k));
  const avail = cs(k).cands.length - d.picks.length;
  const rows = filtered(k);
  const myTurn = isHumanMine(k) && !d.finished && d.slot.u === A.me.unit;
  const sel = (id, label, opts, val) => `<label>${label}<select id="${id}" data-chg="flt" data-f="${id.slice(2)}">${opts.map((o) => `<option ${o === (val || 'הכול') ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
  const log = d.picks.slice().reverse().slice(0, 12).map((p) => `<div class="row" style="padding:5px 0;border-bottom:1px solid var(--line2)"><b>#${p.n}</b><span>${esc(p.unit)} בחרה את ${esc(candOf(k, p.id).name)} (${esc(candOf(k, p.id).role)})${p.auto ? ' <span class="mut small">· אוטומטי</span>' : ''}</span></div>`).join('') || '<span class="mut">עדיין לא בוצעו בחירות</span>';
  return `<div class="row spread"><div>${corpsSwitcher()}<h1 style="font-size:28px;font-weight:800;margin-top:6px">חדר בחירה – ${esc(c.label)}</h1><div class="mut small">דראפט נפרד לכל חיל · סדר בחירה מתחלף בכל סבב</div></div>
    ${can('undo', k) || can('reset', k) ? `<div class="row">${can('undo', k) ? `<button class="btn sec" data-act="undo" ${d.picks.length ? '' : 'disabled'}>ביטול הבחירה האחרונה</button>` : ''}${can('reset', k) ? '<button class="btn sec" data-act="reset">איפוס הדראפט</button>' : ''}</div>` : ''}</div>
   <div class="grid g3"><div class="kpi"><span>סבב</span><b>${d.finished ? c.rounds : d.slot.r} מתוך ${c.rounds}</b></div><div class="kpi"><span>בחירה</span><b>${Math.min(d.picks.length + 1, d.order.length)} מתוך ${d.order.length}</b></div><div class="kpi"><span>פנויים במאגר</span><b>${avail}</b></div></div>
   ${unitChips(k)}${clockCard(k)}
   ${isHumanMine(k) ? needsCard(k) : '<div class="demo-note">צפייה בלבד – רק שלישות היחידה בוחרת. היחידות האחרות בוחרות אוטומטית כשאין משתמש מחובר.</div>'}
   <div class="card"><h2>מאגר מועמדים – ${esc(c.corps)} (${cs(k).cands.length})</h2><div class="mut small" style="margin-bottom:10px">רק מועמדים שסווגו ל${esc(c.label)}</div>
   <div class="filters">${sel('f-role', 'סינון לפי תפקיד', ['הכול'].concat(c.roles), f.role)}${sel('f-trait', 'חוזקה נדרשת', ['הכול'].concat(c.traits), f.trait)}${sel('f-rec', 'המלצת מגבש', ['הכול'].concat(A.cfg.RECS), f.rec)}
    <label style="flex-direction:row;align-items:center;gap:6px"><input type="checkbox" id="f-fit" data-chg="flt" data-f="fit" ${f.fit ? 'checked' : ''}> עומדים בתנאי הסף</label>
    <label style="flex-direction:row;align-items:center;gap:6px"><input type="checkbox" id="f-free" data-chg="flt" data-f="free" ${f.free ? 'checked' : ''}> פנויים בלבד</label></div>
   <div style="overflow:auto"><table><thead><tr><th>מועמד/ת</th><th>תפקיד</th><th>המלצת מגבש</th><th>תנאי הסף שלכם</th><th>חוזקות בולטות</th><th>סטטוס</th><th></th></tr></thead><tbody>
   ${rows.map((x) => { const tk = d.takenBy[x.id]; return `<tr class="clk ${tk ? 'taken' : ''}" data-act="cand" data-id="${x.id}"><td><b>${esc(x.name)}</b> <span class="mut small">${x.id}</span></td><td>${esc(x.role)}</td><td>${recPill(x.rec)}</td><td>${fitCell(k, x, unit)}</td><td>${strengthChips(k, x)}</td>
     <td>${tk ? `<span class="pill p-gray">נבחר/ה · ${esc(tk.unit)}</span>` : '<span class="pill p-green">פנוי/ה</span>'}</td>
     <td>${myTurn && !tk ? `<button class="btn sm" data-act="pick" data-id="${x.id}">בחירה</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="7" class="mut">אין מועמדים לפי הסינון</td></tr>'}</tbody></table></div></div>
   <div class="card"><h2>יומן בחירות</h2>${log}</div>
   ${A.ui.cand ? drawer(k, A.ui.cand) : ''}${A.ui.editTh ? thModal(k) : ''}`;
};

function radar(k, c) {
  const t = cf(k).traits, n = t.length, R = 80, cx = 130, cy = 120;
  const pt = (i, r) => [cx + r * Math.sin(2 * Math.PI * i / n), cy - r * Math.cos(2 * Math.PI * i / n)];
  const ring = (f) => t.map((_, i) => pt(i, R * f).map((v) => v.toFixed(1)).join(',')).join(' ');
  const val = t.map((_, i) => pt(i, R * (0.2 + 0.4 * c.lv[i])).map((v) => v.toFixed(1)).join(',')).join(' ');
  return `<svg viewBox="0 0 260 240" width="260" role="img" aria-label="תרשים חוזקות">${[1, .66, .33].map((f) => `<polygon points="${ring(f)}" fill="none" stroke="var(--line)"/>`).join('')}
   <polygon points="${val}" fill="var(--green)" fill-opacity=".22" stroke="var(--green)" stroke-width="2"/>
   ${t.map((x, i) => { const p = pt(i, i === 0 ? 100 : 98); return `<text x="${p[0].toFixed(1)}" y="${(p[1] + 4).toFixed(1)}" text-anchor="middle" font-size="11" class="svgt">${esc(x)}</text><text x="${p[0].toFixed(1)}" y="${(p[1] + 16).toFixed(1)}" text-anchor="middle" font-size="10" class="svgm">${WORDS[c.lv[i]]}</text>`; }).join('')}</svg>`;
}

function statBars(k, c) {
  return cf(k).stats.map((s) => {
    const vals = cs(k).cands.map((x) => x.stats[s.k]).filter((v) => v != null), v = c.stats[s.k];
    if (v == null) return `<div style="margin:8px 0"><div class="row spread"><span>${esc(s.l)}</span><b class="pill p-red">חסר נתון</b></div><div class="mut small">הנתון לא הוזן עדיין</div></div>`;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const pos = (x) => Math.max(0, Math.min(100, (s.low ? s.max - x : x - s.min) / (s.max - s.min) * 100));
    const worse = vals.filter((x) => (s.low ? x > v : x < v)).length;
    return `<div style="margin:10px 0"><div class="row spread"><span>${esc(s.l)}</span><b>${v} ${esc(s.u)}</b></div><div class="bar"><i style="width:${Math.max(4, pos(v)).toFixed(0)}%"></i><u style="inset-inline-start:${pos(avg).toFixed(0)}%"></u></div><div class="mut small">אחוזון ${Math.round(worse / vals.length * 100)} במאגר ה${esc(cf(k).short)}</div></div>`;
  }).join('');
}

function navBar(id) {
  const nav = A.ui.nav || [], i = nav.indexOf(id); if (i < 0 || nav.length < 2) return '';
  const nm = (x) => { const c = candOf(corpsKey(), x); return c ? c.name : ''; };
  return `<div class="row spread" style="background:var(--bg2);border-radius:10px;padding:6px 8px"><button class="btn sec sm" data-act="navPrev" aria-label="הקודם">→ ${esc(nm(nav[(i - 1 + nav.length) % nav.length]))}</button><b class="small">${i + 1} מתוך ${nav.length}</b><button class="btn sec sm" data-act="navNext" aria-label="הבא">${esc(nm(nav[(i + 1) % nav.length]))} ←</button></div><div class="mut small" style="text-align:center;margin-top:-8px">אפשר גם עם החצים במקלדת (← הבא, → הקודם)</div>`;
}
function drawer(k, id) {
  const c = candOf(k, id); if (!c) return '';
  const d = draftInfo(k), tk = d.takenBy[id], unit = unitOf(k, myUnitName(k));
  const myTurn = isHumanMine(k) && !d.finished && d.slot.u === A.me.unit && !tk;
  const miss = missingOf(k, c);
  return `<div class="drawer-bg" data-act="closeCand"><aside class="drawer" role="dialog" aria-label="תיק מועמד">
   <div class="row spread"><div><div class="small" style="color:var(--orange);font-weight:600">תיק מועמד · ${esc(cf(k).corps)}</div><h2 style="margin:0;font-size:24px">${esc(c.name)}</h2><div class="mut small">${c.id} · ${esc(c.role)} · אזור ${esc(c.area)} · קבוצה ${c.group}</div></div><button class="btn sec sm" data-act="closeCand">סגירה ✕</button></div>
   ${navBar(id)}
   <div class="row">${recPill(c.rec)}<span class="pill p-gray">פרופיל ${c.profile} · ${esc(c.med)}</span>${tk ? `<span class="pill p-gray">נבחר/ה · ${esc(tk.unit)}</span>` : ''}${miss.length ? `<span class="pill p-orange">חסר בתיק: ${esc(miss.join(', '))}</span>` : ''}</div>
   <div class="card" style="padding:12px">${statBars(k, c)}<div class="mut small">הסימון הכתום: ממוצע המאגר. תיאור בלבד, לא דירוג.</div></div>
   <div style="text-align:center">${radar(k, c)}</div>
   <div><b>כישורים שנצפו</b><div class="row" style="margin-top:4px">${(c.skills || []).map((s) => `<span class="pill p-blue">${esc(s)}</span>`).join('') || '—'}</div></div>
   <div><b>התרשמות המגבש/ת</b><p style="margin:4px 0">${esc(c.obs) || '<span class="mut">טרם הוזנה</span>'}</p>${c.summary ? `<p class="mut small" style="margin:0">סיכום: ${esc(c.summary)}</p>` : ''}</div>
   <div class="card" style="padding:12px"><b>התאמה לכל יחידה ב${esc(cf(k).label)}</b>${cf(k).units.map((u0) => { const u = unitOf(k, u0.name), bad = fitBad(k, c, u); return `<div class="row spread" style="padding:5px 0"><span>${esc(u.name)}${u.name === myUnitName(k) ? ' (שלכם)' : ''}</span>${bad.length ? `<span class="pill p-orange">חסר: ${esc(bad.map((x) => x.s).join(', '))}</span>` : '<span class="pill p-green">עומד/ת בכל התנאים</span>'}</div>`; }).join('')}</div>
   ${myTurn ? `<button class="btn" style="padding:13px" data-act="pick" data-id="${id}">בחירה ל${esc(A.me.unit)}</button>` : ''}
   ${R().pages.includes('eval') && A.me.role !== 'מגבש/ת' ? `<a href="#/eval" class="small" data-act="goEval" data-id="${id}">תיק מועמד מלא ודף מגבש ←</a>` : ''}</aside></div>`;
}

function thModal(k) {
  const u = unitOf(k, A.me.unit);
  return `<div class="drawer-bg" style="align-items:center" data-act="closeTh"><div class="modal" role="dialog" aria-label="עריכת תנאי סף">
   <h2 style="margin:0">עריכת צרכים – ${esc(u.name)}</h2>
   <div><b>מכסות לפי תפקיד</b><div class="mut small">כמה מועמדים נדרשים לכל תפקיד (0 = לא נדרש). אפשר להוריד מתחת למה שכבר נבחר.</div>
   <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-top:8px">${cf(k).roles.map((r, i) => `<label class="row spread">${esc(r)} <span class="row" style="gap:4px"><span class="mut small">נבחרו ${countRole(k, u.name, r)}</span><input type="number" min="0" max="9" id="q-${i}" style="width:70px" value="${u.quota[r] || 0}"></span></label>`).join('')}</div></div>
   <b>תנאי סף</b><p class="mut small" style="margin:0">השאירו ריק כדי לבטל תנאי. עדכון התנאים ישפיע מיד על סימוני ההתאמה.</p>
   ${cf(k).stats.map((s) => `<label class="row spread">${esc(s.l)} (${s.low ? 'עד' : 'לפחות'}, ${esc(s.u)})<input type="number" step="any" id="th-${s.k}" style="width:120px" value="${u.th[s.k] == null ? '' : u.th[s.k]}"></label>`).join('')}
   <label class="row"><input type="checkbox" id="th-med" ${u.noMed ? 'checked' : ''}> ללא מגבלות רפואיות</label>
   <div class="row"><button class="btn" data-act="saveTh">שמירה</button><button class="btn sec" data-act="closeTh">ביטול</button></div></div></div>`;
}

Object.assign(ACTIONS, {
  flt: (d, t) => { A.ui.f = Object.assign({}, A.ui.f, { [d.f]: t.type === 'checkbox' ? t.checked : t.value }); rerender(); },
  cand: (d) => { A.ui.nav = filtered(corpsKey()).map((x) => x.id); A.ui.cand = d.id; rerender(); },
  navPrev: () => navStep(-1),
  navNext: () => navStep(1),
  closeCand: () => { A.ui.cand = null; rerender(); },
  goEval: (d) => { A.ui.evalCand = d.id; A.ui.cand = null; },
  pick: async (d, t, e) => {
    e.stopPropagation(); const k = corpsKey(), c = candOf(k, d.id);
    if (!confirm(`לבחור את ${c.name} (${c.role}) ל${A.me.unit}?`)) return;
    try { await api('pick', { corps: k, id: d.id }); A.ui.cand = null; toast('הבחירה נשמרה: ' + c.name); rerender(); } catch (x) { /* toast shown */ }
  },
  reset: async () => { if (confirm('לאפס את הדראפט של החיל? כל הבחירות יימחקו.')) { await api('reset', { corps: corpsKey() }); toast('הדראפט אופס'); } },
  undo: async () => { const k = corpsKey(), l = draftInfo(k).picks.slice(-1)[0]; if (!l) return; await api('undo', { corps: k }); toast('הבחירה האחרונה בוטלה'); },
  editTh: () => { A.ui.editTh = true; rerender(); },
  closeTh: () => { A.ui.editTh = false; rerender(); },
  saveTh: async () => {
    const k = corpsKey(), th = {}; cf(k).stats.forEach((s) => { const v = $('#th-' + s.k).value; if (v !== '') th[s.k] = Number(v); });
    const quota = {}; cf(k).roles.forEach((r, i) => { quota[r] = $('#q-' + i).value; });
    await api('thresholds', { corps: k, th, quota, noMed: $('#th-med').checked }); A.ui.editTh = false; toast('המכסות ותנאי הסף עודכנו'); rerender();
  },
});

// ---------------- live board ----------------
function standoutOf(k) {
  const d = draftInfo(k), units = cf(k).units;
  return cs(k).cands.filter((x) => !d.takenBy[x.id]).map((x) => ({ x, s: strengths(k, x), fits: units.filter((u) => !fitBad(k, x, u).length).length }))
    .sort((a, b) => b.s.length - a.s.length || b.fits - a.fits).slice(0, 6);
}
function navStep(dir) {
  const nav = A.ui.nav || [], i = nav.indexOf(A.ui.cand); if (i < 0 || nav.length < 2) return;
  A.ui.cand = nav[(i + dir + nav.length) % nav.length]; rerender();
}
document.addEventListener('keydown', (e) => {
  if (!A.ui.cand || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
  if (e.key === 'ArrowLeft') navStep(1); else if (e.key === 'ArrowRight') navStep(-1); else if (e.key === 'Escape') { A.ui.cand = null; rerender(); }
});
SCREENS.board = (k) => {
  const c = cf(k), d = draftInfo(k), P = d.picks;
  const last = P[P.length - 1];
  const unit = c.units;
  const cellFor = (r, uname) => {
    const idx = d.order.findIndex((o) => o.r === r && o.u === uname), p = P[idx], cand = p && candOf(k, p.id);
    const isNow = idx === P.length, mine = uname === (isHumanMine(k) ? A.me.unit : c.myUnit);
    return `<td><div class="cell ${p ? 'pick' : ''} ${isNow ? 'now' : ''} ${mine ? 'mine' : ''}"><div class="mut small">#${idx + 1}${isNow ? ' · על השעון' : ''}</div>${cand ? `<b>${esc(cand.name)}</b><div class="small">${esc(cand.role)}</div>` : (isNow ? 'בוחרים כעת…' : '—')}</div></td>`;
  };
  const standout = standoutOf(k);
  const wanted = {}, got = {};
  unit.forEach((u) => Object.keys(u.quota).forEach((r) => { wanted[r] = (wanted[r] || 0) + u.quota[r]; got[r] = (got[r] || 0) + Math.min(u.quota[r], countRole(k, u.name, r)); }));
  return `<div class="row spread">${corpsSwitcher()}</div>
   <div class="grid g2"><div class="card"><h2>${d.finished ? 'הדראפט הסתיים' : 'על השעון · ' + esc(c.corps)}</h2>${d.finished ? '<p>כל הבחירות בוצעו.</p>' : `<div class="row spread"><div><h2 style="font-size:26px;margin:0">${esc(d.slot.u)}</h2><div class="mut small">סבב ${d.slot.r} · בחירה ${P.length + 1} מתוך ${d.order.length}</div><div class="mut small">מחפשת: ${Object.keys(unitOf(k, d.slot.u).quota).map((r) => r + ' ×' + (unitOf(k, d.slot.u).quota[r] - countRole(k, d.slot.u, r))).filter((s) => !/×0$|×-/.test(s)).join(', ') || '—'}</div></div><div style="text-align:center"><div style="font-size:38px;font-weight:900" id="clk">${clockText()}</div><div class="mut small">זמן לבחירה</div></div></div>`}
   ${can('advance', k) ? `<div class="row no-print" style="margin-top:10px"><button class="btn sec sm" data-act="simNext" ${d.finished ? 'disabled' : ''}>הדמיית הבחירה הבאה</button><button class="btn sec sm" data-act="reset2">איפוס</button></div>` : ''}</div>
   <div class="card"><h2>הבחירה האחרונה</h2>${last ? `<div class="row spread"><div><b style="font-size:22px">${esc(candOf(k, last.id).name)}</b><div class="mut">${esc(candOf(k, last.id).role)} · נבחר/ה ע״י ${esc(last.unit)} · #${last.n}</div></div><div>${strengthChips(k, candOf(k, last.id))}</div></div>` : '<span class="mut">טרם נבחר איש</span>'}</div></div>
   <div class="card board"><h2>לוח הדראפט – ${esc(c.label)}</h2><div class="mut small" style="margin-bottom:8px">${P.length} מתוך ${d.order.length} בחירות · סדר מתחלף בכל סבב</div>
   <table><thead><tr><th></th>${unit.map((u) => `<th>${esc(u.name)}</th>`).join('')}</tr></thead><tbody>${Array.from({ length: c.rounds }, (_, i) => `<tr><th>סבב ${i + 1}<div class="mut small">${i % 2 ? '← משמאל' : '→ מימין'}</div></th>${unit.map((u) => cellFor(i + 1, u.name)).join('')}</tr>`).join('')}</tbody></table></div>
   <div class="grid g2">${canFile() ? `<div class="card"><h2>הפנויים הבולטים</h2><div class="mut small" style="margin-bottom:6px">לפי מספר החוזקות הבולטות מהגיבוש · לא ציון</div>${standout.map((o, i) => `<div class="row spread clk" style="padding:7px 0;border-bottom:1px solid var(--line2);cursor:pointer" data-act="boardCand" data-id="${o.x.id}"><div><b>${i + 1}. ${esc(o.x.name)} · ${esc(o.x.role)}</b><div class="mut small">${esc(o.s.join(' · ') || '—')}</div></div><span class="pill p-blue">עומד/ת בתנאי הסף של ${o.fits} מתוך ${unit.length} יחידות</span></div>`).join('')}</div>` : ''}
   <div class="card"><h2>בחירות לפי תפקיד</h2><div class="mut small" style="margin-bottom:6px">נבחרו / מבוקשים בכל היחידות</div>${c.roles.map((r) => `<div class="row" style="margin:7px 0"><span style="min-width:110px">${esc(r)}</span><div class="bar"><i style="width:${wanted[r] ? got[r] / wanted[r] * 100 : 0}%"></i></div><b>${got[r] || 0} / ${wanted[r] || 0}</b></div>`).join('')}</div></div>
   ${A.ui.cand ? drawer(k, A.ui.cand) : ''}`;
};
Object.assign(ACTIONS, {
  simNext: () => api('advance', { corps: corpsKey(), steps: 1 }),
  reset2: async () => { if (confirm('לאפס את הדראפט של החיל?')) { await api('advance', { corps: corpsKey(), rounds: 0 }); toast('הדראפט אופס'); } },
  boardCand: (d) => { A.ui.nav = standoutOf(corpsKey()).map((o) => o.x.id); A.ui.cand = d.id; rerender(); },
});
