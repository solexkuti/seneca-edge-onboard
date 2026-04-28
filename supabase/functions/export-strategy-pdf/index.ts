// export-strategy-pdf — Premium A4 PDFs for both documents:
//   kind=checklist → 4-page Execution Checklist
//   kind=plan      → 11-page Trading Manual
//
// Layout is fully deterministic: a tiny "frame" engine controls page,
// margins, font sizes, spacing, page breaks, accent rule, header & footer.
// AI does not influence layout — only the user's content fills it.
//
// Render with pdf-lib via esm.sh (no native binaries).

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, RGB } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Types accepted from the client
// ---------------------------------------------------------------------------
type ChecklistByTier = { a_plus?: string[]; b_plus?: string[]; c?: string[] };

type StructuredRules = {
  entry?: string[];
  confirmation?: string[];
  risk?: string[];
  behavior?: string[];
  context?: string[];
};

type Payload = {
  kind: "checklist" | "plan";
  name: string;
  accountTypes?: string[];
  riskProfile?: {
    risk_per_trade_pct?: number | null;
    daily_loss_limit_pct?: number | null;
    max_drawdown_pct?: number | null;
  };
  checklist?: ChecklistByTier;
  trading_plan?: string;
  structured_rules?: StructuredRules;
  tier_rules?: { a_plus?: string; b_plus?: string; c?: string };
};

// ---------------------------------------------------------------------------
// Encoding safety — StandardFonts use WinAnsi; strip anything outside it.
// ---------------------------------------------------------------------------
function sanitize(s: string): string {
  return (s ?? "")
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "*")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A1-\u00FF]/g, "");
}

// ---------------------------------------------------------------------------
// Deterministic layout engine
// ---------------------------------------------------------------------------
// A4 in points
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56; // ≈ 40px at typical screen DPI; comfortable on print.
const CONTENT_W = PAGE_W - MARGIN * 2;

// Premium palette — charcoal ink, muted slate, soft gold accent.
const INK: RGB = rgb(0.11, 0.12, 0.14);
const MUTED: RGB = rgb(0.42, 0.46, 0.52);
const RULE: RGB = rgb(0.84, 0.86, 0.9);
const ACCENT: RGB = rgb(0.74, 0.55, 0.18); // soft gold

// Type scale
const SIZE = {
  title: 30,
  subtitle: 13,
  sectionLabel: 10, // small caps eyebrow
  h1: 20,
  h2: 14,
  body: 11,
  small: 9,
};

const LEAD = {
  title: 36,
  subtitle: 18,
  h1: 26,
  h2: 19,
  body: 16,
  small: 13,
};

type Frame = {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  y: number;
  pageNumber: number;
  totalPages: () => number;
  brandName: string;
};

function newFrame(
  doc: PDFDocument,
  font: PDFFont,
  bold: PDFFont,
  italic: PDFFont,
  brandName: string,
): Frame {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const f: Frame = {
    doc,
    page,
    font,
    bold,
    italic,
    y: PAGE_H - MARGIN,
    pageNumber: 1,
    totalPages: () => doc.getPageCount(),
    brandName,
  };
  return f;
}

function addPage(f: Frame) {
  f.page = f.doc.addPage([PAGE_W, PAGE_H]);
  f.pageNumber = f.doc.getPageCount();
  f.y = PAGE_H - MARGIN;
}

function ensureRoom(f: Frame, need: number) {
  if (f.y - need < MARGIN + 32 /* footer reserve */) addPage(f);
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const rawLine of text.split("\n")) {
    const words = rawLine.split(/\s+/);
    let line = "";
    for (const w of words) {
      const probe = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(probe, size) > maxWidth && line) {
        out.push(line);
        line = w;
      } else {
        line = probe;
      }
    }
    out.push(line);
  }
  return out;
}

