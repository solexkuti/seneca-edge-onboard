-- 1) Storage bucket (private)
insert into storage.buckets (id, name, public)
values ('chart-analyses', 'chart-analyses', false)
on conflict (id) do nothing;

-- Storage RLS — users can only touch files inside <user_id>/...
create policy "chart_analyses_select_own"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'chart-analyses' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "chart_analyses_insert_own"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chart-analyses' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "chart_analyses_update_own"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'chart-analyses' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "chart_analyses_delete_own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'chart-analyses' and auth.uid()::text = (storage.foldername(name))[1]);

-- 2) chart_analyses table
create table public.chart_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  blueprint_id uuid,
  strategy_name text,
  exec_timeframe text not null,
  higher_timeframe text,
  exec_image_path text not null,
  higher_image_path text,
  -- Pre-validation
  is_chart boolean not null default false,
  chart_confidence integer not null default 0,
  chart_reason text,
  -- AI feature extraction
  features jsonb not null default '{}'::jsonb,
  -- Rule engine output
  rule_breakdown jsonb not null default '{}'::jsonb,
  verdict text not null default 'invalid', -- valid | weak | invalid
  -- AI explanation (general market analysis, not decision)
  ai_insight text,
  -- Optional link once trade is logged
  trade_id uuid,
  created_at timestamptz not null default now()
);

alter table public.chart_analyses enable row level security;

create policy "Users view own chart analyses"
  on public.chart_analyses for select
  to authenticated using (auth.uid() = user_id);

create policy "Users insert own chart analyses"
  on public.chart_analyses for insert
  to authenticated with check (auth.uid() = user_id);

create policy "Users update own chart analyses"
  on public.chart_analyses for update
  to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users delete own chart analyses"
  on public.chart_analyses for delete
  to authenticated using (auth.uid() = user_id);

create index chart_analyses_user_created_idx
  on public.chart_analyses (user_id, created_at desc);

-- 3) Optional reference from trades to the analysis that justified them
alter table public.trades
  add column if not exists analysis_id uuid;
