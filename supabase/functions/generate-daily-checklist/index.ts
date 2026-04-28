// generate-daily-checklist
// Produces a personalized daily PDF based on:
//   - active strategy (structured rules)
//   - last 20 trades + behavior patterns
//   - deterministic control state engine
//
// AI is used ONLY for the "Today's Focus" wording (3 short lines).
// All rules, restrictions, and structure are deterministic.

import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ControlState = "in_control" | "at_risk" | "out_of_control";

type AdaptiveRule = { text: string; source: string };

type Computed = {
  control_state: ControlState;
  discipline_score: number;
  current_streak: number;
  allowed_tiers: string[];
  adaptive_rules: AdaptiveRule[];
  weak_categories: string[];
  pause_required: boolean;
  delay_minutes: number;
  suggest_no_trade_day: boolean;
  hard_rules: string[];
  self_check_questions: string[];
  insufficient_data: boolean;
};

const PATTERN_TO_RULE: Record<string, string> = {
  overtrading: "Maximum 2 trades today. Stop after the second, win or lose.",
  early_exit:
    "No manual exit before TP unless invalidation occurs. Define invalidation in writing.",
  revenge:
    "No re-entry after a loss without completing the full checklist from scratch.",
  undisciplined_streak:
    "You have broken your system multiple times in a row. Take only one trade today.",
  rule_breaking_entry:
    "Read your entry rule out loud before clicking. Screenshot the setup first.",
  rule_breaking_exit:
    "Exit only at predefined TP or SL. No discretionary closes.",
  rule_breaking_risk:
    "Recalculate position size before every entry. Risk must match the plan exactly.",
  rule_breaking_behavior:
    "If you feel urgency, walk away for 10 minutes before placing the order.",
  consecutive_losses_after_break:
    "Two losses already followed a rule break. Stop trading for the rest of the session.",
};

function computeControlState(score: number): ControlState {
  if (!Number.isFinite(score)) return "out_of_control";
  if (score >= 85) return "in_control";
  if (score >= 60) return "at_risk";
  return "out_of_control";
}

function computeChecklist(input: {
  discipline_score: number | null;
  discipline_score_available: boolean;
  last_20_trades_count: number;
  current_streak: number;
  behavior_patterns: string[];
}): Computed {
  // SAFETY: When discipline data is missing/unavailable, default to "at_risk".
  // We never assume "in_control" without evidence, and we never silently
  // collapse to "out_of_control" (which would suggest broken discipline that
  // never actually happened). "at_risk" is the conservative middle ground.
  const hasScore =
    input.discipline_score_available &&
    typeof input.discipline_score === "number" &&
    Number.isFinite(input.discipline_score);
  const score = hasScore
    ? Math.max(0, Math.min(100, Math.round(input.discipline_score as number)))
    : 0;
  const state: ControlState = hasScore ? computeControlState(score) : "at_risk";
  const allowed_tiers =
    state === "in_control"
      ? ["A+", "B+", "C"]
      : state === "at_risk"
        ? ["A+", "B+"]
        : ["A+"];
  const pause_required = state !== "in_control";
  const delay_minutes = state === "out_of_control" ? 5 : 0;

  const weak_categories: string[] = [];
  for (const p of input.behavior_patterns) {
    if (p === "rule_breaking_entry") weak_categories.push("entry");
    if (p === "rule_breaking_exit") weak_categories.push("exit");
    if (p === "rule_breaking_risk") weak_categories.push("risk");
    if (p === "rule_breaking_behavior") weak_categories.push("behavior");
  }

  const adaptive_rules: AdaptiveRule[] = [];
  const seen = new Set<string>();
  for (const p of input.behavior_patterns) {
    const text = PATTERN_TO_RULE[p];
    if (text && !seen.has(text)) {
      adaptive_rules.push({ text, source: "behavior_pattern" });
      seen.add(text);
    }
  }
  if (state === "at_risk") {
    const t = "Pause and re-read the checklist out loud before any entry.";
    if (!seen.has(t)) {
      adaptive_rules.push({ text: t, source: "control_state" });
      seen.add(t);
    }
  }
  if (state === "out_of_control") {
    for (const t of [
      "Only A+ setups allowed today. Anything less is a no.",
      "Wait 5 minutes between identifying a setup and executing it.",
      "Maximum 1 trade today. Stop regardless of outcome.",
    ]) {
      if (!seen.has(t)) {
        adaptive_rules.push({ text: t, source: "control_state" });
        seen.add(t);
      }
    }
  }

  const suggest_no_trade_day =
    state === "out_of_control" &&
    input.behavior_patterns.some(
      (p) =>
        p === "consecutive_losses_after_break" || p === "undisciplined_streak",
    );

  return {
    control_state: state,
    discipline_score: score,
    current_streak: Math.max(0, Math.floor(input.current_streak || 0)),
    allowed_tiers,
    adaptive_rules,
    weak_categories: Array.from(new Set(weak_categories)),
    pause_required,
    delay_minutes,
    suggest_no_trade_day,
    hard_rules: [
      "No setup = no trade.",
      "No emotional execution. If you feel rushed, you stop.",
      "Risk must be predefined before the entry, not after.",
      "If a rule is unclear in the moment, the answer is no.",
    ],
    self_check_questions: [
      "Am I following my system, or am I improvising?",
      "Am I forcing this trade because I want action?",
      "Would I take this exact setup yesterday, with no P&L pressure?",
    ],
    insufficient_data: input.last_20_trades_count < 3,
  };
}

