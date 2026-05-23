// Auto-generated via `supabase gen types typescript`.
// Regenerer apres chaque migration impactant le schema public :
//   npx supabase gen types typescript --project-id <ref> --schema public \
//     > src/lib/database.types.ts
// NE PAS editer manuellement.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '13.0.5';
  };
  public: {
    Tables: {
      activities: {
        Row: {
          activity_url: string | null;
          archived: boolean;
          category: string | null;
          created_at: string;
          date_end: string | null;
          date_label: string | null;
          date_label_en: string | null;
          date_start: string | null;
          description: string | null;
          description_en: string | null;
          duration_minutes: number;
          favorites_count: number;
          features: string[] | null;
          id: number;
          image_url: string | null;
          image_urls: string[] | null;
          is_indoor: boolean;
          is_outdoor: boolean | null;
          is_whateka_certified: boolean;
          last_updated_at: string | null;
          latitude: number;
          location_name: string;
          location_zone: string | null;
          longitude: number;
          next_update_at: string | null;
          opening_hours: Json | null;
          parent_institution_id: number | null;
          price_level: number | null;
          recurrence_type: string | null;
          seasonal_months: number[] | null;
          seasons: string[] | null;
          social_tags: string[] | null;
          title: string;
          title_en: string | null;
          update_frequency: string | null;
          update_notes: string | null;
          update_notes_en: string | null;
          weather_compatible: string[] | null;
          weekly_days: number[] | null;
        };
        Insert: {
          activity_url?: string | null;
          archived?: boolean;
          category?: string | null;
          created_at?: string;
          date_end?: string | null;
          date_label?: string | null;
          date_label_en?: string | null;
          date_start?: string | null;
          description?: string | null;
          description_en?: string | null;
          duration_minutes: number;
          favorites_count?: number;
          features?: string[] | null;
          id?: number;
          image_url?: string | null;
          image_urls?: string[] | null;
          is_indoor?: boolean;
          is_outdoor?: boolean | null;
          is_whateka_certified?: boolean;
          last_updated_at?: string | null;
          latitude: number;
          location_name: string;
          location_zone?: string | null;
          longitude: number;
          next_update_at?: string | null;
          opening_hours?: Json | null;
          parent_institution_id?: number | null;
          price_level?: number | null;
          recurrence_type?: string | null;
          seasonal_months?: number[] | null;
          seasons?: string[] | null;
          social_tags?: string[] | null;
          title: string;
          title_en?: string | null;
          update_frequency?: string | null;
          update_notes?: string | null;
          update_notes_en?: string | null;
          weather_compatible?: string[] | null;
          weekly_days?: number[] | null;
        };
        Update: Partial<Database['public']['Tables']['activities']['Insert']>;
        Relationships: [];
      };
      activity_submissions: {
        Row: {
          activity_url: string | null;
          admin_notes: string | null;
          archived: boolean;
          category: string | null;
          created_at: string;
          date_end: string | null;
          date_label: string | null;
          date_label_en: string | null;
          date_start: string | null;
          description: string | null;
          description_en: string | null;
          duration_minutes: number | null;
          features: string[] | null;
          id: number;
          image_url: string | null;
          image_urls: string[] | null;
          is_indoor: boolean;
          is_outdoor: boolean | null;
          is_whateka_certified: boolean;
          last_updated_at: string | null;
          latitude: number | null;
          location_name: string;
          location_zone: string | null;
          longitude: number | null;
          next_update_at: string | null;
          parent_institution_id: number | null;
          price_level: number | null;
          recurrence_type: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          seasonal_months: number[] | null;
          seasons: string[] | null;
          social_tags: string[] | null;
          status: string;
          submitted_by: string | null;
          title: string;
          title_en: string | null;
          update_frequency: string | null;
          update_notes: string | null;
          update_notes_en: string | null;
          weekly_days: number[] | null;
        };
        Insert: {
          activity_url?: string | null;
          admin_notes?: string | null;
          archived?: boolean;
          category?: string | null;
          created_at?: string;
          date_end?: string | null;
          date_label?: string | null;
          date_label_en?: string | null;
          date_start?: string | null;
          description?: string | null;
          description_en?: string | null;
          duration_minutes?: number | null;
          features?: string[] | null;
          id?: number;
          image_url?: string | null;
          image_urls?: string[] | null;
          is_indoor?: boolean;
          is_outdoor?: boolean | null;
          is_whateka_certified?: boolean;
          last_updated_at?: string | null;
          latitude?: number | null;
          location_name: string;
          location_zone?: string | null;
          longitude?: number | null;
          next_update_at?: string | null;
          parent_institution_id?: number | null;
          price_level?: number | null;
          recurrence_type?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          seasonal_months?: number[] | null;
          seasons?: string[] | null;
          social_tags?: string[] | null;
          status?: string;
          submitted_by?: string | null;
          title: string;
          title_en?: string | null;
          update_frequency?: string | null;
          update_notes?: string | null;
          update_notes_en?: string | null;
          weekly_days?: number[] | null;
        };
        Update: Partial<Database['public']['Tables']['activity_submissions']['Insert']>;
        Relationships: [];
      };
      admin_users: {
        Row: { created_at: string; email: string; id: string; name: string | null; role: string };
        Insert: { created_at?: string; email: string; id?: string; name?: string | null; role?: string };
        Update: Partial<Database['public']['Tables']['admin_users']['Insert']>;
        Relationships: [];
      };
      app_access: {
        Row: { email: string; granted_at: string; granted_by: string | null; note: string | null };
        Insert: {
          email: string;
          granted_at?: string;
          granted_by?: string | null;
          note?: string | null;
        };
        Update: Partial<Database['public']['Tables']['app_access']['Insert']>;
        Relationships: [];
      };
      favorites: {
        Row: { activity_id: number; created_at: string; id: number; user_id: string };
        Insert: { activity_id: number; created_at?: string; id?: never; user_id: string };
        Update: Partial<Database['public']['Tables']['favorites']['Insert']>;
        Relationships: [];
      };
      feedback_answers: {
        Row: {
          answer_bool: boolean | null;
          answer_choice: string | null;
          answer_rating: number | null;
          answer_text: string | null;
          created_at: string;
          id: string;
          question_format_snapshot: string;
          question_id: string;
          question_text_snapshot: string;
          submission_id: string;
        };
        Insert: {
          answer_bool?: boolean | null;
          answer_choice?: string | null;
          answer_rating?: number | null;
          answer_text?: string | null;
          created_at?: string;
          id?: string;
          question_format_snapshot: string;
          question_id: string;
          question_text_snapshot: string;
          submission_id: string;
        };
        Update: Partial<Database['public']['Tables']['feedback_answers']['Insert']>;
        Relationships: [];
      };
      feedback_cold: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      feedback_hot: {
        Row: {
          activity_id: number;
          comments: string | null;
          created_at: string | null;
          discovered_new_activities: boolean | null;
          id: number;
          information_level_satisfaction: number | null;
          personalization_satisfaction: number | null;
          recommendation_satisfaction: number | null;
          searches_count: number | null;
          user_id: string | null;
        };
        Insert: Partial<Database['public']['Tables']['feedback_hot']['Row']> & {
          activity_id: number;
        };
        Update: Partial<Database['public']['Tables']['feedback_hot']['Row']>;
        Relationships: [];
      };
      feedback_questions: {
        Row: {
          answer_format: string;
          choices: Json | null;
          created_at: string;
          id: string;
          is_active: boolean;
          is_required: boolean;
          order_index: number;
          questionnaire_type: string;
          text: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['feedback_questions']['Row']> & {
          answer_format: string;
          questionnaire_type: string;
          text: string;
        };
        Update: Partial<Database['public']['Tables']['feedback_questions']['Row']>;
        Relationships: [];
      };
      feedback_submissions: {
        Row: {
          activity_id: number | null;
          id: string;
          questionnaire_type: string;
          searches_count: number | null;
          submitted_at: string;
          user_id: string | null;
        };
        Insert: Partial<Database['public']['Tables']['feedback_submissions']['Row']> & {
          questionnaire_type: string;
        };
        Update: Partial<Database['public']['Tables']['feedback_submissions']['Row']>;
        Relationships: [];
      };
      promo_codes: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          description: string | null;
          duration_months: number;
          expires_at: string | null;
          max_redemptions: number | null;
          redemption_count: number;
          tier: string;
        };
        Insert: Partial<Database['public']['Tables']['promo_codes']['Row']> & {
          code: string;
        };
        Update: Partial<Database['public']['Tables']['promo_codes']['Row']>;
        Relationships: [];
      };
      promo_redemptions: {
        Row: { code: string; redeemed_at: string; user_id: string };
        Insert: { code: string; redeemed_at?: string; user_id: string };
        Update: Partial<Database['public']['Tables']['promo_redemptions']['Insert']>;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          apple_transaction_id: string | null;
          canceled_at: string | null;
          created_at: string;
          expires_at: string | null;
          free_period_started_at: string;
          free_quizzes_used: number;
          last_region_change: string | null;
          promo_code: string | null;
          selected_region: string | null;
          source: string | null;
          status: string;
          stripe_subscription_id: string | null;
          tier: string;
          trial_ends_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: Partial<Database['public']['Tables']['subscriptions']['Row']> & {
          user_id: string;
        };
        Update: Partial<Database['public']['Tables']['subscriptions']['Row']>;
        Relationships: [];
      };
      user_taste_profiles: {
        Row: {
          avg_price_level: number | null;
          disliked_categories: string[];
          indoor_outdoor_pref: string | null;
          popular_social_tags: string[];
          top_categories: Json;
          total_signals: number;
          unanswered_quiz_count: number;
          updated_at: string;
          user_id: string;
        };
        Insert: Partial<Database['public']['Tables']['user_taste_profiles']['Row']> & {
          user_id: string;
        };
        Update: Partial<Database['public']['Tables']['user_taste_profiles']['Row']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, unknown>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
