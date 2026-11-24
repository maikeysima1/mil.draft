// Training program (תוכנית הכשרה) and makeups (השלמות).
// The program is a fixed list of items (lessons, ranges, tests, drills) by phase and domain (A.cfg.program). An item counts as "held" for a team
// once anyone in that team has a record of it; from then on every active soldier of the team needs a record: done (with a score / time when the
// item has one), excused, or missed. Missed or unrecorded = a makeup (השלמה). Recording the makeup later replaces the record.
const PG = () => A.cfg.program;
const progRec = (c, key) => (c.prog || {})[key];
const DONE = () => PG().marks[0], MISS = () => PG().marks[1], EXEMPT = () => PG().marks[2];
// items held per team, cached per state version
function heldMap(k) {
  const key = k + '|' + A.S.version + '|' + (A.me && A.me.id);
  if (A._held && A._held.key === key) return A._held.map;
  const map = {}; cs(k).cands.forEach((c) => { const s = map[c.group] || (map[c.group] = new Set()); Object.keys(c.prog || {}).forEach((it) => s.add(it)); });
  A._held = { key, map }; return map;
}
const isHeld = (k, c, it) => !!(heldMap(k)[c.group] && heldMap(k)[c.group].has(it.k));
// the makeups of one soldier: held for the team, and missed or not recorded
function makeups(k, c) { if (!isActive(c)) return []; return PG().items.filter((it) => { if (!isHeld(k, c, it)) return false; const r = progRec(c, it.k); return !r || r.s === MISS(); }); }
function progOf(k, c) {
  const held = PG().items.filter((it) => isHeld(k, c, it)), rel = held.filter((it) => { const r = progRec(c, it.k); return !r || r.s !== EXEMPT(); }), done = rel.filter((it) => { const r = progRec(c, it.k); return r && r.s === DONE(); });
  return { held: held.length, rel: rel.length, done: done.length, total: PG().items.length, pct: rel.length ? Math.round(done.length / rel.length * 100) : 100 };
}
const fmtProg = (it, r) => (!r ? '' : (r.s !== DONE() ? r.s : (it.kind === 'time' && r.v != null ? fmtTime(r.v) : (r.v != null ? String(r.v) : '✓'))));
const progCls = (r) => (!r ? 'p-orange' : (r.s === DONE() ? 'p-green' : (r.s === MISS() ? 'p-red' : 'p-gray')));
const canProg = (k, it) => can('prog', k) || (can('progmini', k) && (!it || PG().squadDomains.includes(it.domain)));
const pgState = () => A.ui.pg || (A.ui.pg = { tab: 'mk', phase: '', domain: '', item: '', only: false, d: {} });
const domainsOf = (phase) => Array.from(new Set(PG().items.filter((it) => !phase || it.phase === phase).map((it) => it.domain)));
const progRows = (k) => { const f = pgState(); return visible(k).filter(isActive).filter((x) => !f.team || x.group === +f.team); };
// small progress card for the soldier's file
function progCard(k, c) {
  const p = progOf(k, c), mk = makeups(k, c);
  return `<div class="card"><div class="row spread"><h3 style="margin:0">תוכנית הכשרה</h3><a class="small" href="#/program" data-act="pgSoldier" data-id="${c.id}">לתוכנית ←</a></div>
   <div class="row" style="margin-top:6px"><div class="bar" style="flex:1"><i style="width:${p.pct}%"></i></div><b>${p.done} / ${p.rel}</b><span class="mut small">מהפריטים שהתקיימו (${p.pct}%)</span></div>
   ${mk.length ? `<div style="margin-top:8px"><b class="small">השלמות (${mk.length})</b><div class="phrases" style="margin-top:4px">${mk.map((it) => `<span class="pill ${progCls(progRec(c, it.k))}" title="${esc(it.phase + ' · ' + it.domain)}">${esc(it.l)}${progRec(c, it.k) ? '' : ' · אין תיעוד'}</span>`).join('')}</div></div>` : '<div class="mut small" style="margin-top:6px">אין השלמות פתוחות.</div>'}</div>`;
}
SCREENS.program = (k) => {
  const f = pgState(), rows = progRows(k), tabs = [['mk', 'השלמות'], ['rec', 'תיעוד פריט'], ['mx', 'מטריצה']];
  const all = rows.map((x) => ({ x, mk: makeups(k, x), p: progOf(k, x) })), open = all.reduce((n, r) => n + r.mk.length, 0), withMk = all.filter((r) => r.mk.length).length;
  const rel = all.reduce((n, r) => n + r.p.rel, 0), done = all.reduce((n, r) => n + r.p.done, 0);
  const teamSel = teamOnly() ? '' : `<label>צוות<select data-chg="pgSet" data-f="team"><option value="">הכול</option>${teamList().map((t) => `<option ${String(t) === String(f.team || '') ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
  let body = '';
  if (f.tab === 'mk') {
    const byItem = PG().items.map((it) => ({ it, who: all.filter((r) => r.mk.includes(it)).map((r) => r.x) })).filter((r) => r.who.length).sort((a, b) => b.who.length - a.who.length);
    body = `<div class="grid g2" style="align-items:start"><div class="card"><h2>לפי חייל/ת</h2><div class="mut small" style="margin-bottom:6px">מי שחסרים לו פריטים שכבר התקיימו לצוות (לא השתתף/ה, או שאין תיעוד).</div>${all.filter((r) => r.mk.length).sort((a, b) => b.mk.length - a.mk.length).map((r) => `<div class="tl"><div class="row spread"><span class="row" style="gap:8px;flex-wrap:nowrap">${avatar(r.x, 32)}<b>${candLink(k, r.x.id, r.x.name)}</b><span class="mut small">צוות ${r.x.group} · ${r.p.pct}%</span></span><span class="pill p-red">${r.mk.length} השלמות</span></div><div class="phrases" style="margin-top:6px">${r.mk.slice(0, 8).map((it) => `<span class="pill ${progCls(progRec(r.x, it.k))}">${esc(it.l)}</span>`).join('')}${r.mk.length > 8 ? `<span class="mut small">ועוד ${r.mk.length - 8}</span>` : ''}</div></div>`).join('') || '<div class="mut">אין השלמות פתוחות. כל הכבוד!</div>'}</div>
     <div class="card"><h2>לפי פריט</h2><div class="mut small" style="margin-bottom:6px">לכל פריט – כמה צריכים השלמה. "תיעוד השלמה" פותח את הפריט רק עם מי שחסר לו.</div>${byItem.map((r) => `<div class="tl row spread"><span><b>${esc(r.it.l)}</b> <span class="mut small">${esc(r.it.phase)} · ${esc(r.it.domain)}</span><div class="mut small">${r.who.slice(0, 5).map((x) => esc(x.name)).join(', ')}${r.who.length > 5 ? '…' : ''}</div></span><span class="row" style="gap:6px"><span class="pill p-red">${r.who.length}</span>${canProg(k, r.it) ? `<button class="btn sec sm" data-act="pgMakeup" data-item="${r.it.k}">תיעוד השלמה</button>` : ''}</span></div>`).join('') || '<div class="mut">אין פריטים עם השלמות.</div>'}</div></div>`;
  }
  if (f.tab === 'rec') {
    const items = PG().items.filter((it) => (!f.phase || it.phase === f.phase) && (!f.domain || it.domain === f.domain) && canProg(k, it)), it = PG().items.find((x) => x.k === f.item);
    const sel = (key, label, opts, val, all1) => `<label>${label}<select data-chg="pgSet" data-f="${key}">${all1 ? `<option value="">${all1}</option>` : ''}${opts.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(val || '') ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
    const heldCnt = (x) => rows.filter((s) => progRec(s, x.k)).length;
    let list = '';
    if (it) {
      const rs = rows.filter((x) => !f.only || makeups(k, x).includes(it)), d = f.d;
      const changed = rs.filter((x) => { const q = d[x.id]; if (!q) return false; const r = progRec(x, it.k); if (!q.s && !r) return false; return !r || r.s !== q.s || (q.s === DONE() && it.kind !== 'done' && String(r.v) !== String(q.v)); });
      list = `<div class="exlist">${rs.map((x) => { const r = progRec(x, it.k), q = d[x.id] || {};
        return `<div class="excard ${q.s ? 'set' : ''}"><div class="row spread" style="flex-wrap:nowrap"><span class="row" style="gap:8px;flex-wrap:nowrap">${avatar(x, 34)}<span><b>${candLink(k, x.id, x.name)}</b><span class="mut small" style="display:block">צוות ${x.group} · ${r ? 'מתועד: ' + esc(fmtProg(it, r)) + ' · ' + fmtD(r.ts) : 'אין תיעוד'}</span></span></span></div>
         <div class="seg big">${PG().marks.map((m) => `<button type="button" class="${q.s === m ? 'on ' + (m === DONE() ? 'l2' : (m === MISS() ? 'l0' : 'l1')) : ''}" data-act="pgMark" data-id="${x.id}" data-v="${esc(m)}">${esc(m)}</button>`).join('')}</div>
         ${it.kind !== 'done' && q.s === DONE() ? `<label class="small mut row" style="gap:6px">${it.kind === 'time' ? 'זמן (דק׳:שנ׳)' : 'ציון'}<input type="text" inputmode="${it.kind === 'time' ? 'text' : 'decimal'}" id="pgv-${x.id}" data-inp="pgVal" data-id="${x.id}" value="${esc(q.v == null ? '' : (it.kind === 'time' && typeof q.v === 'number' ? fmtTime(q.v) : q.v))}" placeholder="${it.kind === 'time' ? '8:45' : '0–100'}" style="width:110px"></label>` : ''}</div>`; }).join('') || '<div class="card mut">אין חיילים לתיעוד בסינון הזה.</div>'}</div>
       <div class="exbar"><b>${changed.length}</b><span class="mut small">שינויים לשמירה</span><span style="flex:1"></span><button class="btn sec" data-act="pgAll" title="מסמן ${esc(DONE())} לכל מי שעוד לא סומן/ה">כולם: ${esc(DONE())}</button><button class="btn" data-act="pgSave" ${changed.length ? '' : 'disabled'}>שמירת ${changed.length} רישומים</button></div>`;
    }
    body = `<div class="card"><div class="filters">${sel('phase', 'שלב', PG().phases.map((p) => [p, p]), f.phase, 'הכול')}${sel('domain', 'תחום', domainsOf(f.phase).map((d) => [d, d]), f.domain, 'הכול')}${sel('item', 'פריט', items.map((x) => [x.k, x.l + (it && it.k === x.k ? '' : (heldCnt(x) ? ' · התקיים' : ''))]), f.item, 'בחרו פריט…')}${teamSel}<label class="row" style="gap:6px;align-self:flex-end"><input type="checkbox" id="pg-only" data-chg="pgSet" data-f="only" ${f.only ? 'checked' : ''}> רק מי שצריך השלמה</label></div>
      ${can('progmini', k) && !can('prog', k) ? `<div class="demo-note">כמ״כ אפשר לתעד בתוכנית רק: ${esc(PG().squadDomains.join(', '))}.</div>` : ''}
      ${it ? `<div class="mut small">${esc(it.phase)} · ${esc(it.domain)} · ${it.kind === 'score' ? 'נרשם ציון' : (it.kind === 'time' ? 'נרשם זמן' : 'השתתפות')}. כולם מסומנים "${esc(DONE())}" כברירת מחדל – מסמנים רק מי שחסר/ה או פטור/ה.</div>` : '<div class="mut">בחרו פריט מהתוכנית כדי לתעד את הצוות.</div>'}</div>${list}`;
  }
  if (f.tab === 'mx') {
    const ph = f.phase || PG().phases[0], dm = f.domain && domainsOf(ph).includes(f.domain) ? f.domain : domainsOf(ph)[0], its = PG().items.filter((it) => it.phase === ph && it.domain === dm);
    body = `<div class="card"><div class="filters"><label>שלב<select data-chg="pgSet" data-f="phase">${PG().phases.map((p) => `<option ${p === ph ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label><label>תחום<select data-chg="pgSet" data-f="domain">${domainsOf(ph).map((d) => `<option ${d === dm ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></label>${teamSel}</div>
     <div class="mut small" style="margin-bottom:6px"><span class="pill p-green">✓ / ציון</span> בוצע · <span class="pill p-red">חסר</span> לא השתתף/ה · <span class="pill p-orange">?</span> התקיים לצוות ואין תיעוד · <span class="pill p-gray">פטור</span> · ריק = עוד לא התקיים לצוות</div>
     <div style="overflow:auto"><table class="ctbl mx"><thead><tr><th>חייל/ת</th>${its.map((it) => `<th title="${esc(it.l)}">${esc(it.l)}</th>`).join('')}<th>השלמות</th></tr></thead><tbody>${all.map((r) => `<tr><td style="white-space:nowrap"><b>${candLink(k, r.x.id, r.x.name)}</b> <span class="mut small">צ׳ ${r.x.group}</span></td>${its.map((it) => { const rc = progRec(r.x, it.k), held = isHeld(k, r.x, it); return `<td class="c">${rc ? `<span class="pill ${progCls(rc)}">${esc(fmtProg(it, rc))}</span>` : (held ? '<span class="pill p-orange">?</span>' : '')}</td>`; }).join('')}<td class="c">${r.mk.length ? `<span class="pill p-red">${r.mk.length}</span>` : '<span class="mut">—</span>'}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  return `<div class="row spread"><div>${corpsSwitcher()}<h1 style="font-size:28px;font-weight:800;margin-top:6px">תוכנית הכשרה והשלמות</h1><div class="mut small">${PG().items.length} פריטים ב-${PG().phases.length} שלבים. השלמה = פריט שהתקיים לצוות והחייל/ת לא השתתף/ה בו או שאין עליו תיעוד.</div></div>
    <div class="row no-print"><button class="btn sec" data-act="pgExport">ייצוא מטריצה לאקסל</button></div></div>
   <div class="grid g3" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))"><div class="kpi"><b>${rel ? Math.round(done / rel * 100) : 100}%</b><span>ביצוע מהפריטים שהתקיימו</span></div><div class="kpi"><b>${open}</b><span>השלמות פתוחות</span></div><div class="kpi"><b>${withMk} / ${all.length}</b><span>חיילים עם השלמות</span></div></div>
   <div class="row"><div class="seg">${tabs.map(([t, l]) => `<button type="button" class="${f.tab === t ? 'on' : ''}" data-act="pgTab" data-v="${t}">${l}</button>`).join('')}</div>${f.tab === 'rec' ? '' : `<div class="filters" style="margin:0">${f.tab === 'mk' ? teamSel : ''}</div>`}</div>
   ${body}`;
};
// matrix of the whole program for Excel: one row per soldier, one column per item, and the open makeups
function progAoa(k) {
  const its = PG().items, rows = progRows(k);
  return [['מס׳', 'שם', 'צוות'].concat(its.map((it) => it.phase + ' · ' + it.domain + ' · ' + it.l), ['ביצוע %', 'השלמות פתוחות', 'פירוט השלמות'])]
    .concat(rows.map((x) => { const mk = makeups(k, x), p = progOf(k, x); return [x.id, x.name, x.group].concat(its.map((it) => { const r = progRec(x, it.k); return r ? fmtProg(it, r) : (isHeld(k, x, it) ? 'אין תיעוד' : ''); }), [p.pct, mk.length, mk.map((it) => it.l).join(', ')]); }));
}
function pgInitDraft(k) { // the draft starts from what is recorded; soldiers without a record start as "done" (unless only makeups are shown)
  const f = pgState(), it = PG().items.find((x) => x.k === f.item); f.d = {}; if (!it) return;
  progRows(k).forEach((x) => { const r = progRec(x, it.k); if (r) f.d[x.id] = { s: r.s, v: r.v }; else if (!f.only) f.d[x.id] = { s: DONE(), v: null }; });
}
Object.assign(ACTIONS, {
  pgTab: (d) => { pgState().tab = d.v; if (d.v === 'rec') pgInitDraft(corpsKey()); rerender(); },
  pgSet: (d, t) => { const f = pgState(), k = corpsKey(); f[d.f] = t.type === 'checkbox' ? t.checked : t.value; if (d.f === 'phase') { f.domain = ''; if (f.tab === 'rec') f.item = ''; } if (d.f === 'domain' && f.tab === 'rec') f.item = ''; if (['item', 'only', 'team', 'phase', 'domain'].includes(d.f)) pgInitDraft(k); rerender(); },
  pgMakeup: (d) => { const f = pgState(), it = PG().items.find((x) => x.k === d.item); Object.assign(f, { tab: 'rec', phase: it.phase, domain: it.domain, item: it.k, only: true }); pgInitDraft(corpsKey()); rerender(); window.scrollTo(0, 0); },
  pgSoldier: (d, t, e) => { if (e) e.preventDefault(); A.ui.cand = null; A.ui.cf = null; Object.assign(pgState(), { tab: 'mk' }); go('program'); },
  pgMark: (d) => { const q = pgState().d[d.id] || (pgState().d[d.id] = { v: null }); q.s = q.s === d.v ? '' : d.v; rerender(); },
  pgVal: (d, t) => { const it = PG().items.find((x) => x.k === pgState().item), q = pgState().d[d.id] || (pgState().d[d.id] = { s: DONE() }); q.v = t.value.trim() === '' ? null : (it.kind === 'time' ? parseStat({ u: 'דק׳' }, t.value) : Number(String(t.value).replace(',', '.'))); t.classList.toggle('invalid', t.value.trim() !== '' && (q.v == null || isNaN(q.v))); },
  pgAll: () => { const f = pgState(), k = corpsKey(); progRows(k).filter((x) => !f.only || makeups(k, x).some((it) => it.k === f.item)).forEach((x) => { if (!f.d[x.id] || !f.d[x.id].s) f.d[x.id] = { s: DONE(), v: null }; }); rerender(); },
  pgSave: async () => {
    const k = corpsKey(), f = pgState(), it = PG().items.find((x) => x.k === f.item); if (!it) return;
    const rows = progRows(k).filter((x) => { const q = f.d[x.id]; if (!q || q.s === undefined) return false; const r = progRec(x, it.k); return (q.s || r) && (!r || r.s !== q.s || (q.s === DONE() && it.kind !== 'done' && String(r.v) !== String(q.v))); }).map((x) => ({ id: x.id, s: f.d[x.id].s, v: f.d[x.id].v }));
    if (it.kind !== 'done' && rows.some((r) => r.s === DONE() && (r.v == null || isNaN(r.v)))) { toast(it.kind === 'time' ? 'הזינו זמן לכל מי שסומן/ה "' + DONE() + '"' : 'הזינו ציון לכל מי שסומן/ה "' + DONE() + '"', true); return; }
    try { const r = await api('prog', { corps: k, item: it.k, rows }); toast(it.l + ': נשמרו ' + r.saved + ' רישומים'); pgInitDraft(k); rerender(); } catch (x) { /* toast shown */ }
  },
  pgExport: () => { const k = corpsKey(), name = 'program-' + k + '-' + A.S.today + '.xlsx'; auditEvent('export', 'program xlsx'); downloadBook(name, [['תוכנית הכשרה', progAoa(k)]]); toast(name + ' הורד'); },
});
