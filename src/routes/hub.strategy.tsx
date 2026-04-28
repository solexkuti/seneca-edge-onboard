// /hub/strategy — list user's strategy blueprints + entry to builder.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Lock, FileText, Loader2, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import RequireAuth from "@/components/auth/RequireAuth";
import {
  listBlueprints,
  deleteBlueprint,
  type StrategyBlueprint,
} from "@/lib/dbStrategyBlueprints";
import { toast } from "sonner";

export const Route = createFileRoute("/hub/strategy")({
  head: () => ({
    meta: [
      { title: "Strategy Builder — SenecaEdge" },
      {
        name: "description",
        content:
          "Turn your trading intuition into a strict, enforceable decision framework.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <StrategyListPage />
    </RequireAuth>
  ),
});

function StrategyListPage() {
  const [items, setItems] = useState<StrategyBlueprint[] | null>(null);

  const refresh = async () => {
    try {
      const list = await listBlueprints();
      setItems(list);
    } catch (err) {
      console.error(err);
      toast.error("Could not load strategies.");
      setItems([]);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this strategy? This cannot be undone.")) return;
    try {
      await deleteBlueprint(id);
      await refresh();
    } catch (err) {
      console.error(err);
      toast.error("Could not delete.");
    }
  };

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-app-glow opacity-90" />
      <div className="relative z-10 mx-auto w-full max-w-[640px] px-5 pt-6 pb-24">
        <div className="flex items-center justify-between">
          <Link
            to="/hub"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-card px-3 text-sm ring-1 ring-border shadow-soft hover:shadow-card-premium"
          >
            ← Hub
          </Link>
          <Link
            to="/hub/strategy/new"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-95"
          >
            <Plus className="h-4 w-4" /> New strategy
          </Link>
        </div>

        <div className="mt-5">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Strategy Builder
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Your strategies
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define enforceable rules. Lock them. Let them grade every trade.
          </p>
        </div>

        <div className="mt-6">
          {items === null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : items.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="space-y-2">
              {items.map((bp, i) => (
                <motion.li
                  key={bp.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <div className="flex items-center justify-between rounded-xl bg-card p-4 ring-1 ring-border shadow-soft">
                    <Link
                      to="/hub/strategy/$id"
                      params={{ id: bp.id }}
                      className="flex-1 min-w-0"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="truncate text-sm font-medium text-foreground">
                          {bp.name}
                        </span>
                        {bp.locked && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                            <Lock className="h-3 w-3" /> Locked
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Status: {bp.status} · Updated{" "}
                        {new Date(bp.updated_at).toLocaleDateString()}
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={() => onDelete(bp.id)}
                      className="ml-3 inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-background hover:text-destructive"
                      aria-label="Delete strategy"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl bg-card p-6 ring-1 ring-border shadow-soft text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <FileText className="h-5 w-5 text-primary" />
      </div>
      <h2 className="mt-3 text-base font-semibold text-foreground">
        Build your first strategy
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        We'll convert your intuition into a strict, enforceable framework.
      </p>
      <Link
        to="/hub/strategy/new"
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-95"
      >
        <Plus className="h-4 w-4" /> Start building
      </Link>
    </div>
  );
}
