// SwipeablePanels — mobile-first paged panels with buttery drag-to-swipe.
//
// Used by the Behavior Breakdown to split dense content into focused,
// one-thought-at-a-time pages. Desktop renders children stacked.
//
// Motion contract:
//   - tracks finger 1:1 (no rubber-band lag)
//   - settles with spring stiffness=320, damping=34
//   - swipe threshold = 18% of viewport OR velocity > 350px/s
//   - keyboard: ←/→ when focused
//   - dots are tappable; both dots and panels share the same index source.

import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

interface SwipeablePanelsProps {
  panels: { id: string; label: string; node: ReactNode }[];
  /** Render mode — "auto" uses panels on <md, stacked on >=md. */
  layout?: "auto" | "always-paged" | "always-stacked";
  className?: string;
}

const SPRING = { type: "spring" as const, stiffness: 320, damping: 34, mass: 0.7 };

export function SwipeablePanels({
  panels,
  layout = "auto",
  className = "",
}: SwipeablePanelsProps) {
  const [index, setIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widthRef = useRef(0);
  const x = useMotionValue(0);

  // Track viewport size to switch between paged and stacked
  useEffect(() => {
    if (layout === "always-paged") return setIsDesktop(false);
    if (layout === "always-stacked") return setIsDesktop(true);
    const mql = window.matchMedia("(min-width: 768px)");
    const handle = () => setIsDesktop(mql.matches);
    handle();
    mql.addEventListener("change", handle);
    return () => mql.removeEventListener("change", handle);
  }, [layout]);

  // Measure panel width and keep x in sync with index on resize
  useEffect(() => {
    if (isDesktop) return;
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      widthRef.current = el.clientWidth;
      x.set(-index * widthRef.current);
    });
    ro.observe(el);
    widthRef.current = el.clientWidth;
    x.set(-index * widthRef.current);
    return () => ro.disconnect();
  }, [isDesktop, index, x]);

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(panels.length - 1, next));
      setIndex(clamped);
      animate(x, -clamped * widthRef.current, SPRING);
    },
    [panels.length, x],
  );

  const onDragEnd = useCallback(
    (_e: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
      const w = widthRef.current || 1;
      const ratio = info.offset.x / w;
      const v = info.velocity.x;
      let next = index;
      if (ratio < -0.18 || v < -350) next = index + 1;
      else if (ratio > 0.18 || v > 350) next = index - 1;
      goTo(next);
    },
    [index, goTo],
  );

  // Keyboard navigation
  useEffect(() => {
    if (isDesktop) return;
    const onKey = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement)) return;
      if (e.key === "ArrowRight") goTo(index + 1);
      else if (e.key === "ArrowLeft") goTo(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, goTo, isDesktop]);

  // Stacked desktop render — render every panel with a section heading
  if (isDesktop) {
    return (
      <div className={`space-y-8 ${className}`}>
        {panels.map((p) => (
          <section key={p.id} aria-label={p.label}>
            {p.node}
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Tab labels */}
      <div
        className="flex items-center gap-1 overflow-x-auto -mx-1 px-1 mb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
      >
        {panels.map((p, i) => {
          const active = i === index;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => goTo(i)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors ${
                active
                  ? "bg-[#C6A15B]/15 text-[#E7C98A] ring-1 ring-[#C6A15B]/30"
                  : "text-[#9A9A9A] hover:text-[#EDEDED]"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Track */}
      <div
        ref={containerRef}
        className="relative overflow-hidden touch-pan-y select-none"
        tabIndex={0}
      >
        <motion.div
          className="flex"
          style={{ x, willChange: "transform" }}
          drag="x"
          dragElastic={0.08}
          dragMomentum={false}
          dragConstraints={{
            left: -((panels.length - 1) * (widthRef.current || 0)),
            right: 0,
          }}
          onDragEnd={onDragEnd}
        >
          {panels.map((p, i) => (
            <Panel key={p.id} active={i === index}>
              {p.node}
            </Panel>
          ))}
        </motion.div>
      </div>

      {/* Dot pager */}
      <div className="mt-4 flex items-center justify-center gap-2">
        {panels.map((p, i) => {
          const active = i === index;
          return (
            <button
              key={p.id}
              type="button"
              aria-label={`Go to ${p.label}`}
              onClick={() => goTo(i)}
              className="group p-1"
            >
              <span
                className={`block h-1.5 rounded-full transition-all duration-300 ${
                  active
                    ? "w-5 bg-[#C6A15B]"
                    : "w-1.5 bg-[#9A9A9A]/40 group-hover:bg-[#9A9A9A]/70"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Each panel takes the full track width, fades in subtly when active.
function Panel({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  // Children prop is single ReactNode; use Children.only for safety in tests
  Children.toArray(children); // no-op, satisfies linter
  return (
    <motion.div
      className="w-full shrink-0 px-0.5"
      animate={{ opacity: active ? 1 : 0.55, scale: active ? 1 : 0.985 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      aria-hidden={!active}
    >
      {children}
    </motion.div>
  );
}
