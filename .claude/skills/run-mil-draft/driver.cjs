#!/usr/bin/env node
// Agent harness for MIL-DRAFT: drives the running app with headless Chromium (Playwright, preinstalled).
//   node driver.cjs users                         list demo users + their layer/pages (needs the server)
//   node driver.cjs shot <userId> <route> [--phone] [--dark] [--full]   login, open #/<route>, screenshot
//   node driver.cjs flow                          one real flow: שלישות גבעתי picks a candidate, the board shows it
//   node driver.cjs smoke                         permission matrix + API denials + flow + favorites privacy (exit 1 on failure)
// Options: --base <url> (default http://localhost:3000/ ; a file:// URL of the standalone index.html also works)
//          --out <dir>  (default /tmp/mil-shots)        env MIL_CODE=<code> when the server runs with ACCESS_CODE
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), cmd = argv.shift();
const opt = (n, d) => { const i = argv.indexOf('--' + n); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const flag = (n) => { const i = argv.indexOf('--' + n); if (i < 0) return false; argv.splice(i, 1); return true; };
const BASE = opt('base', process.env.MIL_BASE || 'http://localhost:3000/'), OUT = opt('out', '/tmp/mil-shots');
const phone = flag('phone'), dark = flag('dark'), full = flag('full');
const isHttp = /^https?:/.test(BASE), API = isHttp ? new URL('/api/', BASE).href : null, CODE = process.env.MIL_CODE || '';
fs.mkdirSync(OUT, { recursive: true });

async function api(p, user, body) { // raw HTTP call as a demo user (identity = X-User header)
  const r = await fetch(API + p, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', 'X-User': user || '', 'X-Code': CODE }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (r.status === 401) throw new Error('401 - the server was started with ACCESS_CODE; run the driver with MIL_CODE=<code>');
  return { status: r.status, json: await r.json().catch(() => ({})) };
}
async function session(browser, userId) { // fresh context, logged in as userId
  const ctx = await browser.newContext(phone ? { ...devices['iPhone 13'], locale: 'he-IL' } : { viewport: { width: 1440, height: 1000 }, locale: 'he-IL' });
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); }); // font CDN is unreachable in the sandbox
  page.on('dialog', (d) => d.accept()); // the app uses confirm() for pick / reset
  await page.goto(BASE);
  if (!CODE && (await page.locator('#codeGo').count())) throw new Error('the app asks for an access code; run the driver with MIL_CODE=<code>');
  if (CODE) { await page.waitForSelector('#code'); await page.fill('#code', CODE); await page.click('#codeGo'); }
  await page.waitForSelector('.login');
  const u = await page.evaluate((id) => A.cfg.users.find((x) => x.id === id), userId); if (!u) throw new Error('unknown user id ' + userId + ' (run: users)');
  await page.click(`[data-act=lorg][data-v="${u.org}"]`); await page.click(`[data-act=lunit][data-v="${u.orgUnit}"]`); // login = חיל -> יחידה -> תפקיד
  await page.click(`[data-act=sel][data-id="${userId}"]`); await page.click('[data-act=login]'); await page.waitForSelector('.side');
  if (dark && (await page.evaluate(() => document.documentElement.dataset.theme)) !== 'dark') await page.click('[data-act=theme]');
  return { ctx, page, errs };
}
const go = async (page, route) => { await page.goto(BASE + '#/' + route); await page.waitForTimeout(500); }; // rendering is rAF-async

