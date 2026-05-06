-- ── Phase 3: SSOT computed views + accounts table + hard reset ──────────

-- 1. ACCOUNTS table (move balance off profiles, keep profiles cols as legacy mirror for now)
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  balance numeric not null default 0,
  equity numeric not null default 0,
  source text not null default 'manual' check (source in ('manual','synced')),
  is_active boolean not null default true,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_accounts_user on public.accounts(user_id);
create unique index if not exists uniq_accounts_active_per_user
  on public.accounts(user_id) where is_active = true;

alter table public.accounts enable row level security;

create policy "Users view own accounts" on public.accounts
  for select to authenticated using (auth.uid() = user_id);
create policy "Users insert own accounts" on public.accounts
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own accounts" on public.accounts
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own accounts" on public.accounts
  for delete to authenticated using (auth.uid() = user_id);

create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

-- 2. COMPUTED VIEWS — mapped over existing trades / discipline_logs / rule_violations.
--    All views use security_invoker so RLS on the underlying tables applies per-user.

-- METRICS
drop view if exists public.metrics cascade;
create view public.metrics
  with (security_invoker = true) as
select
  t.user_id,
  count(*)::int as total_trades,
  count(*) filter (where t.result = 'win')::int as wins,
  count(*) filter (where t.result = 'loss')::int as losses,
  count(*) filter (where t.result = 'breakeven')::int as breakevens,
  case
    when count(*) filter (where t.result in ('win','loss')) > 0
    then (count(*) filter (where t.result = 'win'))::numeric
       / nullif(count(*) filter (where t.result in ('win','loss')),0)
    else 0
  end as win_rate,
  coalesce(avg(t.rr) filter (where t.rr is not null), 0) as avg_r,
  case
    when sum(case when t.rr < 0 then abs(t.rr) else 0 end) > 0
    then sum(case when t.rr > 0 then t.rr else 0 end)
       / sum(case when t.rr < 0 then abs(t.rr) else 0 end)
    when sum(case when t.rr > 0 then t.rr else 0 end) > 0
    then 999999::numeric
    else 0
  end as profit_factor,
  coalesce(sum(t.rr), 0) as total_r
from public.trades t
where t.trade_type = 'executed'
group by t.user_id;

-- EXPECTANCY
drop view if exists public.expectancy cascade;
create view public.expectancy
  with (security_invoker = true) as
select
  t.user_id,
  coalesce(avg(t.rr), 0) as expectancy_r
from public.trades t
where t.trade_type = 'executed' and t.rr is not null
group by t.user_id;

-- DRAWDOWN (peak-to-trough on cumulative R)
drop view if exists public.drawdown cascade;
create view public.drawdown
  with (security_invoker = true) as
with chrono as (
  select
    user_id,
    sum(coalesce(rr,0)) over (
      partition by user_id order by executed_at
      rows between unbounded preceding and current row
    ) as cumulative
  from public.trades
  where trade_type = 'executed'
),
peaks as (
  select user_id, cumulative,
    max(cumulative) over (
      partition by user_id order by cumulative
      rows between unbounded preceding and current row
    ) as running_peak
  from chrono
)
select user_id, coalesce(max(running_peak - cumulative), 0) as max_drawdown_r
from peaks
group by user_id;

-- RULE ADHERENCE — clean / total from discipline_logs
drop view if exists public.rule_adherence cascade;
create view public.rule_adherence
  with (security_invoker = true) as
select
  user_id,
  count(*)::int as total_logs,
  count(*) filter (
    where followed_entry and followed_exit and followed_risk and followed_behavior
  )::int as clean_trades,
  case when count(*) > 0
    then (count(*) filter (where followed_entry and followed_exit and followed_risk and followed_behavior))::numeric
       / count(*)
    else 1
  end as adherence
from public.discipline_logs
group by user_id;

-- DISCIPLINE — cumulative +10 / -10 with [0,100] clamp.
-- Violations come from discipline_logs (each false flag = 1 violation = -10).
drop view if exists public.discipline cascade;
create view public.discipline
  with (security_invoker = true) as
with per_user as (
  select
    user_id,
    count(*) filter (
      where followed_entry and followed_exit and followed_risk and followed_behavior
    )::int as clean_trades,
    sum(
      (case when followed_entry then 0 else 1 end) +
      (case when followed_exit  then 0 else 1 end) +
      (case when followed_risk  then 0 else 1 end) +
      (case when followed_behavior then 0 else 1 end)
    )::int as violation_count,
    count(*)::int as total_trades
  from public.discipline_logs
  group by user_id
)
select
  p.id as user_id,
  least(100,
    greatest(0,
      100
      + coalesce(pu.clean_trades, 0) * 10
      - coalesce(pu.violation_count, 0) * 10
    )
  )::int as discipline_score,
  coalesce(pu.clean_trades, 0) as clean_trades,
  coalesce(pu.violation_count, 0) as violation_count,
  coalesce(pu.total_trades, 0) as total_trades,
  case
    when least(100, greatest(0, 100 + coalesce(pu.clean_trades,0)*10 - coalesce(pu.violation_count,0)*10)) >= 80 then 'in_control'
    when least(100, greatest(0, 100 + coalesce(pu.clean_trades,0)*10 - coalesce(pu.violation_count,0)*10)) >= 60 then 'slipping'
    when least(100, greatest(0, 100 + coalesce(pu.clean_trades,0)*10 - coalesce(pu.violation_count,0)*10)) >= 40 then 'at_risk'
    else 'locked'
  end as state
from public.profiles p
left join per_user pu on pu.user_id = p.id;

-- 3. HARD RESET — wipes ALL users' trade + behavior data. One-shot use.
create or replace function public.hard_reset_all_users()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.rule_violations;
  delete from public.behavior_patterns;
  delete from public.discipline_logs;
  delete from public.journal_entries;
  delete from public.trade_annotations;
  delete from public.trade_logs;
  delete from public.analyzer_events;
  delete from public.lock_attempt_events;
  delete from public.pressure_events;
  delete from public.checklist_confirmations;
  delete from public.daily_streaks;
  delete from public.discipline_state;
  delete from public.session_state;
  delete from public.recovery_sessions;
  delete from public.replay_trades;
  delete from public.trades;
  update public.profiles set discipline_score = 100;
end;
$$;

revoke all on function public.hard_reset_all_users() from public, anon, authenticated;

-- Execute the hard reset NOW (one-shot per user instruction).
select public.hard_reset_all_users();

-- Backfill accounts row for any existing profile that has a balance.
insert into public.accounts (user_id, balance, equity, source, is_active)
select id, coalesce(account_balance,0), coalesce(account_equity,0),
       coalesce(balance_source,'manual'), true
from public.profiles
where not exists (
  select 1 from public.accounts a where a.user_id = profiles.id and a.is_active
);