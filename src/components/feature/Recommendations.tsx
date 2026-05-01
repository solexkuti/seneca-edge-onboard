// Recommendations surface.
//
// Renders Recommendation[] as actionable cards the user can mark as a
// "focus" item. Focus state is persisted per-user in localStorage via
// userKey() — never as a global key.
//
// Strictly intelligence: no blocks, no locks, no enforcement.

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, Target, Sparkles } from "lucide-react";
import type {
  Recommendation,
  RecommendationCategory,
  RecommendationPriority,
} from "@/lib/trade";
import { userKey } from "@/lib/userScopedStorage";

const ease = [0.22, 1, 0.36, 1] as const;

const PRIORITY_TONE: Record<RecommendationPriority, string> = {
  critical: "border-rose-500/30 bg-rose-500/[0.04]",
  high: "border-amber-500/25 bg-amber-500/[0.04]",
  medium: "border-[#C6A15B]/20 bg-[#C6A15B]/[0.04]",
  low: "border-white/[0.08] bg-[#18181A]",
};

const PRIORITY_LABEL: Record<RecommendationPriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_DOT: Record<RecommendationPriority, string> = {
  critical: "bg-rose-400",
  high: "bg-amber-400",
  medium: "bg-[#C6A15B]",
  low: "bg-[#9A9A9A]",
};

const CATEGORY_LABEL: Record<RecommendationCategory, string> = {
  risk: "Risk",
  entry: "Entry",
  exit: "Exit",
  behavior: "Behavior",
  discipline: "Discipline",
};

const STORAGE_SUFFIX = "recommendations:focus:v1";

function loadFocus(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(userKey(STORAGE_SUFFIX));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveFocus(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      userKey(STORAGE_SUFFIX),
      JSON.stringify(Array.from(ids)),
    );
  } catch {
    /* ignore */
  }
}

export function Recommendations({
  recommendations,
}: {
  recommendations: Recommendation[];
}) {
  const [focus, setFocus] = useState<Set<string>>(() => new Set());

  // Hydrate after mount so we read the per-user namespace correctly.
  useEffect(() => {
    setFocus(loadFocus());
  }, []);

  // Drop focus ids that no longer exist in the recommendation set.
  useEffect(() => {
    if (!recommendations.length) return;
    const valid = new Set(recommendations.map((r) => r.id));
    setFocus((prev) => {
      const next = new Set<string>();
      let changed = false;
      for (const id of prev) {
        if (valid.has(id)) next.add(id);
        else changed = true;
      }
      if (changed) saveFocus(next);
      return changed ? next : prev;
    });
  }, [recommendations]);

  const ordered = useMemo(() => {
    const rank: Record<RecommendationPriority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    return [...recommendations].sort(
      (a, b) =>
        rank[a.priority] - rank[b.priority] || a.totalImpactR - b.totalImpactR,
    );
  }, [recommendations]);

  function toggle(id: string) {
    setFocus((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFocus(next);
      return next;
    });
  }

  if (!ordered.length) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-[#18181A] p-8 text-center">
        <Sparkles className="mx-auto h-5 w-5 text-[#C6A15B]" />
        <p className="mt-3 text-[13.5px] text-[#EDEDED]">
          No recurring violations to act on.
        </p>
        <p className="mt-1 text-[12px] text-[#9A9A9A]">
          Either you're running clean, or there isn't enough data yet.
        </p>
      </div>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between px-1 mb-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#9A9A9A]">
          Recommended next moves
        </h2>
        <span className="text-[10.5px] text-[#9A9A9A]/70">
          {focus.size} in focus · {ordered.length} total
        </span>
      </div>

      <div className="space-y-3">
        {ordered.map((r, idx) => {
          const isFocused = focus.has(r.id);
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease, delay: idx * 0.04 }}
              className={`relative rounded-2xl border p-4 transition-colors ${
                PRIORITY_TONE[r.priority]
              } ${
                isFocused
                  ? "ring-1 ring-[#C6A15B]/50 shadow-[0_0_25px_rgba(198,161,91,0.15)]"
                  : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => toggle(r.id)}
                  aria-pressed={isFocused}
                  aria-label={
                    isFocused
                      ? `Remove "${r.title}" from focus`
                      : `Mark "${r.title}" as focus`
                  }
                  className="mt-0.5 shrink-0 text-[#C6A15B] hover:text-[#E7C98A] transition-colors"
                >
                  {isFocused ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Circle className="h-5 w-5 text-[#9A9A9A] hover:text-[#C6A15B]" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#EDEDED]/85 bg-white/[0.04] border border-white/[0.06]`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[r.priority]}`}
                      />
                      {PRIORITY_LABEL[r.priority]}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-[#9A9A9A]">
                      {CATEGORY_LABEL[r.category]}
                    </span>
                    <span className="text-[10px] tabular-nums text-[#9A9A9A]/80">
                      {r.timesBroken}× ·{" "}
                      <span
                        className={
                          r.totalImpactR < 0
                            ? "text-rose-300"
                            : r.totalImpactR > 0
                              ? "text-[#E7C98A]"
                              : ""
                        }
                      >
                        {r.totalImpactR > 0 ? "+" : ""}
                        {r.totalImpactR.toFixed(1)}R
                      </span>
                    </span>
                    {isFocused && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#C6A15B]">
                        <Target className="h-3 w-3" /> In focus
                      </span>
                    )}
                  </div>

                  <h3 className="mt-1.5 text-[14px] font-medium text-[#EDEDED] leading-snug">
                    {r.title}
                  </h3>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#EDEDED]/85">
                    {r.action}
                  </p>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#9A9A9A]">
                    {r.why}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
