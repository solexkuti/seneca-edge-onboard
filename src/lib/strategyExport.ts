// Client-side strategy exports.
//
// Why client-side: the previous edge-function PDF was failing silently in
// production. Generating in the browser is instant, requires no auth round
// trip, and never depends on AI infra being healthy. We always offer a .txt
// fallback so the user can never be left empty-handed.

import { jsPDF } from "jspdf";
import type { StrategyBlueprint, ChecklistByTier } from "./dbStrategyBlueprints";

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

function buildChecklistText(bp: StrategyBlueprint): string {
  const cl = (bp.checklist ?? {}) as Partial<ChecklistByTier>;
  const sections: Array<[string, string[] | undefined]> = [
    ["A+  PERFECT", cl.a_plus],
    ["B+  ACCEPTABLE", cl.b_plus],
    ["C   MINIMUM", cl.c],
  ];
  const lines: string[] = [bp.name || "Strategy", "Checklist", ""];
  for (const [label, items] of sections) {
    if (!items?.length) continue;
    lines.push(label);
    for (const it of items) lines.push(`  [ ]  ${it}`);
    lines.push("");
  }
  return lines.join("\n");
}

function buildPlanText(bp: StrategyBlueprint): string {
  return [bp.name || "Strategy", "Trading plan", "", bp.trading_plan ?? ""].join("\n");
}

export function downloadTxt(bp: StrategyBlueprint, kind: "checklist" | "plan") {
  const body = kind === "checklist" ? buildChecklistText(bp) : buildPlanText(bp);
  const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
  downloadBlob(blob, `${safeName(bp.name)}-${kind}.txt`);
}

/** Generate a clean PDF in-browser. Returns true on success. */
export function downloadPdf(
  bp: StrategyBlueprint,
  kind: "checklist" | "plan",
): boolean {
  try {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const M = 56; // margin
    const maxW = pageW - M * 2;
    let y = M;

    const ensureRoom = (h: number) => {
      if (y + h > pageH - M) {
        doc.addPage();
        y = M;
      }
    };

    const writeWrapped = (
      text: string,
      size: number,
      style: "normal" | "bold" = "normal",
      lineGap = 4,
    ) => {
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(text, maxW);
      for (const line of lines) {
        ensureRoom(size + lineGap);
        doc.text(line, M, y);
        y += size + lineGap;
      }
    };

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(bp.name || "Strategy", M, y);
    y += 22;
    doc.setDrawColor(220);
    doc.line(M, y, pageW - M, y);
    y += 18;

    if (kind === "checklist") {
      const cl = (bp.checklist ?? {}) as Partial<ChecklistByTier>;
      const sections: Array<[string, string[] | undefined]> = [
        ["A+   Perfect", cl.a_plus],
        ["B+   Acceptable", cl.b_plus],
        ["C    Minimum", cl.c],
      ];
      for (const [label, items] of sections) {
        if (!items?.length) continue;
        ensureRoom(32);
        writeWrapped(label, 13, "bold", 6);
        y += 4;
        for (const it of items) {
          ensureRoom(20);
          // checkbox
          doc.setDrawColor(120);
          doc.rect(M, y - 9, 10, 10);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(11);
          const lines = doc.splitTextToSize(it, maxW - 22);
          for (let i = 0; i < lines.length; i++) {
            ensureRoom(14);
            doc.text(lines[i], M + 18, y);
            if (i < lines.length - 1) y += 14;
          }
          y += 16;
        }
        y += 6;
      }
    } else {
      // Plan: print each line at modest size; keep blank lines as spacers.
      const plan = (bp.trading_plan ?? "").trim() || "(no plan generated)";
      const blocks = plan.split(/\n/);
      for (const raw of blocks) {
        const line = raw.trimEnd();
        if (!line) {
          y += 8;
          continue;
        }
        // Heading detection: ALL CAPS or "TITLE:" pattern
        const isHeading = /^[A-Z][A-Z0-9 &/-]{2,}:?$/.test(line);
        writeWrapped(line, isHeading ? 12 : 10.5, isHeading ? "bold" : "normal", isHeading ? 4 : 3);
        if (isHeading) y += 2;
      }
    }

    // Footer
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(140);
      doc.text(`${bp.name} · ${kind}`, M, pageH - 24);
      doc.text(`${i} / ${pages}`, pageW - M, pageH - 24, { align: "right" });
      doc.setTextColor(0);
    }

    doc.save(`${safeName(bp.name)}-${kind}.pdf`);
    return true;
  } catch (err) {
    console.error("[strategyExport] PDF failed", err);
    return false;
  }
}
