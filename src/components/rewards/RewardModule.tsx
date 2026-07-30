import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { AnimatedNumber } from "@/components/AnimatedNumber";

export type ModuleStat = {
  label: string;
  value: string | number;
  /** When numeric, the value counts up on mount. */
  animate?: boolean;
  accent?: boolean;
};

/** Glassy skeleton placeholder shown while rewards state hydrates. */
export function RewardModuleSkeleton({ index = 0 }: { index?: number }) {
  return (
    <section
      aria-hidden="true"
      className="rw-module p-5 sm:p-7"
      style={{ animationDelay: `${Math.min(index * 60, 300)}ms` }}
    >
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] sm:items-center">
        <div className="order-2 min-w-0 sm:order-1">
          <div className="skeleton-shine h-3 w-28 rounded-full bg-muted" />
          <div className="skeleton-shine mt-3 h-6 w-2/3 rounded-lg bg-muted" />
          <div className="skeleton-shine mt-2 h-3.5 w-full rounded-full bg-muted" />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl border border-border/70 bg-surface/40 p-3">
                <div className="skeleton-shine h-2.5 w-14 rounded-full bg-muted" />
                <div className="skeleton-shine mt-2 h-4 w-12 rounded-md bg-muted" />
              </div>
            ))}
          </div>
          <div className="skeleton-shine mt-5 h-11 w-40 rounded-xl bg-muted" />
        </div>
        <div className="order-1 sm:order-2">
          <div className="skeleton-shine mx-auto aspect-[6/5] w-full max-w-[22rem] rounded-3xl bg-muted" />
        </div>
      </div>
    </section>
  );
}

export function RewardModule({
  eyebrow,
  title,
  description,
  status,
  statusTone = "primary",
  illustration,
  stats,
  progress,
  cta,
  ctaIcon: CtaIcon,
  onCta,
  index = 0,
  empty,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  statusTone?: "primary" | "gold" | "muted";
  illustration: ReactNode;
  stats: ModuleStat[];
  progress?: { label: string; pct: number; hint?: string };
  cta: string;
  ctaIcon?: LucideIcon;
  onCta: () => void;
  index?: number;
  /** When set, replaces the stats grid with a friendly empty state. */
  empty?: { title: string; message: string };
  children?: ReactNode;
}) {
  const reduce = useReducedMotion();


  const toneClass =
    statusTone === "gold"
      ? "border-[color-mix(in_oklab,var(--rw-gold)_45%,transparent)] bg-[color-mix(in_oklab,var(--rw-gold)_14%,transparent)] text-[var(--rw-gold-soft)]"
      : statusTone === "muted"
        ? "border-border bg-surface/60 text-muted-foreground"
        : "border-primary/40 bg-primary/12 text-primary";

  return (
    <motion.section
      aria-label={title}
      initial={reduce ? false : { opacity: 0, y: 26 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.06, 0.3), ease: [0.22, 1, 0.36, 1] }}
      className="rw-module group p-5 sm:p-7"
    >
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] sm:items-center">
        {/* copy + live data */}
        <div className="order-2 min-w-0 sm:order-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {eyebrow}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.68rem] font-semibold ${toneClass}`}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
              </span>
              {status}
            </span>
          </div>

          <h3 className="mt-2 font-display text-xl font-bold tracking-tight sm:text-2xl">{title}</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>

          {empty ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border/80 bg-surface/30 px-4 py-6 text-center">
              <p className="text-sm font-semibold">{empty.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{empty.message}</p>
            </div>
          ) : (
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl border border-border/70 bg-surface/40 p-3 backdrop-blur-sm"
                >
                  <dt className="text-[0.62rem] uppercase leading-tight tracking-wider text-muted-foreground">
                    {s.label}
                  </dt>
                  <dd
                    className={`mt-1 font-display text-base font-bold leading-tight tabular-nums break-words sm:text-lg ${
                      s.accent ? "rw-gold-text" : "text-foreground"
                    }`}
                  >
                    {typeof s.value === "number" && s.animate !== false ? (
                      <AnimatedNumber value={s.value} />
                    ) : (
                      s.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}


          {progress && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{progress.label}</span>
                <span className="tabular-nums">{Math.round(progress.pct)}%</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "var(--gradient-primary)" }}
                  initial={reduce ? false : { width: 0 }}
                  whileInView={{ width: `${Math.max(2, Math.min(100, progress.pct))}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              {progress.hint && (
                <p className="mt-1.5 text-xs text-muted-foreground">{progress.hint}</p>
              )}
            </div>
          )}

          {children}

          <motion.button
            type="button"
            onClick={onCta}
            whileHover={reduce ? undefined : { scale: 1.03, y: -2 }}
            whileTap={reduce ? undefined : { scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 22 }}
            className="rw-shimmer-btn press mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]"
          >
            {CtaIcon && <CtaIcon className="h-4 w-4" aria-hidden="true" />}
            {cta}
          </motion.button>
        </div>

        {/* illustration — 40-50% of the module */}
        <div className="order-1 sm:order-2">
          <div className="relative mx-auto aspect-[6/5] w-full max-w-[22rem]">{illustration}</div>
        </div>
      </div>
    </motion.section>
  );
}
