(async function boot() {
  try {
    A.cfg = await (await fetch('/api/config')).json();
    await refresh();
    const saved = localStorage.getItem('mil-user');
    A.me = A.cfg.users.find((u) => u.id === saved) || null;
    if (A.me) { connectSSE(); if (!route()) go(homeFor()); }
    render();
  } catch (e) { $('#app').innerHTML = '<p style="padding:40px">שגיאה בטעינה: ' + esc(e.message) + '</p>'; }
})();