// Drawing primitives — every block computes its required height first, then
// either fits on the current page or starts a fresh one. No awkward breaks.
function drawCentered(f: Frame, text: string, size: number, font: PDFFont, color: RGB, yOffset = 0) {
  const t = sanitize(text);
  const w = font.widthOfTextAtSize(t, size);
  f.page.drawText(t, {
    x: (PAGE_W - w) / 2,
    y: f.y - size + yOffset,
    size,
    font,
    color,
  });
}

function drawText(
  f: Frame,
  text: string,
  opts: { size: number; lead: number; font: PDFFont; color: RGB; indent?: number; maxWidth?: number },
) {
  const indent = opts.indent ?? 0;
  const maxW = (opts.maxWidth ?? CONTENT_W) - indent;
  const lines = wrap(opts.font, sanitize(text), opts.size, maxW);
  for (const ln of lines) {
    ensureRoom(f, opts.lead);
    f.page.drawText(ln, {
      x: MARGIN + indent,
      y: f.y - opts.size,
      size: opts.size,
      font: opts.font,
      color: opts.color,
    });
    f.y -= opts.lead;
  }
}

function drawRule(f: Frame, color: RGB = RULE, width = CONTENT_W) {
  ensureRoom(f, 8);
  f.page.drawLine({
    start: { x: MARGIN, y: f.y },
    end: { x: MARGIN + width, y: f.y },
    thickness: 0.5,
    color,
  });
  f.y -= 8;
}

function drawAccentBar(f: Frame, width = 36) {
  ensureRoom(f, 8);
  f.page.drawRectangle({
    x: MARGIN,
    y: f.y - 2,
    width,
    height: 2,
    color: ACCENT,
  });
  f.y -= 14;
}

function spacer(f: Frame, h: number) {
  f.y -= h;
}

function eyebrow(f: Frame, text: string) {
  drawText(f, text.toUpperCase(), {
    size: SIZE.sectionLabel,
    lead: 14,
    font: f.bold,
    color: MUTED,
  });
}

function h1(f: Frame, text: string) {
  ensureRoom(f, LEAD.h1 + 6);
  drawText(f, text, { size: SIZE.h1, lead: LEAD.h1, font: f.bold, color: INK });
  drawAccentBar(f);
}

function h2(f: Frame, text: string) {
  ensureRoom(f, LEAD.h2 + 4);
  spacer(f, 4);
  drawText(f, text, { size: SIZE.h2, lead: LEAD.h2, font: f.bold, color: INK });
  spacer(f, 2);
}

function body(f: Frame, text: string) {
  drawText(f, text, { size: SIZE.body, lead: LEAD.body, font: f.font, color: INK });
}

function muted(f: Frame, text: string) {
  drawText(f, text, { size: SIZE.small, lead: LEAD.small, font: f.font, color: MUTED });
}

// Bullet with accent dot
function bullet(f: Frame, text: string) {
  const indent = 18;
  const lines = wrap(f.font, sanitize(text), SIZE.body, CONTENT_W - indent);
  // Reserve enough room for the whole bullet (no breaking on its first line).
  ensureRoom(f, lines.length * LEAD.body);
  // Dot
  f.page.drawCircle({
    x: MARGIN + 5,
    y: f.y - SIZE.body + 3,
    size: 1.8,
    color: ACCENT,
  });
  for (let i = 0; i < lines.length; i++) {
    f.page.drawText(lines[i], {
      x: MARGIN + indent,
      y: f.y - SIZE.body,
      size: SIZE.body,
      font: f.font,
      color: INK,
    });
    f.y -= LEAD.body;
  }
}

