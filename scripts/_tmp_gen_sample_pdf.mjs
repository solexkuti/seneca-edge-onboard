// Self-contained sample PDF generator — uses the SAME canonical pipeline + same
// jsPDF, but writes via output("arraybuffer") to skip browser-only save().
import { writeFileSync } from "node:fs";

globalThis.atob = (s) => Buffer.from(s, "base64").toString("binary");
globalThis.btoa = (s) => Buffer.from(s, "binary").toString("base64");
globalThis.window = { atob: globalThis.atob, btoa: globalThis.btoa };
globalThis.document = {
  createElement: () => ({ getContext: () => null, style: {}, setAttribute(){}, appendChild(){}, click(){} }),
  body: { appendChild(){}, removeChild(){} },
};
globalThis.navigator = { userAgent: "node" };
globalThis.URL = class { static createObjectURL(){return "blob:x";} static revokeObjectURL(){} };
globalThis.Blob = class { constructor(p){this.p=p;} };

const { jsPDF } = await import("jspdf");
const { buildCanonicalStrategy, CATEGORY_ORDER, CATEGORY_LABELS } = await import("../src/lib/strategySchema.ts");

// Mirror of strategyExport.downloadPdf, but writes a buffer.
function renderPdfBuffer(bp, kind) {
  const c = buildCanonicalStrategy(bp);
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 56, maxW = pageW - M * 2;
  let y = M;
  const ensureRoom = (h) => { if (y + h > pageH - M - 18) { doc.addPage(); y = M; } };
  const writeWrapped = (text, size, style="normal", lineGap=4, indent=0) => {
    doc.setFont("helvetica", style); doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, maxW - indent);
    for (const line of lines) { ensureRoom(size + lineGap); doc.text(line, M + indent, y); y += size + lineGap; }
  };
  const sectionHeader = (label) => {
    ensureRoom(36); y += 6;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(90);
    doc.text(label.toUpperCase(), M, y); y += 8;
    doc.setDrawColor(220); doc.line(M, y, pageW - M, y); y += 14;
    doc.setTextColor(0);
  };
  const bullet = (text, withCheckbox=false) => {
    ensureRoom(20);
    const indent = withCheckbox ? 22 : 14;
    if (withCheckbox) { doc.setDrawColor(150); doc.rect(M, y - 9, 10, 10); }
    else { doc.setFillColor(120, 120, 120); doc.circle(M + 4, y - 4, 1.6, "F"); }
    doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    const lines = doc.splitTextToSize(text, maxW - indent);
    for (let i=0;i<lines.length;i++){ if(i>0)ensureRoom(14); doc.text(lines[i], M + indent, y); if (i<lines.length-1) y += 14; }
    y += 16;
  };

  doc.setFont("helvetica","bold"); doc.setFontSize(20); doc.text(c.name, M, y); y += 24;
  doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(120);
  const sub = [];
  if (c.summary.account_types.length) sub.push(c.summary.account_types.join(" · "));
  if (c.summary.sessions.length) sub.push(`Sessions: ${c.summary.sessions.join(", ")}`);
  if (sub.length) { doc.text(sub.join("   ·   "), M, y); y += 14; }
  doc.setTextColor(0); doc.setDrawColor(180); doc.line(M, y + 4, pageW - M, y + 4); y += 22;

  if (kind === "full" || kind === "plan") {
    sectionHeader("Strategy Summary");
    const rp = c.summary.risk_profile, rpParts = [];
    if (rp.risk_per_trade_pct != null) rpParts.push(`Risk/trade: ${rp.risk_per_trade_pct}%`);
    if (rp.daily_loss_limit_pct != null) rpParts.push(`Daily loss: ${rp.daily_loss_limit_pct}%`);
    if (rp.max_drawdown_pct != null) rpParts.push(`Max DD: ${rp.max_drawdown_pct}%`);
    if (rpParts.length) writeWrapped(rpParts.join("   ·   "), 11);
    if (c.summary.key_rules.length) { y += 4; writeWrapped("Key rules", 10.5, "bold"); for (const r of c.summary.key_rules) bullet(r); }
    if (c.summary.behavior_limits.length) { y += 2; writeWrapped("Behavior limits", 10.5, "bold"); for (const r of c.summary.behavior_limits) bullet(r); }
  }
  if (kind === "checklist" || kind === "full") {
    const sections = [["A+   Perfect", c.checklist.a_plus],["B+   Acceptable", c.checklist.b_plus],["C    Minimum", c.checklist.c]];
    for (const [label, items] of sections) { if (!items.length) continue; sectionHeader(label); for (const it of items) bullet(it, true); }
  }
  if (kind === "plan" || kind === "full") {
    for (const cat of CATEGORY_ORDER) {
      const items = c.rules.filter(r => r.category === cat);
      if (!items.length) continue;
      sectionHeader(CATEGORY_LABELS[cat]);
      for (const r of items) bullet(r.condition);
    }
  }
  const pages = doc.getNumberOfPages();
  for (let i=1;i<=pages;i++){
    doc.setPage(i); doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(140);
    doc.text(`${c.name} · ${kind}`, M, pageH - 24);
    doc.text(`${i} / ${pages}`, pageW - M, pageH - 24, { align: "right" });
    doc.setTextColor(0);
  }
  return Buffer.from(doc.output("arraybuffer"));
}

const bp = {
  id:"sample-bp", user_id:"u", strategy_id:null,
  name:"London ORB — Gold Sweep Reclaim",
  account_types:["prop","personal"],
  risk_per_trade_pct:0.5, daily_loss_limit_pct:2, max_drawdown_pct:6,
  raw_input:null,
  tier_strictness:{a_plus:100,b_plus:80,c:60}, tier_rules:{a_plus:"",b_plus:"",c:""},
  structured_rules:{
    context:["Trade only during London session 08:00-11:00 GMT","Daily bias aligned with H4 trend direction","Avoid high-impact news ±15 minutes"],
    entry:["Price sweeps prior session high or low on M5","Reclaim of swept level with body close back inside range","Entry placed at 50% of reclaim candle, max 2 attempts per session"],
    confirmation:["FVG on M1 forms in direction of reclaim","Volume on reclaim candle > 1.5× the prior 20-bar average"],
    invalidation:["Price closes back beyond swept level on M5","Two consecutive M5 closes against the reclaim direction"],
    risk:["Risk 0.5% of account per trade, fixed","Stop loss placed 1 ATR(14) beyond invalidation level","Take profit at 2R minimum, partial at 1R when available"],
    behavior:["Stop trading after 2 losses in a session","No re-entries within 5 minutes of a stopped trade","Journal every trade within 30 minutes of close"],
  },
  ambiguity_flags:[], refinement_history:[],
  checklist:{a_plus:["seed"],b_plus:[],c:[]}, trading_plan:"seed",
  locked:false, locked_at:null, version:1, status:"finalized", current_step:"output",
  created_at:new Date().toISOString(), updated_at:new Date().toISOString(),
};

for (const kind of ["full","checklist","plan"]) {
  const buf = renderPdfBuffer(bp, kind);
  const path = `/tmp/sample-${kind}.pdf`;
  writeFileSync(path, buf);
  console.log("WROTE", path, buf.length);
}
