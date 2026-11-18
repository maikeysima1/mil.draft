# Israeli medical residency and nursing/paramedical training as a customer segment for "training cohort tracking" software

Research caveat (read first): WebFetch was blocked for gov.il, library.mevaker.gov.il, maariv.co.il and ynet.co.il (hosts not in session's allowed domains). All findings below come from WebSearch result summaries only, not from reading the full documents. Search summaries are secondary and may be imprecise; every item should be verified against the primary link before being quoted. No evidence was found for most vendor/procurement questions (see Gaps).

## 1. How residents / nursing students are evaluated and tracked today; which tools are used

### Takeaway
Residency evaluation is run by the IMA Scientific Council (המועצה המדעית) under per-specialty syllabi, historically with little structured evaluation beyond written exams; a move to competency-based observed evaluation was announced. I found no evidence of any named national or hospital software system (Israeli or MedHub/New Innovations/one45) used for it.

### Cited Findings
- IMA publishes per-specialty training syllabi as PDFs marked as Scientific Council documents; each lists a Scientific Council service representative who accompanies the trainee until certification; general training conditions are in physicians' regulations, with exam info on the IMA interns site (ima.org.il/internes) — [IMA syllabus example](https://www.ima.org.il/userfiles/image/cylabusMinhalRefuei2013.pdf)
- Ynet reported the Scientific Council decided on changes including evaluating residents by competencies; per the article, over the years there was no organized evaluation system apart from written exams at the end of each training stage; senior physicians in the department would observe and report impressions to the Council (chair then: Prof. Gidi Paret) — [Ynet](https://www.ynet.co.il/articles/mobile/0,7340,L-5645305,00.html) (snippet-level; article date not verified)
- State Comptroller 2024 follow-up report on clinical training of physicians (follow-up audit Feb–Aug 2023 on a 2018 report); describes the Scientific Council as an advisory body recommending to the Ministry of Health — [Comptroller summary](https://library.mevaker.gov.il/sites/DigitalLibrary/Documents/2024/2024.07-75A/2024.07-75A-207-Doctors-Taktzir.pdf); earlier [2018 report](https://library.mevaker.gov.il/sites/DigitalLibrary/Documents/2018-68c-206-hasdara.pdf) found the Ministry lacked a multi-year plan for needs per specialty and positions per hospital (per search summary)
- Ministry reform: internship (סטאז') shortened from 12 to 9 months from Sept 2025 per Maariv, with residency rotations of six months also in health funds; Ministry reform outline document dated May 2025 — [Maariv](https://www.maariv.co.il/news/health/article-1200242), [Maariv on reform](https://www.maariv.co.il/news/health/article-1161710), [Ministry reform report](https://www.gov.il/BlobFolder/reports/report-outlining-reform-internship--medicine-may2025/he/subjects_medical_health_professions_report-outlining-reform-internship--medicine-may2025.pdf). Maariv: training stays under the IMA Scientific Council.
- Nursing: school yearbooks (e.g., BGU Recanati school) have a section "summative evaluation of clinical experience" and committees for students with exceptional problems; clinical attendance requirements (e.g., 90% in one Hebrew University course) — [BGU yearbook](https://in.bgu.ac.il/fohs/Documents/shnaton/2012-2013/RecanatiSchool.pdf), [HUJI syllabus](https://shnaton.huji.ac.il/index.php/NewSyl/91923/1/2024/pdf). Contents not read in detail.
- Generic international tools surfaced in search (not evidence of Israeli use): Competency.AI (competency-based evaluation, rotations) and InPlace (clinical placement tracking) — [Healthy Simulation Hebrew pages](https://www.healthysimulation.com/iw/%D7%A1%D7%A4%D7%A7%D7%99%D7%9D/%D7%AA%D7%95%D7%9B%D7%A0%D7%94-%D7%91%D7%9E%D7%A7%D7%95%D7%9D/)

### Inferences
- Hypothesis: evaluation is largely paper/Word/Excel plus exam-based, held per hospital department and Scientific Council; the stated shift to competency-based evaluation implies a latent need for documentation tooling.
- Hypothesis: any buyer would more plausibly be the Scientific Council/IMA or Ministry (national standard) than individual hospitals, but this is unverified.

### Gaps
- No evidence found of MedHub, New Innovations, one45 or any named system in Israeli hospitals (search returned nothing; a different Israeli "MedHub" cardiology AI product is unrelated).
- No evidence on whether IMA/Ministry run a digital training logbook (ספר התמחות); IMA pages showed none in search.
- No information found on nursing-school clinical-evaluation software, or Nursing Administration systems.
- Paramedical (e.g., physiotherapy, EMT/paramedic) training not researched.

## 2. How extend/stop/dismiss decisions are made, documented, and what rights apply

### Takeaway
I could not find the formal procedure for dismissing or discontinuing a resident. Only fragments: hospital training committees appointed via the Scientific Council, IMA's legal position that residents cannot be dismissed for irrelevant reasons, and labor-court disputes over residency terms.

### Cited Findings
- Knesset committee record states a training committee is appointed by the Scientific Council, with hospital-level training committees (discussion record, not a statute; treat cautiously) — [Knesset document](https://production.oknesset.org/pipelines/data/committees/download_document_committee_session/files/23/4/5/452307.DOC)
- Maariv report on a physician dismissed during residency: IMA argued a resident cannot be dismissed during residency for irrelevant reasons (position, not a ruling) — [Maariv](https://www.maariv.co.il/news/law/article-1012482)
- Tel Aviv regional labor court upheld a claim for a residency grant by a physician who started pathology residency and was later dismissed, calling the state's refusal unreasonable — [Mako](https://www.mako.co.il/finances-law/work/Article-6a846ec189b7561006.htm) (per search summary)
- Oct 2023 IMA letter instructed managers to interrupt residents' training (reserve duty) only when necessary — [IMA letter](https://cdn.doctorsonly.co.il/2023/10/מכתב-הרי-לרופאים-מתמחים-במילואים.pdf)
- Residents' organization Marash petitioned court over residents failing certification exams during war — [Walla](https://news.walla.co.il/item/3738958) (snippet-level)

### Inferences
- Hypothesis: residents are employees of hospitals (labor-law hearing/שימוע rights) while certification is governed by the Scientific Council, so a "two written opinions + single authorized decider + decision log" model might fit the need for defensible documentation, but I did not verify any regulation requiring it.

### Gaps
- Scientific Council bylaws (תקנון) on discontinuing/extending training, appeals body, and who formally decides: not found.
- Nursing school dismissal/continuation procedures (student committees, appeals): not found beyond yearbook committee mention.

## 3. Segment size

### Takeaway
Roughly 2,000 doctors begin specialty training per year; total number of residents currently in training was not found. Nursing: about 13,000 students enrolled and ~3,500 starting in 2024 (secondary, Russian-language source).

### Cited Findings
- 2,035 doctors began specialty training in 2023, about double 2010 (2022: 1,955) — [Taub Center](https://www.taubcenter.org.il/en/research/physicians-in-israel-trends-in-characteristics-and-training) (per search summary)
- 2,637 new medical licenses in 2024, only 28% of those licensed trained in Israel — [Ynetnews](https://www.ynetnews.com/health_science/article/hjtojh0ht) (per summary)
- Bank of Israel expects Yatziv reform to affect numbers from 2025 and interns to decline in 2025 — [Bank of Israel](https://boi.org.il/en/communication-and-publications/press-releases/analysis-from-the-forthcoming-bank-of-israel-annual-report-for-2024-the-expected-effect-of-the-yatziv-reform-on-the-number-and-quality-of-training-of-physicians-in-israel/)
- Ministry says 2,000 new medical-study places a year to open by 2030 (per Maariv) — [Maariv](https://www.maariv.co.il/news/health/article-1161710)
- Nursing: ~3,500 started nursing programs in 2024, ~13,000 enrolled — [newsru.co.il, May 2025](https://www.newsru.co.il/health/14may2025/ahimahayot505.html) (Russian-language; not verified against Ministry); OECD: graduates tripled 2011–2021 but below OECD average per capita — [OECD](https://www.oecd.org/en/publications/health-at-a-glance-2023_7a7afb35-en/full-report/nursing-graduates_4032015c); 2,272 professional nursing graduates in 2019 — [dataset](https://d3fqfiq2w1ez7u.cloudfront.net/nmx/timeseries/israel-number-of-professional-nursing-graduates)

### Inferences
- Assuming ~4–6 year residencies, a rough standing pool might be on the order of 8,000–12,000 residents; this is my own arithmetic, not sourced.

### Gaps
- Total residents in training, number of accredited hospitals/training programs, number of nursing schools, paramedical figures: not found.

## 4. Decision-maker, payer, procurement

### Takeaway
Not established. Training is governed by Ministry of Health with IMA Scientific Council; hospitals (government, health-fund, voluntary) employ residents.

### Cited Findings
- Scientific Council is advisory to the Ministry per Comptroller; reform has health funds hosting rotations with Treasury adding positions — [Comptroller](https://library.mevaker.gov.il/sites/DigitalLibrary/Documents/2024/2024.07-75A/2024.07-75A-207-Doctors-Taktzir.pdf), [Maariv](https://www.maariv.co.il/news/health/article-1161710)

### Inferences
- Hypothesis: public hospitals/Ministry buy via government tenders (mr.gov.il), making a sale slow; direct purchases by private/voluntary hospitals or nursing colleges may be faster. Unverified.

### Gaps
- No source on budgets, tenders, or who would pay for such software.

## 5. Evidence of pain

### Takeaway
Pain evidence exists around training system management and exam/dismissal disputes, but I found none specifically about evaluation documentation software.

### Cited Findings
- Globes headline quoting the Comptroller on Ministry "helplessness" regarding physician training — [Globes](https://www.globes.co.il/news/article.aspx?did=1001235049)
- Comptroller June 2026 geriatrics report: no significant change in number starting geriatrics specialization despite shortage — [Walla](https://news.walla.co.il/item/3847186) (snippet-level)
- Nov 2024 Comptroller special report on specialist wait times — [report](https://library.mevaker.gov.il/sites/DigitalLibrary/Documents/2024/2024.11-75A-PartB/2024.11-75A-PartB-601-Medical-Specialists.pdf)
- Ynet: thousands of Arab doctors stuck in Israel's residency crisis — [Ynetnews](https://www.ynetnews.com/health_science/article/h14xbj9gme)
- Marash petition over exam failures (see section 2).

### Gaps
- No complaints/reports specifically on unfair dismissal of residents, evaluation inconsistency, or documentation; none for nursing students.

## 6. Competitors

### Takeaway
No Israeli-market competitor identified.

### Cited Findings
- Search for MedHub / New Innovations / one45 in Israel found no Israeli hospital customers — [search result set](https://innovationisrael.org.il/en/importWinner/515774172) (nothing relevant)
- International generic tools: Competency.AI, InPlace (see section 1).

### Inferences
- Hypothesis: absence of evidence may reflect weak web visibility rather than true absence; vendor client lists and direct calls to residency coordinators (e.g., Sheba, Hadassah, Ichilov) are needed.

### Gaps
- Capterra/G2 listings, vendor client lists, hospital in-house systems: not checked/found.
- Recommend whitelisting gov.il, mevaker.gov.il, maariv.co.il, ynet.co.il to read primary documents.
