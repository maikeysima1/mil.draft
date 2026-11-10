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
      const cfg = (await api('config')).json, K = 'combat';
      for (const id of ['u3', 'u1', 'u4', 'h1', 'o1', 'a1']) { // nav items must match the role's page list
        const u = cfg.users.find((x) => x.id === id), { page, errs } = await session(browser, id);
        const nav = await page.locator('.nav a').count(); ok(nav === cfg.roles[u.role].pages.length, `${id} (${u.role}): ${nav} nav items, expected ${cfg.roles[u.role].pages.length}`);
        for (const r of cfg.roles[u.role].pages) { await go(page, r); if (!(await page.evaluate((r) => location.hash === '#/' + r, r))) ok(false, `${id}: page ${r} did not open`); }
        ok(errs.length === 0, `${id}: every allowed page renders without errors ${errs.join('|')}`); await page.context().close();
      }
      const st = async (u) => (await api('state', u || 'a1')).json.corps[K].cands, by = (cs, id) => cs.find((x) => x.id === id);
      const deny = async (u, p, b, label) => { const r = await api(p, u, b); ok(r.status >= 400, `${label} denied (${r.status})`); };
      const all = await st(), act = all.filter((x) => x.tstatus === 'בהכשרה'), t3 = act.find((x) => x.group === 3), t1 = act.find((x) => x.group === 1), s2 = act.filter((x) => x.group === 2)[0];
      ok(all.every((x) => x.unit && x.target && x.intakeTs), 'every seeded soldier has a unit, a target and an intake date');
      // daily follow-up
      ok((await api('daily', 'u4', { corps: K, id: t3.id, level: 2, text: 'בדיקה' })).status === 200, 'evaluator of team 3 writes a daily entry for a team-3 soldier');
      await deny('u4', 'daily', { corps: K, id: t1.id, level: 1 }, 'evaluator of team 3 on a team-1 soldier');
      await deny('u1', 'daily', { corps: K, id: t1.id, level: 1 }, 'שלישות writing a daily entry');
      await deny('o1', 'daily', { corps: K, id: t1.id, level: 1 }, 'observer writing a daily entry');
      await api('daily', 'u4', { corps: K, id: t3.id, level: 0, text: 'עדכון' });
      const d3 = by(await st(), t3.id).daily.filter((e) => e.byId === 'u4'); ok(d3.length === 1 && d3[0].level === 0, 'a second entry the same day replaces the first (one per author per day)');
      // periodic status -> dismissal review -> decision
      await deny('u4', 'periodic', { corps: K, id: t3.id, rec: 'ממשיך/ה', summary: 'סיכום תקופתי לבדיקה' }, 'evaluator writing a periodic status');
      await deny('u3', 'periodic', { corps: K, id: t1.id, rec: 'ממשיך/ה', summary: 'קצר' }, 'periodic status without a real summary');
      ok((await api('periodic', 'u3', { corps: K, id: t1.id, rec: 'במעקב', summary: 'נדרש חיזוק בניווט ובעבודת צוות', lv: [1, 0, 1, 1, 0] })).status === 200, 'training commander saves a periodic status');
      ok(by(await st(), t1.id).tstatus === 'במעקב', 'recommendation "במעקב" moves the soldier to follow-up');
      const pr = await api('periodic', 'u3', { corps: K, id: t1.id, rec: 'מועמד/ת להדחה', summary: 'ירידה מתמשכת בתפקוד לאורך התקופה' });
      const c1 = by(await st(), t1.id); ok(pr.json.opened === true && c1.tstatus === 'בבדיקת הדחה' && c1.reviews.filter((r) => r.period === c1.reviews[c1.reviews.length - 1].period).length === 1, '"מועמד/ת להדחה" opens a dismissal review; one status per period');
      await deny('u4', 'dismiss-decide', { corps: K, id: t1.id, decision: 'הודח/ה', note: 'נימוק ארוך מספיק לבדיקה' }, 'evaluator deciding a dismissal review');
      await deny('u1', 'dismiss-decide', { corps: K, id: t1.id, decision: 'הודח/ה', note: 'נימוק ארוך מספיק לבדיקה' }, 'שלישות deciding a dismissal review');
      await deny('u3', 'dismiss-decide', { corps: K, id: t1.id, decision: 'הודח/ה', note: '' }, 'decision without a written reason');
      ok((await api('dismiss-decide', 'u3', { corps: K, id: t1.id, decision: 'הודח/ה', note: 'הוחלט לאחר שיחה עם החייל ועם המגבש' })).status === 200, 'training commander decides: dismissed');
      ok(by(await st(), t1.id).tstatus === 'הודח/ה', 'soldier status is now dismissed');
      await deny('u3', 'daily', { corps: K, id: t1.id, level: 1 }, 'daily entry for a dismissed soldier');
      ok((await api('dismiss-open', 'u4', { corps: K, id: t3.id, reason: 'שלושה ימים רצופים של קושי בעומס' })).status === 200, 'evaluator recommends a dismissal review for an own-team soldier');
      await deny('u3', 'complete', { corps: K, id: t3.id }, 'completing training while a dismissal review is open');
      ok((await api('dismiss-decide', 'u3', { corps: K, id: t3.id, decision: 'נשאר/ת במעקב', note: 'שיפור אחרי שיחה, ממשיך במעקב' })).status === 200 && by(await st(), t3.id).tstatus === 'במעקב', 'review closed: stays in follow-up');
      ok((await api('complete', 'u3', { corps: K, id: s2.id })).status === 200 && by(await st(), s2.id).tstatus === 'סיים/ה הכשרה', 'training commander marks training as completed');
      // intake
      await deny('u3', 'intake', { corps: K, name: 'בדיקה א.', role: cfg.corps[K].roles[0], unit: cfg.corps[K].units[0].name, target: cfg.TARGETS[K][0], group: 1 }, 'training commander doing intake');
      await deny('u1', 'intake', { corps: K, name: 'בדיקה א.', role: cfg.corps[K].roles[0], group: 1 }, 'intake without a target unit');
      const inr = await api('intake', 'u1', { corps: K, name: 'בדיקה א.', role: cfg.corps[K].roles[0], target: cfg.TARGETS[K][0], group: 1 });
      const nc = by(await st(), inr.json.id); ok(inr.status === 200 && nc.unit === 'גדס״ר גבעתי' && nc.tstatus === 'בהכשרה' && nc.profile == null && nc.lv.every((v) => v == null), 'שלישות intake: own unit, in training, unknown data stays unknown');
      await deny('u2', 'intake', { corps: K, name: 'בדיקה ב.', role: cfg.corps[K].roles[0], target: cfg.TARGETS[K][0], group: 1 }, 'שלישות of another track doing intake here');
      // favorites (personal follow list) are private
      await api('fav', 'u1', { corps: K, id: t3.id, on: true });
      ok(((await api('state', 'u1')).json.corps[K].favs.u1 || []).length === 1 && Object.keys((await api('state', 'u3')).json.corps[K].favs || {}).length === 0, 'personal follow list is private to its owner');
      await deny('u1', 'settings', { period: 'חציון' }, 'שלישות changing settings');
      ok((await api('settings', 'a1', { period: 'חציון' })).status === 200 && /חציון/.test((await api('state', 'a1')).json.period.label), 'admin switches the periodic status to half-year');
      await api('settings', 'a1', { period: 'רבעון' });
      await deny('u1', 'pick', { corps: K, id: t3.id }, 'removed draft action');
      // UI flows
      const ev = await session(browser, 'u4'); await go(ev.page, 'daily');
      ok(!(await ev.page.locator('main').innerText()).includes(t1.name) || t1.group === 3, 'evaluator sees only the own team in the daily screen');
      await ev.page.locator('[data-act=ddLv][data-v="1"]').nth(1).click(); await ev.page.waitForTimeout(300); await ev.page.click('[data-act=ddSave]'); await ev.page.waitForTimeout(600);
      ok(/נשמרו 1/.test(await ev.page.locator('#toast').innerText()), 'daily quick entry saved from the screen');
      const cm = await session(browser, 'u3'); await go(cm.page, 'roster');
      await cm.page.fill('#rf-q', nc.name); await cm.page.waitForTimeout(400); ok(await cm.page.locator('tr.clk').count() === 1, 'roster search finds the new soldier');
      await cm.page.locator('tr.clk .clink').first().click(); await cm.page.waitForSelector('.drawer');
      await cm.page.click('[data-act=cfOpen][data-t=periodic]'); await cm.page.selectOption('select[data-f=rec]', 'ממשיך/ה'); await cm.page.fill('#cf-summary', 'התחלה טובה, משתלב/ת בצוות'); await cm.page.click('[data-act=cfSave]'); await cm.page.waitForTimeout(600);
      ok(/הסטטוס נשמר/.test(await cm.page.locator('#toast').innerText()) && /סטטוס/.test(await cm.page.locator('.drawer .tl').first().innerText()), 'periodic status entered from the soldier file and shown in the timeline');
      const hq = await session(browser, 'h1'); ok(await hq.page.locator('.clink').count() === 0 && /מספרים מסכמים בלבד/.test(await hq.page.locator('main').innerText()), 'ראש מטה sees totals only, no names');
      ok(ev.errs.length + cm.errs.length + hq.errs.length === 0, 'no page errors in the UI flows ' + ev.errs.concat(cm.errs, hq.errs).join('|'));
      console.log(bad ? `\n${bad} FAILED` : '\nALL PASSED'); process.exitCode = bad ? 1 : 0;
    } else { console.log('commands: users | shot <userId> <route> | smoke   (see header comment)'); }
  } finally { await browser.close(); }
}
main().catch((e) => { console.error('driver error:', e.message.split('\n')[0]); process.exit(1); });
