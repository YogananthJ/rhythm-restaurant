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
      ai_audit_log: {
        Row: {
          block_reason: string | null
          completion_tokens: number | null
          context: Json
          created_at: string
          feature: string
          id: string
          latency_ms: number | null
          model: string | null
          outcome: string
          prompt: string
          prompt_tokens: number | null
          response: string | null
          restaurant_id: string
          user_id: string | null
        }
        Insert: {
          block_reason?: string | null
          completion_tokens?: number | null
          context?: Json
          created_at?: string
          feature: string
          id?: string
          latency_ms?: number | null
          model?: string | null
          outcome?: string
          prompt: string
          prompt_tokens?: number | null
          response?: string | null
          restaurant_id: string
          user_id?: string | null
        }
        Update: {
          block_reason?: string | null
          completion_tokens?: number | null
          context?: Json
          created_at?: string
          feature?: string
          id?: string
          latency_ms?: number | null
          model?: string | null
          outcome?: string
          prompt?: string
          prompt_tokens?: number | null
          response?: string | null
          restaurant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_audit_log_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          expires_at: string | null
          id: string
          kind: string
          max_uses: number | null
          min_subtotal_cents: number
          restaurant_id: string
          updated_at: string
          uses: number
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          kind: string
          max_uses?: number | null
          min_subtotal_cents?: number
          restaurant_id: string
          updated_at?: string
          uses?: number
          value: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          kind?: string
          max_uses?: number | null
          min_subtotal_cents?: number
          restaurant_id?: string
          updated_at?: string
          uses?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      dining_tables: {
        Row: {
          id: string
          label: string
          qr_token: string
          restaurant_id: string
          seats: number
          status: string
          updated_at: string
        }
        Insert: {
          id?: string
          label: string
          qr_token?: string
          restaurant_id: string
          seats?: number
          status?: string
          updated_at?: string
        }
        Update: {
          id?: string
          label?: string
          qr_token?: string
          restaurant_id?: string
          seats?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dining_tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_favorites: {
        Row: {
          created_at: string
          id: string
          menu_item_id: string
          qr_token: string
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          menu_item_id: string
          qr_token: string
          restaurant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          menu_item_id?: string
          qr_token?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_favorites_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_favorites_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_feedback: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          order_id: string
          rating: number
          restaurant_id: string
          sentiment: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          rating: number
          restaurant_id: string
          sentiment?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          rating?: number
          restaurant_id?: string
          sentiment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_feedback_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          action: string
          business_impact: string
          created_at: string
          fingerprint: string
          id: string
          priority: string
          resolved_at: string | null
          resolved_by: string | null
          restaurant_id: string
          root_cause: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          action?: string
          business_impact?: string
          created_at?: string
          fingerprint: string
          id?: string
          priority: string
          resolved_at?: string | null
          resolved_by?: string | null
          restaurant_id: string
          root_cause?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          action?: string
          business_impact?: string
          created_at?: string
          fingerprint?: string
          id?: string
          priority?: string
          resolved_at?: string | null
          resolved_by?: string | null
          restaurant_id?: string
          root_cause?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          id: string
          name: string
          restaurant_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          restaurant_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          restaurant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          allergens: string[]
          category_id: string | null
          description: string | null
          dietary_tags: string[]
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          popularity_score: number
          prep_minutes: number
          price_cents: number
          promo_boost: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          allergens?: string[]
          category_id?: string | null
          description?: string | null
          dietary_tags?: string[]
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          popularity_score?: number
          prep_minutes?: number
          price_cents?: number
          promo_boost?: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          allergens?: string[]
          category_id?: string | null
          description?: string | null
          dietary_tags?: string[]
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          popularity_score?: number
          prep_minutes?: number
          price_cents?: number
          promo_boost?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          category: string
          created_at: string
          data: Json
          dismissed_at: string | null
          group_key: string | null
          id: string
          link: string | null
          priority: string
          read_at: string | null
          restaurant_id: string
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          category?: string
          created_at?: string
          data?: Json
          dismissed_at?: string | null
          group_key?: string | null
          id?: string
          link?: string | null
          priority?: string
          read_at?: string | null
          restaurant_id: string
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          data?: Json
          dismissed_at?: string | null
          group_key?: string | null
          id?: string
          link?: string | null
          priority?: string
          read_at?: string | null
          restaurant_id?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          menu_item_id: string
          name_snapshot: string
          notes: string | null
          order_id: string
          quantity: number
          status: string
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          id?: string
          menu_item_id: string
          name_snapshot: string
          notes?: string | null
          order_id: string
          quantity?: number
          status?: string
          unit_price_cents: number
        }
        Update: {
          created_at?: string
          id?: string
          menu_item_id?: string
          name_snapshot?: string
          notes?: string | null
          order_id?: string
          quantity?: number
          status?: string
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          access_token: string
          closed_at: string | null
          coupon_code: string | null
          created_at: string
          discount_cents: number
          guest_name: string | null
          id: string
          invoice_no: string | null
          notes: string | null
          restaurant_id: string
          service_charge_cents: number
          status: string
          subtotal_cents: number
          table_id: string | null
          tax_cents: number
          tip_cents: number
          total_cents: number
          updated_at: string
        }
        Insert: {
          access_token?: string
          closed_at?: string | null
          coupon_code?: string | null
          created_at?: string
          discount_cents?: number
          guest_name?: string | null
          id?: string
          invoice_no?: string | null
          notes?: string | null
          restaurant_id: string
          service_charge_cents?: number
          status?: string
          subtotal_cents?: number
          table_id?: string | null
          tax_cents?: number
          tip_cents?: number
          total_cents?: number
          updated_at?: string
        }
        Update: {
          access_token?: string
          closed_at?: string | null
          coupon_code?: string | null
          created_at?: string
          discount_cents?: number
          guest_name?: string | null
          id?: string
          invoice_no?: string | null
          notes?: string | null
          restaurant_id?: string
          service_charge_cents?: number
          status?: string
          subtotal_cents?: number
          table_id?: string | null
          tax_cents?: number
          tip_cents?: number
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "dining_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string | null
          id: string
          method: string
          order_id: string
          restaurant_id: string
          tip_cents: number
          txn_ref: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by?: string | null
          id?: string
          method: string
          order_id: string
          restaurant_id: string
          tip_cents?: number
          txn_ref?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string
          order_id?: string
          restaurant_id?: string
          tip_cents?: number
          txn_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      reservation_events: {
        Row: {
          actor_id: string | null
          created_at: string
          details: Json | null
          event_type: string
          from_status: string | null
          id: string
          reservation_id: string
          restaurant_id: string
          to_status: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          event_type: string
          from_status?: string | null
          id?: string
          reservation_id: string
          restaurant_id: string
          to_status?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          event_type?: string
          from_status?: string | null
          id?: string
          reservation_id?: string
          restaurant_id?: string
          to_status?: string | null
        }
        Relationships: []
      }
      reservations: {
        Row: {
          created_at: string
          email: string | null
          guest_name: string
          id: string
          notes: string | null
          party_size: number
          phone: string | null
          requested_at: string
          restaurant_id: string
          status: string
          table_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          guest_name: string
          id?: string
          notes?: string | null
          party_size?: number
          phone?: string | null
          requested_at: string
          restaurant_id: string
          status?: string
          table_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          guest_name?: string
          id?: string
          notes?: string | null
          party_size?: number
          phone?: string | null
          requested_at?: string
          restaurant_id?: string
          status?: string
          table_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "dining_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          created_at: string
          currency: string
          id: string
          name: string
          phone: string | null
          service_pct: number
          slug: string
          tax_pct: number
        }
        Insert: {
          address?: string | null
          created_at?: string
          currency?: string
          id?: string
          name: string
          phone?: string | null
          service_pct?: number
          slug: string
          tax_pct?: number
        }
        Update: {
          address?: string | null
          created_at?: string
          currency?: string
          id?: string
          name?: string
          phone?: string | null
          service_pct?: number
          slug?: string
          tax_pct?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string
          guest_name: string
          id: string
          notes: string | null
          party_size: number
          phone: string | null
          quoted_minutes: number
          restaurant_id: string
          seated_table_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          guest_name: string
          id?: string
          notes?: string | null
          party_size?: number
          phone?: string | null
          quoted_minutes?: number
          restaurant_id: string
          seated_table_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          guest_name?: string
          id?: string
          notes?: string | null
          party_size?: number
          phone?: string | null
          quoted_minutes?: number
          restaurant_id?: string
          seated_table_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_seated_table_id_fkey"
            columns: ["seated_table_id"]
            isOneToOne: false
            referencedRelation: "dining_tables"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _require_staff: { Args: never; Returns: undefined }
      check_reservation_capacity: {
        Args: {
          p_party_size: number
          p_requested_at: string
          p_restaurant_id: string
        }
        Returns: Json
      }
      get_guest_feedback: {
        Args: { p_access_token: string; p_order_id: string }
        Returns: {
          comment: string
          created_at: string
          rating: number
        }[]
      }
      get_guest_order: {
        Args: { p_access_token: string; p_order_id: string }
        Returns: Json
      }
      get_recommendations: {
        Args: {
          p_cart_item_ids?: string[]
          p_dietary?: string[]
          p_limit?: number
          p_qr_token: string
        }
        Returns: {
          category_id: string
          description: string
          dietary_tags: string[]
          menu_item_id: string
          name: string
          prep_minutes: number
          price_cents: number
          reasons: string[]
          score: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_guest_favorites: {
        Args: { p_qr_token: string }
        Returns: {
          menu_item_id: string
        }[]
      }
      notify_dismiss: { Args: { p_id: string }; Returns: undefined }
      notify_mark_all_read: {
        Args: { p_restaurant_id: string }
        Returns: undefined
      }
      notify_mark_read: { Args: { p_id: string }; Returns: undefined }
      place_guest_order: {
        Args: { p_guest_name: string; p_items: Json; p_qr_token: string }
        Returns: Json
      }
      push_notification: {
        Args: {
          p_body: string
          p_category: string
          p_data: Json
          p_group_key: string
          p_link: string
          p_priority: string
          p_restaurant_id: string
          p_title: string
        }
        Returns: string
      }
      recalc_order: { Args: { p_order_id: string }; Returns: undefined }
      resolve_table_by_qr: {
        Args: { p_qr_token: string }
        Returns: {
          id: string
          label: string
          restaurant_id: string
          restaurant_name: string
        }[]
      }
      staff_add_order_item: {
        Args: {
          p_menu_item_id: string
          p_notes: string
          p_order_id: string
          p_quantity: number
        }
        Returns: string
      }
      staff_add_payment: {
        Args: {
          p_amount_cents: number
          p_method: string
          p_order_id: string
          p_tip_cents: number
          p_txn_ref: string
        }
        Returns: string
      }
      staff_apply_coupon: {
        Args: { p_code: string; p_order_id: string }
        Returns: Json
      }
      staff_close_order: { Args: { p_order_id: string }; Returns: Json }
      staff_merge_orders: {
        Args: { p_source_id: string; p_target_id: string }
        Returns: undefined
      }
      staff_remove_order_item: {
        Args: { p_item_id: string }
        Returns: undefined
      }
      staff_set_order_charges: {
        Args: {
          p_discount_cents: number
          p_notes: string
          p_order_id: string
          p_tip_cents: number
        }
        Returns: undefined
      }
      staff_split_order: {
        Args: { p_item_ids: string[]; p_order_id: string }
        Returns: string
      }
      staff_update_order_item: {
        Args: { p_item_id: string; p_notes: string; p_quantity: number }
        Returns: undefined
      }
      staff_void_payment: { Args: { p_payment_id: string }; Returns: undefined }
      submit_guest_feedback: {
        Args: {
          p_access_token: string
          p_comment: string
          p_order_id: string
          p_rating: number
        }
        Returns: string
      }
      toggle_guest_favorite: {
        Args: { p_menu_item_id: string; p_qr_token: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "kitchen" | "waiter" | "host" | "customer"
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
      app_role: ["admin", "manager", "kitchen", "waiter", "host", "customer"],
    },
  },
} as const
