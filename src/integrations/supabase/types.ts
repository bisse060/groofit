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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_progress_reports: {
        Row: {
          created_at: string
          id: string
          input_type: string | null
          measurement_ids: string[]
          report_text: string
          summary_title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          input_type?: string | null
          measurement_ids: string[]
          report_text: string
          summary_title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          input_type?: string | null
          measurement_ids?: string[]
          report_text?: string
          summary_title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_logs: {
        Row: {
          body_fat_percentage: number | null
          calorie_burn: number | null
          calorie_intake: number | null
          created_at: string | null
          id: string
          log_date: string
          notes: string | null
          steps: number | null
          synced_from_fitbit: boolean | null
          tags: string[] | null
          updated_at: string | null
          user_id: string
          weight: number | null
          workout_completed: boolean | null
        }
        Insert: {
          body_fat_percentage?: number | null
          calorie_burn?: number | null
          calorie_intake?: number | null
          created_at?: string | null
          id?: string
          log_date: string
          notes?: string | null
          steps?: number | null
          synced_from_fitbit?: boolean | null
          tags?: string[] | null
          updated_at?: string | null
          user_id: string
          weight?: number | null
          workout_completed?: boolean | null
        }
        Update: {
          body_fat_percentage?: number | null
          calorie_burn?: number | null
          calorie_intake?: number | null
          created_at?: string | null
          id?: string
          log_date?: string
          notes?: string | null
          steps?: number | null
          synced_from_fitbit?: boolean | null
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string
          weight?: number | null
          workout_completed?: boolean | null
        }
        Relationships: []
      }
      exercises: {
        Row: {
          body_part: string | null
          created_at: string | null
          id: string
          is_favorite: boolean | null
          name: string
          user_id: string
        }
        Insert: {
          body_part?: string | null
          created_at?: string | null
          id?: string
          is_favorite?: boolean | null
          name: string
          user_id: string
        }
        Update: {
          body_part?: string | null
          created_at?: string | null
          id?: string
          is_favorite?: boolean | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      fitbit_sync_logs: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          status: string
          sync_date: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          status: string
          sync_date: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          status?: string
          sync_date?: string
          user_id?: string
        }
        Relationships: []
      }
      fitbit_sync_progress: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_day_offset: number | null
          days_synced: number | null
          error_message: string | null
          id: string
          last_sync_at: string | null
          started_at: string | null
          status: string | null
          total_days: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_day_offset?: number | null
          days_synced?: number | null
          error_message?: string | null
          id?: string
          last_sync_at?: string | null
          started_at?: string | null
          status?: string | null
          total_days: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_day_offset?: number | null
          days_synced?: number | null
          error_message?: string | null
          id?: string
          last_sync_at?: string | null
          started_at?: string | null
          status?: string | null
          total_days?: number
          user_id?: string
        }
        Relationships: []
      }
      measurements: {
        Row: {
          bicep_left_cm: number | null
          bicep_right_cm: number | null
          chest_cm: number | null
          created_at: string | null
          hips_cm: number | null
          id: string
          measurement_date: string
          notes: string | null
          updated_at: string | null
          user_id: string
          waist_cm: number | null
          weight: number | null
        }
        Insert: {
          bicep_left_cm?: number | null
          bicep_right_cm?: number | null
          chest_cm?: number | null
          created_at?: string | null
          hips_cm?: number | null
          id?: string
          measurement_date: string
          notes?: string | null
          updated_at?: string | null
          user_id: string
          waist_cm?: number | null
          weight?: number | null
        }
        Update: {
          bicep_left_cm?: number | null
          bicep_right_cm?: number | null
          chest_cm?: number | null
          created_at?: string | null
          hips_cm?: number | null
          id?: string
          measurement_date?: string
          notes?: string | null
          updated_at?: string | null
          user_id?: string
          waist_cm?: number | null
          weight?: number | null
        }
        Relationships: []
      }
      oauth_states: {
        Row: {
          created_at: string | null
          id: string
          provider: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          provider: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          provider?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          current_weight: number | null
          fitbit_access_token: string | null
          fitbit_connected_at: string | null
          fitbit_last_sync_at: string | null
          fitbit_refresh_token: string | null
          fitbit_scope: string | null
          fitbit_token_expires_at: string | null
          fitbit_user_id: string | null
          full_name: string
          goals: string | null
          height_cm: number | null
          id: string
          instagram_username: string | null
          target_weight: number | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          current_weight?: number | null
          fitbit_access_token?: string | null
          fitbit_connected_at?: string | null
          fitbit_last_sync_at?: string | null
          fitbit_refresh_token?: string | null
          fitbit_scope?: string | null
          fitbit_token_expires_at?: string | null
          fitbit_user_id?: string | null
          full_name: string
          goals?: string | null
          height_cm?: number | null
          id: string
          instagram_username?: string | null
          target_weight?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          current_weight?: number | null
          fitbit_access_token?: string | null
          fitbit_connected_at?: string | null
          fitbit_last_sync_at?: string | null
          fitbit_refresh_token?: string | null
          fitbit_scope?: string | null
          fitbit_token_expires_at?: string | null
          fitbit_user_id?: string | null
          full_name?: string
          goals?: string | null
          height_cm?: number | null
          id?: string
          instagram_username?: string | null
          target_weight?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      progress_photos: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          measurement_id: string
          photo_date: string
          photo_type: string
          photo_url: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          measurement_id: string
          photo_date: string
          photo_type: string
          photo_url: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          measurement_id?: string
          photo_date?: string
          photo_type?: string
          photo_url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_photos_measurement_id_fkey"
            columns: ["measurement_id"]
            isOneToOne: false
            referencedRelation: "measurements"
            referencedColumns: ["id"]
          },
        ]
      }
      sleep_logs: {
        Row: {
          created_at: string | null
          date: string
          deep_minutes: number | null
          duration_minutes: number | null
          efficiency: number | null
          end_time: string | null
          id: string
          light_minutes: number | null
          raw: Json | null
          rem_minutes: number | null
          score: number | null
          start_time: string | null
          user_id: string
          wake_minutes: number | null
        }
        Insert: {
          created_at?: string | null
          date: string
          deep_minutes?: number | null
          duration_minutes?: number | null
          efficiency?: number | null
          end_time?: string | null
          id?: string
          light_minutes?: number | null
          raw?: Json | null
          rem_minutes?: number | null
          score?: number | null
          start_time?: string | null
          user_id: string
          wake_minutes?: number | null
        }
        Update: {
          created_at?: string | null
          date?: string
          deep_minutes?: number | null
          duration_minutes?: number | null
          efficiency?: number | null
          end_time?: string | null
          id?: string
          light_minutes?: number | null
          raw?: Json | null
          rem_minutes?: number | null
          score?: number | null
          start_time?: string | null
          user_id?: string
          wake_minutes?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workout_exercises: {
        Row: {
          created_at: string | null
          exercise_id: string
          id: string
          notes: string | null
          order_index: number
          workout_id: string
        }
        Insert: {
          created_at?: string | null
          exercise_id: string
          id?: string
          notes?: string | null
          order_index?: number
          workout_id: string
        }
        Update: {
          created_at?: string | null
          exercise_id?: string
          id?: string
          notes?: string | null
          order_index?: number
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sets: {
        Row: {
          completed: boolean | null
          created_at: string | null
          id: string
          is_warmup: boolean | null
          reps: number | null
          rir: number | null
          set_number: number
          weight: number | null
          workout_exercise_id: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          is_warmup?: boolean | null
          reps?: number | null
          rir?: number | null
          set_number: number
          weight?: number | null
          workout_exercise_id: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          is_warmup?: boolean | null
          reps?: number | null
          rir?: number | null
          set_number?: number
          weight?: number | null
          workout_exercise_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sets_workout_exercise_id_fkey"
            columns: ["workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          created_at: string | null
          date: string
          end_time: string | null
          id: string
          notes: string | null
          start_time: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date?: string
          end_time?: string | null
          id?: string
          notes?: string | null
          start_time?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          end_time?: string | null
          id?: string
          notes?: string | null
          start_time?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: { user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
