import { Activity, ArrowRight, Clock } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@/components/ui/primitives";
import { patientAge, patientName, type Encounter } from "@/lib/types";

export function TrackBoard({
  encounters,
  onSelect,
}: {
  encounters: Encounter[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center gap-8 px-6 py-12">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-accent-bright">
          <Activity className="h-4 w-4" aria-hidden />
          TWIAGE
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          Ambient AI triage, from hello to handoff.
        </h1>
        <p className="max-w-xl text-sm leading-6 text-ink-dim">
          A team of agents listens to the triage conversation, fills the nurse's form with cited
          evidence, folds in vitals and ECG, proposes an ESI acuity, and routes the patient — the
          nurse reviews, corrects, and signs. Pick a patient from the track board to watch a visit.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-ink-faint">
          <span>Riverside Regional ED — waiting to be triaged</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden /> live board
          </span>
        </div>
        {encounters.map((enc, i) => (
          <Card key={enc.id} className="transition-colors hover:border-accent-bright/60">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="font-mono text-xs text-ink-faint">{String(i + 1).padStart(2, "0")}</div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{patientName(enc)}</span>
                  <span className="font-mono text-xs text-ink-faint">
                    {patientAge(enc)} · {enc.patient_context.patient.gender === "male" ? "M" : "F"}
                  </span>
                  <Badge variant="outline">walk-in</Badge>
                </div>
                <p className="truncate text-sm text-ink-dim">“{enc.triage.chief_complaint}”</p>
              </div>
              <Button size="sm" onClick={() => onSelect(enc.id)}>
                Start triage <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs leading-5 text-ink-faint">
        Every patient here is synthetic (Synthea + generated dialogue, Abridge record schema). Demo
        only — not a medical device, not clinical advice.
      </p>
    </div>
  );
}