function sanitize(s: string): string {
  return s
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "*")
    .replace(/[\u00A0]/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A1-\u00FF]/g, "");
}

function wrap(font: any, text: string, size: number, maxWidth: number): string[] {
  const words = sanitize(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const probe = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(probe, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = probe;
  }
  if (line) lines.push(line);
  return lines;
}

async function generateFocus(
  computed: Computed,
  weakCategories: string[],
): Promise<string[]> {
  // AI ONLY generates 3 short focus statements. It cannot inject rules.
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return defaultFocus(computed, weakCategories);

  const prompt = `You write 3 short, direct focus statements for a trader's daily plan. No greetings, no fluff. Each line ≤ 15 words. Tone: ${
    computed.control_state === "out_of_control"
      ? "firm and serious"
      : computed.control_state === "at_risk"
        ? "cautious and direct"
        : "neutral and precise"
  }.

Context:
- Discipline score: ${computed.discipline_score}/100
- Control state: ${computed.control_state}
- Streak: ${computed.current_streak} clean trades
- Weak rule categories: ${weakCategories.join(", ") || "none"}
- Behavior patterns active: ${computed.adaptive_rules.length}

Return JSON: {"focus":["...","...","..."]}. Nothing else.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You output strict JSON only." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) return defaultFocus(computed, weakCategories);
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) return defaultFocus(computed, weakCategories);
    const parsed = JSON.parse(m[0]);
    const focus = Array.isArray(parsed?.focus) ? parsed.focus.slice(0, 3) : [];
    if (focus.length === 0) return defaultFocus(computed, weakCategories);
    return focus.map((s: unknown) => String(s));
  } catch {
    return defaultFocus(computed, weakCategories);
  }
}

function defaultFocus(c: Computed, weak: string[]): string[] {
  const lines: string[] = [];
  if (c.control_state === "out_of_control") {
    lines.push("Discipline has broken down. Today is about repair, not profit.");
  } else if (c.control_state === "at_risk") {
    lines.push("Your edge is thinning. Tighten execution before anything else.");
  } else {
    lines.push("System is intact. Keep the standard high — do not get loose.");
  }
  if (weak.length > 0) lines.push(`Focus on your ${weak.join(" and ")} rule today.`);
  if (c.adaptive_rules.length > 0)
    lines.push("Read every adaptive rule before your first entry.");
  return lines.slice(0, 3);
}

// ---------- Escalation engine (deterministic) ----------

type EscalationLevel = 0 | 1 | 2 | 3;

function computeEscalation(args: {
  consecutive_breaks: number;
  has_repeat_pattern: boolean;
}): { level: EscalationLevel; label: string; description: string } {
  if (args.consecutive_breaks >= 3 || args.has_repeat_pattern) {
    return {
      level: 3,
      label: "LOCKDOWN",
      description: "Repeated rule breaks. A+ setups only, with mandatory delay.",
    };
  }
  if (args.consecutive_breaks === 2) {
    return {
      level: 2,
      label: "STRICT MODE",
      description: "Two broken trades in a row. Tightened tiers, pause before entry.",
    };
  }
  if (args.consecutive_breaks === 1) {
    return {
      level: 1,
      label: "WARNING",
      description: "Last trade broke the plan. Read the checklist out loud before re-entry.",
    };
  }
  return {
    level: 0,
    label: "STABLE",
    description: "System holding. Standard rules apply.",
  };
}

// ---------- Behavioral interpretation (AI — sharp, no rule generation) ----------

async function generateBehaviorInterpretation(args: {
  control_state: ControlState;
  consecutive_breaks: number;
  behavior_patterns: string[];
  weak_categories: string[];
  current_streak: number;
}): Promise<string | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;
  // Skip when there's nothing meaningful to interpret.
  if (
    args.consecutive_breaks === 0 &&
    args.behavior_patterns.length === 0 &&
    args.weak_categories.length === 0
  ) {
    return null;
  }

  const prompt = `You are writing one sharp psychological observation for a trader, in 2-3 sentences. You DO NOT create rules. You DO NOT recommend setups. You name what is actually going on underneath the behavior, in plain language.

Style:
- Specific, not generic. Bad: "you need more discipline". Good: "you are entering before confirmation because you fear missing the move — that is impatience, not opportunity".
- Direct. No softeners like "it might be that". State the pattern.
- Never moralizing. Observation, not judgment.
- Reference the data. Tie the pattern to the actual broken category or behavior pattern listed.
- Do NOT invent rules, setups, or strategies.
- Max 60 words. Plain prose. No bullets, no headings.

Context:
- Control state: ${args.control_state}
- Consecutive broken trades: ${args.consecutive_breaks}
- Current clean-trade streak: ${args.current_streak}
- Weak rule categories: ${args.weak_categories.join(", ") || "none"}
- Behavior patterns active: ${args.behavior_patterns.join(", ") || "none"}

Return JSON: {"interpretation":"..."}.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You output strict JSON only." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]);
    const text = typeof parsed?.interpretation === "string" ? parsed.interpretation.trim() : "";
    return text || null;
  } catch {
    return null;
  }
}

