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
      accounting: {
        Row: {
          activity_id: string | null
          association_share: number
          created_at: string
          event_id: string | null
          gross_revenue: number
          id: string
          label: string | null
          professional_id: string | null
          professional_share: number
          recorded_on: string
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          association_share?: number
          created_at?: string
          event_id?: string | null
          gross_revenue?: number
          id?: string
          label?: string | null
          professional_id?: string | null
          professional_share?: number
          recorded_on?: string
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          association_share?: number
          created_at?: string
          event_id?: string | null
          gross_revenue?: number
          id?: string
          label?: string | null
          professional_id?: string | null
          professional_share?: number
          recorded_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          capacity: number | null
          created_at: string
          created_by: string | null
          date: string | null
          description: string | null
          eligible_for_loyalty: boolean
          id: string
          image_url: string | null
          location: string | null
          price_member: number
          price_public: number
          professional_ids: string[]
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          date?: string | null
          description?: string | null
          eligible_for_loyalty?: boolean
          id?: string
          image_url?: string | null
          location?: string | null
          price_member?: number
          price_public?: number
          professional_ids?: string[]
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          date?: string | null
          description?: string | null
          eligible_for_loyalty?: boolean
          id?: string
          image_url?: string | null
          location?: string | null
          price_member?: number
          price_public?: number
          professional_ids?: string[]
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      advantage_claims: {
        Row: {
          advantage_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          advantage_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          advantage_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "advantage_claims_advantage_id_fkey"
            columns: ["advantage_id"]
            isOneToOne: false
            referencedRelation: "advantages"
            referencedColumns: ["id"]
          },
        ]
      }
      advantages: {
        Row: {
          conditions: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          kind: string
          partner_name: string | null
          promo_code: string | null
          quantity: number | null
          status: string
          title: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          conditions?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: string
          partner_name?: string | null
          promo_code?: string | null
          quantity?: number | null
          status?: string
          title: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          conditions?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: string
          partner_name?: string | null
          promo_code?: string | null
          quantity?: number | null
          status?: string
          title?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_id: string | null
          content: string | null
          cover_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          published_at: string | null
          slug: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content?: string | null
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          slug?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content?: string | null
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          slug?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      config_options: {
        Row: {
          code: string
          color: string | null
          created_at: string
          description: string | null
          family: string
          id: string
          is_active: boolean
          is_system: boolean
          label: string
          metadata: Json
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string
          description?: string | null
          family: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          label: string
          metadata?: Json
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string
          description?: string | null
          family?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          label?: string
          metadata?: Json
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      contests: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          prizes: Json
          start_date: string | null
          status: string
          title: string
          type: string
          updated_at: string
          winners: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          prizes?: Json
          start_date?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
          winners?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          prizes?: Json
          start_date?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
          winners?: Json
        }
        Relationships: []
      }
      documents: {
        Row: {
          category: string | null
          created_at: string
          id: string
          proof_type: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
          url: string
          visibility: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          proof_type?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
          url: string
          visibility?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          proof_type?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          url?: string
          visibility?: string
        }
        Relationships: []
      }
      dogs: {
        Row: {
          birth_date: string | null
          breed: string | null
          character: string | null
          created_at: string
          id: string
          name: string
          needs: string | null
          owner_id: string
          photo_url: string | null
          sex: string | null
          updated_at: string
          useful_information: string | null
          visibility: string
        }
        Insert: {
          birth_date?: string | null
          breed?: string | null
          character?: string | null
          created_at?: string
          id?: string
          name: string
          needs?: string | null
          owner_id: string
          photo_url?: string | null
          sex?: string | null
          updated_at?: string
          useful_information?: string | null
          visibility?: string
        }
        Update: {
          birth_date?: string | null
          breed?: string | null
          character?: string | null
          created_at?: string
          id?: string
          name?: string
          needs?: string | null
          owner_id?: string
          photo_url?: string | null
          sex?: string | null
          updated_at?: string
          useful_information?: string | null
          visibility?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          event_type: string
          financial_summary: Json
          id: string
          image_url: string | null
          location: string | null
          professional_ids: string[]
          start_date: string | null
          status: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          event_type?: string
          financial_summary?: Json
          id?: string
          image_url?: string | null
          location?: string | null
          professional_ids?: string[]
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          event_type?: string
          financial_summary?: Json
          id?: string
          image_url?: string | null
          location?: string | null
          professional_ids?: string[]
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      formation_registrations: {
        Row: {
          created_at: string
          formation_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          formation_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          formation_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "formation_registrations_formation_id_fkey"
            columns: ["formation_id"]
            isOneToOne: false
            referencedRelation: "formations"
            referencedColumns: ["id"]
          },
        ]
      }
      formations: {
        Row: {
          capacity: number | null
          created_at: string
          created_by: string | null
          date: string | null
          description: string | null
          duration_minutes: number | null
          format: string
          id: string
          live_link: string | null
          location: string | null
          speaker_name: string | null
          start_time: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          date?: string | null
          description?: string | null
          duration_minutes?: number | null
          format?: string
          id?: string
          live_link?: string | null
          location?: string | null
          speaker_name?: string | null
          start_time?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          date?: string | null
          description?: string | null
          duration_minutes?: number | null
          format?: string
          id?: string
          live_link?: string | null
          location?: string | null
          speaker_name?: string | null
          start_time?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      help_guides: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          id: string
          module: string
          review_comment: string | null
          reviewed_by: string | null
          role_scopes: string[]
          status: string
          summary: string | null
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          module?: string
          review_comment?: string | null
          reviewed_by?: string | null
          role_scopes?: string[]
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          module?: string
          review_comment?: string | null
          reviewed_by?: string | null
          role_scopes?: string[]
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      help_requests: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          handled_by: string | null
          id: string
          message: string
          response: string | null
          skills: string[]
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          handled_by?: string | null
          id?: string
          message: string
          response?: string | null
          skills?: string[]
          status?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          handled_by?: string | null
          id?: string
          message?: string
          response?: string | null
          skills?: string[]
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_requests_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_requests_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      in_app_notifications: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          kind: string
          link_url: string | null
          message: string | null
          read_at: string | null
          recipient_id: string
          sender_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          kind?: string
          link_url?: string | null
          message?: string | null
          read_at?: string | null
          recipient_id: string
          sender_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          kind?: string
          link_url?: string | null
          message?: string | null
          read_at?: string | null
          recipient_id?: string
          sender_id?: string | null
          title?: string
        }
        Relationships: []
      }
      inventory: {
        Row: {
          alert_threshold: number
          category: string | null
          created_at: string
          id: string
          location: string | null
          name: string
          quantity: number
          updated_at: string
        }
        Insert: {
          alert_threshold?: number
          category?: string | null
          created_at?: string
          id?: string
          location?: string | null
          name: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          alert_threshold?: number
          category?: string | null
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      job_sheets: {
        Row: {
          created_at: string
          daily_actions: string | null
          id: string
          member_id: string
          modules: string[]
          notes: string | null
          responsibilities: string | null
          role_title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          daily_actions?: string | null
          id?: string
          member_id: string
          modules?: string[]
          notes?: string | null
          responsibilities?: string | null
          role_title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          daily_actions?: string | null
          id?: string
          member_id?: string
          modules?: string[]
          notes?: string | null
          responsibilities?: string | null
          role_title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_sheets_member_id_profiles_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sheets_member_id_profiles_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_cards: {
        Row: {
          created_at: string
          id: string
          member_id: string
          qr_code: string
          total_stamps: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          qr_code?: string
          total_stamps?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          qr_code?: string
          total_stamps?: number
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_rules: {
        Row: {
          activity_id: string | null
          code: string | null
          created_at: string
          description: string | null
          eligible_membership_types: string[]
          event_id: string | null
          id: string
          is_active: boolean
          label: string | null
          match_code: string | null
          priority: number
          reward_label: string | null
          scope: string
          stamps_given: number
          tier_threshold: number | null
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          code?: string | null
          created_at?: string
          description?: string | null
          eligible_membership_types?: string[]
          event_id?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          match_code?: string | null
          priority?: number
          reward_label?: string | null
          scope?: string
          stamps_given?: number
          tier_threshold?: number | null
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          code?: string | null
          created_at?: string
          description?: string | null
          eligible_membership_types?: string[]
          event_id?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          match_code?: string | null
          priority?: number
          reward_label?: string | null
          scope?: string
          stamps_given?: number
          tier_threshold?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_rules_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_rules_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_stamps: {
        Row: {
          activity_id: string | null
          card_id: string
          created_at: string
          id: string
          note: string | null
          professional_id: string | null
          stamps: number
        }
        Insert: {
          activity_id?: string | null
          card_id: string
          created_at?: string
          id?: string
          note?: string | null
          professional_id?: string | null
          stamps?: number
        }
        Update: {
          activity_id?: string | null
          card_id?: string
          created_at?: string
          id?: string
          note?: string | null
          professional_id?: string | null
          stamps?: number
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_stamps_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_stamps_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "loyalty_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      mairies: {
        Row: {
          city: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          notes: string | null
          organization: string
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          organization: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          organization?: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      member_functions: {
        Row: {
          active: boolean
          created_at: string
          end_date: string | null
          function_type: string
          id: string
          start_date: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          end_date?: string | null
          function_type: string
          id?: string
          start_date?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          end_date?: string | null
          function_type?: string
          id?: string
          start_date?: string | null
          user_id?: string
        }
        Relationships: []
      }
      member_imports: {
        Row: {
          created_at: string
          created_count: number
          errors: Json
          file_name: string
          id: string
          imported_by: string | null
          skipped_count: number
          updated_count: number
        }
        Insert: {
          created_at?: string
          created_count?: number
          errors?: Json
          file_name: string
          id?: string
          imported_by?: string | null
          skipped_count?: number
          updated_count?: number
        }
        Update: {
          created_at?: string
          created_count?: number
          errors?: Json
          file_name?: string
          id?: string
          imported_by?: string | null
          skipped_count?: number
          updated_count?: number
        }
        Relationships: []
      }
      memberships: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          membership_type: string
          notes: string | null
          start_date: string | null
          status: string
          updated_at: string
          user_id: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          membership_type?: string
          notes?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          membership_type?: string
          notes?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: []
      }
      mindmap_config: {
        Row: {
          created_at: string
          edges: Json
          id: string
          nodes: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          edges?: Json
          id?: string
          nodes?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          edges?: Json
          id?: string
          nodes?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mindmap_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mindmap_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      participations: {
        Row: {
          activity_id: string | null
          created_at: string
          event_id: string | null
          id: string
          registration_status: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          registration_status?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          registration_status?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          active: boolean
          advantages: string | null
          contact: string | null
          created_at: string
          id: string
          name: string
          promo_codes: Json
          type: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          active?: boolean
          advantages?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          name: string
          promo_codes?: Json
          type?: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          active?: boolean
          advantages?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          name?: string
          promo_codes?: Json
          type?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      permissions: {
        Row: {
          action: string
          code: string
          description: string | null
          id: string
          module: string
          name: string
        }
        Insert: {
          action: string
          code: string
          description?: string | null
          id?: string
          module: string
          name: string
        }
        Update: {
          action?: string
          code?: string
          description?: string | null
          id?: string
          module?: string
          name?: string
        }
        Relationships: []
      }
      pro_details: {
        Row: {
          can_grant_stamps: boolean
          company_name: string
          contract_url: string | null
          created_at: string
          description: string | null
          id: string
          partnership_percentage: number
          professional_category: string | null
          profile_id: string
          social_links: Json
          updated_at: string
          website_url: string | null
        }
        Insert: {
          can_grant_stamps?: boolean
          company_name: string
          contract_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          partnership_percentage?: number
          professional_category?: string | null
          profile_id: string
          social_links?: Json
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          can_grant_stamps?: boolean
          company_name?: string
          contract_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          partnership_percentage?: number
          professional_category?: string | null
          profile_id?: string
          social_links?: Json
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pro_details_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pro_details_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_categories: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      professional_proposals: {
        Row: {
          created_at: string
          description: string | null
          id: string
          review_comment: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          review_comment?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          review_comment?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      professional_services: {
        Row: {
          active: boolean
          category: string | null
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          professional_id: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          professional_id: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          professional_id?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "professional_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          access_level: string
          avatar_path: string | null
          bio: string | null
          city: string | null
          created_at: string
          department: string | null
          display_name: string | null
          email: string | null
          first_name: string | null
          id: string
          involvement_level: string | null
          last_name: string | null
          membership_date: string | null
          membership_status: string
          membership_type: string
          phone: string | null
          public_visibility: boolean
          updated_at: string
        }
        Insert: {
          access_level?: string
          avatar_path?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          department?: string | null
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          involvement_level?: string | null
          last_name?: string | null
          membership_date?: string | null
          membership_status?: string
          membership_type?: string
          phone?: string | null
          public_visibility?: boolean
          updated_at?: string
        }
        Update: {
          access_level?: string
          avatar_path?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          department?: string | null
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          involvement_level?: string | null
          last_name?: string | null
          membership_date?: string | null
          membership_status?: string
          membership_type?: string
          phone?: string | null
          public_visibility?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      project_categories: {
        Row: {
          code: string
          color: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          color?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          color?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          id: string
          joined_at: string
          participation_status: string
          project_id: string
          project_role: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          participation_status?: string
          project_id: string
          project_role?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          participation_status?: string
          project_id?: string
          project_role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_teams: {
        Row: {
          created_at: string
          id: string
          member_id: string
          project_id: string
          role_in_project: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          project_id: string
          role_in_project?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          project_id?: string
          role_in_project?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_teams_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived_at: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          deadline: string | null
          description: string | null
          id: string
          mindmap_node_id: string | null
          owner_id: string | null
          parent_project_id: string | null
          priority: string
          progress_percent: number
          slug: string | null
          start_date: string | null
          status: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          archived_at?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          mindmap_node_id?: string | null
          owner_id?: string | null
          parent_project_id?: string | null
          priority?: string
          progress_percent?: number
          slug?: string | null
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          archived_at?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          mindmap_node_id?: string | null
          owner_id?: string | null
          parent_project_id?: string | null
          priority?: string
          progress_percent?: number
          slug?: string | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "project_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_parent_project_id_fkey"
            columns: ["parent_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      public_shares: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          expires_at: string | null
          id: string
          label: string | null
          revoked: boolean
          token: string
          view_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          expires_at?: string | null
          id?: string
          label?: string | null
          revoked?: boolean
          token: string
          view_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          expires_at?: string | null
          id?: string
          label?: string | null
          revoked?: boolean
          token?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "public_shares_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_shares_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      reimbursements: {
        Row: {
          amount: number
          created_at: string
          id: string
          label: string
          person_id: string
          processed_by: string | null
          receipt_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          label: string
          person_id: string
          processed_by?: string | null
          receipt_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          label?: string
          person_id?: string
          processed_by?: string | null
          receipt_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_system_role: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_system_role?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system_role?: boolean
          name?: string
        }
        Relationships: []
      }
      social_links: {
        Row: {
          created_at: string
          id: string
          is_visible: boolean
          platform: string
          professional_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_visible?: boolean
          platform: string
          professional_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_visible?: boolean
          platform?: string
          professional_id?: string
          url?: string
        }
        Relationships: []
      }
      task_assignees: {
        Row: {
          created_at: string
          id: string
          role_in_task: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_in_task?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role_in_task?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_dependencies: {
        Row: {
          created_at: string
          depends_on_task_id: string
          id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          depends_on_task_id: string
          id?: string
          task_id: string
        }
        Update: {
          created_at?: string
          depends_on_task_id?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_history: {
        Row: {
          action: string
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          task_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          task_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          task_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_submissions: {
        Row: {
          comment: string | null
          id: string
          proof_type: string | null
          proof_url: string | null
          submitted_at: string
          submitted_by: string
          task_id: string
        }
        Insert: {
          comment?: string | null
          id?: string
          proof_type?: string | null
          proof_url?: string | null
          submitted_at?: string
          submitted_by: string
          task_id: string
        }
        Update: {
          comment?: string | null
          id?: string
          proof_type?: string | null
          proof_url?: string | null
          submitted_at?: string
          submitted_by?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_submissions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_validation: {
        Row: {
          comment: string | null
          id: string
          status: string
          task_id: string
          validated_at: string
          validated_by: string
        }
        Insert: {
          comment?: string | null
          id?: string
          status: string
          task_id: string
          validated_at?: string
          validated_by: string
        }
        Update: {
          comment?: string | null
          id?: string
          status?: string
          task_id?: string
          validated_at?: string
          validated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_validation_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_user_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          deadline: string | null
          description: string | null
          id: string
          is_volunteer_task: boolean
          needs_help: boolean
          parent_task_id: string | null
          priority: string
          project_id: string | null
          rejection_reason: string | null
          started_at: string | null
          status: string
          submitted_at: string | null
          title: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          visibility: string
        }
        Insert: {
          assigned_user_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          is_volunteer_task?: boolean
          needs_help?: boolean
          parent_task_id?: string | null
          priority?: string
          project_id?: string | null
          rejection_reason?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          title: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          visibility?: string
        }
        Update: {
          assigned_user_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          is_volunteer_task?: boolean
          needs_help?: boolean
          parent_task_id?: string | null
          priority?: string
          project_id?: string | null
          rejection_reason?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          title?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      team_advices: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          recommendations: Json
          situation: string
          summary: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          recommendations?: Json
          situation: string
          summary?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          recommendations?: Json
          situation?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_advices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_advices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      terrain_reservations: {
        Row: {
          created_at: string
          date: string
          end_time: string
          id: string
          professional_id: string
          purpose: string | null
          resource_id: string
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          end_time: string
          id?: string
          professional_id: string
          purpose?: string | null
          resource_id: string
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string
          id?: string
          professional_id?: string
          purpose?: string | null
          resource_id?: string
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "terrain_reservations_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "terrain_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      terrain_resources: {
        Row: {
          created_at: string
          description: string | null
          id: string
          location: string | null
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_permission_overrides: {
        Row: {
          assigned_by: string | null
          created_at: string
          effect: string
          id: string
          permission_id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          effect?: string
          id?: string
          permission_id: string
          reason?: string | null
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          effect?: string
          id?: string
          permission_id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_overrides_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          default_view: string
          high_contrast: boolean
          notify_email: boolean
          notify_in_app: boolean
          notify_reminders: boolean
          reduced_motion: boolean
          text_size: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_view?: string
          high_contrast?: boolean
          notify_email?: boolean
          notify_in_app?: boolean
          notify_reminders?: boolean
          reduced_motion?: boolean
          text_size?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_view?: string
          high_contrast?: boolean
          notify_email?: boolean
          notify_in_app?: boolean
          notify_reminders?: boolean
          reduced_motion?: boolean
          text_size?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_professionals: {
        Row: {
          bio: string | null
          city: string | null
          company_name: string | null
          department: string | null
          description: string | null
          display_name: string | null
          first_name: string | null
          id: string | null
          professional_category: string | null
          social_links: Json | null
          website_url: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_loyalty_rules: {
        Args: { _activity_id: string; _event_id: string; _user_id: string }
        Returns: number
      }
      can_share_entity: {
        Args: { _entity_id: string; _entity_type: string; _user_id: string }
        Returns: boolean
      }
      can_view_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      claim_bureau_bootstrap: { Args: never; Returns: boolean }
      has_permission: {
        Args: { _permission_code: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: { _role_code: string; _user_id: string }
        Returns: boolean
      }
      is_bureau: { Args: { _user_id: string }; Returns: boolean }
      is_professional: { Args: { _user_id: string }; Returns: boolean }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      notify_once: {
        Args: {
          _entity_id: string
          _entity_type: string
          _kind: string
          _link: string
          _message: string
          _recipient: string
          _title: string
        }
        Returns: undefined
      }
      recompute_loyalty_all: { Args: never; Returns: number }
      recompute_loyalty_for_member: {
        Args: { _user_id: string }
        Returns: number
      }
      run_daily_reminders: { Args: never; Returns: undefined }
      run_weekly_bureau_digest: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
