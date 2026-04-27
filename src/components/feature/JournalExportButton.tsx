// Export button for the trading journal — downloads CSV or JSON of the
// user's trades + discipline logs from Supabase, optionally scoped to a
// date range.

import { useState } from "react";
import { format as formatDate } from "date-fns";
import {
  CalendarIcon,
  Download,
  FileJson,
  FileSpreadsheet,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { exportJournal, type ExportFormat } from "@/lib/journalExport";
import { playFeedback } from "@/lib/feedback";

export default function JournalExportButton() {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();
  const [open, setOpen] = useState(false);

  async function handleExport(fmt: ExportFormat) {
    if (busy) return;
    playFeedback("tap");
    setBusy(fmt);
    const result = await exportJournal(fmt, { from, to });
    setBusy(null);
    if (result.ok) {
      toast.success(
        `Exported ${result.count} entr${result.count === 1 ? "y" : "ies"}`,
      );
      setOpen(false);
    } else {
      toast.error(result.error);
    }
  }

  function setPreset(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days + 1);
    setFrom(start);
    setTo(end);
  }

  function clearRange() {
    setFrom(undefined);
    setTo(undefined);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onClick={() => playFeedback("tap")}
        className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-4 py-2 text-sm font-medium text-foreground/80 backdrop-blur transition hover:bg-background/80 active:scale-[0.98] disabled:opacity-60"
        disabled={busy !== null}
        aria-label="Export journal"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Export
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4 space-y-4">
        <div>
          <p className="text-sm font-medium text-foreground">Date range</p>
          <p className="text-xs text-muted-foreground">
            Leave empty to export everything.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[
            { label: "7d", days: 7 },
            { label: "30d", days: 30 },
            { label: "90d", days: 90 },
          ].map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setPreset(p.days)}
              className="rounded-full border border-border/60 px-2.5 py-1 text-xs text-foreground/70 hover:bg-muted/50"
            >
              Last {p.label}
            </button>
          ))}
          {(from || to) && (
            <button
              type="button"
              onClick={clearRange}
              className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <DateField label="From" value={from} onChange={setFrom} max={to} />
          <DateField label="To" value={to} onChange={setTo} min={from} />
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            variant="secondary"
            className="flex-1 gap-2"
            disabled={busy !== null}
            onClick={() => handleExport("csv")}
          >
            {busy === "csv" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            CSV
          </Button>
          <Button
            variant="secondary"
            className="flex-1 gap-2"
            disabled={busy !== null}
            onClick={() => handleExport("json")}
          >
            {busy === "json" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileJson className="h-4 w-4" />
            )}
            JSON
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DateField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value?: Date;
  onChange: (d: Date | undefined) => void;
  min?: Date;
  max?: Date;
}) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start gap-2 text-left font-normal",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="h-4 w-4 opacity-60" />
            {value ? formatDate(value, "MMM d, yyyy") : "Pick date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onChange}
            disabled={(d) =>
              (min ? d < new Date(new Date(min).setHours(0, 0, 0, 0)) : false) ||
              (max ? d > new Date(new Date(max).setHours(23, 59, 59, 999)) : false) ||
              d > new Date()
            }
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