// ---------- Stable rule ID builder ----------

type RuleEntry = {
  id: string;
  category: "entry" | "exit" | "risk" | "behavior" | "adaptive";
  label: string;
  weak: boolean;
};

function buildRuleList(
  strategy_rules: { entry: string[]; exit: string[]; risk: string[]; behavior: string[] },
  computed: Computed,
): RuleEntry[] {
  const out: RuleEntry[] = [];
  const cats: Array<["entry" | "exit" | "risk" | "behavior", string[]]> = [
    ["entry", strategy_rules.entry],
    ["exit", strategy_rules.exit],
    ["risk", strategy_rules.risk],
    ["behavior", strategy_rules.behavior],
  ];
  for (const [cat, items] of cats) {
    items.forEach((label, i) => {
      out.push({
        id: `${cat}-${i + 1}`,
        category: cat,
        label,
        weak: computed.weak_categories.includes(cat),
      });
    });
  }
  computed.adaptive_rules.forEach((r, i) => {
    out.push({
      id: `adaptive-${i + 1}`,
      category: "adaptive",
      label: r.text,
      weak: false,
    });
  });
  return out;
}



const A4: [number, number] = [595.28, 841.89];
const MARGIN = 56;

type Frame = {
  doc: PDFDocument;
  page: any;
  font: any;
  bold: any;
  y: number;
  pageNum: number;
};

function newPage(f: Frame) {
  f.page = f.doc.addPage(A4);
  f.y = A4[1] - MARGIN;
  f.pageNum += 1;
}

function ensure(f: Frame, need: number) {
  if (f.y - need < MARGIN + 28) newPage(f);
}

const INK = rgb(0.11, 0.12, 0.14);
const MUTED = rgb(0.45, 0.5, 0.58);
const ACCENT = rgb(0.74, 0.55, 0.18);
const GREEN = rgb(0.18, 0.55, 0.34);
const ORANGE = rgb(0.85, 0.55, 0.15);
const RED = rgb(0.78, 0.22, 0.22);

