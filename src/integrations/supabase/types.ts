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
      ai_usage: {
        Row: {
          created_at: string
          id: string
          kind: string
          user_id: string
        }
        Insert: {
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
          og_path: string | null
          org_id: string | null
          phones: Json
          slug: string
          template: string
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          accent_color?: string
          background_color?: string
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
          og_path?: string | null
          org_id?: string | null
          phones?: Json
          slug: string
          template?: string
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          accent_color?: string
          background_color?: string
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
          og_path?: string | null
          org_id?: string | null
          phones?: Json
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
          full_name: string
          id: string
          job_title: string | null
          linkedin_url: string | null
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
          full_name: string
          id?: string
          job_title?: string | null
          linkedin_url?: string | null
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
          full_name?: string
          id?: string
          job_title?: string | null
          linkedin_url?: string | null
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
        ]
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
          display_name: string | null
          id: string
          is_admin: boolean
          onboarded: boolean
          plan: string
          plan_expires_at: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          contacts_seen_at?: string
          created_at?: string
          credit_follow_up?: number
          credit_scan?: number
          display_name?: string | null
          id: string
          is_admin?: boolean
          onboarded?: boolean
          plan?: string
          plan_expires_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          contacts_seen_at?: string
          created_at?: string
          credit_follow_up?: number
          credit_scan?: number
          display_name?: string | null
          id?: string
          is_admin?: boolean
          onboarded?: boolean
          plan?: string
          plan_expires_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          webhook_url?: string | null
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
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_overview: { Args: never; Returns: Json }
      apply_purchase_entitlements: {
        Args: { _email: string; _user: string }
        Returns: undefined
      }
      consume_starter_credit: {
        Args: { _kind: string; _user: string }
        Returns: undefined
      }
      get_public_card: { Args: { _slug: string }; Returns: Json }
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
      restore_entitlement_plan: { Args: { _user: string }; Returns: undefined }
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
