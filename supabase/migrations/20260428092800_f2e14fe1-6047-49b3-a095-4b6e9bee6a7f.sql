-- Pin search_path on compute_identity_label
CREATE OR REPLACE FUNCTION public.compute_identity_label(streak integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN streak <= 0  THEN 'starting fresh'
    WHEN streak < 3   THEN streak || ' clean trade' || CASE WHEN streak = 1 THEN '' ELSE 's' END
    WHEN streak < 7   THEN streak || ' days disciplined'
    WHEN streak < 14  THEN streak || ' days controlled'
    WHEN streak < 30  THEN streak || ' days elite execution'
    ELSE streak || ' days locked in'
  END;
$$;

-- Revoke direct EXECUTE on the SECURITY DEFINER trigger function.
-- It should only be invoked by the trigger, never by a client.
REVOKE EXECUTE ON FUNCTION public.update_daily_streak_after_log() FROM PUBLIC, anon, authenticated;