function stateColor(s: ControlState) {
  return s === "in_control" ? GREEN : s === "at_risk" ? ORANGE : RED;
}
function stateLabel(s: ControlState) {
  return s === "in_control"
    ? "IN CONTROL"
    : s === "at_risk"
      ? "AT RISK"
      : "OUT OF CONTROL";
}

function drawTitle(f: Frame, text: string, size = 26) {
  ensure(f, size + 8);
  f.page.drawText(sanitize(text), {
    x: MARGIN,
    y: f.y - size,
    size,
    font: f.bold,
    color: INK,
  });
  f.y -= size + 10;
}

function drawHeading(f: Frame, text: string) {
  ensure(f, 24);
  f.page.drawText(sanitize(text), {
    x: MARGIN,
    y: f.y - 14,
    size: 14,
    font: f.bold,
    color: ACCENT,
  });
  f.y -= 22;
}

function drawSubtle(f: Frame, text: string) {
  const lines = wrap(f.font, text, 10, A4[0] - MARGIN * 2);
  for (const ln of lines) {
    ensure(f, 14);
    f.page.drawText(ln, { x: MARGIN, y: f.y - 10, size: 10, font: f.font, color: MUTED });
    f.y -= 14;
  }
  f.y -= 4;
}

function drawParagraph(f: Frame, text: string) {
  const lines = wrap(f.font, text, 11, A4[0] - MARGIN * 2);
  for (const ln of lines) {
    ensure(f, 15);
    f.page.drawText(ln, { x: MARGIN, y: f.y - 11, size: 11, font: f.font, color: INK });
    f.y -= 15;
  }
  f.y -= 6;
}

function drawCheckbox(f: Frame, text: string) {
  const lines = wrap(f.font, text, 11, A4[0] - MARGIN * 2 - 22);
  for (let i = 0; i < lines.length; i++) {
    ensure(f, 16);
    if (i === 0) {
      f.page.drawRectangle({
        x: MARGIN,
        y: f.y - 12,
        width: 11,
        height: 11,
        borderColor: INK,
        borderWidth: 1,
      });
    }
    f.page.drawText(lines[i], {
      x: MARGIN + 20,
      y: f.y - 11,
      size: 11,
      font: f.font,
      color: INK,
    });
    f.y -= 16;
  }
  f.y -= 2;
}

function drawBullet(f: Frame, text: string, color = INK) {
  const lines = wrap(f.font, text, 11, A4[0] - MARGIN * 2 - 16);
  for (let i = 0; i < lines.length; i++) {
    ensure(f, 15);
    if (i === 0) {
      f.page.drawText("•", {
        x: MARGIN,
        y: f.y - 11,
        size: 12,
        font: f.bold,
        color: ACCENT,
      });
    }
    f.page.drawText(lines[i], {
      x: MARGIN + 14,
      y: f.y - 11,
      size: 11,
      font: f.font,
      color,
    });
    f.y -= 15;
  }
  f.y -= 2;
}

function drawBadge(f: Frame, label: string, color: any) {
  const padX = 10;
  const padY = 6;
  const size = 12;
  const w = f.bold.widthOfTextAtSize(label, size) + padX * 2;
  const h = size + padY * 2;
  ensure(f, h + 6);
  f.page.drawRectangle({
    x: MARGIN,
    y: f.y - h,
    width: w,
    height: h,
    color,
  });
  f.page.drawText(label, {
    x: MARGIN + padX,
    y: f.y - h + padY + 2,
    size,
    font: f.bold,
    color: rgb(1, 1, 1),
  });
  f.y -= h + 8;
}

function drawDivider(f: Frame) {
  ensure(f, 14);
  f.page.drawLine({
    start: { x: MARGIN, y: f.y - 6 },
    end: { x: A4[0] - MARGIN, y: f.y - 6 },
    thickness: 0.5,
    color: rgb(0.85, 0.87, 0.9),
  });
  f.y -= 14;
}

