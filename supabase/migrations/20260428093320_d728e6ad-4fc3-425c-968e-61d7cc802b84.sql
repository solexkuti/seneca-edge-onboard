-- enforce_trade_lock is a trigger function only; nobody should call it directly.
REVOKE ALL ON FUNCTION public.enforce_trade_lock() FROM PUBLIC, anon, authenticated;

-- is_trade_unlocked: only signed-in users may call it (and only ever for themselves
-- in app code). Block anonymous callers from probing lock state.
REVOKE ALL ON FUNCTION public.is_trade_unlocked(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_trade_unlocked(uuid) TO authenticated;