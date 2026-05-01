// ExportMenu — small dropdown that exports the user's behavior data
// (insights + rule violations + summary) as PDF or CSV.
//
// Pure client-side. Hooks into the analysis primitives already computed
// by the parent surface so we never re-query the DB.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { exportToCSV, exportToPDF, type ExportPayload } from "@/lib/trade/export";

const ease = [0.22, 1, 0.36, 1] as const;

interface ExportMenuProps {
  /** Lazily build the payload only on click — keeps the trigger cheap. */
  buildPayload: () => ExportPayload;
  /** Disabled when there's nothing to export (e.g. no trades loaded). */
  disabled?: boolean;
  className?: string;
}

export function ExportMenu({
  buildPayload,
  disabled = false,
  className = "",
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"pdf" | "csv" | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function run(kind: "pdf" | "csv") {
    setBusy(kind);
    try {
      // Yield so the spinner paints before the (sync) generation starts.
      await new Promise((r) => setTimeout(r, 16));
      const payload = buildPayload();
      if (kind === "pdf") exportToPDF(payload);
      else exportToCSV(payload);
    } catch (err) {
      console.error("[export] failed", err);
    } finally {
      setBusy(null);
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#18181A] ring-1 ring-white/[0.08] px-3 py-1.5 text-[12px] font-medium text-[#EDEDED] hover:ring-[#C6A15B]/40 hover:text-[#E7C98A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C6A15B]" />
        ) : (
          <Download className="h-3.5 w-3.5 text-[#C6A15B]" />
        )}
        Export
      </button>

      <AnimatePresence>
        {open && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18, ease }}
            role="menu"
            className="absolute right-0 top-full mt-2 w-56 z-30 rounded-xl bg-[#18181A] ring-1 ring-white/[0.08] shadow-xl shadow-black/40 overflow-hidden"
          >
            <MenuItem
              icon={<FileText className="h-4 w-4" />}
              title="Download PDF"
              subtitle="Branded report"
              busy={busy === "pdf"}
              onClick={() => run("pdf")}
            />
            <div className="h-px bg-white/[0.05]" />
            <MenuItem
              icon={<FileSpreadsheet className="h-4 w-4" />}
              title="Download CSV"
              subtitle="Spreadsheet-friendly"
              busy={busy === "csv"}
              onClick={() => run("csv")}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({
  icon,
  title,
  subtitle,
  busy,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={busy}
      className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-white/[0.03] transition-colors disabled:opacity-50"
    >
      <span className="text-[#C6A15B] shrink-0">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[12.5px] font-medium text-[#EDEDED]">
          {title}
        </span>
        <span className="block text-[10.5px] text-[#9A9A9A]">{subtitle}</span>
      </span>
    </button>
  );
}
