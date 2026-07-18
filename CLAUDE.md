# twiage

ED triage project. Reference knowledge base: `ed-triage-knowledge.yaml` (Epic-style
triage templates for chest pain, abdominal pain, and shortness of breath, with ESI v5
acuity logic). Reference dataset: `synthetic-ambient-fhir-25/` (25 synthetic clinical
encounters from Abridge, Synthea-based).

## Data formatting style

Follow the conventions of `synthetic-ambient-fhir-25/` for any clinical data we
generate or transform in this repo.

### Dataset packaging

A dataset ships as a folder containing:
- `<name>.jsonl` — canonical form, one JSON record per line
- `<name>.json` — the same records as a single JSON array
- `schema.json` — JSON Schema (draft 2020-12) for one record, `additionalProperties: false`
- `summary.json` — index: `{name, records, patients, date_range, synthetic, index: [...]}`
  where each index entry has the record `id`, date, `visit_title`, demographics, and
  word/resource counts
- `README.md` — file table, record structure, Python + jq quickstart, data notes
- `index.html` — optional self-contained browser (no server needed)

### Record conventions

- Keys are `snake_case`; embedded FHIR resources keep FHIR's native `camelCase`.
- `id` is composite: `"<patient_id>::<encounter_id>"`.
- Dates are ISO 8601 with UTC offset (`2022-08-05T05:19:56-07:00`); index/summary
  dates are `YYYY-MM-DD`.
- `metadata` always carries `source`, `synthetic: true`, IDs, `date`, `status`, coded
  `visit_type` (SNOMED display text, e.g. "General examination of patient (procedure)"),
  a human-readable `visit_title` ("Annual physical — preventive screening and migraine
  check-in"), and `related_resource_counts` per FHIR resource type.
- Structured clinical context is standard **FHIR R4**: `patient_context.patient` is a
  FHIR `Patient`; `encounter_fhir` holds the `Encounter` plus `related_resources`
  grouped by resource type (Condition, Observation, Procedure, DiagnosticReport,
  MedicationRequest, Immunization, ...). Codes use their canonical systems
  (SNOMED CT, LOINC, RxNorm) with `coding[].system/code/display` plus `text`.
- `patient_context.longitudinal_summary` gives chart background as
  `resource_counts` (per-type ints), `condition_labels`, and `medication_labels`
  (FHIR display strings, kept verbatim including "(finding)"/"(disorder)" suffixes).

### Narrative conventions

- **Transcripts**: word-for-word ambient conversation, plain text, one utterance per
  line, speaker-labeled with uppercase prefixes `DR:`, `PT:`, `NURSE:`, `FAMILY:`.
  Natural spoken register; no stage directions or markdown.
- **Clinical notes**: SOAP-style markdown with bold inline headers —
  `**Subjective:**`, `**Objective:**`, `**Assessment and Plan:**` — each followed by
  flowing prose paragraphs (not bullet fragments). Narrative is grounded strictly in
  the structured record; numbers match the FHIR observations.
- **After-visit summaries**: patient-facing plain text with a `Visit summary` title
  and two sections, `What we discussed` and `Next steps`, each a `•` bullet list in
  plain patient-friendly language.
- Any derived artifact carries a provenance object, e.g.
  `after_visit_summary_provenance: {method, source, review_status}` — state the
  extraction method and that content is `not_clinically_reviewed` unless it has been.

### Triage extension (v2, per MD feedback 2026-07-18)

Encounter records add a `triage` block to the Abridge 8 keys:
- Transcripts are vitals-length (18–30 lines): the nurse asks directive closed
  questions only, never open-ended, never chases volunteered info; patients/family
  volunteer extras the nurse ignores — the ambient agent "rescues" those.
- Every form field carries `nurse_documented` (bool): true = the minimal RN chart
  (CC, onset, severity, one qualifier, 1–2 relational facts, vitals, allergies,
  safety check-offs; 12–17 fields); false = captured for the physician only.
- Confidence bands: green ≥0.90, yellow 0.70–0.89, red <0.70 (red = nurse
  verify-while-patient-present queue). Vitals ≥0.96; include 2–3 red fields.
- `triage.nurse_note`: the entire RN note — 2–3 telegraphic bullet lines.
- `triage.physician_note`: MD-style bullet note (one-liner → contributing history →
  HPI bullets → pertinent ROS with negatives actually said at triage → social
  context → triage course).
- `triage.nurse_orders`: protocol orders the RN already placed (ECG, ASA, nebs,
  urine hCG…). `triage.suggested_orders`: 4–7 AI-suggested unsigned orders
  (labeled AI-generated in UI; physician can exclude/add, then sign the set).
- `triage.template` (v3): the complaint-specific template identity —
  `{smartphrase (.TRIAGECP/.TRIAGEABD/.TRIAGESOB), display_name,
  selected_after_utterance, extra_slots[{section,label}]}`. The UI renders the
  form as this fill-in-the-blank template: shared header (arrival+vitals) only
  until the chief complaint is spoken, then the orchestrator visibly selects the
  template and its sections snap in with `***` blanks that fill live;
  `extra_slots` are slots the short encounter never covers, shown as
  "— not obtained at triage" at review. Nurse review is a single
  "OK — sign triage" click (edits + red queue remain).

### Safety/data notes

- All patient data in this repo must be synthetic; mark it `"synthetic": true` in
  metadata and say so in the README. Never commit real patient data (PHI).
- Epic Foundation navigator content is proprietary — templates here are original
  reconstructions for analysts to rebuild, not copies.
