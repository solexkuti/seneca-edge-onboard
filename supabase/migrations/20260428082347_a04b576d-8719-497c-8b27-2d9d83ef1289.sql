
REVOKE ALL ON FUNCTION public.detect_behavior_patterns(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_detect_patterns_after_log() FROM PUBLIC, anon, authenticated;
