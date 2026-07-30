import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Filter,
  ImageIcon,
  Search,
  Send,
  Star,
} from "lucide-react";

import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Reveal } from "@/components/Reveal";
import { TestimonialCard } from "@/components/reviews/TestimonialCard";
import { Lightbox, Stars, useLightbox } from "@/components/reviews/ReviewPrimitives";
import { REVIEWS, REVIEW_PHOTOS, REVIEW_STATS, type DiningType } from "@/lib/reviews-data";
import { toast } from "sonner";

export const Route = createFileRoute("/reviews")({
  head: () => ({
    meta: [
      { title: "Customer Reviews — Occupancy Restaurant" },
      {
        name: "description",
        content:
          "Read verified guest reviews of Occupancy: 4.9 average rating across 15,000+ diners, with photos, ordered dishes and restaurant replies.",
      },
      { property: "og:title", content: "Customer Reviews — Occupancy Restaurant" },
      {
        property: "og:description",
        content: "Trusted by thousands of guests — real reviews, real photos, real dishes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReviewsPage,
});

type SortKey = "newest" | "oldest" | "helpful" | "rating";
const DINING: (DiningType | "all")[] = ["all", "family", "couple", "business", "friends"];

function ReviewsPage() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [minRating, setMinRating] = useState(0);
  const [photosOnly, setPhotosOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [dining, setDining] = useState<DiningType | "all">("all");

  const lightbox = useLightbox();
  const [photoSet, setPhotoSet] = useState<string[]>([]);
  const openPhotos = (set: string[], i: number) => {
    setPhotoSet(set);
    lightbox.setIndex(i);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = REVIEWS.filter((r) => {
      if (minRating && r.rating < minRating) return false;
      if (photosOnly && r.photos.length === 0) return false;
      if (verifiedOnly && !r.verified) return false;
      if (dining !== "all" && r.diningType !== dining) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.body.toLowerCase().includes(q) ||
        r.dishes.some((d) => d.toLowerCase().includes(q))
      );
    });
    return list.sort((a, b) => {
      if (sort === "helpful") return b.helpful - a.helpful;
      if (sort === "rating") return b.rating - a.rating;
      if (sort === "oldest") return a.date.localeCompare(b.date);
      return b.date.localeCompare(a.date);
    });
  }, [query, sort, minRating, photosOnly, verifiedOnly, dining]);

  const allPhotos = useMemo(() => REVIEWS.flatMap((r) => r.photos), []);

  return (
    <div className="relative min-h-dvh bg-background text-foreground page-enter">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "var(--gradient-mesh)" }}
      />

      <header className="mx-auto max-w-7xl px-6 pt-10">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-5xl">
          Customer Reviews
        </h1>
        <p className="mt-2 text-muted-foreground">Trusted by thousands of guests.</p>
      </header>

      <main className="mx-auto max-w-7xl px-6 pb-20">
        {/* Summary */}
        <Reveal className="mt-8 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="glass-panel rounded-3xl p-6 text-center">
            <div className="font-display text-5xl font-bold text-gradient-primary">
              <AnimatedNumber value={REVIEW_STATS.average} decimals={1} />
            </div>
            <div className="mt-2 flex justify-center">
              <Stars rating={5} className="h-5 w-5" />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              <AnimatedNumber value={REVIEW_STATS.total} />+ total reviews
            </p>
          </div>
          <div className="glass-panel rounded-3xl p-6">
            <ul className="space-y-2.5">
              {REVIEW_STATS.breakdown.map((b, i) => (
                <li key={b.stars} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                  <span className="inline-flex w-10 shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    {b.stars}
                    <Star className="h-3 w-3 fill-warning text-warning" aria-hidden="true" />
                  </span>
                  <span className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full transition-[width] duration-1000 ease-out"
                      style={{
                        width: `${b.pct}%`,
                        background: "var(--gradient-primary)",
                        transitionDelay: `${i * 90}ms`,
                      }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {b.pct}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        {/* Filters */}
        <section aria-label="Filter reviews" className="glass-panel mt-6 rounded-3xl p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <label className="relative block">
              <span className="sr-only">Search reviews, customers or dishes</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search reviews, customers or dishes…"
                className="h-11 w-full rounded-xl border border-input bg-surface/60 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="sr-only">Sort reviews</span>
              <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-11 rounded-xl border border-input bg-surface/60 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="helpful">Most helpful</option>
                <option value="rating">Highest rated</option>
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {[5, 4, 3].map((r) => (
              <Chip
                key={r}
                active={minRating === r}
                onClick={() => setMinRating(minRating === r ? 0 : r)}
              >
                {r}★ &amp; up
              </Chip>
            ))}
            <Chip active={photosOnly} onClick={() => setPhotosOnly(!photosOnly)}>
              <ImageIcon className="mr-1 inline h-3 w-3" aria-hidden="true" />
              Photos only
            </Chip>
            <Chip active={verifiedOnly} onClick={() => setVerifiedOnly(!verifiedOnly)}>
              Verified
            </Chip>
            <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
            {DINING.map((d) => (
              <Chip key={d} active={dining === d} onClick={() => setDining(d)}>
                <span className="capitalize">{d === "all" ? "All dining" : d}</span>
              </Chip>
            ))}
          </div>
        </section>

        {/* Review list */}
        <section aria-label="Reviews" className="mt-6">
          <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
            Showing {filtered.length} of {REVIEWS.length} reviews
          </p>
          {filtered.length === 0 ? (
            <div className="glass-panel rounded-3xl p-12 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Search className="h-7 w-7" aria-hidden="true" />
              </div>
              <h2 className="mt-4 font-display text-lg font-semibold">No reviews match</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Try clearing a filter or searching for a different dish.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setMinRating(0);
                  setPhotosOnly(false);
                  setVerifiedOnly(false);
                  setDining("all");
                }}
                className="press mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((r, i) => (
                <Reveal key={r.id} delay={i * 60}>
                  <TestimonialCard review={r} onPhotoClick={openPhotos} compactPhotos={false} />
                </Reveal>
              ))}
            </div>
          )}
        </section>

        {/* Photo gallery */}
        <section aria-labelledby="photos-heading" className="mt-16">
          <h2 id="photos-heading" className="font-display text-2xl font-bold">
            Customer food photos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Straight from our guests' tables — tap any photo to view it fullscreen.
          </p>
          <div className="mt-5 columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3">
            {allPhotos.map((p, i) => (
              <button
                key={p + i}
                type="button"
                onClick={() => openPhotos(allPhotos, i)}
                aria-label={`Open customer photo ${i + 1} fullscreen`}
                className="block w-full overflow-hidden rounded-2xl border border-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <img
                  src={p}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-full object-cover transition-transform duration-500 hover:scale-105"
                  style={{ aspectRatio: i % 3 === 0 ? "3 / 4" : "4 / 3" }}
                />
              </button>
            ))}
          </div>
        </section>

        <WriteReview />
      </main>

      <Lightbox
        photos={photoSet}
        index={lightbox.index}
        onClose={lightbox.close}
        onIndexChange={lightbox.setIndex}
      />
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`press inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-medium ${
        active
          ? "border-primary/50 bg-primary/15 text-primary"
          : "border-border bg-surface/60 text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

const RATING_FIELDS = ["Food", "Ambience", "Service", "Cleanliness", "Value"] as const;

function WriteReview() {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  return (
    <section aria-labelledby="write-heading" className="glass-panel mt-16 rounded-3xl p-6 sm:p-8">
      <h2 id="write-heading" className="font-display text-2xl font-bold">
        Write a review
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Dined with us recently? Your feedback helps our kitchen get better every service.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {RATING_FIELDS.map((f) => (
          <fieldset key={f} className="rounded-2xl border border-border/70 bg-surface/40 p-3">
            <legend className="px-1 text-xs font-medium text-muted-foreground">{f}</legend>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} star${n > 1 ? "s" : ""} for ${f}`}
                  aria-pressed={(scores[f] ?? 0) >= n}
                  onClick={() => setScores((s) => ({ ...s, [f]: n }))}
                  className="grid h-8 w-8 place-items-center rounded-md transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-4 w-4 ${
                      (scores[f] ?? 0) >= n
                        ? "fill-warning text-warning"
                        : "text-muted-foreground/40"
                    }`}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="mt-4 grid gap-3">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Review title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sum up your visit"
            className="mt-1 h-11 w-full rounded-xl border border-input bg-surface/60 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Your review</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Tell us about the food, the service and the atmosphere…"
            className="mt-1 w-full rounded-xl border border-input bg-surface/60 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => toast.info("Photo upload arrives with the guest profile release.")}
          className="press inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface/60 px-4 text-sm"
        >
          <Camera className="h-4 w-4" aria-hidden="true" />
          Add photos
        </button>
        <button
          type="button"
          onClick={() => {
            if (!title.trim() || !body.trim()) {
              toast.error("Add a title and a few words before submitting.");
              return;
            }
            toast.success("Thanks! Your review has been submitted for moderation.");
            setTitle("");
            setBody("");
            setScores({});
          }}
          className="press inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          Submit review
        </button>
      </div>
    </section>
  );
}
