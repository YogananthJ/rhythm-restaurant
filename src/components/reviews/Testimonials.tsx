import { Link } from "@tanstack/react-router";
import { ArrowRight, Coffee, IceCream, Pizza, Sandwich, Leaf } from "lucide-react";

import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Reveal } from "@/components/Reveal";
import { REVIEWS, REVIEW_STATS } from "@/lib/reviews-data";
import { TestimonialCard } from "./TestimonialCard";
import { Lightbox, Stars, useLightbox } from "./ReviewPrimitives";
import { useState } from "react";

const FLOATERS = [
  { Icon: Coffee, top: "8%", left: "4%", delay: "0s", size: "h-10 w-10" },
  { Icon: Pizza, top: "22%", left: "88%", delay: "1.2s", size: "h-12 w-12" },
  { Icon: Sandwich, top: "70%", left: "10%", delay: "2.1s", size: "h-11 w-11" },
  { Icon: IceCream, top: "82%", left: "80%", delay: "0.6s", size: "h-9 w-9" },
  { Icon: Leaf, top: "45%", left: "50%", delay: "1.7s", size: "h-8 w-8" },
];

export function Testimonials() {
  const lightbox = useLightbox();
  const [photos, setPhotos] = useState<string[]>([]);

  const openPhotos = (set: string[], i: number) => {
    setPhotos(set);
    lightbox.setIndex(i);
  };

  // Duplicated once so the marquee loops without a visible jump.
  const track = [...REVIEWS, ...REVIEWS];

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

      {/* Infinite marquee — pauses on hover/focus, natively swipeable on touch */}
      <div
        className="marquee group relative mt-12 overflow-x-auto"
        role="region"
        aria-label="Customer testimonials carousel"
        tabIndex={0}
      >
        <div className="marquee-track flex w-max gap-5 px-6 pb-4">
          {track.map((r, i) => (
            <TestimonialCard
              key={`${r.id}-${i}`}
              review={r}
              onPhotoClick={openPhotos}
              className="w-[85vw] max-w-[380px] sm:w-[380px]"
            />
          ))}
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
