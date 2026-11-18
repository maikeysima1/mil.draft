# Israeli privacy, labor and administrative-law constraints on a trainee-evaluation / dismissal-support software product

NOTE: Research notes, not legal advice. Research limitation: WebFetch could not reach any external host in this session (nblaw.com, kolzchut.org.il, loc.gov, gov.il all failed DNS resolution; they would need to be allowed in the session's network settings). All findings below therefore come from WebSearch result summaries, not from reading the full pages or statute text. Anything marked "unverified" must be checked against the statute, a PPA guide or Nevo before use. Search snippets from the tool are paraphrased by the tool, so figures should be treated as secondary-source claims.

## 1. Privacy Protection Law 1981 and Amendment 13 (in force 14 Aug 2025): registration, DPO, security, access/correction, sensitive data

### Takeaway
Amendment 13 took effect on 14 August 2025 and narrows database registration, adds a DPO duty for some organizations (including public bodies and large-scale sensitive-data processors), and raises enforcement exposure; the 2017 Data Security Regulations impose tiered security duties plus breach notification. A trainee-evaluation database is personal data held by customers, and likely makes both the customer (as owner) and the vendor (as holder/processor under the regulations) subject to these duties.

### Cited Findings
- Amendment 13 took effect 14 August 2025; the Knesset approved it 5 August 2024; the PPA published a professional guide on 14 August 2025 — [Library of Congress via search summary](https://www.loc.gov/item/global-legal-monitor/2025-11-17/israel-amendment-to-privacy-protection-law-goes-into-effect/); [Vixio](https://www.vixio.com/insights/pc-regulatory-influencer-israel-modernises-privacy-law-comprehensive); [PPA guide notice](https://digitalpolicyalert.org/event/32797-privacy-protection-authority-released-professional-guide-for-privacy-protection-law-amendment-no-13)
- Registration duty narrowed: public bodies and direct-marketing databases above 10,000 individuals (per one source); another source says a database with highly sensitive information on more than 100,000 individuals must notify the PPA of its existence. Sources differ; thresholds not verified against statute — [Vixio](https://www.vixio.com/insights/pc-regulatory-influencer-israel-modernises-privacy-law-comprehensive); [Baker McKenzie handbook](https://resourcehub.bakermckenzie.com/en/resources/global-data-and-cyber-handbook/emea/israel/topics/dpos-and-notification-requirements); [Chambers 2026](https://chambers.com/practice-guides/guides/data-protection-privacy-2026/israel/law-and-practice)
- DPO required for certain organizations: public bodies, data brokers, organizations whose main activity is large-scale processing of especially sensitive data or systematic monitoring; may be internal or external — [Chambers 2026](https://chambers.com/practice-guides/guides/data-protection-privacy-2026/israel/law-and-practice); [Baker McKenzie](https://resourcehub.bakermckenzie.com/en/resources/global-data-and-cyber-handbook/emea/israel/topics/dpos-and-notification-requirements); [Afik law](https://www.afiklaw.com/articles/a445)
- Amendment renamed "sensitive" to "data of special sensitivity" (similar to GDPR special categories); listed types include biometric, genetic, location/traffic data and criminal records — [Chambers 2026](https://chambers.com/practice-guides/guides/data-protection-privacy-2026/israel/law-and-practice); [mineos summary](https://www.mineos.ai/articles/israels-amendment-13-a-new-era-for-privacy)
- Exemplary damages up to NIS 10,000 without proof of harm, only for causes of action arising after 14 Aug 2025 — [Library of Congress](https://www.loc.gov/item/global-legal-monitor/2025-11-17/israel-amendment-to-privacy-protection-law-goes-into-effect/)
- Data Security Regulations 2017 apply to anyone owning, managing or maintaining a database of personal data; four security tiers (basic, medium, high, individually managed); mandatory breach notification to the PPA; in force May 2018 — [Mondaq](https://www.mondaq.com/privacy-protection/583350/new-data-security-regulations-contain-new-requirements-for-database-administrators); [law.co.il](https://www.law.co.il/en/articles/2017/03/26/dramatic-overhaul-israeli-data-security-regulations/); [Meitar](https://meitar.com/wp-content/uploads/2021/08/new_israel_privacy_protection_regulations.pdf). Sources differ on the exact timing/wording.
- Section 13 gives every person a right to inspect personal information about them held in a database; section 14 gives a right to request correction; PPA guidance on candidate screening tests mentions both rights; Kol Zchut says a candidate who underwent screening is entitled to see the expert opinion prepared about them, free of charge — search result summaries of [Kol Zchut](https://www.kolzchut.org.il/he/עיון_של_מועמד_לעבודה_בחוות_דעת_שנכתבה_עליו_במכון_מיון) and [gov.il recruitment guideline](https://www.gov.il/BlobFolder/legalinfo/recruitment_guidelines/he/recruitment_guidelines_02..pdf) (pages not opened)

### Inferences
- Trainee evaluations (scores, instructor comments, psychometric or medical fitness notes, and any biometric or health inputs) are personal data; health/biometric elements likely fall in the special-sensitivity tier, which pushes toward higher security tier and possibly DPO/notification duties for large public customers (police, fire, MDA, universities).
- Product design implications: per-subject export of all evaluation records (access), correction/annotation workflow that preserves history (rather than overwriting), role-based access with audit logs, encryption, breach-incident workflow and reporting aid, retention schedules and deletion, field-level flagging of sensitive data, vendor DPA covering security duties.
- Vendor is probably a "holder"/processor for customers; customers remain owners and carry primary registration and DPO duties (inference; processor definition not verified).

### Gaps
- Exact statutory thresholds for registration and DPO, and the post-amendment text of sections 13-14 (including exceptions and response deadlines), could not be verified because pages could not be opened.
- Whether internal performance evaluations of employees/trainees are fully within section 13 (versus exceptions such as privileged or third-party information) was not found in a clear source.
- Retention periods: no Israeli statutory retention rule specific to trainee evaluations was found; the general purpose-limitation principle applies (inference).

## 2. Labor law: hearing, trainees/apprentices, discrimination, undocumented decisions

### Takeaway
Israeli case law requires a pre-dismissal hearing grounded in good faith, applicable to public and private employers; skipping or faking it exposes the employer to compensation or reinstatement. Apprentice/intern-specific rules were not found.

### Cited Findings
- The hearing duty derives from case law and good faith, not a statute; the National Labor Court treats it as substantive, not a formality, and a missing hearing is a defect in the dismissal itself — [bizportal](https://www.bizportal.co.il/general/news/article/228717); [olam-haavoda](https://olam-haavoda.co.il/topics/hearing-duty)
- Applies to all employees regardless of tenure; employee should be summoned with reasonable notice (2-3 days at least, per Kol Zchut) and told the reasons — [Kol Zchut](https://www.kolzchut.org.il/he/%D7%A9%D7%99%D7%9E%D7%95%D7%A2_%D7%9C%D7%A4%D7%A0%D7%99_%D7%A4%D7%99%D7%98%D7%95%D7%A8%D7%99%D7%9D)
- A late hearing can sometimes cure a defect only if held in good faith with real openness to change the decision; a gap of about four months was reported as severing the link between hearing and decision; one reported award was NIS 50,000 for a defective process — [workrights.co.il](https://www.workrights.co.il/שימוע-מאוחר); [workrights.co.il](https://www.workrights.co.il/4-חודשים-אחרי); [bizportal](https://www.bizportal.co.il/general/news/article/199590)
- Hearing duty can be relaxed for fixed-term employment or redundancy dismissals — [bizportal](https://www.bizportal.co.il/general/news/article/199590)
- Apprenticeship Law 1953 defines an apprentice (age 18+, bound by an apprenticeship declaration) and a supervising official — [Knesset text](https://fs.knesset.gov.il/2/law/2_lsr_208404.pdf)

### Inferences
- Documented evaluations over time, notice to the trainee, record of the hearing and a reasoned decision are the evidence a court would look for; undocumented or after-the-fact reasons are the vulnerability (inferred from the good-faith and genuine-hearing rationale; no specific ruling on undocumented decisions was retrieved).
- Product design: timeline of evaluations, warnings/improvement plan, hearing invitation templates with notice period, hearing minutes, decision with reasons, appeal step.

### Gaps
- No source found on whether the Apprenticeship Law requires a hearing before ending an apprenticeship, or on interns in regulated professions (התמחות).
- Equal Employment Opportunities Law was not researched with sources (no result retrieved); only general inference that evaluation criteria must be non-discriminatory.
- No specific National Labor Court case names/numbers were retrieved; Nevo/Takdin searches were not possible.

## 3. Administrative law for public bodies

### Takeaway
Public authorities must give reasons and hear the affected person before harmful decisions; a trainee dismissal by a public body is likely covered, but I found no ruling specific to trainees.

### Cited Findings
- Public authorities must answer written requests with written reasons (Decisions and Reasons law), and reasons enable self-review and judicial review — [Kol Zchut](https://www.kolzchut.org.il/he/%D7%97%D7%95%D7%91%D7%AA_%D7%A8%D7%A9%D7%95%D7%AA_%D7%A6%D7%99%D7%91%D7%95%D7%A8%D7%99%D7%AA_%D7%9C%D7%AA%D7%AA_%D7%AA%D7%A9%D7%95%D7%91%D7%94_%D7%9E%D7%A0%D7%95%D7%9E%D7%A7%D7%AA_%D7%9C%D7%A4%D7%A0%D7%99%D7%99%D7%94_%D7%A9%D7%9C_%D7%90%D7%96%D7%A8%D7%97); [Nadlan Center](https://www.nadlancenter.co.il/article/9608)
- Right to be heard applies when an authority is about to harm someone; dismissal is a teaching example — [course handout](https://netanya.ac.il/gur/data/AGUDA/law/yearb/managers/משפט מנהלי- תרגול.pdf) (secondary source)

### Inferences
- Police, fire, MDA and public colleges likely need reasoned, reviewable records; the product's reasons field and audit trail serve this (inference).

### Gaps
- No Supreme Court/administrative court decision on terminating a trainee was found; internal appeal bodies for specific institutions not researched.

## 4. Trainee access to written evaluations

### Takeaway
Access flows from section 13 of the Privacy Protection Law; PPA/Kol Zchut treat screening opinions as accessible, free of charge. Whether every internal instructor comment must be disclosed was not resolved.

### Cited Findings
- See section 1 (section 13/14 and the Kol Zchut / gov.il candidate-screening guidance).
- PPA guidance on access to recordings and digital information exists — [gov.il](https://www.gov.il/BlobFolder/legalinfo/right_of_access/ar/av_recordings.pdf) (not opened)

### Inferences
- Design assuming trainees can see their own evaluations (plain-language, factual, no gratuitous opinions), with a controlled self-service view and redaction for third-party data (e.g., other trainees, informants).

### Gaps
- Exceptions to access and exact deadlines unverified.

## 5. Cloud hosting and data residency

### Takeaway
Israel has no general data-localization rule for private-sector data found here, but the 2001 Transfer of Data Abroad Regulations restrict export unless recipient-country protection is adequate or another listed condition is met; cloud use is treated as outsourcing.

### Cited Findings
- Transfer regulations prohibit export of personal data from Israeli databases except under alternative conditions (adequate protection, consent, EEA-equivalent countries, etc.) — [6clicks summary](https://marketplace.6clicks.com/c/israel-privacy-protection-transfer-of-data-to-databases-abroad-regulations-5761-2001); [Pearl Cohen](https://www.pearlcohen.com/israeli-privacy-protection-authority-issues-guidelines-on-data-transfers)
- Cloud services are treated as outsourcing; foreign providers can be directly subject to the law; EU SCCs are not a substitute for the Israeli test; the PPA relaxed onward-transfer rules in 2022 and issued a July 2024 draft opinion on transfer agreements (finalization not confirmed) — [Mondaq](https://webiis08.mondaq.com/data-protection/585400/how-will-the-privacy-shield-impact-the-use-of-cloud-services-by-israeli-companies); [Goodwin](https://goodwinlaw.com/en/insights/blogs/2022/01/israels-privacy-regulator-relaxes-onward-transfers); [Gornitzky](https://www.gornitzky.com/cross-border-data-transfer-agreements-the-position-of-the-israeli-privacy-protection-authority/)

### Inferences
- Police/fire/MDA/academia customers (public bodies, security-sensitive) will likely demand Israel-region hosting or on-prem regardless of the law (market/procurement inference, not verified; Israeli government cloud tender "Nimbus" and public-sector rules were not researched).
- Offer an Israel-region deployment option as a default.

### Gaps
- Public-sector and defense-sector hosting rules (e.g., Government cloud policy, Ministry of Defense/security-body requirements) not found.
- Current status of EU adequacy review not verified.

## 6. Selling point vs. barrier

### Takeaway
Mainly inference; no source directly quantifies this.

### Inferences
- Selling point: the labor-court emphasis on genuine hearings and documented reasons, and administrative duty to give reasons, make structured records, hearing workflows and audit trails valuable risk-reducers for customers.
- Barrier: sensitive-data security obligations, DPO/registration for large public customers, breach reporting, access rights (the trainee can see what the instructor wrote), cross-border limits, and procurement demand for Israel hosting raise the cost of entry and lengthen sales cycles.
- Product risk: a system that aggregates scores and drives automated dismissal recommendations may heighten exposure (profiling/automated-decision issues were not researched here; treat as open question).

### Gaps
- No sourced evidence on customer willingness to pay or on enforcement trends; PPA enforcement actions against employers not researched.
