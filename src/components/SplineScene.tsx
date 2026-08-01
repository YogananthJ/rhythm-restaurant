import { useEffect, useRef, useState } from "react";

type Props = {
  scene: string;
  className?: string;
  /** Accessible description of what the scene shows */
  label: string;
};

/**
 * Client-only, viewport-gated Spline embed.
 * - The ~1MB runtime is dynamically imported only once the section nears the viewport.
 * - Skipped entirely for reduced-motion users; a static glow placeholder stays.
 * - Canvas is pointer-events:none so it can never swallow scroll, clicks or focus.
 */
export function SplineScene({ scene, className = "", label }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let disposed = false;
    let app: { dispose?: () => void } | null = null;

    const start = async () => {
      try {
        const { Application } = await import("@splinetool/runtime");
        if (disposed) return;
        const instance = new Application(canvas);
        app = instance as unknown as { dispose?: () => void };
        await instance.load(scene);
        if (!disposed) setReady(true);
      } catch {
        // Silent: the gradient placeholder remains as the visual fallback.
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          void start();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(host);

    return () => {
      disposed = true;
      io.disconnect();
      app?.dispose?.();
    };
  }, [scene]);

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
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`pointer-events-none relative h-full w-full transition-opacity duration-700 ${
          ready ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
