import type { AgentName, SuggestedOrder, TriageField, VitalsTrend } from "./replay";

export const BAND_COLORS: Record<"green" | "yellow" | "red", string> = {
  green: "#4a9d77",
  yellow: "#f8c762",
  red: "#e5484d",
};

export interface FormSection {
  id: string;
  title: string;
}

export interface EsiBlock {
  level: 1 | 2 | 3 | 4 | 5;
  label: string;
  rationale: string;
  decision_points: {
    a_lifesaving: string;
    b_high_risk: string;
    c_resources: string;
    d_vital_signs: string;
  };
  confidence: number;
  fires_after_utterance: number;
}

export interface RoutingResource {
  name: string;
  rationale: string;
}

export interface RoutingBlock {
  zone: string;
  bed: string;
  monitoring: string;
  resources: RoutingResource[];
  rationale: string;
  fires_after_utterance: number;
}

export interface NurseOrder {
  id: string;
  name: string;
  detail: string;
  status: string;
  placed_by: string;
  time?: string;
}

export interface TemplateBlock {
  smartphrase: string;
  display_name: string;
  selected_after_utterance: number;
  extra_slots: { section: string; label: string }[];
}

export interface SentimentBlock {
  score: number;
  scale_note: string;
  percentile: number;
  reference_n: string;
  analysis: string[];
  calibration_note: string;
}

export interface TriageBlock {
  chief_complaint: string;
  template: TemplateBlock;
  vitals_trend: VitalsTrend;
  sentiment: SentimentBlock;
  form: {
    sections: FormSection[];
    fields: TriageField[];
  };
  esi: EsiBlock;
  routing: RoutingBlock;
  nurse_note: string;
  physician_note: string;
  nurse_orders: NurseOrder[];
  suggested_orders: SuggestedOrder[];
}

export interface Encounter {
  id: string;
  metadata: {
    source: string;
    synthetic: boolean;
    patient_id: string;
    encounter_id: string;
    date: string;
    status: string;
    visit_type: string;
    visit_title: string;
    related_resource_counts: Record<string, number>;
  };
  patient_context: {
    patient: {
      name: { use?: string; family: string; given: string[]; prefix?: string[] }[];
      gender: string;
      birthDate: string;
      address?: { city?: string; state?: string }[];
    };
    longitudinal_summary: {
      resource_counts: Record<string, number>;
      condition_labels: string[];
      medication_labels: string[];
    };
  };
  encounter_fhir: Record<string, unknown>;
  transcript: string;
  note: string;
  after_visit_summary: string;
  after_visit_summary_provenance: Record<string, unknown>;
  triage: TriageBlock;
}

export const AGENT_META: Record<
  AgentName | "orchestrator",
  { label: string; role: string; color: string }
> = {
  orchestrator: { label: "Orchestrator", role: "Coordinates the team", color: "var(--color-accent-bright)" },
  scribe: { label: "Scribe", role: "Listens & fills the form", color: "var(--color-scribe)" },
  vitals: { label: "Vitals", role: "Devices, ECG & observations", color: "var(--color-vitals)" },
  esi: { label: "Acuity", role: "ESI 1–5 assessment", color: "var(--color-esi)" },
  routing: { label: "Routing", role: "Zone & resources", color: "var(--color-routing)" },
};

export const ESI_COLORS: Record<number, string> = {
  1: "var(--color-esi1)",
  2: "var(--color-esi2)",
  3: "var(--color-esi3)",
  4: "var(--color-esi4)",
  5: "var(--color-esi5)",
};

export function patientName(enc: Encounter): string {
  const n = enc.patient_context.patient.name[0];
  return `${n.given.join(" ")} ${n.family}`;
}

export function patientAge(enc: Encounter): number {
  const dob = new Date(enc.patient_context.patient.birthDate);
  const ref = new Date(enc.metadata.date);
  let age = ref.getFullYear() - dob.getFullYear();
  const m = ref.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < dob.getDate())) age--;
  return age;
}
