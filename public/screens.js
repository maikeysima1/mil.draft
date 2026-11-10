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
  const rowOf = (x) => { const e = x.extra || {}, w = x.wish || { units: [] }; return [x.id, x.name, x.role].concat(x.lv.map((v) => (v == null ? '' : WORDS[v])), c.stats.map((s) => cellVal(s, x.stats[s.k])), [x.rec || '', x.med, e.motivation || '', WORDS[e.discipline] || '', LOWHIGH[e.potential] || '', LOWHIGH[e.confidence] || '', e.second || '', e.follow ? 'כן' : '', e.medNote || '', w.role || '', w.units[0] || '', w.units[1] || '', w.units[2] || '', (w.combat == null ? '' : COMBAT[w.combat]), x.obs || '', x.summary || '']); };
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
   <div class="card"><h2>מועמדי הצוות</h2><div style="display:flex;flex-direction:column;gap:6px">${group.map((x) => `<button class="list-item ${x.id === (cur && cur.id) ? 'on' : ''}" data-act="evalPick" data-id="${x.id}"><span class="row" style="gap:8px;flex-wrap:nowrap">${avatar(x, 32)}<span><b>${esc(x.name)}</b> <bdi class="mut small">${x.id}</bdi></span></span><span class="row" style="gap:4px">${x.extra && x.extra.follow ? '<span class="pill p-orange">מעקב</span>' : ''}<span class="pill ${evalStatus(k, x) === 'הוזן' ? 'p-green' : 'p-orange'}">${evalStatus(k, x)}</span></span></button>`).join('') || '<span class="mut">אין מועמדים בצוות</span>'}</div></div>
   ${cur ? `<div style="display:flex;flex-direction:column;gap:14px"><div class="card"><div class="row spread"><div class="row" style="gap:12px;flex-wrap:nowrap">${avatar(cur, 56)}<div><div class="mut small">הזנת התרשמות עבור</div><h2 style="margin:0;font-size:22px">${esc(cur.name)} <span class="mut small">${cur.id}</span></h2></div></div><div class="row">${cur.evalBy ? `<span class="pill p-green">הוזן לתיק · ${esc(cur.evalBy)}</span>` : ''}${can('regroup', k) ? `<label class="small mut row" style="gap:6px">העברה לצוות <select data-chg="regroup" data-id="${cur.id}">${[1, 2, 3, 4].map((n) => `<option ${n === cur.group ? 'selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}</div></div>
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

function importFields(k) { return [['id', 'מס׳ (לזיהוי בעדכון)'], ['name', 'שם'], ['role', 'תפקיד'], ['rec', 'המלצת מגבש'], ['med', 'מגבלות רפואיות'], ['profile', 'פרופיל'], ['motivation', 'מוטיבציה (1–5)'], ['combat', 'נכונות לתפקיד קרבי']].concat(cf(k).stats.map((s) => ['s:' + s.k, s.l + ' (' + s.u + ')'])); }
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
SCREENS.import = (k) => {
  const c = cf(k), im = A.ui.imp, canImp = can('import', k);
  const rows = im ? buildRows(k) : [], ok = rows.filter((r) => !r.errs.length);
  const miss = cs(k).cands.filter((x) => missingOf(k, x).length).length;
  return `<div class="row spread"><div>${corpsSwitcher()}<h1 style="font-size:28px;font-weight:800;margin-top:6px">הזנה וייבוא</h1><div class="mut small">קליטת מועמדים, עדכון נתונים קיימים ונתוני ייחוס – מקובץ אקסל או CSV, לפי חיל</div></div></div>
   <div class="grid g3"><div class="kpi"><b>${cs(k).cands.length}</b><span>מועמדים במאגר</span></div><div class="kpi"><b>${A.ui.imported || 0}</b><span>יובאו בטעינה זו</span></div><div class="kpi"><b>${miss}</b><span>תיקים עם נתונים חסרים</span></div></div>
   <div class="card"><h2>1. בחירת קובץ</h2><div class="seg" style="margin-bottom:10px">${[['add', 'הוספת מועמדים חדשים'], ['update', 'עדכון מועמדים קיימים']].map((m) => `<button type="button" class="${(A.ui.impMode || 'add') === m[0] ? 'on' : ''}" data-act="impmode" data-m="${m[0]}">${m[1]}</button>`).join('')}</div>
    ${(A.ui.impMode || 'add') === 'update' ? '<p class="mut small">העמודות: מס׳ <b>או</b> שם (לזיהוי המועמד במאגר) ועוד כל שדה שרוצים לעדכן. שדות ריקים לא ידרסו נתונים קיימים.</p>' : ''}<p class="mut small" ${(A.ui.impMode || 'add') === 'update' ? 'hidden' : ''}>עמודות נדרשות: שם, תפקיד, המלצת מגבש, מגבלות רפואיות, פרופיל, ${c.stats.map((s) => esc(s.l + ' (' + s.u + ')')).join(', ')}. שורה אחת לכל מועמד/ת.</p>
    ${!canImp ? '<div class="demo-note">ייבוא זמין לשלישות החיל בלבד.</div>' : ''}
    <div class="drop"><input type="file" id="file" accept=".xlsx,.xls,.csv" data-chg="file" ${canImp ? '' : 'disabled'}><div class="row" style="justify-content:center;margin-top:10px"><button class="btn sec sm" data-act="sample" ${canImp ? '' : 'disabled'}>טעינת קובץ לדוגמה</button><button class="btn sec sm" data-act="template">הורדת תבנית אקסל</button></div><div class="mut small" style="margin-top:6px">הקובץ נקרא בדפדפן ונשלח לשרת רק בלחיצה על ״ייבוא״. אין להעלות נתוני אמת באב־טיפוס.</div></div></div>
   ${im ? `<div class="card"><h2>2. התאמת עמודות</h2><div class="row">${importFields(k).map(([key, label]) => `<label class="small mut">${esc(label)}<br><select data-chg="map" data-f="${esc(key)}" style="min-width:150px"><option value="-1">— לא ממופה —</option>${im.headers.map((h, i) => `<option value="${i}" ${im.map[key] === i ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select></label>`).join('')}</div></div>
   <div class="card"><h2>3. בדיקה וייבוא</h2><p>${rows.length} שורות · <b style="color:var(--green)">${ok.length} תקינות</b> · <b style="color:var(--red)">${rows.length - ok.length} עם בעיות (ידולגו)</b></p>
    <div style="overflow:auto;max-height:320px"><table><thead><tr><th>שורה</th><th>שם</th><th>תפקיד</th><th>המלצה</th><th>מדדים חסרים</th><th>בדיקה</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.n}</td><td>${esc(r.name || r.id)}</td><td>${esc(r.role)}</td><td>${esc(r.rec || '—')}</td><td>${c.stats.filter((s) => r.stats[s.k] === '' || r.stats[s.k] == null).map((s) => esc(s.l)).join(', ') || '—'}</td><td>${r.errs.length ? `<span class="pill p-red">${esc(r.errs.join(', '))}</span>` : '<span class="pill p-green">תקין</span>'}</td></tr>`).join('')}</tbody></table></div>
    <div class="row" style="margin-top:10px"><button class="btn" data-act="doImport" ${canImp && ok.length ? '' : 'disabled'}>${(A.ui.impMode || 'add') === 'update' ? 'עדכון' : 'ייבוא'} ${ok.length} מועמדים</button><button class="btn sec" data-act="impClear">ביטול</button></div></div>` : ''}
   ${photosCard(k, canImp, rows)}
   <div class="card"><div class="row spread"><h2 style="margin:0">המאגר הנוכחי – ${esc(c.corps)}</h2><div class="row"><button class="btn sec sm" data-act="exportX">ייצוא לאקסל</button><button class="btn sec sm" data-act="exportC">ייצוא CSV</button></div></div>
    <div style="overflow:auto;max-height:420px;margin-top:8px"><table><thead><tr><th>מס׳</th><th>שם</th><th>תפקיד</th><th>המלצה</th><th>חסר בתיק</th><th>מקור</th></tr></thead><tbody>${cs(k).cands.map((x) => `<tr><td>${x.id}</td><td>${candLink(corpsKey(), x.id, x.name)}</td><td>${esc(x.role)}</td><td>${recPill(x.rec)}</td><td>${esc(missingOf(k, x).join(', ') || 'מלא')}</td><td>${esc(x.source || 'מאגר קיים')}</td></tr>`).join('')}</tbody></table></div>
    <div class="mut small" style="margin-top:8px">הנתונים נשמרים בשרת (data/state.json).</div></div>`;
};
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
  impClear: () => { A.ui.imp = null; rerender(); },
  doImport: async () => {
    const k = corpsKey(), rows = buildRows(k).filter((r) => !r.errs.length).map((r) => Object.assign(r, { photo: photoFor(k, r) }));
    const mode = A.ui.impMode || 'add', r = await api('import', { corps: k, rows, mode }); A.ui.imp = null; A.ui.photos = null; rerender();
    if (mode === 'update') toast(`עודכנו ${r.updated} מועמדים${r.notFound ? ' · לא נמצאו ' + r.notFound : ''}${r.skipped ? ' · ללא שינוי ' + r.skipped : ''}`); else { A.ui.imported = r.added; toast(`יובאו ${r.added} מועמדים${r.skipped ? ' · דולגו ' + r.skipped : ''}`); }
  },
  exportX: () => { auditEvent('export', 'pool xlsx'); downloadX('pool-' + corpsKey() + '.xlsx', poolRows(corpsKey())); },
  exportC: () => { auditEvent('export', 'pool csv'); csvDownload('pool-' + corpsKey() + '.csv', poolRows(corpsKey())); },
});

// ================= results + audit log =================
const fmtTs = (ts) => new Date(ts).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const logRows = (k) => [['זמן', 'חיל', 'פעולה']].concat((A.S.log || []).filter((l) => !k || l.corps === k).slice().reverse().map((l) => [fmtTs(l.ts), A.cfg.corps[l.corps] ? cf(l.corps).corps : l.corps, l.text]));
function downloadBook(name, sheets) { const wb = XLSX.utils.book_new(); sheets.forEach(([n, aoa]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), n)); wb.Workbook = { Views: [{ RTL: true }] }; XLSX.writeFile(wb, name); }
function downloadCsv(name, aoa) {
  const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const blob = new Blob(['﻿' + aoa.map((r) => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const tbl = (rows, nameCol, idCol, k) => `<div style="overflow:auto"><table><thead><tr>${rows[0].map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map((r) => `<tr>${r.map((v, i) => `<td>${i === nameCol ? candLink(k, r[idCol], v) : esc(v)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${rows[0].length}" class="mut">אין נתונים</td></tr>`}</tbody></table></div>`;

// ================= candidate photos (uploaded together with the data) =================
const normKey = (v) => String(v == null ? '' : v).replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
// photo for an import row / candidate: file name (without extension) equals the candidate's id or full name
function photoFor(k, r) {
  const ph = A.ui.photos; if (!ph || !ph.length) return undefined;
  const keys = [r.id, r.name].map(normKey).filter(Boolean), hit = ph.find((p) => keys.includes(p.key));
  return hit ? hit.url : undefined;
}
function resizeImage(file, px) {
  return new Promise((ok, no) => {
    const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = px; const g = c.getContext('2d'), m = Math.min(img.width, img.height); g.fillStyle = '#fff'; g.fillRect(0, 0, px, px); g.drawImage(img, (img.width - m) / 2, (img.height - m) / 3, m, m, 0, 0, px, px); URL.revokeObjectURL(u); ok(c.toDataURL('image/jpeg', 0.72)); };
    img.onerror = () => { URL.revokeObjectURL(u); no(new Error('bad image')); }; img.src = u;
  });
}
function photosCard(k, canImp, rows) {
  const ph = A.ui.photos || [], pool = cs(k).cands, rowKeys = new Set((rows || []).flatMap((r) => [normKey(r.id), normKey(r.name)]).filter(Boolean));
  const inPool = (p) => pool.find((c) => normKey(c.id) === p.key || normKey(c.name) === p.key), inFile = (p) => rowKeys.has(p.key);
  const matched = ph.filter((p) => inPool(p) || inFile(p)), lost = ph.length - matched.length;
  return `<div class="card"><h2>תמונות מועמדים <span class="mut small">(אופציונלי)</span></h2>
   <p class="mut small">מעלים יחד עם הנתונים. שם כל קובץ תמונה הוא <b>מספר המועמד</b> (למשל <bdi>C-2101.jpg</bdi>) או <b>שמו המלא</b> (למשל <bdi>איתמר ל..jpg</bdi>). התמונות מוקטנות אוטומטית. כשהן נטענות לצד קובץ הנתונים, הן נשמרות יחד איתו בלחיצה על "ייבוא" / "עדכון". אפשר גם להעלות תמונות בלבד.</p>
   <div class="drop"><input type="file" id="photos" accept="image/*" multiple data-chg="photoFiles" ${canImp ? '' : 'disabled'}></div>
   ${ph.length ? `<div class="row" style="gap:8px;flex-wrap:wrap;margin:12px 0">${ph.map((p) => `<span class="row" style="gap:6px;border:1px solid var(--line);border-radius:12px;padding:4px 8px 4px 10px"><img src="${p.url}" width="36" height="36" style="border-radius:50%;object-fit:cover" alt=""><span class="small">${esc(p.file)}</span><span class="pill ${inPool(p) || inFile(p) ? 'p-green' : 'p-orange'}">${inPool(p) ? esc(inPool(p).name) : inFile(p) ? 'שורה בקובץ' : 'לא נמצא מועמד'}</span></span>`).join('')}</div>
   <div class="mut small">${matched.length} תמונות מותאמות${lost ? ` · <b style="color:var(--orange)">${lost} ללא התאמה (ידולגו)</b>` : ''}</div>
   <div class="row" style="margin-top:10px"><button class="btn" data-act="photosOnly" ${canImp && ph.some(inPool) ? '' : 'disabled'}>העלאת תמונות בלבד (${ph.filter(inPool).length})</button><button class="btn sec" data-act="photosClear">נקה</button></div>` : ''}</div>`;
}
Object.assign(ACTIONS, {
  photoFiles: async (d, t) => {
    const out = A.ui.photos || [];
    for (const f of Array.from(t.files)) { try { const url = await resizeImage(f, 128), key = normKey(f.name); const i = out.findIndex((p) => p.key === key); const rec = { file: f.name, key, url }; if (i >= 0) out[i] = rec; else out.push(rec); } catch (e) { toast('הקובץ ' + f.name + ' אינו תמונה תקינה', true); } }
    A.ui.photos = out; rerender();
  },
  photosClear: () => { A.ui.photos = null; rerender(); },
  photosOnly: async () => {
    const k = corpsKey(), rows = [];
    (A.ui.photos || []).forEach((p) => { const c = cs(k).cands.find((x) => normKey(x.id) === p.key || normKey(x.name) === p.key); if (c) rows.push({ id: c.id, photo: p.url }); });
    if (!rows.length) return;
    const r = await api('import', { corps: k, rows, mode: 'update' }); A.ui.photos = null; rerender(); toast(`עודכנו ${r.updated} תמונות`);
  },
});

// ================= users, passwords and security log (admin, AUTH=1) =================
const fmtTs2 = (ts) => new Date(ts).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const EV = { login: 'כניסה', logout: 'יציאה', 'change-password': 'שינוי סיסמה', 'admin-reset-password': 'איפוס סיסמה ע״י מנהל', 'view-candidate': 'צפייה בתיק מועמד', export: 'ייצוא נתונים' };
function secCards() {
  const a = A.ui.adm; if (!a) return '<div class="card"><h2>משתמשים וסיסמאות</h2><span class="mut">טוען…</span></div>';
  const q = (A.ui.uq || '').trim().toLowerCase(), us = a.users.filter((u) => !q || (u.title + ' ' + u.id + ' ' + u.role + ' ' + u.unit).toLowerCase().includes(q));
  const st = (u) => u.locked ? '<span class="pill p-red">נעול</span>' : !u.hasPassword ? '<span class="pill p-gray">אין סיסמה</span>' : u.mustChange ? '<span class="pill p-orange">סיסמה זמנית</span>' : '<span class="pill p-green">פעיל</span>';
  return `<div class="card"><div class="row spread"><h2 style="margin:0">משתמשים וסיסמאות</h2><input type="search" data-inp="uq" placeholder="חיפוש משתמש" value="${esc(A.ui.uq || '')}" style="min-width:200px"></div>
   <div class="mut small" style="margin:8px 0">הנפקת סיסמה זמנית מוצגת פעם אחת בלבד. המשתמש/ת חייב/ת להחליף אותה בכניסה הראשונה. הסיסמאות נשמרות מוצפנות (scrypt) ואי אפשר לשחזר אותן.</div>
   <div style="overflow:auto;max-height:380px"><table><thead><tr><th>משתמש</th><th>תפקיד</th><th>יחידה</th><th>מצב</th><th></th></tr></thead><tbody>${us.slice(0, 80).map((u) => `<tr><td><b>${esc(u.title)}</b> <bdi class="mut small">${esc(u.id)}</bdi></td><td>${esc(u.role)}</td><td>${esc(u.unit)}</td><td>${st(u)}</td><td><button class="btn sec sm" data-act="admReset" data-id="${esc(u.id)}">${u.hasPassword ? 'איפוס סיסמה' : 'הנפקת סיסמה'}</button></td></tr>`).join('') || '<tr><td colspan="5" class="mut">לא נמצאו משתמשים</td></tr>'}</tbody></table></div>${us.length > 80 ? '<div class="mut small">מוצגים 80 הראשונים – צמצמו בחיפוש</div>' : ''}</div>
   <div class="card"><div class="row spread"><h2 style="margin:0">יומן אבטחה</h2><button class="btn sec sm" data-act="admLoad">רענון</button></div><div style="overflow:auto;max-height:320px;margin-top:8px"><table><thead><tr><th>זמן</th><th>אירוע</th><th>משתמש</th><th>כתובת</th><th>תוצאה</th><th>פירוט</th></tr></thead><tbody>${a.audit.map((e) => `<tr><td>${fmtTs2(e.ts)}</td><td>${esc(EV[e.ev] || e.ev)}</td><td><bdi>${esc(e.user || '—')}</bdi></td><td><bdi>${esc(e.ip)}</bdi></td><td><span class="pill ${e.ok ? 'p-green' : 'p-red'}">${e.ok ? 'הצלחה' : 'נכשל'}</span></td><td class="mut small">${esc(e.detail || '')}</td></tr>`).join('') || '<tr><td colspan="6" class="mut">אין אירועים</td></tr>'}</tbody></table></div></div>`;
}
function tempPwModal() {
  const t = A.ui.tempPw;
  return `<div class="drawer-bg" style="align-items:center" data-act="tempClose"><div class="modal"><h2 style="margin:0">סיסמה זמנית – ${esc(t.title)}</h2><p class="mut small" style="margin:0">מוצגת פעם אחת. מסרו אותה למשתמש/ת בערוץ מאובטח. בכניסה הראשונה תידרש החלפה.</p><div style="font:700 24px monospace;direction:ltr;text-align:center;padding:14px;background:var(--bg2);border-radius:12px;user-select:all">${esc(t.pw)}</div><div class="row"><button class="btn" data-act="tempClose">סגירה</button></div></div></div>`;
}
Object.assign(ACTIONS, {
  uq: (d, t) => { A.ui.uq = t.value; rerender(); },
  admLoad: async () => {
    try { const [u, a] = await Promise.all([fetch('/api/admin/users', { headers: HDR() }), fetch('/api/admin/audit', { headers: HDR() })]); if (!u.ok || !a.ok) return; A.ui.adm = { users: (await u.json()).users, audit: (await a.json()).events }; rerender(); } catch (e) { /* offline */ }
  },
  admReset: async (d) => { const u = A.ui.adm.users.find((x) => x.id === d.id); if (!confirm('להנפיק סיסמה זמנית חדשה ל' + u.title + '? הסיסמה הקיימת (אם יש) תבוטל והמשתמש/ת ינותק/תנותק.')) return; try { const r = await api('admin/reset-password', { id: d.id }); A.ui.tempPw = { title: u.title, pw: r.password }; await ACTIONS.admLoad(); rerender(); } catch (x) { /* toast shown */ } },
  tempClose: () => { A.ui.tempPw = null; rerender(); },
});

