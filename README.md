# Twiage — Ambient AI Triage for the Emergency Department

**▶ Play with the live demo:** https://claude.ai/code/artifact/e2b985ed-9270-4f1c-a845-f85dd2ebf6da
**▶ Watch the 90-second demo video:** _[YouTube link coming soon — placeholder]_

---

## 1. What we built

An **ambient agent team for ED triage**. While the triage nurse talks to the patient
and takes vitals, an orchestrator and four specialist agents (Scribe, Vitals, Acuity,
Routing) listen and do the documentation:

- The system **hears the chief complaint and selects the right triage template**
  (chest pain / abdominal pain / shortness of breath), rendered as an Epic-style
  navigator whose blank `***` fields **fill themselves live** — every value cited to
  the exact transcript line, color-coded green/yellow/red by confidence.
- **Vitals trend in a flowsheet** (triage + recheck columns). Low-confidence items
  surface as a BestPractice-style advisory to **verify while the patient is still
  present**.
- The nurse's entire note is **one line**; she reviews the completed template, edits
  anything, and clicks **one button** to sign. Everything already structured in the
  EHR stays out of the note.
- The physician — before ever seeing the patient — gets a **strictly S/O clinician
  summary** (they form their own A/P), the **details the nurse never had time to
  chart** (rescued by ambient capture), an **unsigned AI-suggested order set**
  (nurse-protocol orders shown as placed; remove/add/sign as a batch), and a
  **sentiment analysis score** benchmarking the interaction against a corpus of
  scored triage conversations.

Three fully synthetic patients demonstrate it end-to-end — including patients
hospitals most often fail: a man experiencing homelessness with lapsed BP meds, a
woman whose coverage lapsed during incarceration, and a Black woman whose wife is
recognized as her healthcare proxy. Their context is captured **and changes care**
(social work consults, med access, disparity-aware reassessment).

## 2. Why it needs to be built

Real triage lasts exactly as long as a vitals check. Nurses ask directive questions,
never open-ended ones, and chart the bare minimum — so everything a patient
*volunteers* (the med they stopped affording, the prior episodes, the housing story)
**evaporates**. Physicians walk in cold, re-ask everything, and the patients with the
most context to lose — underserved, uninsured, justice-involved, LGBTQ+, patients of
color — lose the most. Twiage captures the whole conversation, gives the nurse back
her hands, hands the physician a cited pre-visit brief with the workup already teed
up, and makes acuity (ESI v5) and routing decisions transparent and verifiable.

## 3. How we built it

- **Data**: 3 synthetic encounters in the exact [Abridge `synthetic-ambient-fhir-25`](synthetic-ambient-fhir-25/)
  record schema (FHIR R4 resources, speaker-labeled transcripts, notes, AVS),
  extended with a `triage` block — form fields with per-field transcript citations +
  confidence, template metadata, ESI v5 acuity logic, vitals trend, orders, sentiment
  ([schema conventions](CLAUDE.md), [clinical knowledge base](ed-triage-knowledge.yaml)
  distilled from the AHRQ/ENA ESI Handbook v5, ENA/ACEP guidance).
- **Multi-agent authoring with adversarial verification**: every encounter was
  generated and revised by orchestrated agent workflows in which independent verifier
  agents re-derived every claim — **30+ grounding defects caught and fixed** (wrong
  timezone offsets, a fabricated surname, ROS negatives never actually spoken,
  race inferred from a name instead of registered FHIR US Core demographics,
  assessment language smuggled into an S/O note).
- **App**: React + Vite + Tailwind (shadcn-style components) in Cursor's palette,
  built test-first (red→green TDD, 26 unit tests on the replay/review/orders engine),
  bundled to a single self-contained HTML file and published as a Claude Artifact.
  The full flow was driven end-to-end in a real browser before every release.
- **Clinician-in-the-loop**: four iterations shaped directly by feedback from our MD
  co-founder — conversation realism, one-line RN notes, Epic-navigator fidelity,
  S/O-only physician notes.

## 4. Try it

**Demo:** https://claude.ai/code/artifact/e2b985ed-9270-4f1c-a845-f85dd2ebf6da
Pick **Marcus Bell** → watch the template select itself and fill → **Skip** →
**Nurse review** → **Accept & Sign** → explore the physician view (Unsigned work,
Captured, RN note, Sentiment analysis).

**Demo video:** _[YouTube link coming soon — placeholder]_

---

*Everything is synthetic (Synthea + generated dialogue grounded in structured
records). No real patient data. Demo only — not a medical device.*