async function renderPdf(opts: {
  computed: Computed;
  strategy_rules: { entry: string[]; exit: string[]; risk: string[]; behavior: string[] };
  focus: string[];
  strategyName: string;
  todayLabel: string;
}): Promise<Uint8Array> {
  const { computed, strategy_rules, focus, strategyName, todayLabel } = opts;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const f: Frame = { doc, page: doc.addPage(A4), font, bold, y: A4[1] - MARGIN, pageNum: 1 };

  // PAGE 1 — Cover
  drawTitle(f, "DAILY EXECUTION CHECKLIST", 24);
  drawSubtle(f, `Date: ${todayLabel}  ·  Strategy: ${strategyName}`);
  f.y -= 6;
  drawBadge(f, stateLabel(computed.control_state), stateColor(computed.control_state));
  drawHeading(f, "Discipline Score");
  drawParagraph(f, `${computed.discipline_score} / 100`);
  drawHeading(f, "Streak");
  drawParagraph(
    f,
    `${computed.current_streak} clean trade${computed.current_streak === 1 ? "" : "s"}`,
  );
  drawHeading(f, "Allowed Setups Today");
  drawParagraph(f, computed.allowed_tiers.join("  ·  "));
  if (computed.suggest_no_trade_day) {
    drawDivider(f);
    drawHeading(f, "Recommendation");
    drawParagraph(
      f,
      "Recent behavior suggests this should be a no-trade day. Review and reset.",
    );
  }
  if (computed.insufficient_data) {
    drawDivider(f);
    drawSubtle(
      f,
      "Limited data: fewer than 3 recent trades. Today's checklist uses defaults — log trades to refine it.",
    );
  }

  // PAGE 2 — Focus
  newPage(f);
  drawTitle(f, "Focus for Today");
  drawSubtle(f, "Three things to hold in mind before any entry.");
  f.y -= 4;
  for (const line of focus) drawBullet(f, line);

  // PAGE 3 — Core checklist
  newPage(f);
  drawTitle(f, "Pre-Trade Checklist");
  drawSubtle(f, "Every box must be checked before you place the order.");
  const coreOrder: Array<["entry" | "exit" | "risk" | "behavior", string]> = [
    ["entry", "Entry"],
    ["exit", "Exit"],
    ["risk", "Risk"],
    ["behavior", "Behavior"],
  ];
  for (const [key, label] of coreOrder) {
    const items = strategy_rules[key] ?? [];
    if (items.length === 0) continue;
    const isWeak = computed.weak_categories.includes(key);
    drawHeading(f, isWeak ? `${label}  —  WEAK AREA` : label);
    for (const item of items) drawCheckbox(f, item);
    f.y -= 4;
  }

  // PAGE 4 — Adaptive rules
  newPage(f);
  drawTitle(f, "Today's Adjustments");
  drawSubtle(
    f,
    computed.control_state === "in_control"
      ? "No restrictions today. Keep your standard."
      : "These rules override default behavior. They apply only today.",
  );
  if (computed.adaptive_rules.length === 0) {
    drawParagraph(f, "No adaptive rules required today.");
  } else {
    for (const r of computed.adaptive_rules) drawBullet(f, r.text, INK);
  }

  // PAGE 5 — Execution flow
  newPage(f);
  drawTitle(f, "Execution Protocol");
  drawSubtle(f, "Follow these steps in order. Do not skip.");
  const steps = [
    "1.  Confirm the setup against your strategy rules.",
    "2.  Validate every checkbox in the pre-trade checklist.",
    computed.pause_required
      ? `3.  Pause${computed.delay_minutes ? ` for ${computed.delay_minutes} minutes` : ""}. Re-read the adaptive rules.`
      : "3.  Pause briefly. Confirm there is no urgency.",
    "4.  Execute at predefined entry, with predefined risk.",
    "5.  No interference after entry. TP and SL only.",
  ];
  for (const s of steps) drawParagraph(f, s);

  // PAGE 6 — Hard rules
  newPage(f);
  drawTitle(f, "Non-Negotiables");
  drawSubtle(f, "These never change. Not today, not ever.");
  for (const r of computed.hard_rules) drawBullet(f, r);

  // PAGE 7 — Self-check
  newPage(f);
  drawTitle(f, "Before You Trade");
  drawSubtle(f, "Answer each one honestly. If any answer is no, do not trade.");
  for (const q of computed.self_check_questions) drawCheckbox(f, q);

  // Footers
  const total = doc.getPageCount();
  for (let i = 0; i < total; i++) {
    const p = doc.getPage(i);
    p.drawText(sanitize(`${todayLabel}  ·  ${strategyName}`), {
      x: MARGIN,
      y: 28,
      size: 9,
      font,
      color: MUTED,
    });
    const right = `Page ${i + 1} of ${total}`;
    const w = font.widthOfTextAtSize(right, 9);
    p.drawText(right, { x: A4[0] - MARGIN - w, y: 28, size: 9, font, color: MUTED });
  }

  return await doc.save();
}

