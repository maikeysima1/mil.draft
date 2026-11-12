// Smoke test for the CyberHire experiment: node cyber/smoke.cjs [url]   (default: the built cyber-experiment.html)
const { chromium } = require('playwright'); const path = require('path');
const B = process.argv[2] || 'file://' + path.join(__dirname, '..', 'cyber-experiment.html'), OUT = process.env.SHOTS;
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] }), errs = [];
  const open = async (user) => { const ctx = await b.newContext({ viewport: { width: 1400, height: 950 }, locale: 'he-IL' }), p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept()); await p.goto(B); await p.waitForSelector('.login'); await p.click(`[data-act=login][data-id=${user}]`); await p.waitForSelector('.side'); return p; };
  const go = async (p, r) => { await p.goto(B + '#/' + r); await p.waitForTimeout(250); };
  const S = (p) => p.evaluate(() => JSON.parse(JSON.stringify(S)));
  const m = await open('m1');
  for (const r of ['dash', 'leads', 'jobs', 'cands', 'settings']) { await go(m, r); ok((await m.locator('main h1').count()) === 1, 'manager: page ' + r + ' renders'); if (OUT) await m.screenshot({ path: path.join(OUT, 'cy-' + r + '.png') }); }
  // lead: new -> stages -> won -> job
  await go(m, 'leads'); await m.click('[data-act=newLead]'); await m.fill('input[data-f=company]', 'בדיקה בע״מ'); await m.selectOption('select[data-f=need]', 'אבטחת ענן'); await m.selectOption('select[data-f=level]', 'Senior'); await m.click('[data-act=saveForm]'); await m.waitForSelector('.drawer');
  let s = await S(m), lead = s.leads.find((l) => l.company === 'בדיקה בע״מ'); ok(!!lead && lead.stage === 'ליד חדש' && lead.owner === 'm1', 'new lead created in the first stage, owned by its creator');
  await m.selectOption('.drawer select[data-chg=stage]', 'נסגר – לקוח'); await m.waitForTimeout(250); await m.click('[data-act=mkJob]'); await m.waitForTimeout(250);
  s = await S(m); const job = s.jobs.find((j) => j.leadId === lead.id); ok(!!job && job.family === 'אבטחת ענן' && job.status === 'פתוחה' && job.skills.length > 0, 'won lead opens a job with the requirements of its field');
  ok(/מועמדים מהמאגר/.test(await m.locator('.drawer').innerText()), 'job drawer shows matching candidates from the pool');
  const sub = m.locator('.drawer [data-act=submit]').first(), cid = await sub.getAttribute('data-id'); await sub.click(); await m.waitForTimeout(250);
  s = await S(m); let c = s.cands.find((x) => x.id === cid); ok(c.jobId === job.id, 'candidate submitted to the job from the match list');
  // candidate: move to hired -> job filled
  await m.click('.drawer [data-act=close]'); await go(m, 'cands'); await m.fill('#cf-q', cid); await m.waitForTimeout(300); ok(await m.locator('.kcard').count() === 1, 'candidate search narrows the board to one card');
  await m.locator('.kcard').first().click(); await m.waitForSelector('.drawer'); ok(/עמידה בדרישות המשרה/.test(await m.locator('.drawer').innerText()), 'candidate drawer shows the requirement-by-requirement match');
  await m.selectOption('.drawer select[data-chg=stage]', 'התקבל/ה'); await m.waitForTimeout(250);
  s = await S(m); ok(s.jobs.find((j) => j.id === job.id).filled === 1 && s.jobs.find((j) => j.id === job.id).status === 'אוישה', 'hiring a candidate fills the job and closes it');
  ok(s.log.length >= 4, 'activity log records the changes');
  // next step + note
  const oc = s.cands.find((x) => !['התקבל/ה', 'נדחה', 'פרש/ה'].includes(x.stage)); await m.click('.drawer [data-act=close]'); await m.fill('#cf-q', oc.id); await m.waitForTimeout(300); await m.locator('.kcard').first().click(); await m.waitForSelector('.drawer');
  await m.fill('#nx-t', 'ראיון טכני'); await m.fill('#nx-d', '2030-01-15'); await m.click('[data-act=saveNext]'); await m.waitForTimeout(200); await m.fill('#nt', 'שיחה טובה, מעוניין/ת'); await m.click('[data-act=addNote]'); await m.waitForTimeout(200);
  s = await S(m); c = s.cands.find((x) => x.id === oc.id); ok(c.next && c.next.date === '2030-01-15' && c.notes.some((n) => n.text === 'שיחה טובה, מעוניין/ת'), 'next step and note are saved on the candidate');
  await m.selectOption('.drawer select[data-chg=stage]', 'נדחה'); await m.waitForTimeout(250); await m.selectOption('.drawer select[data-chg=reason]', 'ציפיות שכר'); await m.waitForTimeout(200);
  s = await S(m); c = s.cands.find((x) => x.id === oc.id); ok(c.stage === 'נדחה' && c.rejectReason === 'ציפיות שכר' && c.next === null, 'rejection keeps a reason and clears the next step');
  // persistence
  await m.reload(); await m.waitForSelector('.side'); ok((await S(m)).leads.some((l) => l.company === 'בדיקה בע״מ'), 'data survives a reload (stored in this browser)');
  // roles
  const sales = await open('s1'); await go(sales, 'cands'); ok(await sales.locator('[data-act=newCand]').count() === 0 && !/₪/.test(await sales.locator('main').innerText()), 'sales: candidates are view-only and show no salary');
  await sales.click('[data-act=view][data-k=cv][data-v=table]'); await sales.waitForTimeout(200); ok(!/ציפיות שכר/.test(await sales.locator('main').innerText()), 'sales: no salary column in the candidates table');
  await go(sales, 'leads'); ok(await sales.locator('[data-act=newLead]').count() === 1, 'sales can add leads');
  const rec = await open('r1'); await go(rec, 'leads'); ok(await rec.locator('[data-act=newLead]').count() === 0, 'recruiter: leads are view-only');
  await rec.locator('.kcard').first().click(); await rec.waitForSelector('.drawer'); ok(await rec.locator('.drawer select[data-chg=stage]').count() === 0, 'recruiter cannot change a lead stage');
  // intelligence layer
  const fresh = await open('m1'); await fresh.evaluate(() => { localStorage.removeItem('cyberhire-v2'); }); await fresh.reload(); await fresh.waitForSelector('.side'); await go(fresh, 'dash');
  const dashTxt = await fresh.locator('main').innerText();
  ok(/מה לעשות עכשיו/.test(dashTxt) && await fresh.locator('.card:has-text("מה לעשות עכשיו") .tl').count() >= 3, 'dashboard ranks next actions, each with a reason');
  ok(/צפי איוש למשרות פתוחות/.test(dashTxt) && /הנחות ברירת מחדל/.test(dashTxt), 'forecast table states its source (defaults until there is enough history)');
  const fs = await S(fresh), oj = fs.jobs.find((j) => j.status === 'פתוחה');
  const fc = await fresh.evaluate((id) => { const f = forecast(S.jobs.find((x) => x.id === id)); return { exp: f.exp, left: f.left, pipe: f.pipe.length, more: f.more }; }, oj.id);
  ok(fc.exp >= 0 && fc.exp <= fc.pipe && (fc.exp >= fc.left || fc.more > 0), 'forecast: expected hires never exceed the pipeline, and a gap asks for more candidates');
  const rd = await fresh.evaluate(() => S.jobs.filter((j) => j.status === 'פתוחה').flatMap((j) => rediscover(j).map((r) => ({ j: j.id, c: r.c.id, why: r.why, sal: r.c.salary, cap: j.budget[1], reason: r.c.rejectReason }))));
  ok(rd.length >= 1 && rd.every((r) => r.reason !== 'ציפיות שכר' || r.sal <= r.cap), 'rediscovery: rejected-on-salary candidates come back only when the new budget covers them');
  await fresh.click(`[data-act=openJob][data-id=${rd[0].j}]`).catch(async () => { await go(fresh, 'jobs'); await fresh.click(`tr[data-id=${rd[0].j}]`); }); await fresh.waitForSelector('.drawer');
  ok(/צפי איוש/.test(await fresh.locator('.drawer').innerText()) && /אפשר להחזיר/.test(await fresh.locator('.drawer').innerText()), 'job file shows the forecast and who can be brought back');
  await fresh.click(`.drawer [data-act=revive][data-id=${rd[0].c}]`); await fresh.waitForTimeout(250);
  const rv = (await S(fresh)).cands.find((x) => x.id === rd[0].c); ok(rv.stage === 'סינון טלפוני' && rv.jobId === rd[0].j && !rv.rejectReason, 'revived candidate is back in the process for that job');
  await fresh.click('.drawer [data-act=close]'); await fresh.evaluate((id) => { A.ui.open = { t: 'cand', id }; render(); }, rv.id); await fresh.waitForSelector('#vf-s');
  const sk = await fresh.locator('#vf-s option').nth(1).getAttribute('value') || await fresh.locator('#vf-s option').nth(1).innerText();
  await fresh.selectOption('#vf-s', { index: 1 }); await fresh.fill('#vf-n', '85'); await fresh.click('[data-act=verify]'); await fresh.waitForTimeout(250);
  const vv = (await S(fresh)).cands.find((x) => x.id === rv.id); ok(vv.verified[sk] && vv.verified[sk].score === 85 && await fresh.evaluate(([id, s2]) => isVerified(S.cands.find((x) => x.id === id), s2), [rv.id, sk]), 'practical test score 85 marks the skill as verified');
  await fresh.selectOption('#vf-s', { index: 1 }); await fresh.fill('#vf-n', '40'); await fresh.click('[data-act=verify]'); await fresh.waitForTimeout(250);
  ok(!(await fresh.evaluate(([id, s2]) => isVerified(S.cands.find((x) => x.id === id), s2), [rv.id, sk])), 'a score under the threshold does not verify the skill');
  ok(/מאומתים/.test(await fresh.locator('.drawer').innerText()), 'job match shows declared vs verified skills');
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  console.log(bad ? `\n${bad} FAILED` : '\nALL PASSED'); await b.close(); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('FAIL', e.message.split('\n').slice(0, 3).join(' | ')); process.exit(1); });
