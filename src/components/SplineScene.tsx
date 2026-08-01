import { Suspense, lazy, useEffect, useRef, useState } from "react";

// Runtime is heavy (~1MB) — only pulled once the section scrolls near the viewport.
const Spline = lazy(() => import("@splinetool/react-spline"));

type Props = {
  scene: string;
  className?: string;
  /** Accessible description of what the scene shows */
  label: string;
};

/**
 * Client-only, viewport-gated Spline embed.
 * - Never renders during SSR (the runtime touches window/WebGL).
 * - Skipped entirely for reduced-motion users; a static glow placeholder stays.
 * - Pointer events are disabled so the canvas can never swallow scroll or clicks.
 */
export function SplineScene({ scene, className = "", label }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [show, setShow] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // Some GPU-less/headless environments never fire Spline's onLoad; reveal anyway.
  useEffect(() => {
    if (!show || ready) return;
    const t = setTimeout(() => setReady(true), 4000);
    return () => clearTimeout(t);
  }, [show, ready]);


  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={label}
      className={`relative overflow-hidden ${className}`}
    >
      {/* Ambient placeholder — also the reduced-motion / pre-load state */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${
          ready ? "opacity-40" : "opacity-100"
        }`}
        style={{
          background:
            "radial-gradient(60% 60% at 50% 45%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 70%)",
        }}
      />
      {show && (
        <Suspense fallback={null}>
          <div
            className={`h-full w-full transition-opacity duration-700 ${
              ready ? "opacity-100" : "opacity-0"
            }`}
            style={{ touchAction: "pan-y" }}
          >
            <Spline
              scene={scene}
              onLoad={() => setReady(true)}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </Suspense>
      )}
    </div>
  );
}
