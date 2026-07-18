import { useMemo, useReducer, useState } from "react";
import {
  Activity,
  ArrowLeft,
  FastForward,
  Pause,
  Play,
} from "lucide-react";
import { Badge, Button, Progress } from "@/components/ui/primitives";
import { encounters } from "@/data/encounters";
import { useReplay } from "@/hooks/useReplay";
import {
  fieldsRevealedAt,
  initialReview,
  nurseFields,
  reviewReducer,
} from "@/lib/replay";
import { patientAge, patientName, type Encounter } from "@/lib/types";
import { AgentRail } from "@/components/AgentRail";
import { PhysicianView } from "@/components/PhysicianView";
import { TrackBoard } from "@/components/TrackBoard";
import { TranscriptPane } from "@/components/TranscriptPane";
import { TriageFormView } from "@/components/TriageFormView";

type Phase = "triage" | "review" | "md";

function Workspace({ enc, onExit }: { enc: Encounter; onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>("triage");
  const replay = useReplay(enc);
  const allFields = enc.triage.form.fields;
  const nurseOnly = useMemo(() => nurseFields(allFields), [allFields]);
  const [review, dispatch] = useReducer(reviewReducer, nurseOnly, initialReview);
  const [highlight, setHighlight] = useState<{ indices: number[]; nonce: number } | null>(null);
  const [nurseNote, setNurseNote] = useState(enc.triage.nurse_note);

  const cursor = phase === "triage" ? replay.cursor : replay.utterances.length;
  const revealedNurse = useMemo(() => fieldsRevealedAt(nurseOnly, cursor), [nurseOnly, cursor]);
  const revealedAll = useMemo(() => fieldsRevealedAt(allFields, cursor), [allFields, cursor]);
  const onCite = (indices: number[]) => setHighlight({ indices, nonce: Date.now() });

  if (phase === "md") return <PhysicianView enc={enc} nurseNote={nurseNote} onBack={onExit} />;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-line bg-panel px-4 py-2">
        <Button variant="ghost" size="icon" onClick={onExit} title="Back to track board">
          <ArrowLeft className="h-4 w-4" aria-label="back" />
        </Button>
        <div className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-accent-bright">
          <Activity className="h-4 w-4" aria-hidden /> TWIAGE
        </div>
        <div className="mx-2 h-4 w-px bg-line" />
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{patientName(enc)}</span>
          <span className="font-mono text-xs text-ink-faint">
            {patientAge(enc)} · {enc.patient_context.patient.gender === "male" ? "M" : "F"}
          </span>
          <Badge variant="outline" className="hidden max-w-72 truncate sm:inline-flex">
            {enc.triage.chief_complaint}
          </Badge>
        </div>
        <div className="flex-1" />
        {phase === "triage" && (
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="sm" onClick={replay.toggle} disabled={replay.done}>
              {replay.playing ? (
                <Pause className="h-3.5 w-3.5" aria-label="pause" />
              ) : (
                <Play className="h-3.5 w-3.5" aria-label="play" />
              )}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => replay.setSpeed(replay.speed >= 4 ? 1 : replay.speed * 2)}
              title="Replay speed"
            >
              {replay.speed}×
            </Button>
            <Button variant="secondary" size="sm" onClick={replay.skipToEnd} disabled={replay.done}>
              <FastForward className="h-3.5 w-3.5" aria-hidden /> Skip
            </Button>
            <Button size="sm" onClick={() => setPhase("review")} disabled={!replay.done}>
              Nurse review
            </Button>
          </div>
        )}
        {phase === "review" && (
          <span className="font-mono text-[11px] text-ink-faint">
            review in the navigator — edit anything, then Accept & Sign below
          </span>
        )}
      </header>

      <div className="border-b border-line bg-panel px-4 py-1.5">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            {phase === "triage"
              ? replay.done
                ? "vitals done — patient headed back out · navigator ready for review"
                : "ambient listening — the navigator is filling itself"
              : "nurse review — sign at the bottom of the navigator"}
          </span>
          <Progress
            value={nurseOnly.length ? revealedNurse.length / nurseOnly.length : 0}
            className="max-w-56"
          />
          <span className="font-mono text-[10px] tabular-nums text-ink-faint">
            {revealedNurse.length}/{nurseOnly.length} RN fields ·{" "}
            {revealedAll.length - revealedNurse.length} captured for MD
          </span>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(240px,300px)_minmax(0,1.6fr)_minmax(270px,320px)]">
        <div className="min-h-0 border-r border-line bg-ground">
          <TranscriptPane utterances={replay.utterances} cursor={cursor} highlight={highlight} />
        </div>
        <div className="flex min-h-0 flex-col">
          <TriageFormView
            enc={enc}
            cursor={cursor}
            done={replay.done || phase !== "triage"}
            reviewing={phase === "review"}
            review={review}
            dispatch={dispatch}
            onCite={onCite}
            nurseNote={nurseNote}
            onNoteChange={setNurseNote}
            onSign={() => {
              dispatch({ type: "accept_all" });
              setPhase("md");
            }}
          />
        </div>
        <div className="min-h-0 overflow-y-auto border-l border-line bg-ground">
          <AgentRail enc={enc} revealed={revealedAll} cursor={cursor} />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [selected, setSelected] = useState<string | null>(null);
  const enc = encounters.find((e) => e.id === selected);
  if (!enc) return <TrackBoard encounters={encounters} onSelect={setSelected} />;
  return <Workspace key={enc.id} enc={enc} onExit={() => setSelected(null)} />;
}