// Empty checkbox + title + one-line description
function checklistBlock(f: Frame, title: string, description: string) {
  const titleSize = SIZE.body + 1;
  const descLines = wrap(f.font, sanitize(description), SIZE.small, CONTENT_W - 28);
  const blockH = LEAD.body + descLines.length * LEAD.small + 14;
  ensureRoom(f, blockH);

  const top = f.y;
  // Box
  f.page.drawRectangle({
    x: MARGIN,
    y: top - 14,
    width: 12,
    height: 12,
    borderWidth: 0.8,
    borderColor: INK,
  });
  // Title
  f.page.drawText(sanitize(title), {
    x: MARGIN + 22,
    y: top - 12,
    size: titleSize,
    font: f.bold,
    color: INK,
  });
  f.y -= LEAD.body + 2;
  // Description
  for (const ln of descLines) {
    f.page.drawText(ln, {
      x: MARGIN + 22,
      y: f.y - SIZE.small,
      size: SIZE.small,
      font: f.font,
      color: MUTED,
    });
    f.y -= LEAD.small;
  }
  spacer(f, 10);
}

// A bordered tier card with a title strip
function tierCard(f: Frame, title: string, subtitle: string, items: string[]) {
  const innerPad = 14;
  const titleH = 22;
  const subLines = wrap(f.font, sanitize(subtitle), SIZE.small, CONTENT_W - innerPad * 2);
  const itemLineCount = items.reduce((acc, it) => {
    return acc + wrap(f.font, sanitize(it), SIZE.body, CONTENT_W - innerPad * 2 - 16).length;
  }, 0);
  const cardH =
    titleH +
    subLines.length * LEAD.small +
    Math.max(itemLineCount, 1) * LEAD.body +
    innerPad * 2 +
    10;

  ensureRoom(f, cardH + 10);
  const top = f.y;

  // Card background border
  f.page.drawRectangle({
    x: MARGIN,
    y: top - cardH,
    width: CONTENT_W,
    height: cardH,
    borderWidth: 0.6,
    borderColor: RULE,
  });
  // Accent strip (left)
  f.page.drawRectangle({
    x: MARGIN,
    y: top - cardH,
    width: 3,
    height: cardH,
    color: ACCENT,
  });

  // Title
  f.page.drawText(sanitize(title), {
    x: MARGIN + innerPad,
    y: top - innerPad - SIZE.h2 + 2,
    size: SIZE.h2,
    font: f.bold,
    color: INK,
  });
  let cursor = top - innerPad - SIZE.h2 - 6;
  for (const ln of subLines) {
    f.page.drawText(ln, {
      x: MARGIN + innerPad,
      y: cursor - SIZE.small,
      size: SIZE.small,
      font: f.font,
      color: MUTED,
    });
    cursor -= LEAD.small;
  }
  cursor -= 4;
  // Items
  if (items.length === 0) {
    f.page.drawText("No rules in this tier.", {
      x: MARGIN + innerPad,
      y: cursor - SIZE.body,
      size: SIZE.body,
      font: f.italic,
      color: MUTED,
    });
    cursor -= LEAD.body;
  } else {
    for (const it of items) {
      const lines = wrap(f.font, sanitize(it), SIZE.body, CONTENT_W - innerPad * 2 - 16);
      for (let i = 0; i < lines.length; i++) {
        if (i === 0) {
          f.page.drawCircle({
            x: MARGIN + innerPad + 4,
            y: cursor - SIZE.body + 3,
            size: 1.6,
            color: ACCENT,
          });
        }
        f.page.drawText(lines[i], {
          x: MARGIN + innerPad + 14,
          y: cursor - SIZE.body,
          size: SIZE.body,
          font: f.font,
          color: INK,
        });
        cursor -= LEAD.body;
      }
    }
  }

  f.y = top - cardH - 14;
}

// Highlighted numeric stat — used in the Risk Framework page
function statRow(f: Frame, label: string, value: string) {
  ensureRoom(f, 26);
  f.page.drawText(sanitize(label), {
    x: MARGIN,
    y: f.y - SIZE.body,
    size: SIZE.body,
    font: f.font,
    color: MUTED,
  });
  const v = sanitize(value);
  const w = f.bold.widthOfTextAtSize(v, SIZE.h2);
  f.page.drawText(v, {
    x: MARGIN + CONTENT_W - w,
    y: f.y - SIZE.h2 + 2,
    size: SIZE.h2,
    font: f.bold,
    color: ACCENT,
  });
  f.y -= 22;
  drawRule(f);
}

