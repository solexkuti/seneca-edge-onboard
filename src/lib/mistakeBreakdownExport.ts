// Export helpers for the Mistake Breakdown view.
// Produces a CSV file or a PDF report from already-aggregated rows.

import { jsPDF } from "jspdf";

export type ExportRow = {
  id: string;
  label: string;
  severe: boolean;
  count: number;
  wins: number;
  losses: number;
  breakeven: number;
  netR: number;
};

export type ExportMeta = {
  rangeLabel: string;
  total: number;
  totalClean: number;
  generatedAt: Date;
};

function safeFilename(rangeLabel: string, ext: string): string {
  const slug = rangeLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const stamp = new Date().toISOString().slice(0, 10);
  return `mistake-breakdown_${slug || "range"}_${stamp}.${ext}`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function pct(num: number, denom: number): string {
  if (denom === 0) return "";
  return `${Math.round((num / denom) * 100)}%`;
}

function r(n: number): string {
  if (!Number.isFinite(n)) return "";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}R`;
}

function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportMistakeBreakdownCSV(rows: ExportRow[], meta: ExportMeta): void {
  const lines: string[] = [];
  lines.push(`# Mistake Breakdown`);
  lines.push(`# Range: ${meta.rangeLabel}`);
  lines.push(`# Generated: ${meta.generatedAt.toISOString()}`);
  lines.push(`# Total trades: ${meta.total} (clean: ${meta.totalClean})`);
  lines.push("");
  lines.push(
    [
      "Mistake",
      "Severe",
      "Trades",
      "Wins",
      "Losses",
      "Breakeven",
      "Win rate",
      "Net R",
    ]
      .map(csvEscape)
      .join(","),
  );
  for (const row of rows) {
    const decided = row.wins + row.losses;
    lines.push(
      [
        row.label,
        row.severe ? "yes" : "no",
        row.count,
        row.wins,
        row.losses,
        row.breakeven,
        pct(row.wins, decided),
        Number.isFinite(row.netR) ? row.netR.toFixed(2) : "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  downloadBlob(blob, safeFilename(meta.rangeLabel, "csv"));
}

export function exportMistakeBreakdownPDF(rows: ExportRow[], meta: ExportMeta): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 48;
  const right = pageW - 48;
  let y = 56;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20);
  doc.text("Mistake Breakdown", left, y);

  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`Range: ${meta.rangeLabel}`, left, y);
  y += 14;
  doc.text(
    `Total trades: ${meta.total}  ·  Clean: ${meta.totalClean}`,
    left,
    y,
  );
  y += 14;
  doc.text(
    `Generated: ${meta.generatedAt.toLocaleString()}`,
    left,
    y,
  );

  y += 24;

  // Table header
  const cols = [
    { key: "label", label: "Mistake", x: left, w: 170, align: "left" as const },
    { key: "count", label: "Trades", x: left + 175, w: 50, align: "right" as const },
    { key: "wl", label: "W / L / BE", x: left + 230, w: 80, align: "right" as const },
    { key: "wr", label: "Win rate", x: left + 315, w: 60, align: "right" as const },
    { key: "net", label: "Net R", x: left + 380, w: 60, align: "right" as const },
    { key: "sev", label: "Severe", x: left + 445, w: 50, align: "right" as const },
  ];

  function drawHeader() {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(60);
    for (const c of cols) {
      doc.text(c.label, c.align === "right" ? c.x + c.w : c.x, y, {
        align: c.align,
      });
    }
    y += 6;
    doc.setDrawColor(220);
    doc.line(left, y, right, y);
    y += 14;
  }

  drawHeader();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(20);

  for (const row of rows) {
    if (y > pageH - 60) {
      doc.addPage();
      y = 56;
      drawHeader();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(20);
    }
    const decided = row.wins + row.losses;
    const cells: Record<string, string> = {
      label: row.label,
      count: String(row.count),
      wl: `${row.wins} / ${row.losses} / ${row.breakeven}`,
      wr: pct(row.wins, decided) || "—",
      net: r(row.netR) || "—",
      sev: row.severe ? "Yes" : "—",
    };
    for (const c of cols) {
      doc.text(
        cells[c.key],
        c.align === "right" ? c.x + c.w : c.x,
        y,
        { align: c.align, maxWidth: c.w },
      );
    }
    y += 18;
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `SenecaEdge · Mistake Breakdown · Page ${i} of ${pageCount}`,
      pageW / 2,
      pageH - 24,
      { align: "center" },
    );
  }

  doc.save(safeFilename(meta.rangeLabel, "pdf"));
}
