import { useState } from "react";
import { AlertTriangle, Check, Pencil, Quote, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  confidenceBand,
  nurseFields,
  redQueue,
  templateSections,
  templateSelectedAt,
  visibleTrendColumns,
  type ReviewState,
  type TriageField,
} from "@/lib/replay";
import type { Encounter } from "@/lib/types";

const VITAL_MATCH: Record<string, RegExp> = {
  HR: /heart|pulse/i,
  BP: /blood pressure/i,
  RR: /respiratory/i,
  SpO2: /spo2|oxygen/i,
  Temp: /temp/i,
  Pain: /pain/i,
};

const EP_BAND: Record<"green" | "yellow" | "red", string> = {
  green: "var(--ep-band-green)",
  yellow: "var(--ep-band-yellow)",
  red: "var(--ep-band-red)",
};

function ConfidenceChip({ confidence }: { confidence: number }) {
  const band = confidenceBand(confidence);
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] font-medium"
      style={{ color: EP_BAND[band] }}
      title={`confidence ${Math.round(confidence * 100)}% (${band})`}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: EP_BAND[band] }} />
      {Math.round(confidence * 100)}%
    </span>
  );
}

function FieldBox({
  field,
  filled,
  reviewing,
  review,
  onEdit,
  onCite,
}: {
  field: TriageField;
  filled: boolean;
  reviewing: boolean;
  review?: { status: string; value: string };
  onEdit: (value: string) => void;
  onCite: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(review?.value ?? field.value);
  const value = review?.value ?? field.value;

  return (
    <div className="group flex items-start gap-2 px-3 py-1" id={`field-${field.id}`}>
      <span className="w-48 shrink-0 pt-1 text-[11px] font-semibold leading-4 text-[var(--ep-muted)]">
        {field.label}
      </span>
      {editing ? (
        <form
          className="flex flex-1 gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            onEdit(draft);
            setEditing(false);
          }}
        >
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full rounded-sm border border-[var(--ep-blue)] bg-white px-2 py-0.5 text-[13px] text-[var(--ep-ink)] outline-none"
          />
          <button type="submit" className="rounded-sm bg-[var(--ep-blue)] px-2 text-[11px] text-white">
            Save
          </button>
        </form>
      ) : (
        <span
          className={cn(
            "min-h-6 flex-1 rounded-sm border px-2 py-0.5 text-[13px] leading-5",
            filled
              ? "ep-fill border-[var(--ep-border)] text-[var(--ep-ink)]"
              : "border-dashed border-[var(--ep-border)] text-[#9aa5b1]",
            review?.status === "edited" && "border-[var(--ep-blue)]",
          )}
        >
          {filled ? value : "***"}
          {filled && field.unit ? <span className="text-[var(--ep-muted)]"> {field.unit}</span> : null}
        </span>
      )}
      <span className="flex w-20 shrink-0 items-center gap-1 pt-1">
        {filled && <ConfidenceChip confidence={field.confidence} />}
      </span>
      <span className="flex shrink-0 items-center gap-0.5 pt-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {filled && field.utterance_indices.length > 0 && (
          <button
            onClick={onCite}
            title={`Show evidence (L${field.utterance_indices.join(", L")})`}
            className="cursor-pointer rounded p-1 text-[var(--ep-muted)] hover:bg-[#e8edf3]"
          >
            <Quote className="h-3 w-3" aria-label="show transcript evidence" />
          </button>
        )}
        {filled && reviewing && (
          <button
            onClick={() => {
              setDraft(value);
              setEditing(true);
            }}
            title="Edit value"
            className="cursor-pointer rounded p-1 text-[var(--ep-muted)] hover:bg-[#e8edf3]"
          >
            <Pencil className="h-3 w-3" aria-label="edit" />
          </button>
        )}
      </span>
    </div>
  );
}