// ---------- Data fetch ----------

type ActiveStrategyRow = {
  id: string;
  name: string;
  structured_rules: any;
};

async function loadInputs(supabase: any, userId: string) {
  // Active blueprint (most recent locked, else latest)
  const { data: blueprints } = await supabase
    .from("strategy_blueprints")
    .select("id,name,structured_rules,locked,updated_at")
    .eq("user_id", userId)
    .order("locked", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1);

  const bp = blueprints?.[0];

  // Last 20 trades + discipline logs
  const { data: trades } = await supabase
    .from("trades")
    .select(
      "id,executed_at,discipline_logs(followed_entry,followed_exit,followed_risk,followed_behavior,discipline_score)",
    )
    .eq("user_id", userId)
    .order("executed_at", { ascending: false })
    .limit(20);

  // Behavior patterns (recent, unique by pattern_type)
  const { data: patterns } = await supabase
    .from("behavior_patterns")
    .select("pattern_type,kind,last_triggered_at")
    .eq("user_id", userId)
    .order("last_triggered_at", { ascending: false })
    .limit(20);

  // Compute discipline_score and current_streak
  const tradesArr = trades ?? [];
  const scores: number[] = [];
  for (const t of tradesArr) {
    const dl = Array.isArray(t.discipline_logs) ? t.discipline_logs[0] : t.discipline_logs;
    if (dl && typeof dl.discipline_score === "number") scores.push(dl.discipline_score);
  }
  // If no scored discipline logs exist, mark score as unavailable.
  // Downstream defaults the control_state to "at_risk" (safer than assuming "in_control").
  const discipline_score_available = scores.length > 0;
  const discipline_score = discipline_score_available
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : null;

  let current_streak = 0;
  let consecutive_breaks = 0;
  let countingBreaks = true;
  for (const t of tradesArr) {
    const dl = Array.isArray(t.discipline_logs) ? t.discipline_logs[0] : t.discipline_logs;
    const clean =
      dl && dl.followed_entry && dl.followed_exit && dl.followed_risk && dl.followed_behavior;
    if (clean) {
      current_streak += 1;
      countingBreaks = false;
    } else {
      // Streak ends at the first non-clean trade.
      // consecutive_breaks counts how many of the most recent trades broke the plan.
      if (countingBreaks) consecutive_breaks += 1;
      else break;
    }
    if (current_streak > 0 && !clean) break;
  }

  // Behavior patterns -> normalized kinds + repeat detection.
  const behavior_patterns: string[] = [];
  const seen = new Set<string>();
  let has_repeat_pattern = false;
  for (const p of patterns ?? []) {
    const key = (p.pattern_type || p.kind || "").toString();
    if (key && !seen.has(key)) {
      seen.add(key);
      behavior_patterns.push(key);
    }
    // pg trigger_count can be exposed later; for now infer repeats by duplicates
  }
  // Pull a fresh "repeat" signal: any pattern with >1 trigger
  const { data: repeats } = await supabase
    .from("behavior_patterns")
    .select("trigger_count")
    .eq("user_id", userId)
    .gt("trigger_count", 1)
    .limit(1);
  has_repeat_pattern = (repeats?.length ?? 0) > 0;

  // Streak from server table (authoritative; trigger maintains it)
  const { data: streakRow } = await supabase
    .from("daily_streaks")
    .select("current_streak,longest_streak,identity_label,last_break_date")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    blueprint: bp as ActiveStrategyRow | undefined,
    discipline_score,
    discipline_score_available,
    last_20_trades_count: tradesArr.length,
    current_streak: streakRow?.current_streak ?? current_streak,
    longest_streak: streakRow?.longest_streak ?? current_streak,
    identity_label: streakRow?.identity_label ?? "starting fresh",
    last_break_date: streakRow?.last_break_date ?? null,
    consecutive_breaks,
    has_repeat_pattern,
    behavior_patterns,
  };
}