// Footer — drawn AFTER all pages exist so we can write "page x of y".
function drawFooters(doc: PDFDocument, font: PDFFont, brand: string) {
  const total = doc.getPageCount();
  for (let i = 0; i < total; i++) {
    const p = doc.getPage(i);
    const isCover = i === 0;
    if (isCover) continue;
    p.drawLine({
      start: { x: MARGIN, y: MARGIN - 18 },
      end: { x: PAGE_W - MARGIN, y: MARGIN - 18 },
      thickness: 0.4,
      color: RULE,
    });
    p.drawText(sanitize(brand), {
      x: MARGIN,
      y: MARGIN - 32,
      size: SIZE.small,
      font,
      color: MUTED,
    });
    const right = `Page ${i + 1} of ${total}`;
    const rw = font.widthOfTextAtSize(right, SIZE.small);
    p.drawText(right, {
      x: PAGE_W - MARGIN - rw,
      y: MARGIN - 32,
      size: SIZE.small,
      font,
      color: MUTED,
    });
  }
}

// ---------------------------------------------------------------------------
// Cover page (shared)
// ---------------------------------------------------------------------------
function drawCover(
  f: Frame,
  opts: { eyebrow: string; title: string; subtitle: string; strategyName: string; date: string },
) {
  // Already on a fresh page from newFrame()
  // Vertical centering via large top spacing.
  f.y = PAGE_H - 220;

  // Top brand mark, small
  drawCentered(f, "SENECAEDGE", SIZE.sectionLabel, f.bold, MUTED);
  f.y -= 22;
  // Accent bar centered
  const barW = 32;
  f.page.drawRectangle({
    x: (PAGE_W - barW) / 2,
    y: f.y,
    width: barW,
    height: 2,
    color: ACCENT,
  });
  f.y -= 60;

  // Eyebrow
  drawCentered(f, opts.eyebrow.toUpperCase(), SIZE.subtitle, f.bold, ACCENT);
  f.y -= 32;
  // Title (very large) — supports multi-line via \n
  for (const line of opts.title.split("\n")) {
    drawCentered(f, line, SIZE.title, f.bold, INK);
    f.y -= SIZE.title + 4;
  }
  f.y -= 8;
  // Subtitle
  drawCentered(f, opts.subtitle, SIZE.subtitle, f.italic, MUTED);

  // Bottom block — strategy name + date, centered toward bottom
  const bottomY = MARGIN + 120;
  f.y = bottomY;
  // Divider
  f.page.drawLine({
    start: { x: PAGE_W / 2 - 60, y: f.y },
    end: { x: PAGE_W / 2 + 60, y: f.y },
    thickness: 0.5,
    color: RULE,
  });
  f.y -= 20;
  drawCentered(f, opts.strategyName, SIZE.h2, f.bold, INK);
  f.y -= 18;
  drawCentered(f, `Generated ${opts.date}`, SIZE.small, f.font, MUTED);
}

// ---------------------------------------------------------------------------
// Helpers — pull AI-content lines, with safe fallbacks
// ---------------------------------------------------------------------------
function pickRules(p: Payload, key: keyof StructuredRules): string[] {
  return (p.structured_rules?.[key] ?? []).filter((s) => s && s.trim().length > 0);
}

function firstSentence(s: string): string {
  const m = s.match(/[^.!?]+[.!?]/);
  return (m ? m[0] : s).trim();
}

