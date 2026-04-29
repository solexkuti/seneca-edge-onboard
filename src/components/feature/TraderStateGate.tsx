// TraderStateGate — DEPRECATED hard-block enforcement.
//
// Seneca Edge is now an intelligence system, not an enforcement engine.
// This component is preserved as a transparent pass-through so existing
// imports keep compiling. It never blocks the user. Insight nudges live
// in the new dashboard panels instead.

type Props = {
  children: React.ReactNode;
  surface?: string;
  enforce?: Array<"no_strategy" | "not_confirmed" | "discipline_locked">;
};

export default function TraderStateGate({ children }: Props) {
  return <>{children}</>;
}
