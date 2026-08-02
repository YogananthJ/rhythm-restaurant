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
 * - The canvas is created imperatively (outside React's tree) because the Spline
 *   runtime mutates/owns the node, which conflicts with React reconciliation.
 * - pointer-events:none so it can never swallow scroll, clicks or focus.
 */
export function SplineScene({ scene, className = "", label }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let disposed = false;
    let app: { dispose?: () => void } | null = null;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0;transition:opacity .7s ease";

    const start = async () => {
      try {
        host.appendChild(canvas);
        // Loaded from CDN at runtime (not bundled): the Spline runtime calls
        // `new Function(...)` at module init, which the edge SSR runtime forbids
        // ("Code generation from strings disallowed"), taking down every page.
        const { Application } = (await import(
          /* @vite-ignore */ RUNTIME_URL
        )) as typeof import("@splinetool/runtime");
        if (disposed) return;
        const instance = new Application(canvas);
        app = instance as unknown as { dispose?: () => void };
        await instance.load(scene);
        if (disposed) return;
        canvas.style.opacity = "1";
        setReady(true);
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
      canvas.remove();
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
    </div>
  );
}
