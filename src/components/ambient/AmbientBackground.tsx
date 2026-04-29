// AmbientBackground — global "living" backdrop.
//
// A fixed, pointer-events-none layer that sits behind every screen and
// emits two very slow drifting radial gold glows over a deep #050505→#0A0A0A
// vertical gradient. This is what makes the app feel alive even when idle.
//
// Rules:
//   • opacity 6–12% max
//   • blur 80–140px
//   • 12–20s loops, no flicker, no sharp motion
//   • respects prefers-reduced-motion (handled in CSS)
//   • never intercepts clicks (pointer-events: none)

export default function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #050505 0%, #08080A 50%, #0A0A0A 100%)",
      }}
    >
      {/* Primary warm-gold glow — slow elliptical drift, top-left → center */}
      <div
        className="absolute -top-[20%] -left-[10%] h-[70vmax] w-[70vmax] rounded-full animate-ambient-drift-a"
        style={{
          background:
            "radial-gradient(closest-side, rgba(198,161,91,0.10), rgba(198,161,91,0.04) 55%, transparent 75%)",
          filter: "blur(110px)",
        }}
      />
      {/* Secondary deeper-gold glow — counter drift, slower */}
      <div
        className="absolute -bottom-[25%] -right-[15%] h-[80vmax] w-[80vmax] rounded-full animate-ambient-drift-b"
        style={{
          background:
            "radial-gradient(closest-side, rgba(182,139,61,0.08), rgba(182,139,61,0.03) 55%, transparent 75%)",
          filter: "blur(130px)",
        }}
      />
      {/* Faint highlight — barely-there warm shimmer near top */}
      <div
        className="absolute top-[10%] left-[35%] h-[40vmax] w-[40vmax] rounded-full animate-ambient-breathe"
        style={{
          background:
            "radial-gradient(closest-side, rgba(230,194,122,0.05), transparent 70%)",
          filter: "blur(90px)",
        }}
      />
    </div>
  );
}
