import { describe, expect, test } from "bun:test";
import {
  parseTranscript,
  fieldsRevealedAt,
  esiRevealedAt,
  initialReview,
  reviewReducer,
  allResolved,
  replayProgress,
  validateEncounter,
  type TriageField,
} from "./replay";

const transcript = [
  "NURSE: Hi, I'm Sam, I'll be doing your triage today. What brings you in?",
  "PT: My chest has been hurting for about an hour.",
  "NURSE: Let me get a set of vitals. Blood pressure is 158 over 94, heart rate 96.",
  "PT: It presses into my left arm and jaw.",
  "FAMILY: She used her inhaler four times already.",
  "NURSE: Any allergies to medications?",
  "PT: No allergies.",
].join("\n");

const fields: TriageField[] = [
  {
    id: "chief_complaint",
    section: "arrival",
    label: "Chief complaint",
    value: "Chest pain x 1 hour",
    source_type: "transcript",
    utterance_indices: [1],
    fires_after_utterance: 1,
    agent: "scribe",
    confidence: 0.95,
    requires_verification: false,
  },
  {
    id: "bp",
    section: "vitals",
    label: "Blood pressure",
    value: "158/94",
    source_type: "device",
    utterance_indices: [2],
    fires_after_utterance: 2,
    agent: "vitals",
    confidence: 0.99,
    requires_verification: false,
  },
  {
    id: "radiation",
    section: "hpi",
    label: "Radiation",
    value: "Left arm and jaw",
    source_type: "transcript",
    utterance_indices: [3],
    fires_after_utterance: 3,
    agent: "scribe",
    confidence: 0.9,
    requires_verification: false,
  },
  {
    id: "allergies",
    section: "history",
    label: "Allergies",
    value: "NKDA",
    source_type: "transcript",
    utterance_indices: [5, 6],
    fires_after_utterance: 6,
    agent: "scribe",
    confidence: 0.85,
    requires_verification: true,
  },
];

describe("parseTranscript", () => {
  test("splits lines into speaker-tagged utterances", () => {
    const u = parseTranscript(transcript);
    expect(u.length).toBe(7);
    expect(u[0]).toEqual({
      speaker: "NURSE",
      text: "Hi, I'm Sam, I'll be doing your triage today. What brings you in?",
    });
    expect(u[4].speaker).toBe("FAMILY");
    expect(u[6]).toEqual({ speaker: "PT", text: "No allergies." });
  });
});

describe("fieldsRevealedAt", () => {
  test("reveals nothing before any utterance is shown", () => {
    expect(fieldsRevealedAt(fields, 0)).toEqual([]);
  });
  test("reveals a field only once its firing utterance is visible", () => {
    // cursor = number of visible lines; utterance i is visible when cursor >= i + 1
    expect(fieldsRevealedAt(fields, 2).map((f) => f.id)).toEqual(["chief_complaint"]);
    expect(fieldsRevealedAt(fields, 3).map((f) => f.id)).toEqual(["chief_complaint", "bp"]);
    expect(fieldsRevealedAt(fields, 7).map((f) => f.id)).toEqual([
      "chief_complaint",
      "bp",
      "radiation",
      "allergies",
    ]);
  });
});

describe("esiRevealedAt", () => {
  test("gates ESI card on its firing utterance", () => {
    expect(esiRevealedAt({ fires_after_utterance: 6 }, 6)).toBe(false);
    expect(esiRevealedAt({ fires_after_utterance: 6 }, 7)).toBe(true);
  });
});

describe("replayProgress", () => {
  test("is the fraction of fields revealed", () => {
    expect(replayProgress(fields, 0)).toBe(0);
    expect(replayProgress(fields, 3)).toBe(0.5);
    expect(replayProgress(fields, 7)).toBe(1);
  });
});

describe("review reducer", () => {
  test("starts every field as proposed with the agent value", () => {
    const s = initialReview(fields);
    expect(s.bp).toEqual({ status: "proposed", value: "158/94" });
  });
  test("accept marks a field accepted, keeping value", () => {
    const s = reviewReducer(initialReview(fields), { type: "accept", id: "bp" });
    expect(s.bp).toEqual({ status: "accepted", value: "158/94" });
  });
  test("edit overrides the value and marks it edited", () => {
    const s = reviewReducer(initialReview(fields), {
      type: "edit",
      id: "allergies",
      value: "Penicillin (hives)",
    });
    expect(s.allergies).toEqual({ status: "edited", value: "Penicillin (hives)" });
  });
  test("accept_all resolves proposed fields but preserves edits", () => {
    let s = reviewReducer(initialReview(fields), {
      type: "edit",
      id: "allergies",
      value: "Penicillin (hives)",
    });
    s = reviewReducer(s, { type: "accept_all" });
    expect(s.bp.status).toBe("accepted");
    expect(s.allergies).toEqual({ status: "edited", value: "Penicillin (hives)" });
    expect(allResolved(s)).toBe(true);
  });
  test("allResolved is false while any field is proposed", () => {
    expect(allResolved(initialReview(fields))).toBe(false);
  });
});

