import { useMemo, useReducer, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Plus,
  Signature,
  Sparkles,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/primitives";
import {
  confidenceBand,
  finalOrders,
  initialOrders,
  ordersReducer,
  rescuedFields,
} from "@/lib/replay";
import {
  AGENT_META,
  BAND_COLORS,
  ESI_COLORS,
  patientAge,
  patientName,
  type Encounter,
} from "@/lib/types";

/* markdown-lite for the MD note: **Header:** blocks, "- " bullets, plain lines */
function MdNote({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <div className="flex max-w-prose flex-col gap-1.5 text-sm leading-6 text-ink/90">
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          return (
            <h4
              key={i}
              className="mt-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-accent-bright"
            >
              {part.replace(/:$/, "")}
            </h4>
          );
        }
        const lines = part.split("\n").filter((l) => l.trim());
        return lines.map((line, j) => {
          const t = line.trim();
          const bullet = t.startsWith("- ") || t.startsWith("• ");
          return (
            <p key={`${i}-${j}`} className={bullet ? "flex gap-2 pl-1" : undefined}>
              {bullet && <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-ink-dim" />}
              <span>{bullet ? t.slice(2) : t}</span>
            </p>
          );
        });
      })}
    </div>
  );
}

function OrdersPanel({ enc }: { enc: Encounter }) {
  const [state, dispatch] = useReducer(ordersReducer, enc.triage.suggested_orders, initialOrders);
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDetail, setDraftDetail] = useState("");
  const included = finalOrders(enc.triage.suggested_orders, state);

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
            Placed at triage — RN protocol
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          {enc.triage.nurse_orders.map((o) => (
            <div key={o.id} className="flex items-start gap-2.5 rounded-md bg-panel-2 px-3 py-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-bright" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{o.name}</div>
                <div className="text-[11px] text-ink-dim">{o.detail}</div>
              </div>
              <span className="shrink-0 font-mono text-[10px] text-ink-faint">
                {o.placed_by}
                {o.time ? ` · ${o.time}` : ""}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
              Unsigned order set
            </span>
            {state.signed ? (
              <Badge variant="outline" className="border-accent text-accent-bright">
                <Signature className="h-3 w-3" aria-hidden /> Signed
              </Badge>
            ) : (
              <span className="font-mono text-[10px] text-ink-faint">
                {included.length} selected
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          {enc.triage.suggested_orders.map((o) => {
            const on = state.included[o.id];
            return (
              <label
                key={o.id}
                className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 transition-colors ${
                  on ? "border-line bg-panel-2" : "border-transparent opacity-45"
                } ${state.signed ? "pointer-events-none" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={state.signed}
                  onChange={() => dispatch({ type: "toggle", id: o.id })}
                  className="mt-1 h-3.5 w-3.5 accent-[#4a9d77]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{o.name}</span>
                    <Badge variant="outline" className="border-esi/50 text-esi">
                      <Sparkles className="h-2.5 w-2.5" aria-hidden /> AI suggested
                    </Badge>
                  </div>
                  <div className="text-[11px] text-ink-dim">{o.detail}</div>
                  <div className="text-[11px] text-ink-faint">{o.rationale}</div>
                </div>
                {state.signed && on && (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-bright" aria-hidden />
                )}
              </label>
            );
          })}

          {state.added.map((o) => (
            <div key={o.id} className="flex items-start gap-2.5 rounded-md border border-line bg-panel-2 px-3 py-2">
              <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-vitals" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{o.name}</span>
                  <Badge variant="outline">added by physician</Badge>
                </div>
                <div className="text-[11px] text-ink-dim">{o.detail}</div>
              </div>
              {state.signed && (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-bright" aria-hidden />
              )}
            </div>
          ))}

          {!state.signed && (
            <>
              {adding ? (
                <form
                  className="flex flex-col gap-1.5 rounded-md border border-dashed border-line p-2.5 sm:flex-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!draftName.trim()) return;
                    dispatch({ type: "add", name: draftName.trim(), detail: draftDetail.trim() });
                    setDraftName("");
                    setDraftDetail("");
                    setAdding(false);
                  }}
                >
                  <Input
                    autoFocus
                    placeholder="Order (e.g., Basic metabolic panel)"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                  />
                  <Input
                    placeholder="Detail (optional)"
                    value={draftDetail}
                    onChange={(e) => setDraftDetail(e.target.value)}
                  />
                  <Button type="submit" size="sm" className="shrink-0">
                    Add
                  </Button>
                </form>
              ) : (
                <Button variant="ghost" size="sm" className="self-start" onClick={() => setAdding(true)}>
                  <Plus className="h-3.5 w-3.5" aria-hidden /> Add order
                </Button>
              )}
              <Separator className="my-1" />
              <Button
                className="self-end"
                disabled={included.length === 0}
                onClick={() => dispatch({ type: "sign" })}
              >
                <Signature className="h-3.5 w-3.5" aria-hidden /> Sign orders ({included.length})
              </Button>
            </>
          )}
          {state.signed && (
            <p className="text-[11px] text-ink-faint">
              {included.length} orders signed — active before the patient is roomed.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SentimentPanel({ enc }: { enc: Encounter }) {
  const s = enc.triage.sentiment;
  const band = s.score >= 7 ? "var(--color-esi4)" : s.score >= 4 ? "var(--color-esi3)" : "var(--color-esi2)";
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
          Interaction sentiment — patient speech vs nurse speech
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md font-mono text-3xl font-bold text-ground"
            style={{ background: band, fontVariantNumeric: "tabular-nums" }}
          >
            {s.score.toFixed(1)}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[11px] text-ink-faint">{s.scale_note}</span>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-2">
              <div
                className="h-full rounded-full"
                style={{ width: `${s.percentile}%`, background: band }}
              />
            </div>
            <span className="font-mono text-[10px] text-ink-faint">
              {s.percentile}th percentile of {s.reference_n}
            </span>
          </div>
        </div>
        <ul className="flex flex-col gap-1.5">
          {s.analysis.map((a, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] leading-5 text-ink/90">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-dim" />
              {a}
            </li>
          ))}
        </ul>
        <p className="rounded-md bg-panel-2 px-3 py-2 text-[11px] leading-4 text-ink-faint">
          {s.calibration_note}
        </p>
      </CardContent>
    </Card>
  );
}

export function PhysicianView({
  enc,
  nurseNote,
  onBack,
}: {
  enc: Encounter;
  nurseNote: string;
  onBack: () => void;
}) {
  const [tab, setTab] = useState("summary");
  const rescued = useMemo(() => rescuedFields(enc.triage.form.fields), [enc]);
  const unsignedCount = enc.triage.suggested_orders.length;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-5 px-6 py-10">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Track board
        </Button>
        <Badge variant="outline">Physician view — patient not yet seen</Badge>
      </div>

      <header className="flex flex-col gap-1.5">
        <h2 className="text-xl font-semibold tracking-tight">
          {patientName(enc)}{" "}
          <span className="font-mono text-sm font-normal text-ink-faint">
            {patientAge(enc)} · {enc.patient_context.patient.gender}
          </span>
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-dim">
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded font-mono text-xs font-bold text-ground"
            style={{ background: ESI_COLORS[enc.triage.esi.level] }}
          >
            {enc.triage.esi.level}
          </span>
          <span>
            Triage complete · {enc.triage.routing.zone} · {enc.triage.routing.bed}
          </span>
        </div>
      </header>

      <Tabs defaultValue="summary" value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="summary">Clinician summary</TabsTrigger>
          <TabsTrigger value="orders">Unsigned work ({unsignedCount})</TabsTrigger>
          <TabsTrigger value="rescued">Captured ({rescued.length})</TabsTrigger>
          <TabsTrigger value="rn">RN note</TabsTrigger>
          <TabsTrigger value="sentiment">Sentiment analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4 flex flex-col gap-3">
          <Card>
            <CardContent className="p-5">
              <MdNote text={enc.triage.physician_note} />
            </CardContent>
          </Card>
          <Button className="self-start" onClick={() => setTab("orders")}>
            <ClipboardList className="h-3.5 w-3.5" aria-hidden /> Manage unsigned work ({unsignedCount})
          </Button>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <OrdersPanel enc={enc} />
        </TabsContent>

        <TabsContent value="rescued" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                {rescued.length} details captured beyond the RN chart
              </CardTitle>
              <p className="text-[11px] leading-4 text-ink-faint">
                Volunteered during triage but outside what the nurse documents — rescued by the
                ambient agents, cited to the conversation.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              {rescued.map((f) => {
                const band = confidenceBand(f.confidence);
                return (
                  <div key={f.id} className="flex items-start gap-2.5 rounded-md bg-panel-2 px-3 py-2">
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ background: AGENT_META[f.agent].color }}
                      title={AGENT_META[f.agent].label}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-ink-faint">{f.label}</div>
                      <div className="text-sm">{f.value}</div>
                    </div>
                    <span
                      className="mt-0.5 shrink-0 font-mono text-[10px]"
                      style={{ color: BAND_COLORS[band] }}
                    >
                      {Math.round(f.confidence * 100)}%
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rn" className="mt-4">
          <Card>
            <CardContent className="p-5">
              <p className="max-w-prose text-sm leading-6 text-ink/90">{nurseNote}</p>
              <p className="mt-3 max-w-prose text-[11px] leading-4 text-ink-faint">
                That's the entire narrative. Vitals, allergies, medications, and screening results
                are filed as structured data (flowsheet and discrete fields) — nothing already
                structured in the EHR is repeated in the note the RN has to generate.
              </p>
              <p className="mt-2 font-mono text-[10px] text-ink-faint">Signed — triage RN</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sentiment" className="mt-4">
          <SentimentPanel enc={enc} />
        </TabsContent>
      </Tabs>

      <p className="text-xs text-ink-faint">
        Unsigned orders are AI-generated suggestions; nothing is active until a physician signs.
        Synthetic demo — not a medical device.
      </p>
    </div>
  );
}
