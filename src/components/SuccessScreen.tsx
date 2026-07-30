import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

/** Celebratory success panel used for reservations, orders and payments. */
export function SuccessScreen({
  title,
  message,
  details,
  children,
}: {
  title: string;
  message: string;
  details?: Array<{ label: string; value: string }>;
  children?: React.ReactNode;
}) {
  const [pop, setPop] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPop(true), 40);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-primary/5 p-8 text-center backdrop-blur">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-60 blur-3xl" style={{ background: "var(--gradient-primary, oklch(0.75 0.17 155))" }} aria-hidden="true" />
      <Confetti active={pop} />
      <div
        className={`mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/15 text-primary transition-all duration-500 ${
          pop ? "scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
      >
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <h2 className="rise-in mt-4 text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      {details && details.length > 0 && (
        <dl className="mx-auto mt-6 grid max-w-sm gap-2 text-left">
          {details.map((d) => (
            <div key={d.label} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-surface/40 px-4 py-2.5">
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">{d.label}</dt>
              <dd className="min-w-0 truncate text-sm font-medium">{d.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {children && <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

function Confetti({ active }: { active: boolean }) {
  const pieces = Array.from({ length: 14 }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {pieces.map((i) => (
        <span
          key={i}
          className="absolute block h-2 w-2 rounded-[2px] motion-reduce:hidden"
          style={{
            left: `${(i * 7 + 6) % 96}%`,
            top: "-8px",
            background: i % 3 === 0 ? "var(--primary)" : i % 3 === 1 ? "var(--accent)" : "oklch(0.8 0.15 90)",
            opacity: active ? 1 : 0,
            transform: active ? `translateY(${120 + (i % 5) * 40}px) rotate(${i * 57}deg)` : "none",
            transition: `transform ${1.1 + (i % 5) * 0.25}s cubic-bezier(.2,.7,.3,1) ${i * 0.04}s, opacity .8s ${0.6 + i * 0.04}s`,
          }}
        />
      ))}
    </div>
  );
}
