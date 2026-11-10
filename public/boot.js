(async function boot() {
  try {
    const ping = await (await fetch('/api/ping')).json();
    if (ping.needCode && !localStorage.getItem('mil-code')) {
      $('#app').innerHTML = '<div style="max-width:380px;margin:12vh auto;display:flex;flex-direction:column;gap:12px;padding:20px"><div class="brand" style="color:var(--navy);font-size:24px">MIL-DRAFT</div><h2 style="margin:0">קוד גישה</h2><input type="text" id="code" placeholder="הקלידו את קוד הגישה" autocomplete="off"><button class="btn" id="codeGo">כניסה</button></div>';
      const go = () => { localStorage.setItem('mil-code', $('#code').value.trim()); location.reload(); };
      $('#codeGo').onclick = go; $('#code').onkeydown = (e) => { if (e.key === 'Enter') go(); };
      return;
    }
    A.auth = !!ping.auth;
    A.cfg = await (await fetch('/api/config', { headers: { 'X-Code': codeVal() } })).json();
    if (A.auth) { // session lives in an HttpOnly cookie: ask the server who we are
      const me = await fetch('/api/me', { headers: HDR() }); const j = me.ok ? await me.json() : null;
      A.me = j ? Object.assign({}, A.cfg.users.find((u) => u.id === j.id), { mustChange: j.mustChange }) : null;
    } else { const saved = localStorage.getItem('mil-user'); A.me = A.cfg.users.find((u) => u.id === saved) || null; }
    if (A.me && !A.me.mustChange) await refresh(); else A.S = A.S || { corps: {}, log: [], serverNow: Date.now() };
    if (A.me && !A.me.mustChange) { connectSSE(); if (!route()) go(homeFor()); }
    render();
  } catch (e) { $('#app').innerHTML = '<div style="padding:40px;max-width:420px;margin:0 auto"><h2>' + (navigator.onLine === false ? 'אין חיבור לאינטרנט' : 'שגיאה בטעינה') + '</h2><p class="mut">' + (navigator.onLine === false ? 'האפליקציה צריכה חיבור לשרת. בדקו את החיבור ורעננו את הדף.' : esc(e.message)) + '</p><button class="btn" data-act="reload">נסו שוב</button></div>'; }
})();
