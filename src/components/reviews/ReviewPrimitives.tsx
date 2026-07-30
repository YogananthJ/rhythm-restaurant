import { useCallback, useEffect, useState } from "react";
import { Star, X, ChevronLeft, ChevronRight } from "lucide-react";

export function Stars({
  rating,
  className = "h-4 w-4",
  shimmer = false,
}: {
  rating: number;
  className?: string;
  shimmer?: boolean;
}) {
  return (
    <div
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={`${className} transition-transform duration-300 ${
            shimmer ? "group-hover:scale-110" : ""
          } ${
            i <= Math.round(rating)
              ? "fill-warning text-warning"
              : "text-muted-foreground/40"
          }`}
          style={shimmer ? { transitionDelay: `${i * 40}ms` } : undefined}
        />
      ))}
    </div>
  );
}

/** Accessible fullscreen photo viewer with arrow-key navigation. */
export function Lightbox({
  photos,
  index,
  onClose,
  onIndexChange,
}: {
  photos: string[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}) {
  const open = index !== null;

  const step = useCallback(
    (delta: number) => {
      if (index === null) return;
      onIndexChange((index + delta + photos.length) % photos.length);
    },
    [index, photos.length, onIndexChange],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose, step]);

  if (!open || index === null) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Customer photo viewer"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 p-4 backdrop-blur-md drop-in"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Close photo viewer"
        onClick={onClose}
        className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full border border-border bg-surface/80 text-foreground press"
      >
        <X className="h-5 w-5" />
      </button>
      {photos.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
            className="absolute left-3 grid h-11 w-11 place-items-center rounded-full border border-border bg-surface/80 press"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
            className="absolute right-3 grid h-11 w-11 place-items-center rounded-full border border-border bg-surface/80 press"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
      <img
        src={photos[index]}
        alt={`Customer photo ${index + 1} of ${photos.length}`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[80dvh] w-auto max-w-full rounded-2xl border border-white/10 object-contain shadow-2xl scale-in"
      />
    </div>
  );
}

/** Small hook that owns lightbox state for a photo set. */
export function useLightbox() {
  const [index, setIndex] = useState<number | null>(null);
  return { index, setIndex, open: (i: number) => setIndex(i), close: () => setIndex(null) };
}
