// CyberHire (experiment): leads + candidates for cyber-security recruiting. Client-only demo: all data is fictional and lives in this browser.
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KEY = 'cyberhire-v3', DAY = 86400e3;
const T = {
  leadStages: ['ליד חדש', 'נוצר קשר', 'פגישת אפיון', 'הצעה נשלחה', 'משא ומתן', 'נסגר – לקוח', 'אבוד'],
  candStages: ['מקור', 'סינון טלפוני', 'ראיון טכני', 'מטלה מעשית', 'ראיון מנהל', 'הצעה', 'התקבל/ה', 'נדחה', 'פרש/ה'],
  families: ['SOC וניטור', 'תגובה לאירועים (DFIR)', 'בדיקות חדירה / Red Team', 'אבטחת ענן', 'AppSec / DevSecOps', 'GRC וציות', 'ארכיטקטורת אבטחה', 'מודיעין איומים', 'אבטחת AI'],
  levels: ['Junior', 'Mid', 'Senior', 'Lead'],
  skills: { 'SOC וניטור': ['SIEM', 'EDR', 'Threat Hunting', 'Python'], 'תגובה לאירועים (DFIR)': ['Incident Response', 'Forensics', 'Malware Analysis', 'EDR'], 'בדיקות חדירה / Red Team': ['Web Pentest', 'Active Directory', 'Reverse Engineering', 'Python'], 'אבטחת ענן': ['AWS', 'Azure', 'Kubernetes', 'IAM', 'Terraform'], 'AppSec / DevSecOps': ['Secure Code Review', 'CI/CD Security', 'Kubernetes', 'Python'], 'GRC וציות': ['ISO 27001', 'SOC 2', 'Risk Assessment', 'Privacy'], 'ארכיטקטורת אבטחה': ['Zero Trust', 'IAM', 'Network Security', 'AWS'], 'מודיעין איומים': ['OSINT', 'Threat Hunting', 'Malware Analysis', 'Python'], 'אבטחת AI': ['LLM Security', 'Python', 'Threat Modeling', 'AWS'] },
  certs: ['Security+', 'CEH', 'OSCP', 'CISSP', 'CISM', 'GCIH', 'AWS Security', 'CCSP', 'ISO 27001 LA'],
  sectors: ['פינטק', 'בריאות דיגיטלית', 'SaaS', 'תשתיות קריטיות', 'דיפנס-טק', 'קמעונאות מקוונת'],
  leadSources: ['הפניה מלקוח', 'LinkedIn', 'כנס מקצועי', 'פנייה מהאתר', 'פנייה יזומה'],
  candSources: ['LinkedIn', 'חבר מביא חבר', 'פנייה מהאתר', 'קהילה מקצועית', 'מאגר קיים'],
  lost: ['תקציב', 'גייסו לבד', 'בחרו ספק אחר', 'המשרה בוטלה', 'אין מענה'],
  reject: ['פער בכישורים', 'ציפיות שכר', 'חוסר ניסיון', 'התאמה לצוות', 'קיבל/ה הצעה אחרת', 'אין מענה'],
  budget: { Junior: [18, 26], Mid: [28, 40], Senior: [40, 58], Lead: [55, 75] }, // thousand ILS / month – illustrative only
  stuck: { lead: 10, cand: 7 }, // days in one stage before an item is flagged
  // stage-to-hire assumptions used by the forecast UNTIL there is enough own history (minHist decided candidates); then the system uses its own data
  passDefault: { 'מקור': 0.5, 'סינון טלפוני': 0.6, 'ראיון טכני': 0.5, 'מטלה מעשית': 0.6, 'ראיון מנהל': 0.7, 'הצעה': 0.75 }, minHist: 30,
  verifyPass: 70, // practical test score that counts as a verified skill
};
const USERS = [{ id: 'm1', name: 'דנה', title: 'מנהלת גיוס', role: 'מנהל/ת גיוס' }, { id: 'r1', name: 'יואב', title: 'מגייס', role: 'מגייס/ת' }, { id: 'r2', name: 'מאיה', title: 'מגייסת', role: 'מגייס/ת' }, { id: 's1', name: 'עומר', title: 'מנהל לקוחות', role: 'מכירות' }];
const PERM = { 'מנהל/ת גיוס': { leads: true, cands: true, salary: true, admin: true }, 'מגייס/ת': { leads: false, cands: true, salary: true }, 'מכירות': { leads: true, cands: false, salary: false } };
const A = { me: null, ui: {} };
const can = (p) => !!A.me && !!PERM[A.me.role][p];
const uName = (id) => (USERS.find((u) => u.id === id) || {}).name || '—';
const now = () => Date.now();
const daysIn = (x) => Math.floor((now() - x.stageTs) / DAY);
const fmtD = (ts) => new Date(ts).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
const isoD = (ts) => new Date(ts - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const money = (k) => (k == null ? '—' : '₪' + (k * 1000).toLocaleString('he-IL'));
const leadOpen = (l) => !['נסגר – לקוח', 'אבוד'].includes(l.stage);
const candOpen = (c) => !['התקבל/ה', 'נדחה', 'פרש/ה'].includes(c.stage);
const jobOpen = (j) => j.status === 'פתוחה';

// ---------- demo data (deterministic, fictional) ----------
function seed() {
  let s = 42; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }, pick = (a) => a[Math.floor(rnd() * a.length)], n0 = now();
  const companies = ['נובה פיננסים', 'אורביט הלת׳', 'סקיילאב', 'טרה אנרגיה', 'מגן מערכות', 'קלאודיקס', 'פינגו פיי', 'בריאות פלוס', 'דאטה־ריבר', 'אקווה תשתיות', 'לוגיסטיקה 360', 'אינסייט AI', 'שילד־טק', 'מרקט־ליין'];
  const contacts = ['רונית כהן', 'אבי לוי', 'שרון מזרחי', 'גיל פרץ', 'תמר ביטון', 'אורן דהן', 'נטע אברהם', 'עידן פרידמן', 'הילה אזולאי', 'דור שפירא', 'ליאת גבאי', 'אסף רוזן', 'מיכל חדד', 'יניב קורן'];
  const names = ['איתמר ל.', 'נועה ר.', 'עידו מ.', 'שירה ש.', 'נדב ד.', 'מאיה כ.', 'רועי ב.', 'תמר ג.', 'אדם פ.', 'יעל ש.', 'הראל ק.', 'עדי ד.', 'עילאי מ.', 'שקד ב.', 'בן א.', 'גיא ה.', 'מתן ק.', 'שי ר.', 'ליאם ו.', 'עמית צ.', 'יואב מ.', 'אלעד ח.', 'רוני ל.', 'איתי ר.', 'דנה מ.', 'עומר ש.', 'מיכל ד.', 'דניאל כ.', 'אור נ.', 'טל ב.', 'ניר ס.', 'קרן א.', 'אלון ג.', 'ליה פ.', 'יונתן ז.', 'הדס ר.', 'עוז ט.', 'שני ו.', 'אביב ח.', 'נטע י.'];
  const famW = [0, 1, 2, 3, 3, 4, 5, 6, 7, 8, 8, 3, 0, 2]; // more cloud + AI security demand, as the market research suggests
  const leads = companies.map((company, i) => {
    const fam = T.families[famW[i]], lvl = T.levels[1 + (i % 3)], stage = T.leadStages[[0, 1, 2, 3, 4, 5, 5, 6, 1, 2, 5, 0, 3, 5][i]], created = n0 - (8 + Math.floor(rnd() * 60)) * DAY;
    const l = { id: 'L' + (101 + i), company, sector: T.sectors[i % T.sectors.length], contact: contacts[i], need: fam, level: lvl, headcount: 1 + (i % 3 === 0 ? 1 : 0), clearance: T.sectors[i % T.sectors.length] === 'דיפנס-טק' || i % 7 === 3, budget: T.budget[lvl].slice(), source: pick(T.leadSources), owner: i % 4 === 0 ? 'm1' : 's1', stage, createdTs: created, stageTs: n0 - Math.floor(rnd() * 16) * DAY, next: null, notes: [{ ts: created, by: 's1', text: 'ליד נכנס: צורך ב' + fam + ' ברמת ' + lvl + '.' }] };
    if (leadOpen(l)) l.next = { date: isoD(n0 + (Math.floor(rnd() * 9) - 1) * DAY), text: pick(['שיחת המשך', 'שליחת הצעה', 'תיאום פגישת אפיון', 'בדיקת סטטוס מול הרכש']) };
    if (stage === 'אבוד') l.lostReason = pick(T.lost);
    return l;
  });
  const jobs = []; leads.filter((l) => l.stage === 'נסגר – לקוח').forEach((l, i) => jobs.push(jobFromLead(l, 'J' + (201 + i), n0 - (6 + Math.floor(rnd() * 70)) * DAY)));
  if (jobs[3]) { jobs[3].status = 'אוישה'; jobs[3].filled = jobs[3].headcount; }
  const openJobs = jobs.filter(jobOpen);
  const cands = names.map((name, i) => {
    const fam = T.families[(famW[i % famW.length] + (i % 5 === 0 ? 1 : 0)) % T.families.length], li = Math.min(3, Math.floor(rnd() * 4)), lvl = T.levels[li], sk = T.skills[fam].filter(() => rnd() > 0.3);
    const stage = T.candStages[[0, 0, 1, 1, 2, 2, 3, 4, 5, 6, 7, 7, 8, 0, 1, 2, 3, 7, 2, 1][i % 20]], created = n0 - (4 + Math.floor(rnd() * 50)) * DAY, b = T.budget[lvl];
    const c = { id: 'C' + (301 + i), name, family: fam, level: lvl, years: [1, 3, 6, 10][li] + Math.floor(rnd() * 3), skills: sk.length ? sk : [T.skills[fam][0]], certs: T.certs.filter((x, j) => (j + i) % 5 === 0 || (li >= 2 && x === 'CISSP' && rnd() > 0.5) || (li === 0 && x === 'Security+' && rnd() > 0.4)), clearance: i % 4 === 1, salary: Math.round(b[0] + (b[1] - b[0]) * (0.3 + rnd() * 0.9)), notice: pick([0, 30, 30, 60, 90]), location: pick(['מרכז', 'מרכז', 'שרון', 'צפון', 'דרום', 'מרחוק']), source: pick(T.candSources), owner: i % 2 ? 'r1' : 'r2', stage, jobId: null, createdTs: created, stageTs: n0 - Math.floor(rnd() * 13) * DAY, next: null, notes: [{ ts: created, by: i % 2 ? 'r1' : 'r2', text: 'נכנס/ה למאגר.' }] };
    const fit = openJobs.filter((j) => j.family === fam); if (stage !== 'מקור' && fit.length) c.jobId = fit[i % fit.length].id; // only attached to a job in the candidate's own field
    if (candOpen(c)) c.next = { date: isoD(n0 + (Math.floor(rnd() * 8) - 1) * DAY), text: pick(['תיאום ראיון', 'שליחת מטלה', 'קבלת משוב מהלקוח', 'שיחת שכר', 'בדיקת ממליצים']) };
    if (stage === 'נדחה' || stage === 'פרש/ה') c.rejectReason = pick(T.reject);
    c.verified = {}; if (T.candStages.indexOf(stage) >= 3 || (stage === 'נדחה' && rnd() > 0.5)) c.skills.slice(0, 2).forEach((sk2) => { c.verified[sk2] = { score: Math.round(55 + rnd() * 43), ts: created + 5 * DAY, by: c.owner }; });
    c.hist = [{ stage: 'מקור', ts: created }]; if (stage !== 'מקור') c.hist.push({ stage, ts: c.stageTs });
    return c;
  });
  // demo: three past candidates in the field of open jobs, so "bring back" has something real to show
  [[10, 0, 'ציפיות שכר', 40], [17, 1, 'ציפיות שכר', 35], [11, 2, 'קיבל/ה הצעה אחרת', 150]].forEach(([ci, ji, why, ago]) => {
    const c = cands[ci], j = openJobs[ji % openJobs.length]; if (!c || !j) return;
    c.family = j.family; c.level = j.level; c.skills = T.skills[j.family].slice(0, 3); c.stage = why === 'ציפיות שכר' ? 'נדחה' : 'פרש/ה'; c.jobId = null; c.next = null;
    c.rejectReason = why; c.rejectTs = n0 - ago * DAY; c.salary = Math.round((j.budget[0] + j.budget[1] * 2) / 3);
    c.notes.push({ ts: c.rejectTs, by: c.owner, text: (why === 'ציפיות שכר' ? 'נדחה/תה: ציפיות שכר גבוהות מהתקציב של משרה קודמת.' : 'פרש/ה: קיבל/ה הצעה אחרת.') });
  });
  // demo: military background for part of the pool (generic tracks only – never classified details)
  const tracks = Object.keys(MIL.tracks);
  cands.forEach((c, i) => { if (i % 3 === 2) return; const tr = MIL.tracks[tracks[(i * 7) % tracks.length]], r = tr.roles[i % tr.roles.length]; c.mil = { unit: tr.unit, role: r.name, years: [2, 3, 3, 4, 5, 6][i % 6], end: new Date(n0).getFullYear() - (i % 7) }; });
  return { v: 3, leads, jobs, cands, log: [] };
}
function jobFromLead(l, id, ts) { return { id, leadId: l.id, company: l.company, title: l.need + ' · ' + l.level, family: l.need, level: l.level, skills: T.skills[l.need].slice(0, 3), certs: l.level === 'Junior' ? ['Security+'] : (l.need === 'GRC וציות' ? ['CISM', 'ISO 27001 LA'] : (l.need === 'בדיקות חדירה / Red Team' ? ['OSCP'] : (l.need === 'אבטחת ענן' ? ['AWS Security', 'CCSP'] : ['CISSP']))), clearance: l.clearance, budget: l.budget.slice(), headcount: l.headcount, filled: 0, status: 'פתוחה', openTs: ts || now() }; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } };
const logAct = (text) => { S.log.unshift({ ts: now(), by: A.me ? A.me.id : '', text }); if (S.log.length > 300) S.log.pop(); };
const note = (x, text) => x.notes.push({ ts: now(), by: A.me.id, text });
const setStage = (x, stage) => { x.stage = stage; x.stageTs = now(); if (x.hist) x.hist.push({ stage, ts: x.stageTs }); };

