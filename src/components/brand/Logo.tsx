import logoFull from "@/assets/senecaedge-logo.png";
import appIcon from "@/assets/senecaedge-app-icon.png";

type LogoProps = {
  /** Visual size variant */
  size?: "sm" | "md" | "lg" | "xl";
  /** "full" shows the full lockup; "icon" shows the SE app-icon mark for tight spaces */
  variant?: "full" | "icon";
  className?: string;
};

const SIZE_MAP: Record<NonNullable<LogoProps["size"]>, { full: string; icon: string }> = {
  sm: { full: "h-7", icon: "h-8 w-8" },
  md: { full: "h-9", icon: "h-10 w-10" },
  lg: { full: "h-14", icon: "h-14 w-14" },
  xl: { full: "h-24", icon: "h-24 w-24" },
};

/**
 * Official SenecaEdge brand logo.
 * Locked asset — do NOT add filters, glow, shadow, or animation here.
 * Maintains original proportions/colors from the source PNG.
 */
export default function Logo({ size = "md", variant = "full", className = "" }: LogoProps) {
  const sizing = SIZE_MAP[size];

  if (variant === "icon") {
    return (
      <img
        src={appIcon}
        alt="SenecaEdge"
        className={`${sizing.icon} select-none object-contain ${className}`}
        draggable={false}
      />
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
