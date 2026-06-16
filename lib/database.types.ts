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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      campaign: {
        Row: {
          body: string | null
          channel: Database["public"]["Enums"]["campaign_channel"]
          created_at: string
          id: string
          scheduled_at: string | null
          segment: Json
          sent_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          tenant_id: string
          title: string
        }
        Insert: {
          body?: string | null
          channel?: Database["public"]["Enums"]["campaign_channel"]
          created_at?: string
          id?: string
          scheduled_at?: string | null
          segment?: Json
          sent_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          tenant_id: string
          title: string
        }
        Update: {
          body?: string | null
          channel?: Database["public"]["Enums"]["campaign_channel"]
          created_at?: string
          id?: string
          scheduled_at?: string | null
          segment?: Json
          sent_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipient: {
        Row: {
          campaign_id: string
          company_id: string
          created_at: string
          delivered: boolean
          delivered_at: string | null
          id: string
          responded: boolean
          responded_at: string | null
          response_note: string | null
          tenant_id: string
        }
        Insert: {
          campaign_id: string
          company_id: string
          created_at?: string
          delivered?: boolean
          delivered_at?: string | null
          id?: string
          responded?: boolean
          responded_at?: string | null
          response_note?: string | null
          tenant_id: string
        }
        Update: {
          campaign_id?: string
          company_id?: string
          created_at?: string
          delivered?: boolean
          delivered_at?: string | null
          id?: string
          responded?: boolean
          responded_at?: string | null
          response_note?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipient_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipient_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipient_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      category: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          tenant_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      company: {
        Row: {
          biz_no: string | null
          ceo_name: string | null
          condition_tags: string[]
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          founded_date: string | null
          headcount: number | null
          id: string
          industry: string | null
          memo: string | null
          name: string
          revenue: number | null
          tenant_id: string
        }
        Insert: {
          biz_no?: string | null
          ceo_name?: string | null
          condition_tags?: string[]
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          founded_date?: string | null
          headcount?: number | null
          id?: string
          industry?: string | null
          memo?: string | null
          name: string
          revenue?: number | null
          tenant_id: string
        }
        Update: {
          biz_no?: string | null
          ceo_name?: string | null
          condition_tags?: string[]
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          founded_date?: string | null
          headcount?: number | null
          id?: string
          industry?: string | null
          memo?: string | null
          name?: string
          revenue?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      credential: {
        Row: {
          category_id: string | null
          company_id: string
          created_at: string
          expires_date: string | null
          id: string
          issued_date: string | null
          memo: string | null
          renew_lead_days: number
          tenant_id: string
          type: string
        }
        Insert: {
          category_id?: string | null
          company_id: string
          created_at?: string
          expires_date?: string | null
          id?: string
          issued_date?: string | null
          memo?: string | null
          renew_lead_days?: number
          tenant_id: string
          type: string
        }
        Update: {
          category_id?: string | null
          company_id?: string
          created_at?: string
          expires_date?: string | null
          id?: string
          issued_date?: string | null
          memo?: string | null
          renew_lead_days?: number
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "credential_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credential_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credential_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      document: {
        Row: {
          company_id: string
          created_at: string
          doc_category: string | null
          file_type: string | null
          id: string
          name: string
          size_bytes: number | null
          storage_url: string | null
          tenant_id: string
          uploaded_by: Database["public"]["Enums"]["document_uploader"]
          version: number
        }
        Insert: {
          company_id: string
          created_at?: string
          doc_category?: string | null
          file_type?: string | null
          id?: string
          name: string
          size_bytes?: number | null
          storage_url?: string | null
          tenant_id: string
          uploaded_by?: Database["public"]["Enums"]["document_uploader"]
          version?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          doc_category?: string | null
          file_type?: string | null
          id?: string
          name?: string
          size_bytes?: number | null
          storage_url?: string | null
          tenant_id?: string
          uploaded_by?: Database["public"]["Enums"]["document_uploader"]
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      notification: {
        Row: {
          body: string | null
          company_id: string | null
          created_at: string
          id: string
          is_read: boolean
          is_urgent: boolean
          ref_id: string | null
          ref_table: string | null
          tenant_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          body?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          is_urgent?: boolean
          ref_id?: string | null
          ref_table?: string | null
          tenant_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          body?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          is_urgent?: boolean
          ref_id?: string | null
          ref_table?: string | null
          tenant_id?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notification_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      profile: {
        Row: {
          created_at: string
          daily_summary_at: string | null
          email: string | null
          id: string
          name: string
          notify_channels: string[]
          notify_lead_days: number[]
          notify_match: boolean
          phone: string | null
          sender_name: string | null
          sender_phone: string | null
          tenant_id: string
          title: string | null
        }
        Insert: {
          created_at?: string
          daily_summary_at?: string | null
          email?: string | null
          id: string
          name: string
          notify_channels?: string[]
          notify_lead_days?: number[]
          notify_match?: boolean
          phone?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          tenant_id: string
          title?: string | null
        }
        Update: {
          created_at?: string
          daily_summary_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notify_channels?: string[]
          notify_lead_days?: number[]
          notify_match?: boolean
          phone?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          tenant_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      rule: {
        Row: {
          active: boolean
          created_at: string
          eligibility: Json
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          eligibility?: Json
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          eligibility?: Json
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule: {
        Row: {
          company_id: string | null
          created_at: string
          date: string
          id: string
          memo: string | null
          related_task_id: string | null
          tenant_id: string
          title: string
          type: Database["public"]["Enums"]["schedule_type"]
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          date: string
          id?: string
          memo?: string | null
          related_task_id?: string | null
          tenant_id: string
          title: string
          type?: Database["public"]["Enums"]["schedule_type"]
        }
        Update: {
          company_id?: string | null
          created_at?: string
          date?: string
          id?: string
          memo?: string | null
          related_task_id?: string | null
          tenant_id?: string
          title?: string
          type?: Database["public"]["Enums"]["schedule_type"]
        }
        Relationships: [
          {
            foreignKeyName: "schedule_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_related_task_id_fkey"
            columns: ["related_task_id"]
            isOneToOne: false
            referencedRelation: "task"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      task: {
        Row: {
          assignee_id: string | null
          category_id: string | null
          company_id: string
          created_at: string
          due_date: string | null
          id: string
          memo: string | null
          source_credential_id: string | null
          stage: Database["public"]["Enums"]["task_stage"]
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          category_id?: string | null
          company_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          memo?: string | null
          source_credential_id?: string | null
          stage?: Database["public"]["Enums"]["task_stage"]
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          category_id?: string | null
          company_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          memo?: string | null
          source_credential_id?: string | null
          stage?: Database["public"]["Enums"]["task_stage"]
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_source_credential_id_fkey"
            columns: ["source_credential_id"]
            isOneToOne: false
            referencedRelation: "credential"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      task_file: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          task_id: string
          tenant_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          task_id: string
          tenant_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          task_id?: string
          tenant_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_file_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_file_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_file_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      todo_note: {
        Row: {
          completed: boolean
          content: string
          created_at: string
          id: string
          note_date: string
          sort_order: number
          tag: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          content: string
          created_at?: string
          id?: string
          note_date: string
          sort_order?: number
          tag?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          content?: string
          created_at?: string
          id?: string
          note_date?: string
          sort_order?: number
          tag?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_note_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_note_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      deadline_item: {
        Row: {
          category_id: string | null
          category_name: string | null
          company_id: string | null
          company_name: string | null
          days_left: number | null
          due_date: string | null
          id: string | null
          source: string | null
          status: string | null
          tenant_id: string | null
          title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      auth_tenant_id: { Args: never; Returns: string }
      cleanup_old_todo_notes: { Args: never; Returns: number }
      generate_due_notifications: { Args: never; Returns: number }
    }
    Enums: {
      campaign_channel: "alimtalk" | "email"
      campaign_status: "draft" | "scheduled" | "sending" | "sent"
      document_uploader: "consultant" | "client"
      notification_type: "expiry" | "deadline" | "program_match"
      schedule_type: "expiry" | "deadline" | "meeting" | "renewal" | "etc"
      task_stage: "diagnosis" | "proposal" | "application" | "result"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      campaign_channel: ["alimtalk", "email"],
      campaign_status: ["draft", "scheduled", "sending", "sent"],
      document_uploader: ["consultant", "client"],
      notification_type: ["expiry", "deadline", "program_match"],
      schedule_type: ["expiry", "deadline", "meeting", "renewal", "etc"],
      task_stage: ["diagnosis", "proposal", "application", "result"],
    },
  },
} as const

export type TaskStage = Enums<"task_stage">
export type ScheduleType = Enums<"schedule_type">
export type DocumentUploader = Enums<"document_uploader">
export type CampaignStatus = Enums<"campaign_status">
export type CampaignChannel = Enums<"campaign_channel">
export type NotificationType = Enums<"notification_type">
export type CredentialStatus = "valid" | "expiring" | "expired"

export type DeadlineItem = Omit<
  Tables<"deadline_item">,
  "days_left" | "due_date" | "id" | "source" | "status" | "tenant_id" | "title"
> & {
  days_left: number
  due_date: string
  id: string
  source: "credential" | "task" | "schedule"
  status: CredentialStatus | TaskStage | ScheduleType
  tenant_id: string
  title: string
}
