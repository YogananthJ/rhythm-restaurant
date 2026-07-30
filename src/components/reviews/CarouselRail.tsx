import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Infinite auto-scrolling rail.
 *
 * The children are rendered twice; scroll position wraps modulo the width of
 * one copy, so the loop never visibly jumps. Auto-scroll runs on rAF and
 * pauses on hover / focus / pointer-drag, and honours prefers-reduced-motion.
 * Supports pointer drag, wheel (horizontal + vertical), and native touch.
 */
export function CarouselRail({
  children,
  speed = 40,
  ariaLabel,
}: {
  children: ReactNode;
  /** pixels per second */
  speed?: number;
  ariaLabel: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const draggingRef = useRef(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const wrap = useCallback(() => {
    const el = viewportRef.current;
    const copy = copyRef.current;
    if (!el || !copy) return;
    const w = copy.scrollWidth;
    if (w <= 0) return;
    if (el.scrollLeft >= w) el.scrollLeft -= w;
    else if (el.scrollLeft < 0) el.scrollLeft += w;
  }, []);

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 64);
      last = now;
      const el = viewportRef.current;
      if (el && !pausedRef.current && !draggingRef.current) {
        el.scrollLeft += (speed * dt) / 1000;
        wrap();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, speed, wrap]);

  // Pointer drag
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    let startX = 0;
    let startScroll = 0;
    let id: number | null = null;

    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      draggingRef.current = true;
      id = e.pointerId;
      startX = e.clientX;
      startScroll = el.scrollLeft;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
    };
    const move = (e: PointerEvent) => {
      if (!draggingRef.current || e.pointerId !== id) return;
      el.scrollLeft = startScroll - (e.clientX - startX);
      wrap();
    };
    const up = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      el.style.cursor = "";
      if (id !== null && el.hasPointerCapture(id)) el.releasePointerCapture(e.pointerId);
      id = null;
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [wrap]);

  // Wheel: map vertical intent to horizontal travel without hijacking page scroll
  const onWheel = (e: React.WheelEvent) => {
    const el = viewportRef.current;
    if (!el) return;
    const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0;
    if (dx === 0) return;
    el.scrollLeft += dx;
    wrap();
  };

  const pause = () => {
    pausedRef.current = true;
  };
  const resume = () => {
    pausedRef.current = false;
  };

  return (
    <div
      ref={viewportRef}
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
      onWheel={onWheel}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      onScroll={wrap}
      className="no-scrollbar cursor-grab select-none overflow-x-auto overscroll-x-contain focus-visible:outline-none"
      style={{ scrollbarWidth: "none" }}
    >
      <div className="flex w-max">
        <div ref={copyRef} className="flex gap-5 pr-5">
          {children}
        </div>
        <div aria-hidden="true" className="flex gap-5 pr-5">
          {children}
        </div>
      </div>
    </div>
  );
}
