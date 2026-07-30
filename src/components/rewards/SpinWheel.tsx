import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { SPIN_SEGMENTS } from "@/lib/rewards-data";

const N = SPIN_SEGMENTS.length;
const SEG = 360 / N;

function pickIndex() {
  const total = SPIN_SEGMENTS.reduce((a, s) => a + s.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < N; i++) {
    r -= SPIN_SEGMENTS[i].weight;
    if (r <= 0) return i;
  }
  return 0;
}

/** Weighted prize wheel. One spin per day, enforced by the parent. */
export function SpinWheel({
  canSpin,
  onWin,
  nextSpinLabel,
}: {
  canSpin: boolean;
  onWin: (label: string, points: number) => void;
  nextSpinLabel: string;
}) {
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const spin = () => {
    if (spinning || !canSpin) return;
    const i = pickIndex();
    // Land the middle of segment i under the pointer at the top.
    const target = 360 * 6 + (360 - (i * SEG + SEG / 2));
    setSpinning(true);
    setResult(null);
    setAngle((a) => a + target - (a % 360));
    timer.current = setTimeout(() => {
      setSpinning(false);
      setResult(SPIN_SEGMENTS[i].label);
      onWin(SPIN_SEGMENTS[i].label, SPIN_SEGMENTS[i].points);
    }, 4200);
  };

  const gradient = SPIN_SEGMENTS.map(
    (s, i) =>
      `color-mix(in oklab, ${s.color} ${i % 2 ? 55 : 80}%, transparent) ${i * SEG}deg ${(i + 1) * SEG}deg`,
  ).join(", ");

  return (
    <div className="flex flex-col items-center">
      <div className="relative aspect-square w-full max-w-[320px]">
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2 border-x-[10px] border-t-[18px] border-x-transparent"
          style={{ borderTopColor: "var(--primary)" }}
        />
        <div
          className="h-full w-full rounded-full border-4 border-primary/40 shadow-[var(--shadow-glow)]"
          style={{
            background: `conic-gradient(${gradient})`,
            transform: `rotate(${angle}deg)`,
            transition: spinning ? "transform 4.2s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
          }}
          role="img"
          aria-label={`Prize wheel with ${N} segments`}
        >
          {SPIN_SEGMENTS.map((s, i) => (
            <span
              key={s.label}
              className="absolute left-1/2 top-1/2 -mt-3 flex h-6 w-1/2 origin-left items-center justify-end pr-5 text-[10px] font-bold tracking-tight text-background sm:text-xs"
              style={{ transform: `rotate(${i * SEG + SEG / 2}deg)` }}
            >
              {s.label}
            </span>
          ))}
        </div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-border bg-surface text-center">
          <Sparkles className="h-7 w-7 text-primary" aria-hidden="true" />
        </div>
      </div>

      <button
        type="button"
        onClick={spin}
        disabled={!canSpin || spinning}
        className="press mt-6 inline-flex min-h-11 w-full max-w-[320px] items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {spinning ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Spinning…
          </>
        ) : canSpin ? (
          "Spin to win"
        ) : (
          nextSpinLabel
        )}
      </button>

      <p aria-live="polite" className="mt-3 min-h-6 text-center text-sm">
        {result ? (
          <span className="font-semibold text-primary">You won {result}! 🎉</span>
        ) : (
          <span className="text-muted-foreground">Every segment is a win — one free spin a day.</span>
        )}
      </p>
    </div>
  );
}
