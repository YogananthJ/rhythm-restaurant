import { useEffect, useState } from "react";
import { ChefHat } from "lucide-react";

const STEPS = [
  "Loading restaurant workspace…",
  "Preparing dashboard…",
  "Checking reservations…",
  "Loading analytics…",
  "Synchronizing rewards…",
];

/**
 * Full-screen brand transition played between successful authentication and
 * the first dashboard paint. Runs ~2.6s, then calls onDone().
 */
export function WelcomeTransition({ name, onDone }: { name?: string; onDone: () => void }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const per = 520;
    const timers = STEPS.map((_, i) => setTimeout(() => setStep(i), i * per));
    const done = setTimeout(onDone, STEPS.length * per + 300);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
    };
  }, [onDone]);

  const pct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] grid place-items-center bg-background/90 backdrop-blur-xl"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--gradient-mesh)" }}
      />
      <div className="glass-panel relative mx-4 w-full max-w-md rounded-3xl p-8 text-center">
        <div className="relative mx-auto grid h-20 w-20 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-3xl bg-primary/20" />
          <span className="relative grid h-20 w-20 place-items-center rounded-3xl bg-primary/15 text-primary">
            <ChefHat className="h-9 w-9" aria-hidden="true" />
          </span>
        </div>

        <h2 className="mt-6 font-display text-3xl font-bold tracking-tight">Welcome back!</h2>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {name ? name : "Your restaurant workspace is warming up"}
        </p>

        <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%`, background: "var(--gradient-primary)" }}
          />
        </div>

        <ul className="mt-5 space-y-1.5 text-left text-sm">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className={`flex items-center gap-2 transition-all duration-300 ${
                i <= step ? "text-foreground opacity-100" : "text-muted-foreground opacity-40"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  i < step ? "bg-primary" : i === step ? "animate-pulse bg-primary" : "bg-muted-foreground/40"
                }`}
              />
              <span className="truncate">{s}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
