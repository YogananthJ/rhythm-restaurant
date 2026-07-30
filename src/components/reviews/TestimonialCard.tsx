import { BadgeCheck, MapPin, Quote, ThumbsUp } from "lucide-react";
import type { Review } from "@/lib/reviews-data";
import { Stars } from "./ReviewPrimitives";

/** Premium glass testimonial card used by the carousel and the reviews page. */
export function TestimonialCard({
  review,
  onPhotoClick,
  compactPhotos = true,
  className = "",
}: {
  review: Review;
  onPhotoClick?: (photos: string[], index: number) => void;
  compactPhotos?: boolean;
  className?: string;
}) {
  return (
    <article
      className={`group glass-panel hover-lift relative flex flex-col overflow-hidden rounded-3xl p-6 ${className}`}
    >
      <Quote
        aria-hidden="true"
        className="pointer-events-none absolute -right-3 -top-3 h-20 w-20 text-primary/10"
      />

      <header className="flex min-w-0 items-center gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-primary/30 bg-primary/15 text-base font-bold text-primary transition-transform duration-300 group-hover:scale-105">
          {review.initials}
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-semibold">{review.name}</span>
            {review.verified && (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                title="Verified customer"
              >
                <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                Verified
              </span>
            )}
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
              {review.location}
            </span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">{review.visited}</span>
          </div>
        </div>
      </header>

      <div className="mt-4">
        <Stars rating={review.rating} shimmer />
        <h3 className="mt-2 font-display text-lg font-semibold leading-snug">{review.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{review.body}</p>
      </div>

      {review.dishes.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Ordered
          </div>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {review.dishes.map((d) => (
              <li
                key={d}
                className="rounded-full border border-border/70 bg-surface/60 px-2.5 py-1 text-xs text-foreground/85"
              >
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}

      {review.photos.length > 0 && (
        <div
          className={`mt-4 grid gap-2 ${compactPhotos ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-4"}`}
        >
          {review.photos.slice(0, 4).map((p, i) => (
            <button
              key={p + i}
              type="button"
              onClick={() => onPhotoClick?.(review.photos, i)}
              aria-label={`Open photo ${i + 1} from ${review.name}'s review`}
              className="overflow-hidden rounded-xl border border-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <img
                src={p}
                alt=""
                loading="lazy"
                decoding="async"
                className="aspect-square w-full object-cover transition-transform duration-500 hover:scale-110"
              />
            </button>
          ))}
        </div>
      )}

      {review.reply && (
        <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/[0.07] p-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/20 text-[10px] font-bold text-primary">
              OC
            </span>
            <span className="font-medium">{review.reply.author}</span>
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
              {review.reply.role}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{review.reply.body}</p>
        </div>
      )}

      <footer className="mt-4 flex items-center gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
        {review.helpful} found this helpful
        <span className="ml-auto capitalize">{review.diningType} dining</span>
      </footer>
    </article>
  );
}
