import { useCallback, useState } from "react";

type Props = {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  /** Set true only for the LCP image (hero) */
  priority?: boolean;
  rounded?: string;
};

/**
 * Lazy, skeleton-backed illustration. Never renders a blank box:
 * a shimmering placeholder holds the exact aspect ratio until decode.
 */
export function Illustration({
  src,
  alt,
  width,
  height,
  className = "",
  priority = false,
  rounded = "rounded-2xl",
}: Props) {
  const [loaded, setLoaded] = useState(false);

  // Images cached/decoded before hydration never fire onLoad, which would leave
  // the illustration stuck at opacity-0. Check `complete` when the node mounts.
  const imgRef = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete) setLoaded(true);
  }, []);

  return (
    <div
      className={`skeleton-shine relative overflow-hidden ${rounded} border border-white/10 bg-surface/60 ${className}`}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "low"}
        onLoad={() => setLoaded(true)}
        className={`h-full w-full object-cover transition-opacity duration-500 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, transparent 45%, color-mix(in oklab, var(--background) 70%, transparent) 100%)",
        }}
      />
    </div>
  );
}
