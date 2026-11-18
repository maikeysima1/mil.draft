# Israeli flight schools, airline cadet programs and uniformed/emergency academies as a customer segment for "training cohort tracking" software

Research status (2026-11-18): the session's WebFetch could not resolve most hosts (ias.co.il, ynetnews.com, aviatize.com), so findings rest on WebSearch result summaries only, not on full-page reads. Treat every item as "seen in a search summary" and confirm against the primary source before use. Many key questions returned nothing; these are listed as Gaps.

## 1. How are cadets/trainees tracked and evaluated today, and with what systems?

### Takeaway
No source found documenting the tracking/evaluation systems used by Israeli police, Fire and Rescue Authority, MDA, prison service, guard-training schools or airline cadet programs. The only system-level evidence is a vendor (Aviatize) claiming Israeli CAAI-specific flight-school features.

### Cited Findings
- Aviatize markets flight-school management software with an Israel-specific page (CAAI oversight, ILS/USD billing, Israeli VAT). This is vendor marketing, not independent verification. — [Aviatize Israel page](https://www.aviatize.com/for/flight-schools-in-israel) (search snippet only; page not fetched)
- The CAAI (רת"א) regulates and supervises flight schools, including licensing; a student-pilot license application is submitted via the flight school or the personal instructor. — [gov.il student pilot license](https://www.gov.il/he/service/apply-for-student-pilot-license)
- A State Comptroller 2022 report on aviation safety (Nov 2022) covers CAAI oversight of the sector; the search summary did not show per-school trainee counts. — [Comptroller 2022.11 309](https://library.mevaker.gov.il/sites/DigitalLibrary/Documents/2022/2022.11/2022.11-309-Teufa.pdf)
- El Al's flight academy trains cadets in Florida at Aviator College of Aeronautical Science & Technology; course price about 65,000 USD; orientation about two weeks at El Al's campus at Ben Gurion, then a flight to Miami; open to Israeli citizens with no prior flying experience; El Al states no commitment to hire graduates. — [IAS article](https://www.ias.co.il/?p=91020); launch coverage [JPost](https://jpost.com/Israel-News/El-Al-to-launch-flight-school-in-the-US-moving-away-from-Israel-Air-Force-560197)
- Israeli Aviation Academy (Eilat): first course about two years, about 255,000 NIS, ends with a commercial license including 200 flight hours (from search summary; source link in results: [Maariv](https://www.maariv.co.il/economy/israel/article-693119) is a related item about a new school in Rosh Pina; the Eilat figures were not tied to a specific URL in my notes, treat as unverified). Also see [JPost 2019, first commercial aviation academy](https://www.pressreader.com/israel/jerusalem-post/20190210/281599536753406).
- Learning-management spec (course/cohort modules) found at osh.org.il is not tied to any of the target organizations. — [osh.org.il spec](https://www.osh.org.il/UploadedImages//10_2018/Learning_Management_111_18_Management_Specification.pdf)

### Inferences
- Because El Al's cadets train in the US at a partner college, the training records (FAA/Part 141 style) likely sit with the US school; an Israeli software vendor would sell to El Al only for the pre-selection/oversight layer (hypothesis).
- Likely tools are Excel/paper plus generic HR/LMS systems in public bodies (hypothesis, no source).

### Gaps
- Systems used by Israeli flight schools, El Al, Israir, Arkia cadet programs: not found.
- Systems used by Israel Police, Fire and Rescue Authority, MDA, Prison Service, security-guard schools: not found.

## 2. How are dismissal/continuation decisions made and documented; who decides; appeal rights?

### Takeaway
No police/fire/MDA/prison/guard-school dismissal procedure was found. Only analogues: IAF flight course (military, not civilian) and general case law on hearings.

### Cited Findings
- IAF Flight Course 191: 15 cadets tried by the Flight Academy commander, sentenced to 3-6 days detention; a dismissal hearing chaired by the head of the Manpower Directorate followed. Military, only loosely analogous. — [Ynetnews](https://www.ynetnews.com/article/skvjnsqf11x); related [Yahoo/ToI](https://www.yahoo.com/news/articles/air-force-delays-pilot-course-190219514.html)
- A senior police officer's dismissal was annulled by a court for lack of a hearing and the minister re-held a hearing (officer, not trainee). — [Walla](https://news.walla.co.il/item/3741129)
- Case law summary (via Din-Rega) cites HCJ 1722/05 Keren v. Police Commissioner: courts defer to the authorities on personnel matters in police/army, limiting intervention. — [Din-Rega](https://www.dinrega.com/gs/%D7%A2%D7%AA%D7%99%D7%A8%D7%94%20%D7%9C%D7%9E%D7%99%D7%A0%D7%95%D7%99%20%D7%A7%D7%A6%D7%99%D7%9F%20%D7%98%D7%9B%D7%A0%D7%95%D7%9C%D7%95%D7%92%D7%99%D7%95%D7%AA%20%D7%95%D7%A7%D7%99%D7%93%D7%95%D7%9E%D7%95%20%D7%9C%D7%93%D7%A8%D7%92%D7%AA%20%D7%A8%D7%91-%D7%9B%D7%9C%D7%90%D7%99) (paywalled; snippet only)
- Prison Service: a cadet who started the guard course (July 2023) was dismissed after a conviction became known; the Service stopped a "shortened recruitment procedure". — [Ynet](https://www.ynet.co.il/news/article/sycndtes0)

### Inferences
- A written, two-opinion, single-decider log fits the administrative-law expectation of a hearing and reasoned decision (hypothesis); it would matter most where trainees are public-employee candidates.

### Gaps
- Internal procedures, decision-maker and appeal routes for police academy, fire, MDA, prison, guard schools: not found. No court ruling about a dismissed cadet from these bodies found in nevo/psakdin searches (search engine cannot query them directly).

## 3. Segment size in Israel

### Takeaway
No reliable counts of schools or cadets per year found for any sub-segment.

### Cited Findings
- Fire and Rescue Authority held its "largest course to date", including 7 women (no figure in snippet). — [Ynet](https://www.ynet.co.il/news/article/b1zoiyru5)
- Police: recruitment of about 2,200 new officers cited in a Comptroller-style audit of training; Central District 116 resignations vs 61 recruits in a news report (undated). — [Comptroller audit list](https://library.mevaker.gov.il/sites/DigitalLibrary/Documents/2018-68c-202-policeminuy.pdf) (relevance of this exact file to the 2,200 figure unconfirmed)
- Guard training: police-supervised guard course of 190 academic hours at a private institute; refresher every six months; theory pass mark 70%. — [gov.il refresher](https://www.gov.il/he/service/refresher-training-for-guards), [gov.il firearm license](https://www.gov.il/he/service/firearm_guard_license_application)

### Inferences
- Guard training and private flight schools are likely many small private operators (hypothesis); no count found.

### Gaps
- Number of CAAI-approved flight schools, cadets per year, MDA course volumes, number of licensed guard-training institutes: not found.

## 4. Decision-maker, payer, tender vs direct purchase, fastest private sub-segment

### Takeaway
Public bodies buy via mr.gov.il tenders; private flight schools, guard institutes and airline academies buy directly. Fastest to sell to is likely private (hypothesis).

### Cited Findings
- Fire and Rescue Authority tenders exist on mr.gov.il, including a training-systems/drills tender that other bodies (Ministry of Public Security, Police, Prison Service) may use; date and number not shown. — [mr.gov.il tender doc](https://mr.gov.il/ilgstorefront/he/p/attachment/005056BF4DAB1EDB80FD9DE420C48123/מסמכי הליך)

### Inferences
- Piloting with a private flight school or an airline academy (El Al, Israir, Arkia) avoids tender rules; public bodies likely need a tender or exemption (hypothesis; the exemption thresholds were not researched).

### Gaps
- Budgets, named buyers, tender thresholds: not found.

## 5. Existing software competitors and what they lack

### Takeaway
Only Aviatize surfaced as a vendor with an Israeli angle. Zenith, Flight Schedule Pro, Bluetail searches returned nothing relevant in this session.

### Cited Findings
- Aviatize (above). The searches did not confirm Zenith/Flight Schedule Pro/Bluetail presence in Israel. — [search result](https://www.aviatize.com/for/flight-schools-in-israel)
- IAI sells a "pilot training academy package" (turnkey), relevant as an adjacent offering. — [IAI](https://www.iai.co.il/product/pilot-training-academy-package/)

### Inferences
- Flight-school tools focus on scheduling, billing and records; a formal dismissal decision room with dual written opinions is probably not a core feature (hypothesis, features not reviewed).

### Gaps
- Feature comparison, Israeli public-sector systems: not found.

## 6. Evidence of pain

### Takeaway
Only military/IAF and one prison-service case found; no civilian cadet litigation or comptroller finding on trainee dismissal.

### Cited Findings
- IAF flight academy discipline case (above). — [Ynetnews](https://www.ynetnews.com/article/skvjnsqf11x)
- Prison Service case (above). — [Ynet](https://www.ynet.co.il/news/article/sycndtes0)
- Comptroller 2022 report on Prison Service medical array does not address course dropout. — [Comptroller](https://library.mevaker.gov.il/sites/DigitalLibrary/Documents/2022/2022.5/2022.5-210-Shabas.docx)

### Gaps
- Comptroller or court evidence on dismissed cadets/trainees in police, fire, MDA, guard schools, civilian flight schools: not found. Recommend direct nevo/psakdin queries, FOI requests, and a mevaker.gov.il search.

## Overall hypotheses (unverified)
- Best first customers: private flight academies and airline cadet programs (direct purchase, small cohorts, selection-heavy, dismissal decisions costly given tuition up to ~65k USD / ~255k NIS).
- Public services: larger cohorts but tender-bound and likely served by internal systems.
- Next steps: fetch primary pages once network allows (ias.co.il, ynetnews.com, aviatize.com), query nevo/psakdin, interview 3-5 schools.
