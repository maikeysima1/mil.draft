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
      const [user, route] = argv; if (!user || !route) throw new Error('usage: shot <userId> <route: room|board|eval|command|import>');
      const { page, errs } = await session(browser, user); await go(page, route);
      const f = path.join(OUT, [user, route, phone && 'phone', dark && 'dark'].filter(Boolean).join('-') + '.png'); await page.screenshot({ path: f, fullPage: full });
      console.log(f); console.log('page errors:', JSON.stringify(errs));
    } else if (cmd === 'flow') {
      if (!isHttp) throw new Error('flow needs the server build (http)');
      await api('factory-reset', 'a1', {}); // known starting state
      const { page, errs } = await session(browser, 'u1'); await page.waitForSelector('.clock.me');
      const name = (await page.locator('tr.clk:not(.taken) td:first-child b').first().innerText()).trim();
      await page.locator('tr.clk:not(.taken)').first().locator('[data-act=pick]').click(); await page.waitForTimeout(700);
      const toast = await page.locator('#toast').innerText(); await go(page, 'board');
      const onBoard = await page.locator('.board .cell.pick:has-text("' + name + '")').count();
      const f = path.join(OUT, 'flow-board.png'); await page.screenshot({ path: f });
      console.log(JSON.stringify({ picked: name, toast, shownOnBoard: onBoard > 0, screenshot: f, errors: errs }));
      if (!onBoard || errs.length) process.exitCode = 1;
    } else if (cmd === 'smoke') {
      if (!isHttp) throw new Error('smoke needs the server build (http)');
      let bad = 0; const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) bad++; };
      await api('factory-reset', 'a1', {});
      const cfg = (await api('config')).json;
      for (const id of ['u3', 'u1', 'u4', 'h1', 'o1', 'a1']) { // nav items must match the role's page list
        const u = cfg.users.find((x) => x.id === id), { page, errs } = await session(browser, id);
        const nav = await page.locator('.nav a').count(); ok(nav === cfg.roles[u.role].pages.length, `${id} (${u.role}): ${nav} nav items, expected ${cfg.roles[u.role].pages.length}`);
        ok(errs.length === 0, `${id}: no page errors ${errs.join('|')}`); await page.context().close();
      }
      const deny = async (u, p, b, label) => { const r = await api(p, u, b); ok(r.status >= 400, `${label} denied (${r.status})`); };
      await deny('o1', 'pick', { corps: 'combat', id: 'C-2101' }, 'observer pick');
      await deny('u1', 'factory-reset', {}, 'שלישות factory-reset');
      await deny('u3', 'eval', { corps: 'combat', id: 'C-2103', rec: 'מומלץ' }, 'commander eval (view-only)');
      await deny('u1', 'regroup', { corps: 'combat', id: 'C-2103', group: 2 }, 'שלישות regroup');
      await deny('e-combat-2', 'eval', { corps: 'combat', id: 'C-2105', rec: 'מומלץ' }, 'evaluator of team 2 on a team-1 candidate');
      const lp = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage(); await lp.goto(BASE); await lp.waitForSelector('.login');
      ok(await lp.locator('[data-act=lorg]').count() === 5, 'login step 1 offers 5 corps (רגלים, מודיעין, קשר, משאבי אנוש, פיתוח)');
      ok(await lp.locator('[data-act=login]').isDisabled(), 'login button disabled until חיל, יחידה and תפקיד are chosen');
      await lp.click('[data-act=lorg][data-v=hr]'); await lp.waitForTimeout(300); ok((await lp.locator('[data-act=lunit]').allInnerTexts()).join('|') === 'משאבי אנוש|מטה|ראש אכ״א', 'HR corps units: משאבי אנוש / מטה / ראש אכ״א');
      await lp.click('[data-act=lorg][data-v=combat]'); await lp.click('[data-act=lunit][data-v="חטיבת גבעתי"]'); await lp.waitForTimeout(300);
      ok((await lp.locator('[data-act=sel] b').allInnerTexts()).join('|') === 'שלישות|מפקד/ת הכשרה|מגבש/ת צוות 1|מגבש/ת צוות 2|מגבש/ת צוות 3|מגבש/ת צוות 4', 'roles under a unit: שלישות, מפקד/ת הכשרה, מגבש/ת צוות 1-4');
      await lp.click('[data-act=lorg][data-v=dev]'); await lp.waitForTimeout(300); ok(await lp.locator('[data-act=sel]').count() === 2, 'פיתוח: single unit auto-selected, 2 system roles offered');
      await lp.close();
      const g = await session(browser, 'u1'); await g.page.waitForSelector('.clock.me');
      ok((await g.page.locator('#clk, #clkring').count()) === 0 && (await api('state', 'u1')).json.clockSeconds === 0, 'no turn timer (clockSeconds = 0, no clock in the UI)');
      await g.page.locator('tr.clk:not(.taken)').first().locator('[data-act=pick]').click(); await g.page.waitForTimeout(600);
      ok(/נשמרה/.test(await g.page.locator('#toast').innerText()), 'שלישות pick accepted');
      await g.page.locator('tr.clk .favbtn').nth(2).click(); await g.page.waitForTimeout(500);
      const mine = await api('state', 'u1'), other = await api('state', 'u3');
      ok(((mine.json.corps.combat.favs || {}).u1 || []).length === 1, 'favorite stored for its owner');
      ok(Object.keys(other.json.corps.combat.favs || {}).length === 0, 'favorites are not sent to other users');
      ok(g.errs.length === 0, 'no page errors during pick/favorite');
      console.log(bad ? `\n${bad} FAILED` : '\nALL PASSED'); process.exitCode = bad ? 1 : 0;
    } else { console.log('commands: users | shot <userId> <route> | flow | smoke   (see header comment)'); }
  } finally { await browser.close(); }
}
main().catch((e) => { console.error('driver error:', e.message.split('\n')[0]); process.exit(1); });
