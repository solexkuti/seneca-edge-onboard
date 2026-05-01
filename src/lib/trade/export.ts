// Export utilities for rule violations and insights.
//
// Two formats:
//   - CSV: machine-readable, opens in Excel/Sheets. Two sections.
//   - PDF: branded report (dark theme, gold accents) with summary
//     header, insights list, and violations table.
//
// Both run fully client-side — no server roundtrip needed.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  Insight,
  RuleViolationRow,
  BehaviorScore,
  RuleAdherence,
  ExecutionSplit,
  TradeSummary,
} from "@/lib/trade";

export interface ExportPayload {
  generatedAt: Date;
  rangeLabel: string;
  score: BehaviorScore;
  adherence: RuleAdherence;
  split: ExecutionSplit;
  summary: TradeSummary;
  insights: Insight[];
  violations: RuleViolationRow[];
}

// ───────── shared helpers ─────────

function fmtR(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}R`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function timestampForFile(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

// ───────── CSV ─────────

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvEscape).join(",");
}

export function exportToCSV(payload: ExportPayload) {
  const lines: string[] = [];
  lines.push(`# Seneca Edge — Behavior Export`);
  lines.push(`# Generated,${csvEscape(fmtDateTime(payload.generatedAt))}`);
  lines.push(`# Range,${csvEscape(payload.rangeLabel)}`);
  lines.push("");

  // Summary section
  lines.push("## Summary");
  lines.push(csvRow(["Metric", "Value"]));
  lines.push(csvRow(["Behavior Score", `${payload.score.score}/100`]));
  lines.push(csvRow(["Behavior Label", payload.score.label]));
  lines.push(
    csvRow([
      "Rule Adherence",
      `${Math.round(payload.adherence.pct * 100)}% (${payload.adherence.cleanTrades}/${payload.adherence.totalTrades} clean)`,
    ]),
  );
  lines.push(
    csvRow([
      "Controlled Execution",
      `${Math.round(payload.split.controlledPct * 100)}%`,
    ]),
  );
  lines.push(csvRow(["Total Trades", payload.summary.totalTrades]));
  lines.push(csvRow(["Executed", payload.summary.executedCount]));
  lines.push(csvRow(["Missed", payload.summary.missedCount]));
  lines.push(
    csvRow(["Win Rate", `${Math.round(payload.summary.winRate * 100)}%`]),
  );
  lines.push(csvRow(["Total R", fmtR(payload.summary.totalR)]));
  lines.push("");

  // Insights section
  lines.push("## Insights");
  lines.push(csvRow(["Severity", "Message"]));
  for (const i of payload.insights) {
    lines.push(csvRow([i.severity, i.message]));
  }
  lines.push("");

  // Violations section
  lines.push("## Rule Violations");
  lines.push(csvRow(["Rule", "Times Broken", "Total Impact (R)", "Last Broken"]));
  for (const v of payload.violations) {
    lines.push(
      csvRow([
        v.rule,
        v.timesBroken,
        v.totalImpactR.toFixed(2),
        fmtDate(v.lastBrokenAt),
      ]),
    );
  }

  const blob = new Blob([lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  triggerDownload(
    blob,
    `seneca-edge_behavior_${timestampForFile(payload.generatedAt)}.csv`,
  );
}

// ───────── PDF ─────────

// Dark + gold palette mirrored from the app
const COLOR = {
  bg: [11, 11, 13] as [number, number, number],
  card: [24, 24, 26] as [number, number, number],
  text: [237, 237, 237] as [number, number, number],
  muted: [154, 154, 154] as [number, number, number],
  goldDim: [198, 161, 91] as [number, number, number],
  goldBright: [231, 201, 138] as [number, number, number],
  loss: [220, 110, 110] as [number, number, number],
  divider: [40, 40, 44] as [number, number, number],
};

function severityColor(s: Insight["severity"]): [number, number, number] {
  switch (s) {
    case "positive":
      return COLOR.goldBright;
    case "warning":
      return [220, 180, 90];
    case "critical":
      return COLOR.loss;
    default:
      return COLOR.muted;
  }
}

function severityLabel(s: Insight["severity"]): string {
  return { positive: "STRENGTH", neutral: "NOTE", warning: "WATCH", critical: "CRITICAL" }[s];
}

export function exportToPDF(payload: ExportPayload) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;

  // Paint dark background on first page
  paintBackground(doc, pageW, pageH);

  // ── Header band ──
  doc.setFillColor(...COLOR.card);
  doc.rect(0, 0, pageW, 90, "F");

  doc.setTextColor(...COLOR.goldDim);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("SENECA EDGE", margin, 32);

  doc.setTextColor(...COLOR.text);
  doc.setFont("times", "normal");
  doc.setFontSize(22);
  doc.text("Behavior Report", margin, 60);

  doc.setTextColor(...COLOR.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `${payload.rangeLabel} · Generated ${fmtDateTime(payload.generatedAt)}`,
    margin,
    78,
  );

  let y = 120;

  // ── Summary stat row ──
  const stats: { label: string; value: string; tone?: "gold" | "muted" }[] = [
    {
      label: "Behavior",
      value: `${payload.score.score}/100`,
      tone: "gold",
    },
    {
      label: "Adherence",
      value: `${Math.round(payload.adherence.pct * 100)}%`,
    },
    {
      label: "Controlled",
      value: `${Math.round(payload.split.controlledPct * 100)}%`,
    },
    {
      label: "Total R",
      value: fmtR(payload.summary.totalR),
      tone: payload.summary.totalR >= 0 ? "gold" : undefined,
    },
  ];

  const cardW = (pageW - margin * 2 - 12 * (stats.length - 1)) / stats.length;
  stats.forEach((s, i) => {
    const x = margin + i * (cardW + 12);
    doc.setFillColor(...COLOR.card);
    doc.roundedRect(x, y, cardW, 64, 6, 6, "F");

    doc.setTextColor(...COLOR.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(s.label.toUpperCase(), x + 12, y + 20);

    doc.setTextColor(...(s.tone === "gold" ? COLOR.goldBright : COLOR.text));
    doc.setFont("times", "normal");
    doc.setFontSize(20);
    doc.text(s.value, x + 12, y + 48);
  });
  y += 64 + 28;

  // ── Score description ──
  doc.setTextColor(...COLOR.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const descLines = doc.splitTextToSize(
    payload.score.description,
    pageW - margin * 2,
  );
  doc.text(descLines, margin, y);
  y += descLines.length * 13 + 18;

  // ── Insights ──
  y = sectionTitle(doc, "Insights", margin, y);
  if (payload.insights.length === 0) {
    y = drawMutedRow(doc, "No insights for this window.", margin, y, pageW);
  } else {
    for (const insight of payload.insights) {
      y = ensureSpace(doc, y, 60, pageW, pageH);

      doc.setFillColor(...COLOR.card);
      const lines = doc.splitTextToSize(insight.message, pageW - margin * 2 - 24);
      const blockH = Math.max(48, 24 + lines.length * 13);
      doc.roundedRect(margin, y, pageW - margin * 2, blockH, 5, 5, "F");

      // severity pill
      const [sr, sg, sb] = severityColor(insight.severity);
      doc.setTextColor(sr, sg, sb);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text(severityLabel(insight.severity), margin + 12, y + 16);

      doc.setTextColor(...COLOR.text);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(lines, margin + 12, y + 32);

      y += blockH + 8;
    }
  }
  y += 10;

  // ── Violations ──
  y = ensureSpace(doc, y, 80, pageW, pageH);
  y = sectionTitle(doc, "Rule Violations", margin, y);

  if (payload.violations.length === 0) {
    drawMutedRow(doc, "No rule breaks logged in this window.", margin, y, pageW);
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Rule", "Times", "Impact", "Last broken"]],
      body: payload.violations.map((v) => [
        v.rule,
        String(v.timesBroken),
        fmtR(v.totalImpactR),
        fmtDate(v.lastBrokenAt),
      ]),
      theme: "plain",
      styles: {
        font: "helvetica",
        fontSize: 9.5,
        textColor: COLOR.text,
        fillColor: COLOR.card,
        cellPadding: { top: 8, right: 10, bottom: 8, left: 10 },
        lineColor: COLOR.divider,
        lineWidth: 0.5,
      },
      headStyles: {
        fontStyle: "bold",
        fontSize: 8,
        textColor: COLOR.muted,
        fillColor: COLOR.bg,
      },
      alternateRowStyles: { fillColor: [20, 20, 22] },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { halign: "right", cellWidth: 50 },
        2: { halign: "right", cellWidth: 70 },
        3: { halign: "right", cellWidth: 90 },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 2) {
          const raw = payload.violations[data.row.index]?.totalImpactR ?? 0;
          if (raw < 0) data.cell.styles.textColor = COLOR.loss;
          else if (raw > 0) data.cell.styles.textColor = COLOR.goldBright;
        }
      },
      didDrawPage: () => paintBackground(doc, pageW, pageH),
    });
  }

  // ── Footer on every page ──
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setTextColor(...COLOR.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(
      `Seneca Edge · Page ${p} of ${pageCount}`,
      pageW / 2,
      pageH - 18,
      { align: "center" },
    );
  }

  doc.save(
    `seneca-edge_behavior_${timestampForFile(payload.generatedAt)}.pdf`,
  );
}

// ───────── PDF helpers ─────────

function paintBackground(doc: jsPDF, w: number, h: number) {
  doc.setFillColor(...COLOR.bg);
  doc.rect(0, 0, w, h, "F");
}

function sectionTitle(doc: jsPDF, label: string, x: number, y: number): number {
  doc.setTextColor(...COLOR.muted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(label.toUpperCase(), x, y);
  doc.setDrawColor(...COLOR.divider);
  doc.setLineWidth(0.5);
  doc.line(x, y + 6, x + 40, y + 6);
  return y + 22;
}

function drawMutedRow(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  pageW: number,
): number {
  doc.setFillColor(...COLOR.card);
  doc.roundedRect(x, y, pageW - x * 2, 36, 5, 5, "F");
  doc.setTextColor(...COLOR.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(text, x + 12, y + 22);
  return y + 36 + 8;
}

function ensureSpace(
  doc: jsPDF,
  y: number,
  needed: number,
  pageW: number,
  pageH: number,
): number {
  if (y + needed > pageH - 50) {
    doc.addPage();
    paintBackground(doc, pageW, pageH);
    return 50;
  }
  return y;
}
