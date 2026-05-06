export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          balance: number
          created_at: string
          equity: number
          id: string
          is_active: boolean
          label: string | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          equity?: number
          id?: string
          is_active?: boolean
          label?: string | null
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          equity?: number
          id?: string
          is_active?: boolean
          label?: string | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "discipline"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      analyzer_events: {
        Row: {
          analysis_id: string | null
          blueprint_id: string | null
          created_at: string
          id: string
          reason: string | null
          score_delta: number
          user_id: string
          verdict: string
          violations: Json
        }
        Insert: {
          analysis_id?: string | null
          blueprint_id?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          score_delta?: number
          user_id: string
          verdict: string
          violations?: Json
        }
        Update: {
          analysis_id?: string | null
          blueprint_id?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          score_delta?: number
          user_id?: string
          verdict?: string
          violations?: Json
        }
        Relationships: []
      }
      behavior_patterns: {
        Row: {
          created_at: string
          detected_at: string
          id: string
          kind: Database["public"]["Enums"]["behavior_pattern_kind"]
          last_triggered_at: string
          message: string
          meta: Json
          pattern_type: string | null
          severity: number
          trade_ids: string[]
          trigger_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          detected_at?: string
          id?: string
          kind: Database["public"]["Enums"]["behavior_pattern_kind"]
          last_triggered_at?: string
          message: string
          meta?: Json
          pattern_type?: string | null
          severity?: number
          trade_ids?: string[]
          trigger_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          detected_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["behavior_pattern_kind"]
          last_triggered_at?: string
          message?: string
          meta?: Json
          pattern_type?: string | null
          severity?: number
          trade_ids?: string[]
          trigger_count?: number
          user_id?: string
        }
        Relationships: []
      }
      candles: {
        Row: {
          close: number
          fetched_at: string
          high: number
          low: number
          open: number
          provider: string
          symbol: string
          time: number
          timeframe: string
          volume: number | null
        }
        Insert: {
          close: number
          fetched_at?: string
          high: number
          low: number
          open: number
          provider: string
          symbol: string
          time: number
          timeframe: string
          volume?: number | null
        }
        Update: {
          close?: number
          fetched_at?: string
          high?: number
          low?: number
          open?: number
          provider?: string
          symbol?: string
          time?: number
          timeframe?: string
          volume?: number | null
        }
        Relationships: []
      }
      chart_analyses: {
        Row: {
          ai_insight: string | null
          blueprint_id: string | null
          chart_confidence: number
          chart_reason: string | null
          created_at: string
          exec_image_path: string
          exec_timeframe: string
          features: Json
          higher_image_path: string | null
          higher_timeframe: string | null
          id: string
          is_chart: boolean
          rule_breakdown: Json
          strategy_name: string | null
          trade_id: string | null
          user_id: string
          verdict: string
        }
        Insert: {
          ai_insight?: string | null
          blueprint_id?: string | null
          chart_confidence?: number
          chart_reason?: string | null
          created_at?: string
          exec_image_path: string
          exec_timeframe: string
          features?: Json
          higher_image_path?: string | null
          higher_timeframe?: string | null
          id?: string
          is_chart?: boolean
          rule_breakdown?: Json
          strategy_name?: string | null
          trade_id?: string | null
          user_id: string
          verdict?: string
        }
        Update: {
          ai_insight?: string | null
          blueprint_id?: string | null
          chart_confidence?: number
          chart_reason?: string | null
          created_at?: string
          exec_image_path?: string
          exec_timeframe?: string
          features?: Json
          higher_image_path?: string | null
          higher_timeframe?: string | null
          id?: string
          is_chart?: boolean
          rule_breakdown?: Json
          strategy_name?: string | null
          trade_id?: string | null
          user_id?: string
          verdict?: string
        }
        Relationships: []
      }
      checklist_confirmations: {
        Row: {
          allowed_tiers: Json
          applied_restrictions: Json
          confirmed_at: string
          control_state: string
          created_at: string
          discipline_score: number
          focus: Json
          generated_for: string
          id: string
          rule_acknowledgements: Json
          strategy_name: string | null
          user_id: string
        }
        Insert: {
          allowed_tiers?: Json
          applied_restrictions?: Json
          confirmed_at?: string
          control_state: string
          created_at?: string
          discipline_score?: number
          focus?: Json
          generated_for: string
          id?: string
          rule_acknowledgements?: Json
          strategy_name?: string | null
          user_id: string
        }
        Update: {
          allowed_tiers?: Json
          applied_restrictions?: Json
          confirmed_at?: string
          control_state?: string
          created_at?: string
          discipline_score?: number
          focus?: Json
          generated_for?: string
          id?: string
          rule_acknowledgements?: Json
          strategy_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      daily_streaks: {
        Row: {
          current_streak: number
          identity_label: string
          last_break_date: string | null
          last_clean_date: string | null
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          identity_label?: string
          last_break_date?: string | null
          last_clean_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          identity_label?: string
          last_break_date?: string | null
          last_clean_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deriv_connections: {
        Row: {
          account_id: string | null
          account_label: string | null
          api_token: string
          auto_sync: boolean
          balance: number | null
          created_at: string
          currency: string | null
          id: string
          is_virtual: boolean
          last_deal_at: string | null
          last_error: string | null
          last_synced_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          account_label?: string | null
          api_token: string
          auto_sync?: boolean
          balance?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          is_virtual?: boolean
          last_deal_at?: string | null
          last_error?: string | null
          last_synced_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          account_label?: string | null
          api_token?: string
          auto_sync?: boolean
          balance?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          is_virtual?: boolean
          last_deal_at?: string | null
          last_error?: string | null
          last_synced_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deriv_imports: {
        Row: {
          created_at: string
          error: string | null
          id: string
          latest_deal_at: string | null
          rows_duplicate: number
          rows_imported: number
          rows_skipped: number
          rows_total: number
          trigger: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          latest_deal_at?: string | null
          rows_duplicate?: number
          rows_imported?: number
          rows_skipped?: number
          rows_total?: number
          trigger?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          latest_deal_at?: string | null
          rows_duplicate?: number
          rows_imported?: number
          rows_skipped?: number
          rows_total?: number
          trigger?: string
          user_id?: string
        }
        Relationships: []
      }
      discipline_logs: {
        Row: {
          created_at: string
          discipline_score: number
          emotional_state: Database["public"]["Enums"]["emotional_state"] | null
          followed_behavior: boolean
          followed_entry: boolean
          followed_exit: boolean
          followed_risk: boolean
          id: string
          mistake_tag: Database["public"]["Enums"]["mistake_tag"] | null
          notes: string | null
          trade_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discipline_score?: number
          emotional_state?:
            | Database["public"]["Enums"]["emotional_state"]
            | null
          followed_behavior?: boolean
          followed_entry?: boolean
          followed_exit?: boolean
          followed_risk?: boolean
          id?: string
          mistake_tag?: Database["public"]["Enums"]["mistake_tag"] | null
          notes?: string | null
          trade_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          discipline_score?: number
          emotional_state?:
            | Database["public"]["Enums"]["emotional_state"]
            | null
          followed_behavior?: boolean
          followed_entry?: boolean
          followed_exit?: boolean
          followed_risk?: boolean
          id?: string
          mistake_tag?: Database["public"]["Enums"]["mistake_tag"] | null
          notes?: string | null
          trade_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discipline_logs_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: true
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      discipline_state: {
        Row: {
          decision_sample: number
          decision_score: number
          execution_sample: number
          execution_score: number
          score: number
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          decision_sample?: number
          decision_score?: number
          execution_sample?: number
          execution_score?: number
          score?: number
          state?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          decision_sample?: number
          decision_score?: number
          execution_sample?: number
          execution_score?: number
          score?: number
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      emotional_events: {
        Row: {
          action_taken: string | null
          created_at: string
          id: string
          state: Database["public"]["Enums"]["emotional_state"]
          trigger: string | null
          user_id: string
        }
        Insert: {
          action_taken?: string | null
          created_at?: string
          id?: string
          state: Database["public"]["Enums"]["emotional_state"]
          trigger?: string | null
          user_id: string
        }
        Update: {
          action_taken?: string | null
          created_at?: string
          id?: string
          state?: Database["public"]["Enums"]["emotional_state"]
          trigger?: string | null
          user_id?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          asset: string
          break_streak_after: number
          classification: string
          clean_streak_after: number
          created_at: string
          id: string
          mistakes: string[]
          note: string | null
          result_r: number
          score_after: number
          score_before: number
          score_delta: number
          screenshot_path: string | null
          user_id: string
        }
        Insert: {
          asset: string
          break_streak_after?: number
          classification: string
          clean_streak_after?: number
          created_at?: string
          id?: string
          mistakes?: string[]
          note?: string | null
          result_r: number
          score_after: number
          score_before: number
          score_delta: number
          screenshot_path?: string | null
          user_id: string
        }
        Update: {
          asset?: string
          break_streak_after?: number
          classification?: string
          clean_streak_after?: number
          created_at?: string
          id?: string
          mistakes?: string[]
          note?: string | null
          result_r?: number
          score_after?: number
          score_before?: number
          score_delta?: number
          screenshot_path?: string | null
          user_id?: string
        }
        Relationships: []
      }
      lock_attempt_events: {
        Row: {
          checklist_confirmed: boolean
          created_at: string
          discipline_score: number
          discipline_state: string
          id: string
          reason: string
          surface: string
          user_id: string
        }
        Insert: {
          checklist_confirmed?: boolean
          created_at?: string
          discipline_score?: number
          discipline_state: string
          id?: string
          reason: string
          surface?: string
          user_id: string
        }
        Update: {
          checklist_confirmed?: boolean
          created_at?: string
          discipline_score?: number
          discipline_state?: string
          id?: string
          reason?: string
          surface?: string
          user_id?: string
        }
        Relationships: []
      }
      mentor_analytics: {
        Row: {
          assistant_message_length: number | null
          closing_question: string | null
          closing_type: string | null
          created_at: string
          detected_state: string
          id: string
          model: string | null
          session_id: string | null
          spiral_triggered: boolean
          user_message_length: number | null
          user_message_preview: string | null
        }
        Insert: {
          assistant_message_length?: number | null
          closing_question?: string | null
          closing_type?: string | null
          created_at?: string
          detected_state: string
          id?: string
          model?: string | null
          session_id?: string | null
          spiral_triggered?: boolean
          user_message_length?: number | null
          user_message_preview?: string | null
        }
        Update: {
          assistant_message_length?: number | null
          closing_question?: string | null
          closing_type?: string | null
          created_at?: string
          detected_state?: string
          id?: string
          model?: string | null
          session_id?: string | null
          spiral_triggered?: boolean
          user_message_length?: number | null
          user_message_preview?: string | null
        }
        Relationships: []
      }
      mt5_imports: {
        Row: {
          account_label: string | null
          created_at: string
          filename: string
          id: string
          latest_deal_at: string | null
          rows_duplicate: number
          rows_imported: number
          rows_skipped: number
          rows_total: number
          user_id: string
        }
        Insert: {
          account_label?: string | null
          created_at?: string
          filename: string
          id?: string
          latest_deal_at?: string | null
          rows_duplicate?: number
          rows_imported?: number
          rows_skipped?: number
          rows_total?: number
          user_id: string
        }
        Update: {
          account_label?: string | null
          created_at?: string
          filename?: string
          id?: string
          latest_deal_at?: string | null
          rows_duplicate?: number
          rows_imported?: number
          rows_skipped?: number
          rows_total?: number
          user_id?: string
        }
        Relationships: []
      }
      pressure_events: {
        Row: {
          created_at: string
          discipline_score: number
          discipline_state: string
          escalation_level: number
          hold_seconds: number
          id: string
          last_event_klass: string | null
          proceeded: boolean
          surface: string
          trigger_reason: string
          triggers: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          discipline_score?: number
          discipline_state: string
          escalation_level?: number
          hold_seconds?: number
          id?: string
          last_event_klass?: string | null
          proceeded?: boolean
          surface?: string
          trigger_reason: string
          triggers?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          discipline_score?: number
          discipline_state?: string
          escalation_level?: number
          hold_seconds?: number
          id?: string
          last_event_klass?: string | null
          proceeded?: boolean
          surface?: string
          trigger_reason?: string
          triggers?: Json
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_balance: number | null
          account_equity: number | null
          balance_source: string
          balance_updated_at: string | null
          challenge: string | null
          created_at: string
          discipline_score: number
          experience: string | null
          goal: string | null
          id: string
          market: string | null
          onboarded_at: string | null
          onboarding_completed: boolean
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
          username: string | null
        }
        Insert: {
          account_balance?: number | null
          account_equity?: number | null
          balance_source?: string
          balance_updated_at?: string | null
          challenge?: string | null
          created_at?: string
          discipline_score?: number
          experience?: string | null
          goal?: string | null
          id: string
          market?: string | null
          onboarded_at?: string | null
          onboarding_completed?: boolean
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          username?: string | null
        }
        Update: {
          account_balance?: number | null
          account_equity?: number | null
          balance_source?: string
          balance_updated_at?: string | null
          challenge?: string | null
          created_at?: string
          discipline_score?: number
          experience?: string | null
          goal?: string | null
          id?: string
          market?: string | null
          onboarded_at?: string | null
          onboarding_completed?: boolean
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      recovery_sessions: {
        Row: {
          completed_time: string | null
          cooldown_completed: boolean
          cooldown_ends_at: string | null
          cooldown_seconds: number
          cooldown_started_at: string | null
          created_at: string
          id: string
          probation_decisions_seen: number
          probation_state: string
          recommit_acks: Json
          recommit_completed: boolean
          reflection_completed: boolean
          reflection_next_action: string | null
          reflection_violation_match: string | null
          reflection_why: string | null
          start_time: string
          step: string
          success: boolean | null
          trigger_reason: string
          triggered_by_event_id: string | null
          triggered_by_trade_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_time?: string | null
          cooldown_completed?: boolean
          cooldown_ends_at?: string | null
          cooldown_seconds?: number
          cooldown_started_at?: string | null
          created_at?: string
          id?: string
          probation_decisions_seen?: number
          probation_state?: string
          recommit_acks?: Json
          recommit_completed?: boolean
          reflection_completed?: boolean
          reflection_next_action?: string | null
          reflection_violation_match?: string | null
          reflection_why?: string | null
          start_time?: string
          step?: string
          success?: boolean | null
          trigger_reason?: string
          triggered_by_event_id?: string | null
          triggered_by_trade_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_time?: string | null
          cooldown_completed?: boolean
          cooldown_ends_at?: string | null
          cooldown_seconds?: number
          cooldown_started_at?: string | null
          created_at?: string
          id?: string
          probation_decisions_seen?: number
          probation_state?: string
          recommit_acks?: Json
          recommit_completed?: boolean
          reflection_completed?: boolean
          reflection_next_action?: string | null
          reflection_violation_match?: string | null
          reflection_why?: string | null
          start_time?: string
          step?: string
          success?: boolean | null
          trigger_reason?: string
          triggered_by_event_id?: string | null
          triggered_by_trade_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      replay_sessions: {
        Row: {
          category: string
          created_at: string
          cursor_time: number
          equity: number
          id: string
          provider: string
          range_from: number
          range_to: number
          speed: number
          starting_equity: number
          status: string
          symbol: string
          symbol_label: string | null
          timeframe: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          cursor_time: number
          equity?: number
          id?: string
          provider: string
          range_from: number
          range_to: number
          speed?: number
          starting_equity?: number
          status?: string
          symbol: string
          symbol_label?: string | null
          timeframe?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          cursor_time?: number
          equity?: number
          id?: string
          provider?: string
          range_from?: number
          range_to?: number
          speed?: number
          starting_equity?: number
          status?: string
          symbol?: string
          symbol_label?: string | null
          timeframe?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      replay_trades: {
        Row: {
          closed_at: number | null
          created_at: string
          direction: string
          entry_price: number
          exit_price: number | null
          id: string
          lot_size: number | null
          opened_at: number
          pnl: number | null
          result: string | null
          risk_pct: number | null
          rr: number | null
          session_id: string
          stop_loss: number | null
          take_profit: number | null
          user_id: string
        }
        Insert: {
          closed_at?: number | null
          created_at?: string
          direction: string
          entry_price: number
          exit_price?: number | null
          id?: string
          lot_size?: number | null
          opened_at: number
          pnl?: number | null
          result?: string | null
          risk_pct?: number | null
          rr?: number | null
          session_id: string
          stop_loss?: number | null
          take_profit?: number | null
          user_id: string
        }
        Update: {
          closed_at?: number | null
          created_at?: string
          direction?: string
          entry_price?: number
          exit_price?: number | null
          id?: string
          lot_size?: number | null
          opened_at?: number
          pnl?: number | null
          result?: string | null
          risk_pct?: number | null
          rr?: number | null
          session_id?: string
          stop_loss?: number | null
          take_profit?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "replay_trades_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "replay_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_violations: {
        Row: {
          created_at: string
          id: string
          impact_r: number
          occurred_at: string
          session: string | null
          trade_id: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          impact_r?: number
          occurred_at?: string
          session?: string | null
          trade_id: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          impact_r?: number
          occurred_at?: string
          session?: string | null
          trade_id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      session_state: {
        Row: {
          block_reason: string | null
          checklist_confirmed: boolean
          generated_for: string
          trading_allowed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          block_reason?: string | null
          checklist_confirmed?: boolean
          generated_for?: string
          trading_allowed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          block_reason?: string | null
          checklist_confirmed?: boolean
          generated_for?: string
          trading_allowed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      strategies: {
        Row: {
          behavior_rule: string | null
          created_at: string
          entry_rule: string | null
          exit_rule: string | null
          id: string
          is_active: boolean
          name: string
          risk_rule: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          behavior_rule?: string | null
          created_at?: string
          entry_rule?: string | null
          exit_rule?: string | null
          id?: string
          is_active?: boolean
          name: string
          risk_rule?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          behavior_rule?: string | null
          created_at?: string
          entry_rule?: string | null
          exit_rule?: string | null
          id?: string
          is_active?: boolean
          name?: string
          risk_rule?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      strategy_blueprints: {
        Row: {
          account_types: string[]
          ambiguity_flags: Json
          checklist: Json
          created_at: string
          current_step: string
          daily_loss_limit_pct: number | null
          id: string
          locked: boolean
          locked_at: string | null
          max_drawdown_pct: number | null
          name: string
          raw_input: string | null
          refinement_history: Json
          risk_per_trade_pct: number | null
          status: string
          strategy_id: string | null
          structured_rules: Json
          tier_rules: Json
          tier_strictness: Json
          trading_plan: string | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          account_types?: string[]
          ambiguity_flags?: Json
          checklist?: Json
          created_at?: string
          current_step?: string
          daily_loss_limit_pct?: number | null
          id?: string
          locked?: boolean
          locked_at?: string | null
          max_drawdown_pct?: number | null
          name?: string
          raw_input?: string | null
          refinement_history?: Json
          risk_per_trade_pct?: number | null
          status?: string
          strategy_id?: string | null
          structured_rules?: Json
          tier_rules?: Json
          tier_strictness?: Json
          trading_plan?: string | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          account_types?: string[]
          ambiguity_flags?: Json
          checklist?: Json
          created_at?: string
          current_step?: string
          daily_loss_limit_pct?: number | null
          id?: string
          locked?: boolean
          locked_at?: string | null
          max_drawdown_pct?: number | null
          name?: string
          raw_input?: string | null
          refinement_history?: Json
          risk_per_trade_pct?: number | null
          status?: string
          strategy_id?: string | null
          structured_rules?: Json
          tier_rules?: Json
          tier_strictness?: Json
          trading_plan?: string | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "strategy_blueprints_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      trade_annotations: {
        Row: {
          created_at: string
          id: string
          note: string
          rule: string
          trade_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string
          rule: string
          trade_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string
          rule?: string
          trade_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_annotations_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_logs: {
        Row: {
          closed_at: string | null
          confidence_rating: number | null
          created_at: string
          data_quality: string
          direction: string
          emotional_state: string | null
          entry_price: number | null
          exit_price: number | null
          id: string
          market: string
          mistakes: string[]
          note: string | null
          opened_at: string
          outcome: string
          pair: string
          pnl: number | null
          pnl_percent: number | null
          risk_percent: number | null
          rr: number | null
          rules_followed: boolean
          screenshot_url: string | null
          session_tag: string | null
          stop_loss: number | null
          take_profit: number | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          confidence_rating?: number | null
          created_at?: string
          data_quality?: string
          direction: string
          emotional_state?: string | null
          entry_price?: number | null
          exit_price?: number | null
          id?: string
          market: string
          mistakes?: string[]
          note?: string | null
          opened_at: string
          outcome: string
          pair: string
          pnl?: number | null
          pnl_percent?: number | null
          risk_percent?: number | null
          rr?: number | null
          rules_followed?: boolean
          screenshot_url?: string | null
          session_tag?: string | null
          stop_loss?: number | null
          take_profit?: number | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          confidence_rating?: number | null
          created_at?: string
          data_quality?: string
          direction?: string
          emotional_state?: string | null
          entry_price?: number | null
          exit_price?: number | null
          id?: string
          market?: string
          mistakes?: string[]
          note?: string | null
          opened_at?: string
          outcome?: string
          pair?: string
          pnl?: number | null
          pnl_percent?: number | null
          risk_percent?: number | null
          rr?: number | null
          rules_followed?: boolean
          screenshot_url?: string | null
          session_tag?: string | null
          stop_loss?: number | null
          take_profit?: number | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          analysis_id: string | null
          asset: string | null
          broker_deal_id: string | null
          closed_at: string | null
          created_at: string
          direction: Database["public"]["Enums"]["trade_direction"]
          entry_price: number | null
          executed_at: string
          execution_type: Database["public"]["Enums"]["execution_type"] | null
          exit_price: number | null
          id: string
          lot_size: number | null
          market: string
          market_type: Database["public"]["Enums"]["market_type"] | null
          missed_potential_r: number | null
          missed_reason: Database["public"]["Enums"]["missed_reason"] | null
          notes: string | null
          pnl: number | null
          result: Database["public"]["Enums"]["trade_result"] | null
          risk_r: number | null
          rr: number | null
          rules_broken: string[]
          rules_followed: string[]
          screenshot_url: string | null
          session: Database["public"]["Enums"]["trade_session"] | null
          source: Database["public"]["Enums"]["trade_source"]
          stop_loss: number | null
          strategy_id: string | null
          take_profit: number | null
          trade_type: Database["public"]["Enums"]["trade_kind"]
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_id?: string | null
          asset?: string | null
          broker_deal_id?: string | null
          closed_at?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["trade_direction"]
          entry_price?: number | null
          executed_at?: string
          execution_type?: Database["public"]["Enums"]["execution_type"] | null
          exit_price?: number | null
          id?: string
          lot_size?: number | null
          market: string
          market_type?: Database["public"]["Enums"]["market_type"] | null
          missed_potential_r?: number | null
          missed_reason?: Database["public"]["Enums"]["missed_reason"] | null
          notes?: string | null
          pnl?: number | null
          result?: Database["public"]["Enums"]["trade_result"] | null
          risk_r?: number | null
          rr?: number | null
          rules_broken?: string[]
          rules_followed?: string[]
          screenshot_url?: string | null
          session?: Database["public"]["Enums"]["trade_session"] | null
          source?: Database["public"]["Enums"]["trade_source"]
          stop_loss?: number | null
          strategy_id?: string | null
          take_profit?: number | null
          trade_type?: Database["public"]["Enums"]["trade_kind"]
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_id?: string | null
          asset?: string | null
          broker_deal_id?: string | null
          closed_at?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["trade_direction"]
          entry_price?: number | null
          executed_at?: string
          execution_type?: Database["public"]["Enums"]["execution_type"] | null
          exit_price?: number | null
          id?: string
          lot_size?: number | null
          market?: string
          market_type?: Database["public"]["Enums"]["market_type"] | null
          missed_potential_r?: number | null
          missed_reason?: Database["public"]["Enums"]["missed_reason"] | null
          notes?: string | null
          pnl?: number | null
          result?: Database["public"]["Enums"]["trade_result"] | null
          risk_r?: number | null
          rr?: number | null
          rules_broken?: string[]
          rules_followed?: string[]
          screenshot_url?: string | null
          session?: Database["public"]["Enums"]["trade_session"] | null
          source?: Database["public"]["Enums"]["trade_source"]
          stop_loss?: number | null
          strategy_id?: string | null
          take_profit?: number | null
          trade_type?: Database["public"]["Enums"]["trade_kind"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      discipline: {
        Row: {
          clean_trades: number | null
          discipline_score: number | null
          state: string | null
          total_trades: number | null
          user_id: string | null
          violation_count: number | null
        }
        Relationships: []
      }
      drawdown: {
        Row: {
          max_drawdown_r: number | null
          user_id: string | null
        }
        Relationships: []
      }
      expectancy: {
        Row: {
          expectancy_r: number | null
          user_id: string | null
        }
        Relationships: []
      }
      metrics: {
        Row: {
          avg_r: number | null
          breakevens: number | null
          losses: number | null
          profit_factor: number | null
          total_r: number | null
          total_trades: number | null
          user_id: string | null
          win_rate: number | null
          wins: number | null
        }
        Relationships: []
      }
      recent_decisions: {
        Row: {
          analysis_id: string | null
          created_at: string | null
          id: string | null
          score_delta: number | null
          source: string | null
          trade_id: string | null
          user_id: string | null
          verdict: string | null
          violations: Json | null
        }
        Relationships: []
      }
      rule_adherence: {
        Row: {
          adherence: number | null
          clean_trades: number | null
          total_logs: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      compute_identity_label: { Args: { streak: number }; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      detect_behavior_patterns: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      hard_reset_all_users: { Args: never; Returns: undefined }
      is_trade_unlocked: { Args: { p_user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      behavior_pattern_kind:
        | "emotional_repetition"
        | "consecutive_losses_after_break"
        | "undisciplined_streak"
        | "rule_breaking"
        | "revenge"
        | "overtrading"
      emotional_state:
        | "frustrated"
        | "fearful"
        | "overconfident"
        | "neutral"
        | "confused"
        | "calm"
      execution_type: "controlled" | "emotional"
      market_type: "forex" | "synthetic" | "crypto"
      missed_reason:
        | "hesitation"
        | "fear"
        | "lack_of_confidence"
        | "distraction"
      mistake_tag:
        | "fomo"
        | "revenge"
        | "overleveraged"
        | "early_exit"
        | "late_entry"
        | "no_setup"
        | "emotional"
      subscription_tier: "free" | "pro" | "premium"
      trade_direction: "long" | "short"
      trade_kind: "executed" | "missed"
      trade_result: "win" | "loss" | "breakeven"
      trade_session: "London" | "NY" | "Asia"
      trade_source: "manual" | "deriv" | "mt5"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      behavior_pattern_kind: [
        "emotional_repetition",
        "consecutive_losses_after_break",
        "undisciplined_streak",
        "rule_breaking",
        "revenge",
        "overtrading",
      ],
      emotional_state: [
        "frustrated",
        "fearful",
        "overconfident",
        "neutral",
        "confused",
        "calm",
      ],
      execution_type: ["controlled", "emotional"],
      market_type: ["forex", "synthetic", "crypto"],
      missed_reason: [
        "hesitation",
        "fear",
        "lack_of_confidence",
        "distraction",
      ],
      mistake_tag: [
        "fomo",
        "revenge",
        "overleveraged",
        "early_exit",
        "late_entry",
        "no_setup",
        "emotional",
      ],
      subscription_tier: ["free", "pro", "premium"],
      trade_direction: ["long", "short"],
      trade_kind: ["executed", "missed"],
      trade_result: ["win", "loss", "breakeven"],
      trade_session: ["London", "NY", "Asia"],
      trade_source: ["manual", "deriv", "mt5"],
    },
  },
} as const