describe("validateEncounter", () => {
  const minimal = {
    id: "p::e",
    metadata: { synthetic: true },
    patient_context: {},
    encounter_fhir: {},
    transcript,
    note: "**Subjective:** x **Objective:** y **Assessment and Plan:** z",
    after_visit_summary: "Visit summary",
    after_visit_summary_provenance: {},
    triage: {
      chief_complaint: "chest pain",
      form: { sections: [{ id: "arrival", title: "Arrival" }], fields },
      esi: { level: 2, fires_after_utterance: 6 },
      routing: { zone: "Acute", fires_after_utterance: 6 },
      physician_handoff: "brief",
    },
  };

  test("accepts a well-formed encounter", () => {
    expect(validateEncounter(minimal)).toEqual([]);
  });
  test("flags utterance indices beyond the transcript", () => {
    const bad = structuredClone(minimal);
    bad.triage.form.fields[0].utterance_indices = [99];
    expect(validateEncounter(bad).length).toBeGreaterThan(0);
  });
  test("flags fires_after_utterance earlier than cited evidence", () => {
    const bad = structuredClone(minimal);
    bad.triage.form.fields[3].fires_after_utterance = 4; // cites lines 5,6
    expect(validateEncounter(bad).some((e) => e.includes("allergies"))).toBe(true);
  });
  test("flags missing top-level keys", () => {
    const bad: Record<string, unknown> = { ...minimal };
    delete bad.note;
    expect(validateEncounter(bad).some((e) => e.includes("note"))).toBe(true);
  });
});

// ---- v2: MD-feedback features ----
import {
  confidenceBand,
  nurseFields,
  rescuedFields,
  redQueue,
  initialOrders,
  ordersReducer,
  finalOrders,
  type SuggestedOrder,
} from "./replay";

const v2fields = fields.map((f, i) => ({ ...f, nurse_documented: i !== 2 }));

describe("confidenceBand", () => {
  test("bands at >=0.90 green, 0.70-0.89 yellow, <0.70 red", () => {
    expect(confidenceBand(0.95)).toBe("green");
    expect(confidenceBand(0.9)).toBe("green");
    expect(confidenceBand(0.89)).toBe("yellow");
    expect(confidenceBand(0.7)).toBe("yellow");
    expect(confidenceBand(0.69)).toBe("red");
    expect(confidenceBand(0.5)).toBe("red");
  });
});

describe("nurse/rescued field split", () => {
  test("nurseFields keeps only nurse_documented", () => {
    expect(nurseFields(v2fields).map((f) => f.id)).toEqual(["chief_complaint", "bp", "allergies"]);
  });
  test("rescuedFields keeps the rest", () => {
    expect(rescuedFields(v2fields).map((f) => f.id)).toEqual(["radiation"]);
  });
});

describe("redQueue", () => {
  test("collects revealed nurse-documented fields under 0.70", () => {
    const mixed = v2fields.map((f) =>
      f.id === "allergies" ? { ...f, confidence: 0.62 } : f,
    );
    expect(redQueue(mixed, 7).map((f) => f.id)).toEqual(["allergies"]);
    expect(redQueue(mixed, 3)).toEqual([]); // allergies not yet revealed
  });
});

describe("physician orders", () => {
  const suggested: SuggestedOrder[] = [
    { id: "trop", name: "hs-Troponin", detail: "now + 2h", rationale: "rule out MI" },
    { id: "cxr", name: "Portable CXR", detail: "1 view", rationale: "widened mediastinum check" },
  ];

  test("all suggested orders start included and unsigned", () => {
    const s = initialOrders(suggested);
    expect(s.included).toEqual({ trop: true, cxr: true });
    expect(s.signed).toBe(false);
  });
  test("toggle excludes an order; add appends a custom one", () => {
    let s = ordersReducer(initialOrders(suggested), { type: "toggle", id: "cxr" });
    s = ordersReducer(s, { type: "add", name: "CBC", detail: "with diff" });
    const final = finalOrders(suggested, s);
    expect(final.map((o) => o.name)).toEqual(["hs-Troponin", "CBC"]);
    expect(final[1].custom).toBe(true);
  });
  test("sign locks the set", () => {
    const s = ordersReducer(initialOrders(suggested), { type: "sign" });
    expect(s.signed).toBe(true);
  });
});

// ---- v3: template selection ----
import { templateSelectedAt, templateSections } from "./replay";

describe("template selection", () => {
  const sections = [
    { id: "arrival", title: "Arrival" },
    { id: "vitals", title: "Vitals" },
    { id: "hpi", title: "HPI" },
    { id: "history", title: "History" },
    { id: "screenings", title: "Screenings" },
  ];
  test("selection fires only after its utterance is visible", () => {
    expect(templateSelectedAt({ selected_after_utterance: 3 }, 3)).toBe(false);
    expect(templateSelectedAt({ selected_after_utterance: 3 }, 4)).toBe(true);
  });
  test("before selection only the shared header sections render", () => {
    expect(templateSections(sections, false).map((s) => s.id)).toEqual(["arrival", "vitals"]);
  });
  test("after selection the full template renders", () => {
    expect(templateSections(sections, true).length).toBe(5);
  });
});

// ---- v4: vitals trend columns ----
import { visibleTrendColumns, type VitalsTrend } from "./replay";

describe("visibleTrendColumns", () => {
  const trend: VitalsTrend = {
    rows: ["HR", "BP"],
    columns: [
      { label: "14:46", fires_after_utterance: 5, values: { HR: "96", BP: "158/94" } },
      { label: "14:58 (recheck)", fires_after_utterance: 29, values: { HR: "92", BP: "152/90" } },
    ],
  };
  test("no columns before vitals are taken", () => {
    expect(visibleTrendColumns(trend, 5)).toEqual([]);
  });
  test("first column once vitals spoken; recheck only at the end", () => {
    expect(visibleTrendColumns(trend, 6).map((c) => c.label)).toEqual(["14:46"]);
    expect(visibleTrendColumns(trend, 29).map((c) => c.label)).toEqual(["14:46"]);
    expect(visibleTrendColumns(trend, 30).map((c) => c.label)).toEqual(["14:46", "14:58 (recheck)"]);
  });
});