// ---------------------------------------------------------------------------
// DOCUMENT 1 — EXECUTION CHECKLIST (4 pages)
// ---------------------------------------------------------------------------
function renderChecklist(f: Frame, p: Payload) {
  const dateStr = new Date().toISOString().slice(0, 10);

  // PAGE 1 — Cover
  drawCover(f, {
    eyebrow: "Execution Checklist",
    title: "EXECUTION\nCHECKLIST",
    subtitle: "Your Personal Trading Discipline System",
    strategyName: p.name || "Trading Strategy",
    date: dateStr,
  });

  // PAGE 2 — Core checklist
  addPage(f);
  eyebrow(f, "Document 1 of 1");
  spacer(f, 6);
  h1(f, "Pre-Trade Requirements");
  muted(
    f,
    "Tick every box before execution. Skipping any item invalidates the setup.",
  );
  spacer(f, 12);

  const entry = pickRules(p, "entry");
  const conf = pickRules(p, "confirmation");
  const risk = pickRules(p, "risk");
  const beh = pickRules(p, "behavior");

  checklistBlock(
    f,
    "Entry Condition",
    entry[0] ?? "Wait for the precise entry signal defined in your system.",
  );
  checklistBlock(
    f,
    "Confirmation",
    conf[0] ?? "A second, independent signal must align with the entry.",
  );
  checklistBlock(
    f,
    "Risk Condition",
    risk[0] ??
      `Risk per trade no greater than ${p.riskProfile?.risk_per_trade_pct ?? 1}% of account.`,
  );
  checklistBlock(
    f,
    "Behavior Condition",
    beh[0] ?? "Calm, rested, no recent loss-induced urgency.",
  );

  // PAGE 3 — Tier rules
  addPage(f);
  eyebrow(f, "Standards");
  spacer(f, 6);
  h1(f, "Execution Standards");
  muted(f, "Three tiers. Three different levels of permission to trade.");
  spacer(f, 14);

  tierCard(
    f,
    "A+  Setup — Perfect Execution",
    "All rules must be met. No deviation allowed.",
    p.checklist?.a_plus ?? [...entry, ...conf, ...risk, ...beh],
  );
  tierCard(
    f,
    "B+  Setup — Controlled Flexibility",
    "One non-critical rule may fail. All entry and risk rules still required.",
    p.checklist?.b_plus ?? [...entry, ...risk],
  );
  tierCard(
    f,
    "C  Setup — Minimum Acceptable",
    "Only the core conditions are required.",
    p.checklist?.c ?? entry.slice(0, 1),
  );

  // PAGE 4 — Discipline summary
  addPage(f);
  eyebrow(f, "Mindset");
  spacer(f, 6);
  h1(f, "Discipline Principles");
  muted(f, "Your edge is consistency. Read these before every session.");
  spacer(f, 16);

  for (const it of [
    "Do not trade without checklist completion.",
    "No emotional entries — calm hands only.",
    "Respect risk boundaries without exception.",
    "One clean trade beats multiple impulsive trades.",
    "If in doubt, stay out. The market will be here tomorrow.",
  ]) {
    bullet(f, it);
  }
}

