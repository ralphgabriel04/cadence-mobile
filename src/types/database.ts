// ============================================================================
// GENERATED FILE -- do not edit by hand.
//
// Regenerate with:  pnpm gen:types    (needs Docker)
//
// Derived from supabase/migrations/*.sql applied to a disposable PostgreSQL
// container, so these types describe what the migrations produce rather than
// what any particular Supabase project currently holds. See ADR-004.
// ============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      coach_athletes: {
        Row: {
          id: string;
          coach_id: string;
          athlete_id: string;
          status: Database["public"]["Enums"]["relationship_status"];
          invited_at: string | null;
          accepted_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          is_deleted: boolean;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          coach_id: string;
          athlete_id: string;
          status?: Database["public"]["Enums"]["relationship_status"];
          invited_at?: string | null;
          accepted_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          coach_id?: string;
          athlete_id?: string;
          status?: Database["public"]["Enums"]["relationship_status"];
          invited_at?: string | null;
          accepted_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "coach_athletes_athlete_id_fkey";
            columns: ["athlete_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coach_athletes_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      coach_notes: {
        Row: {
          id: string;
          coach_id: string;
          athlete_id: string;
          session_log_id: string | null;
          content: string;
          is_private: boolean | null;
          created_at: string;
          updated_at: string;
          is_deleted: boolean;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          coach_id: string;
          athlete_id: string;
          session_log_id?: string | null;
          content: string;
          is_private?: boolean | null;
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          coach_id?: string;
          athlete_id?: string;
          session_log_id?: string | null;
          content?: string;
          is_private?: boolean | null;
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "coach_notes_athlete_id_fkey";
            columns: ["athlete_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coach_notes_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coach_notes_session_log_id_fkey";
            columns: ["session_log_id"];
            isOneToOne: false;
            referencedRelation: "session_logs";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          id: string;
          coach_id: string;
          athlete_id: string;
          last_message_at: string | null;
          created_at: string;
          updated_at: string;
          is_deleted: boolean;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          coach_id: string;
          athlete_id: string;
          last_message_at?: string | null;
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          coach_id?: string;
          athlete_id?: string;
          last_message_at?: string | null;
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_athlete_id_fkey";
            columns: ["athlete_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      exercise_logs: {
        Row: {
          id: string;
          session_log_id: string;
          exercise_id: string;
          session_exercise_id: string | null;
          set_number: number;
          reps_completed: number | null;
          weight_kg: number | null;
          rpe: number | null;
          duration_seconds: number | null;
          distance_meters: number | null;
          is_pr: boolean | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          is_deleted: boolean;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          session_log_id: string;
          exercise_id: string;
          session_exercise_id?: string | null;
          set_number: number;
          reps_completed?: number | null;
          weight_kg?: number | null;
          rpe?: number | null;
          duration_seconds?: number | null;
          distance_meters?: number | null;
          is_pr?: boolean | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          session_log_id?: string;
          exercise_id?: string;
          session_exercise_id?: string | null;
          set_number?: number;
          reps_completed?: number | null;
          weight_kg?: number | null;
          rpe?: number | null;
          duration_seconds?: number | null;
          distance_meters?: number | null;
          is_pr?: boolean | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "exercise_logs_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exercise_logs_session_exercise_id_fkey";
            columns: ["session_exercise_id"];
            isOneToOne: false;
            referencedRelation: "session_exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exercise_logs_session_log_id_fkey";
            columns: ["session_log_id"];
            isOneToOne: false;
            referencedRelation: "session_logs";
            referencedColumns: ["id"];
          },
        ];
      };
      exercises: {
        Row: {
          id: string;
          coach_id: string | null;
          name: string;
          description: string | null;
          category: Database["public"]["Enums"]["exercise_category"];
          equipment: string | null;
          muscle_groups: string[] | null;
          video_url: string | null;
          instructions: string | null;
          created_at: string;
          updated_at: string;
          is_deleted: boolean;
          deleted_at: string | null;
          created_by: string | null;
          is_public: boolean;
        };
        Insert: {
          id?: string;
          coach_id?: string | null;
          name: string;
          description?: string | null;
          category?: Database["public"]["Enums"]["exercise_category"];
          equipment?: string | null;
          muscle_groups?: string[] | null;
          video_url?: string | null;
          instructions?: string | null;
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
          created_by?: string | null;
          is_public?: boolean;
        };
        Update: {
          id?: string;
          coach_id?: string | null;
          name?: string;
          description?: string | null;
          category?: Database["public"]["Enums"]["exercise_category"];
          equipment?: string | null;
          muscle_groups?: string[] | null;
          video_url?: string | null;
          instructions?: string | null;
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
          created_by?: string | null;
          is_public?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "exercises_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exercises_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          message_type: Database["public"]["Enums"]["message_type"];
          related_session_log_id: string | null;
          read_at: string | null;
          created_at: string;
          updated_at: string;
          is_deleted: boolean;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          message_type?: Database["public"]["Enums"]["message_type"];
          related_session_log_id?: string | null;
          read_at?: string | null;
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string;
          content?: string;
          message_type?: Database["public"]["Enums"]["message_type"];
          related_session_log_id?: string | null;
          read_at?: string | null;
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_related_session_log_id_fkey";
            columns: ["related_session_log_id"];
            isOneToOne: false;
            referencedRelation: "session_logs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          role: Database["public"]["Enums"]["user_role"];
          avatar_url: string | null;
          phone: string | null;
          bio: string | null;
          timezone: string | null;
          preferred_language: string | null;
          onboarding_completed: boolean | null;
          last_active_at: string | null;
          created_at: string;
          updated_at: string;
          is_deleted: boolean;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          email: string;
          first_name?: string;
          last_name?: string;
          role?: Database["public"]["Enums"]["user_role"];
          avatar_url?: string | null;
          phone?: string | null;
          bio?: string | null;
          timezone?: string | null;
          preferred_language?: string | null;
          onboarding_completed?: boolean | null;
          last_active_at?: string | null;
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          first_name?: string;
          last_name?: string;
          role?: Database["public"]["Enums"]["user_role"];
          avatar_url?: string | null;
          phone?: string | null;
          bio?: string | null;
          timezone?: string | null;
          preferred_language?: string | null;
          onboarding_completed?: boolean | null;
          last_active_at?: string | null;
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      program_assignments: {
        Row: {
          id: string;
          program_id: string;
          athlete_id: string;
          coach_id: string | null;
          start_date: string | null;
          end_date: string | null;
          status: Database["public"]["Enums"]["assignment_status"];
          created_at: string;
          updated_at: string;
          is_deleted: boolean;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          program_id: string;
          athlete_id: string;
          coach_id?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          status?: Database["public"]["Enums"]["assignment_status"];
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          program_id?: string;
          athlete_id?: string;
          coach_id?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          status?: Database["public"]["Enums"]["assignment_status"];
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "program_assignments_athlete_id_fkey";
            columns: ["athlete_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "program_assignments_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "program_assignments_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "programs";
            referencedColumns: ["id"];
          },
        ];
      };
      programs: {
        Row: {
          id: string;
          coach_id: string | null;
          name: string;
          description: string | null;
          duration_weeks: number | null;
          goal: string | null;
          difficulty: Database["public"]["Enums"]["difficulty_level"] | null;
          status: Database["public"]["Enums"]["program_status"];
          is_template: boolean | null;
          created_at: string;
          updated_at: string;
          is_deleted: boolean;
          deleted_at: string | null;
          created_by: string | null;
          is_public: boolean;
        };
        Insert: {
          id?: string;
          coach_id?: string | null;
          name: string;
          description?: string | null;
          duration_weeks?: number | null;
          goal?: string | null;
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null;
          status?: Database["public"]["Enums"]["program_status"];
          is_template?: boolean | null;
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
          created_by?: string | null;
          is_public?: boolean;
        };
        Update: {
          id?: string;
          coach_id?: string | null;
          name?: string;
          description?: string | null;
          duration_weeks?: number | null;
          goal?: string | null;
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null;
          status?: Database["public"]["Enums"]["program_status"];
          is_template?: boolean | null;
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
          created_by?: string | null;
          is_public?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "programs_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "programs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      readiness_logs: {
        Row: {
          id: string;
          athlete_id: string;
          log_date: string;
          sleep_quality: number | null;
          energy_level: number | null;
          muscle_soreness: number | null;
          stress_level: number | null;
          motivation: number | null;
          overall_readiness: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          is_deleted: boolean;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          athlete_id: string;
          log_date?: string;
          sleep_quality?: number | null;
          energy_level?: number | null;
          muscle_soreness?: number | null;
          stress_level?: number | null;
          motivation?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          athlete_id?: string;
          log_date?: string;
          sleep_quality?: number | null;
          energy_level?: number | null;
          muscle_soreness?: number | null;
          stress_level?: number | null;
          motivation?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "readiness_logs_athlete_id_fkey";
            columns: ["athlete_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      session_exercises: {
        Row: {
          id: string;
          session_id: string;
          exercise_id: string;
          order_index: number;
          sets: number | null;
          reps: string | null;
          weight_suggestion: string | null;
          rest_seconds: number | null;
          tempo: string | null;
          notes: string | null;
          superset_group: number | null;
          created_at: string;
          updated_at: string;
          is_deleted: boolean;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          exercise_id: string;
          order_index?: number;
          sets?: number | null;
          reps?: string | null;
          weight_suggestion?: string | null;
          rest_seconds?: number | null;
          tempo?: string | null;
          notes?: string | null;
          superset_group?: number | null;
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          session_id?: string;
          exercise_id?: string;
          order_index?: number;
          sets?: number | null;
          reps?: string | null;
          weight_suggestion?: string | null;
          rest_seconds?: number | null;
          tempo?: string | null;
          notes?: string | null;
          superset_group?: number | null;
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "session_exercises_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_exercises_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      session_images: {
        Row: {
          id: string;
          session_log_id: string;
          athlete_id: string;
          image_url: string;
          caption: string | null;
          created_at: string;
          updated_at: string;
          is_deleted: boolean;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          session_log_id: string;
          athlete_id: string;
          image_url: string;
          caption?: string | null;
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          session_log_id?: string;
          athlete_id?: string;
          image_url?: string;
          caption?: string | null;
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "session_images_athlete_id_fkey";
            columns: ["athlete_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_images_session_log_id_fkey";
            columns: ["session_log_id"];
            isOneToOne: false;
            referencedRelation: "session_logs";
            referencedColumns: ["id"];
          },
        ];
      };
      session_logs: {
        Row: {
          id: string;
          session_id: string;
          athlete_id: string;
          program_assignment_id: string | null;
          started_at: string | null;
          completed_at: string | null;
          duration_minutes: number | null;
          overall_rpe: number | null;
          notes: string | null;
          status: Database["public"]["Enums"]["session_log_status"];
          created_at: string;
          updated_at: string;
          is_deleted: boolean;
          deleted_at: string | null;
          paused_at: string | null;
          total_paused_seconds: number;
        };
        Insert: {
          id?: string;
          session_id: string;
          athlete_id: string;
          program_assignment_id?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          duration_minutes?: number | null;
          overall_rpe?: number | null;
          notes?: string | null;
          status?: Database["public"]["Enums"]["session_log_status"];
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
          paused_at?: string | null;
          total_paused_seconds?: number;
        };
        Update: {
          id?: string;
          session_id?: string;
          athlete_id?: string;
          program_assignment_id?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          duration_minutes?: number | null;
          overall_rpe?: number | null;
          notes?: string | null;
          status?: Database["public"]["Enums"]["session_log_status"];
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
          paused_at?: string | null;
          total_paused_seconds?: number;
        };
        Relationships: [
          {
            foreignKeyName: "session_logs_athlete_id_fkey";
            columns: ["athlete_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_logs_program_assignment_id_fkey";
            columns: ["program_assignment_id"];
            isOneToOne: false;
            referencedRelation: "program_assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_logs_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      sessions: {
        Row: {
          id: string;
          program_id: string;
          name: string;
          description: string | null;
          day_of_week: number | null;
          week_number: number | null;
          order_index: number;
          estimated_duration_minutes: number | null;
          created_at: string;
          updated_at: string;
          is_deleted: boolean;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          program_id: string;
          name: string;
          description?: string | null;
          day_of_week?: number | null;
          week_number?: number | null;
          order_index?: number;
          estimated_duration_minutes?: number | null;
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          program_id?: string;
          name?: string;
          description?: string | null;
          day_of_week?: number | null;
          week_number?: number | null;
          order_index?: number;
          estimated_duration_minutes?: number | null;
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sessions_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "programs";
            referencedColumns: ["id"];
          },
        ];
      };
      waitlist_subscribers: {
        Row: {
          id: string;
          email: string;
          source: string | null;
          referral_code: string | null;
          created_at: string;
          confirmed: boolean | null;
        };
        Insert: {
          id?: string;
          email: string;
          source?: string | null;
          referral_code?: string | null;
          created_at?: string;
          confirmed?: boolean | null;
        };
        Update: {
          id?: string;
          email?: string;
          source?: string | null;
          referral_code?: string | null;
          created_at?: string;
          confirmed?: boolean | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_exercise_history: {
        Args: { p_exercise_id: string; p_limit?: number };
        Returns: {
          session_log_id: string;
          performed_at: string;
          session_name: string;
          set_count: number;
          total_reps: number;
          max_weight_kg: number | null;
          total_volume_kg: number;
          avg_rpe: number | null;
          had_pr: boolean | null;
        }[];
      };
      get_last_exercise_performance: {
        Args: { p_exercise_id: string };
        Returns: {
          log_id: string;
          session_log_id: string;
          performed_at: string;
          set_number: number;
          reps_completed: number | null;
          weight_kg: number | null;
          rpe: number | null;
          duration_seconds: number | null;
          distance_meters: number | null;
          is_pr: boolean | null;
        }[];
      };
      get_personal_records: {
        Args: Record<string, never>;
        Returns: {
          exercise_id: string;
          exercise_name: string;
          weight_kg: number | null;
          reps_completed: number | null;
          achieved_at: string | null;
        }[];
      };
      get_today_screen: {
        Args: { p_on_date: string };
        Returns: Json;
      };
      get_waitlist_count: {
        Args: Record<string, never>;
        Returns: number;
      };
      program_week_number: {
        Args: { p_start_date: string; p_on_date: string };
        Returns: number | null;
      };
    };
    Enums: {
      assignment_status: "active" | "completed" | "paused";
      difficulty_level: "beginner" | "intermediate" | "advanced";
      exercise_category: "strength" | "cardio" | "flexibility" | "mobility" | "plyometrics" | "other";
      message_type: "text" | "image" | "session_log";
      program_status: "draft" | "active" | "archived";
      relationship_status: "pending" | "active" | "inactive";
      session_log_status: "in_progress" | "completed" | "skipped";
      user_role: "coach" | "athlete";
    };
    CompositeTypes: Record<string, never>;
  };
};

// ── Convenience aliases ─────────────────────────────────────────────────────

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
export type FunctionReturns<T extends keyof Database["public"]["Functions"]> =
  Database["public"]["Functions"][T]["Returns"];
