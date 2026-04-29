
-- 1. Add running discipline score to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS discipline_score integer NOT NULL DEFAULT 100;

-- 2. Journal entries table — the new source of truth for behavioral trades
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  asset text NOT NULL,
  result_r numeric NOT NULL,
  mistakes text[] NOT NULL DEFAULT '{}',
  classification text NOT NULL CHECK (classification IN ('clean','minor','bad','severe')),
  score_delta integer NOT NULL,
  score_before integer NOT NULL,
  score_after integer NOT NULL,
  clean_streak_after integer NOT NULL DEFAULT 0,
  break_streak_after integer NOT NULL DEFAULT 0,
  note text,
  screenshot_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS journal_entries_user_created_idx
  ON public.journal_entries (user_id, created_at DESC);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own journal entries"
  ON public.journal_entries FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own journal entries"
  ON public.journal_entries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own journal entries"
  ON public.journal_entries FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own journal entries"
  ON public.journal_entries FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 3. Trade screenshots bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('trade-screenshots', 'trade-screenshots', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users view own trade screenshots"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'trade-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own trade screenshots"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'trade-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own trade screenshots"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'trade-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
