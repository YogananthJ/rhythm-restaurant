import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Images } from "lucide-react";

import { GuestHeader } from "@/components/guest/GuestHeader";
import { GuestFooter } from "@/components/guest/GuestFooter";
import { Badge } from "@/components/ui/badge";
import { GALLERY } from "@/lib/guest-catalog";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Gallery — Occupancy Demo Kitchen" },
      { name: "description", content: "Step inside: dining room, chef's pass, signature dishes and the ambience of a full house on a Friday night." },
      { property: "og:title", content: "Gallery — Occupancy Demo Kitchen" },
      { property: "og:description", content: "Interiors, dining area, signature dishes, chefs and guest ambience." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GalleryPage,
});

function GalleryPage() {
  const [index, setIndex] = useState<number | null>(null);
  const open = index !== null;
  const current = open ? GALLERY[index!] : null;

  const step = (d: number) => setIndex((i) => (i === null ? null : (i + d + GALLERY.length) % GALLERY.length));

  return (
    <div className="relative min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "var(--gradient-mesh)" }} aria-hidden="true" />
      <GuestHeader />

      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="max-w-2xl">
          <Badge variant="secondary" className="mb-3">
            <Images className="mr-1.5 h-3.5 w-3.5" /> Gallery
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Inside the restaurant</h1>
          <p className="mt-2 text-muted-foreground">
            The room, the pass, the plates and the people. Tap any photo to open it full screen.
          </p>
        </div>

        <div className="mt-10 columns-1 gap-5 sm:columns-2 lg:columns-3 [&>*]:mb-5">
          {GALLERY.map((g, i) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setIndex(i)}
              className="hover-lift group block w-full break-inside-avoid overflow-hidden rounded-2xl border border-white/10 bg-surface/40 text-left"
              aria-label={`Open photo: ${g.title}`}
            >
              <img
                src={g.src}
                alt={g.title}
                loading="lazy"
                decoding="async"
                className={`w-full object-cover transition-transform duration-500 group-hover:scale-105 ${i % 3 === 1 ? "aspect-[4/5]" : "aspect-[4/3]"}`}
              />
              <div className="p-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">{g.tag}</span>
                <h2 className="mt-1 truncate text-base font-semibold">{g.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{g.blurb}</p>
              </div>
            </button>
          ))}
        </div>
      </main>

      {open && current && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={current.title}
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === "Escape") setIndex(null);
            if (e.key === "ArrowRight") step(1);
            if (e.key === "ArrowLeft") step(-1);
          }}
          ref={(el) => el?.focus()}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4 backdrop-blur-xl"
        >
          <button
            type="button"
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-surface/60"
            onClick={() => setIndex(null)}
            aria-label="Close photo"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="absolute left-3 grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-surface/60"
            onClick={() => step(-1)}
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <figure className="scale-in max-h-[85dvh] w-full max-w-3xl">
            <img src={current.src} alt={current.title} className="max-h-[70dvh] w-full rounded-2xl object-cover" />
            <figcaption className="mt-3 text-center">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">{current.tag}</span>
              <div className="text-lg font-semibold">{current.title}</div>
              <p className="text-sm text-muted-foreground">{current.blurb}</p>
            </figcaption>
          </figure>
          <button
            type="button"
            className="absolute right-3 grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-surface/60"
            onClick={() => step(1)}
            aria-label="Next photo"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      <GuestFooter />
    </div>
  );
}