// ---------- matching: transparent rules, no hidden score. The recruiter decides. ----------
function match(j, c) {
  const need = j.skills, have = need.filter((x) => c.skills.includes(x)), ver = have.filter((x) => isVerified(c, x));
  const items = [{ l: 'תחום', ok: c.family === j.family, t: c.family }, { l: 'בכירות', ok: T.levels.indexOf(c.level) >= T.levels.indexOf(j.level), t: c.level + ' מול ' + j.level }, { l: 'כישורים', ok: have.length >= Math.ceil(need.length / 2), t: have.length + ' מתוך ' + need.length + (have.length ? ' (' + have.join(', ') + ')' : '') + ' · מאומתים ' + ver.length }];
  if (j.certs.length) items.push({ l: 'תעודה', ok: j.certs.some((x) => c.certs.includes(x)), t: j.certs.filter((x) => c.certs.includes(x)).join(', ') || 'אין מהנדרשות' });
  if (j.clearance) items.push({ l: 'סיווג ביטחוני', ok: !!c.clearance, t: c.clearance ? 'יש' : 'אין' });
  items.push({ l: 'שכר', ok: c.salary <= j.budget[1], t: money(c.salary) + ' מול תקרה ' + money(j.budget[1]) });
  return { met: items.filter((i) => i.ok).length, total: items.length, items, ver: ver.length, need: need.length };
}
const matchChips = (m, salary) => m.items.filter((i) => salary || i.l !== 'שכר').map((i) => `<span class="pill ${i.ok ? 'p-green' : 'p-orange'}" title="${esc(i.t)}">${i.ok ? '✓' : '✗'} ${esc(i.l)}</span>`).join(' ') + (m.need ? ` <span class="pill ${m.ver ? 'p-blue' : 'p-gray'}" title="כישורים שעברו מטלה מעשית">🛡 ${m.ver}/${m.need} מאומתים</span>` : '');

// ---------- military service -> civilian cyber skills ----------
// Built from GENERAL PUBLIC knowledge about what these tracks usually involve. It is a starting hypothesis for the recruiter, never a fact about a
// person: every inferred skill is marked "משוער" until a practical test verifies it. Never ask for or record classified details.
const MIL = {
  tracks: {
    intel_tech: { unit: 'יחידת מודיעין טכנולוגי (כגון 8200)', roles: [
      { name: 'מפתח/ת תוכנה', fam: ['AppSec / DevSecOps', 'אבטחת AI'], sk: [['Python', 'סביר'], ['Secure Code Review', 'אפשרי'], ['CI/CD Security', 'אפשרי'], ['LLM Security', 'אפשרי']], soft: ['עבודה בצוותי פיתוח קטנים', 'עבודה מול לוחות זמנים מבצעיים'] },
      { name: 'חוקר/ת חולשות / סייבר', fam: ['בדיקות חדירה / Red Team', 'מודיעין איומים'], sk: [['Reverse Engineering', 'סביר'], ['Malware Analysis', 'סביר'], ['Python', 'סביר'], ['Web Pentest', 'אפשרי']], soft: ['מחקר עצמאי', 'תיעוד ממצאים'] },
      { name: 'מנתח/ת מודיעין טכנולוגי', fam: ['מודיעין איומים', 'SOC וניטור'], sk: [['OSINT', 'סביר'], ['Threat Hunting', 'אפשרי'], ['Python', 'אפשרי']], soft: ['כתיבה ותחקיר', 'הצגה לדרג מקבל החלטות'] },
      { name: 'איש/אשת תשתיות ורשתות', fam: ['ארכיטקטורת אבטחה', 'אבטחת ענן'], sk: [['Network Security', 'סביר'], ['IAM', 'אפשרי'], ['AWS', 'אפשרי']], soft: ['אחריות על מערכות קריטיות'] },
    ] },
    cyber_def: { unit: 'חטיבת ההגנה בסייבר (אגף התקשוב)', roles: [
      { name: 'מגן/ת סייבר / אנליסט/ית SOC', fam: ['SOC וניטור', 'תגובה לאירועים (DFIR)'], sk: [['SIEM', 'סביר'], ['EDR', 'סביר'], ['Threat Hunting', 'אפשרי'], ['Incident Response', 'אפשרי']], soft: ['עבודה במשמרות', 'קבלת החלטות תחת לחץ'] },
      { name: 'מגיב/ה לאירועים', fam: ['תגובה לאירועים (DFIR)', 'מודיעין איומים'], sk: [['Incident Response', 'סביר'], ['Forensics', 'סביר'], ['Malware Analysis', 'אפשרי']], soft: ['ניהול אירוע', 'תחקיר'] },
      { name: 'בודק/ת חדירות (צוות אדום)', fam: ['בדיקות חדירה / Red Team'], sk: [['Web Pentest', 'סביר'], ['Active Directory', 'סביר'], ['Python', 'אפשרי']], soft: ['חשיבה התקפית', 'כתיבת דוחות'] },
    ] },
    cto: { unit: 'יחידת מחשוב (כגון ממר״ם / לוטם)', roles: [
      { name: 'מפתח/ת מערכות', fam: ['AppSec / DevSecOps'], sk: [['Python', 'סביר'], ['CI/CD Security', 'אפשרי'], ['Kubernetes', 'אפשרי']], soft: ['פיתוח במערכות גדולות'] },
      { name: 'DevOps / תשתיות ענן', fam: ['אבטחת ענן', 'AppSec / DevSecOps'], sk: [['Kubernetes', 'סביר'], ['Terraform', 'אפשרי'], ['AWS', 'אפשרי'], ['IAM', 'אפשרי']], soft: ['זמינות ותפעול 24/7'] },
    ] },
    af_tech: { unit: 'יחידה טכנולוגית בחיל האוויר', roles: [
      { name: 'מפתח/ת תוכנה', fam: ['AppSec / DevSecOps', 'אבטחת AI'], sk: [['Python', 'סביר'], ['Secure Code Review', 'אפשרי']], soft: ['פיתוח למערכות מבצעיות'] },
    ] },
    gov: { unit: 'תפקיד מטה / אבטחת מידע', roles: [
      { name: 'קצין/ת אבטחת מידע', fam: ['GRC וציות'], sk: [['Risk Assessment', 'סביר'], ['ISO 27001', 'אפשרי'], ['Privacy', 'אפשרי']], soft: ['עבודה מול נהלים ורגולציה', 'הדרכה'] },
    ] },
    combat: { unit: 'יחידה קרבית', roles: [
      { name: 'לוחם/ת / מפקד/ת', fam: [], sk: [], soft: ['פיקוד והובלת צוות', 'עבודה תחת לחץ', 'אחריות'] },
    ] },
  },
  conf: { 'סביר': 'p-blue', 'אפשרי': 'p-gray' },
};
const milRole = (m) => { if (!m) return null; const tr = Object.values(MIL.tracks).find((t) => t.unit === m.unit); return tr ? tr.roles.find((r) => r.name === m.role) || null : null; };
// the translation: inferred skills (never counted as declared/verified), likely fields, how to verify, what to ask without touching classified content
function translate(m) {
  const r = milRole(m); if (!r) return null;
  const lvl = m.years >= 5 ? 'Senior' : (m.years >= 3 ? 'Mid' : 'Junior');
  const verify = r.sk.map(([k]) => k).slice(0, 3);
  const ask = ['ספר/י על בעיה טכנית קשה שפתרת – בלי פרטים מסווגים: מה הייתה הבעיה, מה ניסית, מה עבד.', 'באילו כלים ושפות עבדת ביום-יום? (שמות כלים מסחריים או פתוחים)', 'מה גודל הצוות, ומה היה התפקיד שלך בו?'].concat(r.fam.length ? ['איך היית ניגש/ת היום ל' + r.fam[0] + ' בארגון אזרחי?'] : ['למה סייבר, ומה עשית כדי ללמוד את התחום?']);
  return { r, lvl, fam: r.fam, sk: r.sk, soft: r.soft, verify, ask, note: m.years >= 5 ? 'שירות ארוך – ייתכן ניסיון בהובלת צוות או פרויקט.' : (m.years <= 2 ? 'שירות קצר – לרוב שירות סדיר בלבד; להתייחס כ-Junior עד שיוכח אחרת.' : '') };
}
// open jobs this background could fit (field + level), with which inferred skills cover the job
function milJobs(m) {
  const t = translate(m); if (!t || !t.fam.length) return [];
  return S.jobs.filter((j) => jobOpen(j) && t.fam.includes(j.family)).map((j) => ({ j, cover: j.skills.filter((sk) => t.sk.some(([k]) => k === sk)), lvlOk: T.levels.indexOf(t.lvl) >= T.levels.indexOf(j.level) }));
}
function milCard(c, edit) {
  const m = c.mil, t = translate(m);
  const form = edit ? `<div class="row" style="align-items:flex-end;margin-top:8px"><label>יחידה${sel('id="ml-u" data-chg="mlUnit"', Object.values(MIL.tracks).map((x) => x.unit), (A.ui.mlu != null ? A.ui.mlu : (m && m.unit)) || '', 'ללא / לא ידוע')}</label><label>תפקיד${sel('id="ml-r"', ((Object.values(MIL.tracks).find((x) => x.unit === (A.ui.mlu != null ? A.ui.mlu : (m && m.unit))) || { roles: [] }).roles).map((r) => r.name), m ? m.role : '', 'בחרו…')}</label><label>שנות שירות<input type="number" id="ml-y" min="1" max="30" value="${m ? m.years : ''}" style="width:90px"></label><button class="btn sec sm" data-act="mlSave" data-id="${c.id}">שמירה</button></div>` : '';
  if (!t) return `<div class="card"><h3 class="h3">רקע צבאי</h3><span class="mut">לא הוזן.</span>${form}</div>`;
  const jobs = milJobs(m);
  return `<div class="card"><h3 class="h3">רקע צבאי ← כישורי סייבר</h3><div class="mut small">${esc(m.unit)} · ${esc(m.role)} · ${m.years} שנים${m.end ? ' · סיום ' + m.end : ''}</div>
   <div class="demo-note" style="margin:8px 0">זה תרגום משוער לפי מידע ציבורי כללי על מסלולים כאלה – לא עובדה על האדם. כישור משוער לא נספר בהתאמה עד שמטלה מעשית מאמתת אותו. אין לבקש או לרשום פרטים מסווגים.</div>
   <div><b class="small">כישורים משוערים</b> <span class="row" style="gap:4px;display:inline-flex">${t.sk.map(([k, conf]) => `<span class="pill ${isVerified(c, k) ? 'p-green' : MIL.conf[conf]}" title="${isVerified(c, k) ? 'אומת במטלה' : (c.skills.includes(k) ? 'מוצהר, לא אומת' : 'משוער מהשירות')}">${isVerified(c, k) ? '🛡 ' : ''}${esc(k)} · ${isVerified(c, k) ? 'מאומת' : esc(conf)}</span>`).join('') || '<span class="mut">אין מיפוי טכני ישיר</span>'}</span></div>
   <div style="margin-top:6px"><b class="small">תחומים מתאימים</b> ${t.fam.map((f) => `<span class="pill p-violet">${esc(f)}</span>`).join(' ') || '<span class="mut">לא טכני – מתאים כנקודת כניסה (Junior) עם הכשרה</span>'} <span class="pill p-gray">רמה משוערת: ${t.lvl}</span></div>
   <div style="margin-top:6px"><b class="small">יכולות רכות</b> ${t.soft.map((x) => `<span class="pill p-gray">${esc(x)}</span>`).join(' ')}</div>${t.note ? `<div class="mut small" style="margin-top:4px">${esc(t.note)}</div>` : ''}
   ${t.verify.length ? `<div style="margin-top:8px"><b class="small">תוכנית אימות</b><div class="mut small">מטלה מעשית ב: ${t.verify.map((k) => (isVerified(c, k) ? '✓ ' : '') + esc(k)).join(' · ')}</div></div>` : ''}
   <details style="margin-top:6px"><summary class="small">שאלות לראיון (בלי מידע מסווג)</summary><ul class="small" style="margin:6px 0;padding-inline-start:18px">${t.ask.map((q) => `<li>${esc(q)}</li>`).join('')}</ul></details>
   ${jobs.length ? `<div style="margin-top:8px"><b class="small">משרות פתוחות שהרקע הזה יכול להתאים להן</b>${jobs.map((x) => `<div class="tl row spread"><a href="#" class="clink" data-act="openJob" data-id="${x.j.id}">${esc(x.j.company)} · ${esc(x.j.title)}</a><span class="row" style="gap:4px"><span class="pill p-gray">${x.cover.length}/${x.j.skills.length} כישורים משוערים</span>${x.lvlOk ? '' : '<span class="pill p-orange">רמה נמוכה מהנדרש</span>'}</span></div>`).join('')}</div>` : ''}${form}</div>`;
}

