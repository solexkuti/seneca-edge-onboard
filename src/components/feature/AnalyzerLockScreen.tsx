// AnalyzerLockScreen — DEPRECATED. Replaced with non-blocking insight nudges
// in the dashboard. Now a transparent pass-through so existing imports work.

type Props = { children?: React.ReactNode };

export default function AnalyzerLockScreen({ children }: Props) {
  return <>{children}</>;
}
