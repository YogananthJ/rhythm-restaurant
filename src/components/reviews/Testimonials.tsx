import { Link } from "@tanstack/react-router";
import { ArrowRight, Coffee, IceCream, Pizza, Sandwich, Leaf } from "lucide-react";

import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Reveal } from "@/components/Reveal";
import { REVIEWS, REVIEW_STATS } from "@/lib/reviews-data";
import { TestimonialCard } from "./TestimonialCard";
import { Lightbox, Stars, useLightbox } from "./ReviewPrimitives";
import { CarouselRail } from "./CarouselRail";
import { useState } from "react";

const FLOATERS = [
  { Icon: Coffee, top: "8%", left: "4%", delay: "0s", size: "h-10 w-10" },
  { Icon: Pizza, top: "22%", left: "88%", delay: "1.2s", size: "h-12 w-12" },
  { Icon: Sandwich, top: "70%", left: "10%", delay: "2.1s", size: "h-11 w-11" },
  { Icon: IceCream, top: "82%", left: "80%", delay: "0.6s", size: "h-9 w-9" },
  { Icon: Leaf, top: "45%", left: "50%", delay: "1.7s", size: "h-8 w-8" },
];

export function Testimonials({ signedIn = false }: { signedIn?: boolean }) {
  const lightbox = useLightbox();
  const [photos, setPhotos] = useState<string[]>([]);

  const openPhotos = (set: string[], i: number) => {
    setPhotos(set);
    lightbox.setIndex(i);
  };

  // Signed-in operators already live in the product — show a compact trust strip
  // instead of the full marketing carousel.
  if (signedIn) {
    return (
      <section
        id="testimonials"
        aria-labelledby="testimonials-heading"
        className="mx-auto max-w-7xl px-6 py-10"
      >
        <div className="glass-panel hover-lift flex flex-col items-start justify-between gap-4 rounded-2xl p-5 sm:flex-row sm:items-center">
          <div>
            <h2 id="testimonials-heading" className="font-display text-lg font-semibold">
              Guest reviews
            </h2>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Stars rating={5} className="h-3.5 w-3.5" />
              <span className="font-semibold text-foreground">{REVIEW_STATS.average}</span>
              · {REVIEW_STATS.total.toLocaleString()} reviews
            </div>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              “{REVIEWS[0].body.slice(0, 90)}…”
            </p>
          </div>
          <Link
            to="/reviews"
            className="press inline-flex min-h-11 items-center gap-2 rounded-xl border border-border/60 px-4 text-sm font-semibold hover:border-primary/50"
          >
            View all reviews
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      id="testimonials"
      aria-labelledby="testimonials-heading"
      className="relative overflow-hidden border-t border-border/60 py-20 sm:py-28"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "var(--gradient-mesh)" }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        {FLOATERS.map(({ Icon, top, left, delay, size }, i) => (
          <Icon
            key={i}
            className={`absolute ${size} text-primary/10 float-slow`}
            style={{ top, left, animationDelay: delay }}
          />
        ))}
      </div>

      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Stars rating={5} className="h-3 w-3" />
            Guest love
          </div>
          <h2
            id="testimonials-heading"
            className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-5xl"
          >
            What Our Guests Say
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            Thousands of happy customers have enjoyed unforgettable dining experiences with
            Occupancy.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <dl className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {[
              { label: "Average rating", value: REVIEW_STATS.average, decimals: 1, stars: true },
              { label: "Happy customers", value: REVIEW_STATS.customers, suffix: "+" },
              { label: "Orders served", value: REVIEW_STATS.orders, suffix: "+" },
              { label: "Customer satisfaction", value: REVIEW_STATS.satisfaction, suffix: "%" },
            ].map((s) => (
              <div
                key={s.label}
                className="glass-panel hover-lift rounded-2xl px-4 py-5 text-center"
              >
                {s.stars && (
                  <div className="mb-1 flex justify-center">
                    <Stars rating={5} className="h-3.5 w-3.5" />
                  </div>
                )}
                <dd className="font-display text-2xl font-bold text-gradient-primary sm:text-3xl">
                  <AnimatedNumber
                    value={s.value}
                    decimals={s.decimals ?? 0}
                    suffix={s.suffix ?? ""}
                  />
                </dd>
                <dt className="mt-1 text-xs text-muted-foreground">{s.label}</dt>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>

      {/* Infinite rail — auto-scrolls, pauses on hover/focus, draggable + swipeable */}
      <div className="relative mt-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-background to-transparent sm:w-24"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-background to-transparent sm:w-24"
        />
        <div className="px-6 pb-4">
          <CarouselRail ariaLabel="Customer testimonials carousel" speed={34}>
            {REVIEWS.map((r) => (
              <TestimonialCard
                key={r.id}
                review={r}
                onPhotoClick={openPhotos}
                className="w-[85vw] max-w-[380px] sm:w-[380px]"
              />
            ))}
          </CarouselRail>
        </div>
      </div>

      <div className="mt-10 text-center">
        <Link
          to="/reviews"
          className="press inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]"
        >
          View All Reviews
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <Lightbox
        photos={photos}
        index={lightbox.index}
        onClose={lightbox.close}
        onIndexChange={lightbox.setIndex}
      />
    </section>
  );
}
