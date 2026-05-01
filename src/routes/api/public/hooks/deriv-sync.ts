// Scheduled Deriv sync — called every 15 minutes by pg_cron.
//
// Iterates every deriv_connections row with auto_sync = true (Premium users
// only — setDerivAutoSync gates the toggle). For each, runs syncDerivAccount
// using its stored token and incremental cursor (last_deal_at). Failures on
// one account never block the others.
//
// Security: this is a public route (/api/public/*) so pg_cron can hit it
// without auth headers. We rely on a shared secret header (CRON_SECRET) to
// reject anything but our own scheduler. Without the secret the route 401s.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { syncDerivAccount } from "@/server/deriv.server";

export const Route = createFileRoute("/api/public/hooks/deriv-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        const provided = request.headers.get("x-cron-secret");
        if (!secret || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { data: connections, error } = await supabaseAdmin
          .from("deriv_connections")
          .select("user_id, api_token, last_deal_at")
          .eq("auto_sync", true);

        if (error) {
          return Response.json(
            { ok: false, error: error.message },
            { status: 500 },
          );
        }

        let processed = 0;
        let failed = 0;

        for (const c of connections ?? []) {
          const since = c.last_deal_at ? new Date(c.last_deal_at) : null;
          try {
            const result = await syncDerivAccount(
              c.user_id,
              c.api_token,
              since,
            );
            await supabaseAdmin.from("deriv_imports").insert({
              user_id: c.user_id,
              trigger: "scheduled",
              rows_total: result.rows_total,
              rows_imported: result.rows_imported,
              rows_duplicate: result.rows_duplicate,
              rows_skipped: result.rows_skipped,
              latest_deal_at: result.latest_deal_at?.toISOString() ?? null,
            });
            await supabaseAdmin
              .from("deriv_connections")
              .update({
                last_synced_at: new Date().toISOString(),
                last_deal_at:
                  result.latest_deal_at?.toISOString() ??
                  c.last_deal_at ??
                  null,
                balance: result.account.balance,
                currency: result.account.currency,
                last_error: null,
              })
              .eq("user_id", c.user_id);
            processed += 1;
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Unknown error";
            await supabaseAdmin.from("deriv_imports").insert({
              user_id: c.user_id,
              trigger: "scheduled",
              error: msg,
            });
            await supabaseAdmin
              .from("deriv_connections")
              .update({ last_error: msg })
              .eq("user_id", c.user_id);
            failed += 1;
          }
        }

        return Response.json({ ok: true, processed, failed });
      },
    },
  },
});
