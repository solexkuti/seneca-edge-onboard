// Export button for the trading journal — downloads CSV or JSON of the
// user's trades + discipline logs from Supabase.

import { useState } from "react";
import { Download, FileJson, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportJournal, type ExportFormat } from "@/lib/journalExport";
import { playFeedback } from "@/lib/feedback";

export default function JournalExportButton() {
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  async function handleExport(format: ExportFormat) {
    if (busy) return;
    playFeedback("tap");
    setBusy(format);
    const result = await exportJournal(format);
    setBusy(null);
    if (result.ok) {
      toast.success(`Exported ${result.count} entr${result.count === 1 ? "y" : "ies"}`);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
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
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            handleExport("csv");
          }}
          className="gap-2"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Download CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            handleExport("json");
          }}
          className="gap-2"
        >
          <FileJson className="h-4 w-4" />
          Download JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
