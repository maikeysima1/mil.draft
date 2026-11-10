// Evaluator sheet, command overview, import
// ---------------- evaluator ----------------
function evalGroup(k) { return A.me.role === 'מגבש/ת' ? A.me.group : (A.ui.group || 1); }
function evalDraftKey(k, id) { return 'mil-eval-' + k + '-' + id; }
function evalForm(k, c) { // working copy kept in A.ui.form until sent
  if (!A.ui.form || A.ui.form.id !== c.id || A.ui.form.k !== k) {
    let draft = null; try { draft = JSON.parse(localStorage.getItem(evalDraftKey(k, c.id))); } catch (e) { /* none */ }
    A.ui.form = draft && draft.id === c.id ? draft : { id: c.id, k, lv: c.lv.slice(), role: c.role, skills: (c.skills || []).slice(), stats: Object.assign({}, c.stats), rec: c.rec || '', med: c.med, obs: c.obs || '', summary: c.summary || '' };
    A.ui.form.extra = Object.assign({ second: '', follow: false, medNote: '' }, c.extra, A.ui.form.extra); // unknown values stay empty (null), never defaults
    if (!A.ui.form.wish) A.ui.form.wish = { role: (c.wish && c.wish.role) || '', units: [0, 1, 2].map((i) => (c.wish && c.wish.units[i]) || ''), combat: c.wish && c.wish.combat != null ? c.wish.combat : null };
  }
  return A.ui.form;
}
const segW = (f, key, words) => `<div class="seg">${words.map((w, j) => `<button type="button" class="${f.extra[key] === j ? 'on' : ''}" data-act="ex" data-f="${key}" data-v="${j}">${w}</button>`).join('')}</div>`;
function teamStrip(k, g) {
  const me = A.me, only = me.role === 'מגבש/ת';
  return `<div class="teams">${[1, 2, 3, 4].filter((n) => !only || n === me.group).map((n) => {
    const cands = cs(k).cands.filter((x) => x.group === n), dn = cands.filter((x) => evalStatus(k, x) === 'הוזן').length;
    const ev = A.cfg.users.find((u) => u.role === 'מגבש/ת' && u.corps === k && u.group === n);
    return `<button class="team ${n === g ? 'on' : ''}" ${only ? 'disabled' : `data-act="team" data-g="${n}"`}><b>צוות ${n}</b><span>${dn}/${cands.length} הוזנו</span><small>${esc(ev ? ev.title.replace(/ · .*/, '') : '')}</small></button>`;
  }).join('')}</div>`;
}
const evalStatus = (k, c) => (missingOf(k, c).length || !c.obs ? 'חסר מידע' : 'הוזן');
// ---------------- evaluator Excel intake ----------------
function evalFields(k) {
  const c = cf(k), f = [{ key: 'id', label: 'מס׳', wants: ['מס׳', 'מס', 'מספר', 'id='] }, { key: 'name', label: 'שם', wants: ['שם'] }, { key: 'role', label: 'תפקיד מומלץ', wants: ['תפקיד מומלץ', 'תפקיד='] }];
  c.traits.forEach((t, i) => f.push({ key: 't' + i, label: t, wants: [t] }));
  c.stats.forEach((s) => f.push({ key: 's:' + s.k, label: s.l + ' (' + s.u + ')', wants: [s.l] }));
  return f.concat([
    { key: 'rec', label: 'המלצת מגבש', wants: ['המלצת מגבש', 'המלצה'] }, { key: 'med', label: 'מגבלות רפואיות', wants: ['מגבלות רפואיות', 'מגבלות'] },
    { key: 'motivation', label: 'מוטיבציה (1–5)', wants: ['מוטיבציה'] }, { key: 'discipline', label: 'משמעת ואמינות', wants: ['משמעת'] }, { key: 'potential', label: 'פוטנציאל פיקודי', wants: ['פוטנציאל'] }, { key: 'confidence', label: 'ביטחון בהערכה', wants: ['ביטחון'] },
    { key: 'second', label: 'תפקיד חלופי', wants: ['תפקיד חלופי'] }, { key: 'follow', label: 'דורש מעקב', wants: ['דורש מעקב', 'מעקב'] }, { key: 'medNote', label: 'הערה רפואית', wants: ['הערה רפואית'] },
    { key: 'wrole', label: 'תפקיד מבוקש', wants: ['תפקיד מבוקש'] }, { key: 'wu0', label: 'יחידה – בחירה 1', wants: ['יחידה – בחירה 1', 'יחידה - בחירה 1', 'יחידה 1'] }, { key: 'wu1', label: 'יחידה – בחירה 2', wants: ['יחידה – בחירה 2', 'יחידה - בחירה 2', 'יחידה 2'] }, { key: 'wu2', label: 'יחידה – בחירה 3', wants: ['יחידה – בחירה 3', 'יחידה - בחירה 3', 'יחידה 3'] },
    { key: 'combat', label: 'נכונות לתפקיד קרבי', wants: ['נכונות', 'קרבי'] }, { key: 'obs', label: 'תצפיות והתרשמות', wants: ['תצפיות'] }, { key: 'summary', label: 'סיכום המגבש', wants: ['סיכום'] },
  ]);
}
function autoMapEval(fields, headers) {
  const used = new Set(), m = {};
  fields.forEach((fl) => { m[fl.key] = -1; for (const w of fl.wants) { const ex = w.endsWith('='), ww = ex ? w.slice(0, -1) : w, i = headers.findIndex((h, j) => !used.has(j) && (ex ? String(h).trim() === ww : String(h).trim().startsWith(ww))); if (i >= 0) { m[fl.key] = i; used.add(i); break; } } });
  return m;
}
function wordIdx(v, words) { const t = String(v == null ? '' : v).trim(); if (t === '') return null; if (/^[0-2]$/.test(t)) return +t; const i = words.findIndex((w) => w.replace(/\/.*$/, '') === t.replace(/\/.*$/, '')); return i >= 0 ? i : NaN; }
function evalRows(k) {
  const eb = A.ui.ebulk; if (!eb) return [];
  const c = cf(k), me = A.me, g = evalGroup(k), cells = (r, key) => (eb.map[key] >= 0 ? r[eb.map[key]] : ''), txt = (r, key) => String(cells(r, key) == null ? '' : cells(r, key)).trim();
  return eb.data.map((r, n) => {
    const errs = [], row = { n: n + 2, id: txt(r, 'id'), name: txt(r, 'name'), role: txt(r, 'role'), lv: [], stats: {}, extra: {}, wish: {}, fields: 0 };
    const put = (key, v) => { row[key] = v; row.fields++; };
    if (row.role) { if (c.roles.includes(row.role)) row.fields++; else errs.push('תפקיד לא מוכר'); }
    c.traits.forEach((t, i) => { const v = wordIdx(cells(r, 't' + i), WORDS); if (v === null) row.lv.push(null); else if (Number.isNaN(v)) { row.lv.push(null); errs.push('רמה לא מוכרת: ' + t); } else { row.lv.push(v); row.fields++; } });
    c.stats.forEach((s) => { const raw = cells(r, 's:' + s.k); if (String(raw).trim() === '') return; const v = parseStat(s, raw); if (v != null) { row.stats[s.k] = v; row.fields++; } else errs.push('מדד לא תקין: ' + s.l); });
    const rec = txt(r, 'rec'); if (rec) { if (A.cfg.RECS.includes(rec)) put('rec', rec); else errs.push('המלצה לא מוכרת'); }
    const med = txt(r, 'med'); if (med) { if (A.cfg.MEDS.includes(med)) put('med', med); else errs.push('מגבלה לא מוכרת'); }
    const mot = txt(r, 'motivation'); if (mot) { const v = Number(mot.replace(',', '.')); if (v >= 1 && v <= 5) { row.extra.motivation = Math.round(v); row.fields++; } else errs.push('מוטיבציה חייבת להיות 1–5'); }
    [['discipline', WORDS, 'משמעת'], ['potential', LOWHIGH, 'פוטנציאל'], ['confidence', LOWHIGH, 'ביטחון']].forEach(([key, words, lbl]) => { const v = wordIdx(cells(r, key), words); if (v === null) return; if (Number.isNaN(v)) errs.push('ערך לא מוכר: ' + lbl); else { row.extra[key] = v; row.fields++; } });
    const sec = txt(r, 'second'); if (sec) { if (c.roles.includes(sec)) { row.extra.second = sec; row.fields++; } else errs.push('תפקיד חלופי לא מוכר'); }
    const fo = txt(r, 'follow'); if (fo) { if (/^(כן|1|v|true|x|✓)$/i.test(fo)) { row.extra.follow = true; row.fields++; } else if (/^(לא|0|false)$/i.test(fo)) { row.extra.follow = false; row.fields++; } else errs.push('״דורש מעקב״: כן / לא'); }
    const mn = txt(r, 'medNote'); if (mn) { row.extra.medNote = mn; row.fields++; }
    const wr = txt(r, 'wrole'); if (wr) { if (c.roles.includes(wr)) { row.wish.role = wr; row.fields++; } else errs.push('תפקיד מבוקש לא מוכר'); }
    const wu = [0, 1, 2].map((i) => txt(r, 'wu' + i)).filter(Boolean); if (wu.length) { if (wu.every((u) => c.units.some((x) => x.name === u))) { row.wish.units = wu; row.fields++; } else errs.push('יחידה מועדפת לא מוכרת'); }
    const cb = txt(r, 'combat'); if (cb) { const v = parseCombat(cb); if (v == null) errs.push('נכונות לקרבי לא מוכרת'); else { row.wish.combat = v; row.fields++; } }
    const ob = txt(r, 'obs'); if (ob) put('obs', ob); const su = txt(r, 'summary'); if (su) put('summary', su);
    const found = cs(k).cands.find((x) => (row.id && x.id === row.id) || (row.name && x.name === row.name));
    if (found) { if (me.role === 'מגבש/ת' && found.group !== me.group) { row.status = ['p-red', 'צוות אחר']; errs.push('המועמד אינו בצוות שלך'); } else row.status = ['p-green', 'יעודכן']; row.cand = found; }
    else if (eb.addNew && row.name && c.roles.includes(row.role)) row.status = ['p-blue', 'מועמד חדש לצוות ' + g];
    else { row.status = ['p-orange', 'לא נמצא']; if (!row.id && !row.name) errs.push('חסר מס׳ או שם'); }
    row.errs = errs; row.ok = !errs.length && (row.status[1] === 'יעודכן' || row.status[1].startsWith('מועמד חדש')) && row.fields > 0;
    return row;
  });
}
function evalTemplateAoa(k, g, sample) {
  const c = cf(k), fl = evalFields(k), head = fl.map((x) => x.label), cands = cs(k).cands.filter((x) => x.group === g);
  const rowOf = (x) => { const e = x.extra || {}, w = x.wish || { units: [] }; return [x.id, x.name, x.role].concat(x.lv.map((v) => WORDS[v]), c.stats.map((s) => cellVal(s, x.stats[s.k])), [x.rec || '', x.med, e.motivation || '', WORDS[e.discipline] || '', LOWHIGH[e.potential] || '', LOWHIGH[e.confidence] || '', e.second || '', e.follow ? 'כן' : '', e.medNote || '', w.role || '', w.units[0] || '', w.units[1] || '', w.units[2] || '', (w.combat == null ? '' : COMBAT[w.combat]), x.obs || '', x.summary || '']); };
  const rows = cands.map(rowOf);
  if (sample) {
    rows.slice(0, 3).forEach((r, i) => { const mi = head.indexOf('מוטיבציה (1–5)'), oi = head.indexOf('תצפיות והתרשמות'), ri = head.indexOf('המלצת מגבש'); r[mi] = [5, 4, 2][i]; r[oi] = ['הוביל את הצוות בתרגיל הלילי ושמר על קצב.', 'עבודה מסודרת, צריך לחזק ביטחון עצמי.', 'מתקשה כשהלחץ עולה.'][i]; r[ri] = A.cfg.RECS[i]; });
    const nr = head.map(() => ''); nr[1] = 'מועמד חדש לדוגמה'; nr[2] = c.roles[0]; nr[head.indexOf('מוטיבציה (1–5)')] = 4; nr[head.indexOf('המלצת מגבש')] = 'מומלץ'; nr[head.indexOf('נכונות לתפקיד קרבי')] = 'מעוניין'; rows.push(nr);
  }
  return [head].concat(rows);
}
function setEbulk(k, aoa) { const headers = (aoa[0] || []).map((h) => String(h)), data = aoa.slice(1).filter((r) => r.some((v) => String(v).trim() !== '')); A.ui.ebulk = { headers, data, map: autoMapEval(evalFields(k), headers), addNew: !!(A.ui.ebulk && A.ui.ebulk.addNew) }; rerender(); }
function evalBulkCard(k, g) {
  const eb = A.ui.ebulk, rows = eb ? evalRows(k) : [], ok = rows.filter((r) => r.ok), bad = rows.filter((r) => r.errs.length), newN = ok.filter((r) => !r.cand).length;
  return `<div class="card"><div class="row spread"><h2 style="margin:0">קליטת נתונים מקובץ אקסל</h2><span class="mut small">צוות ${g}</span></div>
   <p class="mut small" style="margin:6px 0 10px">הורידו תבנית עם מועמדי הצוות והערכים הקיימים שלהם, מלאו או עדכנו באקסל והעלו בחזרה. המערכת קולטת רק מועמדי ${A.me.role === 'מגבש/ת' ? 'הצוות שלכם' : 'הצוות הנבחר'}, ותא ריק <b>לא מוחק</b> נתון קיים. עמודות שלא נחוצות אפשר למחוק מהקובץ.</p>
   <div class="drop"><div class="row" style="justify-content:center"><button class="btn sec sm" data-act="etemplate">הורדת תבנית לצוות ${g}</button><button class="btn sec sm" data-act="esample">טעינת קובץ לדוגמה</button></div>
    <input type="file" id="efile" accept=".xlsx,.xls,.csv" data-chg="efile" style="margin-top:10px"><label class="row" style="justify-content:center;gap:6px;margin-top:8px"><input type="checkbox" data-chg="eadd" ${eb && eb.addNew ? 'checked' : ''}> מועמד שלא נמצא – הוסף כמועמד חדש לצוות ${g} (נדרשים שם ותפקיד)</label></div>
   ${eb ? `<div style="margin-top:12px"><p style="margin:0 0 6px"><b>${rows.length}</b> שורות · <b style="color:var(--green)">${ok.length} ייקלטו</b>${newN ? ` (מתוכם ${newN} חדשים)` : ''} · <b style="color:var(--red)">${bad.length} עם בעיות</b> · ${rows.length - ok.length - bad.length} ללא שינוי או לא נמצאו</p>
    <details><summary class="mut small" style="cursor:pointer">התאמת עמודות (אוטומטית, אפשר לשנות)</summary><div class="row" style="margin-top:6px">${evalFields(k).map((fl) => `<label class="small mut">${esc(fl.label)}<br><select data-chg="emap" data-f="${esc(fl.key)}" style="min-width:130px"><option value="-1">— לא ממופה —</option>${eb.headers.map((h, i) => `<option value="${i}" ${eb.map[fl.key] === i ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select></label>`).join('')}</div></details>
    <div style="overflow:auto;max-height:340px;margin-top:8px"><table><thead><tr><th>שורה</th><th>מועמד/ת</th><th>סטטוס</th><th>שדות</th><th>בדיקה</th></tr></thead><tbody>${rows.slice(0, 200).map((r) => `<tr><td>${r.n}</td><td>${esc(r.cand ? r.cand.name : (r.name || r.id || '—'))} <span class="mut small">${esc(r.cand ? r.cand.id : '')}</span></td><td><span class="pill ${r.status[0]}">${esc(r.status[1])}</span></td><td>${r.fields}</td><td>${r.errs.length ? `<span class="pill p-red">${esc(r.errs.join(', '))}</span>` : (r.fields ? '<span class="pill p-green">תקין</span>' : '<span class="mut small">אין ערכים לקליטה</span>')}</td></tr>`).join('')}</tbody></table></div>
    <div class="row" style="margin-top:10px"><button class="btn" data-act="esave" ${ok.length ? '' : 'disabled'}>קליטת הנתונים (${ok.length} מועמדים)</button><button class="btn sec" data-act="ecancel">ביטול</button></div></div>` : ''}</div>`;
}
Object.assign(ACTIONS, {
  efile: async (d, t) => { const f = t.files[0]; if (!f) return; const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }); setEbulk(corpsKey(), XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })); },
  emap: (d, t) => { A.ui.ebulk.map[d.f] = +t.value; rerender(); },
  eadd: (d, t) => { if (!A.ui.ebulk) A.ui.ebulk = { headers: [], data: [], map: {}, addNew: false }; A.ui.ebulk.addNew = t.checked; if (A.ui.ebulk.data.length) rerender(); },
  esample: () => { const k = corpsKey(); A.ui.ebulk = Object.assign(A.ui.ebulk || {}, { addNew: true }); setEbulk(k, evalTemplateAoa(k, evalGroup(k), true)); A.ui.ebulk.addNew = true; rerender(); },
  etemplate: () => { const k = corpsKey(), g = evalGroup(k); downloadX('mil-draft-evaluator-team' + g + '.xlsx', evalTemplateAoa(k, g, false)); },
  ecancel: () => { A.ui.ebulk = null; rerender(); },
  esave: async () => {
    const k = corpsKey(), g = evalGroup(k), eb = A.ui.ebulk, rows = evalRows(k).filter((r) => r.ok).map((r) => ({ id: r.cand ? r.cand.id : r.id, name: r.name || (r.cand && r.cand.name) || '', role: r.role, lv: r.lv, stats: r.stats, rec: r.rec, med: r.med, obs: r.obs, summary: r.summary, extra: r.extra, wish: r.wish }));
    const r = await api('eval-bulk', { corps: k, rows, addNew: !!eb.addNew, group: g }); A.ui.ebulk = null; A.ui.form = null; rerender();
    toast(`נקלטו נתוני ${r.updated + r.added} מועמדים${r.added ? ' (' + r.added + ' חדשים)' : ''}${r.foreign ? ' · ' + r.foreign + ' מצוות אחר נדחו' : ''}${r.notFound ? ' · ' + r.notFound + ' לא נמצאו' : ''}`);
  },
});

SCREENS.eval = (k) => {
  const c = cf(k), g = evalGroup(k), me = A.me;
  const group = cs(k).cands.filter((x) => x.group === g);
  if (!A.ui.evalCand || !group.find((x) => x.id === A.ui.evalCand)) A.ui.evalCand = group[0] && group[0].id;
  const cur = group.find((x) => x.id === A.ui.evalCand);
  const done = group.filter((x) => evalStatus(k, x) === 'הוזן').length;
  const ro = me.role !== 'מגבש/ת';
  const f = cur && evalForm(k, cur);
  const allSkills = Array.from(new Set(Object.values(c.skills).flat()));
  const prev = f && (() => {
    const str = c.traits.filter((t, i) => f.lv[i] === 2);
    return `<div class="card" style="background:var(--bg2)"><div class="mut small">תצוגה מקדימה – כך זה ייכנס לתיק המועמד</div><h3>${esc(cur.name)} <span class="mut small">· תיק מועמד · ${esc(c.corps)}</span></h3>
     <div class="small"><b>תפקיד מומלץ:</b> ${esc(f.role)} · <b>חוזקות בולטות:</b> ${esc(str.join(', ') || '—')} · <b>המלצה:</b> ${esc(f.rec || '—')} · <b>מגבלות:</b> ${esc(f.med)}</div>
     <div class="small">${c.stats.map((s) => `<b>${esc(s.l)}:</b> ${fmtStat(s, f.stats[s.k] === '' ? null : f.stats[s.k])}`).join(' · ')}</div>
     <div class="small"><b>העדפת החייל:</b> קרבי: ${f.wish.combat == null ? 'לא צוין' : COMBAT[f.wish.combat]} · תפקיד ${esc(f.wish.role || '—')} · יחידות ${esc(f.wish.units.filter(Boolean).join(' › ') || '—')}</div>
     <div class="small"><b>כישורים:</b> ${esc(f.skills.join(' · ') || '—')}</div>
     <div class="small"><b>ערכים נוספים:</b> מוטיבציה ${f.extra.motivation != null ? f.extra.motivation + '/5' : '—'} · משמעת ${WORDS[f.extra.discipline] || '—'} · פוטנציאל פיקודי ${LOWHIGH[f.extra.potential] || '—'} · ביטחון בהערכה ${LOWHIGH[f.extra.confidence] || '—'}${f.extra.second ? ' · תפקיד חלופי ' + esc(f.extra.second) : ''}${f.extra.follow ? ' · <b>דורש מעקב</b>' : ''}</div><p class="small" style="margin:4px 0">${esc(f.obs) || '—'}</p>
     <div class="small mut">סיכום המגבש: ${esc(f.summary) || `מתאים/ה לתפקיד ${esc(f.role)}. חוזקות בולטות: ${esc(str.join(', ') || '—')}. המלצה: ${esc(f.rec || '—')}.`}</div></div>`;
  })();
  return `<div class="row spread"><div><span class="chip navy">${esc(c.eventName)} · ${esc(c.corps)}</span><h1 style="font-size:28px;font-weight:800;margin-top:6px">דף מגבש – צוות ${g}</h1>${!ro ? `<div class="mut small">אתם אחראים על צוות ${g} בלבד</div>` : ''}</div>
    ${ro ? `<div class="row">${corpsSwitcher()}</div>` : ''}</div>
   ${ro ? `<div class="demo-note">צפייה בלבד – ${can('evalbulk', k) ? 'ניהול מערכת: אפשר להעביר מועמד בין צוותים ולקלוט קובץ, אך לא לערוך התרשמות.' : 'אין הרשאת עריכה בדף המגבש. רק מגבש/ת מזינ/ה התרשמות.'}</div>` : ''}
   ${teamStrip(k, g)}
   ${can('evalbulk', k) && (me.role !== 'מגבש/ת' || me.group === g) ? evalBulkCard(k, g) : ''}
   <div class="grid g3"><div class="kpi"><span>מועמדים בצוות</span><b>${group.length}</b></div><div class="kpi"><span>הוזנו לתיק</span><b>${done}</b></div><div class="kpi"><span>התקדמות הצוות</span><div class="bar" style="margin-top:12px"><i style="width:${group.length ? done / group.length * 100 : 0}%"></i></div></div></div>
   <div style="display:grid;grid-template-columns:minmax(240px,300px) 1fr;gap:16px;align-items:start" class="evgrid">
   <div class="card"><h2>מועמדי הצוות</h2><div style="display:flex;flex-direction:column;gap:6px">${group.map((x) => `<button class="list-item ${x.id === (cur && cur.id) ? 'on' : ''}" data-act="evalPick" data-id="${x.id}"><span><b>${esc(x.name)}</b> <span class="mut small">${x.id}</span></span><span class="row" style="gap:4px">${x.extra && x.extra.follow ? '<span class="pill p-orange">מעקב</span>' : ''}<span class="pill ${evalStatus(k, x) === 'הוזן' ? 'p-green' : 'p-orange'}">${evalStatus(k, x)}</span></span></button>`).join('') || '<span class="mut">אין מועמדים בצוות</span>'}</div></div>
   ${cur ? `<div style="display:flex;flex-direction:column;gap:14px"><div class="card"><div class="row spread"><div><div class="mut small">הזנת התרשמות עבור</div><h2 style="margin:0;font-size:22px">${esc(cur.name)} <span class="mut small">${cur.id}</span></h2></div><div class="row">${cur.evalBy ? `<span class="pill p-green">הוזן לתיק · ${esc(cur.evalBy)}</span>` : ''}${can('regroup', k) ? `<label class="small mut row" style="gap:6px">העברה לצוות <select data-chg="regroup" data-id="${cur.id}">${[1, 2, 3, 4].map((n) => `<option ${n === cur.group ? 'selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}</div></div>
    <fieldset ${ro ? 'disabled' : ''} style="border:0;padding:0;margin:12px 0 0;display:flex;flex-direction:column;gap:14px">
    <div><h3 style="font-size:16px">התרשמות מקצועית</h3><div class="mut small">סמנו לכל תכונה את הרמה שנצפתה במהלך ${esc(c.eventName)}</div>
     ${c.traits.map((t, i) => `<div class="row spread" style="padding:5px 0"><span>${esc(t)}</span><div class="seg">${WORDS.map((w, j) => `<button type="button" class="${f.lv[i] === j ? 'on l' + j : ''}" data-act="lv" data-i="${i}" data-v="${j}">${w}</button>`).join('')}</div></div>`).join('')}</div>
    <label>תפקיד מומלץ<br><select data-chg="fld" data-f="role">${c.roles.map((r) => `<option ${r === f.role ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
    <div><b>כישורים שנצפו</b><div class="row" style="margin-top:4px">${allSkills.map((s) => `<button type="button" class="sw ${f.skills.includes(s) ? 'on' : ''}" data-act="skill" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>
    <div><h3 style="font-size:16px">מדדים שנמדדו</h3><div class="mut small">ערכים אמיתיים מהמבחנים. מדד ריק יסומן בתיק כחסר.</div><div class="row" style="margin-top:6px">${c.stats.map((s) => `<label class="small mut">${esc(s.l)} (${isTime(s) ? 'דק׳:שנ׳' : esc(s.u)})<br><input type="text" inputmode="${isTime(s) ? 'text' : 'decimal'}" style="width:130px" id="st-${s.k}" data-inp="stat" data-f="${s.k}" placeholder="${isTime(s) ? '12:30' : ''}" value="${f.stats[s.k] == null ? '' : (isTime(s) ? fmtTime(f.stats[s.k]) : f.stats[s.k])}"></label>`).join('')}</div></div>
    <div class="row"><div><b>המלצת מגבש</b><br><div class="seg">${A.cfg.RECS.map((r) => `<button type="button" class="${f.rec === r ? 'on' : ''}" data-act="rec" data-v="${esc(r)}">${esc(r)}</button>`).join('')}</div></div>
     <div><b>מגבלות רפואיות (מצו ראשון)</b><br><div class="seg">${A.cfg.MEDS.map((r) => `<button type="button" class="${f.med === r ? 'on' : ''}" data-act="med" data-v="${esc(r)}">${esc(r)}</button>`).join('')}</div></div></div>
    <div><h3 style="font-size:16px">ערכים נוספים</h3><div class="mut small">נתונים משלימים שנכנסים לתיק המועמד</div>
     <div class="row" style="gap:18px;margin-top:6px;align-items:flex-start">
      <div><b class="small">מוטיבציה (1–5)</b><br><div class="seg">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="${f.extra.motivation === n ? 'on' : ''}" data-act="ex" data-f="motivation" data-v="${n}">${n}</button>`).join('')}</div></div>
      <div><b class="small">משמעת ואמינות</b><br>${segW(f, 'discipline', WORDS)}</div>
      <div><b class="small">פוטנציאל פיקודי</b><br>${segW(f, 'potential', LOWHIGH)}</div>
      <div><b class="small">ביטחון בהערכה</b><br>${segW(f, 'confidence', LOWHIGH)}</div></div>
     <div class="row" style="margin-top:10px;align-items:flex-end">
      <label class="small mut">תפקיד חלופי<br><select data-chg="exfld" data-f="second"><option value="">— אין —</option>${c.roles.filter((r) => r !== f.role).map((r) => `<option ${r === f.extra.second ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
      <label class="row small" style="gap:6px;min-height:38px"><input type="checkbox" data-chg="exfld" data-f="follow" ${f.extra.follow ? 'checked' : ''}> דורש מעקב</label>
      <label class="small mut" style="flex:1;min-width:200px">הערה רפואית (אופציונלי)<br><input type="text" style="width:100%" id="x-med" data-inp="exfld" data-f="medNote" value="${esc(f.extra.medNote)}"></label></div></div>
    <div><h3 style="font-size:16px">העדפת החייל</h3><div class="mut small">מה החייל ביקש בראיון. זו העדפה בלבד – השיבוץ נקבע לפי צורכי היחידות.</div>
     <div class="row" style="margin-top:6px;align-items:flex-end"><div><b class="small">נכונות לתפקיד קרבי</b><br><div class="seg">${COMBAT.map((t, i) => `<button type="button" class="${f.wish.combat === i ? 'on' : ''}" data-act="wishcombat" data-v="${i}">${t}</button>`).join('')}</div></div><label class="small mut">תפקיד מבוקש<br><select data-chg="wishrole"><option value="">— לא צוין —</option>${c.roles.map((r) => `<option ${r === f.wish.role ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
      ${[0, 1, 2].map((i) => `<label class="small mut">יחידה – בחירה ${i + 1}<br><select data-chg="wishunit" data-i="${i}"><option value="">— אין —</option>${c.units.map((u) => `<option ${u.name === f.wish.units[i] ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label>`).join('')}</div></div>
    <label><b>תצפיות והתרשמות כללית</b><textarea id="f-obs" data-inp="fld" data-f="obs">${esc(f.obs)}</textarea></label>
    <label><b>סיכום המגבש</b> <span class="mut small">– יוצג בתיק המועמד בחדר הבחירה</span><textarea id="f-sum" data-inp="fld" data-f="summary" style="min-height:60px">${esc(f.summary)}</textarea></label>
    ${ro ? '' : `<div class="row"><button class="btn sec" type="button" data-act="evalDraft">שמירה כטיוטה ומעבר לבא</button><button class="btn" type="button" data-act="evalSend">שליחה לתיק המועמד</button></div>`}
    </fieldset></div>${prev}</div>` : ''}</div>
   <style>@media(max-width:900px){.evgrid{grid-template-columns:1fr!important}}</style>`;
};
Object.assign(ACTIONS, {
  team: (d) => { A.ui.group = +d.g; A.ui.evalCand = null; A.ui.form = null; rerender(); },
  wishcombat: (d) => { A.ui.form.wish.combat = A.ui.form.wish.combat === +d.v ? null : +d.v; rerender(); }, // click again to clear
  wishrole: (d, t) => { A.ui.form.wish.role = t.value; rerender(); },
  wishunit: (d, t) => { const u = A.ui.form.wish.units; u.forEach((x, j) => { if (t.value && x === t.value) u[j] = ''; }); u[+d.i] = t.value; rerender(); },
  ex: (d) => { A.ui.form.extra[d.f] = A.ui.form.extra[d.f] === +d.v ? null : +d.v; rerender(); }, // click again to clear
  exfld: (d, t) => { A.ui.form.extra[d.f] = t.type === 'checkbox' ? t.checked : t.value; if (t.tagName === 'SELECT' || t.type === 'checkbox') rerender(); },
  regroup: async (d, t) => {
    const k = corpsKey(), c = candOf(k, d.id), g = +t.value; if (!c || g === c.group) return;
    if (!confirm(`להעביר את ${c.name} לצוות ${g}?`)) { rerender(); return; }
    try { await api('regroup', { corps: k, id: d.id, group: g }); A.ui.evalCand = null; A.ui.form = null; toast(`${c.name} הועבר/ה לצוות ${g}`); rerender(); } catch (e) { rerender(); }
  },
  grp: (d, t) => { A.ui.group = Number(t.value); A.ui.evalCand = null; A.ui.form = null; rerender(); },
  evalPick: (d) => { A.ui.evalCand = d.id; A.ui.form = null; rerender(); },
  lv: (d) => { A.ui.form.lv[+d.i] = +d.v; rerender(); },
  rec: (d) => { A.ui.form.rec = d.v; rerender(); },
  med: (d) => { A.ui.form.med = d.v; rerender(); },
  skill: (d) => { const s = A.ui.form.skills, i = s.indexOf(d.s); if (i >= 0) s.splice(i, 1); else s.push(d.s); rerender(); },
  fld: (d, t) => { A.ui.form[d.f] = t.value; if (d.f === 'role') { A.ui.form.skills = (cf(corpsKey()).skills[t.value] || []).slice(); } rerender(); },
  stat: (d, t) => { const s = cf(corpsKey()).stats.find((x) => x.k === d.f), v = t.value.trim() === '' ? null : parseStat(s, t.value), bad = t.value.trim() !== '' && v == null; A.ui.form.stats[d.f] = v; (A.ui.form.badStat = A.ui.form.badStat || {})[d.f] = bad; t.classList.toggle('invalid', bad); t.title = bad ? 'פורמט לא תקין – למשל 12:30 או 12.5' : ''; },
  evalDraft: () => {
    const k = corpsKey(), f = A.ui.form; localStorage.setItem(evalDraftKey(k, f.id), JSON.stringify(f));
    const g = cs(k).cands.filter((x) => x.group === evalGroup(k)), i = g.findIndex((x) => x.id === f.id);
    A.ui.evalCand = g[(i + 1) % g.length].id; A.ui.form = null; toast('נשמר כטיוטה'); rerender();
  },
  evalSend: async () => {
    const k = corpsKey(), f = A.ui.form;
    if (!f.rec) { toast('בחרו המלצת מגבש לפני השליחה', true); return; }
    if (Object.values(f.badStat || {}).some(Boolean)) { toast('תקנו מדד בפורמט לא תקין (זמן: 12:30)', true); return; }
    await api('eval', { corps: k, id: f.id, lv: f.lv, role: f.role, skills: f.skills, stats: f.stats, rec: f.rec, med: f.med, obs: f.obs, summary: f.summary, extra: f.extra, wish: { role: f.wish.role, units: f.wish.units.filter(Boolean), combat: f.wish.combat } });
    localStorage.removeItem(evalDraftKey(k, f.id)); A.ui.form = null; toast('ההתרשמות נשמרה בתיק המועמד. אפשר לעדכן ולשלוח שוב.'); rerender();
  },
});

// ---------------- people distribution (charts) ----------------
// Colors follow the entity (willingness level), never its rank. Order of segments: interested → open → not interested.
const WCOL = ['var(--s2)', 'var(--s3)', 'var(--s1)', 'var(--ref)']; // 0 not interested, 1 open, 2 interested, 3 unknown (gray) // index = combat willingness 0,1,2
const W_ORDER = [2, 1, 0];
function distView(k) {
  const c = cf(k), d = draftInfo(k), scope = A.ui.dist || 'all';
  const list = cs(k).cands.filter((x) => scope === 'all' || (scope === 'free' ? !d.takenBy[x.id] : !!d.takenBy[x.id]));
  const n = list.length, cw = (x) => (x.wish && x.wish.combat != null ? x.wish.combat : 3), mo = (x) => (x.extra && x.extra.motivation != null ? x.extra.motivation : null); // 3 = unknown: never a made-up answer
  const pct = (a, b) => (b ? Math.round(a / b * 100) : 0), f1 = (v) => (v == null ? '—' : (Math.round(v * 10) / 10).toFixed(1)), CL = (w) => (w === 3 ? 'לא צוין' : COMBAT[w]), mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const cnt = [0, 0, 0, 0]; list.forEach((x) => { cnt[cw(x)]++; });
  const knownC = n - cnt[3], moList = list.map(mo).filter((v) => v != null), nMot = moList.length, avg = mean(moList);
  const hasUnk = cnt[3] > 0, WO = hasUnk ? W_ORDER.concat([3]) : W_ORDER;
  const follow = list.filter((x) => x.extra && x.extra.follow).length;
  const lowMot = list.filter((x) => mo(x) != null && mo(x) <= 2), lowAndNot = lowMot.filter((x) => cw(x) === 0).length;
  const hist = [1, 2, 3, 4, 5].map((m) => list.filter((x) => mo(x) === m).length);
  const scopeTxt = { all: 'כל המועמדים', free: 'פנויים בלבד', picked: 'שכבר שובצו' }[scope];
  const byRole = c.roles.map((r) => { const g = list.filter((x) => x.role === r), cc = [0, 0, 0, 0]; g.forEach((x) => { cc[cw(x)]++; }); return { label: r, n: g.length, cnt: cc, avg: mean(g.map(mo).filter((v) => v != null)), nm: g.map(mo).filter((v) => v != null).length }; }).filter((r) => r.n);
  const byTeam = [1, 2, 3, 4].map((t) => { const g = list.filter((x) => x.group === t), cc = [0, 0, 0, 0]; g.forEach((x) => { cc[cw(x)]++; }); return { label: 'צוות ' + t, n: g.length, cnt: cc, avg: mean(g.map(mo).filter((v) => v != null)), nm: g.map(mo).filter((v) => v != null).length }; }).filter((r) => r.n);

  // donut (2px surface gap between slices)
  const C = 2 * Math.PI * 54; let off = 0;
  const slices = WO.map((w) => { const frac = n ? cnt[w] / n : 0, gap = frac > 0 && frac < 1 ? 2 : 0, len = Math.max(0, frac * C - gap);
    const s = `<circle cx="70" cy="70" r="54" fill="none" stroke="${WCOL[w]}" stroke-width="18" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 70 70)" data-tip="${cnt[w]} (${pct(cnt[w], n)}%)|${esc(CL(w))}" tabindex="0"/>`; off += frac * C; return frac > 0 ? s : ''; }).join('');
  const legend = WO.map((w) => `<div class="lg"><i class="sq" style="background:${WCOL[w]}"></i><span>${esc(CL(w))}</span><b>${cnt[w]}</b><span class="mut small">${pct(cnt[w], n)}%</span></div>`).join('');

  // motivation histogram (single series, 4px rounded cap, value on the cap)
  const maxV = Math.max(...hist, 1), top = Math.ceil(maxV / 2) * 2 || 2, W0 = 40, BW = (340 - W0) / 5, BASE = 160, H = 128;
  const grid = [0, top / 2, top].map((t) => { const y = BASE - t / top * H; return `<line x1="${W0}" x2="340" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="1"/><text x="${W0 - 8}" y="${y + 4}" text-anchor="end" font-size="11" class="svgm">${t}</text>`; }).join('');
  const cols = hist.map((v, i) => { const h = v / top * H, x = W0 + BW * i + (BW - 24) / 2, y = BASE - h;
    const bar = v ? `<path d="M${x},${BASE} V${y + 4} Q${x},${y} ${x + 4},${y} H${x + 20} Q${x + 24},${y} ${x + 24},${y + 4} V${BASE} Z" fill="var(--s1)"/><text x="${x + 12}" y="${y - 6}" text-anchor="middle" font-size="12" font-weight="700" class="svgt">${v}</text>` : '';
    return `<g data-tip="${v} מועמדים (${pct(v, nMot)}%)|מוטיבציה ${i + 1}" tabindex="0"><rect x="${W0 + BW * i}" y="20" width="${BW}" height="${BASE - 20}" fill="transparent"/>${bar}<text x="${x + 12}" y="${BASE + 18}" text-anchor="middle" font-size="12" class="svgm">${i + 1}</text></g>`; }).join('');
  const histSvg = `<svg viewBox="0 0 340 190" width="100%" role="img" aria-label="התפלגות מוטיבציה" dir="ltr">${grid}<line x1="${W0}" x2="340" y1="${BASE}" y2="${BASE}" stroke="var(--line)"/>${cols}</svg>`;

  // stacked 100% rows (2px gap between segments; label inside only when it fits)
  const stack = (rows) => rows.map((r) => `<div class="srow"><span class="srow-l">${esc(r.label)}</span><div class="strack">${WO.map((w) => (r.cnt[w] ? `<i class="seg" style="flex:${r.cnt[w]};background:${WCOL[w]}" data-tip="${r.cnt[w]} (${pct(r.cnt[w], r.n)}%)|${esc(r.label)} · ${esc(CL(w))}" tabindex="0">${r.cnt[w] / r.n >= 0.14 ? r.cnt[w] : ''}</i>` : '')).join('')}</div><span class="srow-n" title="מועמדים">${r.n}</span></div>`).join('');
  const bars = (rows) => rows.map((r) => `<div class="srow"><span class="srow-l">${esc(r.label)}</span><div class="htrack" data-tip="${r.avg == null ? 'אין נתון מוטיבציה' : f1(r.avg) + ' מתוך 5 · ' + r.nm + ' מתוך ' + r.n + ' עם נתון'}|${esc(r.label)}" tabindex="0"><i style="width:${r.avg == null ? 0 : (r.avg / 5 * 100).toFixed(1)}%"></i></div><b class="srow-n">${f1(r.avg)}</b></div>`).join('');
  const table = `<details class="tbl"><summary>תצוגת טבלה</summary><div style="overflow:auto"><table><thead><tr><th>תפקיד</th><th>מועמדים</th><th>מוטיבציה ממוצעת</th>${WO.map((w) => `<th>${esc(CL(w))}</th>`).join('')}</tr></thead><tbody>${byRole.map((r) => `<tr><td>${esc(r.label)}</td><td>${r.n}</td><td>${f1(r.avg)}</td>${WO.map((w) => `<td>${r.cnt[w]}</td>`).join('')}</tr>`).join('')}<tr><td><b>סה״כ</b></td><td><b>${n}</b></td><td><b>${f1(avg)}</b></td>${WO.map((w) => `<td><b>${cnt[w]}</b></td>`).join('')}</tr></tbody></table></div></details>`;
  const notes = [];
  if (n && knownC) {
    notes.push(`${cnt[0]} מתוך ${knownC} שענו (${pct(cnt[0], knownC)}%) לא מעוניינים בתפקיד קרבי, ו־${cnt[1]} פתוחים לכך${cnt[3] ? '; ל־' + cnt[3] + ' מועמדים אין תשובה' : ''}.`);
    if (lowMot.length) notes.push(`${lowMot.length} מועמדים עם מוטיבציה נמוכה (1–2), ומהם ${lowAndNot} גם לא מעוניינים בתפקיד קרבי.`);
    const worst = byRole.filter((r) => r.n >= 2).sort((a, b) => b.cnt[0] / b.n - a.cnt[0] / a.n)[0];
    if (worst && worst.cnt[0]) notes.push(`התפקיד עם שיעור ה״לא מעוניין״ הגבוה ביותר: ${worst.label} (${worst.cnt[0]} מתוך ${worst.n}).`);
  }
  return `<div class="row spread"><div class="tabs">${[['all', 'כל המועמדים'], ['free', 'פנויים'], ['picked', 'שובצו']].map((s) => `<button class="${scope === s[0] ? 'on' : ''}" data-act="distScope" data-s="${s[0]}">${s[1]}</button>`).join('')}</div><span class="mut small">${esc(scopeTxt)} · ${esc(c.corps)}</span></div>
   <div class="grid g3" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr))"><div class="kpi"><b>${n}</b><span>מועמדים בפילוג</span></div><div class="kpi"><b><bdi dir="ltr">${cnt[0]} <small class="mut" style="font-size:15px">(${pct(cnt[0], knownC)}%)</small></bdi></b><span>לא מעוניינים בתפקיד קרבי</span><div class="mut small">מתוך ${knownC} שענו${cnt[3] ? ' · ' + cnt[3] + ' ללא תשובה' : ''}</div></div><div class="kpi"><b><bdi dir="ltr">${f1(avg)}<small class="mut" style="font-size:15px"> / 5</small></bdi></b><span>מוטיבציה ממוצעת</span><div class="mut small">מתוך ${nMot} עם נתון${nMot < n ? ' · ' + (n - nMot) + ' ללא נתון' : ''}</div></div><div class="kpi"><b>${follow}</b><span>דורשים מעקב</span></div></div>
   <div class="grid g2"><div class="card"><h2>נכונות לתפקיד קרבי</h2><div class="row" style="gap:22px;flex-wrap:nowrap"><svg viewBox="0 0 140 140" width="170" role="img" aria-label="נכונות לתפקיד קרבי"><circle cx="70" cy="70" r="54" fill="none" stroke="var(--line2)" stroke-width="18"/>${slices}<text x="70" y="68" text-anchor="middle" font-size="24" font-weight="800" class="svgt">${pct(cnt[0], knownC)}%</text><text x="70" y="86" text-anchor="middle" font-size="10" class="svgm">לא מעוניינים</text></svg><div class="legend">${legend}</div></div></div>
    <div class="card"><h2>התפלגות מוטיבציה</h2><div class="mut small" style="margin-bottom:6px">מספר מועמדים לכל רמה (1 = נמוכה, 5 = גבוהה)${nMot < n ? ' · ' + (n - nMot) + ' מועמדים ללא נתון אינם נכללים' : ''}</div>${histSvg}</div></div>
   <div class="grid g2"><div class="card"><h2>נכונות לתפקיד קרבי – לפי תפקיד</h2><div class="legend row" style="margin-bottom:8px">${WO.map((w) => `<span class="lg"><i class="sq" style="background:${WCOL[w]}"></i>${esc(CL(w))}</span>`).join('')}</div>${stack(byRole)}</div>
    <div class="card"><h2>נכונות לתפקיד קרבי – לפי צוות</h2><div class="legend row" style="margin-bottom:8px">${WO.map((w) => `<span class="lg"><i class="sq" style="background:${WCOL[w]}"></i>${esc(CL(w))}</span>`).join('')}</div>${stack(byTeam)}</div></div>
   <div class="grid g2"><div class="card"><h2>מוטיבציה ממוצעת – לפי תפקיד</h2><div class="mut small" style="margin-bottom:6px">ממוצע מתוך 5</div>${bars(byRole)}</div>
    <div class="card"><h2>מוטיבציה ממוצעת – לפי צוות</h2><div class="mut small" style="margin-bottom:6px">ממוצע מתוך 5</div>${bars(byTeam)}</div></div>
   <div class="card"><h2>נקודות בולטות</h2><ul style="margin:0;padding:0 20px 0 0;line-height:1.9">${notes.map((t) => `<li>${esc(t)}</li>`).join('') || '<li>אין נתונים לתצוגה.</li>'}</ul><div class="mut small" style="margin-top:8px">נוצר מכללים שקופים על הנתונים. אין כאן המלצה על אדם או יחידה, וההעדפות אינן מחייבות את השיבוץ.</div>${table}</div>`;
}

// ---------------- comparison with a reference dataset (previous cycle) ----------------
// "now" = current candidates (blue series), "before" = uploaded reference rows (neutral gray). Gaps are descriptive, not a ranking of people.
function cmpView(k) {
  const c = cf(k), base = cs(k).baseline, cur = cs(k).cands;
  if (!base) return `<div class="card"><h2>השוואה למחזור קודם</h2><p class="mut">עדיין לא הועלו נתוני ייחוס. העלו אקסל של מחזור קודם (או נתונים קיימים) במסך ״הזנה וייבוא״, והמערכת תציג כאן את הפערים מול המחזור הנוכחי.</p>${R().pages.includes('import') ? '<a class="btn" href="#/import" style="text-decoration:none;display:inline-block">למסך ההעלאה ←</a>' : '<div class="mut small">ההעלאה זמינה לשלישות החיל.</div>'}</div>`;
  const prev = base.rows, L = base.label, units = c.units;
  const avgOf = (arr, f) => { const v = arr.map(f).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const pc = (a, b) => (b ? a / b * 100 : null), f1 = (v) => (v == null ? '—' : (Math.round(v * 10) / 10).toFixed(1)), pf = (v) => (v == null ? '—' : Math.round(v) + '%');
  const verdict = (delta, dir, tol) => { if (delta == null) return ['p-gray', '—']; if (Math.abs(delta) < tol) return ['p-gray', '＝ ללא שינוי']; if (dir === 0) return ['p-gray', delta > 0 ? '▲ עלייה' : '▼ ירידה']; return delta * dir > 0 ? ['p-green', (delta > 0 ? '▲' : '▼') + ' השתפר'] : ['p-orange', (delta > 0 ? '▲' : '▼') + ' הורע']; };
  const sgn = (v, fmt) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v));
  const kp = [
    { t: 'מועמדים', now: cur.length, pre: prev.length, fmt: (v) => String(Math.round(v)), dir: 0, tol: 1, unit: '' },
    { t: 'שיעור ״מומלץ״', now: pc(cur.filter((x) => x.rec === 'מומלץ').length, cur.filter((x) => x.rec).length), pre: pc(prev.filter((x) => x.rec === 'מומלץ').length, prev.filter((x) => x.rec).length), nn: cur.filter((x) => x.rec).length, np: prev.filter((x) => x.rec).length, fmt: pf, dfmt: (v) => String(Math.round(v)), dir: 1, tol: 1, unit: ' נק׳' },
    { t: 'מוטיבציה ממוצעת', now: avgOf(cur, (x) => (x.extra ? x.extra.motivation : null)), pre: avgOf(prev, (x) => x.motivation), nn: cur.filter((x) => x.extra && x.extra.motivation != null).length, np: prev.filter((x) => x.motivation != null).length, fmt: f1, dir: 1, tol: 0.05, unit: '' },
    { t: 'לא מעוניינים בתפקיד קרבי', now: pc(cur.filter((x) => x.wish && x.wish.combat === 0).length, cur.filter((x) => x.wish && x.wish.combat != null).length), pre: pc(prev.filter((x) => x.combat === 0).length, prev.filter((x) => x.combat != null).length), nn: cur.filter((x) => x.wish && x.wish.combat != null).length, np: prev.filter((x) => x.combat != null).length, fmt: pf, dfmt: (v) => String(Math.round(v)), dir: -1, tol: 1, unit: ' נק׳' },
    { t: 'תיקים עם נתונים חסרים', now: pc(cur.filter((x) => missingOf(k, x).length).length, cur.length), pre: pc(prev.filter((r) => !r.rec || c.stats.some((s) => r.stats[s.k] == null)).length, prev.length), fmt: pf, dfmt: (v) => String(Math.round(v)), dir: -1, tol: 1, unit: ' נק׳' },
  ];
  const kpis = kp.map((m) => { const d = m.now != null && m.pre != null ? m.now - m.pre : null, v = verdict(d, m.dir, m.tol); return `<div class="kpi"><b><bdi dir="ltr">${m.now == null ? '—' : m.fmt(m.now)}</bdi></b><span>${m.t}${m.nn != null && m.nn !== cur.length ? ` <span class="small">(מתוך ${m.nn})</span>` : ''}</span><div class="row" style="gap:6px;margin-top:6px"><span class="pill ${v[0]}">${v[1]}${d != null && Math.abs(d) >= m.tol ? ' <bdi dir="ltr">' + sgn(d, m.dfmt || m.fmt) + m.unit + '</bdi>' : ''}</span></div><div class="mut small" style="margin-top:2px">${esc(L)}: <bdi dir="ltr">${m.pre == null ? '—' : m.fmt(m.pre)}</bdi>${m.np != null && m.np !== prev.length ? ` <span class="small">(מתוך ${m.np})</span>` : ''}</div></div>`; }).join('');

  // metrics: average now vs before, direction-aware (lower is better for times)
  const statRows = c.stats.map((s) => { const a = avgOf(cur, (x) => x.stats[s.k]), b = avgOf(prev, (r) => r.stats[s.k]), d = a != null && b != null ? a - b : null, v = verdict(d, s.low ? -1 : 1, (s.max - s.min) * 0.01), dd = Math.pow(10, s.d + 1);
    return { s, a, b, d, v, rel: d == null ? 0 : Math.abs(d) / (s.max - s.min), html: `<tr><td>${esc(s.l)}</td><td><bdi dir="ltr">${a == null ? '—' : fmtVal(s, a)} ${esc(s.u)}</bdi></td><td><bdi dir="ltr">${b == null ? '—' : fmtVal(s, b)} ${esc(s.u)}</bdi></td><td><bdi dir="ltr">${d == null ? '—' : sgn(d, (x) => (isTime(s) ? fmtTime(x) : Math.round(x * dd) / dd))}</bdi></td><td><span class="pill ${v[0]}">${v[1]}</span></td></tr>` }; });
  const statTable = `<div style="overflow:auto"><table><thead><tr><th>מדד</th><th>עכשיו</th><th>${esc(L)}</th><th>הפרש</th><th>הערכה</th></tr></thead><tbody>${statRows.map((r) => r.html).join('')}</tbody></table></div><div class="mut small" style="margin-top:6px">ממוצע לפי הנתונים הקיימים בלבד (מדד חסר לא נספר). בריצה ובזמנים – נמוך יותר הוא טוב יותר.</div>`;

  // grouped bars (HTML): two thin bars per row, value at the tip, tooltip on hover/focus
  const grouped = (rows, maxV, fmt) => rows.map((r) => `<div class="grow"><span class="srow-l">${esc(r.label)}</span><div class="gbars">${[['now', r.now, 'עכשיו', r.nNow, cur.length], ['pre', r.pre, L, r.nPre, prev.length]].map((x) => `<div class="gb" data-tip="${x[1] == null ? 'אין נתון' : fmt(x[1])}${x[3] != null ? ' · מתוך ' + x[3] + ' מועמדים עם נתון מלא' : ''}|${esc(r.label)} · ${esc(x[2])}" tabindex="0"><i class="${x[0]}" style="width:${maxV && x[1] != null ? Math.max(0, x[1] / maxV * 100).toFixed(1) : 0}%"></i><em>${x[1] == null ? '—' : fmt(x[1])}${x[3] != null && x[3] < x[4] ? ` <span class="small">(${x[3]}/${x[4]})</span>` : ''}</em></div>`).join('')}</div></div>`).join('');
  const key2 = `<div class="legend row" style="margin-bottom:8px"><span class="lg"><i class="sq" style="background:var(--s1)"></i>עכשיו</span><span class="lg"><i class="sq" style="background:var(--ref)"></i>${esc(L)}</span></div>`;
  const roleRows = c.roles.map((r) => ({ label: r, now: cur.filter((x) => x.role === r).length, pre: prev.filter((x) => x.role === r).length }));
  // gaps vs unit needs
  const gapRows = c.roles.map((r) => { const demand = units.reduce((a, u) => a + (u.quota[r] || 0), 0), supply = cur.filter((x) => x.role === r && x.rec !== 'לא מומלץ').length, before = prev.filter((x) => x.role === r && x.rec !== 'לא מומלץ').length, gap = demand - supply; return { r, demand, supply, before, gap }; }).filter((g) => g.demand || g.supply || g.before);
  const gapTable = `<div style="overflow:auto"><table><thead><tr><th>תפקיד</th><th>נדרש</th><th>זמינים</th><th>${esc(L)}</th><th>פער</th></tr></thead><tbody>${gapRows.map((g) => `<tr><td>${esc(g.r)}</td><td>${g.demand}</td><td>${g.supply} <span class="mut small"><bdi dir="ltr">(${sgn(g.supply - g.before, String) || '0'})</bdi></span></td><td>${g.before}</td><td>${g.gap > 0 ? `<span class="pill p-orange">חוסר ${g.gap}</span>` : (g.demand ? `<span class="pill p-green">מכוסה${g.gap < 0 ? ' · עודף ' + -g.gap : ''}</span>` : '<span class="pill p-gray">אין דרישה</span>')}</td></tr>`).join('')}</tbody></table></div><div class="mut small" style="margin-top:6px">נדרש = סך מכסות היחידות בחיל. זמינים = מועמדים עם המלצה שאינה שלילית (בסוגריים: שינוי מול הנתונים שהועלו). עמודת הכותרת עם שם הנתונים = כמה היו אז.</div>`;
  // threshold coverage per unit (recommendation ignored – thresholds only)
  const okThr = (x, u) => fitOf(k, x, u).filter((e) => e.s !== 'המלצה').every((e) => e.ok);
  const known = (x, u) => c.stats.filter((s) => u.th[s.k] != null).every((s) => x.stats[s.k] != null) && (!u.noMed || x.med != null); // a missing metric is unknown, not a failure
  const cov = (arr, u) => { const kn = arr.filter((x) => known(x, u)); return { p: pc(kn.filter((x) => okThr(x, u)).length, kn.length), n: kn.length }; };
  const unitRows = units.map((u) => { const a = cov(cur, u), b2 = cov(prev, u); return { label: u.name, now: a.p, pre: b2.p, nNow: a.n, nPre: b2.n }; });
  // insights
  const notes = [];
  gapRows.filter((g) => g.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 2).forEach((g) => notes.push(`חוסר בתפקיד ${g.r}: נדרשים ${g.demand}, זמינים ${g.supply} (ב${L} היו ${g.before}).`));
  const best = statRows.filter((r) => r.d != null).sort((a, b) => b.rel - a.rel)[0];
  if (best && best.rel > 0.02) notes.push(`השינוי הגדול ביותר במדדים: ${best.s.l} (${best.v[1].replace(/^[▲▼＝] /, '')}, ${fmtVal(best.s, best.a)} מול ${fmtVal(best.s, best.b)} ${best.s.u}).`);
  const drop = unitRows.filter((u) => u.now != null && u.pre != null).map((u) => ({ u, d: u.now - u.pre })).sort((a, b) => a.d - b.d)[0];
  if (drop && drop.d < -5) notes.push(`הירידה הגדולה ביותר בכיסוי תנאי הסף: ${drop.u.label} (${pf(drop.u.now)} מול ${pf(drop.u.pre)}).`);
  const nc = kp[3]; if (nc.now != null && nc.pre != null && Math.abs(nc.now - nc.pre) >= 5) notes.push(`שיעור הלא מעוניינים בתפקיד קרבי ${nc.now > nc.pre ? 'עלה' : 'ירד'} מ־${pf(nc.pre)} ל־${pf(nc.now)}.`);
  return `<div class="row spread"><div><b>השוואה מול: ${esc(L)}</b> <span class="mut small">· ${base.rows.length} שורות · הועלה ע״י ${esc(base.by)} · ${new Date(base.uploadedAt).toLocaleDateString('he-IL')}</span></div>${R().pages.includes('import') ? '<a class="btn sec sm" href="#/import" style="text-decoration:none">החלפת נתוני ייחוס</a>' : ''}</div>
   <div class="grid g3" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">${kpis}</div>
   <div class="card"><h2>נקודות בולטות</h2><ul style="margin:0;padding:0 20px 0 0;line-height:1.9">${notes.map((t) => `<li>${esc(t)}</li>`).join('') || '<li>אין פערים בולטים בין הנתונים.</li>'}</ul><div class="mut small" style="margin-top:8px">ההשוואה היא בין שתי אוכלוסיות שונות, נוצרה מכללים שקופים ואינה הערכה של אדם או יחידה.</div></div>
   <div class="grid g2"><div class="card"><h2>מדדים – עכשיו מול ${esc(L)}</h2>${statTable}</div><div class="card"><h2>פערים מול צורכי היחידות</h2>${gapTable}</div></div>
   <div class="grid g2"><div class="card"><h2>מועמדים לפי תפקיד</h2>${key2}${grouped(roleRows, Math.max(1, ...roleRows.map((r) => Math.max(r.now, r.pre))), (v) => String(Math.round(v)))}</div>
    <div class="card"><h2>עמידה בתנאי הסף – לפי יחידה</h2><div class="mut small" style="margin-bottom:6px">אחוז העומדים בכל תנאי הסף של היחידה (כולל מגבלה רפואית, ללא המלצת המגבש) – מחושב רק על מועמדים שיש להם נתון לכל תנאי הסף</div>${key2}${grouped(unitRows, 100, (v) => Math.round(v) + '%')}</div></div>`;
}

// ---------------- command overview ----------------
function unitProgress(k, u) { const q = Object.keys(u.quota).reduce((a, r) => a + u.quota[r], 0), g = Object.keys(u.quota).reduce((a, r) => a + Math.min(u.quota[r], countRole(k, u.name, r)), 0); return { q, g }; }
function dilemmas(k) {
  const c = cf(k), d = draftInfo(k), free = cs(k).cands.filter((x) => !d.takenBy[x.id]), pts = [];
  const contested = free.map((x) => ({ x, us: c.units.filter((u) => (u.quota[x.role] || 0) > countRole(k, u.name, x.role) && !fitBad(k, x, unitOf(k, u.name)).length) })).filter((o) => o.us.length > 1);
  contested.sort((a, b) => b.us.length - a.us.length).slice(0, 4).forEach((o) => pts.push(`${o.x.name} (${o.x.role}) מתאים/ה לצורך פתוח ב־${o.us.length} יחידות: ${o.us.map((u) => u.name).join(', ')}.`));
  c.roles.forEach((r) => {
    const need = c.units.reduce((a, u) => a + Math.max(0, (u.quota[r] || 0) - countRole(k, u.name, r)), 0), avail = free.filter((x) => x.role === r && x.rec !== 'לא מומלץ').length;
    if (need > avail) pts.push(`חוסר בתפקיד ${r}: נדרשים עוד ${need}, פנויים עם המלצה לא שלילית ${avail}.`);
  });
  const miss = cs(k).cands.filter((x) => missingOf(k, x).length).length; if (miss) pts.push(`${miss} תיקים עם נתונים חסרים – כדאי להשלים מול המגבשים לפני הבחירה.`);
  const bad = free.filter((x) => x.rec === 'לא מומלץ').length; if (bad) pts.push(`${bad} מועמדים פנויים עם המלצה שלילית – נדרשת החלטה מי מהיחידות מוכנה לקלוט.`);
  const hp = c.units.filter((u) => u.prio === 0).reduce((a, u) => a + Object.keys(u.quota).reduce((x, r) => x + Math.max(0, u.quota[r] - countRole(k, u.name, r)), 0), 0);
  const wr = (p) => wishRank(candOf(k, p.id), p.unit), wp = d.picks.filter((p) => wr(p) > 0).length, w1 = d.picks.filter((p) => wr(p) === 1).length;
  if (d.picks.length) pts.push(`התאמה להעדפות: ${wp} מתוך ${d.picks.length} שובצו ליחידה שביקשו (${w1} בבחירה הראשונה). ההעדפה היא שיקול משני – השיבוץ נקבע לפי צורכי היחידות.`);
  const diffRole = free.filter((x) => x.wish && x.wish.role && x.wish.role !== x.role).length; if (diffRole) pts.push(`${diffRole} מועמדים פנויים ביקשו תפקיד שונה מהתפקיד שהמגבש המליץ עליו.`);
  const noNeed = free.filter((x) => x.wish && x.wish.units.length && x.wish.units.every((u) => !((unitOf(k, u).quota[x.role] || 0) > countRole(k, u, x.role)))).length; if (noNeed) pts.push(`${noNeed} מועמדים פנויים ביקשו רק יחידות שאין להן כרגע צורך פתוח בתפקידם – סביר שהשיבוץ לא יהיה לפי ההעדפה.`);
  return { pts, contested, hp, miss, wp, wtot: d.picks.length };
}
SCREENS.command = (k) => {
  const c = cf(k), d = draftInfo(k), tab = A.ui.tab || 'units';
  const tot = c.units.reduce((a, u) => { const p = unitProgress(k, u); return { q: a.q + p.q, g: a.g + p.g }; }, { q: 0, g: 0 });
  const done = c.units.filter((u) => { const p = unitProgress(k, u); return p.g >= p.q; }).length;
  const gapR = tot.q - tot.g;
  const tabs = [['units', 'יחידות'], ['dist', 'פילוג אנשים'], ['cmp', 'השוואה למחזור קודם'], ['pres', 'מצגת לפיקוד'], ['forum', 'דילמות'], ['report', 'דוח']];
  const matrix = `<div style="overflow:auto"><table><thead><tr><th>יחידה</th><th>קדימות</th>${c.roles.map((r) => `<th>${esc(r)}</th>`).join('')}<th>התקדמות</th></tr></thead><tbody>${c.units.map((u) => { const p = unitProgress(k, u); return `<tr><td><b>${esc(u.name)}</b><div class="mut small">${esc(u.desc)}</div></td><td>${['גבוהה', 'רגילה', 'נמוכה'][u.prio]}</td>${c.roles.map((r) => { const q = u.quota[r]; if (!q) return '<td class="mut">·</td>'; const h = countRole(k, u.name, r); return `<td><span class="pill ${h >= q ? 'p-green' : h > 0 ? 'p-orange' : 'p-gray'}">${h}/${q}</span></td>`; }).join('')}<td style="min-width:140px"><div class="row"><div class="bar"><i style="width:${p.q ? p.g / p.q * 100 : 0}%"></i></div><b>${p.g}/${p.q}</b></div></td></tr>`; }).join('')}</tbody></table></div>`;
  const corpsProg = Object.keys(A.cfg.corps).filter((x) => !A.me.corps || x === A.me.corps).map((x) => { const t = draftInfo(x); return `<div class="row" style="margin:8px 0"><span style="min-width:130px">${esc(cf(x).corps)}</span><div class="bar"><i style="width:${t.picks.length / t.order.length * 100}%;background:var(--blue)"></i></div><b>${t.picks.length}/${t.order.length}</b></div>`; }).join('');
  let body = '';
  if (tab === 'units') body = `<div class="card"><h2>מכסות לפי יחידה ותפקיד</h2><div class="mut small" style="margin-bottom:8px">שובצו / נדרשו · ירוק: הושלם · כתום: חלקי · אפור: טרם שובץ</div>${matrix}</div>
    <div class="grid g2"><div class="card"><h2>התקדמות לפי חיל</h2>${corpsProg}<div class="mut small">לכל חיל דראפט נפרד: יחידות לוחמה לא מתחרות על אותם מועמדים עם מודיעין או קשר.</div></div>
    <div class="card"><h2>בחירות אחרונות</h2>${d.picks.slice(-7).reverse().map((p) => `<div class="row" style="padding:4px 0"><b>#${p.n}</b><span>${esc(p.unit)} · ${esc(candOf(k, p.id).name)} ${esc(candOf(k, p.id).role)}</span></div>`).join('') || '<span class="mut">אין בחירות</span>'}</div></div>`;
  if (tab === 'dist') body = distView(k);
  if (tab === 'cmp') body = cmpView(k);
  if (tab === 'pres') {
    const colors = ['#3F5530', '#2F5A8A', '#C2741F', '#8A5A9A', '#5A6472'];
    const counts = c.units.map((u) => d.picks.filter((p) => p.unit === u.name).length), sum = counts.reduce((a, b) => a + b, 0) || 1;
    let off = 0; const segs = counts.map((n, i) => { const len = n / sum * 339.3, s = `<circle cx="70" cy="70" r="54" fill="none" stroke="${colors[i % 5]}" stroke-width="18" stroke-dasharray="${len} ${339.3 - len}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"/>`; off += len; return s; }).join('');
    body = `<div class="grid g2"><div class="card"><h2>מגויסים לכל יחידה</h2><div class="row"><svg viewBox="0 0 140 140" width="170" role="img" aria-label="תרשים טבעת"><circle cx="70" cy="70" r="54" fill="none" stroke="var(--line2)" stroke-width="18"/>${segs}<text x="70" y="68" text-anchor="middle" font-size="22" font-weight="800">${d.picks.length}</text><text x="70" y="86" text-anchor="middle" font-size="10" fill="#5A6472">בחירות</text></svg>
     <div>${c.units.map((u, i) => `<div class="row" style="gap:8px"><span class="mark" style="background:${colors[i % 5]}"></span>${esc(u.name)} <b>${counts[i]}</b></div>`).join('')}</div></div></div>
     <div class="card"><h2>מה כל יחידה מחפשת</h2>${c.units.map((u) => `<div style="padding:6px 0;border-bottom:1px solid var(--line2)"><b>${esc(u.name)}</b> <span class="mut small">${esc(u.why)}</span><div class="small">${Object.keys(u.quota).map((r) => `${esc(r)} ×${u.quota[r]}`).join(' · ')}</div></div>`).join('')}</div></div>`;
  }
  if (tab === 'forum') {
    const dl = dilemmas(k), full = cs(k).cands.length - dl.miss;
    body = `<div class="grid g3"><div class="kpi"><b>${full}/${cs(k).cands.length}</b><span>תיקים מלאים</span></div><div class="kpi"><b>${dl.contested.length}</b><span>מועמדים במחלוקת</span></div><div class="kpi"><b>${dl.hp}</b><span>צרכי קדימות גבוהה פתוחים</span></div><div class="kpi"><b>${dl.wp}/${dl.wtot}</b><span>שובצו ליחידה שביקשו</span></div></div>
     <div class="card"><h2>נקודות לדיון</h2><ul style="margin:0;padding:0 20px 0 0;line-height:1.8">${dl.pts.map((p) => `<li>${esc(p)}</li>`).join('') || '<li>אין נקודות חריגות כרגע.</li>'}</ul><div class="mut small" style="margin-top:8px">נוצר מכללים שקופים על הנתונים: תחרות, חוסרים וחריגות. אין כאן המלצה על אדם או יחידה.</div></div>`;
  }
  if (tab === 'report') {
    body = `<div class="card"><div class="row spread"><h2 style="font-size:24px;margin:0">דוח מצב דראפט כוח אדם – ${esc(c.corps)}</h2><span class="mut small">${new Date().toLocaleDateString('he-IL')}</span></div>
     <p>שובצו ${d.picks.length} מתוך ${d.order.length} בחירות · מכסות שמולאו ${tot.g}/${tot.q} · יחידות שהושלמו ${done}/${c.units.length}.</p>${matrix}
     <h3 style="margin:14px 0 6px">שיבוצים</h3><table><thead><tr><th>#</th><th>יחידה</th><th>מועמד/ת</th><th>תפקיד</th><th>המלצה</th><th>העדפת החייל</th></tr></thead><tbody>${d.picks.map((p) => `<tr><td>${p.n}</td><td>${esc(p.unit)}</td><td>${esc(candOf(k, p.id).name)}</td><td>${esc(candOf(k, p.id).role)}</td><td>${esc(candOf(k, p.id).rec || '—')}</td><td>${wishRank(candOf(k, p.id), p.unit) ? 'בחירה ' + wishRank(candOf(k, p.id), p.unit) : 'לא ביקש/ה'}</td></tr>`).join('')}</tbody></table>
     <div class="mut small" style="margin-top:10px">הדוח נוצר מכללים שקופים ואינו המלצה על אדם או יחידה.</div>
     <div class="row no-print" style="margin-top:10px"><button class="btn" data-act="print">הדפסה / שמירה כ־PDF</button><button class="btn sec" data-act="exportPicks">ייצוא שיבוצים CSV</button></div></div>`;
  }
  return `<div class="row spread"><div>${corpsSwitcher()}<h1 style="font-size:28px;font-weight:800;margin-top:6px">תמונת מצב – ${esc(c.corps)}</h1><div class="mut small">להצגה לראשי מטה, לקצינות שלישות ולמפקדי הכשרות</div></div>
   <div class="row no-print">${can('factory', k) ? '<button class="btn sec sm" data-act="factory">איפוס מערכת</button>' : ''}${can('advance', k) ? `<span class="mut small">מצב הדראפט להדגמה:</span><select data-chg="demoState"><option value="">בחירה…</option><option value="1">אחרי סבב 1</option><option value="2">אחרי סבב 2</option><option value="3">אחרי סבב 3</option><option value="4">הדראפט הסתיים</option></select>` : ''}</div></div>
   <div class="grid g3" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))"><div class="kpi"><b>${d.picks.length} / ${cs(k).cands.length}</b><span>שובצו · מועמדים ב${esc(c.label)}</span></div><div class="kpi"><b>${tot.q ? Math.round(tot.g / tot.q * 100) : 0}%</b><span>מכסות שמולאו (${tot.g} מתוך ${tot.q})</span></div><div class="kpi"><b>${gapR}</b><span>פערים פתוחים</span></div><div class="kpi"><b>${done} / ${c.units.length}</b><span>יחידות שהושלמו</span></div></div>
   <div class="tabs no-print">${tabs.map((t) => `<button class="${tab === t[0] ? 'on' : ''}" data-act="tab" data-t="${t[0]}">${t[1]}</button>`).join('')}</div>${body}`;
};
Object.assign(ACTIONS, {
  tab: (d) => { A.ui.tab = d.t; rerender(); },
  distScope: (d) => { A.ui.dist = d.s; rerender(); },
  factory: async () => { if (confirm('לאפס את כל הנתונים בכל החילות?')) { await api('factory-reset', {}); toast('המערכת אופסה'); } },
  print: () => window.print(),
  demoState: async (d, t) => { if (!t.value) return; await api('advance', { corps: corpsKey(), rounds: +t.value }); t.value = ''; toast('מצב הדראפט עודכן'); },
  exportPicks: () => { const k = corpsKey(), d = draftInfo(k); csvDownload('draft-' + k + '.csv', [['#', 'יחידה', 'מועמד', 'מס׳', 'תפקיד', 'המלצה']].concat(d.picks.map((p) => [p.n, p.unit, candOf(k, p.id).name, p.id, candOf(k, p.id).role, candOf(k, p.id).rec || '']))); },
});

// ---------------- import ----------------
const SYN = { id: ['מס׳', 'מס', 'מספר', 'id'], name: ['שם', 'שם מלא', 'name'], role: ['תפקיד', 'role'], rec: ['המלצת מגבש', 'המלצה'], med: ['מגבלות רפואיות', 'מגבלות', 'רפואי'], profile: ['פרופיל'], motivation: ['מוטיבציה'], combat: ['נכונות', 'קרבי'], unit: ['יחידה', 'שובץ'] };
function importFields(k) { return [['id', 'מס׳ (לזיהוי בעדכון)'], ['name', 'שם'], ['role', 'תפקיד'], ['rec', 'המלצת מגבש'], ['med', 'מגבלות רפואיות'], ['profile', 'פרופיל'], ['motivation', 'מוטיבציה (1–5)'], ['combat', 'נכונות לתפקיד קרבי']].concat(cf(k).stats.map((s) => ['s:' + s.k, s.l + ' (' + s.u + ')'])); }
function baseFields(k) { return importFields(k).filter(([key]) => key !== 'id' && key !== 'name').concat([['unit', 'יחידה משובצת']]); }
function autoMapFields(k, fields, headers) {
  const m = {};
  fields.forEach(([key, label]) => {
    const want = key.startsWith('s:') ? [cf(k).stats.find((s) => 's:' + s.k === key).l, label] : SYN[key];
    m[key] = headers.findIndex((h) => want.some((w) => String(h).trim().startsWith(w)));
  });
  return m;
}
const autoMap = (k, headers) => autoMapFields(k, importFields(k), headers);
function parseCombat(v) { const t = String(v == null ? '' : v).trim(); if (t === '') return null; if (['0', '1', '2'].includes(t)) return +t; if (t.includes('לא')) return 0; if (t.includes('פתוח')) return 1; if (/מעוניין|כן|רוצה/.test(t)) return 2; return null; }
function parseRow(k, r, map) {
  const g = (key) => (map[key] >= 0 ? r[map[key]] : '');
  const stats = {}, statErrs = []; cf(k).stats.forEach((s) => { const raw = g('s:' + s.k); if (String(raw).trim() === '') { stats[s.k] = ''; return; } const v = parseStat(s, raw); if (v == null) statErrs.push('מדד לא תקין: ' + s.l); stats[s.k] = v == null ? '' : v; });
  return { statErrs, id: String(g('id') || '').trim(), name: String(g('name') || '').trim(), role: String(g('role') || '').trim(), rec: String(g('rec') || '').trim(), med: String(g('med') || '').trim(), profile: g('profile'), stats, motivation: g('motivation'), combat: parseCombat(g('combat')), unit: String(g('unit') || '').trim() };
}
function buildRows(k) {
  const im = A.ui.imp; if (!im) return [];
  const mode = A.ui.impMode || 'add';
  return im.data.map((r, n) => {
    const row = parseRow(k, r, im.map), errs = row.statErrs.slice();
    if (mode === 'add') {
      if (!row.med) row.med = 'ללא מגבלות';
      if (!row.name) errs.push('חסר שם');
      if (!cf(k).roles.includes(row.role)) errs.push('תפקיד לא מוכר');
      if (row.rec && !A.cfg.RECS.includes(row.rec)) errs.push('המלצה לא מוכרת');
      if (!A.cfg.MEDS.includes(row.med)) errs.push('מגבלה לא מוכרת');
      if (cs(k).cands.some((c) => c.name === row.name)) errs.push('כבר קיים במאגר');
    } else {
      if (!row.id && !row.name) errs.push('חסר מס׳ או שם');
      else if (!cs(k).cands.some((c) => (row.id && c.id === row.id) || (row.name && c.name === row.name))) errs.push('לא נמצא במאגר');
      if (row.role && !cf(k).roles.includes(row.role)) errs.push('תפקיד לא מוכר');
      if (row.rec && !A.cfg.RECS.includes(row.rec)) errs.push('המלצה לא מוכרת');
      if (row.med && !A.cfg.MEDS.includes(row.med)) errs.push('מגבלה לא מוכרת');
    }
    return Object.assign(row, { n: n + 2, errs });
  });
}
function buildBaseRows(k) {
  const b = A.ui.base; if (!b) return [];
  return b.data.map((r, n) => {
    const row = parseRow(k, r, b.map), errs = row.statErrs.slice();
    if (!cf(k).roles.includes(row.role)) errs.push('תפקיד לא מוכר');
    if (row.rec && !A.cfg.RECS.includes(row.rec)) errs.push('המלצה לא מוכרת');
    if (row.med && !A.cfg.MEDS.includes(row.med)) errs.push('מגבלה לא מוכרת');
    return Object.assign(row, { n: n + 2, errs });
  });
}
const baseHeaders = (k) => ['תפקיד', 'המלצת מגבש', 'מגבלות רפואיות', 'פרופיל'].concat(cf(k).stats.map((s) => s.l + ' (' + s.u + ')'), ['מוטיבציה (1–5)', 'נכונות לתפקיד קרבי', 'יחידה משובצת']);
function sampleBaseAoa(k) { // demo previous cycle: slightly weaker results, more "not interested in combat"
  const c = cf(k); let seed = 5; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const aoa = [baseHeaders(k)];
  for (let i = 0; i < 26; i++) {
    const role = c.roles[(i * 2 + (i % 3)) % c.roles.length], t = Math.min(1, Math.max(0, 0.28 + rnd() * 0.5));
    aoa.push([role, A.cfg.RECS[t > 0.62 ? 0 : (t > 0.4 ? 1 : 2)], i % 7 === 3 ? A.cfg.MEDS[1] : A.cfg.MEDS[0], 90].concat(c.stats.map((s) => { if (rnd() < 0.06) return ''; const raw = s.low ? s.max - (s.max - s.min) * t : s.min + (s.max - s.min) * t; return cellVal(s, +raw.toFixed(s.d)); }), [Math.max(1, Math.min(5, Math.round(1.8 + t * 3 + (rnd() - 0.5)))), rnd() < 0.34 ? 'לא מעוניין' : (rnd() < 0.5 ? 'פתוח' : 'מעוניין'), '']));
  }
  return aoa;
}
function baselineCard(k, canImp) {
  const c = cf(k), base = cs(k).baseline, b = A.ui.base, rows = b ? buildBaseRows(k) : [], ok = rows.filter((r) => !r.errs.length);
  const when = base ? new Date(base.uploadedAt).toLocaleDateString('he-IL') : '';
  return `<div class="card"><h2>נתוני ייחוס – מחזור קודם או נתונים קיימים</h2>
   <p class="mut small">העלו אקסל של נתונים קיימים (למשל מחזור קודם): שורה לכל חייל, עם תפקיד, המלצה, מדדים, מוטיבציה ונכונות לתפקיד קרבי. המערכת קוראת ומנתחת אותם ומשווה למחזור הנוכחי בלשונית ״השוואה למחזור קודם״ בתמונת המצב. <b>שמות לא נשמרים</b> – רק נתוני הניתוח.</p>
   ${base ? `<div class="row spread" style="background:var(--bg2);border-radius:12px;padding:10px 14px;margin-bottom:10px"><div><b>${esc(base.label)}</b> · ${base.rows.length} שורות<div class="mut small">הועלה ע״י ${esc(base.by)} · ${when}</div></div><div class="row"><a class="btn sm" href="#/command" data-act="goCmp" style="text-decoration:none">צפייה בהשוואה ←</a>${canImp ? '<button class="btn sec sm" data-act="bdelete">מחיקה</button>' : ''}</div></div>` : ''}
   <div class="drop"><div class="row" style="justify-content:center"><label class="small mut">שם הנתונים<br><input type="text" id="blabel" data-inp="blabel" value="${esc((b && b.label) || 'מחזור קודם')}" style="width:170px"></label></div>
    <input type="file" id="bfile" accept=".xlsx,.xls,.csv" data-chg="bfile" ${canImp ? '' : 'disabled'} style="margin-top:8px"><div class="row" style="justify-content:center;margin-top:10px"><button class="btn sec sm" data-act="bsample" ${canImp ? '' : 'disabled'}>טעינת נתוני ייחוס לדוגמה</button><button class="btn sec sm" data-act="btemplate">הורדת תבנית</button></div></div>
   ${b ? `<div style="margin-top:12px"><b>התאמת עמודות</b><div class="row" style="margin-top:6px">${baseFields(k).map(([key, label]) => `<label class="small mut">${esc(label)}<br><select data-chg="bmap" data-f="${esc(key)}" style="min-width:140px"><option value="-1">— לא ממופה —</option>${b.headers.map((h, i) => `<option value="${i}" ${b.map[key] === i ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select></label>`).join('')}</div>
    <p style="margin:10px 0 4px">${rows.length} שורות · <b style="color:var(--green)">${ok.length} תקינות</b> · <b style="color:var(--red)">${rows.length - ok.length} עם בעיות (ידולגו)</b>${rows.length - ok.length ? ' – ' + esc(Array.from(new Set(rows.flatMap((r) => r.errs))).join(', ')) : ''}</p>
    <div class="row"><button class="btn" data-act="bsave" ${canImp && ok.length ? '' : 'disabled'}>שמירה כנתוני ייחוס (${ok.length} שורות)</button><button class="btn sec" data-act="bcancel">ביטול</button></div></div>` : ''}</div>`;
}
SCREENS.import = (k) => {
  const c = cf(k), im = A.ui.imp, canImp = can('import', k), started = cs(k).picks.length > 0;
  const rows = im ? buildRows(k) : [], ok = rows.filter((r) => !r.errs.length);
  const miss = cs(k).cands.filter((x) => missingOf(k, x).length).length;
  return `<div class="row spread"><div>${corpsSwitcher()}<h1 style="font-size:28px;font-weight:800;margin-top:6px">הזנה וייבוא</h1><div class="mut small">קליטת מועמדים, עדכון נתונים קיימים ונתוני ייחוס – מקובץ אקסל או CSV, לפי חיל</div></div></div>
   <div class="grid g3"><div class="kpi"><b>${cs(k).cands.length}</b><span>מועמדים במאגר</span></div><div class="kpi"><b>${A.ui.imported || 0}</b><span>יובאו בטעינה זו</span></div><div class="kpi"><b>${miss}</b><span>תיקים עם נתונים חסרים</span></div></div>
   <div class="card"><h2>1. בחירת קובץ</h2><div class="seg" style="margin-bottom:10px">${[['add', 'הוספת מועמדים חדשים'], ['update', 'עדכון מועמדים קיימים']].map((m) => `<button type="button" class="${(A.ui.impMode || 'add') === m[0] ? 'on' : ''}" data-act="impmode" data-m="${m[0]}">${m[1]}</button>`).join('')}</div>
    ${(A.ui.impMode || 'add') === 'update' ? '<p class="mut small">העמודות: מס׳ <b>או</b> שם (לזיהוי המועמד במאגר) ועוד כל שדה שרוצים לעדכן. שדות ריקים לא ידרסו נתונים קיימים.</p>' : ''}<p class="mut small" ${(A.ui.impMode || 'add') === 'update' ? 'hidden' : ''}>עמודות נדרשות: שם, תפקיד, המלצת מגבש, מגבלות רפואיות, פרופיל, ${c.stats.map((s) => esc(s.l + ' (' + s.u + ')')).join(', ')}. שורה אחת לכל מועמד/ת.</p>
    ${!canImp ? '<div class="demo-note">ייבוא זמין לשלישות החיל בלבד.</div>' : ''}${started ? '<div class="demo-note">הדראפט כבר התחיל – מועמדים חדשים יצטרפו למאגר הפנויים.</div>' : ''}
    <div class="drop"><input type="file" id="file" accept=".xlsx,.xls,.csv" data-chg="file" ${canImp ? '' : 'disabled'}><div class="row" style="justify-content:center;margin-top:10px"><button class="btn sec sm" data-act="sample" ${canImp ? '' : 'disabled'}>טעינת קובץ לדוגמה</button><button class="btn sec sm" data-act="template">הורדת תבנית אקסל</button></div><div class="mut small" style="margin-top:6px">הקובץ נקרא בדפדפן ונשלח לשרת רק בלחיצה על ״ייבוא״. אין להעלות נתוני אמת באב־טיפוס.</div></div></div>
   ${im ? `<div class="card"><h2>2. התאמת עמודות</h2><div class="row">${importFields(k).map(([key, label]) => `<label class="small mut">${esc(label)}<br><select data-chg="map" data-f="${esc(key)}" style="min-width:150px"><option value="-1">— לא ממופה —</option>${im.headers.map((h, i) => `<option value="${i}" ${im.map[key] === i ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select></label>`).join('')}</div></div>
   <div class="card"><h2>3. בדיקה וייבוא</h2><p>${rows.length} שורות · <b style="color:var(--green)">${ok.length} תקינות</b> · <b style="color:var(--red)">${rows.length - ok.length} עם בעיות (ידולגו)</b></p>
    <div style="overflow:auto;max-height:320px"><table><thead><tr><th>שורה</th><th>שם</th><th>תפקיד</th><th>המלצה</th><th>מדדים חסרים</th><th>בדיקה</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.n}</td><td>${esc(r.name || r.id)}</td><td>${esc(r.role)}</td><td>${esc(r.rec || '—')}</td><td>${c.stats.filter((s) => r.stats[s.k] === '' || r.stats[s.k] == null).map((s) => esc(s.l)).join(', ') || '—'}</td><td>${r.errs.length ? `<span class="pill p-red">${esc(r.errs.join(', '))}</span>` : '<span class="pill p-green">תקין</span>'}</td></tr>`).join('')}</tbody></table></div>
    <div class="row" style="margin-top:10px"><button class="btn" data-act="doImport" ${canImp && ok.length ? '' : 'disabled'}>${(A.ui.impMode || 'add') === 'update' ? 'עדכון' : 'ייבוא'} ${ok.length} מועמדים</button><button class="btn sec" data-act="impClear">ביטול</button></div></div>` : ''}
   ${baselineCard(k, canImp)}
   <div class="card"><div class="row spread"><h2 style="margin:0">המאגר הנוכחי – ${esc(c.corps)}</h2><div class="row"><button class="btn sec sm" data-act="exportX">ייצוא לאקסל</button><button class="btn sec sm" data-act="exportC">ייצוא CSV</button></div></div>
    <div style="overflow:auto;max-height:420px;margin-top:8px"><table><thead><tr><th>מס׳</th><th>שם</th><th>תפקיד</th><th>המלצה</th><th>חסר בתיק</th><th>מקור</th></tr></thead><tbody>${cs(k).cands.map((x) => `<tr><td>${x.id}</td><td>${esc(x.name)}</td><td>${esc(x.role)}</td><td>${recPill(x.rec)}</td><td>${esc(missingOf(k, x).join(', ') || 'מלא')}</td><td>${esc(x.source || 'מאגר קיים')}</td></tr>`).join('')}</tbody></table></div>
    <div class="mut small" style="margin-top:8px">הנתונים נשמרים בשרת (data/state.json).</div></div>`;
};
function setBase(k, aoa) {
  const headers = (aoa[0] || []).map((h) => String(h)), data = aoa.slice(1).filter((r) => r.some((v) => String(v).trim() !== ''));
  A.ui.base = { headers, data, map: autoMapFields(k, baseFields(k), headers), label: A.ui.baseLabel || 'מחזור קודם' }; rerender();
}
function setImport(k, aoa) {
  const headers = (aoa[0] || []).map((h) => String(h)), data = aoa.slice(1).filter((r) => r.some((v) => String(v).trim() !== ''));
  A.ui.imp = { headers, data, map: autoMap(k, headers) }; rerender();
}
function sheetRows(k) { const c = cf(k); return [['שם', 'תפקיד', 'המלצת מגבש', 'מגבלות רפואיות', 'פרופיל'].concat(c.stats.map((s) => s.l + ' (' + s.u + ')'))]; }
function downloadX(name, aoa) { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'מועמדים'); wb.Workbook = { Views: [{ RTL: true }] }; XLSX.writeFile(wb, name); }
const poolRows = (k) => sheetRows(k).concat(cs(k).cands.map((x) => [x.name, x.role, x.rec || '', x.med, x.profile].concat(cf(k).stats.map((s) => cellVal(s, x.stats[s.k])))));
Object.assign(ACTIONS, {
  file: async (d, t) => { const f = t.files[0]; if (!f) return; const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }); setImport(corpsKey(), XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })); },
  map: (d, t) => { A.ui.imp.map[d.f] = +t.value; rerender(); },
  sample: () => {
    const k = corpsKey(), c = cf(k), aoa = sheetRows(k), names = ['נועה ל.', 'איתי ר.', 'שירה מ.', 'עומר ש.', 'מאיה ד.', 'דניאל כ.'];
    names.forEach((n, i) => aoa.push([n, c.roles[i % c.roles.length], A.cfg.RECS[i % 3], A.cfg.MEDS[i % 3 === 2 ? 1 : 0], 97].concat(c.stats.map((s) => (i === 4 && s === c.stats[0] ? '' : cellVal(s, +(s.min + (s.max - s.min) * (0.4 + 0.1 * i)).toFixed(s.d)))))));
    setImport(k, aoa);
  },
  template: () => downloadX('mil-draft-template.xlsx', sheetRows(corpsKey()).concat([['דוגמה ד.', cf(corpsKey()).roles[0], 'מומלץ', 'ללא מגבלות', 97].concat(cf(corpsKey()).stats.map((s) => cellVal(s, s.min)))])),
  impmode: (d) => { A.ui.impMode = d.m; rerender(); },
  bfile: async (d, t) => { const f = t.files[0]; if (!f) return; const k = corpsKey(), wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }); setBase(k, XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })); },
  bmap: (d, t) => { A.ui.base.map[d.f] = +t.value; rerender(); },
  blabel: (d, t) => { if (A.ui.base) A.ui.base.label = t.value; else A.ui.baseLabel = t.value; },
  bsample: () => setBase(corpsKey(), sampleBaseAoa(corpsKey())),
  btemplate: () => downloadX('mil-draft-baseline-template.xlsx', [baseHeaders(corpsKey()), [cf(corpsKey()).roles[0], 'מומלץ', 'ללא מגבלות', 97].concat(cf(corpsKey()).stats.map((s) => cellVal(s, s.min)), [4, 'פתוח', ''])]),
  bcancel: () => { A.ui.base = null; rerender(); },
  bsave: async () => {
    const k = corpsKey(), rows = buildBaseRows(k).filter((r) => !r.errs.length), label = (A.ui.base && A.ui.base.label) || 'מחזור קודם';
    const r = await api('baseline', { corps: k, label, rows: rows.map((x) => ({ role: x.role, rec: x.rec, med: x.med, profile: x.profile, stats: x.stats, motivation: x.motivation, combat: x.combat, unit: x.unit })) });
    A.ui.base = null; A.ui.tab = 'cmp'; rerender(); toast(`נטענו ${r.count} שורות כנתוני ייחוס`);
  },
  bdelete: async () => { if (confirm('למחוק את נתוני הייחוס?')) { await api('baseline-clear', { corps: corpsKey() }); toast('נתוני הייחוס נמחקו'); } },
  goCmp: () => { A.ui.tab = 'cmp'; },
  impClear: () => { A.ui.imp = null; rerender(); },
  doImport: async () => {
    const k = corpsKey(), rows = buildRows(k).filter((r) => !r.errs.length);
    const mode = A.ui.impMode || 'add', r = await api('import', { corps: k, rows, mode }); A.ui.imp = null; rerender();
    if (mode === 'update') toast(`עודכנו ${r.updated} מועמדים${r.notFound ? ' · לא נמצאו ' + r.notFound : ''}${r.skipped ? ' · ללא שינוי ' + r.skipped : ''}`); else { A.ui.imported = r.added; toast(`יובאו ${r.added} מועמדים${r.skipped ? ' · דולגו ' + r.skipped : ''}`); }
  },
  exportX: () => downloadX('pool-' + corpsKey() + '.xlsx', poolRows(corpsKey())),
  exportC: () => csvDownload('pool-' + corpsKey() + '.csv', poolRows(corpsKey())),
});

// ================= results + audit log =================
const fmtTs = (ts) => new Date(ts).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
function assignRows(k) {
  const c = cf(k), d = draftInfo(k);
  return d.picks.map((p) => { const x = candOf(k, p.id); return [p.n, orderOf(k)[p.n - 1] ? orderOf(k)[p.n - 1].r : '', p.unit, x.name, x.id, x.role, x.rec || '', x.med].concat(c.stats.map((s) => cellVal(s, x.stats[s.k]))).concat([p.auto ? 'אוטומטי' : 'ידני']); });
}
const assignHead = (k) => ['#', 'סבב', 'יחידה', 'מועמד/ת', 'מס׳', 'תפקיד', 'המלצת מגבש', 'רפואי'].concat(cf(k).stats.map((s) => s.l + ' (' + s.u + ')')).concat(['אופן בחירה']);
function unitRows(k) {
  const c = cf(k); return [['יחידה', 'תפקיד', 'נדרשו', 'שובצו', 'פער']].concat(c.units.flatMap((u) => Object.keys(u.quota).filter((r) => u.quota[r]).map((r) => { const h = countRole(k, u.name, r); return [u.name, r, u.quota[r], h, Math.max(0, u.quota[r] - h)]; })));
}
function unassignedRows(k) {
  const d = draftInfo(k), c = cf(k);
  return [['מועמד/ת', 'מס׳', 'תפקיד', 'המלצת מגבש', 'רפואי'].concat(c.stats.map((s) => s.l))].concat(cs(k).cands.filter((x) => !d.takenBy[x.id]).map((x) => [x.name, x.id, x.role, x.rec || '', x.med].concat(c.stats.map((s) => cellVal(s, x.stats[s.k])))));
}
const logRows = (k) => [['זמן', 'חיל', 'פעולה']].concat((A.S.log || []).filter((l) => !k || l.corps === k).slice().reverse().map((l) => [fmtTs(l.ts), A.cfg.corps[l.corps] ? cf(l.corps).corps : l.corps, l.text]));
function downloadBook(name, sheets) { const wb = XLSX.utils.book_new(); sheets.forEach(([n, aoa]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), n)); wb.Workbook = { Views: [{ RTL: true }] }; XLSX.writeFile(wb, name); }
function downloadCsv(name, aoa) {
  const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const blob = new Blob(['﻿' + aoa.map((r) => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const tbl = (rows) => `<div style="overflow:auto"><table><thead><tr>${rows[0].map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${rows[0].length}" class="mut">אין נתונים</td></tr>`}</tbody></table></div>`;

SCREENS.results = (k) => {
  const c = cf(k), d = draftInfo(k), tab = A.ui.rtab || 'assign';
  const tabs = [['assign', 'שיבוצים'], ['units', 'לפי יחידה'], ['free', 'ללא שיבוץ'], ['log', 'יומן פעילות']];
  const free = cs(k).cands.length - d.picks.length, gap = unitRows(k).slice(1).reduce((a, r) => a + r[4], 0);
  const body = tab === 'assign' ? tbl([assignHead(k)].concat(assignRows(k))) : tab === 'units' ? tbl(unitRows(k)) : tab === 'free' ? tbl(unassignedRows(k)) : tbl(logRows(k));
  return `<div class="row spread"><div>${corpsSwitcher()}<h1 style="font-size:28px;font-weight:800;margin-top:6px">תוצאות ויומן – ${esc(c.label)}</h1><div class="mut small">${d.finished ? 'הדראפט הסתיים' : 'הדראפט בעיצומו – התוצאות חלקיות'}</div></div>
    <div class="row no-print"><button class="btn" data-act="expXlsx">ייצוא Excel</button><button class="btn sec" data-act="expCsv">CSV (${esc(tabs.find((t) => t[0] === tab)[1])})</button><button class="btn sec" data-act="expPrint">הדפסה / PDF</button></div></div>
   <div class="grid g3"><div class="kpi"><span>שובצו</span><b>${d.picks.length} מתוך ${d.order.length}</b></div><div class="kpi"><span>ללא שיבוץ</span><b>${free}</b></div><div class="kpi"><span>פער מכסות</span><b>${gap}</b></div></div>
   <div class="card"><div class="tabs no-print" style="margin-bottom:12px">${tabs.map(([i, n]) => `<button class="${tab === i ? 'on' : ''}" data-act="rtab" data-t="${i}">${n}</button>`).join('')}</div>${body}</div>`;
};
Object.assign(ACTIONS, {
  rtab: (d) => { A.ui.rtab = d.t; rerender(); },
  expXlsx: () => { const k = corpsKey(); downloadBook('mil-draft-' + k + '.xlsx', [['שיבוצים', [assignHead(k)].concat(assignRows(k))], ['לפי יחידה', unitRows(k)], ['ללא שיבוץ', unassignedRows(k)], ['יומן פעילות', logRows(k)]]); toast('הקובץ הורד'); },
  expCsv: () => { const k = corpsKey(), t = A.ui.rtab || 'assign'; downloadCsv('mil-draft-' + k + '-' + t + '.csv', t === 'assign' ? [assignHead(k)].concat(assignRows(k)) : t === 'units' ? unitRows(k) : t === 'free' ? unassignedRows(k) : logRows(k)); toast('הקובץ הורד'); },
  expPrint: () => window.print(),
});

// ================= draft settings (admin) =================
SCREENS.settings = (k) => {
  const c = cf(k), S = stg(k), started = cs(k).picks.some((p) => !p.auto), ui = A.ui.stg && A.ui.stg.k === k ? A.ui.stg : (A.ui.stg = Object.assign({ k }, S)), lock = started ? 'disabled' : '';
  const tog = (f, l, h) => `<label class="row" style="align-items:flex-start;gap:10px"><input type="checkbox" data-chg="stgSet" data-f="${f}" ${ui[f] ? 'checked' : ''}><span><b>${l}</b><div class="mut small">${h}</div></span></label>`;
  return `<div>${corpsSwitcher()}<h1 style="font-size:28px;font-weight:800;margin-top:6px">הגדרות דראפט – ${esc(c.label)}</h1><div class="mut small">הגדרות נפרדות לכל חיל. זמינות למנהל/ת מערכת בלבד.</div></div>
   <div class="card"><h2>מבנה הדראפט</h2>${started ? '<div class="demo-note">יחידה כבר בחרה ידנית – אי אפשר לשנות מספר סבבים וסדר. כדי לשנות, אפסו את הדראפט. (שינוי המבנה לפני בחירה ידנית מחשב את הבחירות האוטומטיות מחדש.)</div>' : ''}
    <div class="row" style="gap:24px;flex-wrap:wrap"><label>מספר סבבים<select data-chg="stgSet" data-f="rounds" ${lock}>${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<option value="${n}" ${+ui.rounds === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label>סדר בחירה<select data-chg="stgSet" data-f="order" ${lock}><option value="snake" ${ui.order === 'snake' ? 'selected' : ''}>מתחלף (נחש) – הסדר מתהפך בכל סבב</option><option value="linear" ${ui.order === 'linear' ? 'selected' : ''}>רגיל – אותו סדר בכל סבב</option></select></label></div>
    <div class="mut small">סך הכול ${ui.rounds * c.units.length} בחירות (${ui.rounds} סבבים × ${c.units.length} יחידות)</div></div>
   <div class="card"><h2>כללי שיבוץ</h2><div class="mut small" style="margin-bottom:8px">חל על בחירות ידניות של שלישות בלבד. בחירה אוטומטית של יחידות הבוט ממשיכה לפעול לפי שיקול רך.</div>
    <div class="col" style="display:flex;flex-direction:column;gap:12px">${tog('strictThresholds', 'לחסום מועמד שלא עומד בתנאי הסף', 'בחירה ידנית תידחה אם חסר נתון או שערך מתחת לסף של היחידה')}${tog('strictQuotas', 'לחסום מעבר למכסת התפקיד', 'אי אפשר לבחור תפקיד שהמכסה שלו מולאה או שלא התבקש')}${tog('blockNotRecommended', 'לחסום מועמד שהמגבש לא המליץ עליו', 'המלצה "לא מומלץ" חוסמת בחירה ידנית')}</div>
    <div class="row" style="margin-top:14px"><button class="btn" data-act="stgSave">שמירת הגדרות</button></div></div>
   <div class="card"><h2>יחידות ומכסות</h2><div class="mut small" style="margin-bottom:8px">עריכת מכסות ותנאי סף של כל יחידה בשם השלישות.</div>
    <div style="overflow:auto"><table><thead><tr><th>יחידה</th><th>מכסות</th><th></th></tr></thead><tbody>${c.units.map((u0) => { const u = unitOf(k, u0.name); return `<tr><td><b>${esc(u.name)}</b></td><td>${Object.keys(u.quota).filter((r) => u.quota[r]).map((r) => `<span class="pill p-gray">${esc(r)} ${u.quota[r]}</span>`).join(' ') || '<span class="mut">—</span>'}</td><td><button class="btn sec sm" data-act="editTh" data-u="${esc(u.name)}">עריכה</button></td></tr>`; }).join('')}</tbody></table></div></div>${A.ui.editTh ? thModal(k) : ''}`;
};
Object.assign(ACTIONS, {
  stgSet: (d, t) => { const u = A.ui.stg || (A.ui.stg = { k: corpsKey() }); u[d.f] = t.type === 'checkbox' ? t.checked : (d.f === 'rounds' ? +t.value : t.value); rerender(); },
  stgSave: async () => { const k = corpsKey(), u = A.ui.stg; if (!u) return; const b = { corps: k, order: u.order, strictThresholds: !!u.strictThresholds, strictQuotas: !!u.strictQuotas, blockNotRecommended: !!u.blockNotRecommended }; if (!cs(k).picks.some((p) => !p.auto)) b.rounds = +u.rounds; try { await api('settings', b); A.ui.stg = null; toast('ההגדרות נשמרו'); rerender(); } catch (x) { /* toast shown */ } },
});
