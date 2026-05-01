// Deriv sync server functions — callable from React components.
//
// Auth model:
//   • connectDeriv / syncDerivNow / disconnectDeriv / setDerivAutoSync
//     are user-scoped — they use requireSupabaseAuth so RLS applies.
//   • The actual broker WebSocket calls run through supabaseAdmin in
//     deriv.server.ts because we need to write under the user's id with the
//     unique-index upsert.
//
// Tier gating:
//   • Anyone can connect (Pro to actually use it — UI gates connect).
//   • setDerivAutoSync rejects unless tier === 'premium'.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { syncDerivAccount, verifyDerivToken } from "./deriv.server";

// ---------- connect ----------

export const connectDeriv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ apiToken: z.string().min(8).max(128) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const info = await verifyDerivToken(data.apiToken);

    const { error } = await supabaseAdmin
      .from("deriv_connections")
      .upsert(
        {
          user_id: userId,
          api_token: data.apiToken,
          account_id: info.loginid,
          account_label: info.fullname ?? info.loginid,
          currency: info.currency,
          balance: info.balance,
          is_virtual: info.is_virtual,
          last_error: null,
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(`Failed to save connection: ${error.message}`);

    return {
      loginid: info.loginid,
      currency: info.currency,
      balance: info.balance,
      is_virtual: info.is_virtual,
    };
  });

// ---------- sync now ----------

export const syncDerivNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    const { data: conn, error: connErr } = await supabaseAdmin
      .from("deriv_connections")
      .select("api_token, last_deal_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (connErr) throw new Error(connErr.message);
    if (!conn) throw new Error("No Deriv connection — connect your token first.");

    const since = conn.last_deal_at ? new Date(conn.last_deal_at) : null;

    try {
      const result = await syncDerivAccount(userId, conn.api_token, since);

      // Log run
      await supabaseAdmin.from("deriv_imports").insert({
        user_id: userId,
        trigger: "manual",
        rows_total: result.rows_total,
        rows_imported: result.rows_imported,
        rows_duplicate: result.rows_duplicate,
        rows_skipped: result.rows_skipped,
        latest_deal_at: result.latest_deal_at?.toISOString() ?? null,
      });

      // Update connection snapshot
      await supabaseAdmin
        .from("deriv_connections")
        .update({
          last_synced_at: new Date().toISOString(),
          last_deal_at:
            result.latest_deal_at?.toISOString() ?? since?.toISOString() ?? null,
          balance: result.account.balance,
          currency: result.account.currency,
          account_id: result.account.loginid,
          is_virtual: result.account.is_virtual,
          last_error: null,
        })
        .eq("user_id", userId);

      return {
        ok: true as const,
        imported: result.rows_imported,
        duplicate: result.rows_duplicate,
        total: result.rows_total,
        balance: result.account.balance,
        currency: result.account.currency,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await supabaseAdmin.from("deriv_imports").insert({
        user_id: userId,
        trigger: "manual",
        error: msg,
      });
      await supabaseAdmin
        .from("deriv_connections")
        .update({ last_error: msg })
        .eq("user_id", userId);
      return { ok: false as const, error: msg };
    }
  });

// ---------- disconnect ----------

export const disconnectDeriv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await supabaseAdmin
      .from("deriv_connections")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- toggle auto-sync (Premium only) ----------

export const setDerivAutoSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    if (data.enabled) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("subscription_tier")
        .eq("id", userId)
        .maybeSingle();
      if (profile?.subscription_tier !== "premium") {
        throw new Error("Auto-sync requires Premium.");
      }
    }

    const { error } = await supabaseAdmin
      .from("deriv_connections")
      .update({ auto_sync: data.enabled })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true, enabled: data.enabled };
  });
