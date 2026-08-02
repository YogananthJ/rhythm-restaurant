import { useEffect, useRef, useState } from "react";

/**
 * Loaded from a CDN at runtime — never bundled. The Spline runtime calls
 * `new Function(...)` at module init, which the edge SSR runtime forbids
 * ("Code generation from strings disallowed"), which 500s every page.
 */
const RUNTIME_URL = "https://esm.sh/@splinetool/runtime@1.12.98";

type Props = {
  scene: string;
  className?: string;
  /** Accessible description of what the scene shows */
  label: string;
  /** Wait until the section nears the viewport before pulling the runtime. */
  lazy?: boolean;
};

/**
 * Client-only Spline embed.
 * - The canvas lives in JSX but is owned by the Spline runtime after load.
 * - pointer-events:none so it can never swallow scroll, clicks or focus.
 */
export function SplineScene({ scene, className = "", label, lazy = true }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    let disposed = false;
    let app: { dispose?: () => void } | null = null;

    const start = async () => {
      try {
        const mod = (await import(/* @vite-ignore */ RUNTIME_URL)) as {
          Application: new (c: HTMLCanvasElement) => {
            load: (url: string) => Promise<void>;
            dispose?: () => void;
          };
        };
        if (disposed) return;
        const instance = new mod.Application(canvas);
        app = instance;
        await instance.load(scene);
        if (disposed) return;
        setReady(true);
      } catch (err) {
        console.error("[SplineScene] failed to load scene", err);
      }
    };

    if (!lazy) {
      void start();
      return () => {
        disposed = true;
        app?.dispose?.();
      };
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          void start();
        }
      },
      { rootMargin: "600px" },
    );
    io.observe(host);

    return () => {
      disposed = true;
      io.disconnect();
      app?.dispose?.();
    };
  }, [scene, lazy]);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={label}
      className={`relative overflow-hidden ${className}`}
    >
      {/* Ambient placeholder — also the pre-load state */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${
          ready ? "opacity-0" : "opacity-100"
        }`}
        style={{
          background:
            "radial-gradient(60% 60% at 50% 45%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 70%)",
        }}
      />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-700"
        style={{ opacity: ready ? 1 : 0 }}
      />
    </div>
  );
}