// ---------- the intelligence layer: verified skills, forecast, rediscovery, next actions. Every result shows its reason. ----------
const isVerified = (c, sk) => !!(c.verified && c.verified[sk] && c.verified[sk].score >= T.verifyPass);
const skillPill = (c, sk) => { const v = c.verified && c.verified[sk]; return `<span class="pill ${v ? (v.score >= T.verifyPass ? 'p-green' : 'p-orange') : 'p-blue'}" title="${v ? 'מטלה מעשית: ' + v.score + ' · ' + fmtD(v.ts) : 'מוצהר – לא נבדק'}">${v && v.score >= T.verifyPass ? '🛡 ' : ''}${esc(sk)}${v ? ' ' + v.score : ''}</span>`; };
// pass rate from each stage to the next. Own history once there are enough decided candidates, otherwise the stated defaults.
function passRates() {
  const decided = S.cands.filter((c) => !candOpen(c) && c.hist && c.hist.length > 1);
  if (decided.length < T.minHist) return { src: 'הנחות ברירת מחדל (' + decided.length + ' מתוך ' + T.minHist + ' מועמדים עם היסטוריה)', r: T.passDefault };
  const r = {}, idx = (st) => T.candStages.indexOf(st), top = (c) => Math.max(...c.hist.map((h) => idx(h.stage)).filter((i) => i <= idx('התקבל/ה')));
  Object.keys(T.passDefault).forEach((st) => { const i = idx(st), reached = decided.filter((c) => top(c) >= i), passed = reached.filter((c) => top(c) > i); r[st] = reached.length ? passed.length / reached.length : T.passDefault[st]; });
  return { src: 'הנתונים שלכם (' + decided.length + ' מועמדים)', r };
}
const hireProb = (c, R) => { if (c.stage === 'התקבל/ה') return 1; if (!candOpen(c)) return 0; let p = 1; T.candStages.slice(T.candStages.indexOf(c.stage), T.candStages.indexOf('התקבל/ה')).forEach((st) => { p *= R[st] == null ? 1 : R[st]; }); return p; };
function forecast(j) {
  const P = passRates(), pipe = S.cands.filter((c) => c.jobId === j.id && candOpen(c)), exp = pipe.reduce((a, c) => a + hireProb(c, P.r), 0), left = j.headcount - j.filled;
  const p0 = hireProb({ stage: 'מקור' }, P.r), more = exp >= left ? 0 : Math.ceil((left - exp) / Math.max(p0, 0.01));
  const fam = S.cands.filter((c) => c.family === j.family && T.levels.indexOf(c.level) >= T.levels.indexOf(j.level) && c.salary != null).map((c) => c.salary).sort((a, b) => a - b);
  const med = fam.length >= 3 ? fam[Math.floor(fam.length / 2)] : null, risks = [];
  if (med != null && j.budget[1] < med) risks.push('התקרה (' + money(j.budget[1]) + ') מתחת לחציון ציפיות השכר במאגר לתפקיד כזה (' + money(med) + ', ' + fam.length + ' מועמדים)');
  if (j.clearance) { const n = S.cands.filter((c) => c.family === j.family && c.clearance).length; if (n < 3) risks.push('נדרש סיווג ביטחוני ויש רק ' + n + ' מועמדים עם סיווג בתחום'); }
  const lateDays = Math.floor((now() - j.openTs) / DAY); if (lateDays >= 75) risks.push('המשרה פתוחה ' + lateDays + ' ימים');
  return { pipe, exp, left, more, risks, src: P.src, med, ok: exp >= left * 0.9 };
}
// past candidates whose rejection reason no longer applies to this job
function rediscover(j) {
  return S.cands.filter((c) => !candOpen(c) && c.stage !== 'התקבל/ה' && c.family === j.family && c.jobId !== j.id && T.levels.indexOf(c.level) >= T.levels.indexOf(j.level)).map((c) => {
    const ago = c.rejectTs ? Math.floor((now() - c.rejectTs) / DAY) : null;
    if (c.rejectReason === 'ציפיות שכר' && c.salary != null && c.salary <= j.budget[1]) return { c, why: 'נדחה/תה על ציפיות שכר (' + money(c.salary) + '), והתקרה במשרה הזו ' + money(j.budget[1]) };
    if (c.rejectReason === 'קיבל/ה הצעה אחרת' && ago != null && ago >= 120) return { c, why: 'קיבל/ה הצעה אחרת לפני ' + ago + ' ימים – אולי פתוח/ה שוב' };
    if (c.rejectReason === 'אין מענה' && ago != null && ago >= 60) return { c, why: 'לא ענה/תה לפני ' + ago + ' ימים – שווה ניסיון נוסף' };
    return null;
  }).filter(Boolean);
}
// what to do now, ranked by impact. Each item names its reason and opens the right file.
function nextActions() {
  const out = [], today = isoD(now()), add = (w, t, kind, id, txt, why) => out.push({ w, t, kind, id, txt, why });
  S.cands.filter((c) => c.stage === 'הצעה' && daysIn(c) >= 2).forEach((c) => add(100 + daysIn(c), 'סגירת הצעה', 'openCand', c.id, c.name, 'בשלב הצעה ' + daysIn(c) + ' ימים – בשוק תחרותי מועמדים מקבלים הצעות נוספות'));
  S.jobs.filter(jobOpen).forEach((j) => { const f = forecast(j); if (f.more > 0) add(80 + f.more, 'הזנת המשפך', 'openJob', j.id, j.company + ' · ' + j.title, 'צפי ' + f.exp.toFixed(1) + ' מתוך ' + f.left + ' תקנים – חסרים בערך ' + f.more + ' מועמדים חדשים'); if (f.risks.length && f.risks[0].startsWith('התקרה')) add(70, 'שיחת תקציב עם הלקוח', 'openJob', j.id, j.company, f.risks[0]); rediscover(j).slice(0, 2).forEach((r) => add(60, 'החזרת מועמד/ת', 'openCand', r.c.id, r.c.name + ' ← ' + j.company, r.why)); });
  S.cands.filter((c) => candOpen(c) && ['ראיון טכני', 'מטלה מעשית'].includes(c.stage) && c.jobId).forEach((c) => { const j = S.jobs.find((x) => x.id === c.jobId); const miss = j ? j.skills.filter((sk) => c.skills.includes(sk) && !isVerified(c, sk)) : []; if (miss.length) add(40, 'מטלה מעשית', 'openCand', c.id, c.name, 'כישורים מוצהרים שלא נבדקו: ' + miss.join(', ')); });
  S.leads.concat(S.cands).filter((x) => (x.company ? leadOpen(x) : candOpen(x)) && x.next && x.next.date < today).forEach((x) => add(30, 'משימה באיחור', x.company ? 'openLead' : 'openCand', x.id, x.company || x.name, x.next.text + ' (' + x.next.date.slice(8) + '/' + x.next.date.slice(5, 7) + ')'));
  return out.sort((a, b) => b.w - a.w);
}

let S; try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; } if (!S || S.v !== 3) S = seed();

