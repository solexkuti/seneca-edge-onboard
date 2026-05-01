/**
 * Seneca Edge — Trade Pipeline
 *
 *   Raw Data → normalize → Trade → analysis → insights → UI
 *
 * Public surface for every UI feature that touches trades.
 */

export * from "./types";
export * from "./normalize";
export * from "./analysis";
export * from "./insights";
export * from "./recommendations";
// Note: ./export is intentionally NOT re-exported — it pulls jspdf which
// would bloat any consumer of `@/lib/trade`. Import it directly from
// `@/lib/trade/export` only where needed.
