import { useMemo } from "react";
import { ArrowDownRight, CircuitBoard } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { esiRevealedAt, type TriageField } from "@/lib/replay";
import { AGENT_META, ESI_COLORS, type Encounter } from "@/lib/types";
import { MonitorTrace } from "./MonitorTrace";

interface FeedEvent {
  at: number;
  agent: keyof typeof AGENT_META;
  text: string;
}

function buildFeed(enc: Encounter, revealed: TriageField[], cursor: number): FeedEvent[] {
  const events: FeedEvent[] = [
    { at: 0, agent: "orchestrator", text: "Ambient session started — team listening" },
  ];
  const tpl = enc.triage.template;
  if (cursor > tpl.selected_after_utterance) {
    events.push({
      at: tpl.selected_after_utterance,
      agent: "orchestrator",
      text: `${tpl.display_name} template selected (${tpl.smartphrase})`,
    });
  }
  for (const f of revealed) {
    const rescued = f.nurse_documented === false ? "⤴ MD · " : "";
    events.push({
      at: f.fires_after_utterance,
      agent: f.agent,
      text: `${rescued}${f.label} → ${f.value.length > 42 ? f.value.slice(0, 42) + "…" : f.value}`,
    });
  }
  if (esiRevealedAt(enc.triage.esi, cursor)) {
    events.push({
      at: enc.triage.esi.fires_after_utterance,
      agent: "esi",
      text: `Proposes ESI ${enc.triage.esi.level} — ${enc.triage.esi.label}`,
    });
  }
  if (esiRevealedAt(enc.triage.routing, cursor)) {
    events.push({
      at: enc.triage.routing.fires_after_utterance,
      agent: "routing",
      text: `${enc.triage.routing.zone} · ${enc.triage.routing.bed}`,
    });
  }
  return events.sort((a, b) => b.at - a.at);
}

function VitalsCard({ enc, revealed }: { enc: Encounter; revealed: TriageField[] }) {
  const vitals = revealed.filter((f) => f.section === "vitals");
  if (vitals.length === 0) return null;
  const hrField = vitals.find((f) => /heart|pulse|^hr/i.test(f.label + f.id));
  const bpm = hrField ? parseInt(hrField.value, 10) || 80 : 80;
  const isResp = /breath|sob|dyspnea/i.test(enc.triage.chief_complaint);
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
          Bedside monitor
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-vitals" />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <MonitorTrace bpm={bpm} kind={isResp ? "pleth" : "ecg"} color="#ebc88d" />
        <div className="grid grid-cols-3 gap-1.5">
          {vitals.slice(0, 6).map((f) => (
            <div key={f.id} className="rounded-md bg-panel-2 px-2 py-1.5">
              <div className="truncate text-[10px] text-ink-faint">{f.label}</div>
              <div className="font-mono text-sm tabular-nums text-ink">
                {f.value}
                {f.unit ? <span className="ml-0.5 text-[10px] text-ink-dim">{f.unit}</span> : null}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function AgentRail({
  enc,
  revealed,
  cursor,
}: {
  enc: Encounter;
  revealed: TriageField[];
  cursor: number;
}) {
  const feed = useMemo(() => buildFeed(enc, revealed, cursor), [enc, revealed, cursor]);
  const esiUp = esiRevealedAt(enc.triage.esi, cursor);
  const routingUp = esiRevealedAt(enc.triage.routing, cursor);
  const lastByAgent = new Map<string, number>();
  for (const e of feed) if (!lastByAgent.has(e.agent)) lastByAgent.set(e.agent, e.at);

  return (
    <div className="flex flex-col gap-3 p-3">
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
            <CircuitBoard className="h-3.5 w-3.5" aria-hidden /> Agent team
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          {(Object.keys(AGENT_META) as (keyof typeof AGENT_META)[]).map((key) => {
            const meta = AGENT_META[key];
            const lastAt = lastByAgent.get(key);
            const active = lastAt !== undefined && cursor - lastAt <= 3;
            return (
              <div key={key} className="flex items-center gap-2">
                <span
                  className={active ? "pulse-dot h-2 w-2 rounded-full" : "h-2 w-2 rounded-full opacity-50"}
                  style={{ background: meta.color }}
                />
                <span className="w-24 text-xs font-medium" style={{ color: meta.color }}>
                  {meta.label}
                </span>
                <span className="flex-1 truncate text-[11px] text-ink-faint">{meta.role}</span>
                <span className="font-mono text-[10px] text-ink-faint">
                  {active ? "active" : lastAt !== undefined ? "done" : "listening"}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {esiUp && (
        <Card className="field-in" style={{ borderColor: ESI_COLORS[enc.triage.esi.level] }}>
          <CardContent className="flex items-center gap-3 p-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md font-mono text-2xl font-bold text-ground"
              style={{ background: ESI_COLORS[enc.triage.esi.level] }}
            >
              {enc.triage.esi.level}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">ESI {enc.triage.esi.level}</span>
                <Badge variant="outline">{enc.triage.esi.label}</Badge>
              </div>
              <p className="mt-0.5 text-[11px] leading-4 text-ink-dim">{enc.triage.esi.rationale}</p>
              <p className="mt-0.5 font-mono text-[10px] text-ink-faint">
                Acuity agent · {Math.round(enc.triage.esi.confidence * 100)}% — nurse confirms
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {routingUp && (
        <Card className="field-in">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
              <ArrowDownRight className="h-3.5 w-3.5" aria-hidden /> Routing & resources
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            <div className="text-sm font-medium">
              {enc.triage.routing.zone} · {enc.triage.routing.bed}
            </div>
            <div className="text-[11px] text-ink-dim">{enc.triage.routing.monitoring}</div>
            <ul className="mt-1 flex flex-col gap-1">
              {enc.triage.routing.resources.map((r) => (
                <li key={r.name} className="flex items-start gap-1.5 text-[11px] leading-4">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-routing" />
                  <span>
                    <span className="text-ink">{r.name}</span>
                    <span className="text-ink-faint"> — {r.rationale}</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <VitalsCard enc={enc} revealed={revealed} />

      <Card className="min-h-0">
        <CardHeader className="pb-1">
          <CardTitle className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
            Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
          {feed.map((e, i) => (
            <div key={`${e.at}-${i}`} className="flex items-start gap-2">
              <span
                className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: AGENT_META[e.agent].color }}
              />
              <span className="min-w-0 flex-1 truncate text-[11px] leading-4 text-ink-dim">
                <span style={{ color: AGENT_META[e.agent].color }}>{AGENT_META[e.agent].label}</span>{" "}
                {e.text}
              </span>
              <span className="font-mono text-[10px] text-ink-faint">L{e.at}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
