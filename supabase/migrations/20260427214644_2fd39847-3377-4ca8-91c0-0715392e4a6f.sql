-- Hidden analytics for AI Mentor (Seneca)
CREATE TABLE public.mentor_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT,
  detected_state TEXT NOT NULL,
  spiral_triggered BOOLEAN NOT NULL DEFAULT false,
  closing_question TEXT,
  closing_type TEXT,
  user_message_length INTEGER,
  user_message_preview TEXT,
  assistant_message_length INTEGER,
  model TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_mentor_analytics_created_at ON public.mentor_analytics(created_at DESC);
CREATE INDEX idx_mentor_analytics_state ON public.mentor_analytics(detected_state);

ALTER TABLE public.mentor_analytics ENABLE ROW LEVEL SECURITY;

-- No public policies: only the service role (used by edge functions) can read/write.
-- Service role bypasses RLS by default, so leaving the table with RLS enabled and
-- zero policies blocks all client access.
