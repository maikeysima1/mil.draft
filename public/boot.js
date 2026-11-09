(async function boot() {
  try {
    const ping = await (await fetch('/api/ping')).json();
    if (ping.needCode && !localStorage.getItem('mil-code')) {
      $('#app').innerHTML = '<div style="max-width:380px;margin:12vh auto;display:flex;flex-direction:column;gap:12px;padding:20px"><div class="brand" style="color:var(--navy);font-size:24px">MIL-DRAFT</div><h2 style="margin:0">קוד גישה</h2><input type="text" id="code" placeholder="הקלידו את קוד הגישה" autocomplete="off"><button class="btn" id="codeGo">כניסה</button></div>';
      const go = () => { localStorage.setItem('mil-code', $('#code').value.trim()); location.reload(); };
      $('#codeGo').onclick = go; $('#code').onkeydown = (e) => { if (e.key === 'Enter') go(); };
      return;
    }
    A.cfg = await (await fetch('/api/config', { headers: { 'X-Code': codeVal() } })).json();
    await refresh();
    const saved = localStorage.getItem('mil-user');
    A.me = A.cfg.users.find((u) => u.id === saved) || null;
    if (A.me) { connectSSE(); if (!route()) go(homeFor()); }
    render();
  } catch (e) { $('#app').innerHTML = '<p style="padding:40px">שגיאה בטעינה: ' + esc(e.message) + '</p>'; }
})();