function Flowsheet({ enc, cursor }: { enc: Encounter; cursor: number }) {
  const trend = enc.triage.vitals_trend;
  const visible = visibleTrendColumns(trend, cursor);
  return (
    <div className="mx-3 my-1 overflow-x-auto">
      <table className="w-full border-collapse text-[12px]" style={{ fontVariantNumeric: "tabular-nums" }}>
        <thead>
          <tr>
            <th className="w-40 border border-[var(--ep-border)] bg-[#eef1f5] px-2 py-1 text-left font-semibold text-[var(--ep-muted)]">
              Flowsheet
            </th>
            {trend.columns.map((c) => (
              <th
                key={c.label}
                className="border border-[var(--ep-border)] bg-[#eef1f5] px-2 py-1 text-left font-mono text-[11px] font-medium text-[var(--ep-blue)]"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trend.rows.map((row) => (
            <tr key={row}>
              <td className="border border-[var(--ep-border)] px-2 py-1 font-semibold text-[var(--ep-muted)]">
                {row}
              </td>
              {trend.columns.map((c) => {
                const on = visible.includes(c);
                return (
                  <td
                    key={c.label}
                    className={cn(
                      "border border-[var(--ep-border)] px-2 py-1 text-[var(--ep-ink)]",
                      on && "ep-fill",
                    )}
                  >
                    {on ? c.values[row] : <span className="text-[#9aa5b1]">***</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TriageFormView({
  enc,
  cursor,
  done,
  reviewing,
  review,
  dispatch,
  onCite,
  nurseNote,
  onNoteChange,
  onSign,
}: {
  enc: Encounter;
  cursor: number;
  done: boolean;
  reviewing: boolean;
  review: ReviewState;
  dispatch: (a: { type: "edit"; id: string; value: string }) => void;
  onCite: (indices: number[]) => void;
  nurseNote: string;
  onNoteChange: (v: string) => void;
  onSign: () => void;
}) {
  const tpl = enc.triage.template;
  const selected = templateSelectedAt(tpl, cursor);
  const sections = templateSections(enc.triage.form.sections, selected);
  const fields = nurseFields(enc.triage.form.fields);
  const queue = redQueue(enc.triage.form.fields, cursor);

  return (
    <div className="epic m-3 flex min-h-0 flex-col overflow-hidden rounded-md border border-[#0a0a08]/60 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-[var(--ep-chrome-2)] bg-[var(--ep-chrome)] px-3 py-1.5">
        <span className="text-[12px] font-bold tracking-tight text-[var(--ep-blue)]">
          ED Triage Navigator
        </span>
        <span className="text-[11px] text-[var(--ep-muted)]">
          {selected ? `${tpl.display_name} (${tpl.smartphrase})` : "template: selecting…"}
        </span>
        <span className="flex-1" />
        <X className="h-3.5 w-3.5 text-[var(--ep-muted)]" aria-hidden />
      </div>
      {/* toolbar */}
      <div className="flex items-center gap-1 border-b border-[var(--ep-chrome-2)] bg-[#edf0f4] px-2 py-1">
        {["My Note ▾", "Insert SmartText", "Insert SmartList", "Refresh"].map((b) => (
          <span
            key={b}
            className="rounded-sm border border-[var(--ep-border)] bg-white px-1.5 py-0.5 text-[10px] text-[#3c4a5a]"
          >
            {b}
          </span>
        ))}
        {selected && (
          <span className="ml-1 rounded-sm bg-[#cfe0f7] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ep-blue)]">
            {tpl.smartphrase}
          </span>
        )}
      </div>

      {/* BPA banner for low-confidence fields */}
      {queue.length > 0 && (
        <div className="border-b border-[var(--ep-bpa-border)] bg-[var(--ep-bpa)] px-3 py-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#7a5a00]">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            BestPractice Advisory — verify while the patient is present ({queue.length})
          </div>
          {queue.map((f) => (
            <button
              key={f.id}
              onClick={() => onCite(f.utterance_indices)}
              className="flex w-full cursor-pointer items-baseline gap-1.5 rounded px-1 py-0.5 text-left text-[11px] text-[#5c4a00] hover:bg-[#f3e6b5]"
            >
              <span className="font-semibold">{f.label}:</span>
              <span className="truncate">{f.value}</span>
              <span className="ml-auto shrink-0 font-mono" style={{ color: "var(--ep-band-red)" }}>
                {Math.round(f.confidence * 100)}%
              </span>
            </button>
          ))}
        </div>
      )}

      {/* note canvas */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--ep-canvas)] py-2">
        {sections.map((section) => {
          const sectionFields = fields.filter((f) => f.section === section.id);
          const gaps = selected ? tpl.extra_slots.filter((s) => s.section === section.id) : [];
          const isVitals = section.id === "vitals";
          if (!isVitals && sectionFields.length === 0 && gaps.length === 0) return null;
          return (
            <section key={section.id} className="mb-2">
              <h3 className="mx-3 mb-1 border-b border-[var(--ep-border)] pb-0.5 text-[12px] font-bold uppercase tracking-wide text-[var(--ep-blue)] underline decoration-[var(--ep-blue)]/40">
                {section.title}
              </h3>
              {isVitals ? (
                <>
                  <Flowsheet enc={enc} cursor={cursor} />
                  {sectionFields
                    .filter((f) => !enc.triage.vitals_trend.rows.some((r) => VITAL_MATCH[r]?.test(f.label)))
                    .map((f) => (
                      <FieldBox
                        key={f.id}
                        field={f}
                        filled={cursor > f.fires_after_utterance}
                        reviewing={reviewing}
                        review={review[f.id]}
                        onEdit={(value) => dispatch({ type: "edit", id: f.id, value })}
                        onCite={() => onCite(f.utterance_indices)}
                      />
                    ))}
                </>
              ) : (
                <>
                  {sectionFields.map((f) => (
                    <FieldBox
                      key={f.id}
                      field={f}
                      filled={cursor > f.fires_after_utterance}
                      reviewing={reviewing}
                      review={review[f.id]}
                      onEdit={(value) => dispatch({ type: "edit", id: f.id, value })}
                      onCite={() => onCite(f.utterance_indices)}
                    />
                  ))}
                  {gaps.map((g) => (
                    <div key={g.label} className="flex items-start gap-2 px-3 py-1">
                      <span className="w-48 shrink-0 pt-1 text-[11px] font-semibold leading-4 text-[var(--ep-muted)]">
                        {g.label}
                      </span>
                      <span className="min-h-6 flex-1 rounded-sm border border-dashed border-[var(--ep-border)] px-2 py-0.5 text-[12px] italic leading-5 text-[#9aa5b1]">
                        {done ? "— not obtained at triage" : "***"}
                      </span>
                      <span className="w-20 shrink-0" />
                    </div>
                  ))}
                </>
              )}
            </section>
          );
        })}
      </div>

      {/* bottom sign bar */}
      <div className="flex items-center gap-2 border-t border-[var(--ep-chrome-2)] bg-[#edf0f4] px-3 py-2">
        <span className="shrink-0 text-[11px] font-semibold text-[var(--ep-muted)]">RN Note:</span>
        <input
          value={reviewing || done ? nurseNote : ""}
          placeholder={done ? "" : "generating from conversation…"}
          onChange={(e) => onNoteChange(e.target.value)}
          readOnly={!reviewing}
          className={cn(
            "flex-1 rounded-sm border border-[var(--ep-border)] bg-white px-2 py-1 text-[12px] text-[var(--ep-ink)] outline-none",
            reviewing && "focus:border-[var(--ep-blue)]",
            !reviewing && "text-[var(--ep-muted)]",
          )}
        />
        <button
          onClick={onSign}
          disabled={!reviewing}
          title={reviewing ? "Sign the triage note" : "Available after nurse review begins"}
          className={cn(
            "flex shrink-0 cursor-pointer items-center gap-1 rounded-sm border px-3 py-1 text-[12px] font-semibold",
            reviewing
              ? "border-[var(--ep-accept)] bg-[var(--ep-accept)] text-white hover:opacity-90"
              : "border-[var(--ep-border)] bg-[#dfe5ec] text-[#9aa5b1]",
          )}
        >
          <Check className="h-3.5 w-3.5" aria-hidden /> Accept & Sign
        </button>
      </div>
    </div>
  );
}
