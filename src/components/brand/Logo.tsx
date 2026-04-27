import logoFull from "@/assets/senecaedge-logo.png";

type LogoProps = {
  /** Visual size variant */
  size?: "sm" | "md" | "lg" | "xl";
  /** "full" shows the full lockup; "icon" crops to the SE monogram for tight spaces */
  variant?: "full" | "icon";
  className?: string;
};

const SIZE_MAP: Record<NonNullable<LogoProps["size"]>, { full: string; icon: string }> = {
  sm: { full: "h-7", icon: "h-7 w-7" },
  md: { full: "h-9", icon: "h-9 w-9" },
  lg: { full: "h-14", icon: "h-12 w-12" },
  xl: { full: "h-24", icon: "h-20 w-20" },
};

/**
 * Official SenecaEdge brand logo.
 * Locked asset — do NOT add filters, glow, shadow, or animation here.
 * Maintains original proportions/colors from the source PNG.
 */
export default function Logo({ size = "md", variant = "full", className = "" }: LogoProps) {
  const sizing = SIZE_MAP[size];

  if (variant === "icon") {
    // Icon-only: crop the source to the symbol portion using object-fit.
    return (
      <div
        className={`relative overflow-hidden ${sizing.icon} ${className}`}
        aria-label="SenecaEdge"
      >
        <img
          src={logoFull}
          alt="SenecaEdge"
          // Source image is ~1536x1024 with the SE mark roughly centered in the
          // upper portion. Scale up and offset so only the monogram shows.
          className="absolute left-1/2 top-1/2 h-[220%] max-w-none -translate-x-1/2 -translate-y-[62%] object-contain"
          draggable={false}
        />
      </div>
    );
  }

  return (
    <img
      src={logoFull}
      alt="SenecaEdge — Trading AI"
      className={`${sizing.full} w-auto select-none object-contain ${className}`}
      draggable={false}
    />
  );
}
