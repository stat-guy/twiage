import { useEffect, useRef } from "react";

/* Canvas ECG/pleth trace for the vitals tile. Single-series device readout. */
export function MonitorTrace({
  bpm,
  kind,
  color = "#ebc88d",
}: {
  bpm: number;
  kind: "ecg" | "pleth";
  color?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const period = 60 / bpm; // seconds per beat

    // waveform value at phase p in [0,1)
    const wave = (p: number): number => {
      if (kind === "ecg") {
        // stylized PQRST
        if (p < 0.12) return 0.08 * Math.sin((p / 0.12) * Math.PI); // P
        if (p < 0.2) return 0;
        if (p < 0.24) return -0.12 * ((p - 0.2) / 0.04); // Q
        if (p < 0.3) return -0.12 + 1.05 * ((p - 0.24) / 0.06); // R up
        if (p < 0.36) return 0.93 - 1.13 * ((p - 0.3) / 0.06); // S down
        if (p < 0.44) return -0.2 + 0.2 * ((p - 0.36) / 0.08);
        if (p < 0.62) return 0;
        if (p < 0.78) return 0.22 * Math.sin(((p - 0.62) / 0.16) * Math.PI); // T
        return 0;
      }
      // pleth: systolic upstroke + dicrotic notch
      if (p < 0.25) return Math.sin((p / 0.25) * (Math.PI / 2));
      if (p < 0.45) return 1 - 0.55 * ((p - 0.25) / 0.2);
      if (p < 0.55) return 0.45 + 0.12 * Math.sin(((p - 0.45) / 0.1) * Math.PI);
      return 0.45 * (1 - (p - 0.55) / 0.45);
    };

    const secondsAcross = 3.2;
    let raf = 0;
    const draw = (nowMs: number) => {
      const now = nowMs / 1000;
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.lineJoin = "round";
      ctx.beginPath();
      const mid = kind === "ecg" ? H * 0.62 : H * 0.78;
      const amp = kind === "ecg" ? H * 0.42 : H * 0.6;
      for (let x = 0; x <= W; x++) {
        const t = now - secondsAcross + (x / W) * secondsAcross;
        const phase = ((t % period) + period) % period / period;
        const y = mid - wave(phase) * amp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [bpm, kind, color]);

  return <canvas ref={ref} className="h-14 w-full" aria-label={`${kind === "ecg" ? "ECG" : "SpO2"} trace, ${bpm} per minute`} />;
}
