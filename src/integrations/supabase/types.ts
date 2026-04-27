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
          notes: string | null
          trade_id: string | null
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
          notes?: string | null
          trade_id?: string | null
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
          notes?: string | null
          trade_id?: string | null
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
      profiles: {
        Row: {
          challenge: string | null
          created_at: string
          experience: string | null
          goal: string | null
          id: string
          market: string | null
          onboarded_at: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          challenge?: string | null
          created_at?: string
          experience?: string | null
          goal?: string | null
          id: string
          market?: string | null
          onboarded_at?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          challenge?: string | null
          created_at?: string
          experience?: string | null
          goal?: string | null
          id?: string
          market?: string | null
          onboarded_at?: string | null
          updated_at?: string
          username?: string | null
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
      trades: {
        Row: {
          closed_at: string | null
          created_at: string
          direction: Database["public"]["Enums"]["trade_direction"]
          entry_price: number | null
          executed_at: string
          id: string
          market: string
          result: Database["public"]["Enums"]["trade_result"] | null
          rr: number | null
          stop_loss: number | null
          strategy_id: string | null
          take_profit: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["trade_direction"]
          entry_price?: number | null
          executed_at?: string
          id?: string
          market: string
          result?: Database["public"]["Enums"]["trade_result"] | null
          rr?: number | null
          stop_loss?: number | null
          strategy_id?: string | null
          take_profit?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["trade_direction"]
          entry_price?: number | null
          executed_at?: string
          id?: string
          market?: string
          result?: Database["public"]["Enums"]["trade_result"] | null
          rr?: number | null
          stop_loss?: number | null
          strategy_id?: string | null
          take_profit?: number | null
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
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      emotional_state:
        | "frustrated"
        | "fearful"
        | "overconfident"
        | "neutral"
        | "confused"
      trade_direction: "long" | "short"
      trade_result: "win" | "loss" | "breakeven"
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
      emotional_state: [
        "frustrated",
        "fearful",
        "overconfident",
        "neutral",
        "confused",
      ],
      trade_direction: ["long", "short"],
      trade_result: ["win", "loss", "breakeven"],
    },
  },
} as const
