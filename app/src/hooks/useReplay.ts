import { useEffect, useMemo, useState } from "react";
import { parseTranscript } from "@/lib/replay";
import type { Encounter } from "@/lib/types";

export function useReplay(enc: Encounter) {
  const utterances = useMemo(() => parseTranscript(enc.transcript), [enc]);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(2);

  const done = cursor >= utterances.length;

  useEffect(() => {
    if (!playing || done) return;
    const u = utterances[cursor];
    // pacing: roughly reading speed, clamped so long lines don't stall the demo
    const delay = Math.min(3800, 700 + u.text.length * 26) / speed;
    const t = setTimeout(() => setCursor((c) => c + 1), delay);
    return () => clearTimeout(t);
  }, [playing, cursor, speed, utterances, done]);

  return {
    utterances,
    cursor,
    playing,
    speed,
    done,
    toggle: () => setPlaying((p) => !p),
    setSpeed,
    skipToEnd: () => setCursor(utterances.length),
    restart: () => {
      setCursor(0);
      setPlaying(true);
    },
  };
}
