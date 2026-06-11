// /docs/schema.sql 과 1:1 대응하는 수기 타입.
// Supabase 연결 후에는 `npx supabase gen types typescript --local > lib/database.types.ts` 로 재생성한다.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TaskStage = "diagnosis" | "proposal" | "application" | "result";
export type ScheduleType = "expiry" | "deadline" | "meeting" | "renewal" | "etc";
export type DocumentUploader = "consultant" | "client";
export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent";
export type CampaignChannel = "alimtalk" | "email";
export type NotificationType = "expiry" | "deadline" | "program_match";
/** 자격 상태 (DB 저장 없음 — deadline_item 뷰/클라이언트에서 파생) */
export type CredentialStatus = "valid" | "expiring" | "expired";

export interface Database {
  public: {
    Tables: {
      tenant: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      profile: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          title: string | null;
          phone: string | null;
          email: string | null;
          notify_lead_days: number[];
          notify_channels: string[];
          notify_match: boolean;
          daily_summary_at: string | null;
          sender_name: string | null;
          sender_phone: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          tenant_id: string;
          name: string;
          title?: string | null;
          phone?: string | null;
          email?: string | null;
          notify_lead_days?: number[];
          notify_channels?: string[];
          notify_match?: boolean;
          daily_summary_at?: string | null;
          sender_name?: string | null;
          sender_phone?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          title?: string | null;
          phone?: string | null;
          email?: string | null;
          notify_lead_days?: number[];
          notify_channels?: string[];
          notify_match?: boolean;
          daily_summary_at?: string | null;
          sender_name?: string | null;
          sender_phone?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      category: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          color: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          color?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          color?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      company: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          biz_no: string | null;
          industry: string | null;
          founded_date: string | null;
          revenue: number | null;
          headcount: number | null;
          ceo_name: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          contact_email: string | null;
          condition_tags: string[];
          memo: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          biz_no?: string | null;
          industry?: string | null;
          founded_date?: string | null;
          revenue?: number | null;
          headcount?: number | null;
          ceo_name?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          contact_email?: string | null;
          condition_tags?: string[];
          memo?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          biz_no?: string | null;
          industry?: string | null;
          founded_date?: string | null;
          revenue?: number | null;
          headcount?: number | null;
          ceo_name?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          contact_email?: string | null;
          condition_tags?: string[];
          memo?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      credential: {
        Row: {
          id: string;
          tenant_id: string;
          company_id: string;
          type: string;
          category_id: string | null;
          issued_date: string | null;
          expires_date: string | null;
          renew_lead_days: number;
          memo: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          company_id: string;
          type: string;
          category_id?: string | null;
          issued_date?: string | null;
          expires_date?: string | null;
          renew_lead_days?: number;
          memo?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          company_id?: string;
          type?: string;
          category_id?: string | null;
          issued_date?: string | null;
          expires_date?: string | null;
          renew_lead_days?: number;
          memo?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      task: {
        Row: {
          id: string;
          tenant_id: string;
          company_id: string;
          title: string;
          category_id: string | null;
          stage: TaskStage;
          due_date: string | null;
          assignee_id: string | null;
          source_credential_id: string | null;
          memo: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          company_id: string;
          title: string;
          category_id?: string | null;
          stage?: TaskStage;
          due_date?: string | null;
          assignee_id?: string | null;
          source_credential_id?: string | null;
          memo?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          company_id?: string;
          title?: string;
          category_id?: string | null;
          stage?: TaskStage;
          due_date?: string | null;
          assignee_id?: string | null;
          source_credential_id?: string | null;
          memo?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      schedule: {
        Row: {
          id: string;
          tenant_id: string;
          company_id: string | null;
          title: string;
          date: string;
          type: ScheduleType;
          related_task_id: string | null;
          memo: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          company_id?: string | null;
          title: string;
          date: string;
          type?: ScheduleType;
          related_task_id?: string | null;
          memo?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          company_id?: string | null;
          title?: string;
          date?: string;
          type?: ScheduleType;
          related_task_id?: string | null;
          memo?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      document: {
        Row: {
          id: string;
          tenant_id: string;
          company_id: string;
          name: string;
          doc_category: string | null;
          version: number;
          uploaded_by: DocumentUploader;
          storage_url: string | null;
          file_type: string | null;
          size_bytes: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          company_id: string;
          name: string;
          doc_category?: string | null;
          version?: number;
          uploaded_by?: DocumentUploader;
          storage_url?: string | null;
          file_type?: string | null;
          size_bytes?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          company_id?: string;
          name?: string;
          doc_category?: string | null;
          version?: number;
          uploaded_by?: DocumentUploader;
          storage_url?: string | null;
          file_type?: string | null;
          size_bytes?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      campaign: {
        Row: {
          id: string;
          tenant_id: string;
          title: string;
          body: string | null;
          channel: CampaignChannel;
          segment: Json;
          status: CampaignStatus;
          scheduled_at: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          title: string;
          body?: string | null;
          channel?: CampaignChannel;
          segment?: Json;
          status?: CampaignStatus;
          scheduled_at?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          title?: string;
          body?: string | null;
          channel?: CampaignChannel;
          segment?: Json;
          status?: CampaignStatus;
          scheduled_at?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      campaign_recipient: {
        Row: {
          id: string;
          tenant_id: string;
          campaign_id: string;
          company_id: string;
          delivered: boolean;
          delivered_at: string | null;
          responded: boolean;
          responded_at: string | null;
          response_note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          campaign_id: string;
          company_id: string;
          delivered?: boolean;
          delivered_at?: string | null;
          responded?: boolean;
          responded_at?: string | null;
          response_note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          campaign_id?: string;
          company_id?: string;
          delivered?: boolean;
          delivered_at?: string | null;
          responded?: boolean;
          responded_at?: string | null;
          response_note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      notification: {
        Row: {
          id: string;
          tenant_id: string;
          type: NotificationType;
          title: string;
          body: string | null;
          company_id: string | null;
          ref_table: string | null;
          ref_id: string | null;
          is_urgent: boolean;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          type: NotificationType;
          title: string;
          body?: string | null;
          company_id?: string | null;
          ref_table?: string | null;
          ref_id?: string | null;
          is_urgent?: boolean;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          type?: NotificationType;
          title?: string;
          body?: string | null;
          company_id?: string | null;
          ref_table?: string | null;
          ref_id?: string | null;
          is_urgent?: boolean;
          is_read?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      rule: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          eligibility: Json;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          eligibility?: Json;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          eligibility?: Json;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      deadline_item: {
        Row: {
          source: "credential" | "task" | "schedule";
          id: string;
          tenant_id: string;
          company_id: string | null;
          company_name: string | null;
          title: string;
          category_id: string | null;
          category_name: string | null;
          due_date: string;
          days_left: number;
          status: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      auth_tenant_id: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: {
      task_stage: TaskStage;
      schedule_type: ScheduleType;
      document_uploader: DocumentUploader;
      campaign_status: CampaignStatus;
      campaign_channel: CampaignChannel;
      notification_type: NotificationType;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Views<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"];

export type DeadlineItem = Views<"deadline_item">;