async function main() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    if (cmd === 'users') {
      const { json } = await api('config'); console.log('id'.padEnd(12), 'layer', 'role'.padEnd(14), 'login: חיל > יחידה > תפקיד');
      json.users.forEach((u) => { const r = json.roles[u.role], org = json.orgs.find((o) => o.key === u.org).label; console.log(u.id.padEnd(12), String(r.layer).padEnd(5), u.role.padEnd(14), org + ' > ' + u.orgUnit + ' > ' + u.roleLabel); });
    } else if (cmd === 'shot') {
      const [user, route] = argv; if (!user || !route) throw new Error('usage: shot <userId> <route: dash|roster|daily|periodic|dismiss|intake|eval|log|settings>');
      const { page, errs } = await session(browser, user); await go(page, route);
      const f = path.join(OUT, [user, route, phone && 'phone', dark && 'dark'].filter(Boolean).join('-') + '.png'); await page.screenshot({ path: f, fullPage: full });
      console.log(f); console.log('page errors:', JSON.stringify(errs));
    } else if (cmd === 'smoke') {
      if (!isHttp) throw new Error('smoke needs the server build (http)');
      let bad = 0; const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) bad++; };
      await api('factory-reset', 'a1', {});
      const cfg = (await api('config')).json, K = 'recon';
      for (const id of ['u3', 'u1', 'u4', 'p-recon', 'm-recon-1', 'k-recon-1', 'h1', 'o1', 'a1']) { // nav items must match the role's page list
        const u = cfg.users.find((x) => x.id === id), { page, errs } = await session(browser, id);
        const nav = await page.locator('.nav a').count(); ok(nav === cfg.roles[u.role].pages.length, `${id} (${u.role}): ${nav} nav items, expected ${cfg.roles[u.role].pages.length}`);
        for (const r of cfg.roles[u.role].pages) { await go(page, r); if (!(await page.evaluate((r) => location.hash === '#/' + r, r))) ok(false, `${id}: page ${r} did not open`); }
        ok(errs.length === 0, `${id}: every allowed page renders without errors ${errs.join('|')}`); await page.context().close();
      }
      const st = async (u) => (await api('state', u || 'a1')).json.corps[K].cands, by = (cs, id) => cs.find((x) => x.id === id);
      const deny = async (u, p, b, label) => { const r = await api(p, u, b); ok(r.status >= 400, `${label} denied (${r.status})`); };
      const all = await st(), act = all.filter((x) => x.tstatus === 'בהכשרה'), t3 = act.find((x) => x.group === 2), t1 = act.find((x) => x.group === 1), s2 = act.filter((x) => x.group === 1)[1]; // u4 = evaluator of team 2
      ok(all.every((x) => x.unit && x.target && x.intakeTs), 'every seeded soldier has a unit, a target and an intake date');
      ok(all.every((x) => cfg.teams.includes(x.group)) && cfg.teams.length === 2 && Object.keys(cfg.corps).every((k) => cfg.users.filter((u) => u.role === 'מגבש/ת' && u.corps === k).length === 2), 'two teams and two evaluators per track');
      ok(Object.keys(cfg.corps).every((k) => ['מ״פ', 'מ״מ', 'מ״כ'].every((r) => cfg.users.some((u) => u.role === r && u.corps === k))), 'training staff (מ״פ / מ״מ / מ״כ) exists in every track');
      // experiences (התנסויות): one entry per soldier per experience; the same experience saved again replaces it
      const sidA = 'testsid01', exr = (id, lv, more) => Object.assign({ id, level: lv }, more || {});
      ok((await api('daily', 'u4', { corps: K, exp: 'מטווח', title: 'מטווח 50 מ׳', sid: sidA, rows: [exr(t3.id, 2, { score: 88, text: 'בדיקה' })] })).status === 200, 'evaluator of team 2 records an experience for a team-2 soldier');
      ok(by(await st(), t3.id).daily.some((e) => e.sid === sidA && e.exp === 'מטווח' && e.score === 88 && e.title === 'מטווח 50 מ׳'), 'the entry keeps the experience type, name and score');
      await deny('u4', 'daily', { corps: K, exp: 'מטווח', sid: sidA, rows: [exr(t1.id, 1)] }, 'evaluator of team 2 on a team-1 soldier');
      await deny('u1', 'daily', { corps: K, exp: 'מטווח', sid: sidA, rows: [exr(t1.id, 1)] }, 'שלישות recording an experience');
      await deny('o1', 'daily', { corps: K, exp: 'מטווח', sid: sidA, rows: [exr(t1.id, 1)] }, 'observer recording an experience');
      await api('daily', 'u4', { corps: K, exp: 'מטווח', title: 'מטווח 50 מ׳', sid: sidA, rows: [exr(t3.id, 0, { text: 'עדכון' })] });
      const d3 = by(await st(), t3.id).daily.filter((e) => e.sid === sidA); ok(d3.length === 1 && d3[0].level === 0, 'saving the same experience again replaces the entry');
      await api('daily', 'u4', { corps: K, exp: 'מסע', title: 'מסע 8 ק״מ', sid: 'testsid02', rows: [exr(t3.id, 1)] });
      ok(by(await st(), t3.id).daily.filter((e) => e.byId === 'u4' && e.sid).length === 2, 'two experiences on the same day are two entries');
      // exceptional events
      await deny('u4', 'event', { corps: K, id: t3.id, kind: 'שלילי', text: 'קצר' }, 'exceptional event without a description');
      await deny('k-recon-2', 'event', { corps: K, id: t3.id, kind: 'שלילי', text: 'איחור של שעה למסדר הבוקר' }, 'מ״כ recording an exceptional event');
      ok((await api('event', 'u4', { corps: K, id: t3.id, kind: 'שלילי', text: 'איחור של שעה למסדר הבוקר' })).status === 200 && by(await st(), t3.id).events.some((e) => e.kind === 'שלילי'), 'exceptional event recorded in the file');
      // no medical data anywhere
      ok(!('MEDS' in cfg) && (await st()).every((x) => x.med === undefined && x.profile === undefined && !(x.extra && 'medNote' in x.extra)) && !cfg.TR.attend.some((a) => /רפוא/.test(a)), 'no medical data in the config or in any soldier file');
      // periodic status -> dismissal review
      await deny('u4', 'periodic', { corps: K, id: t3.id, rec: 'ממשיך/ה', summary: 'סיכום תקופתי לבדיקה' }, 'evaluator writing a periodic status');
      await deny('u3', 'periodic', { corps: K, id: t1.id, rec: 'ממשיך/ה', summary: 'קצר' }, 'periodic status without a real summary');
      ok((await api('periodic', 'u3', { corps: K, id: t1.id, rec: 'במעקב', summary: 'נדרש חיזוק בניווט ובעבודת צוות', lv: [1, 0, 1, 1, 0] })).status === 200, 'training commander saves a periodic status');
      ok(by(await st(), t1.id).tstatus === 'במעקב', 'recommendation "במעקב" moves the soldier to follow-up');
      const pr = await api('periodic', 'u3', { corps: K, id: t1.id, rec: 'מועמד/ת להדחה', summary: 'ירידה מתמשכת בתפקוד לאורך התקופה' });
      const c1 = by(await st(), t1.id); ok(pr.json.opened === true && c1.tstatus === 'בבדיקת הדחה' && c1.reviews.filter((r) => r.period === c1.reviews[c1.reviews.length - 1].period).length === 1, '"מועמד/ת להדחה" opens a dismissal review; one status per period');
      // the review goes stage by stage: שיחת מ״מ -> שיחת דוברת -> ועדה אצל מפקדת הגדוד (-> ועדה בדרג נוסף)
      const stg = (u, id, stage, more) => api('dismiss-stage', u, Object.assign({ corps: K, id, stage, summary: 'סיכום מפורט של השלב לבדיקה' }, more));
      await deny('u3', 'dismiss-stage', { corps: K, id: t1.id, stage: 'bn', outcome: 'הודח/ה', summary: 'ניסיון לדלג על השיחות' }, 'committee before the talks were recorded');
      await deny('u1', 'dismiss-stage', { corps: K, id: t1.id, stage: 'mm', rec: 'להדיח', summary: 'שלישות מתעדת שיחה' }, 'שלישות recording a talk');
      await deny('u4', 'dismiss-stage', { corps: K, id: t1.id, stage: 'mm', rec: 'להדיח', summary: 'מגבש מתעד שיחת מ״מ' }, 'evaluator recording the platoon commander talk');
      await deny('m-recon-2', 'dismiss-stage', { corps: K, id: t1.id, stage: 'mm', rec: 'להדיח', summary: 'מ״מ של צוות אחר' }, 'מ״מ of team 2 on a team-1 soldier');
      await deny('m-recon-1', 'dismiss-stage', { corps: K, id: t1.id, stage: 'mm', rec: 'להדיח', summary: 'קצר' }, 'talk without a real summary');
      ok((await stg('m-recon-1', t1.id, 'mm', { rec: 'להדיח' })).status === 200, 'מ״מ of team 1 records the platoon commander talk');
      ok((await stg('m-recon-1', t1.id, 'mm', { rec: 'להשאיר במעקב' })).status === 200 && by(await st(), t1.id).dismiss.find((d) => d.status === 'פתוחה').stages.length === 1, 'the talk can be corrected until the next stage (no duplicate)');
      await deny('m-recon-1', 'dismiss-stage', { corps: K, id: t1.id, stage: 'dov', rec: 'להדיח', summary: 'מ״מ מתעד שיחת דוברת' }, 'מ״מ recording the second talk');
      ok((await stg('p-recon', t1.id, 'dov', { rec: 'להדיח' })).status === 200, 'מ״פ records the second talk');
      await deny('m-recon-1', 'dismiss-stage', { corps: K, id: t1.id, stage: 'mm', rec: 'להדיח', summary: 'תיקון אחרי השלב הבא' }, 'correcting a talk after the next stage');
      await deny('a1', 'dismiss-stage', { corps: K, id: t1.id, stage: 'bn', outcome: 'הודח/ה', summary: 'מנהל מערכת מחליט' }, 'admin deciding in the committee');
      await deny('p-recon', 'dismiss-stage', { corps: K, id: t1.id, stage: 'bn', outcome: 'הודח/ה', summary: 'מ״פ מחליט בוועדה' }, 'מ״פ deciding in the committee');
      await deny('u3', 'dismiss-stage', { corps: K, id: t1.id, stage: 'bn', outcome: 'מעבר ליחידה אחרת', summary: 'תוצאה לא קיימת בוועדה' }, 'committee with an unknown outcome');
      const bn = await stg('u3', t1.id, 'bn', { outcome: 'הודח/ה' }), c1d = by(await st(), t1.id);
      ok(bn.json.closed === true && c1d.tstatus === 'הודח/ה' && c1d.exitTo === cfg.TR.exitTo && c1d.dismiss.find((d) => d.decision === 'הודח/ה').stages.length === 3, 'the committee decides: dismissed, returns to ' + cfg.TR.exitTo + ' with the 3 stages in the file');
      await deny('u3', 'daily', { corps: K, exp: 'מטווח', sid: 'testsid03', rows: [exr(t1.id, 1)] }, 'experience for a dismissed soldier');
      // escalation: the committee passes the review on, the higher committee decides
      ok((await api('dismiss-open', 'u4', { corps: K, id: t3.id, reason: 'שלושה ימים רצופים של קושי בעומס', treat: 'שיחה אישית ותגבור' })).status === 200 && by(await st(), t3.id).dismiss.slice(-1)[0].treat === 'שיחה אישית ותגבור', 'evaluator opens a dismissal review with the treatment so far');
      await deny('u3', 'complete', { corps: K, id: t3.id }, 'completing training while a dismissal review is open');
      await stg('m-recon-2', t3.id, 'mm', { rec: 'להשאיר במעקב' }); await stg('p-recon', t3.id, 'dov', { rec: 'להדיח' });
      await deny('u3', 'dismiss-stage', { corps: K, id: t3.id, stage: 'up', outcome: 'הודח/ה', summary: 'ועדה בדרג נוסף בלי העברה' }, 'higher committee without an escalation');
      const es = await stg('u3', t3.id, 'bn', { outcome: cfg.TR.escalate }); ok(es.json.closed === false && by(await st(), t3.id).tstatus === 'בבדיקת הדחה', 'the committee passes the review on: it stays open');
      ok((await stg('u3', t3.id, 'up', { outcome: 'נשאר/ת במעקב' })).json.closed === true && by(await st(), t3.id).tstatus === 'במעקב', 'the higher committee decides: stays in follow-up');
      ok((await api('complete', 'u3', { corps: K, id: s2.id })).status === 200 && by(await st(), s2.id).tstatus === 'סיים/ה הכשרה', 'training commander marks training as completed');
      const I = 'special';
      await deny('u3', 'dismiss-decide', { corps: K, id: t3.id, decision: 'הודח/ה', note: 'הנתיב הישן של החלטה' }, 'removed one-step decision');
      await deny('a1', 'needs', { corps: I, unit: 'מגלן', need: 9 }, 'removed unit needs (no automatic placement)');
      ok(!('needs' in (await api('state', 'a1')).json.corps[K]), 'no unit needs in the state');
      // intake
      await deny('u3', 'intake', { corps: K, name: 'בדיקה א.', role: cfg.corps[K].roles[0], unit: cfg.corps[K].units[0].name, target: cfg.TARGETS[K][0], group: 1 }, 'training commander doing intake');
      await deny('u1', 'intake', { corps: K, name: 'בדיקה א.', role: cfg.corps[K].roles[0], group: 1 }, 'intake without a target unit');
      const inr = await api('intake', 'u1', { corps: K, name: 'בדיקה א.', role: cfg.corps[K].roles[0], target: cfg.TARGETS[K][0], group: 1 });
      const nc = by(await st(), inr.json.id); ok(inr.status === 200 && nc.unit === 'גדס״ר גבעתי' && nc.tstatus === 'בהכשרה' && nc.profile == null && nc.lv.every((v) => v == null), 'שלישות intake: own unit, in training, unknown data stays unknown');
      await deny('u2', 'intake', { corps: K, name: 'בדיקה ב.', role: cfg.corps[K].roles[0], target: cfg.TARGETS[K][0], group: 1 }, 'שלישות of another track doing intake here');
      await deny('u1', 'fav', { corps: K, id: t3.id, on: true }, 'removed personal follow list (♥)');
      // training staff: מ״מ / מ״פ fill in the data; מ״כ only measured values and arrival status
      const kc = 'k-recon-2', mm = 'm-recon-2', st0 = by(await st(), t3.id), sk = cfg.corps[K].stats[0].k, otherRec = cfg.RECS.find((r) => r !== st0.rec);
      ok((await api('eval', kc, { corps: K, id: t3.id, stats: { [sk]: 77 }, rec: otherRec, obs: 'לא אמור להישמר' })).status === 200, 'מ״כ updates a measured value of an own-team soldier');
      const st1 = by(await st(), t3.id); ok(st1.stats[sk] === 77 && st1.rec === st0.rec && st1.obs === st0.obs, 'מ״כ: only the measured value changed, the evaluator data did not');
      await deny(kc, 'eval', { corps: K, id: t3.id, rec: otherRec }, 'מ״כ changing the recommendation only');
      await deny(kc, 'daily', { corps: K, id: t3.id, level: 1 }, 'מ״כ writing a daily entry');
      await deny(kc, 'periodic', { corps: K, id: t3.id, rec: 'ממשיך/ה', plan: 'להמשיך במסלול הרגיל' }, 'מ״כ writing a periodic status');
      await deny(kc, 'dismiss-open', { corps: K, id: t3.id, reason: 'סיבה ארוכה מספיק לבדיקה' }, 'מ״כ opening a dismissal review');
      ok((await api('attend', kc, { corps: K, id: t3.id, att: 'חסר/ה' })).status === 200 && by(await st(), t3.id).arrive.v === 'חסר/ה', 'מ״כ updates the arrival status');
      await deny(kc, 'attend', { corps: K, id: s2.id, att: 'נוכח/ת' }, 'מ״כ of team 2 on a team-1 soldier');
      ok((await api('eval', mm, { corps: K, id: t3.id, rec: otherRec })).status === 200 && by(await st(), t3.id).rec === otherRec, 'מ״מ fills in the evaluator-sheet data');
      ok((await api('daily', mm, { corps: K, exp: 'תרגיל', sid: 'testsid04', rows: [exr(t3.id, 1)] })).status === 200, 'מ״מ records an experience for an own-team soldier');
      await deny(mm, 'daily', { corps: K, id: s2.id, level: 1 }, 'מ״מ of team 2 on a team-1 soldier');

      const t1b = (await st()).find((x) => x.group === 1 && x.tstatus === 'בהכשרה'), pd = await api('daily', 'p-recon', { corps: K, id: t1b.id, level: 2 });
      ok(pd.status === 200, 'מ״פ writes a daily entry on any team of the track ' + (pd.json.error || ''));
      const pS = (await api('state', 'p-recon')).json, kS = (await api('state', kc)).json;
      ok(pS.corps[K].cands.length === (await st()).length && pS.corps[I].cands.length === 0, 'מ״פ receives the own track only');
      ok(kS.corps[K].cands.length > 0 && kS.corps[K].cands.every((c) => c.group === 2) && kS.log.length === 0, 'מ״כ receives only the own team');
      // the server sends every role only what it may see
      const sn = async (u) => (await api('state', u)).json, hqS = await sn('h1'), evS = await sn('u4'), shS = await sn('u1'), noS = await sn(''), full = await sn('a1');
      ok(hqS.corps[K].cands.length === full.corps[K].cands.length && hqS.corps[K].cands.every((c) => !c.name && !/^C-/.test(c.id) && !(c.daily || []).some((e) => e.text || e.by) && !(c.dismiss || []).length) && hqS.log.length === 0 && !JSON.stringify(hqS).includes(full.corps[K].cands[0].name), 'ראש מטה receives anonymous rows only: no names, notes, dismissal reasons or log');
      ok(evS.corps[K].cands.length > 0 && evS.corps[K].cands.every((c) => c.group === 2) && evS.corps[I].cands.length === 0 && evS.log.length === 0, 'evaluator receives only the own team of the own track');
      ok(shS.corps[K].cands.length === full.corps[K].cands.length && shS.corps[I].cands.length === 0 && shS.log.every((l) => !l.corps || l.corps === K), 'שלישות receives the own track only');
      ok(Object.values(noS.corps).every((c) => c.cands.length === 0) && noS.log.length === 0, 'an unknown user receives no soldier data');
      await deny('u1', 'settings', { period: 'חציון' }, 'שלישות changing settings');
      ok((await api('settings', 'a1', { period: 'חציון' })).status === 200 && /חציון/.test((await api('state', 'a1')).json.period.label), 'admin switches the periodic status to half-year');
      await api('settings', 'a1', { period: 'רבעון' });
      await deny('u1', 'pick', { corps: K, id: t3.id }, 'removed draft action');
      // UI flows
      const ev = await session(browser, 'u4'); await go(ev.page, 'daily');
      ok(!(await ev.page.locator('main').innerText()).includes(t1.name) || t1.group === 2, 'evaluator sees only the own team in the daily screen');
      ok(await ev.page.locator('[data-act=exSave][disabled]').count() === 1, 'saving needs an experience type and at least one mark');
      await ev.page.click('[data-act=exType][data-v="ניווט"]'); await ev.page.waitForTimeout(200); await ev.page.locator('[data-act=exLv][data-v="1"]').nth(1).click(); await ev.page.waitForTimeout(200);
      await ev.page.locator('.excard').nth(1).locator('[data-act=exPh]').first().click(); await ev.page.waitForTimeout(200);
      ok(await ev.page.evaluate(() => { const r = Object.values(A.ui.ex.rows).find((q) => q.level === 1); return !!r && r.text === TR().phrases.good[0] && !!localStorage.getItem(EXK()); }), 'a ready-made phrase fills the note; the draft is kept on the device');
      await ev.page.click('[data-act=exSave]'); await ev.page.waitForTimeout(600);
      ok(/נשמרו 1/.test(await ev.page.locator('#toast').innerText()) && await ev.page.evaluate(() => !localStorage.getItem(EXK())), 'experience saved from the team screen; the device draft is cleared');
      ok(await ev.page.locator('[data-act=exOpen]').count() >= 1, 'recent experiences are listed and can be reopened');
      const cm = await session(browser, 'u3'); await go(cm.page, 'roster');
      await cm.page.fill('#rf-q', nc.name); await cm.page.waitForTimeout(400); ok(await cm.page.locator('tr.clk').count() === 1, 'roster search finds the new soldier');
      await cm.page.locator('tr.clk .clink').first().click(); await cm.page.waitForSelector('.drawer');
      await cm.page.click('[data-act=cfOpen][data-t=periodic]'); await cm.page.selectOption('select[data-f=rec]', 'ממשיך/ה'); await cm.page.fill('#cf-strong', 'משתלב/ת מהר בצוות'); await cm.page.fill('#cf-plan', 'להמשיך במסלול הרגיל'); await cm.page.click('[data-act=cfSave]'); await cm.page.waitForTimeout(600);
      ok(/הסטטוס נשמר/.test(await cm.page.locator('#toast').innerText()) && /סטטוס/.test(await cm.page.locator('.drawer .tl').first().innerText()), 'periodic status entered from the soldier file and shown in the timeline');
      await api('dismiss-open', 'u3', { corps: K, id: nc.id, reason: 'בדיקה לצורך הדגמת חדר ההדחה' }); await go(cm.page, 'dismiss');
      ok(await cm.page.locator('#room-' + nc.id + ' .stages li.cur').count() === 1 && /ממתין לשיחת מ״מ/.test(await cm.page.locator('#room-' + nc.id).innerText()), 'dismissal room shows the stages and the one it waits for');
      await cm.page.locator('#room-' + nc.id + ' [data-act=stgPick]').nth(1).click(); await cm.page.waitForTimeout(200);
      await cm.page.fill('#stg-' + nc.id, 'שיחה שתועדה מתוך חדר ההדחה'); await cm.page.locator('#room-' + nc.id + ' [data-act=stgSave]').click(); await cm.page.waitForTimeout(600);
      ok(/תועד/.test(await cm.page.locator('#toast').innerText()) && await cm.page.locator('#room-' + nc.id + ' .stages li.done').count() === 1 && /ממתין לשיחת דוברת/.test(await cm.page.locator('#room-' + nc.id).innerText()), 'a talk recorded from the room moves the review to the next stage');
      // roster: filters per sub-topic, Excel export of the filtered rows, no ♥
      await go(cm.page, 'roster'); await cm.page.fill('#rf-q', ''); await cm.page.waitForTimeout(300);
      const role0 = cfg.corps[K].roles[0]; await cm.page.selectOption('select[data-f=role]', role0); await cm.page.waitForTimeout(300);
      const rr = await cm.page.evaluate(() => { const k = corpsKey(), rows = rosterList(k), aoa = rosterAoa(k, rows); return { n: rows.length, roles: Array.from(new Set(rows.map((x) => x.role))), aoa: aoa.length, cols: aoa[0].length }; });
      ok(rr.n > 0 && rr.roles.length === 1 && rr.roles[0] === role0 && rr.aoa === rr.n + 1 && rr.cols > 15, 'roster role filter + Excel rows match the filtered list (' + rr.n + ' rows, ' + rr.cols + ' columns)');
      ok(await cm.page.locator('[data-act=rosterXlsx]').count() === 1 && await cm.page.locator('select[data-f=target]').count() === 1 && await cm.page.locator('.favbtn').count() === 0, 'roster has the export button and the track filter, and no ♥');
      const [dl] = await Promise.all([cm.page.waitForEvent('download'), cm.page.click('[data-act=rosterXlsx]')]); ok(/\.xlsx$/.test(dl.suggestedFilename()), 'roster export downloads ' + dl.suggestedFilename());
      await cm.page.click('[data-act=rfClear]'); await cm.page.waitForTimeout(300);
      const dzR = (await st()).find((x) => x.tstatus === "בהכשרה" && !(x.dismiss || []).some((q) => q.status === "פתוחה") && x.id !== nc.id);
      await cm.page.fill('#rf-q', dzR.id); await cm.page.waitForTimeout(300); await cm.page.locator('tr.clk .clink').first().click(); await cm.page.waitForSelector('.drawer');
      await cm.page.click('.drawer [data-act=goOpen]'); await cm.page.waitForSelector('#room-open');
      ok(await cm.page.evaluate(() => location.hash) === '#/dismiss', 'the dismissal-review button in the soldier file goes straight to the dismissal room');
      await cm.page.fill('#open-reason', 'בדיקה שנפתחה ישירות מחדר ההדחה'); await cm.page.click('[data-act=openSave]'); await cm.page.waitForTimeout(600);
      ok(await cm.page.locator('#room-' + dzR.id).count() === 1 && by(await st(), dzR.id).tstatus === 'בבדיקת הדחה', 'the review opened in the room and the soldier is listed there');
      // periodic screen: deadline, priority order, structured summary, continuous entry
      const ps = (await api('state', 'u3')).json; ok(ps.period.daysLeft >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(ps.period.end), 'period carries its end date and the days left');
      await deny('u3', 'periodic', { corps: K, id: nc.id, rec: 'ממשיך/ה', strong: 'חוזקה כלשהי בתקופה' }, 'structured status without "המלצה להמשך"');
      const sr = await api('periodic', 'u3', { corps: K, id: nc.id, rec: 'ממשיך/ה', strong: 'ניווט מדויק', improve: 'עבודה בצוות', plan: 'להמשיך במסלול' }), rvn = by(await st(), nc.id).reviews.slice(-1)[0];
      ok(sr.status === 200 && rvn.parts.plan === 'להמשיך במסלול' && /חוזקות: ניווט מדויק/.test(rvn.summary) && /המלצה להמשך/.test(rvn.summary), 'structured status is stored in parts and as one readable summary');
      await go(cm.page, 'periodic'); const ptxt = await cm.page.locator('main').innerText();
      ok(/ימים עד סוף התקופה/.test(ptxt) && /התקדמות לפי יחידה/.test(ptxt), 'periodic screen shows the deadline and progress per unit');
      const order = await cm.page.evaluate(() => periodicRows(corpsKey()).map((x) => !!periodRv(x))); ok(order.indexOf(true) === -1 || order.lastIndexOf(false) < order.indexOf(true), 'soldiers without a status are listed first');
      const firstId = await cm.page.evaluate(() => periodicRows(corpsKey()).find((x) => !periodRv(x)).id), nextId = await cm.page.evaluate((id) => nextMissing(corpsKey(), id), firstId);
      await cm.page.click('button[data-act=pOpen]:has-text("התחלת הזנה רציפה")'); await cm.page.waitForSelector('#cf-plan');
      ok(await cm.page.locator('.pctx').count() === 1, 'the form shows the daily trend and the previous status next to it');
      await cm.page.selectOption('select[data-f=rec]', 'ממשיך/ה'); await cm.page.fill('#cf-plan', 'ממשיך/ה כרגיל בתקופה הבאה'); await cm.page.click('[data-act=cfSaveNext]'); await cm.page.waitForTimeout(700);
      ok((await cm.page.evaluate(() => A.ui.cand)) === nextId && await cm.page.locator('#cf-plan').count() === 1 && !!by(await st(), firstId).reviews.find((r) => r.period === ps.period.key), '"save and next" saves and opens the next soldier without a status');
      await cm.page.click('[data-act=cfCancel]'); await cm.page.keyboard.press('Escape');
      // "my day" (evaluator) and the automatic weekly summary (commander)
      const td = await session(browser, 'e-recon-1'); ok(await td.page.evaluate(() => location.hash) === '#/today' && /היום שלי – צוות 1/.test(await td.page.locator('main h1').innerText()), 'evaluator lands on "my day" for the own team');
      ok(await td.page.locator('main a[href="#/daily"]').count() >= 1 && /התנסויות/.test(await td.page.locator('main').innerText()), '"my day" leads to recording an experience');
      ok(!(await td.page.locator('main').innerText()).includes(t1.name) || t1.group === 1, '"my day" shows only the evaluator\'s own team');
      await go(cm.page, 'weekly'); const wt = await cm.page.locator('main').innerText();
      ok(/סיכום שבועי/.test(wt) && /איך זה מחושב/.test(wt) && /בלי התנסות מתועדת השבוע/.test(wt), 'weekly summary renders with its calculation rule');
      const wk = await cm.page.evaluate(() => { const w = weekly('recon', ''); return { act: w.act.length, covered: w.covered, none: w.none.length, cmp: w.compared, bad: w.down.concat(w.up).filter((r) => r.a.length < 2 || r.b.length < 2).length, txt: weeklyText('recon', '') }; });
      ok(wk.covered + wk.none === wk.act && wk.bad === 0, 'weekly summary: every active soldier is either covered or listed as "no entry"; trends need 2+ entries in each week');
      ok(wk.txt.split('\n').length >= 8 && /חדר הדחה/.test(wk.txt), 'weekly summary is available as plain text');
      await deny('u4', 'settings', { period: 'חציון' }, 'evaluator changing settings'); await go(td.page, 'weekly'); ok(await td.page.evaluate(() => location.hash) !== '#/weekly', 'the weekly summary is not open to evaluators');
      ok(td.errs.length === 0, 'no page errors on "my day" ' + td.errs.join('|'));
      // confirmation dialog names its action; cancelling changes nothing
      const dz2 = (await st()).find((x) => x.tstatus === 'בהכשרה' && !(x.dismiss || []).some((q) => q.status === 'פתוחה')); await go(cm.page, 'roster'); await cm.page.fill('#rf-q', dz2.id); await cm.page.waitForTimeout(400); await cm.page.locator('tr.clk .clink').first().click(); await cm.page.waitForSelector('.drawer');
      await cm.page.click('[data-act=complete]'); await cm.page.waitForSelector('[role=alertdialog]');
      ok(/סימון סיום/.test(await cm.page.locator('#ask-ok').innerText()) && /חזרה/.test(await cm.page.locator('[role=alertdialog]').innerText()), 'confirmation dialog: buttons are named after the action');
      await cm.page.click('[role=alertdialog] [data-act=askNo]'); await cm.page.waitForTimeout(300); ok(by(await st(), dz2.id).tstatus === 'בהכשרה' && await cm.page.locator('[role=alertdialog]').count() === 0, 'cancelling the dialog changes nothing');
      await cm.page.keyboard.press('Escape');
      const em = await api('daily', 'u4', { corps: K, id: by(await st(), s2.id).id, level: 1 }); ok(em.status >= 400 && /צוות/.test(em.json.error), 'error message says why and what is allowed: ' + em.json.error);
      const hq = await session(browser, 'h1'); ok(await hq.page.locator('.clink').count() === 0 && /מספרים מסכמים בלבד/.test(await hq.page.locator('main').innerText()), 'ראש מטה sees totals only, no names');
      ok(ev.errs.length + cm.errs.length + hq.errs.length === 0, 'no page errors in the UI flows ' + ev.errs.concat(cm.errs, hq.errs).join('|'));
      console.log(bad ? `\n${bad} FAILED` : '\nALL PASSED'); process.exitCode = bad ? 1 : 0;
    } else { console.log('commands: users | shot <userId> <route> | smoke   (see header comment)'); }
  } finally { await browser.close(); }
}
main().catch((e) => { console.error('driver error:', e.message.split('\n')[0]); process.exit(1); });
