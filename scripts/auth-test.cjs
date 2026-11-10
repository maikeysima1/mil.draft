// Auth tests against a server started with AUTH=1 ADMIN_PASSWORD=<pw>. Usage: node scripts/auth-test.cjs <baseUrl> <adminPassword>
const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, ''), ADMIN_PW = process.argv[3];
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
class Client {
  constructor() { this.cookie = ''; }
  async call(method, path, body, extra) {
    const r = await fetch(BASE + path, { method, headers: Object.assign({ 'Content-Type': 'application/json', 'X-Requested-With': 'mil-draft', Cookie: this.cookie }, extra || {}), body: method === 'POST' ? JSON.stringify(body || {}) : undefined });
    const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : []; if (sc.length) this.cookie = sc[0].split(';')[0].endsWith('=') ? '' : sc[0].split(';')[0];
    return { status: r.status, json: await r.json().catch(() => ({})), headers: r.headers };
  }
  login(id, password) { return this.call('POST', '/api/login', { id, password }); }
}
(async () => {
  const anon = new Client();
  ok((await anon.call('GET', '/api/state', null, { 'X-User': 'a1' })).status === 401, 'X-User header alone does not authenticate (GET)');
  ok((await anon.call('POST', '/api/factory-reset', {}, { 'X-User': 'a1' })).status === 401, 'X-User header alone does not authenticate (POST)');
  const noHdr = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); ok(noHdr.status === 403, 'POST without the X-Requested-With header is rejected (CSRF)');
  const h = (await fetch(BASE + '/')).headers; ok(/default-src 'self'/.test(h.get('content-security-policy') || '') && h.get('x-frame-options') === 'DENY' && h.get('x-content-type-options') === 'nosniff', 'security headers (CSP, X-Frame-Options, nosniff)');
  // admin login
  const adm = new Client(); let r = await adm.login('a1', 'wrong-password-1'); ok(r.status === 401 && r.json.error === 'פרטי הכניסה שגויים', 'wrong password -> generic 401');
  r = await adm.login('nobody', 'whatever12345'); ok(r.status === 401 && r.json.error === 'פרטי הכניסה שגויים', 'unknown user -> same generic 401');
  r = await adm.login('a1', ADMIN_PW); ok(r.status === 200 && !r.json.mustChange && adm.cookie.startsWith('mil_session='), 'admin logs in, session cookie set');
  ok((await adm.call('GET', '/api/state')).status === 200, 'session cookie authenticates');
  const ck = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'mil-draft' }, body: JSON.stringify({ id: 'a1', password: ADMIN_PW }) }); const sc = ck.headers.getSetCookie()[0];
  ok(/HttpOnly/.test(sc) && /SameSite=Strict/.test(sc), 'cookie is HttpOnly + SameSite=Strict');
  const forged = new Client(); forged.cookie = 'mil_session=' + adm.cookie.split('=')[1].replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')); ok((await forged.call('GET', '/api/state')).status === 401, 'tampered session token rejected');
  // reset -> temp password -> forced change
  r = await adm.call('POST', '/api/admin/reset-password', { id: 'u1' }); const tmp = r.json.password; ok(r.status === 200 && tmp && tmp.length >= 12, 'admin issues a temporary password');
  const u1 = new Client(); r = await u1.login('u1', tmp); ok(r.status === 200 && r.json.mustChange === true, 'temporary password forces a change');
  ok((await u1.call('GET', '/api/state')).status === 403, 'state blocked until the password is changed');
  ok((await u1.call('POST', '/api/pick', { corps: 'combat', id: 'C-2101' })).status === 403, 'actions blocked until the password is changed');
  r = await u1.call('POST', '/api/change-password', { old: tmp, next: 'short1' }); ok(r.status === 400, 'weak password rejected (' + r.json.error + ')');
  r = await u1.call('POST', '/api/change-password', { old: 'not-the-old-one1', next: 'GoodPass-2026x' }); ok(r.status === 400, 'wrong current password rejected');
  r = await u1.call('POST', '/api/change-password', { old: tmp, next: 'GoodPass-2026x' }); ok(r.status === 200, 'password changed');
  ok((await u1.call('GET', '/api/state')).status === 200, 'state available after the change');
  ok((await u1.call('GET', '/api/admin/users')).status === 403 && (await u1.call('GET', '/api/admin/audit')).status === 403, 'שלישות cannot read the user list or the security log');
  ok((await u1.call('POST', '/api/admin/reset-password', { id: 'a1' })).status === 403, 'שלישות cannot reset passwords');
  ok((await u1.call('POST', '/api/settings', { corps: 'combat', rounds: 2 })).status >= 400, 'role permissions still enforced server-side');
  // reset revokes sessions
  await adm.call('POST', '/api/admin/reset-password', { id: 'u1' }); ok((await u1.call('GET', '/api/state')).status === 401, 'an admin reset revokes the user\'s existing session');
  // logout
  await adm.call('POST', '/api/logout', {}); ok((await adm.call('GET', '/api/state')).status === 401, 'logout clears the session');
  // lockout
  const lk = new Client(); let last; for (let i = 0; i < 5; i++) last = await lk.login('u2', 'x'.repeat(12)); // u2 has no password record -> never locks (no enumeration)
  ok(last.status === 401, 'unknown credentials never reveal whether the user exists');
  await adm.login('a1', ADMIN_PW); const t2 = (await adm.call('POST', '/api/admin/reset-password', { id: 'u2' })).json.password;
  for (let i = 0; i < 5; i++) last = await lk.login('u2', 'wrong-pass-' + i + 'zz'); r = await lk.login('u2', t2);
  ok(r.status === 423, 'account locks after 5 failed attempts (even with the right password) -> ' + r.status);
  const au = (await adm.call('GET', '/api/admin/audit')).json.events; ok(au.some((e) => e.ev === 'login' && !e.ok) && au.some((e) => e.ev === 'login' && e.ok) && au.some((e) => e.ev === 'admin-reset-password'), 'security log records failed/successful logins and admin resets');
  // rate limit (last: it locks this IP out for 10 minutes)
  let st = 0; for (let i = 0; i < 25 && st !== 429; i++) st = (await new Client().login('u3', 'nope-nope-1234')).status; ok(st === 429, 'login rate limit per IP -> 429');
  console.log(bad ? `\n${bad} FAILED` : '\nALL AUTH TESTS PASSED'); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
