// PreTradeIntercept — DEPRECATED. Seneca Edge no longer pressure-gates the
// user before logging a trade. Component renders nothing and immediately
// confirms so any caller still mounting it stays unblocked.

import { useEffect } from "react";

type Props = {
  evaluation?: unknown;
  onConfirm: () => void;
  onCancel?: () => void;
};

export default function PreTradeIntercept({ onConfirm }: Props) {
  useEffect(() => {
    onConfirm();
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
