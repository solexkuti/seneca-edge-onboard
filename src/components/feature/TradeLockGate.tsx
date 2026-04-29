// TradeLockGate — DEPRECATED. The lock system has been removed in favor of
// non-blocking insight panels on the dashboard. This component is now a
// pass-through to keep existing imports working.

type Props = { children: React.ReactNode; surface?: string };

export default function TradeLockGate({ children }: Props) {
  return <>{children}</>;
}
