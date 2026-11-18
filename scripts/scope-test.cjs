// Unit-scope tests: node scripts/scope-test.cjs <baseUrl>   (server in demo-auth mode, X-User header)
// A training commander under a unit must see and change ONLY the soldiers of that unit - on the server, not just in the UI.
const B = process.argv[2] || 'http://localhost:3123';
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const api = async (p, user, body) => { const r = await fetch(B + '/api/' + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-User': user }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => ({})) }; };
(async () => {
  await api('factory-reset', 'a1', {});
  const cfg = (await api('config', 'a1')).json, K = 'recon', units = cfg.corps[K].units.map((u) => u.name);
  const cmd = (i) => cfg.users.find((u) => u.id === 'c-' + K + '-' + i);
  ok(cmd(0).scope === 'unit' && cmd(0).unit === units[0], 'the commander under ' + units[0] + ' has scope "unit"');
  ok(cmd(units.length).scope === 'corps', 'the commander under the event (track level) sees the whole track');
  const all = (await api('state', 'a1')).json.corps[K].cands, mine = (await api('state', cmd(0).id)).json;
  const seen = mine.corps[K].cands;
  ok(seen.length > 0 && seen.every((c) => c.unit === units[0]), 'snapshot holds only soldiers of ' + units[0] + ' (' + seen.length + ' of ' + all.length + ')');
  ok(all.some((c) => c.unit !== units[0]), 'test data has soldiers in other units');
  ok(Object.keys(mine.corps).every((k) => k === K ? true : mine.corps[k].cands.length === 0), 'no soldiers of other tracks');
  ok(!mine.log.length, 'no activity log (it names soldiers of every unit)');
  const other = all.find((c) => c.unit !== units[0] && ['בהכשרה', 'במעקב'].includes(c.tstatus)), own = seen.find((c) => ['בהכשרה', 'במעקב'].includes(c.tstatus));
  const deny = async (p, body, why) => { const r = await api(p, cmd(0).id, Object.assign({ corps: K, id: other.id }, body)); ok(r.status >= 400, 'denied: ' + why + ' (HTTP ' + r.status + ')'); };
  await deny('daily', { level: 2, text: 'ניסיון כתיבה ליחידה אחרת' }, 'daily entry for a soldier of another unit');
  await deny('dismiss-open', { reason: 'ניסיון פתיחת בדיקה ליחידה אחרת' }, 'opening a dismissal review for another unit');
  await deny('dismiss-msg', { text: 'הודעה' }, 'room message about another unit');
  await deny('complete', {}, 'marking training complete for another unit');
  const o2 = await api('dismiss-open', cmd(0).id, { corps: K, id: own.id, reason: 'בדיקה ביחידה שלי לצורך הבדיקה' }); ok(o2.status === 200, 'allowed: opening a review for a soldier of the own unit');
  const x = (await api('state', 'a1')).json.corps[K].cands.find((c) => c.id === other.id); ok(!(x.dismiss || []).length && x.daily.length === other.daily.length, 'the other unit\'s soldier file was not changed');
  const wrongCorps = await api('daily', cmd(0).id, { corps: 'special', id: 'x', level: 1 }); ok(wrongCorps.status >= 400, 'denied: another track');
  const ev = (await api('state', cmd(units.length).id)).json.corps[K].cands; ok(ev.length === all.length, 'the track-level commander sees every soldier of the track');
  const ad = (await api('state', 'a1')).json; ok(ad.corps[K].cands.length === all.length && ad.log.length > 0, 'the admin still sees everything incl. the log');
  console.log(bad ? '\nSCOPE TESTS FAILED' : '\nALL SCOPE TESTS PASSED'); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
