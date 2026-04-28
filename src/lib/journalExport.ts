// Journal export — converts DB rows into CSV or JSON downloads.

import { fetchJournal, type DbJournalRow } from "@/lib/dbJournal";

export type ExportFormat = "csv" | "json";

const CSV_COLUMNS: Array<{ key: keyof DbJournalRow | "executed_at"; label: string }> = [
  { key: "id", label: "log_id" },
  { key: "trade_id", label: "trade_id" },
  { key: "executed_at", label: "executed_at" },
  { key: "pair", label: "market" },
  { key: "direction", label: "direction" },
  { key: "result", label: "result" },
  { key: "rr", label: "rr" },
  { key: "strategy_id", label: "strategy_id" },
  { key: "strategy_name", label: "strategy_name" },
  { key: "entry_rule", label: "entry_rule" },
  { key: "exit_rule", label: "exit_rule" },
  { key: "risk_rule", label: "risk_rule" },
  { key: "behavior_rule", label: "behavior_rule" },
  { key: "followed_entry", label: "followed_entry" },
  { key: "followed_exit", label: "followed_exit" },
  { key: "followed_risk", label: "followed_risk" },
  { key: "followed_behavior", label: "followed_behavior" },
  { key: "discipline_score", label: "discipline_score" },
  { key: "emotional_state", label: "emotional_state" },
  { key: "notes", label: "notes" },
];

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv(rows: DbJournalRow[]): string {
  const header = CSV_COLUMNS.map((c) => c.label).join(",");
  const lines = rows.map((r) => {
    return CSV_COLUMNS.map((c) => {
      if (c.key === "executed_at") {
        return escapeCsv(new Date(r.timestamp).toISOString());
      }
      return escapeCsv((r as any)[c.key]);
    }).join(",");
  });
  return [header, ...lines].join("\n");
}

export function rowsToJson(rows: DbJournalRow[]): string {
  const payload = rows.map((r) => ({
    log_id: r.id,
    trade_id: r.trade_id,
    executed_at: new Date(r.timestamp).toISOString(),
    market: r.pair,
    direction: r.direction,
    result: r.result,
    rr: r.rr,
    strategy: {
      id: r.strategy_id,
      name: r.strategy_name,
      entry_rule: r.entry_rule,
      exit_rule: r.exit_rule,
      risk_rule: r.risk_rule,
      behavior_rule: r.behavior_rule,
    },
    discipline: {
      followed_entry: r.followed_entry,
      followed_exit: r.followed_exit,
      followed_risk: r.followed_risk,
      followed_behavior: r.followed_behavior,
      score: r.discipline_score,
    },
    emotional_state: r.emotional_state,
    notes: r.notes,
  }));
  return JSON.stringify(
    { exported_at: new Date().toISOString(), count: rows.length, entries: payload },
    null,
    2,
  );
}

function triggerDownload(content: string, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke shortly after to ensure download starts.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type ExportRange = { from?: Date | null; to?: Date | null };

export type ExportOptions = {
  range?: ExportRange;
  /** Pre-filtered rows. When provided, skips fetch + range filtering. */
  rows?: DbJournalRow[];
  /** Filename hint, e.g. "filtered". */
  label?: string;
};

export async function exportJournal(
  format: ExportFormat,
  options?: ExportOptions | ExportRange,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  try {
    // Backwards-compat: previously the second arg was a range directly.
    const opts: ExportOptions =
      options && ("rows" in options || "range" in options || "label" in options)
        ? (options as ExportOptions)
        : { range: options as ExportRange | undefined };

    let rows: DbJournalRow[];
    let suffix = "";

    if (opts.rows) {
      rows = opts.rows;
    } else {
      rows = await fetchJournal();
      const fromMs = opts.range?.from ? new Date(opts.range.from).setHours(0, 0, 0, 0) : null;
      const toMs = opts.range?.to ? new Date(opts.range.to).setHours(23, 59, 59, 999) : null;
      if (fromMs !== null) rows = rows.filter((r) => r.timestamp >= fromMs);
      if (toMs !== null) rows = rows.filter((r) => r.timestamp <= toMs);
      if (fromMs !== null || toMs !== null) {
        suffix = `-${opts.range?.from ? new Date(opts.range.from).toISOString().slice(0, 10) : "start"}_to_${opts.range?.to ? new Date(opts.range.to).toISOString().slice(0, 10) : "now"}`;
      }
    }

    if (opts.label) suffix = `-${opts.label}${suffix}`;

    if (rows.length === 0) {
      return {
        ok: false,
        error: opts.rows
          ? "No entries match the current filters."
          : suffix
            ? "No journal entries in that date range."
            : "No journal entries to export yet.",
      };
    }
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      triggerDownload(rowsToCsv(rows), "text/csv;charset=utf-8", `journal-${stamp}${suffix}.csv`);
    } else {
      triggerDownload(rowsToJson(rows), "application/json", `journal-${stamp}${suffix}.json`);
    }
    return { ok: true, count: rows.length };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Export failed." };
  }
}
