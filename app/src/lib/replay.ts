export type Speaker = "NURSE" | "PT" | "FAMILY";

export interface Utterance {
  speaker: Speaker;
  text: string;
}

export type AgentName = "scribe" | "vitals" | "esi" | "routing";

export interface TriageField {
  id: string;
  section: string;
  label: string;
  value: string;
  unit?: string;
  source_type: "transcript" | "device" | "registration" | "agent_inference";
  utterance_indices: number[];
  fires_after_utterance: number;
  agent: AgentName;
  confidence: number;
  requires_verification: boolean;
  /* v2: false = captured ambiently but not part of the RN's chart (physician-only) */
  nurse_documented?: boolean;
}

export interface ReviewEntry {
  status: "proposed" | "accepted" | "edited";
  value: string;
}

export type ReviewState = Record<string, ReviewEntry>;

export type ReviewAction =
  | { type: "accept"; id: string }
  | { type: "edit"; id: string; value: string }
  | { type: "accept_all" }
  | { type: "reset"; fields: TriageField[] };

export function parseTranscript(transcript: string): Utterance[] {
  return transcript
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const m = line.match(/^(NURSE|PT|FAMILY):\s*(.*)$/);
      if (m) return { speaker: m[1] as Speaker, text: m[2] };
      return { speaker: "NURSE", text: line };
    });
}

// cursor = number of transcript lines currently visible; utterance i is
// visible once cursor >= i + 1, so a field fires when cursor > fires_after_utterance.
export function fieldsRevealedAt(fields: TriageField[], cursor: number): TriageField[] {
  return fields.filter((f) => cursor > f.fires_after_utterance);
}

export function esiRevealedAt(esi: { fires_after_utterance: number }, cursor: number): boolean {
  return cursor > esi.fires_after_utterance;
}

export function replayProgress(fields: TriageField[], cursor: number): number {
  if (fields.length === 0) return 0;
  return fieldsRevealedAt(fields, cursor).length / fields.length;
}

export function initialReview(fields: TriageField[]): ReviewState {
  const state: ReviewState = {};
  for (const f of fields) state[f.id] = { status: "proposed", value: f.value };
  return state;
}

export function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
  switch (action.type) {
    case "accept": {
      const entry = state[action.id];
      if (!entry) return state;
      return { ...state, [action.id]: { ...entry, status: "accepted" } };
    }
    case "edit":
      return { ...state, [action.id]: { status: "edited", value: action.value } };
    case "accept_all": {
      const next: ReviewState = {};
      for (const [id, entry] of Object.entries(state)) {
        next[id] = entry.status === "proposed" ? { ...entry, status: "accepted" } : entry;
      }
      return next;
    }
    case "reset":
      return initialReview(action.fields);
  }
}

export function allResolved(state: ReviewState): boolean {
  return Object.values(state).every((e) => e.status !== "proposed");
}

/* ---- v2: confidence banding, nurse/rescued split, physician orders ---- */

export type ConfidenceBand = "green" | "yellow" | "red";

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 0.9) return "green";
  if (confidence >= 0.7) return "yellow";
  return "red";
}

export function nurseFields<T extends { nurse_documented?: boolean }>(fields: T[]): T[] {
  return fields.filter((f) => f.nurse_documented !== false);
}

export function rescuedFields<T extends { nurse_documented?: boolean }>(fields: T[]): T[] {
  return fields.filter((f) => f.nurse_documented === false);
}

export function redQueue(fields: TriageField[], cursor: number): TriageField[] {
  return fieldsRevealedAt(nurseFields(fields), cursor).filter(
    (f) => confidenceBand(f.confidence) === "red",
  );
}

export interface SuggestedOrder {
  id: string;
  name: string;
  detail: string;
  rationale: string;
}

export interface FinalOrder extends SuggestedOrder {
  custom?: boolean;
}

export interface OrdersState {
  included: Record<string, boolean>;
  added: { id: string; name: string; detail: string }[];
  signed: boolean;
}

export type OrdersAction =
  | { type: "toggle"; id: string }
  | { type: "add"; name: string; detail: string }
  | { type: "sign" }
  | { type: "reset"; suggested: SuggestedOrder[] };

export function initialOrders(suggested: SuggestedOrder[]): OrdersState {
  const included: Record<string, boolean> = {};
  for (const o of suggested) included[o.id] = true;
  return { included, added: [], signed: false };
}

export function ordersReducer(state: OrdersState, action: OrdersAction): OrdersState {
  switch (action.type) {
    case "toggle":
      return { ...state, included: { ...state.included, [action.id]: !state.included[action.id] } };
    case "add":
      return {
        ...state,
        added: [
          ...state.added,
          { id: `custom_${state.added.length + 1}`, name: action.name, detail: action.detail },
        ],
      };
    case "sign":
      return { ...state, signed: true };
    case "reset":
      return initialOrders(action.suggested);
  }
}

export function finalOrders(suggested: SuggestedOrder[], state: OrdersState): FinalOrder[] {
  return [
    ...suggested.filter((o) => state.included[o.id]),
    ...state.added.map((a) => ({ ...a, rationale: "added by physician", custom: true })),
  ];
}

/* ---- v3: complaint-specific template selection ---- */

const SHARED_HEADER_SECTIONS = new Set(["arrival", "vitals"]);

export function templateSelectedAt(
  tpl: { selected_after_utterance: number },
  cursor: number,
): boolean {
  return cursor > tpl.selected_after_utterance;
}

export function templateSections<T extends { id: string }>(sections: T[], selected: boolean): T[] {
  return selected ? sections : sections.filter((s) => SHARED_HEADER_SECTIONS.has(s.id));
}

/* ---- v4: vitals trend flowsheet ---- */

export interface TrendColumn {
  label: string;
  fires_after_utterance: number;
  values: Record<string, string>;
}

export interface VitalsTrend {
  rows: string[];
  columns: TrendColumn[];
}

export function visibleTrendColumns(trend: VitalsTrend, cursor: number): TrendColumn[] {
  return trend.columns.filter((c) => cursor > c.fires_after_utterance);
}

const REQUIRED_KEYS = [
  "id",
  "metadata",
  "patient_context",
  "encounter_fhir",
  "transcript",
  "note",
  "after_visit_summary",
  "after_visit_summary_provenance",
  "triage",
] as const;

export function validateEncounter(enc: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const key of REQUIRED_KEYS) {
    if (!(key in enc)) errors.push(`missing top-level key: ${key}`);
  }
  if (errors.length > 0) return errors;

  const transcript = enc.transcript as string;
  const lineCount = parseTranscript(transcript).length;
  const triage = enc.triage as {
    form?: { fields?: TriageField[] };
    esi?: { fires_after_utterance?: number };
  };
  const fields = triage.form?.fields ?? [];

  for (const f of fields) {
    for (const idx of f.utterance_indices) {
      if (idx < 0 || idx >= lineCount) {
        errors.push(`${f.id}: utterance index ${idx} outside transcript (${lineCount} lines)`);
      }
    }
    if (f.utterance_indices.length > 0) {
      const latest = Math.max(...f.utterance_indices);
      if (f.fires_after_utterance < latest) {
        errors.push(
          `${f.id}: fires_after_utterance ${f.fires_after_utterance} precedes cited evidence at line ${latest}`,
        );
      }
    }
    if (f.fires_after_utterance >= lineCount) {
      errors.push(`${f.id}: fires_after_utterance ${f.fires_after_utterance} beyond transcript`);
    }
  }
  return errors;
}
