// Static per-corps configuration (units, quotas, thresholds, traits, stats) ported from the MIL-DRAFT mockup.
const NAMES = ['איתמר ל.', 'יונתן ר.', 'עידו מ.', 'אורי ש.', 'נדב ד.', 'אלון כ.', 'רועי ב.', 'תומר ג.', 'אדם פ.', 'נתנאל ש.', 'הראל ק.', 'ינון ד.', 'עילאי מ.', 'שקד ב.', 'בן א.', 'גיא ה.', 'מתן ק.', 'שי ר.', 'ליאם ו.', 'עמית צ.', 'יואב מ.', 'אלעד ח.', 'נועה ל.', 'איתי ר.', 'שירה מ.', 'עומר ש.', 'מאיה ד.', 'דניאל כ.', 'יעל ב.', 'אור ג.', 'הדר פ.', 'ליאור ס.', 'רותם א.', 'גל ש.', 'אביגיל מ.', 'עמרי כ.', 'טל ר.', 'יובל נ.', 'רוני א.', 'תמר ש.', 'ניר ב.', 'עדי ל.', 'אלה ר.', 'עוז מ.', 'מיכל ט.', 'אריאל נ.', 'שני ק.', 'דור ח.', 'נגה ע.', 'אייל ס.', 'קרן ג.', 'אסף ו.', 'ליה פ.', 'סהר י.'];
const AREAS=['צפון','מרכז','דרום','ירושלים'];
const MEDS=['ללא מגבלות','מגבלה קלה','מגבלה בינונית'];
const RECS=['מומלץ','מומלץ בהסתייגות','לא מומלץ'];
// EXPERIMENT: three training tracks for candidates to special units. Internal keys (combat / intel / signals) are kept from the earlier
// version; only the content changed. Unit names, stages and tracks follow general public descriptions and are NOT verified against
// official IDF data - replace them with the real structure before any real use. Measures (stats) are illustrative.
const corps = {
  combat: {
    key: 'combat', label: 'יח״טיות חטיבתיות (גדס״ר)', corps: 'יח״טיות חטיבתיות', short: 'יח״טיות', prefix: 'C-2', size: 22, eventName: 'גיבוש יח״טיות', evalSource: 'גיבוש יח״טיות ומפקדי ההכשרה', myUnit: 'גדס״ר גבעתי', targetLabel: 'פלוגה', fallback: 'גדוד חי״ר בחטיבת האם',
    roles: ['לוחם/ת סיור', 'נגביסט', 'מאגיסט', 'חובש קרבי', 'צלף', 'קשר מבצעי'],
    mix: ['לוחם/ת סיור', 'לוחם/ת סיור', 'נגביסט', 'לוחם/ת סיור', 'מאגיסט', 'חובש קרבי', 'לוחם/ת סיור', 'צלף', 'קשר מבצעי', 'נגביסט', 'חובש קרבי'],
    traits: ['מקצועיות', 'עבודה תחת לחץ', 'עבודה בצוות', 'יכולת הובלה', 'ניווט'],
    stats: [{ k: 'run', l: 'ריצה 3 ק״מ', u: 'דק׳', low: true, min: 11.2, max: 15.5, d: 1 }, { k: 'push', l: 'שכיבות סמיכה', u: 'בדקה', min: 22, max: 62, d: 0 }, { k: 'pull', l: 'מתח', u: 'חזרות', min: 2, max: 18, d: 0 }, { k: 'shoot', l: 'קליעה', u: '% פגיעה', min: 52, max: 96, d: 0 }],
    skills: { 'לוחם/ת סיור': ['ניווט', 'כושר גבוה'], 'נגביסט': ['כוח פיזי', 'עבודת צוות'], 'מאגיסט': ['כוח פיזי', 'סבולת'], 'חובש קרבי': ['עזרה ראשונה', 'רוגע'], 'צלף': ['קליעה', 'סבלנות'], 'קשר מבצעי': ['תקשורת', 'אחריות'] },
    obs: { 'לוחם/ת סיור': 'בתרגיל הניווט הלילי עמד/ה בקצב ושמר/ה על הכיוון.', 'נגביסט': 'נשא/ה ציוד כבד לאורך המסע בלי לבקש החלפה.', 'מאגיסט': 'עמידות גבוהה במאמץ ממושך עם משקל.', 'חובש קרבי': 'בתרגיל הפינוי זיהה/תה ראשון/ה את הפצוע המדומה.', 'צלף': 'ריכוז גבוה ודיוק במטווח.', 'קשר מבצעי': 'דיווח ברור ומסודר בקשר לאורך התרגיל.' },
    good: ['ביצע/ה את התרגילים בדייקנות ולמד/ה מהר מתיקונים.', 'שמר/ה על קור רוח במסע האלונקה ובתרגיל הלחץ.', 'עזר/ה לחברים בצוות ונתן/ה כתף בלי שביקשו.', 'לקח/ה פיקוד על הצוות כשהמשימה הסתבכה.', 'ניווט מדויק גם בתנאי לילה.'],
    weak: ['צריך לחדד דיוק בביצוע.', 'מתקשה כשהלחץ עולה.', 'נוטה לעבוד לבד.', 'פחות לוקח/ת יוזמה בצוות.', 'מתקשה בניווט עצמאי.'],
    units: [
      { name: 'גדס״ר גולני', badge: 'גו', desc: 'גדוד הסיור של חטיבת גולני', need: 2 }, { name: 'גדס״ר הצנחנים', badge: 'צנ', desc: 'גדוד הסיור של חטיבת הצנחנים', need: 1 },
      { name: 'גדס״ר גבעתי', badge: 'גב', desc: 'גדוד הסיור של חטיבת גבעתי', need: 2 }, { name: 'גדס״ר נח״ל', badge: 'נח', desc: 'גדוד הסיור של חטיבת הנח״ל', need: 1 },
      { name: 'סיירת חרוב (כפיר)', badge: 'חר', desc: 'היחידה המיוחדת של חטיבת כפיר', need: 1 },
    ],
  },
  intel: {
    key: 'intel', label: 'יחידות מיוחדות', corps: 'יחידות מיוחדות', short: 'מיוחדות', prefix: 'C-3', size: 18, eventName: 'גיבוש יחידות מיוחדות', evalSource: 'גיבוש ומפקדי הצוותים', myUnit: 'שייטת 13', targetLabel: 'התמחות', fallback: 'שיבוץ מחדש מחוץ ליחידות המיוחדות', nextTrack: 'combat',
    roles: ['לוחם/ת', 'חובש/ת', 'צלף/ת', 'קשר/ית'],
    mix: ['לוחם/ת', 'לוחם/ת', 'חובש/ת', 'לוחם/ת', 'צלף/ת', 'לוחם/ת', 'קשר/ית', 'לוחם/ת'],
    traits: ['עמידה בעומס', 'עבודה בצוות', 'קור רוח', 'משמעת מבצעית', 'למידה מהירה'],
    stats: [{ k: 'run', l: 'ריצה 3 ק״מ', u: 'דק׳', low: true, min: 10.8, max: 14.5, d: 1 }, { k: 'pull', l: 'מתח', u: 'חזרות', min: 6, max: 24, d: 0 }, { k: 'nav', l: 'ניווט', u: '% הצלחה', min: 50, max: 98, d: 0 }, { k: 'shoot', l: 'קליעה', u: '% פגיעה', min: 60, max: 98, d: 0 }],
    skills: { 'לוחם/ת': ['ניווט', 'כושר גבוה'], 'חובש/ת': ['עזרה ראשונה', 'רוגע'], 'צלף/ת': ['קליעה', 'סבלנות'], 'קשר/ית': ['תקשורת', 'אחריות'] },
    obs: { 'לוחם/ת': 'עמד/ה במסע המסכם בקצב הצוות.', 'חובש/ת': 'טיפל/ה בפצוע המדומה בסדר ובשקט.', 'צלף/ת': 'דיוק גבוה במטווח בתנאי עייפות.', 'קשר/ית': 'שמר/ה על קשר רציף וברור בתרגיל.' },
    good: ['ממשיך/ה לתפקד היטב גם אחרי ימים של עומס.', 'מרים/ה את הצוות ברגעים קשים.', 'נשאר/ת רגוע/ה כשהתרגיל משתבש.', 'מקפיד/ה על נהלים גם בלי פיקוח.', 'מיישם/ת תיקונים כבר בתרגיל הבא.'],
    weak: ['יורד/ת בתפקוד כשהעומס נמשך.', 'מתקשה להשתלב בצוות.', 'מאבד/ת ריכוז תחת לחץ.', 'מעגל/ת פינות בנהלים.', 'צריך/ה כמה חזרות עד שמפנים/ה.'],
    units: [
      { name: 'שייטת 13', badge: '13', desc: 'קומנדו ימי', tier: 1 }, { name: 'סיירת מטכ״ל', badge: 'מט', desc: 'יחידה מיוחדת של אגף המודיעין', tier: 1 }, { name: 'שלדג', badge: 'של', desc: 'יחידה מיוחדת של חיל האוויר', tier: 1 },
      { name: 'יחידה 669', badge: '669', desc: 'חילוץ והצלה בהיטס', tier: 1 }, { name: 'מגלן', badge: 'מג', desc: 'חטיבת הקומנדו', tier: 2, need: 2 }, { name: 'דובדבן', badge: 'דו', desc: 'חטיבת הקומנדו', tier: 2, need: 3 },
    ],
  },
  signals: {
    key: 'signals', label: 'קורס טיס', corps: 'קורס טיס', short: 'טיס', prefix: 'C-4', size: 16, eventName: 'גיבוש קורס טיס', evalSource: 'גיבוש ומדריכי הקורס', myUnit: 'קורס טיס – שלב בסיסי', targetLabel: 'מגמה', fallback: 'שיבוץ מחדש מחוץ לקורס הטיס', nextTrack: 'intel',
    roles: ['חניך/ת טיס', 'חניך/ת ניווט'],
    mix: ['חניך/ת טיס', 'חניך/ת טיס', 'חניך/ת ניווט', 'חניך/ת טיס'],
    traits: ['קואורדינציה', 'חלוקת קשב', 'קבלת החלטות', 'למידה מהירה', 'עבודה בצוות'],
    stats: [{ k: 'theory', l: 'מבחן עיוני', u: '% נכון', min: 55, max: 98, d: 0 }, { k: 'flight', l: 'ציון טיסה', u: '% מהמרבי', min: 50, max: 97, d: 0 }, { k: 'sim', l: 'סימולטור', u: '% מהמרבי', min: 50, max: 98, d: 0 }, { k: 'run', l: 'ריצה 2 ק״מ', u: 'דק׳', low: true, min: 7.5, max: 11, d: 1 }],
    skills: { 'חניך/ת טיס': ['התמצאות במרחב', 'ריכוז'], 'חניך/ת ניווט': ['תכנון', 'דיוק'] },
    obs: { 'חניך/ת טיס': 'שיפור עקבי בגיחות האחרונות.', 'חניך/ת ניווט': 'תכנון מסלול מדויק ועמידה בזמנים.' },
    good: ['שליטה חלקה ומדויקת בהגאים.', 'מחזיק/ה תמונת מצב מלאה גם בעומס.', 'מחליט/ה מהר ונכון במצבים לא צפויים.', 'מפנים/ה תיקונים כבר בגיחה הבאה.', 'תקשורת טובה עם המדריך/ה והצוות.'],
    weak: ['תיקוני יתר בהגאים.', 'מאבד/ת פרטים כשהעומס עולה.', 'מהסס/ת בקבלת החלטות.', 'צריך/ה כמה חזרות עד שמפנים/ה.', 'מתקשה לקבל ביקורת.'],
    units: [
      { name: 'קורס טיס – שלב מכין', badge: 'מכ', desc: 'השלב הראשון בקורס' }, { name: 'קורס טיס – שלב בסיסי', badge: 'בס', desc: 'טיסות ראשונות והכשרה קרקעית' },
      { name: 'קורס טיס – שלב ראשוני', badge: 'רא', desc: 'פיצול למגמות' }, { name: 'קורס טיס – שלב מתקדם', badge: 'מת', desc: 'הכשרה מתקדמת במגמה' },
    ],
  },
};
Object.keys(corps).forEach((k) => { corps[k].rounds = 4; });
// Classification layers: who can open which screen, which actions they may run, and how much data they see.
// scope: 'all' = every corps · 'corps' = only own corps · 'group' = only own evaluator group
// Training-follow-up model. The system tracks soldiers in training who are candidates for a special unit (יח״ט / יחידה מיוחדת).
// Three core events per soldier: (1) intake – גיוס המועמד, (2) dismissal review – בדיקת מועמד להדחה, (3) periodic status – סטטוס רבעוני / חציוני.
// Between them: a short daily entry by the training commander / the team's evaluator.
const TR = {
  statuses: ['בהכשרה', 'במעקב', 'בבדיקת הדחה', 'הודח/ה', 'סיים/ה הכשרה'],
  daily: ['מתקשה', 'תקין', 'מצטיין'],                       // daily level 0..2
  attend: ['נוכח/ת', 'חסר/ה', 'פטור רפואי'],
  periodRec: ['ממשיך/ה', 'במעקב', 'מועמד/ת להדחה'],        // outcome of a periodic status
  decisions: ['נשאר/ת בהכשרה', 'נשאר/ת במעקב', 'הודח/ה'],   // outcome of a dismissal review
  periods: ['רבעון', 'חציון'],
  // dismissal room: every commander / the team's evaluator writes a reasoned position; a dismissal needs at least minOpinions of them
  stances: ['להדיח', 'להשאיר במעקב', 'להשאיר בהכשרה'], minOpinions: 2,
};
// After a dismissal the soldier moves automatically to a unit one level lower IN THE SAME TRACK that has an open need (unit.tier: 1 = highest;
// unit.need = open places, editable in the settings screen). The tiers below are an ILLUSTRATION ONLY, not an official ranking of units.
// When no lower unit in the track has an open need, the soldier moves to the next track (corps.nextTrack: flight course -> special units ->
// brigade recon units - also an illustration), to its unit with the largest open need. With no next track / no open need: corps.fallback.
// special units the soldiers are candidates for (generic names – replace with the real ones)
const TARGETS = { combat: ['פלס״ר (סיור)', 'פלחה״ן (חבלה והנדסה)', 'פלנ״ט (נ״ט)'], intel: ['לוחמה', 'צליפה', 'חבלה', 'רפואה'], signals: ['קרב', 'מסוקים', 'תובלה', 'ניווט'] };
// Classification layers: who can open which screen, which actions they may run, and how much data they see.
// scope: 'all' = every corps · 'corps' = only own corps · 'group' = only own team
const ROLES = {
  'מנהל/ת מערכת': { layer: 1, scope: 'all', home: 'dash', pages: ['dash', 'weekly', 'roster', 'daily', 'periodic', 'dismiss', 'intake', 'eval', 'log', 'settings'], can: ['intake', 'import', 'daily', 'periodic', 'dismiss', 'opine', 'complete', 'regroup', 'fav', 'evalbulk', 'settings', 'factory'], desc: 'ניהול המערכת בכל המסלולים: גיוס מועמדים, מעקב, נימוקים בחדר ההדחה, צורכי היחידות, הגדרות, משתמשים ואיפוס. ההחלטה על הדחה אינה שלו/ה – היא של מפקד/ת ההכשרה בלבד.' },
  'מפקד/ת הכשרה': { layer: 2, scope: 'all', home: 'dash', pages: ['dash', 'weekly', 'roster', 'daily', 'periodic', 'dismiss', 'eval', 'log'], can: ['daily', 'periodic', 'dismiss', 'opine', 'decide', 'complete', 'fav'], desc: 'מזין/ה מעקב יומי וסטטוס תקופתי, פותח/ת בדיקת הדחה, רושם/ת נימוק בחדר ההדחה ומחליט/ה, ומסמן/ת סיום הכשרה. רואה את דפי המגבש בצפייה בלבד.' },
  'ראש מטה': { layer: 3, scope: 'all', home: 'dash', pages: ['dash'], can: [], desc: 'צפייה בלבד בתמונת המצב של כל החילות. אין גישה לתיקי החיילים.' },
  'שלישות': { layer: 4, scope: 'corps', home: 'roster', pages: ['dash', 'roster', 'periodic', 'dismiss', 'intake', 'eval', 'log'], can: ['intake', 'import', 'fav'], desc: 'מגייסת מועמדים למערכת (ידנית או מקובץ) ועוקבת אחרי מצבם. רואה סטטוס תקופתי, בדיקות הדחה ודפי מגבש בצפייה בלבד.' },
  'מגבש/ת': { layer: 5, scope: 'group', home: 'today', pages: ['today', 'daily', 'dismiss', 'eval'], can: ['eval', 'regroup', 'evalbulk', 'daily', 'dismiss', 'opine'], desc: 'אחראי/ת על צוות אחד: מעקב יומי על חיילי הצוות, דף מגבש, פתיחת בדיקת הדחה ורישום נימוק בחדר ההדחה על חיילי הצוות. ההחלטה היא של מפקד/ת ההכשרה.' },
  'צופה/ת': { layer: 6, scope: 'all', home: 'dash', pages: ['dash'], can: [], desc: 'צפייה במספרים המסכמים בתמונת המצב בלבד, ללא שמות, תיקים או הרשאות פעולה.' },
};
const canDo = (user, action, k) => { const r = ROLES[user && user.role]; return !!r && r.can.includes(action) && (r.scope === 'all' || user.corps === k); };
// Login step 1 ("חיל"): the five entrances. Users carry org / orgUnit / roleLabel for steps 1-3.
const ORGS = [
  { key: 'combat', label: 'יח״טיות חטיבתיות' }, { key: 'intel', label: 'יחידות מיוחדות' }, { key: 'signals', label: 'קורס טיס' },
  { key: 'hr', label: 'משאבי אנוש' }, { key: 'dev', label: 'פיתוח' },
];
module.exports={ORGS,ROLES,canDo,TR,TARGETS,corps,NAMES,AREAS,MEDS,RECS,WORDS:['בסיסי','טוב','בולט']};