// ---------------------------------------------------------------------------
// DOCUMENT 2 — TRADING MANUAL (11 pages)
// ---------------------------------------------------------------------------
function renderPlan(f: Frame, p: Payload) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const entry = pickRules(p, "entry");
  const conf = pickRules(p, "confirmation");
  const risk = pickRules(p, "risk");
  const beh = pickRules(p, "behavior");
  const ctx = pickRules(p, "context");

  // PAGE 1 — Cover
  drawCover(f, {
    eyebrow: "Trading Manual",
    title: "YOUR\nTRADING SYSTEM",
    subtitle: "Structured Execution Framework",
    strategyName: p.name || "Trading Strategy",
    date: dateStr,
  });

  // PAGE 2 — System Overview
  addPage(f);
  eyebrow(f, "Page 1 · Foundation");
  spacer(f, 6);
  h1(f, "System Overview");
  if (p.trading_plan && p.trading_plan.trim()) {
    body(f, firstSentence(p.trading_plan));
  } else {
    body(
      f,
      `${p.name} is a discretionary system executed against a fixed checklist. Every trade is graded against the same criteria, regardless of market conditions.`,
    );
  }
  spacer(f, 8);
  h2(f, "Core Philosophy");
  body(f, "Process before profit. Setups before opinions. Discipline before discretion.");
  h2(f, "Market Approach");
  body(
    f,
    `Account types: ${(p.accountTypes ?? []).join(", ") || "unspecified"}. Risk is fixed per trade and capped on the day; one undisciplined trade does not become three.`,
  );

  // PAGE 3 — Market Structure Model
  addPage(f);
  eyebrow(f, "Page 2 · Context");
  spacer(f, 6);
  h1(f, "Market Context");
  h2(f, "Trend Identification");
  body(
    f,
    "Establish the higher-timeframe trend first. A trend is defined by sequential structure breaks in one direction; without that, the market is in range.",
  );
  h2(f, "Structure Definition");
  body(
    f,
    "Structure is read from confirmed candle closes only. Wicks do not count as breaks. Mark prior swing highs and lows before looking for entries.",
  );
  h2(f, "Higher Timeframe Logic");
  if (ctx.length) {
    for (const c of ctx) bullet(f, c);
  } else {
    body(
      f,
      "Always check at least one higher timeframe than the execution chart. Take trades only in the direction of higher-timeframe structure.",
    );
  }

  // PAGE 4 — Entry Logic
  addPage(f);
  eyebrow(f, "Page 3 · Entry");
  spacer(f, 6);
  h1(f, "Entry Conditions");
  if (entry.length === 0) {
    muted(f, "No entry rules defined yet.");
  } else {
    for (let i = 0; i < entry.length; i++) {
      h2(f, `Rule ${i + 1}`);
      body(f, `Condition: ${entry[i]}`);
      body(f, "Trigger: Confirmed close — never enter on a wick or projected candle.");
      spacer(f, 4);
    }
  }

  // PAGE 5 — Confirmation Logic
  addPage(f);
  eyebrow(f, "Page 4 · Confluence");
  spacer(f, 6);
  h1(f, "Confirmation Rules");
  body(
    f,
    "Confirmations are independent signals that align with the entry. Without confirmation, the entry is incomplete.",
  );
  spacer(f, 4);
  h2(f, "Required Confluences");
  if (conf.length === 0) {
    muted(f, "No confirmation rules defined yet.");
  } else {
    for (const c of conf) bullet(f, c);
  }

  // PAGE 6 — Risk Management
  addPage(f);
  eyebrow(f, "Page 5 · Risk");
  spacer(f, 6);
  h1(f, "Risk Framework");
  muted(f, "Hard caps. Non-negotiable. Risk decisions are made before execution.");
  spacer(f, 14);
  statRow(f, "Risk per trade", `${p.riskProfile?.risk_per_trade_pct ?? "—"}%`);
  statRow(f, "Daily loss limit", `${p.riskProfile?.daily_loss_limit_pct ?? "—"}%`);
  statRow(f, "Max drawdown", `${p.riskProfile?.max_drawdown_pct ?? "—"}%`);
  spacer(f, 8);
  if (risk.length) {
    h2(f, "Additional Risk Rules");
    for (const r of risk) bullet(f, r);
  }

  // PAGE 7 — Trade Invalidation
  addPage(f);
  eyebrow(f, "Page 6 · Invalidation");
  spacer(f, 6);
  h1(f, "When NOT to Trade");
  h2(f, "Invalid Conditions");
  bullet(f, "Higher timeframe in conflict with the execution signal.");
  bullet(f, "Major scheduled news within the next 30 minutes.");
  bullet(f, "Market is in a tight range with no clear structure.");
  h2(f, "Failed Setups");
  bullet(f, "Entry trigger appeared but reversed before confirmation closed.");
  bullet(f, "Spread widened beyond your normal execution range.");
  h2(f, "Emotional States to Avoid");
  bullet(f, "Frustration after a loss — wait at least one clean session.");
  bullet(f, "Greed after a win — the next trade is graded the same way.");
  bullet(f, "Fatigue or distraction — close the platform.");

  // PAGE 8 — Behavior Rules
  addPage(f);
  eyebrow(f, "Page 7 · Discipline");
  spacer(f, 6);
  h1(f, "Execution Discipline");
  h2(f, "Emotional Control");
  if (beh.length) {
    for (const b of beh) bullet(f, b);
  } else {
    bullet(f, "No revenge trades after a loss.");
    bullet(f, "No size increases on tilt.");
  }
  h2(f, "Overtrading Prevention");
  bullet(f, "Maximum number of trades per day is fixed in advance.");
  bullet(f, "After two consecutive losses, stop and review the next day.");
  h2(f, "Patience Rules");
  bullet(f, "If the setup is not in front of you, wait.");
  bullet(f, "The market does not owe you a trade today.");

  // PAGE 9 — Tier System
  addPage(f);
  eyebrow(f, "Page 8 · Standards");
  spacer(f, 6);
  h1(f, "Setup Classification");
  muted(f, "Three tiers govern what is allowed to leave the checklist.");
  spacer(f, 12);
  tierCard(
    f,
    "A+  Setup",
    p.tier_rules?.a_plus || "All required rules pass. Full size, full conviction.",
    p.checklist?.a_plus ?? [...entry, ...conf, ...risk, ...beh],
  );
  tierCard(
    f,
    "B+  Setup",
    p.tier_rules?.b_plus || "One non-critical rule may fail. Reduce size by 25-50%.",
    p.checklist?.b_plus ?? [...entry, ...risk],
  );
  tierCard(
    f,
    "C  Setup",
    p.tier_rules?.c || "Only the core conditions required. Minimum size, optional skip.",
    p.checklist?.c ?? entry.slice(0, 1),
  );

  // PAGE 10 — Execution Flow
  addPage(f);
  eyebrow(f, "Page 9 · Flow");
  spacer(f, 6);
  h1(f, "Trade Flow");
  for (const [i, step] of [
    "Identify context — read the higher timeframe first.",
    "Wait for setup — do not anticipate, react.",
    "Confirm entry — every checklist item ticked.",
    "Execute — pre-set stop, pre-set target, no hesitation.",
    "Manage risk — never widen the stop, never average down.",
    "Journal the trade — grade against the system, not against the P&L.",
  ].entries()) {
    h2(f, `${i + 1}. ${step.split("—")[0].trim()}`);
    body(f, step);
  }

  // PAGE 11 — Final Principles
  addPage(f);
  eyebrow(f, "Page 10 · Closing");
  spacer(f, 6);
  h1(f, "Final Rules");
  spacer(f, 8);
  for (const it of [
    "No setup, no trade.",
    "Discipline over outcome.",
    "Process over profit.",
    "Small losses, controlled wins, repeated forever.",
    "The system is the edge. Protect it.",
  ]) {
    drawText(f, it, {
      size: SIZE.h2,
      lead: LEAD.h2 + 6,
      font: f.bold,
      color: INK,
    });
  }
}

// ---------------------------------------------------------------------------
// HTTP entry
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = (await req.json()) as Payload;
    if (body.kind !== "checklist" && body.kind !== "plan") {
      return new Response(JSON.stringify({ error: "Invalid kind" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const doc = await PDFDocument.create();
    doc.setTitle(body.kind === "checklist" ? "Execution Checklist" : "Trading Manual");
    doc.setAuthor("SenecaEdge");
    doc.setProducer("SenecaEdge");
    doc.setCreator("SenecaEdge");

    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
    const f = newFrame(doc, font, bold, italic, "SenecaEdge · " + (body.name || "Strategy"));

    if (body.kind === "checklist") renderChecklist(f, body);
    else renderPlan(f, body);

    drawFooters(doc, font, "SenecaEdge · " + (body.name || "Strategy"));

    const bytes = await doc.save();
    const filename =
      (body.name || "strategy").toLowerCase().replace(/[^a-z0-9]+/g, "-") +
      `-${body.kind === "checklist" ? "execution-checklist" : "trading-manual"}.pdf`;

    return new Response(bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("export-strategy-pdf error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
