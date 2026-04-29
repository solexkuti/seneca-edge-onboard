// Client-side strategy exports — PHASE 3.
//
// Source of truth: src/lib/strategySchema.ts (buildCanonicalStrategy).
// PDF + plain-text + JSON renderers all read from the same canonical view, so
// the UI checklist, exported PDF, and Chart Analyzer payload can NEVER drift.

import { jsPDF } from "jspdf";
import type { StrategyBlueprint } from "./dbStrategyBlueprints";
import {
  buildCanonicalStrategy,
  canonicalToJson,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  type CanonicalStrategy,
} from "./strategySchema";

function safeName(s: string) {
  return (s || "strategy").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

/* -------------------------------------------------------------------------- */
/*                              Plain text                                     */
/* -------------------------------------------------------------------------- */

function buildChecklistText(c: CanonicalStrategy): string {
  const lines: string[] = [c.name, "Checklist", ""];
  const sections: Array<["A+  PERFECT" | "B+  ACCEPTABLE" | "C   MINIMUM", string[]]> = [
    ["A+  PERFECT", c.checklist.a_plus],
    ["B+  ACCEPTABLE", c.checklist.b_plus],
    ["C   MINIMUM", c.checklist.c],
  ];
  for (const [label, items] of sections) {
    if (!items.length) continue;
    lines.push(label);
    for (const it of items) lines.push(`  [ ]  ${it}`);
    lines.push("");
  }
  return lines.join("\n");
}

function buildPlanText(c: CanonicalStrategy): string {
  return c.plan_lines.join("\n");
}

export function downloadTxt(bp: StrategyBlueprint, kind: "checklist" | "plan") {
  const c = buildCanonicalStrategy(bp);
  const body = kind === "checklist" ? buildChecklistText(c) : buildPlanText(c);
  const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
  downloadBlob(blob, `${safeName(c.name)}-${kind}.txt`);
}

/** Export the canonical machine-readable JSON (Analyzer-ready). */
export function downloadJson(bp: StrategyBlueprint) {
  const c = buildCanonicalStrategy(bp);
  const blob = new Blob([canonicalToJson(c)], { type: "application/json" });
  downloadBlob(blob, `${safeName(c.name)}-strategy.json`);
}

/* -------------------------------------------------------------------------- */
/*                                  PDF                                        */
/* -------------------------------------------------------------------------- */

/**
 * Generate a clean, professional PDF in-browser. Returns true on success.
 * Layout invariants:
 *  - A4 portrait, 56pt margins, never overflow horizontally (splitTextToSize).
 *  - Section headers + dividers, consistent bullet alignment.
 *  - No page-edge cut-off: ensureRoom() before every line; paginate cleanly.
 *  - Footer with strategy name and page count on every page.
 */
export function downloadPdf(
  bp: StrategyBlueprint,
  kind: "checklist" | "plan" | "full",
): boolean {
  try {
    const c = buildCanonicalStrategy(bp);
    const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const M = 56;
    const maxW = pageW - M * 2;
    let y = M;

    const ensureRoom = (h: number) => {
      if (y + h > pageH - M - 18) {
        doc.addPage();
        y = M;
      }
    };

    const writeWrapped = (
      text: string,
      size: number,
      style: "normal" | "bold" = "normal",
      lineGap = 4,
      indent = 0,
    ) => {
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
      const wrapWidth = maxW - indent;
      const lines = doc.splitTextToSize(text, wrapWidth);
      for (const line of lines) {
        ensureRoom(size + lineGap);
        doc.text(line, M + indent, y);
        y += size + lineGap;
      }
    };

    const sectionHeader = (label: string) => {
      ensureRoom(36);
      y += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(90);
      doc.text(label.toUpperCase(), M, y);
      y += 8;
      doc.setDrawColor(220);
      doc.line(M, y, pageW - M, y);
      y += 14;
      doc.setTextColor(0);
    };

    const bullet = (text: string, withCheckbox = false) => {
      ensureRoom(20);
      const indent = withCheckbox ? 22 : 14;
      if (withCheckbox) {
        doc.setDrawColor(150);
        doc.rect(M, y - 9, 10, 10);
      } else {
        doc.setFillColor(120);
        doc.circle(M + 4, y - 4, 1.6, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(text, maxW - indent);
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) ensureRoom(14);
        doc.text(lines[i], M + indent, y);
        if (i < lines.length - 1) y += 14;
      }
      y += 16;
    };

    // ---- Title block ----
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(c.name, M, y);
    y += 24;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    const subtitle: string[] = [];
    if (c.summary.account_types.length) subtitle.push(c.summary.account_types.join(" · "));
    if (c.summary.sessions.length) subtitle.push(`Sessions: ${c.summary.sessions.join(", ")}`);
    if (subtitle.length) {
      doc.text(subtitle.join("   ·   "), M, y);
      y += 14;
    }
    doc.setTextColor(0);
    doc.setDrawColor(180);
    doc.setLineWidth(0.6 as unknown as number);
    doc.line(M, y + 4, pageW - M, y + 4);
    y += 22;

    // ---- Summary card (always first page) ----
    if (kind === "full" || kind === "plan") {
      sectionHeader("Strategy Summary");
      const rp = c.summary.risk_profile;
      const rpParts: string[] = [];
      if (rp.risk_per_trade_pct != null) rpParts.push(`Risk/trade: ${rp.risk_per_trade_pct}%`);
      if (rp.daily_loss_limit_pct != null) rpParts.push(`Daily loss: ${rp.daily_loss_limit_pct}%`);
      if (rp.max_drawdown_pct != null) rpParts.push(`Max DD: ${rp.max_drawdown_pct}%`);
      if (rpParts.length) writeWrapped(rpParts.join("   ·   "), 11, "normal", 4);
      if (c.summary.key_rules.length) {
        y += 4;
        writeWrapped("Key rules", 10.5, "bold", 4);
        for (const r of c.summary.key_rules) bullet(r);
      }
      if (c.summary.behavior_limits.length) {
        y += 2;
        writeWrapped("Behavior limits", 10.5, "bold", 4);
        for (const r of c.summary.behavior_limits) bullet(r);
      }
    }

    if (kind === "checklist" || kind === "full") {
      const sections: Array<[string, string[]]> = [
        ["A+   Perfect", c.checklist.a_plus],
        ["B+   Acceptable", c.checklist.b_plus],
        ["C    Minimum", c.checklist.c],
      ];
      for (const [label, items] of sections) {
        if (!items.length) continue;
        sectionHeader(label);
        for (const it of items) bullet(it, true);
      }
    }

    if (kind === "plan" || kind === "full") {
      // Render plan from CATEGORY_ORDER to guarantee identical sequence to UI.
      for (const cat of CATEGORY_ORDER) {
        const items = c.rules.filter((r) => r.category === cat);
        if (!items.length) continue;
        sectionHeader(CATEGORY_LABELS[cat]);
        for (const r of items) bullet(r.condition);
      }
    }

    // ---- Footer ----
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(140);
      doc.text(`${c.name} · ${kind}`, M, pageH - 24);
      doc.text(`${i} / ${pages}`, pageW - M, pageH - 24, { align: "right" });
      doc.setTextColor(0);
    }

    doc.save(`${safeName(c.name)}-${kind}.pdf`);
    return true;
  } catch (err) {
    console.error("[strategyExport] PDF failed", err);
    return false;
  }
}
