-- Phase 1: extend trades table to match unified Trade Object spec

-- Source enum
DO $$ BEGIN
  CREATE TYPE public.trade_source AS ENUM ('manual', 'deriv', 'mt5');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Market type enum
DO $$ BEGIN
  CREATE TYPE public.market_type AS ENUM ('forex', 'synthetic', 'crypto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trade type enum
DO $$ BEGIN
  CREATE TYPE public.trade_kind AS ENUM ('executed', 'missed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Session enum
DO $$ BEGIN
  CREATE TYPE public.trade_session AS ENUM ('London', 'NY', 'Asia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Missed reason enum
DO $$ BEGIN
  CREATE TYPE public.missed_reason AS ENUM ('hesitation', 'fear', 'lack_of_confidence', 'distraction');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Execution type enum
DO $$ BEGIN
  CREATE TYPE public.execution_type AS ENUM ('controlled', 'emotional');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add columns
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS source public.trade_source NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS market_type public.market_type,
  ADD COLUMN IF NOT EXISTS asset text,
  ADD COLUMN IF NOT EXISTS exit_price numeric,
  ADD COLUMN IF NOT EXISTS lot_size numeric,
  ADD COLUMN IF NOT EXISTS risk_r numeric,
  ADD COLUMN IF NOT EXISTS pnl numeric,
  ADD COLUMN IF NOT EXISTS session public.trade_session,
  ADD COLUMN IF NOT EXISTS screenshot_url text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS trade_type public.trade_kind NOT NULL DEFAULT 'executed',
  ADD COLUMN IF NOT EXISTS missed_potential_r numeric,
  ADD COLUMN IF NOT EXISTS missed_reason public.missed_reason,
  ADD COLUMN IF NOT EXISTS rules_followed text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rules_broken text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS execution_type public.execution_type;

-- Backfill asset from market for existing rows
UPDATE public.trades SET asset = market WHERE asset IS NULL;

-- Index for history queries
CREATE INDEX IF NOT EXISTS trades_user_executed_at_idx
  ON public.trades (user_id, executed_at DESC);

-- Index for behavior breakdown filtering by type
CREATE INDEX IF NOT EXISTS trades_user_type_idx
  ON public.trades (user_id, trade_type);
