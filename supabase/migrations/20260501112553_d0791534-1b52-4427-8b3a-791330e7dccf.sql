CREATE TABLE public.trade_annotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trade_id UUID NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  rule TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, trade_id, rule)
);

CREATE INDEX idx_trade_annotations_user_rule
  ON public.trade_annotations (user_id, rule);

CREATE INDEX idx_trade_annotations_trade
  ON public.trade_annotations (trade_id);

ALTER TABLE public.trade_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own trade annotations"
  ON public.trade_annotations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own trade annotations"
  ON public.trade_annotations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own trade annotations"
  ON public.trade_annotations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own trade annotations"
  ON public.trade_annotations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_trade_annotations_updated_at
  BEFORE UPDATE ON public.trade_annotations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();