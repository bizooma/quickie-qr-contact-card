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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_emails: {
        Row: {
          email: string
        }
        Insert: {
          email: string
        }
        Update: {
          email?: string
        }
        Relationships: []
      }
      ai_calls: {
        Row: {
          cache_read_tokens: number
          created_at: string
          id: string
          input_tokens: number
          kind: string
          model: string
          output_tokens: number
          user_id: string | null
          web_searches: number
        }
        Insert: {
          cache_read_tokens?: number
          created_at?: string
          id?: string
          input_tokens?: number
          kind: string
          model: string
          output_tokens?: number
          user_id?: string | null
          web_searches?: number
        }
        Update: {
          cache_read_tokens?: number
          created_at?: string
          id?: string
          input_tokens?: number
          kind?: string
          model?: string
          output_tokens?: number
          user_id?: string | null
          web_searches?: number
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          created_at: string
          credit: boolean
          id: string
          kind: string
          reservation: string | null
          user_id: string
        }
        Insert: {
          credit?: boolean
          reservation?: string | null
          created_at?: string
          id?: string
          kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      app_secrets: {
        Row: {
          created_at: string
          key: string
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          value: Json
        }
        Update: {
          created_at?: string
          key?: string
          value?: Json
        }
        Relationships: []
      }
      background_designs: {
        Row: {
          card_id: string
          design: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          card_id: string
          design: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          card_id?: string
          design?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "background_designs_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: true
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_links: {
        Row: {
          card_id: string
          created_at: string
          icon: string
          id: string
          label: string
          position: number
          url: string
          user_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          icon?: string
          id?: string
          label?: string
          position?: number
          url?: string
          user_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          icon?: string
          id?: string
          label?: string
          position?: number
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_links_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_slug_history: {
        Row: {
          card_id: string
          created_at: string
          old_slug: string
        }
        Insert: {
          card_id: string
          created_at?: string
          old_slug: string
        }
        Update: {
          card_id?: string
          created_at?: string
          old_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_slug_history_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_views: {
        Row: {
          card_id: string
          created_at: string
          device: string | null
          event_type: string
          id: string
          meta: string | null
          referrer: string | null
          user_id: string
          visitor: string | null
        }
        Insert: {
          card_id: string
          created_at?: string
          device?: string | null
          event_type?: string
          id?: string
          meta?: string | null
          referrer?: string | null
          user_id: string
          visitor?: string | null
        }
        Update: {
          card_id?: string
          created_at?: string
          device?: string | null
          event_type?: string
          id?: string
          meta?: string | null
          referrer?: string | null
          user_id?: string
          visitor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_views_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          accent_color: string
          background_color: string
          banner_path: string | null
          bio: string | null
          company: string | null
          created_at: string
          emails: Json
          font: string
          full_name: string
          headshot_path: string | null
          id: string
          job_title: string | null
          label: string
          location: string | null
          logo_path: string | null
          logo_size: string
          og_path: string | null
          org_id: string | null
          phones: Json
          qr_center: string | null
          slug: string
          template: string
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          accent_color?: string
          background_color?: string
          banner_path?: string | null
          bio?: string | null
          company?: string | null
          created_at?: string
          emails?: Json
          font?: string
          full_name?: string
          headshot_path?: string | null
          id?: string
          job_title?: string | null
          label?: string
          location?: string | null
          logo_path?: string | null
          logo_size?: string
          og_path?: string | null
          org_id?: string | null
          phones?: Json
          qr_center?: string | null
          slug: string
          template?: string
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          accent_color?: string
          background_color?: string
          banner_path?: string | null
          bio?: string | null
          company?: string | null
          created_at?: string
          emails?: Json
          font?: string
          full_name?: string
          headshot_path?: string | null
          id?: string
          job_title?: string | null
          label?: string
          location?: string | null
          logo_path?: string | null
          logo_size?: string
          og_path?: string | null
          org_id?: string | null
          phones?: Json
          qr_center?: string | null
          slug?: string
          template?: string
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cards_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_notes: {
        Row: {
          body: string
          contact_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          body: string
          contact_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          body?: string
          contact_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_reminders: {
        Row: {
          contact_id: string
          created_at: string
          done_at: string | null
          id: string
          note: string | null
          notified_at: string | null
          remind_at: string
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          done_at?: string | null
          id?: string
          note?: string | null
          notified_at?: string | null
          remind_at: string
          user_id?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          done_at?: string | null
          id?: string
          note?: string | null
          notified_at?: string | null
          remind_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_reminders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tags: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          tag: string
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          tag: string
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          tag?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          card_id: string | null
          company: string | null
          created_at: string
          email: string | null
          event_id: string | null
          full_name: string
          id: string
          job_title: string | null
          linkedin_url: string | null
          logo_path: string | null
          met_at: string | null
          note: string | null
          phone: string | null
          photo_path: string | null
          source: string
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          card_id?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          event_id?: string | null
          full_name: string
          id?: string
          job_title?: string | null
          linkedin_url?: string | null
          logo_path?: string | null
          met_at?: string | null
          note?: string | null
          phone?: string | null
          photo_path?: string | null
          source?: string
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          card_id?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          event_id?: string | null
          full_name?: string
          id?: string
          job_title?: string | null
          linkedin_url?: string | null
          logo_path?: string | null
          met_at?: string | null
          note?: string | null
          phone?: string | null
          photo_path?: string | null
          source?: string
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          ends_on: string | null
          id: string
          is_active: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_on?: string | null
          id?: string
          is_active?: boolean
          name: string
          user_id?: string
        }
        Update: {
          created_at?: string
          ends_on?: string | null
          id?: string
          is_active?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      feature_requests: {
        Row: {
          body: string
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      org_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string
          expires_at: string
          id: string
          org_id: string
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          org_id: string
          role?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          org_id?: string
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      orgs: {
        Row: {
          accent_color: string | null
          background_color: string | null
          created_at: string
          id: string
          lock_brand: boolean
          logo_path: string | null
          name: string
          owner_id: string
          share_contacts: boolean
        }
        Insert: {
          accent_color?: string | null
          background_color?: string | null
          created_at?: string
          id?: string
          lock_brand?: boolean
          logo_path?: string | null
          name: string
          owner_id: string
          share_contacts?: boolean
        }
        Update: {
          accent_color?: string | null
          background_color?: string | null
          created_at?: string
          id?: string
          lock_brand?: boolean
          logo_path?: string | null
          name?: string
          owner_id?: string
          share_contacts?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          contacts_seen_at: string
          created_at: string
          credit_follow_up: number
          credit_scan: number
          dismissed_tips: string[]
          display_name: string | null
          id: string
          is_admin: boolean
          last_seen_at: string | null
          onboarded: boolean
          plan: string
          plan_expires_at: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          suspended: boolean
          suspended_at: string | null
          team_seats: number
          updated_at: string
          webhook_url: string | null
          winback_sent_at: string | null
          signup_attribution: Json | null
        }
        Insert: {
          avatar_url?: string | null
          contacts_seen_at?: string
          created_at?: string
          credit_follow_up?: number
          credit_scan?: number
          dismissed_tips?: string[]
          display_name?: string | null
          id: string
          is_admin?: boolean
          last_seen_at?: string | null
          onboarded?: boolean
          plan?: string
          plan_expires_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          suspended?: boolean
          suspended_at?: string | null
          team_seats?: number
          updated_at?: string
          webhook_url?: string | null
          winback_sent_at?: string | null
          signup_attribution?: Json | null
        }
        Update: {
          avatar_url?: string | null
          contacts_seen_at?: string
          created_at?: string
          credit_follow_up?: number
          credit_scan?: number
          dismissed_tips?: string[]
          display_name?: string | null
          id?: string
          is_admin?: boolean
          last_seen_at?: string | null
          onboarded?: boolean
          plan?: string
          plan_expires_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          suspended?: boolean
          suspended_at?: string | null
          team_seats?: number
          updated_at?: string
          webhook_url?: string | null
          winback_sent_at?: string | null
          signup_attribution?: Json | null
        }
        Relationships: []
      }
      purchase_entitlements: {
        Row: {
          amount_cents: number | null
          applied_at: string | null
          applied_to: string | null
          created_at: string
          email: string
          id: string
          is_test: boolean
          kind: string
          order_number: number | null
          payload: Json | null
          pinball_order_id: string
          refunded_at: string | null
        }
        Insert: {
          amount_cents?: number | null
          applied_at?: string | null
          applied_to?: string | null
          created_at?: string
          email: string
          id?: string
          is_test?: boolean
          kind: string
          order_number?: number | null
          payload?: Json | null
          pinball_order_id: string
          refunded_at?: string | null
        }
        Update: {
          amount_cents?: number | null
          applied_at?: string | null
          applied_to?: string | null
          created_at?: string
          email?: string
          id?: string
          is_test?: boolean
          kind?: string
          order_number?: number | null
          payload?: Json | null
          pinball_order_id?: string
          refunded_at?: string | null
        }
        Relationships: []
      }
      push_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          subscription_id: string
          title: string
          url: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          subscription_id: string
          title: string
          url?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          subscription_id?: string
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_messages_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          bonus_applied_at: string | null
          bonus_scans: number
          card_id: string | null
          created_at: string
          first_paid_at: string | null
          friend_discount_used_at: string | null
          id: string
          owner_user_id: string
          referred_user_id: string
          source: string | null
        }
        Insert: {
          bonus_applied_at?: string | null
          bonus_scans?: number
          card_id?: string | null
          created_at?: string
          first_paid_at?: string | null
          friend_discount_used_at?: string | null
          id?: string
          owner_user_id: string
          referred_user_id: string
          source?: string | null
        }
        Update: {
          bonus_applied_at?: string | null
          bonus_scans?: number
          card_id?: string | null
          created_at?: string
          first_paid_at?: string | null
          friend_discount_used_at?: string | null
          id?: string
          owner_user_id?: string
          referred_user_id?: string
          source?: string | null
        }
        Relationships: []
      }
      roadmap_votes: {
        Row: {
          created_at: string
          item_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          item_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          item_key?: string
          user_id?: string
        }
        Relationships: []
      }
      rpc_rate_limits: {
        Row: {
          card_id: string | null
          created_at: string
          id: number
          ip_hash: string
          kind: string
        }
        Insert: {
          card_id?: string | null
          created_at?: string
          id?: never
          ip_hash: string
          kind: string
        }
        Update: {
          card_id?: string | null
          created_at?: string
          id?: never
          ip_hash?: string
          kind?: string
        }
        Relationships: []
      }
      signup_grants: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          grant_months: number | null
          id: string
          match_email: string | null
          match_name: string | null
          note: string | null
          plan: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          grant_months?: number | null
          id?: string
          match_email?: string | null
          match_name?: string | null
          note?: string | null
          plan: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          grant_months?: number | null
          id?: string
          match_email?: string | null
          match_name?: string | null
          note?: string | null
          plan?: string
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          created_at: string
          id: string
          type: string
        }
        Insert: {
          created_at?: string
          id: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: string
        }
        Relationships: []
      }
      site_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          meta: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          meta?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          meta?: string | null
        }
        Relationships: []
      }
      user_activity: {
        Row: {
          created_at: string
          id: string
          path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          path: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_team_invite: {
        Args: { _token: string; _user: string }
        Returns: Json
      }
      admin_analytics: { Args: never; Returns: Json }
      admin_overview: { Args: never; Returns: Json }
      apply_purchase_entitlements: {
        Args: { _email: string; _user: string }
        Returns: undefined
      }
      claim_verified_signup_grant: {
        Args: { p_user: string }
        Returns: undefined
      }
      cleanup_rpc_rate_limits: { Args: never; Returns: number }
      add_topup_credits: { Args: { _follow_ups: number; _scans: number; _user: string }; Returns: undefined }
      record_signup_attribution: { Args: { _attrib: Json; _user: string }; Returns: Json }
      roadmap_vote_counts: { Args: never; Returns: Json }
      my_referral_summary: { Args: never; Returns: Json }
      referral_reward_state: { Args: { _owner: string }; Returns: Json }
      cleanup_stale_data: { Args: never; Returns: Json }
      card_event_series: {
        Args: { p_card?: string; p_since: string }
        Returns: Json
      }
      org_event_totals: {
        Args: { p_org: string; p_since: string }
        Returns: Json
      }
      reserve_ai_usage: {
        Args: { _kind: string; _limit: number; _units: number; _user: string }
        Returns: Json
      }
      settle_ai_usage: {
        Args: { _actual: number; _reservation: string }
        Returns: undefined
      }
      winback_candidates: { Args: { p_limit?: number }; Returns: string[] }
      consume_starter_credit: {
        Args: { _kind: string; _user: string }
        Returns: undefined
      }
      effective_plan: { Args: { _user: string }; Returns: string }
      get_public_card: { Args: { _slug: string }; Returns: Json }
      has_team_seat: { Args: { _user: string }; Returns: boolean }
      in_same_org_as: { Args: { _user: string }; Returns: boolean }
      log_card_event: {
        Args: {
          _device?: string
          _event: string
          _meta?: string
          _referrer?: string
          _slug: string
          _visitor?: string
        }
        Returns: undefined
      }
      log_site_event: {
        Args: { _event_type: string; _meta?: string }
        Returns: undefined
      }
      org_role_of: { Args: { _org: string }; Returns: string }
      org_shares_contacts_of: { Args: { _owner: string }; Returns: boolean }
      premium_card_insights: {
        Args: { p_card?: string; p_since: string }
        Returns: Json
      }
      record_app_purchase: {
        Args: {
          _amount_cents: number
          _email: string
          _event: string
          _is_test: boolean
          _kind: string
          _order_id: string
          _order_number: number
          _payload: Json
        }
        Returns: Json
      }
      refund_app_purchase: {
        Args: { _kind: string; _order_id: string }
        Returns: Json
      }
      resolve_card_slug: { Args: { _slug: string }; Returns: string }
      restore_entitlement_plan: { Args: { _user: string }; Returns: undefined }
      rpc_client_ip_hash: { Args: never; Returns: string }
      submit_shareback: {
        Args: {
          _company: string
          _email: string
          _name: string
          _note: string
          _phone: string
          _slug: string
        }
        Returns: undefined
      }
      team_member_names: {
        Args: { p_org: string }
        Returns: {
          display_name: string
          id: string
        }[]
      }
      team_seat_count: { Args: { p_org: string }; Returns: number }
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
