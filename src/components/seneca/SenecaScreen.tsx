// Shared screen primitives for every Seneca-aware module.
//
// Goal: one mind, one rhythm, one layout. Strategy Builder, Mentor,
// Dashboard, Analyzer, Checklist, Journal, and Onboarding all use these
// so spacing, animation, and the "one primary action" rule are identical.
//
// Tokens come from src/styles.css — do NOT add raw colors here.

import { motion, type HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;
const DUR = 0.26;

/** Standard fade + slight upward motion. 200–300ms. */
export function FadeIn({
  children,
  delay = 0,
  ...rest
}: HTMLMotionProps<"div"> & { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: DUR, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/**
 * Outer screen container. Centered column, generous spacing, calm bg.
 * Use as the ONLY top-level wrapper for module screens.
 */
export function SenecaScreen({
  children,
  back,
  className = "",
}: {
  children: React.ReactNode;
  back?: { to: string; label?: string };
  className?: string;
}) {
  return (
    <div className="min-h-svh w-full bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-5 pb-24 pt-6 sm:pt-10">
        {back && (
          <Link
            to={back.to}
            className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {back.label ?? "Back"}
          </Link>
        )}
        <div className={`flex flex-col gap-8 ${className}`}>{children}</div>
      </div>
    </div>
  );
}

/** Title + subtitle pair. Always one H1 per screen. */
export function SenecaHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <FadeIn className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        {title}
      </h1>
      {subtitle && (
        <p className="text-sm text-muted-foreground sm:text-base">{subtitle}</p>
      )}
    </FadeIn>
  );
}

/**
 * Mentor line — the calm voice of Seneca. Use for guidance, blocks,
 * acknowledgements. Never use raw <p> for mentor copy in modules.
 */
export function MentorLine({
  children,
  tone = "calm",
}: {
  children: React.ReactNode;
  tone?: "calm" | "block" | "ack";
}) {
  const toneClass =
    tone === "block"
      ? "border-border/60 bg-card/60 text-foreground"
      : tone === "ack"
        ? "border-border/40 bg-card/40 text-muted-foreground"
        : "border-border/50 bg-card/50 text-foreground/90";
  return (
    <FadeIn>
      <div
        className={`rounded-2xl border ${toneClass} px-4 py-3 text-sm leading-relaxed shadow-[0_1px_0_rgba(0,0,0,0.02)] backdrop-blur`}
      >
        {children}
      </div>
    </FadeIn>
  );
}

/**
 * One primary action per screen. Disabled state and loading state are
 * handled here — modules never style their own primary buttons.
 */
export function PrimaryAction({
  children,
  onClick,
  disabled,
  loading,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className="group relative inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-5 text-sm font-medium text-background shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/** Subtle secondary action. Use sparingly. */
export function SecondaryAction({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-border/60 bg-card/40 px-5 text-sm font-medium text-foreground/80 transition hover:bg-card/70 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
