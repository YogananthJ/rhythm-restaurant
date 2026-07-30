import { Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, Star } from "lucide-react";

import { REVIEWS, REVIEW_STATS } from "@/lib/reviews-data";
import { Stars } from "./ReviewPrimitives";

/** Compact staff-facing summary of the latest guest reviews. */
export function ReviewsWidget() {
  const latest = [...REVIEWS].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);

  return (
    <section
      aria-labelledby="reviews-widget-heading"
      className="mt-6 rounded-xl border border-white/10 bg-card/70 p-6 backdrop-blur"
    >
      <header className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h2 id="reviews-widget-heading" className="truncate text-lg font-semibold">
            Latest guest reviews
          </h2>
          <p className="text-xs text-muted-foreground">
            {REVIEW_STATS.average.toFixed(1)} average across {REVIEW_STATS.total.toLocaleString()}{" "}
            reviews
          </p>
        </div>
        <Link
          to="/reviews"
          className="press inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-primary/30 px-3 text-xs font-medium text-primary"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </header>

      <ul className="grid gap-3 lg:grid-cols-3">
        {latest.map((r) => (
          <li
            key={r.id}
            className="row-hover rounded-lg border border-border/60 bg-surface/50 p-4"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-[11px] font-bold text-primary">
                {r.initials}
              </span>
              <span className="truncate text-sm font-medium">{r.name}</span>
              {r.verified && (
                <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              )}
              <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs tabular-nums text-warning">
                <Star className="h-3 w-3 fill-warning" aria-hidden="true" />
                {r.rating}
              </span>
            </div>
            <div className="mt-2">
              <Stars rating={r.rating} className="h-3 w-3" />
            </div>
            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
              {r.body}
            </p>
            {!r.reply && (
              <span className="mt-2 inline-block rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning">
                Awaiting reply
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