// ---------- small UI helpers ----------
function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = 'show' + (err ? ' err' : ''); clearTimeout(toast._t); toast._t = setTimeout(() => { t.className = ''; }, 3000); }
const ICONS = { chart: '<path d="M3 3v18h18"/><path d="M7 16v-5"/><path d="M12 16V8"/><path d="M17 16v-9"/>', users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', flag: '<path d="M4 22V4"/><path d="M4 4h13l-2 4 2 4H4"/>', file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>', shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>', out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>', moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>' };
const icon = (n, s) => `<svg class="ic" width="${s || 20}" height="${s || 20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
function avatar(id, size) { // generic illustrated face, drawn from the id (not a photo)
  let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; const p = (a, n) => a[(h >>> n) % a.length];
  const skin = p(['#F6D3B3', '#E8B98F', '#D39B6E', '#B97B4F', '#8D5A3A'], 0), hair = p(['#1B1B1E', '#3A2A1E', '#5B3A21', '#8A5A2B', '#6E6E73'], 3), bg = p(['#DCE7F7', '#E3F1E8', '#FBEBD3', '#EADCF5', '#D9EFF2'], 5);
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="איור להמחשה" style="border-radius:50%;flex:none"><rect width="100" height="100" fill="${bg}"/><path d="M14 100q2-22 36-22t36 22z" fill="#3B4A6B"/><rect x="43" y="66" width="14" height="14" rx="5" fill="${skin}"/><ellipse cx="50" cy="52" rx="19" ry="22" fill="${skin}"/><path d="M31 44q0-23 19-23t19 23q-8-10-19-10t-19 10z" fill="${hair}"/><circle cx="43" cy="53" r="2.4" fill="#222"/><circle cx="57" cy="53" r="2.4" fill="#222"/><path d="M44 66q6 5 12 0" fill="none" stroke="#7A3B2E" stroke-width="2.2" stroke-linecap="round"/></svg>`;
}
const agePill = (x, lim) => { const d = daysIn(x); return `<span class="pill ${d >= lim ? 'p-red' : 'p-gray'}" title="ימים בשלב הנוכחי">${d} ימים בשלב</span>`; };
const nextHtml = (x) => { if (!x.next) return ''; const late = x.next.date < isoD(now()), today = x.next.date === isoD(now()); return `<span class="pill ${late ? 'p-red' : (today ? 'p-orange' : 'p-blue')}">${late ? 'באיחור · ' : (today ? 'היום · ' : '')}${esc(x.next.text)} · ${esc(x.next.date.slice(8) + '/' + x.next.date.slice(5, 7))}</span>`; };
const sel = (attrs, opts, val, ph) => `<select ${attrs}>${ph != null ? `<option value="">${ph}</option>` : ''}${opts.map((o) => `<option ${String(o) === String(val == null ? '' : val) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
const route = () => (location.hash.replace('#/', '') || 'dash');
const PAGES = [{ id: 'dash', name: 'תמונת מצב', icon: 'chart' }, { id: 'mil', name: 'תרגום שירות צבאי', icon: 'shield' }, { id: 'leads', name: 'לידים', icon: 'flag' }, { id: 'jobs', name: 'משרות', icon: 'file' }, { id: 'cands', name: 'מועמדים', icon: 'users' }, { id: 'settings', name: 'יומן והגדרות', icon: 'gear' }];

// ---------- screens ----------
const SCREENS = {};
function funnel(stages, items, cls) { const max = Math.max(1, ...stages.map((s) => items.filter((x) => x.stage === s).length)); return stages.map((s) => { const n = items.filter((x) => x.stage === s).length; return `<div class="frow"><span>${esc(s)}</span><div class="ftrack"><i class="${cls}" style="width:${n / max * 100}%"></i></div><b>${n}</b></div>`; }).join(''); }
SCREENS.dash = () => {
  const L = S.leads, C = S.cands, J = S.jobs.filter(jobOpen), today = isoD(now());
  const stuckL = L.filter((l) => leadOpen(l) && daysIn(l) >= T.stuck.lead), stuckC = C.filter((c) => candOpen(c) && daysIn(c) >= T.stuck.cand);
  const due = L.filter((l) => leadOpen(l) && l.next && l.next.date <= today).map((x) => ({ x, t: 'lead' })).concat(C.filter((c) => candOpen(c) && c.next && c.next.date <= today).map((x) => ({ x, t: 'cand' }))).sort((a, b) => (a.x.next.date < b.x.next.date ? -1 : 1));
  // skills: what open jobs ask for vs. how many active candidates have it (the market's gap is in skills, not in headcount)
  const dem = {}; J.forEach((j) => j.skills.forEach((s) => { dem[s] = (dem[s] || 0) + (j.headcount - j.filled); }));
  const act = C.filter(candOpen), gap = Object.keys(dem).map((s) => ({ s, need: dem[s], have: act.filter((c) => c.skills.includes(s)).length })).sort((a, b) => (a.have / a.need) - (b.have / b.need));
  const srcs = T.candSources.map((s) => ({ s, n: C.filter((c) => c.source === s).length, h: C.filter((c) => c.source === s && c.stage === 'התקבל/ה').length }));
  const kpi = (v, l, sub) => `<div class="kpi"><b>${v}</b><span>${l}</span>${sub ? `<div class="mut small">${sub}</div>` : ''}</div>`;
  return `<div><h1 class="h1">תמונת מצב</h1><div class="mut small">גיוס לתפקידי סייבר: לידים של לקוחות, משרות פתוחות ומועמדים בתהליך · כל הנתונים פיקטיביים</div></div>
   <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${kpi(L.filter(leadOpen).length, 'לידים פתוחים', L.filter((l) => l.stage === 'נסגר – לקוח').length + ' נסגרו כלקוח')}${kpi(J.length, 'משרות פתוחות', J.reduce((a, j) => a + j.headcount - j.filled, 0) + ' תקנים לאיוש')}${kpi(act.length, 'מועמדים בתהליך')}${kpi(C.filter((c) => c.stage === 'הצעה').length, 'בשלב הצעה')}${kpi(C.filter((c) => c.stage === 'התקבל/ה').length, 'התקבלו')}</div>
   <div class="card"><h2>מה לעשות עכשיו</h2><div class="mut small" style="margin-bottom:6px">פעולות מסודרות לפי השפעה: הצעות פתוחות, משרות שהמשפך שלהן לא יספיק, מועמדים שאפשר להחזיר, כישורים לא מאומתים ומשימות באיחור. לכל שורה הסיבה שלה.</div>${nextActions().slice(0, 8).map((a) => `<div class="tl row spread" style="flex-wrap:nowrap;align-items:flex-start"><span><span class="pill p-dark">${esc(a.t)}</span> <a href="#" class="clink" data-act="${a.kind}" data-id="${a.id}">${esc(a.txt)}</a><div class="mut small" style="margin-top:3px">${esc(a.why)}</div></span></span></div>`).join('') || '<span class="mut">אין פעולות דחופות.</span>'}</div>
   <div class="card"><h2>צפי איוש למשרות פתוחות</h2><div class="mut small" style="margin-bottom:6px">לכל מועמד/ת בתהליך: הסיכוי לעבור מהשלב הנוכחי עד קבלה, לפי ${esc(passRates().src)}. הצפי הוא סכום הסיכויים – הערכה, לא הבטחה.</div><div style="overflow:auto"><table><thead><tr><th>משרה</th><th>תקנים</th><th>בתהליך</th><th>צפי איוש</th><th>חסרים בראש המשפך</th><th>סיכונים</th></tr></thead><tbody>${J.map((j) => { const f = forecast(j); return `<tr><td><a href="#" class="clink" data-act="openJob" data-id="${j.id}">${esc(j.company)}</a><div class="mut small">${esc(j.title)}</div></td><td>${f.left}</td><td>${f.pipe.length}</td><td><span class="pill ${f.ok ? 'p-green' : (f.exp >= f.left * 0.5 ? 'p-orange' : 'p-red')}">${f.exp.toFixed(1)}</span></td><td>${f.more || '·'}</td><td class="small">${f.risks.map(esc).join('<br>') || '<span class="mut">—</span>'}</td></tr>`; }).join('') || '<tr><td colspan="6" class="mut">אין משרות פתוחות</td></tr>'}</tbody></table></div></div>
   <div class="grid g2"><div class="card"><h2>משפך לידים</h2>${funnel(T.leadStages, L, 'f1')}</div><div class="card"><h2>משפך מועמדים</h2>${funnel(T.candStages, C, 'f2')}</div></div>
   <div class="grid g2"><div class="card"><h2>לטיפול היום (${due.length})</h2>${due.slice(0, 8).map(({ x, t }) => `<div class="tl row spread"><a href="#" class="clink" data-act="${t === 'lead' ? 'openLead' : 'openCand'}" data-id="${x.id}">${esc(t === 'lead' ? x.company : x.name)}</a><span class="row" style="gap:6px"><span class="pill p-gray">${t === 'lead' ? 'ליד' : 'מועמד/ת'}</span>${nextHtml(x)}</span></div>`).join('') || '<span class="mut">אין משימות פתוחות להיום.</span>'}</div>
    <div class="card"><h2>תקועים בשלב</h2><div class="mut small" style="margin-bottom:6px">ליד ${T.stuck.lead}+ ימים, מועמד/ת ${T.stuck.cand}+ ימים באותו שלב. גיוס בסייבר ארוך ממילא – מה שנתקע בלי סיבה מאבד מועמדים.</div>${stuckL.map((l) => `<div class="tl row spread"><a href="#" class="clink" data-act="openLead" data-id="${l.id}">${esc(l.company)}</a><span class="row" style="gap:6px"><span class="pill p-gray">${esc(l.stage)}</span>${agePill(l, T.stuck.lead)}</span></div>`).concat(stuckC.map((c) => `<div class="tl row spread"><a href="#" class="clink" data-act="openCand" data-id="${c.id}">${esc(c.name)}</a><span class="row" style="gap:6px"><span class="pill p-gray">${esc(c.stage)}</span>${agePill(c, T.stuck.cand)}</span></div>`)).slice(0, 8).join('') || '<span class="mut">אין פריטים תקועים.</span>'}</div></div>
   <div class="grid g2"><div class="card"><h2>פער כישורים: ביקוש מול היצע</h2><div class="mut small" style="margin-bottom:6px">לכל כישור: כמה תקנים פתוחים דורשים אותו, וכמה מועמדים פעילים מחזיקים בו.</div><table><thead><tr><th>כישור</th><th>תקנים דורשים</th><th>מועמדים פעילים</th><th></th></tr></thead><tbody>${gap.slice(0, 8).map((g) => `<tr><td><b>${esc(g.s)}</b></td><td>${g.need}</td><td>${g.have}</td><td>${g.have < g.need ? '<span class="pill p-red">חסר</span>' : (g.have < g.need * 2 ? '<span class="pill p-orange">צפוף</span>' : '<span class="pill p-green">יש היצע</span>')}</td></tr>`).join('') || '<tr><td colspan="4" class="mut">אין משרות פתוחות</td></tr>'}</tbody></table></div>
    <div class="card"><h2>מקורות מועמדים</h2><table><thead><tr><th>מקור</th><th>מועמדים</th><th>התקבלו</th></tr></thead><tbody>${srcs.map((x) => `<tr><td>${esc(x.s)}</td><td>${x.n}</td><td>${x.h || '·'}</td></tr>`).join('')}</tbody></table><div class="mut small" style="margin-top:6px">מספרים קטנים – לא להסיק מהם על איכות המקור.</div></div></div>`;
};
// --- kanban shared by leads and candidates ---
function board(kind, stages, items, cardFn) {
  return `<div class="kan">${stages.map((s) => { const col = items.filter((x) => x.stage === s); return `<div class="kcol" data-drop="${kind}" data-stage="${esc(s)}"><div class="khead"><b>${esc(s)}</b><span class="pill p-gray">${col.length}</span></div>${col.map(cardFn).join('') || '<div class="mut small" style="padding:8px">—</div>'}</div>`; }).join('')}</div>`;
}
const viewTabs = (key) => `<div class="tabs">${[['board', 'לוח'], ['table', 'טבלה']].map(([v, n]) => `<button class="${(A.ui[key] || 'board') === v ? 'on' : ''}" data-act="view" data-k="${key}" data-v="${v}">${n}</button>`).join('')}</div>`;
function leadList() { const f = A.ui.lf || {}, q = (f.q || '').trim().toLowerCase(); return S.leads.filter((l) => (!q || (l.company + ' ' + l.contact + ' ' + l.need).toLowerCase().includes(q)) && (!f.sector || l.sector === f.sector) && (!f.owner || uName(l.owner) === f.owner) && (!f.open || leadOpen(l))); }
SCREENS.leads = () => {
  const f = A.ui.lf || {}, rows = leadList(), edit = can('leads');
  const card = (l) => `<div class="kcard" draggable="${edit}" data-drag="lead" data-id="${l.id}" data-act="openLead"><b>${esc(l.company)}</b><div class="mut small">${esc(l.need)} · ${esc(l.level)} · ${l.headcount} תקנים</div><div class="row" style="gap:4px;margin-top:6px">${leadOpen(l) ? agePill(l, T.stuck.lead) : ''}${l.clearance ? '<span class="pill p-violet">סיווג</span>' : ''}</div><div style="margin-top:4px">${nextHtml(l)}</div></div>`;
  return `<div class="row spread"><div><h1 class="h1">לידים – לקוחות עם צורך בגיוס</h1><div class="mut small">${rows.length} לידים${edit ? ' · אפשר לגרור כרטיס בין שלבים' : ' · צפייה בלבד בתפקיד שלך'}</div></div><div class="row">${viewTabs('lv')}${edit ? '<button class="btn" data-act="newLead">+ ליד חדש</button>' : ''}</div></div>
   <div class="card"><div class="filters"><label>חיפוש<input type="search" id="lf-q" data-inp="lf" data-f="q" value="${esc(f.q || '')}" placeholder="חברה, איש קשר או תחום"></label><label>ענף${sel('data-chg="lf" data-f="sector"', T.sectors, f.sector, 'הכול')}</label><label>אחראי/ת${sel('data-chg="lf" data-f="owner"', USERS.filter((u) => PERM[u.role].leads).map((u) => u.name), f.owner, 'הכול')}</label><label><input type="checkbox" id="lf-open" data-chg="lf" data-f="open" ${f.open ? 'checked' : ''}> פתוחים בלבד</label></div>
   ${(A.ui.lv || 'board') === 'board' ? board('lead', T.leadStages, rows, card) : `<div style="overflow:auto"><table class="ctbl"><thead><tr><th>חברה</th><th>ענף</th><th>צורך</th><th>שלב</th><th>ימים בשלב</th><th>הצעד הבא</th><th>אחראי/ת</th></tr></thead><tbody>${rows.map((l) => `<tr class="clk" data-act="openLead" data-id="${l.id}"><td><b>${esc(l.company)}</b><div class="mut small">${esc(l.contact)}</div></td><td>${esc(l.sector)}</td><td>${esc(l.need)} · ${esc(l.level)}</td><td><span class="pill ${l.stage === 'אבוד' ? 'p-gray' : (l.stage === 'נסגר – לקוח' ? 'p-green' : 'p-blue')}">${esc(l.stage)}</span></td><td>${leadOpen(l) ? daysIn(l) : '—'}</td><td>${nextHtml(l) || '—'}</td><td>${esc(uName(l.owner))}</td></tr>`).join('') || '<tr><td colspan="7" class="mut">אין לידים לפי הסינון</td></tr>'}</tbody></table></div>`}</div>`;
};
function candList() { const f = A.ui.cf || {}, q = (f.q || '').trim().toLowerCase(); return S.cands.filter((c) => (!q || (c.name + ' ' + c.id + ' ' + c.skills.join(' ')).toLowerCase().includes(q)) && (!f.family || c.family === f.family) && (!f.level || c.level === f.level) && (!f.cert || c.certs.includes(f.cert)) && (!f.clr || c.clearance) && (!f.open || candOpen(c))); }
SCREENS.cands = () => {
  const f = A.ui.cf || {}, rows = candList(), edit = can('cands'); A.ui.list = rows.map((c) => c.id);
  const jobOf = (c) => { const j = S.jobs.find((x) => x.id === c.jobId); return j ? `<div class="mut small">${esc(j.company)}</div>` : ''; };
  const card = (c) => `<div class="kcard" draggable="${edit}" data-drag="cand" data-id="${c.id}" data-act="openCand"><div class="row" style="gap:8px;flex-wrap:nowrap">${avatar(c.id, 32)}<span><b>${esc(c.name)}</b><div class="mut small">${esc(c.family)} · ${esc(c.level)}</div></span></div>${jobOf(c)}<div class="row" style="gap:4px;margin-top:6px">${candOpen(c) ? agePill(c, T.stuck.cand) : (c.rejectReason ? `<span class="pill p-gray">${esc(c.rejectReason)}</span>` : '')}</div><div style="margin-top:4px">${nextHtml(c)}</div></div>`;
  return `<div class="row spread"><div><h1 class="h1">מועמדים</h1><div class="mut small">${rows.length} מועמדים${edit ? ' · אפשר לגרור כרטיס בין שלבים' : ' · צפייה בלבד, ללא נתוני שכר'}</div></div><div class="row">${viewTabs('cv')}${edit ? '<button class="btn" data-act="newCand">+ מועמד/ת</button>' : ''}</div></div>
   <div class="card"><div class="filters"><label>חיפוש<input type="search" id="cf-q" data-inp="cf" data-f="q" value="${esc(f.q || '')}" placeholder="שם, מספר או כישור"></label><label>תחום${sel('data-chg="cf" data-f="family"', T.families, f.family, 'הכול')}</label><label>בכירות${sel('data-chg="cf" data-f="level"', T.levels, f.level, 'הכול')}</label><label>תעודה${sel('data-chg="cf" data-f="cert"', T.certs, f.cert, 'הכול')}</label><label><input type="checkbox" id="cf-clr" data-chg="cf" data-f="clr" ${f.clr ? 'checked' : ''}> עם סיווג ביטחוני</label><label><input type="checkbox" id="cf-open" data-chg="cf" data-f="open" ${f.open ? 'checked' : ''}> בתהליך בלבד</label></div>
   ${(A.ui.cv || 'board') === 'board' ? board('cand', T.candStages, rows, card) : `<div style="overflow:auto"><table class="ctbl"><thead><tr><th>מועמד/ת</th><th>תחום</th><th>ניסיון</th><th>כישורים</th><th>תעודות</th><th>שלב</th><th>ימים בשלב</th>${can('salary') ? '<th>ציפיות שכר</th>' : ''}</tr></thead><tbody>${rows.map((c) => `<tr class="clk" data-act="openCand" data-id="${c.id}"><td><span class="row" style="gap:8px;flex-wrap:nowrap">${avatar(c.id, 34)}<span><b>${esc(c.name)}</b><div class="mut small">${c.id}</div></span></span></td><td>${esc(c.family)}<div class="mut small">${esc(c.level)}</div></td><td>${c.years} שנים</td><td>${c.skills.map((s) => `<span class="pill p-blue">${esc(s)}</span>`).join(' ')}</td><td>${c.certs.map((s) => `<span class="pill p-violet">${esc(s)}</span>`).join(' ') || '<span class="mut">—</span>'}</td><td><span class="pill ${c.stage === 'התקבל/ה' ? 'p-green' : (candOpen(c) ? 'p-blue' : 'p-gray')}">${esc(c.stage)}</span></td><td>${candOpen(c) ? daysIn(c) : '—'}</td>${can('salary') ? `<td>${money(c.salary)}</td>` : ''}</tr>`).join('') || `<tr><td colspan="8" class="mut">אין מועמדים לפי הסינון</td></tr>`}</tbody></table></div>`}</div>`;
};
SCREENS.jobs = () => {
  const rows = S.jobs.slice().sort((a, b) => (jobOpen(b) - jobOpen(a)) || (a.openTs - b.openTs));
  return `<div><h1 class="h1">משרות</h1><div class="mut small">משרה נפתחת כשליד נסגר כלקוח. לחיצה על משרה מציגה את המועמדים שבתהליך ואת מי שעומד בדרישות.</div></div>
   <div class="card"><div style="overflow:auto"><table class="ctbl"><thead><tr><th>משרה</th><th>לקוח</th><th>דרישות</th><th>תקציב חודשי</th><th>איוש</th><th>פתוחה</th><th>בתהליך</th><th>מצב</th></tr></thead><tbody>${rows.map((j) => { const inp = S.cands.filter((c) => c.jobId === j.id && candOpen(c)).length, d = Math.floor((now() - j.openTs) / DAY); return `<tr class="clk" data-act="openJob" data-id="${j.id}"><td><b>${esc(j.title)}</b><div class="mut small">${j.id}</div></td><td>${esc(j.company)}</td><td>${j.skills.map((s) => `<span class="pill p-blue">${esc(s)}</span>`).join(' ')} ${j.certs.map((s) => `<span class="pill p-violet">${esc(s)}</span>`).join(' ')}${j.clearance ? ' <span class="pill p-orange">סיווג</span>' : ''}</td><td>${money(j.budget[0])}–${money(j.budget[1])}</td><td>${j.filled} / ${j.headcount}</td><td>${jobOpen(j) ? `<span class="pill ${d >= 75 ? 'p-red' : (d >= 45 ? 'p-orange' : 'p-gray')}">${d} ימים</span>` : '—'}</td><td>${inp}</td><td><span class="pill ${jobOpen(j) ? 'p-blue' : 'p-green'}">${esc(j.status)}</span></td></tr>`; }).join('') || '<tr><td colspan="8" class="mut">אין משרות. סגרו ליד כלקוח כדי לפתוח משרה.</td></tr>'}</tbody></table></div><div class="mut small" style="margin-top:8px">הסימון הכתום (45+ ימים) והאדום (75+) הוא כלל אצבע בלבד: הערכות בשוק לזמן איוש של משרת סייבר נעות בין כחודש לכמה חודשים ואינן אחידות.</div></div>`;
};
SCREENS.mil = () => {
  const q = A.ui.mq || {}, tr = Object.values(MIL.tracks), unit = q.unit || tr[0].unit, roles = (tr.find((x) => x.unit === unit) || tr[0]).roles, role = roles.some((r) => r.name === q.role) ? q.role : roles[0].name, years = +(q.years || 3);
  const t = translate({ unit, role, years }), jobs = milJobs({ unit, role, years }), withMil = S.cands.filter((c) => c.mil);
  const byUnit = tr.map((x) => ({ u: x.unit, n: withMil.filter((c) => c.mil.unit === x.unit).length, h: withMil.filter((c) => c.mil.unit === x.unit && c.stage === 'התקבל/ה').length, act: withMil.filter((c) => c.mil.unit === x.unit && candOpen(c)).length })).filter((x) => x.n);
  return `<div><h1 class="h1">תרגום שירות צבאי לכישורי סייבר</h1><div class="mut small">מגייס/ת שלא מכיר/ה את המסלולים יכול/ה להבין מה מועמד/ת כנראה יודע/ת, מה לבדוק, ומה לשאול – בלי לגעת במידע מסווג.</div></div>
   <div class="demo-note">המיפוי בנוי על מידע ציבורי כללי ועל הנחות – הוא נקודת פתיחה לראיון, לא קביעה. שמות יחידות מופיעים רק ברמה הכללית והציבורית. מומלץ לאמת ולהרחיב את המיפוי עם אנשים ששירתו במסלולים.</div>
   <div class="card"><div class="filters"><label>יחידה${sel('data-chg="mq" data-f="unit"', tr.map((x) => x.unit), unit)}</label><label>תפקיד${sel('data-chg="mq" data-f="role"', roles.map((r) => r.name), role)}</label><label>שנות שירות${sel('data-chg="mq" data-f="years"', [1, 2, 3, 4, 5, 6, 8, 10], years)}</label></div>
    <div class="grid g2"><div><b>כישורים משוערים</b><div class="row" style="gap:4px;margin-top:4px">${t.sk.map(([k, conf]) => `<span class="pill ${MIL.conf[conf]}">${esc(k)} · ${esc(conf)}</span>`).join('') || '<span class="mut">אין מיפוי טכני ישיר</span>'}</div>
     <div style="margin-top:10px"><b>תחומים מתאימים</b><div class="row" style="gap:4px;margin-top:4px">${t.fam.map((f) => `<span class="pill p-violet">${esc(f)}</span>`).join('') || '<span class="mut">נקודת כניסה עם הכשרה</span>'}<span class="pill p-gray">רמה משוערת: ${t.lvl}</span></div></div>
     <div style="margin-top:10px"><b>יכולות רכות</b><div class="row" style="gap:4px;margin-top:4px">${t.soft.map((x) => `<span class="pill p-gray">${esc(x)}</span>`).join('')}</div>${t.note ? `<div class="mut small" style="margin-top:4px">${esc(t.note)}</div>` : ''}</div></div>
     <div><b>מה לבדוק</b><div class="mut small">${t.verify.length ? 'מטלה מעשית ב: ' + t.verify.map(esc).join(' · ') : 'ראיון מוטיבציה ולמידה עצמית'}</div><b style="display:block;margin-top:10px">מה לשאול</b><ul class="small" style="margin:4px 0;padding-inline-start:18px">${t.ask.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></div>
    <div style="margin-top:10px"><b>משרות פתוחות מתאימות (${jobs.length})</b>${jobs.map((x) => `<div class="tl row spread"><a href="#" class="clink" data-act="openJob" data-id="${x.j.id}">${esc(x.j.company)} · ${esc(x.j.title)}</a><span class="row" style="gap:4px"><span class="pill p-gray">${x.cover.length}/${x.j.skills.length} כישורים משוערים</span>${x.lvlOk ? '' : '<span class="pill p-orange">רמה נמוכה מהנדרש</span>'}</span></div>`).join('') || '<div class="mut small">אין כרגע משרה פתוחה בתחומים האלה.</div>'}</div></div>
   <div class="card"><h2>המאגר לפי רקע צבאי</h2><div class="mut small" style="margin-bottom:6px">${withMil.length} מתוך ${S.cands.length} מועמדים עם רקע צבאי רשום. מספרים קטנים – לא להסיק מהם על יחידות.</div><table><thead><tr><th>יחידה</th><th>מועמדים</th><th>בתהליך</th><th>התקבלו</th></tr></thead><tbody>${byUnit.map((x) => `<tr><td>${esc(x.u)}</td><td>${x.n}</td><td>${x.act}</td><td>${x.h || '·'}</td></tr>`).join('')}</tbody></table></div>`;
};
SCREENS.settings = () => `<div><h1 class="h1">יומן והגדרות</h1></div>
   <div class="card"><h2>ייצוא</h2><div class="row"><button class="btn sec" data-act="csv" data-t="leads">לידים (CSV)</button><button class="btn sec" data-act="csv" data-t="cands" ${can('cands') ? '' : 'disabled'}>מועמדים (CSV)</button><button class="btn sec" data-act="csv" data-t="jobs">משרות (CSV)</button></div></div>
   <div class="card"><h2>נתוני הדגמה</h2><div class="row"><button class="btn sec" data-act="reset" ${can('admin') ? '' : 'disabled'}>איפוס לנתוני ההדגמה</button><span class="mut small">הנתונים נשמרים בדפדפן הזה בלבד. כל השמות והחברות פיקטיביים.</span></div></div>
   <div class="card"><h2>יומן פעילות</h2>${S.log.slice(0, 60).map((l) => `<div class="tl"><span class="mut small">${fmtD(l.ts)} · ${esc(uName(l.by))}</span> · ${esc(l.text)}</div>`).join('') || '<span class="mut">עדיין אין פעילות. כל שינוי שלב, הערה או פתיחת משרה יירשמו כאן.</span>'}</div>`;

// ---------- drawers ----------
const notesHtml = (x) => x.notes.slice().reverse().map((n) => `<div class="tl"><span class="mut small">${fmtD(n.ts)} · ${esc(uName(n.by))}</span><div>${esc(n.text)}</div></div>`).join('');
const stageCtl = (kind, x, stages, edit) => (edit ? `<div class="row"><label>שלב${sel(`data-chg="stage" data-kind="${kind}" data-id="${x.id}"`, stages, x.stage)}</label></div>` : `<span class="pill p-blue">${esc(x.stage)}</span>`);
const nextCtl = (kind, x, edit) => (edit ? `<div class="row" style="align-items:flex-end"><label>הצעד הבא<input type="text" id="nx-t" value="${esc(x.next ? x.next.text : '')}" placeholder="למשל: שיחת המשך"></label><label>תאריך<input type="date" id="nx-d" value="${esc(x.next ? x.next.date : '')}"></label><button class="btn sec sm" data-act="saveNext" data-kind="${kind}" data-id="${x.id}">שמירה</button></div>` : (nextHtml(x) || ''));
const noteCtl = (kind, x, edit) => (edit ? `<div class="row" style="align-items:flex-end"><label style="flex:1">הערה חדשה<input type="text" id="nt" placeholder="מה קרה בשיחה / בראיון" style="width:100%"></label><button class="btn sec sm" data-act="addNote" data-kind="${kind}" data-id="${x.id}">הוספה</button></div>` : '');
function wrap(title, sub, body) { return `<div class="drawer-bg" data-act="close"><aside class="drawer" role="dialog"><div class="row spread" style="align-items:flex-start"><div><h2 style="margin:0;font-size:22px">${title}</h2><div class="mut small">${sub}</div></div><button class="btn sec sm" data-act="close">סגירה ✕</button></div>${body}</aside></div>`; }
function leadDrawer(l) {
  const edit = can('leads'), jobs = S.jobs.filter((j) => j.leadId === l.id);
  return wrap(esc(l.company), `${l.id} · ${esc(l.sector)} · ${esc(l.contact)} · מקור: ${esc(l.source)} · אחראי/ת: ${esc(uName(l.owner))}`, `
   <div class="row"><span class="pill p-violet">${esc(l.need)}</span><span class="pill p-gray">${esc(l.level)} · ${l.headcount} תקנים</span><span class="pill p-gray">תקציב ${money(l.budget[0])}–${money(l.budget[1])}</span>${l.clearance ? '<span class="pill p-orange">נדרש סיווג ביטחוני</span>' : ''}${leadOpen(l) ? agePill(l, T.stuck.lead) : ''}</div>
   <div class="card">${stageCtl('lead', l, T.leadStages, edit)}${l.stage === 'אבוד' ? `<div class="row" style="margin-top:8px"><label>סיבת האובדן${edit ? sel(`data-chg="reason" data-kind="lead" data-id="${l.id}"`, T.lost, l.lostReason, 'בחרו…') : esc(l.lostReason || '—')}</label></div>` : ''}
    ${l.stage === 'נסגר – לקוח' ? `<div style="margin-top:10px">${jobs.length ? jobs.map((j) => `<a href="#" class="clink" data-act="openJob" data-id="${j.id}">משרה ${j.id}: ${esc(j.title)}</a>`).join(' · ') : (edit ? `<button class="btn" data-act="mkJob" data-id="${l.id}">פתיחת משרה מהליד</button>` : '<span class="mut">טרם נפתחה משרה</span>')}</div>` : ''}</div>
   <div class="card"><h3 class="h3">הצעד הבא</h3>${nextCtl('lead', l, edit) || '<span class="mut">לא נקבע</span>'}</div>
   <div class="card"><h3 class="h3">היסטוריה</h3>${noteCtl('lead', l, edit)}${notesHtml(l)}</div>`);
}
function candDrawer(c) {
  const edit = can('cands'), j = S.jobs.find((x) => x.id === c.jobId), open = S.jobs.filter(jobOpen);
  return wrap(`<span class="row" style="gap:12px;flex-wrap:nowrap">${avatar(c.id, 56)}<span>${esc(c.name)}</span></span>`, `${c.id} · ${esc(c.family)} · ${esc(c.level)} · ${c.years} שנות ניסיון · ${esc(c.location)} · מקור: ${esc(c.source)} · מגייס/ת: ${esc(uName(c.owner))}`, `
   <div class="row">${c.skills.map((s) => skillPill(c, s)).join('')}${c.certs.map((s) => `<span class="pill p-violet">${esc(s)}</span>`).join('')}${c.clearance ? '<span class="pill p-orange">סיווג ביטחוני</span>' : ''}</div>
   <div class="row"><span class="pill p-gray">זמינות: ${c.notice ? c.notice + ' ימי הודעה' : 'מיידית'}</span>${can('salary') ? `<span class="pill p-gray">ציפיות שכר ${money(c.salary)}</span>` : ''}${candOpen(c) ? agePill(c, T.stuck.cand) : ''}</div>
   <div class="card">${stageCtl('cand', c, T.candStages, edit)}${['נדחה', 'פרש/ה'].includes(c.stage) ? `<div class="row" style="margin-top:8px"><label>סיבה${edit ? sel(`data-chg="reason" data-kind="cand" data-id="${c.id}"`, T.reject, c.rejectReason, 'בחרו…') : esc(c.rejectReason || '—')}</label></div>` : ''}
    <div class="row" style="margin-top:8px"><label>מוגש/ת למשרה${edit ? `<select data-chg="assign" data-id="${c.id}"><option value="">— ללא —</option>${open.concat(j && !jobOpen(j) ? [j] : []).map((x) => `<option value="${x.id}" ${x.id === c.jobId ? 'selected' : ''}>${esc(x.company)} · ${esc(x.title)}</option>`).join('')}</select>` : esc(j ? j.company + ' · ' + j.title : '—')}</label></div>
    ${j ? `<div style="margin-top:8px"><div class="mut small">עמידה בדרישות המשרה (${match(j, c).met} מתוך ${match(j, c).total})</div>${matchChips(match(j, c), can('salary'))}</div>` : ''}</div>
   ${milCard(c, edit)}
   <div class="card"><h3 class="h3">אימות כישורים – מטלה מעשית</h3><div class="mut small" style="margin-bottom:6px">כישור נחשב מאומת מציון ${T.verifyPass}. בהתאמה למשרה מוצגים בנפרד כישורים מוצהרים ומאומתים.</div>${c.skills.map((sk) => { const v = c.verified && c.verified[sk]; return `<div class="row spread tl"><span>${skillPill(c, sk)}</span><span class="mut small">${v ? 'נבדק ' + fmtD(v.ts) + ' · ' + esc(uName(v.by)) : 'לא נבדק'}</span></div>`; }).join('')}
    ${edit ? `<div class="row" style="align-items:flex-end;margin-top:8px"><label>כישור${sel('id="vf-s"', Array.from(new Set(c.skills.concat(translate(c.mil) ? translate(c.mil).sk.map(([k]) => k) : [], T.skills[c.family]))), '', 'בחרו…')}</label><label>ציון במטלה (0–100)<input type="number" id="vf-n" min="0" max="100" style="width:110px"></label><button class="btn sec sm" data-act="verify" data-id="${c.id}">רישום תוצאה</button></div>` : ''}</div>
   <div class="card"><h3 class="h3">הצעד הבא</h3>${nextCtl('cand', c, edit) || '<span class="mut">לא נקבע</span>'}</div>
   <div class="card"><h3 class="h3">היסטוריה</h3>${noteCtl('cand', c, edit)}${notesHtml(c)}</div>`);
}
function jobDrawer(j) {
  const inp = S.cands.filter((c) => c.jobId === j.id), pool = S.cands.filter((c) => candOpen(c) && c.jobId !== j.id).map((c) => ({ c, m: match(j, c) })).filter((x) => x.m.items[0].ok).sort((a, b) => b.m.met - a.m.met).slice(0, 8), edit = can('cands');
  const row = (c, m, extra) => `<div class="tl"><div class="row spread"><span class="row" style="gap:8px;flex-wrap:nowrap">${avatar(c.id, 30)}<a href="#" class="clink" data-act="openCand" data-id="${c.id}"><b>${esc(c.name)}</b></a><span class="mut small">${esc(c.level)} · ${c.years} שנים</span></span><span class="row" style="gap:6px">${extra}</span></div><div style="margin-top:4px">${matchChips(m, can('salary'))}</div></div>`;
  return wrap(esc(j.title), `${j.id} · ${esc(j.company)} · ${j.filled} מתוך ${j.headcount} אוישו · תקציב ${money(j.budget[0])}–${money(j.budget[1])}`, `
   <div class="row">${j.skills.map((s) => `<span class="pill p-blue">${esc(s)}</span>`).join('')}${j.certs.map((s) => `<span class="pill p-violet">${esc(s)}</span>`).join('')}${j.clearance ? '<span class="pill p-orange">נדרש סיווג ביטחוני</span>' : ''}<span class="pill ${jobOpen(j) ? 'p-blue' : 'p-green'}">${esc(j.status)}</span></div>
   ${jobOpen(j) ? (() => { const f = forecast(j); return `<div class="card"><h3 class="h3">צפי איוש</h3><div class="row" style="gap:16px"><div><b style="font-size:26px">${f.exp.toFixed(1)}</b> <span class="mut">מתוך ${f.left} תקנים</span></div>${f.more ? `<span class="pill p-orange">חסרים בערך ${f.more} מועמדים חדשים בראש המשפך</span>` : '<span class="pill p-green">המשפך הנוכחי צפוי להספיק</span>'}</div><div class="mut small" style="margin-top:4px">לפי ${esc(f.src)}</div>${f.risks.map((r) => `<div class="demo-note" style="margin-top:6px">${esc(r)}</div>`).join('')}</div>`; })() : ''}
   ${jobOpen(j) && rediscover(j).length ? `<div class="card"><h3 class="h3">אפשר להחזיר (${rediscover(j).length})</h3><div class="mut small" style="margin-bottom:6px">מועמדים שנדחו או פרשו בעבר, כשהסיבה לא רלוונטית למשרה הזו.</div>${rediscover(j).map((r) => `<div class="tl row spread"><span class="row" style="gap:8px;flex-wrap:nowrap">${avatar(r.c.id, 30)}<span><a href="#" class="clink" data-act="openCand" data-id="${r.c.id}"><b>${esc(r.c.name)}</b></a><div class="mut small">${esc(r.why)}</div></span></span>${edit ? `<button class="btn sec sm" data-act="revive" data-id="${r.c.id}" data-job="${j.id}">החזרה לתהליך</button>` : ''}</div>`).join('')}</div>` : ''}
   ${jobOpen(j) ? (() => { const mb = S.cands.filter((c) => candOpen(c) && c.jobId !== j.id && c.family !== j.family && translate(c.mil) && translate(c.mil).fam.includes(j.family)); return mb.length ? `<div class="card"><h3 class="h3">רקע צבאי מתאים מתחום אחר (${mb.length})</h3><div class="mut small" style="margin-bottom:6px">מועמדים שרשומים בתחום אחר, אבל השירות הצבאי שלהם מרמז על התחום של המשרה. לאמת במטלה מעשית לפני הגשה.</div>${mb.slice(0, 6).map((c) => `<div class="tl row spread"><span class="row" style="gap:8px;flex-wrap:nowrap">${avatar(c.id, 30)}<span><a href="#" class="clink" data-act="openCand" data-id="${c.id}"><b>${esc(c.name)}</b></a><div class="mut small">${esc(c.family)} · שירות: ${esc(c.mil.role)}, ${esc(c.mil.unit)}</div></span></span><span class="pill p-gray">${j.skills.filter((sk) => translate(c.mil).sk.some(([k]) => k === sk)).length}/${j.skills.length} משוערים</span></div>`).join('')}</div>` : ''; })() : ''}
   <div class="card"><h3 class="h3">בתהליך למשרה (${inp.length})</h3>${inp.map((c) => row(c, match(j, c), `<span class="pill ${c.stage === 'התקבל/ה' ? 'p-green' : (candOpen(c) ? 'p-blue' : 'p-gray')}">${esc(c.stage)}</span>`)).join('') || '<span class="mut">עדיין לא הוגשו מועמדים.</span>'}</div>
   <div class="card"><h3 class="h3">מועמדים מהמאגר באותו תחום</h3><div class="mut small" style="margin-bottom:6px">לפי כללים גלויים: תחום, בכירות, לפחות חצי מהכישורים, תעודה, סיווג ושכר. אין ציון נסתר – ההחלטה את מי להגיש היא שלך.</div>${pool.map(({ c, m }) => row(c, m, `<span class="pill p-gray">${m.met} מתוך ${m.total}</span>${edit && jobOpen(j) ? `<button class="btn sec sm" data-act="submit" data-id="${c.id}" data-job="${j.id}">הגשה למשרה</button>` : ''}`)).join('') || '<span class="mut">אין במאגר מועמדים פעילים בתחום הזה. זה פער כישורים – כדאי לפתוח מקור חדש.</span>'}</div>`);
}
function formModal() {
  const f = A.ui.form; if (!f) return '';
  const inp = (k, l, ph) => `<label>${l}<input type="text" data-inp="ff" data-f="${k}" value="${esc(f[k] || '')}" placeholder="${ph || ''}"></label>`, pick = (k, l, opts) => `<label>${l}${sel(`data-chg="ff" data-f="${k}"`, opts, f[k], 'בחרו…')}</label>`;
  const body = f.kind === 'lead' ? `${inp('company', 'חברה')}${inp('contact', 'איש/אשת קשר')}${pick('sector', 'ענף', T.sectors)}${pick('need', 'תחום נדרש', T.families)}${pick('level', 'בכירות', T.levels)}${pick('source', 'מקור הליד', T.leadSources)}<label><input type="checkbox" data-chg="ff" data-f="clearance" ${f.clearance ? 'checked' : ''}> נדרש סיווג ביטחוני</label>` : `${inp('name', 'שם', 'שם פרטי ואות משפחה')}${pick('family', 'תחום', T.families)}${pick('level', 'בכירות', T.levels)}${inp('years', 'שנות ניסיון')}${inp('salary', 'ציפיות שכר (אלפי ₪ לחודש)')}${pick('source', 'מקור', T.candSources)}<label><input type="checkbox" data-chg="ff" data-f="clearance" ${f.clearance ? 'checked' : ''}> סיווג ביטחוני בתוקף</label>`;
  return `<div class="drawer-bg" style="align-items:center" data-act="closeForm"><div class="modal" role="dialog"><h2 style="margin:0">${f.kind === 'lead' ? 'ליד חדש' : 'מועמד/ת חדש/ה'}</h2><div class="filters">${body}</div><div class="mut small">כישורים ותעודות אפשר להשלים אחר כך. שדה שלא מולא נשאר ריק.</div><div class="row"><button class="btn" data-act="saveForm">שמירה</button><button class="btn sec" data-act="closeForm">ביטול</button></div></div></div>`;
}

// ---------- shell + render ----------
function loginView() { return `<div class="login"><section class="hero"><div class="logo big">${icon('shield', 34)}<span>CyberHire</span></div><h1>גיוס בסייבר שיודע <em>מה לעשות עכשיו</em></h1><p>לא רק מעקב: כישורים מאומתים במטלה מעשית, צפי איוש לכל משרה, החזרת מועמדים שנדחו כשהסיבה כבר לא רלוונטית, ורשימת פעולות לפי השפעה – כל המלצה עם הסיבה שלה.</p><div class="chips"><span>תרגום שירות צבאי</span><span>כישורים מאומתים</span><span>צפי איוש</span><span>החזרת מועמדים</span><span>מה לעשות עכשיו</span></div><div class="demo-note">גרסת ניסוי: כל הנתונים פיקטיביים ונשמרים בדפדפן שלך בלבד. אין כאן כניסה מאובטחת.</div></section><section class="picker"><h2>כניסה</h2><p class="mut" style="margin:0">בחרו תפקיד כדי לראות את המערכת מהצד שלו.</p><div class="roles">${USERS.map((u) => `<button class="user" data-act="login" data-id="${u.id}"><span class="avatar">${esc(u.name[0])}</span><span class="u-t"><b>${esc(u.name)} · ${esc(u.title)}</b><small>${esc(u.role)}${PERM[u.role].leads && PERM[u.role].cands ? ' · הכול' : (PERM[u.role].leads ? ' · עריכת לידים, צפייה במועמדים בלי שכר' : ' · עריכת מועמדים, צפייה בלידים')}</small></span></button>`).join('')}</div></section></div>`; }
function shell(inner) { const r = route(), pg = PAGES.find((p) => p.id === r); return `<div class="app"><aside class="side"><div class="logo">${icon('shield', 26)}<span>CyberHire</span></div><nav class="nav">${PAGES.map((p) => `<a href="#/${p.id}" class="${r === p.id ? 'on' : ''}">${icon(p.icon)}<span>${p.name}</span></a>`).join('')}</nav><div class="side-foot"><div class="meta">גרסת ניסוי · נתונים פיקטיביים</div><div class="usercard"><span class="avatar">${esc(A.me.name[0])}</span><span class="uc-t"><b>${esc(A.me.name)} · ${esc(A.me.title)}</b><small>${esc(A.me.role)}</small></span></div></div></aside><div class="content"><header class="tbar"><div class="bar-t"><span class="bar-page">${pg ? pg.name : ''}</span></div><div class="bar-r"><button class="iconbtn" data-act="theme" title="מצב כהה / בהיר" aria-label="ערכת נושא">${icon('moon', 18)}</button><button class="iconbtn" data-act="logout" title="החלפת משתמש" aria-label="החלפת משתמש">${icon('out', 18)}</button></div></header><main>${inner}</main></div></div>`; }
function render() {
  const app = $('#app'), ae = document.activeElement, keep = ae && ae.id ? { id: ae.id, s: ae.selectionStart, e: ae.selectionEnd } : null;
  if (!A.me) { app.innerHTML = loginView(); return; }
  const r = SCREENS[route()] ? route() : 'dash', o = A.ui.open, dr = !o ? '' : (o.t === 'lead' ? leadDrawer(S.leads.find((x) => x.id === o.id)) : (o.t === 'cand' ? candDrawer(S.cands.find((x) => x.id === o.id)) : jobDrawer(S.jobs.find((x) => x.id === o.id))));
  const y = window.scrollY; app.innerHTML = shell(SCREENS[r]()) + dr + formModal(); window.scrollTo(0, y);
  if (keep) { const e = document.getElementById(keep.id); if (e) { e.focus(); try { e.setSelectionRange(keep.s, keep.e); } catch (x) { /* not text */ } } }
}
const applyTheme = () => { document.documentElement.dataset.theme = localStorage.getItem('cyberhire-theme') || 'light'; };

// ---------- actions ----------
const byKind = (kind, id) => (kind === 'lead' ? S.leads : S.cands).find((x) => x.id === id);
function moveStage(kind, id, stage) {
  const x = byKind(kind, id); if (!x || x.stage === stage) return; if (!can(kind === 'lead' ? 'leads' : 'cands')) { toast('אין הרשאה לשנות שלב בתפקיד שלך', true); return; }
  const from = x.stage; setStage(x, stage); note(x, 'שלב: ' + from + ' ← ' + stage); if (!(kind === 'lead' ? leadOpen(x) : candOpen(x))) x.next = null;
  if (kind === 'cand' && stage === 'התקבל/ה' && x.jobId) { const j = S.jobs.find((q) => q.id === x.jobId); if (j && jobOpen(j)) { j.filled++; if (j.filled >= j.headcount) j.status = 'אוישה'; } }
  logAct((kind === 'lead' ? x.company : x.name) + ': ' + from + ' ← ' + stage); save(); render();
  if (kind === 'lead' && stage === 'נסגר – לקוח') toast('הליד נסגר כלקוח. אפשר לפתוח ממנו משרה.'); else if (stage === 'אבוד' || stage === 'נדחה' || stage === 'פרש/ה') toast('בחרו סיבה – זה מה שמאפשר ללמוד מזה אחר כך');
}
const ACTIONS = {
  login: (d) => { A.me = USERS.find((u) => u.id === d.id); localStorage.setItem('cyberhire-user', A.me.id); A.ui = {}; if (!location.hash) location.hash = '#/dash'; render(); },
  logout: () => { A.me = null; localStorage.removeItem('cyberhire-user'); A.ui = {}; render(); },
  theme: () => { localStorage.setItem('cyberhire-theme', document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); applyTheme(); },
  view: (d) => { A.ui[d.k] = d.v; render(); },
  openLead: (d) => { A.ui.open = { t: 'lead', id: d.id }; render(); }, openCand: (d) => { A.ui.open = { t: 'cand', id: d.id }; A.ui.mlu = null; render(); }, openJob: (d) => { A.ui.open = { t: 'job', id: d.id }; render(); },
  close: () => { A.ui.open = null; render(); },
  lf: (d, t) => { A.ui.lf = Object.assign({}, A.ui.lf, { [d.f]: t.type === 'checkbox' ? t.checked : t.value }); render(); },
  cf: (d, t) => { A.ui.cf = Object.assign({}, A.ui.cf, { [d.f]: t.type === 'checkbox' ? t.checked : t.value }); render(); },
  stage: (d, t) => moveStage(d.kind, d.id, t.value),
  reason: (d, t) => { const x = byKind(d.kind, d.id); if (d.kind === 'lead') x.lostReason = t.value; else x.rejectReason = t.value; note(x, 'סיבה: ' + t.value); save(); render(); },
  assign: (d, t) => { const c = byKind('cand', d.id), j = S.jobs.find((x) => x.id === t.value); c.jobId = t.value || null; note(c, j ? 'הוגש/ה למשרה: ' + j.company + ' · ' + j.title : 'הוסר/ה מהמשרה'); logAct(c.name + (j ? ' הוגש/ה ל' + j.company : ' הוסר/ה ממשרה')); save(); render(); },
  submit: (d) => { const c = byKind('cand', d.id), j = S.jobs.find((x) => x.id === d.job); c.jobId = j.id; if (c.stage === 'מקור') setStage(c, 'סינון טלפוני'); note(c, 'הוגש/ה למשרה: ' + j.company + ' · ' + j.title); logAct(c.name + ' הוגש/ה ל' + j.company); save(); toast(c.name + ' הוגש/ה למשרה'); render(); },
  saveNext: (d) => { const x = byKind(d.kind, d.id), t = $('#nx-t').value.trim(), dt = $('#nx-d').value; if (!t || !dt) { toast('צריך גם מה לעשות וגם תאריך', true); return; } x.next = { text: t, date: dt }; note(x, 'הצעד הבא: ' + t + ' (' + dt + ')'); save(); toast('הצעד הבא נשמר'); render(); },
  addNote: (d) => { const x = byKind(d.kind, d.id), t = $('#nt').value.trim(); if (!t) return; note(x, t); save(); render(); },
  mkJob: (d) => { const l = byKind('lead', d.id), j = jobFromLead(l, 'J' + (201 + S.jobs.length)); S.jobs.push(j); note(l, 'נפתחה משרה ' + j.id); logAct('נפתחה משרה ' + j.id + ' עבור ' + l.company); save(); toast('נפתחה משרה ' + j.id); A.ui.open = { t: 'job', id: j.id }; render(); },
  newLead: () => { A.ui.form = { kind: 'lead' }; render(); }, newCand: () => { A.ui.form = { kind: 'cand' }; render(); }, closeForm: () => { A.ui.form = null; render(); },
  ff: (d, t) => { A.ui.form[d.f] = t.type === 'checkbox' ? t.checked : t.value; },
  saveForm: () => {
    const f = A.ui.form, n0 = now();
    if (f.kind === 'lead') {
      if (!(f.company || '').trim() || !f.need || !f.level) { toast('חסר: חברה, תחום נדרש ובכירות', true); return; }
      const l = { id: 'L' + (101 + S.leads.length), company: f.company.trim(), sector: f.sector || '', contact: (f.contact || '').trim(), need: f.need, level: f.level, headcount: 1, clearance: !!f.clearance, budget: T.budget[f.level].slice(), source: f.source || '', owner: A.me.id, stage: T.leadStages[0], createdTs: n0, stageTs: n0, next: null, notes: [{ ts: n0, by: A.me.id, text: 'ליד נפתח.' }] };
      S.leads.push(l); logAct('ליד חדש: ' + l.company); A.ui.open = { t: 'lead', id: l.id };
    } else {
      if (!(f.name || '').trim() || !f.family || !f.level) { toast('חסר: שם, תחום ובכירות', true); return; }
      const yrs = parseInt(f.years, 10), sal = parseFloat(f.salary);
      const c = { id: 'C' + (301 + S.cands.length), name: f.name.trim(), family: f.family, level: f.level, years: isFinite(yrs) ? yrs : 0, skills: [], certs: [], clearance: !!f.clearance, salary: isFinite(sal) ? sal : null, notice: 0, location: '', source: f.source || '', owner: A.me.id, stage: T.candStages[0], jobId: null, createdTs: n0, stageTs: n0, next: null, verified: {}, hist: [{ stage: T.candStages[0], ts: n0 }], notes: [{ ts: n0, by: A.me.id, text: 'נוסף/ה למאגר.' }] };
      S.cands.push(c); logAct('מועמד/ת חדש/ה: ' + c.name); A.ui.open = { t: 'cand', id: c.id };
    }
    A.ui.form = null; save(); toast('נשמר'); render();
  },
  mq: (d, t) => { A.ui.mq = Object.assign({}, A.ui.mq, { [d.f]: t.value }); if (d.f === 'unit') A.ui.mq.role = ''; render(); },
  mlUnit: (d, t) => { A.ui.mlu = t.value; render(); },
  mlSave: (d) => { const c = byKind('cand', d.id), u = $('#ml-u').value, r = $('#ml-r').value, y = parseInt($('#ml-y').value, 10); if (!u) { c.mil = null; A.ui.mlu = null; note(c, 'רקע צבאי הוסר'); save(); render(); return; } if (!r || !(y >= 1 && y <= 30)) { toast('בחרו תפקיד ושנות שירות', true); return; } c.mil = { unit: u, role: r, years: y, end: c.mil && c.mil.end }; A.ui.mlu = null; note(c, 'רקע צבאי: ' + r + ', ' + u + ', ' + y + ' שנים'); logAct(c.name + ': עודכן רקע צבאי'); save(); toast('הרקע הצבאי נשמר'); render(); },
  verify: (d) => { const c = byKind('cand', d.id), sk = $('#vf-s').value, n = parseInt($('#vf-n').value, 10); if (!sk || !(n >= 0 && n <= 100)) { toast('בחרו כישור וציון בין 0 ל-100', true); return; } c.verified = c.verified || {}; c.verified[sk] = { score: n, ts: now(), by: A.me.id }; if (!c.skills.includes(sk)) c.skills.push(sk); note(c, 'מטלה מעשית – ' + sk + ': ' + n + (n >= T.verifyPass ? ' (מאומת)' : ' (מתחת לסף)')); logAct(c.name + ': מטלה מעשית ב' + sk + ' – ' + n); save(); toast(n >= T.verifyPass ? sk + ' סומן כמאומת' : 'נרשם – מתחת לסף האימות'); render(); },
  revive: (d) => { const c = byKind('cand', d.id), j = S.jobs.find((x) => x.id === d.job); c.jobId = j.id; const why = c.rejectReason; c.rejectReason = null; setStage(c, 'סינון טלפוני'); note(c, 'הוחזר/ה לתהליך למשרה ' + j.company + ' (סיבת הדחייה הקודמת: ' + why + ')'); logAct(c.name + ' הוחזר/ה לתהליך ל' + j.company); save(); toast(c.name + ' חזר/ה לתהליך'); render(); },
  csv: (d) => {
    const rows = d.t === 'leads' ? [['מס׳', 'חברה', 'ענף', 'איש קשר', 'צורך', 'בכירות', 'שלב', 'ימים בשלב', 'אחראי/ת', 'סיבת אובדן']].concat(S.leads.map((l) => [l.id, l.company, l.sector, l.contact, l.need, l.level, l.stage, daysIn(l), uName(l.owner), l.lostReason || ''])) : d.t === 'jobs' ? [['מס׳', 'לקוח', 'משרה', 'כישורים', 'תעודות', 'איוש', 'מצב']].concat(S.jobs.map((j) => [j.id, j.company, j.title, j.skills.join(' / '), j.certs.join(' / '), j.filled + '/' + j.headcount, j.status])) : [['מס׳', 'שם', 'תחום', 'בכירות', 'שנות ניסיון', 'כישורים', 'תעודות', 'רקע צבאי', 'שלב', 'ימים בשלב', 'מגייס/ת', 'סיבה']].concat(S.cands.map((c) => [c.id, c.name, c.family, c.level, c.years, c.skills.map((sk) => sk + (isVerified(c, sk) ? ' (מאומת ' + c.verified[sk].score + ')' : '')).join(' / '), c.certs.join(' / '), c.mil ? c.mil.role + ' · ' + c.mil.unit + ' · ' + c.mil.years + ' שנים' : '', c.stage, daysIn(c), uName(c.owner), c.rejectReason || '']));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rows.map((r) => r.map((v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })); a.download = 'cyberhire-' + d.t + '.csv'; a.click(); toast('הקובץ הורד');
  },
  reset: () => { if (!confirm('לאפס לנתוני ההדגמה? כל מה שהוזן בדפדפן הזה יימחק.')) return; S = seed(); save(); A.ui = {}; toast('אופס לנתוני ההדגמה'); render(); },
};
document.addEventListener('click', (e) => { const t = e.target.closest('[data-act]'); if (!t) return; if (t.classList.contains('drawer-bg') && e.target !== t) return; if (e.target.closest('select,input,textarea,label') && t !== e.target.closest('button,a')) return; const fn = ACTIONS[t.dataset.act]; if (fn) { e.preventDefault(); fn(t.dataset, t, e); } });
document.addEventListener('change', (e) => { const t = e.target.closest('[data-chg]'); if (t && ACTIONS[t.dataset.chg]) ACTIONS[t.dataset.chg](t.dataset, t, e); });
document.addEventListener('input', (e) => { const t = e.target.closest('[data-inp]'); if (t && ACTIONS[t.dataset.inp]) ACTIONS[t.dataset.inp](t.dataset, t, e); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && (A.ui.open || A.ui.form)) { A.ui.open = null; A.ui.form = null; render(); } });
// drag a card to another stage column
document.addEventListener('dragstart', (e) => { const c = e.target.closest('[data-drag]'); if (c) e.dataTransfer.setData('text/plain', c.dataset.drag + '|' + c.dataset.id); });
document.addEventListener('dragover', (e) => { const col = e.target.closest('[data-drop]'); if (col) { e.preventDefault(); col.classList.add('over'); } });
document.addEventListener('dragleave', (e) => { const col = e.target.closest('[data-drop]'); if (col) col.classList.remove('over'); });
document.addEventListener('drop', (e) => { const col = e.target.closest('[data-drop]'); if (!col) return; e.preventDefault(); const [kind, id] = (e.dataTransfer.getData('text/plain') || '').split('|'); if (kind === col.dataset.drop) moveStage(kind, id, col.dataset.stage); });
window.addEventListener('hashchange', () => { A.ui.open = null; render(); });
applyTheme(); A.me = USERS.find((u) => u.id === localStorage.getItem('cyberhire-user')) || null; render();
