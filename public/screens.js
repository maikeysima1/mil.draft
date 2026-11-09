// Evaluator sheet, command overview, import
// ---------------- evaluator ----------------
function evalGroup(k) { return A.me.role === 'מגבש/ת' ? A.me.group : (A.ui.group || 1); }
function evalDraftKey(k, id) { return 'mil-eval-' + k + '-' + id; }
function evalForm(k, c) { // working copy kept in A.ui.form until sent
  if (!A.ui.form || A.ui.form.id !== c.id || A.ui.form.k !== k) {
    let draft = null; try { draft = JSON.parse(localStorage.getItem(evalDraftKey(k, c.id))); } catch (e) { /* none */ }
    A.ui.form = draft && draft.id === c.id ? draft : { id: c.id, k, lv: c.lv.slice(), role: c.role, skills: (c.skills || []).slice(), stats: Object.assign({}, c.stats), rec: c.rec || '', med: c.med, obs: c.obs || '', summary: c.summary || '' };
    A.ui.form.extra = Object.assign({ motivation: 3, discipline: 1, potential: 0, confidence: 1, second: '', follow: false, medNote: '' }, c.extra, A.ui.form.extra);
    if (!A.ui.form.wish) A.ui.form.wish = { role: (c.wish && c.wish.role) || '', units: [0, 1, 2].map((i) => (c.wish && c.wish.units[i]) || '') };
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
     <div class="small"><b>העדפת החייל:</b> תפקיד ${esc(f.wish.role || '—')} · יחידות ${esc(f.wish.units.filter(Boolean).join(' › ') || '—')}</div>
     <div class="small"><b>כישורים:</b> ${esc(f.skills.join(' · ') || '—')}</div>
     <div class="small"><b>ערכים נוספים:</b> מוטיבציה ${f.extra.motivation}/5 · משמעת ${WORDS[f.extra.discipline]} · פוטנציאל פיקודי ${LOWHIGH[f.extra.potential]} · ביטחון בהערכה ${LOWHIGH[f.extra.confidence]}${f.extra.second ? ' · תפקיד חלופי ' + esc(f.extra.second) : ''}${f.extra.follow ? ' · <b>דורש מעקב</b>' : ''}</div><p class="small" style="margin:4px 0">${esc(f.obs) || '—'}</p>
     <div class="small mut">סיכום המגבש: ${esc(f.summary) || `מתאים/ה לתפקיד ${esc(f.role)}. חוזקות בולטות: ${esc(str.join(', ') || '—')}. המלצה: ${esc(f.rec || '—')}.`}</div></div>`;
  })();
  return `<div class="row spread"><div><span class="chip navy">${esc(c.eventName)} · ${esc(c.corps)}</span><h1 style="font-size:28px;font-weight:800;margin-top:6px">דף מגבש – צוות ${g}</h1>${!ro ? `<div class="mut small">אתם אחראים על צוות ${g} בלבד</div>` : ''}</div>
    ${ro ? `<div class="row">${corpsSwitcher()}</div>` : ''}</div>
   ${ro ? '<div class="demo-note">צפייה בלבד – רק מגבש/ת מזינ/ה התרשמות. אפשר להעביר מועמד בין צוותים.</div>' : ''}
   ${teamStrip(k, g)}
   <div class="grid g3"><div class="kpi"><span>מועמדים בצוות</span><b>${group.length}</b></div><div class="kpi"><span>הוזנו לתיק</span><b>${done}</b></div><div class="kpi"><span>התקדמות הצוות</span><div class="bar" style="margin-top:12px"><i style="width:${group.length ? done / group.length * 100 : 0}%"></i></div></div></div>
   <div style="display:grid;grid-template-columns:minmax(240px,300px) 1fr;gap:16px;align-items:start" class="evgrid">
   <div class="card"><h2>מועמדי הצוות</h2><div style="display:flex;flex-direction:column;gap:6px">${group.map((x) => `<button class="list-item ${x.id === (cur && cur.id) ? 'on' : ''}" data-act="evalPick" data-id="${x.id}"><span><b>${esc(x.name)}</b> <span class="mut small">${x.id}</span></span><span class="row" style="gap:4px">${x.extra && x.extra.follow ? '<span class="pill p-orange">מעקב</span>' : ''}<span class="pill ${evalStatus(k, x) === 'הוזן' ? 'p-green' : 'p-orange'}">${evalStatus(k, x)}</span></span></button>`).join('') || '<span class="mut">אין מועמדים בצוות</span>'}</div></div>
   ${cur ? `<div style="display:flex;flex-direction:column;gap:14px"><div class="card"><div class="row spread"><div><div class="mut small">הזנת התרשמות עבור</div><h2 style="margin:0;font-size:22px">${esc(cur.name)} <span class="mut small">${cur.id}</span></h2></div><div class="row">${cur.evalBy ? `<span class="pill p-green">הוזן לתיק · ${esc(cur.evalBy)}</span>` : ''}${can('regroup', k) ? `<label class="small mut row" style="gap:6px">העברה לצוות <select data-chg="regroup" data-id="${cur.id}">${[1, 2, 3, 4].map((n) => `<option ${n === cur.group ? 'selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}</div></div>
    <fieldset ${ro ? 'disabled' : ''} style="border:0;padding:0;margin:12px 0 0;display:flex;flex-direction:column;gap:14px">
    <div><h3 style="font-size:16px">התרשמות מקצועית</h3><div class="mut small">סמנו לכל תכונה את הרמה שנצפתה במהלך ${esc(c.eventName)}</div>
     ${c.traits.map((t, i) => `<div class="row spread" style="padding:5px 0"><span>${esc(t)}</span><div class="seg">${WORDS.map((w, j) => `<button type="button" class="${f.lv[i] === j ? 'on l' + j : ''}" data-act="lv" data-i="${i}" data-v="${j}">${w}</button>`).join('')}</div></div>`).join('')}</div>
    <label>תפקיד מומלץ<br><select data-chg="fld" data-f="role">${c.roles.map((r) => `<option ${r === f.role ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
    <div><b>כישורים שנצפו</b><div class="row" style="margin-top:4px">${allSkills.map((s) => `<button type="button" class="sw ${f.skills.includes(s) ? 'on' : ''}" data-act="skill" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>
    <div><h3 style="font-size:16px">מדדים שנמדדו</h3><div class="mut small">ערכים אמיתיים מהמבחנים. מדד ריק יסומן בתיק כחסר.</div><div class="row" style="margin-top:6px">${c.stats.map((s) => `<label class="small mut">${esc(s.l)} (${esc(s.u)})<br><input type="number" step="any" style="width:130px" id="st-${s.k}" data-inp="stat" data-f="${s.k}" value="${f.stats[s.k] == null ? '' : f.stats[s.k]}"></label>`).join('')}</div></div>
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
     <div class="row" style="margin-top:6px;align-items:flex-end"><label class="small mut">תפקיד מבוקש<br><select data-chg="wishrole"><option value="">— לא צוין —</option>${c.roles.map((r) => `<option ${r === f.wish.role ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
      ${[0, 1, 2].map((i) => `<label class="small mut">יחידה – בחירה ${i + 1}<br><select data-chg="wishunit" data-i="${i}"><option value="">— אין —</option>${c.units.map((u) => `<option ${u.name === f.wish.units[i] ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label>`).join('')}</div></div>
    <label><b>תצפיות והתרשמות כללית</b><textarea id="f-obs" data-inp="fld" data-f="obs">${esc(f.obs)}</textarea></label>
    <label><b>סיכום המגבש</b> <span class="mut small">– יוצג בתיק המועמד בחדר הבחירה</span><textarea id="f-sum" data-inp="fld" data-f="summary" style="min-height:60px">${esc(f.summary)}</textarea></label>
    ${ro ? '' : `<div class="row"><button class="btn sec" type="button" data-act="evalDraft">שמירה כטיוטה ומעבר לבא</button><button class="btn" type="button" data-act="evalSend">שליחה לתיק המועמד</button></div>`}
    </fieldset></div>${prev}</div>` : ''}</div>
   <style>@media(max-width:900px){.evgrid{grid-template-columns:1fr!important}}</style>`;
};
Object.assign(ACTIONS, {
  team: (d) => { A.ui.group = +d.g; A.ui.evalCand = null; A.ui.form = null; rerender(); },
  wishrole: (d, t) => { A.ui.form.wish.role = t.value; rerender(); },
  wishunit: (d, t) => { const u = A.ui.form.wish.units; u.forEach((x, j) => { if (t.value && x === t.value) u[j] = ''; }); u[+d.i] = t.value; rerender(); },
  ex: (d) => { A.ui.form.extra[d.f] = +d.v; rerender(); },
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
  stat: (d, t) => { A.ui.form.stats[d.f] = t.value === '' ? null : Number(t.value); },
  evalDraft: () => {
    const k = corpsKey(), f = A.ui.form; localStorage.setItem(evalDraftKey(k, f.id), JSON.stringify(f));
    const g = cs(k).cands.filter((x) => x.group === evalGroup(k)), i = g.findIndex((x) => x.id === f.id);
    A.ui.evalCand = g[(i + 1) % g.length].id; A.ui.form = null; toast('נשמר כטיוטה'); rerender();
  },
  evalSend: async () => {
    const k = corpsKey(), f = A.ui.form;
    if (!f.rec) { toast('בחרו המלצת מגבש לפני השליחה', true); return; }
    await api('eval', { corps: k, id: f.id, lv: f.lv, role: f.role, skills: f.skills, stats: f.stats, rec: f.rec, med: f.med, obs: f.obs, summary: f.summary, extra: f.extra, wish: { role: f.wish.role, units: f.wish.units.filter(Boolean) } });
    localStorage.removeItem(evalDraftKey(k, f.id)); A.ui.form = null; toast('ההתרשמות נשמרה בתיק המועמד. אפשר לעדכן ולשלוח שוב.'); rerender();
  },
});

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
  const tabs = [['units', 'יחידות'], ['pres', 'מצגת לפיקוד'], ['forum', 'דילמות'], ['report', 'דוח']];
  const matrix = `<div style="overflow:auto"><table><thead><tr><th>יחידה</th><th>קדימות</th>${c.roles.map((r) => `<th>${esc(r)}</th>`).join('')}<th>התקדמות</th></tr></thead><tbody>${c.units.map((u) => { const p = unitProgress(k, u); return `<tr><td><b>${esc(u.name)}</b><div class="mut small">${esc(u.desc)}</div></td><td>${['גבוהה', 'רגילה', 'נמוכה'][u.prio]}</td>${c.roles.map((r) => { const q = u.quota[r]; if (!q) return '<td class="mut">·</td>'; const h = countRole(k, u.name, r); return `<td><span class="pill ${h >= q ? 'p-green' : h > 0 ? 'p-orange' : 'p-gray'}">${h}/${q}</span></td>`; }).join('')}<td style="min-width:140px"><div class="row"><div class="bar"><i style="width:${p.q ? p.g / p.q * 100 : 0}%"></i></div><b>${p.g}/${p.q}</b></div></td></tr>`; }).join('')}</tbody></table></div>`;
  const corpsProg = Object.keys(A.cfg.corps).filter((x) => !A.me.corps || x === A.me.corps).map((x) => { const t = draftInfo(x); return `<div class="row" style="margin:8px 0"><span style="min-width:130px">${esc(cf(x).corps)}</span><div class="bar"><i style="width:${t.picks.length / t.order.length * 100}%;background:var(--blue)"></i></div><b>${t.picks.length}/${t.order.length}</b></div>`; }).join('');
  let body = '';
  if (tab === 'units') body = `<div class="card"><h2>מכסות לפי יחידה ותפקיד</h2><div class="mut small" style="margin-bottom:8px">שובצו / נדרשו · ירוק: הושלם · כתום: חלקי · אפור: טרם שובץ</div>${matrix}</div>
    <div class="grid g2"><div class="card"><h2>התקדמות לפי חיל</h2>${corpsProg}<div class="mut small">לכל חיל דראפט נפרד: יחידות לוחמה לא מתחרות על אותם מועמדים עם מודיעין או קשר.</div></div>
    <div class="card"><h2>בחירות אחרונות</h2>${d.picks.slice(-7).reverse().map((p) => `<div class="row" style="padding:4px 0"><b>#${p.n}</b><span>${esc(p.unit)} · ${esc(candOf(k, p.id).name)} ${esc(candOf(k, p.id).role)}</span></div>`).join('') || '<span class="mut">אין בחירות</span>'}</div></div>`;
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
  factory: async () => { if (confirm('לאפס את כל הנתונים בכל החילות?')) { await api('factory-reset', {}); toast('המערכת אופסה'); } },
  print: () => window.print(),
  demoState: async (d, t) => { if (!t.value) return; await api('advance', { corps: corpsKey(), rounds: +t.value }); t.value = ''; toast('מצב הדראפט עודכן'); },
  exportPicks: () => { const k = corpsKey(), d = draftInfo(k); csvDownload('draft-' + k + '.csv', [['#', 'יחידה', 'מועמד', 'מס׳', 'תפקיד', 'המלצה']].concat(d.picks.map((p) => [p.n, p.unit, candOf(k, p.id).name, p.id, candOf(k, p.id).role, candOf(k, p.id).rec || '']))); },
});

// ---------------- import ----------------
const SYN = { name: ['שם', 'שם מלא', 'name'], role: ['תפקיד', 'role'], rec: ['המלצת מגבש', 'המלצה'], med: ['מגבלות רפואיות', 'מגבלות', 'רפואי'], profile: ['פרופיל'] };
function importFields(k) { return [['name', 'שם'], ['role', 'תפקיד'], ['rec', 'המלצת מגבש'], ['med', 'מגבלות רפואיות'], ['profile', 'פרופיל']].concat(cf(k).stats.map((s) => ['s:' + s.k, s.l + ' (' + s.u + ')'])); }
function autoMap(k, headers) {
  const m = {};
  importFields(k).forEach(([key, label]) => {
    const want = key.startsWith('s:') ? [cf(k).stats.find((s) => 's:' + s.k === key).l, label] : SYN[key];
    const i = headers.findIndex((h) => want.some((w) => String(h).trim().startsWith(w)));
    m[key] = i;
  });
  return m;
}
function buildRows(k) {
  const im = A.ui.imp; if (!im) return [];
  return im.data.map((r, n) => {
    const g = (key) => (im.map[key] >= 0 ? r[im.map[key]] : '');
    const stats = {}; cf(k).stats.forEach((s) => { stats['' + s.k] = g('s:' + s.k); });
    const row = { name: String(g('name') || '').trim(), role: String(g('role') || '').trim(), rec: String(g('rec') || '').trim(), med: String(g('med') || '').trim() || 'ללא מגבלות', profile: g('profile'), stats };
    const errs = [];
    if (!row.name) errs.push('חסר שם');
    if (!cf(k).roles.includes(row.role)) errs.push('תפקיד לא מוכר');
    if (row.rec && !A.cfg.RECS.includes(row.rec)) errs.push('המלצה לא מוכרת');
    if (!A.cfg.MEDS.includes(row.med)) errs.push('מגבלה לא מוכרת');
    if (cs(k).cands.some((c) => c.name === row.name)) errs.push('כבר קיים במאגר');
    return Object.assign(row, { n: n + 2, errs });
  });
}
SCREENS.import = (k) => {
  const c = cf(k), im = A.ui.imp, canImp = can('import', k), started = cs(k).picks.length > 0;
  const rows = im ? buildRows(k) : [], ok = rows.filter((r) => !r.errs.length);
  const miss = cs(k).cands.filter((x) => missingOf(k, x).length).length;
  return `<div class="row spread"><div>${corpsSwitcher()}<h1 style="font-size:28px;font-weight:800;margin-top:6px">הזנה וייבוא</h1><div class="mut small">קליטת מועמדים מקובץ אקסל או CSV, לפי חיל</div></div></div>
   <div class="grid g3"><div class="kpi"><b>${cs(k).cands.length}</b><span>מועמדים במאגר</span></div><div class="kpi"><b>${A.ui.imported || 0}</b><span>יובאו בטעינה זו</span></div><div class="kpi"><b>${miss}</b><span>תיקים עם נתונים חסרים</span></div></div>
   <div class="card"><h2>1. בחירת קובץ</h2><p class="mut small">עמודות נדרשות: שם, תפקיד, המלצת מגבש, מגבלות רפואיות, פרופיל, ${c.stats.map((s) => esc(s.l + ' (' + s.u + ')')).join(', ')}. שורה אחת לכל מועמד/ת.</p>
    ${!canImp ? '<div class="demo-note">ייבוא זמין לשלישות החיל בלבד.</div>' : ''}${started ? '<div class="demo-note">הדראפט כבר התחיל – מועמדים חדשים יצטרפו למאגר הפנויים.</div>' : ''}
    <div class="drop"><input type="file" id="file" accept=".xlsx,.xls,.csv" data-chg="file" ${canImp ? '' : 'disabled'}><div class="row" style="justify-content:center;margin-top:10px"><button class="btn sec sm" data-act="sample" ${canImp ? '' : 'disabled'}>טעינת קובץ לדוגמה</button><button class="btn sec sm" data-act="template">הורדת תבנית אקסל</button></div><div class="mut small" style="margin-top:6px">הקובץ נקרא בדפדפן ונשלח לשרת רק בלחיצה על ״ייבוא״. אין להעלות נתוני אמת באב־טיפוס.</div></div></div>
   ${im ? `<div class="card"><h2>2. התאמת עמודות</h2><div class="row">${importFields(k).map(([key, label]) => `<label class="small mut">${esc(label)}<br><select data-chg="map" data-f="${esc(key)}" style="min-width:150px"><option value="-1">— לא ממופה —</option>${im.headers.map((h, i) => `<option value="${i}" ${im.map[key] === i ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select></label>`).join('')}</div></div>
   <div class="card"><h2>3. בדיקה וייבוא</h2><p>${rows.length} שורות · <b style="color:var(--green)">${ok.length} תקינות</b> · <b style="color:var(--red)">${rows.length - ok.length} עם בעיות (ידולגו)</b></p>
    <div style="overflow:auto;max-height:320px"><table><thead><tr><th>שורה</th><th>שם</th><th>תפקיד</th><th>המלצה</th><th>מדדים חסרים</th><th>בדיקה</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.n}</td><td>${esc(r.name)}</td><td>${esc(r.role)}</td><td>${esc(r.rec || '—')}</td><td>${c.stats.filter((s) => r.stats[s.k] === '' || r.stats[s.k] == null).map((s) => esc(s.l)).join(', ') || '—'}</td><td>${r.errs.length ? `<span class="pill p-red">${esc(r.errs.join(', '))}</span>` : '<span class="pill p-green">תקין</span>'}</td></tr>`).join('')}</tbody></table></div>
    <div class="row" style="margin-top:10px"><button class="btn" data-act="doImport" ${canImp && ok.length ? '' : 'disabled'}>ייבוא ${ok.length} מועמדים</button><button class="btn sec" data-act="impClear">ביטול</button></div></div>` : ''}
   <div class="card"><div class="row spread"><h2 style="margin:0">המאגר הנוכחי – ${esc(c.corps)}</h2><div class="row"><button class="btn sec sm" data-act="exportX">ייצוא לאקסל</button><button class="btn sec sm" data-act="exportC">ייצוא CSV</button></div></div>
    <div style="overflow:auto;max-height:420px;margin-top:8px"><table><thead><tr><th>מס׳</th><th>שם</th><th>תפקיד</th><th>המלצה</th><th>חסר בתיק</th><th>מקור</th></tr></thead><tbody>${cs(k).cands.map((x) => `<tr><td>${x.id}</td><td>${esc(x.name)}</td><td>${esc(x.role)}</td><td>${recPill(x.rec)}</td><td>${esc(missingOf(k, x).join(', ') || 'מלא')}</td><td>${esc(x.source || 'מאגר קיים')}</td></tr>`).join('')}</tbody></table></div>
    <div class="mut small" style="margin-top:8px">הנתונים נשמרים בשרת (data/state.json).</div></div>`;
};
function setImport(k, aoa) {
  const headers = (aoa[0] || []).map((h) => String(h)), data = aoa.slice(1).filter((r) => r.some((v) => String(v).trim() !== ''));
  A.ui.imp = { headers, data, map: autoMap(k, headers) }; rerender();
}
function sheetRows(k) { const c = cf(k); return [['שם', 'תפקיד', 'המלצת מגבש', 'מגבלות רפואיות', 'פרופיל'].concat(c.stats.map((s) => s.l + ' (' + s.u + ')'))]; }
function downloadX(name, aoa) { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'מועמדים'); wb.Workbook = { Views: [{ RTL: true }] }; XLSX.writeFile(wb, name); }
const poolRows = (k) => sheetRows(k).concat(cs(k).cands.map((x) => [x.name, x.role, x.rec || '', x.med, x.profile].concat(cf(k).stats.map((s) => (x.stats[s.k] == null ? '' : x.stats[s.k])))));
Object.assign(ACTIONS, {
  file: async (d, t) => { const f = t.files[0]; if (!f) return; const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }); setImport(corpsKey(), XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })); },
  map: (d, t) => { A.ui.imp.map[d.f] = +t.value; rerender(); },
  sample: () => {
    const k = corpsKey(), c = cf(k), aoa = sheetRows(k), names = ['נועה ל.', 'איתי ר.', 'שירה מ.', 'עומר ש.', 'מאיה ד.', 'דניאל כ.'];
    names.forEach((n, i) => aoa.push([n, c.roles[i % c.roles.length], A.cfg.RECS[i % 3], A.cfg.MEDS[i % 3 === 2 ? 1 : 0], 97].concat(c.stats.map((s) => (i === 4 && s === c.stats[0] ? '' : +(s.min + (s.max - s.min) * (0.4 + 0.1 * i)).toFixed(s.d))))));
    setImport(k, aoa);
  },
  template: () => downloadX('mil-draft-template.xlsx', sheetRows(corpsKey()).concat([['דוגמה ד.', cf(corpsKey()).roles[0], 'מומלץ', 'ללא מגבלות', 97].concat(cf(corpsKey()).stats.map((s) => s.min))])),
  impClear: () => { A.ui.imp = null; rerender(); },
  doImport: async () => {
    const k = corpsKey(), rows = buildRows(k).filter((r) => !r.errs.length);
    const r = await api('import', { corps: k, rows }); A.ui.imported = r.added; A.ui.imp = null; rerender(); toast(`יובאו ${r.added} מועמדים${r.skipped ? ' · דולגו ' + r.skipped : ''}`);
  },
  exportX: () => downloadX('pool-' + corpsKey() + '.xlsx', poolRows(corpsKey())),
  exportC: () => csvDownload('pool-' + corpsKey() + '.csv', poolRows(corpsKey())),
});
