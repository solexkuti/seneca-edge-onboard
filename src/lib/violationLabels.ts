// Human-language translation + severity classification for rule violations
// and mistake IDs. Used across Trade History, Behavior Breakdown, Insights,
// and the violation timeline so the UI never leaks raw DB-style identifiers.

export type ViolationSeverity = "low" | "medium" | "high";

type Entry = {
  /** Regex run against the lower-cased rule id. First match wins. */
  match: RegExp;
  label: string;
  severity: ViolationSeverity;
};

const ENTRIES: Entry[] = [
  // HIGH — risk discipline collapse
  { match: /ignored?[_\s-]?sl|no[_\s-]?sl|removed[_\s-]?sl/, label: "Ignored stop discipline", severity: "high" },
  { match: /moved[_\s-]?sl|widened[_\s-]?sl/, label: "Moved stop loss", severity: "high" },
  { match: /doubled?[_\s-]?(down|position|size)/, label: "Doubled position", severity: "high" },
  { match: /risk[_\s-]?override|broke[_\s-]?risk[_\s-]?rule/, label: "Exceeded allowed risk", severity: "high" },
  { match: /martingale/, label: "Martingaled losses", severity: "high" },

  // MEDIUM — emotional / sizing drift
  { match: /oversiz|over[_\s-]?lever/, label: "Oversized position", severity: "medium" },
  { match: /revenge/, label: "Revenge entry", severity: "medium" },
  { match: /emotional|tilt|fomo/, label: "Emotional execution", severity: "medium" },
  { match: /chase|chased/, label: "Chased price", severity: "medium" },
  { match: /early[_\s-]?entry/, label: "Entered early", severity: "medium" },
  { match: /late[_\s-]?entry/, label: "Entered late", severity: "medium" },

  // LOW — process slips
  { match: /no[_\s-]?setup|invalid[_\s-]?setup|without[_\s-]?confirmation/, label: "Entered without valid setup", severity: "low" },
  { match: /hesitat/, label: "Hesitated despite valid setup", severity: "low" },
  { match: /distract/, label: "Distracted execution", severity: "low" },
  { match: /no[_\s-]?journal/, label: "Skipped journaling", severity: "low" },
  { match: /clean[_\s-]?execution/, label: "Clean execution", severity: "low" },
];

/** Translate a raw rule/mistake id into a human, reflective label. */
export function humanizeViolation(rule: string): string {
  if (!rule) return "Unspecified rule";
  const k = rule.toLowerCase().trim();
  const hit = ENTRIES.find((e) => e.match.test(k));
  if (hit) return hit.label;
  // Fallback: turn snake_case → Sentence case
  return k
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function violationSeverity(rule: string): ViolationSeverity {
  const k = (rule || "").toLowerCase().trim();
  const hit = ENTRIES.find((e) => e.match.test(k));
  return hit?.severity ?? "medium";
}

const SEVERITY_TONE: Record<ViolationSeverity, { dot: string; text: string; ring: string; bg: string }> = {
  low:    { dot: "#FACC15", text: "text-yellow-300", ring: "ring-yellow-500/25", bg: "bg-yellow-500/10" },
  medium: { dot: "#FB923C", text: "text-orange-300", ring: "ring-orange-500/30", bg: "bg-orange-500/10" },
  high:   { dot: "#EF4444", text: "text-rose-300",   ring: "ring-rose-500/30",   bg: "bg-rose-500/10"   },
};

export function severityTone(severity: ViolationSeverity) {
  return SEVERITY_TONE[severity];
}

export function severityRank(severity: ViolationSeverity): number {
  return severity === "high" ? 3 : severity === "medium" ? 2 : 1;
}
