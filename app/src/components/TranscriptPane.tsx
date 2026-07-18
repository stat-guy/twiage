import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { Utterance } from "@/lib/replay";

const SPEAKER_STYLE: Record<string, { chip: string; name: string }> = {
  NURSE: { chip: "bg-accent/25 text-accent-bright", name: "Nurse" },
  PT: { chip: "bg-scribe/15 text-scribe", name: "Patient" },
  FAMILY: { chip: "bg-routing/15 text-routing", name: "Family" },
};

export function TranscriptPane({
  utterances,
  cursor,
  highlight,
}: {
  utterances: Utterance[];
  cursor: number;
  highlight: { indices: number[]; nonce: number } | null;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  // NB: smooth programmatic scrolling silently no-ops here while the monitor's
  // rAF loop runs, so both scrolls are instant.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [cursor]);

  useEffect(() => {
    if (!highlight || highlight.indices.length === 0) return;
    const el = listRef.current;
    const line = el?.querySelector<HTMLElement>(`[data-line="${highlight.indices[0]}"]`);
    if (el && line) {
      el.scrollTop = line.offsetTop - el.clientHeight / 2 + line.clientHeight / 2;
    }
  }, [highlight]);

  return (
    <div ref={listRef} className="relative h-full overflow-y-auto flex flex-col gap-2 p-3">
      {utterances.slice(0, cursor).map((u, i) => {
        const s = SPEAKER_STYLE[u.speaker];
        const lit = highlight?.indices.includes(i);
        return (
          <div
            key={i}
            data-line={i}
            className={cn(
              "utter-in rounded-md border border-transparent px-2.5 py-1.5 transition-colors",
              lit && "border-accent-bright/70 bg-accent/15",
            )}
          >
            <div className="mb-0.5 flex items-center gap-2">
              <span className={cn("rounded px-1.5 py-px font-mono text-[10px] font-medium", s.chip)}>
                {s.name}
              </span>
              <span className="font-mono text-[10px] text-ink-faint">L{i}</span>
            </div>
            <p className="text-[13px] leading-5 text-ink/90">{u.text}</p>
          </div>
        );
      })}
      {cursor < utterances.length && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 text-ink-faint">
          <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-accent-bright" />
          <span className="font-mono text-[11px]">listening…</span>
        </div>
      )}
    </div>
  );
}