function normalizeRules(structured: any): {
  entry: string[];
  exit: string[];
  risk: string[];
  behavior: string[];
} {
  const pick = (k: string): string[] => {
    const v = structured?.[k];
    if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
    if (typeof v === "string" && v.trim()) return [v.trim()];
    return [];
  };
  return {
    entry: [...pick("entry"), ...pick("confirmation")],
    exit: pick("exit"),
    risk: pick("risk"),
    behavior: pick("behavior"),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing auth token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const {
      blueprint,
      discipline_score,
      discipline_score_available,
      last_20_trades_count,
      current_streak,
      longest_streak,
      identity_label,
      last_break_date,
      consecutive_breaks,
      has_repeat_pattern,
      behavior_patterns,
    } = await loadInputs(supabase, userId);

    // HARD GATE: no strategy → block generation. No defaults, no guessing.
    if (!blueprint) {
      return new Response(
        JSON.stringify({
          code: "STRATEGY_REQUIRED",
          error:
            "No active strategy found. Build and lock a strategy in the Strategy Builder before generating a daily checklist.",
          next_action: "open_strategy_builder",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const strategy_rules = normalizeRules(blueprint.structured_rules);
    const totalRules =
      strategy_rules.entry.length +
      strategy_rules.exit.length +
      strategy_rules.risk.length +
      strategy_rules.behavior.length;
    if (totalRules === 0) {
      return new Response(
        JSON.stringify({
          code: "STRATEGY_RULES_EMPTY",
          error:
            "Strategy has no structured rules. Complete the Strategy Builder before generating a daily checklist.",
          next_action: "open_strategy_builder",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const computed = computeChecklist({
      discipline_score,
      discipline_score_available,
      last_20_trades_count,
      current_streak,
      behavior_patterns,
    });

    const escalation = computeEscalation({
      consecutive_breaks,
      has_repeat_pattern,
    });

    // Escalation can FORCE tighter restrictions on top of the score-based state.
    if (escalation.level >= 2 && computed.allowed_tiers.length > 1) {
      computed.allowed_tiers = ["A+"];
    }
    if (escalation.level === 3 && !computed.suggest_no_trade_day) {
      computed.suggest_no_trade_day = true;
    }

    const [focus, interpretation] = await Promise.all([
      generateFocus(computed, computed.weak_categories),
      generateBehaviorInterpretation({
        control_state: computed.control_state,
        consecutive_breaks,
        behavior_patterns,
        weak_categories: computed.weak_categories,
        current_streak,
      }),
    ]);

    const rules = buildRuleList(strategy_rules, computed);

    const today = new Date();
    const todayLabel = today.toISOString().slice(0, 10);

    const bytes = await renderPdf({
      computed,
      strategy_rules,
      focus,
      strategyName: blueprint.name || "Strategy",
      todayLabel,
    });

    const wantJson = (req.headers.get("Accept") || "").includes("application/json");
    if (wantJson) {
      const b64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
      return new Response(
        JSON.stringify({
          control_state: computed.control_state,
          discipline_score: computed.discipline_score,
          allowed_tiers: computed.allowed_tiers,
          applied_restrictions: computed.adaptive_rules.map((r) => r.text),
          weak_categories: computed.weak_categories,
          focus,
          suggest_no_trade_day: computed.suggest_no_trade_day,
          strategy_name: blueprint.name || "Strategy",
          generated_for: todayLabel,
          rules,
          escalation,
          streak: {
            current: current_streak,
            longest: longest_streak,
            identity: identity_label,
            last_break_date,
          },
          interpretation,
          pdf_base64: b64,
          filename: `daily-checklist-${todayLabel}.pdf`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="daily-checklist-${todayLabel}.pdf"`,
        "X-Control-State": computed.control_state,
        "X-Discipline-Score": String(computed.discipline_score),
      },
    });
  } catch (err) {
    console.error("generate-daily-checklist error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
