// export-strategy-pdf — render the checklist OR plan as a PDF.
// kind=checklist | plan
// Uses pdf-lib via esm.sh (no native binaries, Deno-friendly).

import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ChecklistByTier = {
  a_plus?: string[];
  b_plus?: string[];
  c?: string[];
};

type Payload = {
  kind: "checklist" | "plan";
  name: string;
  accountTypes?: string[];
  riskProfile?: {
    risk_per_trade_pct?: number | null;
    daily_loss_limit_pct?: number | null;
    max_drawdown_pct?: number | null;
  };
  checklist?: ChecklistByTier;
  trading_plan?: string;
};

// Replace characters that StandardFonts (WinAnsi) cannot encode.
function sanitize(s: string): string {
  return s
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "*")
    .replace(/[\u00A0]/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A1-\u00FF]/g, "");
}

function wrap(
  font: ReturnType<typeof PDFDocument.prototype.embedFont> extends Promise<infer T> ? T : never,
  text: string,
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const probe = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(probe, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = probe;
    }
  }
  if (line) lines.push(line);
  return lines;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const body = (await req.json()) as Payload;
    const { kind, name } = body;
    if (kind !== "checklist" && kind !== "plan") {
      return new Response(JSON.stringify({ error: "Invalid kind" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);

    let page = doc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.size();
    const margin = 56;
    const maxWidth = width - margin * 2;
    let y = height - margin;

    const ink = rgb(0.13, 0.16, 0.22);
    const muted = rgb(0.45, 0.5, 0.58);
    const accent = rgb(0.27, 0.36, 0.62);

    const ensureRoom = (need: number) => {
      if (y - need < margin) {
        page = doc.addPage([595.28, 841.89]);
        y = height - margin;
      }
    };

    const drawTitle = (text: string) => {
      ensureRoom(28);
      page.drawText(sanitize(text), {
        x: margin,
        y: y - 20,
        size: 20,
        font: bold,
        color: ink,
      });
      y -= 32;
    };

    const drawSubtle = (text: string) => {
      const lines = wrap(font, sanitize(text), 10, maxWidth);
      for (const ln of lines) {
        ensureRoom(14);
        page.drawText(ln, {
          x: margin,
          y: y - 10,
          size: 10,
          font,
          color: muted,
        });
        y -= 14;
      }
      y -= 6;
    };

    const drawHeading = (text: string) => {
      ensureRoom(24);
      page.drawText(sanitize(text), {
        x: margin,
        y: y - 14,
        size: 13,
        font: bold,
        color: accent,
      });
      y -= 22;
    };

    const drawBullet = (text: string) => {
      const lines = wrap(font, sanitize(text), 11, maxWidth - 16);
      for (let i = 0; i < lines.length; i++) {
        ensureRoom(15);
        if (i === 0) {
          page.drawText("•", {
            x: margin,
            y: y - 11,
            size: 11,
            font: bold,
            color: accent,
          });
        }
        page.drawText(lines[i], {
          x: margin + 14,
          y: y - 11,
          size: 11,
          font,
          color: ink,
        });
        y -= 15;
      }
      y -= 2;
    };

    const drawParagraph = (text: string) => {
      const lines = wrap(font, sanitize(text), 11, maxWidth);
      for (const ln of lines) {
        ensureRoom(15);
        page.drawText(ln, {
          x: margin,
          y: y - 11,
          size: 11,
          font,
          color: ink,
        });
        y -= 15;
      }
      y -= 6;
    };

    drawTitle(name || "Trading Strategy");
    const subtitleParts = [
      `Account: ${(body.accountTypes ?? []).join(", ") || "unspecified"}`,
      body.riskProfile
        ? `Risk/trade ${body.riskProfile.risk_per_trade_pct ?? "?"}% · Daily loss ${body.riskProfile.daily_loss_limit_pct ?? "?"}% · Max DD ${body.riskProfile.max_drawdown_pct ?? "?"}%`
        : "",
      `Generated ${new Date().toISOString().slice(0, 10)}`,
    ].filter(Boolean);
    drawSubtle(subtitleParts.join("  ·  "));
    y -= 6;

    if (kind === "checklist") {
      const tiers: Array<[string, string[] | undefined]> = [
        ["A+ — Perfect setup (every rule must be true)", body.checklist?.a_plus],
        ["B+ — Acceptable (allow 1 non-critical miss)", body.checklist?.b_plus],
        ["C — Minimum (only critical rules required)", body.checklist?.c],
      ];
      for (const [label, items] of tiers) {
        drawHeading(label);
        if (!items || items.length === 0) {
          drawParagraph("No rules in this tier.");
        } else {
          for (const item of items) drawBullet(item);
        }
        y -= 6;
      }
    } else {
      const plan = body.trading_plan ?? "";
      // Split by blank lines into paragraphs; treat ALL CAPS short lines as headings.
      const blocks = plan.split(/\n\s*\n/);
      for (const block of blocks) {
        const trimmed = block.trim();
        if (!trimmed) continue;
        const firstLine = trimmed.split("\n")[0];
        const looksLikeHeading =
          firstLine.length < 60 &&
          /^[A-Z][A-Z &/]+$/.test(firstLine.replace(/[:.]$/, ""));
        if (looksLikeHeading) {
          drawHeading(firstLine.replace(/[:.]$/, ""));
          const rest = trimmed.split("\n").slice(1).join(" ").trim();
          if (rest) drawParagraph(rest);
        } else {
          drawParagraph(trimmed.replace(/\n/g, " "));
        }
      }
    }

    const bytes = await doc.save();
    const filename =
      (name || "strategy").toLowerCase().replace(/[^a-z0-9]+/g, "-") +
      `-${kind}.pdf`;

    return new Response(bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("export-strategy-pdf error", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
