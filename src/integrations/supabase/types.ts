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
      agent_act_additional_rows: {
        Row: {
          amount: number | null
          created_at: string
          description: string | null
          id: string
          report_id: string
          row_number: number
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          description?: string | null
          id?: string
          report_id: string
          row_number: number
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          description?: string | null
          id?: string
          report_id?: string
          row_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_act_additional_rows_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "agent_act_report_data"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_act_calculation_rows: {
        Row: {
          act_amount: number | null
          check_amount: number | null
          created_at: string
          formula: string | null
          id: string
          remainder_after_tax: number | null
          report_id: string
          row_number: number
          salary_with_commission: number | null
          tax_7_percent: number | null
          transfer_date: string | null
          transferred_amount: number | null
          updated_at: string
        }
        Insert: {
          act_amount?: number | null
          check_amount?: number | null
          created_at?: string
          formula?: string | null
          id?: string
          remainder_after_tax?: number | null
          report_id: string
          row_number: number
          salary_with_commission?: number | null
          tax_7_percent?: number | null
          transfer_date?: string | null
          transferred_amount?: number | null
          updated_at?: string
        }
        Update: {
          act_amount?: number | null
          check_amount?: number | null
          created_at?: string
          formula?: string | null
          id?: string
          remainder_after_tax?: number | null
          report_id?: string
          row_number?: number
          salary_with_commission?: number | null
          tax_7_percent?: number | null
          transfer_date?: string | null
          transferred_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_act_calculation_rows_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "agent_act_report_data"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_act_report_data: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          month: number
          organization_id: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          month: number
          organization_id: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          month?: number
          organization_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      agent_report_data: {
        Row: {
          company_address: string | null
          company_name: string
          company_phone: string | null
          contract_date: string
          contract_number: string
          created_at: string
          created_by: string | null
          id: string
          month: number
          organization_id: string
          period_end: string
          period_start: string
          recipient_name: string | null
          recipient_position: string | null
          report_number: string
          updated_at: string
          year: number
        }
        Insert: {
          company_address?: string | null
          company_name: string
          company_phone?: string | null
          contract_date: string
          contract_number: string
          created_at?: string
          created_by?: string | null
          id?: string
          month: number
          organization_id: string
          period_end: string
          period_start: string
          recipient_name?: string | null
          recipient_position?: string | null
          report_number: string
          updated_at?: string
          year: number
        }
        Update: {
          company_address?: string | null
          company_name?: string
          company_phone?: string | null
          contract_date?: string
          contract_number?: string
          created_at?: string
          created_by?: string | null
          id?: string
          month?: number
          organization_id?: string
          period_end?: string
          period_start?: string
          recipient_name?: string | null
          recipient_position?: string | null
          report_number?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      agent_report_rows: {
        Row: {
          amount: number | null
          contractor: string | null
          created_at: string
          formula: string | null
          id: string
          invoice_number: string | null
          report_id: string
          row_number: number
          tmc: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          contractor?: string | null
          created_at?: string
          formula?: string | null
          id?: string
          invoice_number?: string | null
          report_id: string
          row_number: number
          tmc?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          contractor?: string | null
          created_at?: string
          formula?: string | null
          id?: string
          invoice_number?: string | null
          report_id?: string
          row_number?: number
          tmc?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_report_rows_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "agent_report_data"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_report_uu_data: {
        Row: {
          company_address: string | null
          company_name: string
          company_phone: string | null
          contract_date: string
          contract_number: string
          created_at: string
          created_by: string | null
          id: string
          month: number
          organization_id: string
          period_end: string
          period_start: string
          recipient_name: string | null
          recipient_position: string | null
          report_number: string
          updated_at: string
          year: number
        }
        Insert: {
          company_address?: string | null
          company_name: string
          company_phone?: string | null
          contract_date: string
          contract_number: string
          created_at?: string
          created_by?: string | null
          id?: string
          month: number
          organization_id: string
          period_end: string
          period_start: string
          recipient_name?: string | null
          recipient_position?: string | null
          report_number: string
          updated_at?: string
          year: number
        }
        Update: {
          company_address?: string | null
          company_name?: string
          company_phone?: string | null
          contract_date?: string
          contract_number?: string
          created_at?: string
          created_by?: string | null
          id?: string
          month?: number
          organization_id?: string
          period_end?: string
          period_start?: string
          recipient_name?: string | null
          recipient_position?: string | null
          report_number?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      agent_report_uu_rows: {
        Row: {
          amount: number | null
          contractor: string | null
          created_at: string
          formula: string | null
          id: string
          invoice_number: string | null
          report_id: string
          row_number: number
          tmc: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          contractor?: string | null
          created_at?: string
          formula?: string | null
          id?: string
          invoice_number?: string | null
          report_id: string
          row_number: number
          tmc?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          contractor?: string | null
          created_at?: string
          formula?: string | null
          id?: string
          invoice_number?: string | null
          report_id?: string
          row_number?: number
          tmc?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_report_uu_rows_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "agent_report_uu_data"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_analytics_reports: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          model: string | null
          organization_id: string
          period_from: string
          period_to: string
          summary: string | null
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          model?: string | null
          organization_id: string
          period_from: string
          period_to: string
          summary?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          model?: string | null
          organization_id?: string
          period_from?: string
          period_to?: string
          summary?: string | null
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_day_briefs: {
        Row: {
          brief_date: string
          buckets: Json
          created_at: string
          created_by: string | null
          created_by_name: string | null
          generated_at: string
          id: string
          metrics: Json
          narrative: string | null
          organization_id: string
        }
        Insert: {
          brief_date: string
          buckets?: Json
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          generated_at?: string
          id?: string
          metrics?: Json
          narrative?: string | null
          organization_id: string
        }
        Update: {
          brief_date?: string
          buckets?: Json
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          generated_at?: string
          id?: string
          metrics?: Json
          narrative?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_day_briefs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          organization_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          organization_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          assignee_id: string | null
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          event_type: string | null
          id: string
          organization_id: string
          priority: string | null
          request_id: string | null
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          assignee_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          event_type?: string | null
          id?: string
          organization_id: string
          priority?: string | null
          request_id?: string | null
          start_date: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          assignee_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          event_type?: string | null
          id?: string
          organization_id?: string
          priority?: string | null
          request_id?: string | null
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      classification_rules: {
        Row: {
          created_at: string | null
          doc_type: string | null
          id: string
          organization_id: string
          pattern: string
          section_name: string
        }
        Insert: {
          created_at?: string | null
          doc_type?: string | null
          id?: string
          organization_id: string
          pattern: string
          section_name: string
        }
        Update: {
          created_at?: string | null
          doc_type?: string | null
          id?: string
          organization_id?: string
          pattern?: string
          section_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "classification_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_error_logs: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          message: string
          organization_id: string | null
          severity: string
          stack: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          organization_id?: string | null
          severity?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          organization_id?: string | null
          severity?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      client_invitations: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          name: string
          organization_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          expires_at?: string
          id?: string
          name: string
          organization_id: string
          token?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          name?: string
          organization_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          company_name: string | null
          created_at: string
          created_by: string | null
          email: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string | null
          organization_id: string
          pinned: boolean | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          organization_id: string
          pinned?: boolean | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          organization_id?: string
          pinned?: boolean | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deadline_reminder_settings: {
        Row: {
          created_at: string
          days_before: number
          id: string
          is_enabled: boolean
          notify_applicant: boolean
          notify_executor: boolean
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          days_before?: number
          id?: string
          is_enabled?: boolean
          notify_applicant?: boolean
          notify_executor?: boolean
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          days_before?: number
          id?: string
          is_enabled?: boolean
          notify_applicant?: boolean
          notify_executor?: boolean
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deadline_reminder_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deadstock_items: {
        Row: {
          arrived_at: string | null
          buyer: string | null
          created_at: string
          created_by: string | null
          description: string | null
          document_urls: string[] | null
          id: string
          invoice_number: string | null
          name: string
          organization_id: string
          part_number: string | null
          photo_urls: string[] | null
          price: number
          qty: number
          responsible_user_id: string | null
          shipped_at: string | null
          sold_at: string | null
          status: string
          tk: string | null
          updated_at: string
        }
        Insert: {
          arrived_at?: string | null
          buyer?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_urls?: string[] | null
          id?: string
          invoice_number?: string | null
          name: string
          organization_id: string
          part_number?: string | null
          photo_urls?: string[] | null
          price?: number
          qty?: number
          responsible_user_id?: string | null
          shipped_at?: string | null
          sold_at?: string | null
          status?: string
          tk?: string | null
          updated_at?: string
        }
        Update: {
          arrived_at?: string | null
          buyer?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_urls?: string[] | null
          id?: string
          invoice_number?: string | null
          name?: string
          organization_id?: string
          part_number?: string | null
          photo_urls?: string[] | null
          price?: number
          qty?: number
          responsible_user_id?: string | null
          shipped_at?: string | null
          sold_at?: string | null
          status?: string
          tk?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deadstock_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      device_push_tokens: {
        Row: {
          created_at: string
          device_name: string | null
          id: string
          organization_id: string | null
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_name?: string | null
          id?: string
          organization_id?: string | null
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_name?: string | null
          id?: string
          organization_id?: string | null
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      equipment: {
        Row: {
          brand: string
          comment: string | null
          created_at: string
          current_object_id: string | null
          id: string
          model: string
          organization_id: string
          plate_number: string | null
          responsible_name: string | null
          updated_at: string
          vin: string | null
          year: number | null
        }
        Insert: {
          brand: string
          comment?: string | null
          created_at?: string
          current_object_id?: string | null
          id?: string
          model: string
          organization_id: string
          plate_number?: string | null
          responsible_name?: string | null
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Update: {
          brand?: string
          comment?: string | null
          created_at?: string
          current_object_id?: string | null
          id?: string
          model?: string
          organization_id?: string
          plate_number?: string | null
          responsible_name?: string | null
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_current_object_id_fkey"
            columns: ["current_object_id"]
            isOneToOne: false
            referencedRelation: "request_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      filter_element_deadstock: {
        Row: {
          actual_sale_price: number | null
          article: string | null
          buyer: string | null
          compatibility: string | null
          created_at: string
          created_by: string | null
          cross_numbers: string[]
          filter_element_id: string | null
          id: string
          is_archived: boolean
          manufacturer: string | null
          market_price: number | null
          name: string
          notes: string | null
          organization_id: string
          quantity: number
          sale_comment: string | null
          sold_at: string | null
          status: string
          unit: string
          updated_at: string
        }
        Insert: {
          actual_sale_price?: number | null
          article?: string | null
          buyer?: string | null
          compatibility?: string | null
          created_at?: string
          created_by?: string | null
          cross_numbers?: string[]
          filter_element_id?: string | null
          id?: string
          is_archived?: boolean
          manufacturer?: string | null
          market_price?: number | null
          name: string
          notes?: string | null
          organization_id: string
          quantity?: number
          sale_comment?: string | null
          sold_at?: string | null
          status?: string
          unit?: string
          updated_at?: string
        }
        Update: {
          actual_sale_price?: number | null
          article?: string | null
          buyer?: string | null
          compatibility?: string | null
          created_at?: string
          created_by?: string | null
          cross_numbers?: string[]
          filter_element_id?: string | null
          id?: string
          is_archived?: boolean
          manufacturer?: string | null
          market_price?: number | null
          name?: string
          notes?: string | null
          organization_id?: string
          quantity?: number
          sale_comment?: string | null
          sold_at?: string | null
          status?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "filter_element_deadstock_filter_element_id_fkey"
            columns: ["filter_element_id"]
            isOneToOne: false
            referencedRelation: "filter_elements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filter_element_deadstock_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      filter_element_equipment: {
        Row: {
          created_at: string
          equipment_id: string
          filter_element_id: string
          id: string
        }
        Insert: {
          created_at?: string
          equipment_id: string
          filter_element_id: string
          id?: string
        }
        Update: {
          created_at?: string
          equipment_id?: string
          filter_element_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "filter_element_equipment_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filter_element_equipment_filter_element_id_fkey"
            columns: ["filter_element_id"]
            isOneToOne: false
            referencedRelation: "filter_elements"
            referencedColumns: ["id"]
          },
        ]
      }
      filter_element_movements: {
        Row: {
          comment: string | null
          created_at: string
          created_by: string | null
          document_number: string | null
          equipment_id: string | null
          filter_element_id: string
          from_location: string | null
          id: string
          object_id: string | null
          organization_id: string
          quantity: number
          reason: string | null
          receipt_date: string | null
          request_id: string | null
          responsible_user_id: string | null
          supplier: string | null
          to_location: string | null
          type: string
          unit_price: number | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          document_number?: string | null
          equipment_id?: string | null
          filter_element_id: string
          from_location?: string | null
          id?: string
          object_id?: string | null
          organization_id: string
          quantity: number
          reason?: string | null
          receipt_date?: string | null
          request_id?: string | null
          responsible_user_id?: string | null
          supplier?: string | null
          to_location?: string | null
          type: string
          unit_price?: number | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          document_number?: string | null
          equipment_id?: string | null
          filter_element_id?: string
          from_location?: string | null
          id?: string
          object_id?: string | null
          organization_id?: string
          quantity?: number
          reason?: string | null
          receipt_date?: string | null
          request_id?: string | null
          responsible_user_id?: string | null
          supplier?: string | null
          to_location?: string | null
          type?: string
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "filter_element_movements_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filter_element_movements_filter_element_id_fkey"
            columns: ["filter_element_id"]
            isOneToOne: false
            referencedRelation: "filter_elements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filter_element_movements_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "request_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filter_element_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filter_element_movements_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      filter_elements: {
        Row: {
          article: string | null
          created_at: string
          created_by: string | null
          cross_numbers: string[]
          id: string
          manufacturer: string | null
          min_stock: number
          name: string
          notes: string | null
          organization_id: string
          photo_url: string | null
          storage_location: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          article?: string | null
          created_at?: string
          created_by?: string | null
          cross_numbers?: string[]
          id?: string
          manufacturer?: string | null
          min_stock?: number
          name: string
          notes?: string | null
          organization_id: string
          photo_url?: string | null
          storage_location?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          article?: string | null
          created_at?: string
          created_by?: string | null
          cross_numbers?: string[]
          id?: string
          manufacturer?: string | null
          min_stock?: number
          name?: string
          notes?: string | null
          organization_id?: string
          photo_url?: string | null
          storage_location?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "filter_elements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kp_supplier_prices: {
        Row: {
          created_at: string
          id: string
          kp_supplier_id: string
          match_type: string | null
          material_item_id: string
          price: number | null
          total_price: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          kp_supplier_id: string
          match_type?: string | null
          material_item_id: string
          price?: number | null
          total_price?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          kp_supplier_id?: string
          match_type?: string | null
          material_item_id?: string
          price?: number | null
          total_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kp_supplier_prices_kp_supplier_id_fkey"
            columns: ["kp_supplier_id"]
            isOneToOne: false
            referencedRelation: "kp_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kp_supplier_prices_material_item_id_fkey"
            columns: ["material_item_id"]
            isOneToOne: false
            referencedRelation: "material_statement_items"
            referencedColumns: ["id"]
          },
        ]
      }
      kp_suppliers: {
        Row: {
          created_at: string
          created_by: string | null
          file_name: string
          file_type: string
          file_url: string | null
          folder_id: string
          id: string
          organization_id: string
          status: string
          supplier_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_name: string
          file_type?: string
          file_url?: string | null
          folder_id: string
          id?: string
          organization_id: string
          status?: string
          supplier_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_name?: string
          file_type?: string
          file_url?: string | null
          folder_id?: string
          id?: string
          organization_id?: string
          status?: string
          supplier_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kp_suppliers_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "material_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kp_suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      linked_requests: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          linked_request_id: string
          request_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          linked_request_id: string
          request_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          linked_request_id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linked_requests_linked_request_id_fkey"
            columns: ["linked_request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linked_requests_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      material_folders: {
        Row: {
          created_at: string
          id: string
          name: string
          object_id: string
          organization_id: string
          section_id: string | null
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          object_id: string
          organization_id: string
          section_id?: string | null
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          object_id?: string
          organization_id?: string
          section_id?: string | null
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_folders_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "material_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_folders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_folders_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "material_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      material_objects: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
          year?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "material_objects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      material_sections: {
        Row: {
          created_at: string
          id: string
          name: string
          object_id: string
          organization_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          object_id: string
          organization_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          object_id?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_sections_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "material_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_sections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      material_statement_items: {
        Row: {
          confidence: number | null
          confidence_level: string | null
          created_at: string
          id: string
          item_type: string
          mass_per_unit: number | null
          name: string
          organization_id: string
          price: number | null
          price_source: string
          procurement_request_id: string | null
          procurement_status: string
          quantity: number | null
          row_number: number
          source_file_id: string | null
          statement_id: string
          supplier: string | null
          total_price: number | null
          type_mark: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          confidence_level?: string | null
          created_at?: string
          id?: string
          item_type?: string
          mass_per_unit?: number | null
          name?: string
          organization_id: string
          price?: number | null
          price_source?: string
          procurement_request_id?: string | null
          procurement_status?: string
          quantity?: number | null
          row_number?: number
          source_file_id?: string | null
          statement_id: string
          supplier?: string | null
          total_price?: number | null
          type_mark?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          confidence_level?: string | null
          created_at?: string
          id?: string
          item_type?: string
          mass_per_unit?: number | null
          name?: string
          organization_id?: string
          price?: number | null
          price_source?: string
          procurement_request_id?: string | null
          procurement_status?: string
          quantity?: number | null
          row_number?: number
          source_file_id?: string | null
          statement_id?: string
          supplier?: string | null
          total_price?: number | null
          type_mark?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_statement_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_statement_items_procurement_request_id_fkey"
            columns: ["procurement_request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_statement_items_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "material_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_statement_items_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "material_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      material_statements: {
        Row: {
          classification_status: string | null
          created_at: string
          created_by: string | null
          detected_doc_type: string | null
          detected_source_type: string | null
          display_name: string | null
          file_name: string
          file_type: string
          file_url: string
          folder_id: string | null
          id: string
          is_recognized: boolean
          object_id: string | null
          organization_id: string
          section_id: string | null
          updated_at: string
          year: number
        }
        Insert: {
          classification_status?: string | null
          created_at?: string
          created_by?: string | null
          detected_doc_type?: string | null
          detected_source_type?: string | null
          display_name?: string | null
          file_name: string
          file_type?: string
          file_url: string
          folder_id?: string | null
          id?: string
          is_recognized?: boolean
          object_id?: string | null
          organization_id: string
          section_id?: string | null
          updated_at?: string
          year?: number
        }
        Update: {
          classification_status?: string | null
          created_at?: string
          created_by?: string | null
          detected_doc_type?: string | null
          detected_source_type?: string | null
          display_name?: string | null
          file_name?: string
          file_type?: string
          file_url?: string
          folder_id?: string | null
          id?: string
          is_recognized?: boolean
          object_id?: string | null
          organization_id?: string
          section_id?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "material_statements_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "material_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_statements_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "material_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_statements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_statements_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "material_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      max_groups: {
        Row: {
          chat_type: string | null
          created_at: string
          group_id: string
          group_name: string
          id: string
          is_active: boolean
          is_discovered: boolean
          last_api_at: string | null
          last_api_status: number | null
          last_max_message_id: string | null
          last_message_at: string | null
          notification_type: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          chat_type?: string | null
          created_at?: string
          group_id: string
          group_name: string
          id?: string
          is_active?: boolean
          is_discovered?: boolean
          last_api_at?: string | null
          last_api_status?: number | null
          last_max_message_id?: string | null
          last_message_at?: string | null
          notification_type?: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          chat_type?: string | null
          created_at?: string
          group_id?: string
          group_name?: string
          id?: string
          is_active?: boolean
          is_discovered?: boolean
          last_api_at?: string | null
          last_api_status?: number | null
          last_max_message_id?: string | null
          last_message_at?: string | null
          notification_type?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "max_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      max_updates: {
        Row: {
          chat_id: string | null
          created_at: string
          payload: Json
          update_id: number
        }
        Insert: {
          chat_id?: string | null
          created_at?: string
          payload: Json
          update_id: number
        }
        Update: {
          chat_id?: string | null
          created_at?: string
          payload?: Json
          update_id?: number
        }
        Relationships: []
      }
      max_webhook_logs: {
        Row: {
          chat_id: string | null
          created_at: string
          event_type: string | null
          group_id: string | null
          group_name: string | null
          id: string
          payload: Json
        }
        Insert: {
          chat_id?: string | null
          created_at?: string
          event_type?: string | null
          group_id?: string | null
          group_name?: string | null
          id?: string
          payload: Json
        }
        Update: {
          chat_id?: string | null
          created_at?: string
          event_type?: string | null
          group_id?: string | null
          group_name?: string | null
          id?: string
          payload?: Json
        }
        Relationships: []
      }
      message_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          message_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          message_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          sender_id: string
          updated_at: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_dedup: {
        Row: {
          created_at: string
          dedup_key: string
          expires_at: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          dedup_key: string
          expires_at: string
          organization_id: string
        }
        Update: {
          created_at?: string
          dedup_key?: string
          expires_at?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_dedup_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_health: {
        Row: {
          component: string
          id: string
          last_check_at: string
          last_error: string | null
          latency_ms: number | null
          organization_id: string | null
          status: string
        }
        Insert: {
          component: string
          id?: string
          last_check_at?: string
          last_error?: string | null
          latency_ms?: number | null
          organization_id?: string | null
          status: string
        }
        Update: {
          component?: string
          id?: string
          last_check_at?: string
          last_error?: string | null
          latency_ms?: number | null
          organization_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_health_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_queue: {
        Row: {
          created_at: string
          dedup_key: string | null
          delivered_at: string | null
          entity_id: string | null
          entity_type: string | null
          event_type: string
          group_id: string
          group_name: string | null
          id: string
          last_error: string | null
          last_http_code: number | null
          last_response: string | null
          next_attempt_at: string
          organization_id: string
          payload: Json
          platform: string
          provider_chat_id: string | null
          provider_message_id: string | null
          retry_count: number
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dedup_key?: string | null
          delivered_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          group_id: string
          group_name?: string | null
          id?: string
          last_error?: string | null
          last_http_code?: number | null
          last_response?: string | null
          next_attempt_at?: string
          organization_id: string
          payload?: Json
          platform: string
          provider_chat_id?: string | null
          provider_message_id?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dedup_key?: string | null
          delivered_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          group_id?: string
          group_name?: string | null
          id?: string
          last_error?: string | null
          last_http_code?: number | null
          last_response?: string | null
          next_attempt_at?: string
          organization_id?: string
          payload?: Json
          platform?: string
          provider_chat_id?: string | null
          provider_message_id?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_routing_rules: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          is_enabled: boolean
          notification_type: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          is_enabled?: boolean
          notification_type: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          is_enabled?: boolean
          notification_type?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_routing_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_schedule_settings: {
        Row: {
          created_at: string
          enabled: boolean
          notify_arrival_1d: boolean
          notify_arrival_3d: boolean
          notify_arrival_today: boolean
          notify_overdue: boolean
          notify_shipment_tomorrow: boolean
          organization_id: string
          send_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          notify_arrival_1d?: boolean
          notify_arrival_3d?: boolean
          notify_arrival_today?: boolean
          notify_overdue?: boolean
          notify_shipment_tomorrow?: boolean
          organization_id: string
          send_time?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          notify_arrival_1d?: boolean
          notify_arrival_3d?: boolean
          notify_arrival_today?: boolean
          notify_overdue?: boolean
          notify_shipment_tomorrow?: boolean
          organization_id?: string
          send_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          dedup_window_seconds: number
          max_per_minute: number
          mode: string
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          dedup_window_seconds?: number
          max_per_minute?: number
          mode?: string
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          dedup_window_seconds?: number
          max_per_minute?: number
          mode?: string
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          organization_id: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          organization_id: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          organization_id?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      object_documents: {
        Row: {
          created_at: string
          created_by: string | null
          doc_type: string
          file_url: string
          id: string
          name: string
          object_id: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          doc_type?: string
          file_url: string
          id?: string
          name: string
          object_id: string
          organization_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          doc_type?: string
          file_url?: string
          id?: string
          name?: string
          object_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "object_documents_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "request_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "object_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          description: string | null
          id: string
          inn: string | null
          logo_url: string | null
          name: string
          primary_color: string | null
          secondary_color: string | null
          telegram_auto_send_on_create: boolean | null
          telegram_auto_send_on_status_change: boolean | null
          updated_at: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          inn?: string | null
          logo_url?: string | null
          name: string
          primary_color?: string | null
          secondary_color?: string | null
          telegram_auto_send_on_create?: boolean | null
          telegram_auto_send_on_status_change?: boolean | null
          updated_at?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          inn?: string | null
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          secondary_color?: string | null
          telegram_auto_send_on_create?: boolean | null
          telegram_auto_send_on_status_change?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      planner_stages: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          name: string
          object_id: string | null
          organization_id: string
          position: number
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          name: string
          object_id?: string | null
          organization_id: string
          position?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          name?: string
          object_id?: string | null
          organization_id?: string
          position?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_stages_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "request_objects"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_task_activity: {
        Row: {
          action: string
          created_at: string
          description: string | null
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
          organization_id: string
          task_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          organization_id: string
          task_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          organization_id?: string
          task_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planner_task_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "planner_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          organization_id: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          organization_id: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          organization_id?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "planner_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_task_dependencies: {
        Row: {
          blocked_by_task_id: string
          created_at: string
          dep_type: string
          id: string
          organization_id: string
          task_id: string
        }
        Insert: {
          blocked_by_task_id: string
          created_at?: string
          dep_type?: string
          id?: string
          organization_id: string
          task_id: string
        }
        Update: {
          blocked_by_task_id?: string
          created_at?: string
          dep_type?: string
          id?: string
          organization_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_task_dependencies_blocked_by_task_id_fkey"
            columns: ["blocked_by_task_id"]
            isOneToOne: false
            referencedRelation: "planner_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planner_task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "planner_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_task_reminders: {
        Row: {
          channel: string
          created_at: string
          fire_at: string | null
          id: string
          offset_minutes: number
          organization_id: string
          sent_at: string | null
          task_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          fire_at?: string | null
          id?: string
          offset_minutes: number
          organization_id: string
          sent_at?: string | null
          task_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          fire_at?: string | null
          id?: string
          offset_minutes?: number
          organization_id?: string
          sent_at?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_task_reminders_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "planner_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_task_templates: {
        Row: {
          checklist: Json
          created_at: string
          created_by: string | null
          description: string | null
          estimated_hours: number | null
          id: string
          name: string
          organization_id: string
          priority: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          checklist?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          name: string
          organization_id: string
          priority?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          checklist?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          name?: string
          organization_id?: string
          priority?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      planner_tasks: {
        Row: {
          actual_hours: number | null
          assignee_id: string | null
          assignee_name: string | null
          attachments: Json
          checklist: Json
          completed_at: string | null
          created_at: string
          created_by: string | null
          delegated_to: string | null
          description: string | null
          due_date: string | null
          due_time: string | null
          equipment_id: string | null
          equipment_ids: string[]
          estimated_hours: number | null
          id: string
          is_private: boolean
          last_auto_sync_at: string | null
          object_id: string | null
          organization_id: string
          parent_task_id: string | null
          position: number
          priority: string
          recurrence: Json | null
          request_id: string | null
          source: string
          source_rule: string | null
          stage_id: string | null
          start_date: string | null
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          actual_hours?: number | null
          assignee_id?: string | null
          assignee_name?: string | null
          attachments?: Json
          checklist?: Json
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delegated_to?: string | null
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          equipment_id?: string | null
          equipment_ids?: string[]
          estimated_hours?: number | null
          id?: string
          is_private?: boolean
          last_auto_sync_at?: string | null
          object_id?: string | null
          organization_id: string
          parent_task_id?: string | null
          position?: number
          priority?: string
          recurrence?: Json | null
          request_id?: string | null
          source?: string
          source_rule?: string | null
          stage_id?: string | null
          start_date?: string | null
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          actual_hours?: number | null
          assignee_id?: string | null
          assignee_name?: string | null
          attachments?: Json
          checklist?: Json
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delegated_to?: string | null
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          equipment_id?: string | null
          equipment_ids?: string[]
          estimated_hours?: number | null
          id?: string
          is_private?: boolean
          last_auto_sync_at?: string | null
          object_id?: string | null
          organization_id?: string
          parent_task_id?: string | null
          position?: number
          priority?: string
          recurrence?: Json | null
          request_id?: string | null
          source?: string
          source_rule?: string | null
          stage_id?: string | null
          start_date?: string | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_tasks_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "request_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planner_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "planner_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planner_tasks_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "planner_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_items: {
        Row: {
          created_at: string
          id: string
          name: string
          price: number
          procurement_id: string
          qty: number
          request_id: string
          total: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          price?: number
          procurement_id: string
          qty?: number
          request_id: string
          total?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          price?: number
          procurement_id?: string
          qty?: number
          request_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "procurement_items_procurement_id_fkey"
            columns: ["procurement_id"]
            isOneToOne: false
            referencedRelation: "procurements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      procurements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string | null
          organization_id: string
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          organization_id: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          organization_id?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procurements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          organization_name: string
          phone: string | null
          position: string | null
          telegram_user_id: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          organization_name: string
          phone?: string | null
          position?: string | null
          telegram_user_id?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          organization_name?: string
          phone?: string | null
          position?: string | null
          telegram_user_id?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      report_inclusions: {
        Row: {
          created_at: string
          decision: string
          id: string
          note: string | null
          organization_id: string
          period: string
          request_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          decision?: string
          id?: string
          note?: string | null
          organization_id: string
          period: string
          request_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          note?: string | null
          organization_id?: string
          period?: string
          request_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_inclusions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_activities: {
        Row: {
          action: string
          created_at: string | null
          description: string | null
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
          organization_id: string
          request_id: string
          snapshot: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          description?: string | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          organization_id: string
          request_id: string
          snapshot?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          organization_id?: string
          request_id?: string
          snapshot?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_activities_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          request_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          request_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          request_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_comments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_favorites: {
        Row: {
          created_at: string
          id: string
          request_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          request_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_favorites_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_items: {
        Row: {
          article: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
          quantity: number
          request_id: string
        }
        Insert: {
          article?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
          quantity?: number
          request_id: string
        }
        Update: {
          article?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          quantity?: number
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_notification_log: {
        Row: {
          forced: boolean
          id: string
          notification_type: string
          organization_id: string
          request_id: string
          sent_at: string
          sent_by: string | null
          telegram_message_id: number | null
        }
        Insert: {
          forced?: boolean
          id?: string
          notification_type: string
          organization_id: string
          request_id: string
          sent_at?: string
          sent_by?: string | null
          telegram_message_id?: number | null
        }
        Update: {
          forced?: boolean
          id?: string
          notification_type?: string
          organization_id?: string
          request_id?: string
          sent_at?: string
          sent_by?: string | null
          telegram_message_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "request_notification_log_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_objects: {
        Row: {
          address: string | null
          archived: boolean
          comment: string | null
          contract_number: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          project_end_date: string | null
          project_start_date: string | null
          responsible_user_id: string | null
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          address?: string | null
          archived?: boolean
          comment?: string | null
          contract_number?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          project_end_date?: string | null
          project_start_date?: string | null
          responsible_user_id?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          address?: string | null
          archived?: boolean
          comment?: string | null
          contract_number?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          project_end_date?: string | null
          project_start_date?: string | null
          responsible_user_id?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_objects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_objects_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      request_participants: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          participant_type: string
          telegram_username: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          participant_type: string
          telegram_username?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          participant_type?: string
          telegram_username?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_participants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      request_priorities: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          order: number
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          order?: number
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          order?: number
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_priorities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      request_reminders: {
        Row: {
          created_at: string
          id: string
          is_sent: boolean
          message: string | null
          remind_at: string
          request_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_sent?: boolean
          message?: string | null
          remind_at: string
          request_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_sent?: boolean
          message?: string | null
          remind_at?: string
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_reminders_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_shipments: {
        Row: {
          actual_arrival_date: string | null
          comment: string | null
          created_at: string
          created_by: string | null
          document_urls: Json
          driver_name: string | null
          driver_phone: string | null
          id: string
          load_date: string | null
          organization_id: string
          planned_arrival_date: string | null
          request_id: string
          sequence_number: number
          status: string
          trailer_number: string | null
          transport_company: string | null
          transport_type: string
          updated_at: string
          vehicle_number: string | null
          waybill_number: string | null
        }
        Insert: {
          actual_arrival_date?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          document_urls?: Json
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          load_date?: string | null
          organization_id: string
          planned_arrival_date?: string | null
          request_id: string
          sequence_number?: number
          status?: string
          trailer_number?: string | null
          transport_company?: string | null
          transport_type?: string
          updated_at?: string
          vehicle_number?: string | null
          waybill_number?: string | null
        }
        Update: {
          actual_arrival_date?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          document_urls?: Json
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          load_date?: string | null
          organization_id?: string
          planned_arrival_date?: string | null
          request_id?: string
          sequence_number?: number
          status?: string
          trailer_number?: string | null
          transport_company?: string | null
          transport_type?: string
          updated_at?: string
          vehicle_number?: string | null
          waybill_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_shipments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_statuses: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          order: number
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          order?: number
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          order?: number
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_statuses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          actual_arrival_date: string | null
          amount: number | null
          amount_2: number | null
          amount_3: number | null
          applicant: string | null
          applicant_user_id: string | null
          archived: boolean
          availability_delivery_time: string | null
          awaiting_comment_from: string | null
          client_id: string | null
          comments: string | null
          contractor: string | null
          created_at: string | null
          created_by: string | null
          delivery_date: string | null
          description: string
          document_url: string | null
          document_urls: string[] | null
          equipment_id: string | null
          estimated_delivery_days: number | null
          executor: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          invoice_number_2: string | null
          invoice_number_3: string | null
          invoice_routed_at: string | null
          invoice_routed_by: string | null
          invoice_routing: string | null
          is_project: boolean
          object_id: string | null
          operation_type: string | null
          order_days: number | null
          organization_id: string | null
          parent_request_id: string | null
          payment_date: string | null
          payment_percent: number | null
          payment_percentage: number | null
          payment_status: string | null
          photo_url: string | null
          photo_urls: string[] | null
          planned_delivery_date: string | null
          priority: string | null
          product_id: string | null
          quantity: number | null
          received_by: string | null
          request_date: string
          request_number: string
          request_type: string | null
          reserve_on_warehouse: boolean | null
          shipment_date: string | null
          status: string
          telegram_message_id: number | null
          telegram_message_ids: number[] | null
          telegram_procurement_message_id: number | null
          transport_company: string | null
          unit: string | null
          updated_at: string | null
          warehouse_id: string | null
          waybill_number: string | null
        }
        Insert: {
          actual_arrival_date?: string | null
          amount?: number | null
          amount_2?: number | null
          amount_3?: number | null
          applicant?: string | null
          applicant_user_id?: string | null
          archived?: boolean
          availability_delivery_time?: string | null
          awaiting_comment_from?: string | null
          client_id?: string | null
          comments?: string | null
          contractor?: string | null
          created_at?: string | null
          created_by?: string | null
          delivery_date?: string | null
          description: string
          document_url?: string | null
          document_urls?: string[] | null
          equipment_id?: string | null
          estimated_delivery_days?: number | null
          executor?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_number_2?: string | null
          invoice_number_3?: string | null
          invoice_routed_at?: string | null
          invoice_routed_by?: string | null
          invoice_routing?: string | null
          is_project?: boolean
          object_id?: string | null
          operation_type?: string | null
          order_days?: number | null
          organization_id?: string | null
          parent_request_id?: string | null
          payment_date?: string | null
          payment_percent?: number | null
          payment_percentage?: number | null
          payment_status?: string | null
          photo_url?: string | null
          photo_urls?: string[] | null
          planned_delivery_date?: string | null
          priority?: string | null
          product_id?: string | null
          quantity?: number | null
          received_by?: string | null
          request_date: string
          request_number: string
          request_type?: string | null
          reserve_on_warehouse?: boolean | null
          shipment_date?: string | null
          status?: string
          telegram_message_id?: number | null
          telegram_message_ids?: number[] | null
          telegram_procurement_message_id?: number | null
          transport_company?: string | null
          unit?: string | null
          updated_at?: string | null
          warehouse_id?: string | null
          waybill_number?: string | null
        }
        Update: {
          actual_arrival_date?: string | null
          amount?: number | null
          amount_2?: number | null
          amount_3?: number | null
          applicant?: string | null
          applicant_user_id?: string | null
          archived?: boolean
          availability_delivery_time?: string | null
          awaiting_comment_from?: string | null
          client_id?: string | null
          comments?: string | null
          contractor?: string | null
          created_at?: string | null
          created_by?: string | null
          delivery_date?: string | null
          description?: string
          document_url?: string | null
          document_urls?: string[] | null
          equipment_id?: string | null
          estimated_delivery_days?: number | null
          executor?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_number_2?: string | null
          invoice_number_3?: string | null
          invoice_routed_at?: string | null
          invoice_routed_by?: string | null
          invoice_routing?: string | null
          is_project?: boolean
          object_id?: string | null
          operation_type?: string | null
          order_days?: number | null
          organization_id?: string | null
          parent_request_id?: string | null
          payment_date?: string | null
          payment_percent?: number | null
          payment_percentage?: number | null
          payment_status?: string | null
          photo_url?: string | null
          photo_urls?: string[] | null
          planned_delivery_date?: string | null
          priority?: string | null
          product_id?: string | null
          quantity?: number | null
          received_by?: string | null
          request_date?: string
          request_number?: string
          request_type?: string | null
          reserve_on_warehouse?: boolean | null
          shipment_date?: string | null
          status?: string
          telegram_message_id?: number | null
          telegram_message_ids?: number[] | null
          telegram_procurement_message_id?: number | null
          transport_company?: string | null
          unit?: string | null
          updated_at?: string | null
          warehouse_id?: string | null
          waybill_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "request_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_parent_request_id_fkey"
            columns: ["parent_request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "warehouse_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_request_filters: {
        Row: {
          created_at: string
          filters: Json
          id: string
          is_default: boolean | null
          name: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          is_default?: boolean | null
          name: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          is_default?: boolean | null
          name?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_request_filters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_items: {
        Row: {
          created_at: string
          id: string
          material_name: string
          organization_id: string
          product_id: string | null
          quantity: number | null
          shipment_id: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_name: string
          organization_id: string
          product_id?: string | null
          quantity?: number | null
          shipment_id: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          material_name?: string
          organization_id?: string
          product_id?: string | null
          quantity?: number | null
          shipment_id?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "request_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      spare_part_deadstock: {
        Row: {
          article: string | null
          buyer: string | null
          comment: string | null
          created_at: string
          created_by: string | null
          cross_numbers: string[]
          id: string
          is_archived: boolean
          manufacturer: string | null
          market_price: number | null
          min_sale_price: number | null
          name: string
          organization_id: string
          photos: string[]
          quantity: number
          reason: string | null
          sale_price: number | null
          sold_at: string | null
          updated_at: string
        }
        Insert: {
          article?: string | null
          buyer?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          cross_numbers?: string[]
          id?: string
          is_archived?: boolean
          manufacturer?: string | null
          market_price?: number | null
          min_sale_price?: number | null
          name: string
          organization_id: string
          photos?: string[]
          quantity?: number
          reason?: string | null
          sale_price?: number | null
          sold_at?: string | null
          updated_at?: string
        }
        Update: {
          article?: string | null
          buyer?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          cross_numbers?: string[]
          id?: string
          is_archived?: boolean
          manufacturer?: string | null
          market_price?: number | null
          min_sale_price?: number | null
          name?: string
          organization_id?: string
          photos?: string[]
          quantity?: number
          reason?: string | null
          sale_price?: number | null
          sold_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spare_part_deadstock_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spare_part_deadstock_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      spare_part_equipment: {
        Row: {
          created_at: string
          equipment_id: string
          id: string
          organization_id: string
          spare_part_id: string
        }
        Insert: {
          created_at?: string
          equipment_id: string
          id?: string
          organization_id: string
          spare_part_id: string
        }
        Update: {
          created_at?: string
          equipment_id?: string
          id?: string
          organization_id?: string
          spare_part_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spare_part_equipment_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spare_part_equipment_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spare_part_equipment_spare_part_id_fkey"
            columns: ["spare_part_id"]
            isOneToOne: false
            referencedRelation: "spare_parts"
            referencedColumns: ["id"]
          },
        ]
      }
      spare_part_movements: {
        Row: {
          buyer: string | null
          comment: string | null
          created_at: string
          created_by: string | null
          equipment_id: string | null
          id: string
          object_id: string | null
          organization_id: string
          quantity: number
          reason: string | null
          responsible_user_id: string | null
          spare_part_id: string
          type: string
          unit_price: number | null
        }
        Insert: {
          buyer?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          equipment_id?: string | null
          id?: string
          object_id?: string | null
          organization_id: string
          quantity: number
          reason?: string | null
          responsible_user_id?: string | null
          spare_part_id: string
          type: string
          unit_price?: number | null
        }
        Update: {
          buyer?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          equipment_id?: string | null
          id?: string
          object_id?: string | null
          organization_id?: string
          quantity?: number
          reason?: string | null
          responsible_user_id?: string | null
          spare_part_id?: string
          type?: string
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "spare_part_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spare_part_movements_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spare_part_movements_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "request_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spare_part_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spare_part_movements_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spare_part_movements_spare_part_id_fkey"
            columns: ["spare_part_id"]
            isOneToOne: false
            referencedRelation: "spare_parts"
            referencedColumns: ["id"]
          },
        ]
      }
      spare_parts: {
        Row: {
          article: string
          avg_cost: number | null
          category: string | null
          cell: string | null
          created_at: string
          created_by: string | null
          cross_numbers: string[]
          equipment_model: string | null
          equipment_number: string | null
          equipment_type: string | null
          id: string
          is_archived: boolean
          last_receipt_at: string | null
          manufacturer: string | null
          min_stock: number
          name: string
          notes: string | null
          organization_id: string
          photos: string[]
          price: number | null
          purchase_price: number | null
          quantity: number | null
          rack: string | null
          shelf: string | null
          storage_location: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          article: string
          avg_cost?: number | null
          category?: string | null
          cell?: string | null
          created_at?: string
          created_by?: string | null
          cross_numbers?: string[]
          equipment_model?: string | null
          equipment_number?: string | null
          equipment_type?: string | null
          id?: string
          is_archived?: boolean
          last_receipt_at?: string | null
          manufacturer?: string | null
          min_stock?: number
          name: string
          notes?: string | null
          organization_id: string
          photos?: string[]
          price?: number | null
          purchase_price?: number | null
          quantity?: number | null
          rack?: string | null
          shelf?: string | null
          storage_location?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          article?: string
          avg_cost?: number | null
          category?: string | null
          cell?: string | null
          created_at?: string
          created_by?: string | null
          cross_numbers?: string[]
          equipment_model?: string | null
          equipment_number?: string | null
          equipment_type?: string | null
          id?: string
          is_archived?: boolean
          last_receipt_at?: string | null
          manufacturer?: string | null
          min_stock?: number
          name?: string
          notes?: string | null
          organization_id?: string
          photos?: string[]
          price?: number | null
          purchase_price?: number | null
          quantity?: number | null
          rack?: string | null
          shelf?: string | null
          storage_location?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spare_parts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          comment: string | null
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          product_id: string
          quantity: number
          request_id: string | null
          type: string
          warehouse_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          product_id: string
          quantity: number
          request_id?: string | null
          type: string
          warehouse_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          product_id?: string
          quantity?: number
          request_id?: string | null
          type?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "warehouse_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          description: string | null
          features: Json
          id: string
          is_active: boolean | null
          max_requests_per_month: number | null
          max_users: number | null
          name: string
          price_monthly: number
          price_yearly: number | null
          slug: string
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean | null
          max_requests_per_month?: number | null
          max_users?: number | null
          name: string
          price_monthly: number
          price_yearly?: number | null
          slug: string
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean | null
          max_requests_per_month?: number | null
          max_users?: number | null
          name?: string
          price_monthly?: number
          price_yearly?: number | null
          slug?: string
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          canceled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          organization_id: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          organization_id: string
          plan_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          organization_id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_list_items: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          extraction_failed: boolean
          id: string
          list_id: string
          note: string | null
          organization_id: string
          payment_terms: string | null
          phone: string | null
          position: number
          region: string
          supplier_name: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          extraction_failed?: boolean
          id?: string
          list_id: string
          note?: string | null
          organization_id: string
          payment_terms?: string | null
          phone?: string | null
          position?: number
          region?: string
          supplier_name?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          extraction_failed?: boolean
          id?: string
          list_id?: string
          note?: string | null
          organization_id?: string
          payment_terms?: string | null
          phone?: string | null
          position?: number
          region?: string
          supplier_name?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "supplier_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_lists: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          object_id: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          object_id?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          object_id?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          bank_account: string | null
          bank_name: string | null
          bik: string | null
          category: string
          city: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          inn: string | null
          kpp: string | null
          name: string
          nomenclature: string | null
          notes: string | null
          ogrn: string | null
          organization_id: string
          phone: string | null
          reliability: string
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          bank_name?: string | null
          bik?: string | null
          category?: string
          city?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          inn?: string | null
          kpp?: string | null
          name: string
          nomenclature?: string | null
          notes?: string | null
          ogrn?: string | null
          organization_id: string
          phone?: string | null
          reliability?: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          bank_name?: string | null
          bik?: string | null
          category?: string
          city?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          inn?: string | null
          kpp?: string | null
          name?: string
          nomenclature?: string | null
          notes?: string | null
          ogrn?: string | null
          organization_id?: string
          phone?: string | null
          reliability?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_notifications: {
        Row: {
          created_at: string
          id: string
          notified: boolean
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notified?: boolean
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notified?: boolean
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          completed_at: string | null
          completed_by: string | null
          completion_comment: string | null
          completion_status: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          organization_id: string
          priority: string
          status: string
          task_number: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_comment?: string | null
          completion_status?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id: string
          priority?: string
          status?: string
          task_number?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_comment?: string | null
          completion_status?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id?: string
          priority?: string
          status?: string
          task_number?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_groups: {
        Row: {
          chat_type: string | null
          created_at: string
          group_id: string
          group_name: string
          id: string
          is_active: boolean
          is_discovered: boolean
          last_api_at: string | null
          last_api_status: number | null
          last_message_at: string | null
          notification_type: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          chat_type?: string | null
          created_at?: string
          group_id: string
          group_name: string
          id?: string
          is_active?: boolean
          is_discovered?: boolean
          last_api_at?: string | null
          last_api_status?: number | null
          last_message_at?: string | null
          notification_type?: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          chat_type?: string | null
          created_at?: string
          group_id?: string
          group_name?: string
          id?: string
          is_active?: boolean
          is_discovered?: boolean
          last_api_at?: string | null
          last_api_status?: number | null
          last_message_at?: string | null
          notification_type?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_settings: {
        Row: {
          auto_send_on_create: boolean | null
          auto_send_on_status_change: boolean | null
          auto_send_to_procurement: boolean | null
          bot_token: string | null
          chat_id: string | null
          created_at: string | null
          deadline_chat_id: string | null
          id: string
          invoice_chat_id: string | null
          organization_id: string
          procurement_chat_id: string | null
          updated_at: string | null
        }
        Insert: {
          auto_send_on_create?: boolean | null
          auto_send_on_status_change?: boolean | null
          auto_send_to_procurement?: boolean | null
          bot_token?: string | null
          chat_id?: string | null
          created_at?: string | null
          deadline_chat_id?: string | null
          id?: string
          invoice_chat_id?: string | null
          organization_id: string
          procurement_chat_id?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_send_on_create?: boolean | null
          auto_send_on_status_change?: boolean | null
          auto_send_to_procurement?: boolean | null
          bot_token?: string | null
          chat_id?: string | null
          created_at?: string | null
          deadline_chat_id?: string | null
          id?: string
          invoice_chat_id?: string | null
          organization_id?: string
          procurement_chat_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_webhook_logs: {
        Row: {
          chat_id: string | null
          created_at: string
          event_type: string | null
          group_id: string | null
          group_name: string | null
          id: string
          payload: Json
        }
        Insert: {
          chat_id?: string | null
          created_at?: string
          event_type?: string | null
          group_id?: string | null
          group_name?: string | null
          id?: string
          payload: Json
        }
        Update: {
          chat_id?: string | null
          created_at?: string
          event_type?: string | null
          group_id?: string | null
          group_name?: string | null
          id?: string
          payload?: Json
        }
        Relationships: []
      }
      user_organizations: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["organization_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          allowed: boolean
          created_at: string
          id: string
          organization_id: string
          permission_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string
          id?: string
          organization_id: string
          permission_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          id?: string
          organization_id?: string
          permission_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_products: {
        Row: {
          article: string | null
          category: string | null
          created_at: string
          equipment_id: string | null
          id: string
          min_stock: number | null
          name: string
          organization_id: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          article?: string | null
          category?: string | null
          created_at?: string
          equipment_id?: string | null
          id?: string
          min_stock?: number | null
          name: string
          organization_id: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          article?: string | null
          category?: string | null
          created_at?: string
          equipment_id?: string | null
          id?: string
          min_stock?: number | null
          name?: string
          organization_id?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_products_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          object_id: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          object_id?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          object_id?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "request_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _priority_emoji: { Args: { _p: string }; Returns: string }
      _status_emoji: { Args: { _s: string }; Returns: string }
      build_assigned_message: {
        Args: { r: Database["public"]["Tables"]["requests"]["Row"] }
        Returns: string
      }
      build_assigned_message_by_id: {
        Args: { _request_id: string }
        Returns: string
      }
      build_assigned_message_v2: {
        Args: { r: Database["public"]["Tables"]["requests"]["Row"] }
        Returns: string
      }
      build_incoming_message: {
        Args: { r: Database["public"]["Tables"]["requests"]["Row"] }
        Returns: string
      }
      build_incoming_message_v2: {
        Args: { r: Database["public"]["Tables"]["requests"]["Row"] }
        Returns: string
      }
      build_request_message: {
        Args: { r: Database["public"]["Tables"]["requests"]["Row"] }
        Returns: string
      }
      build_request_message_by_id: {
        Args: { _request_id: string }
        Returns: string
      }
      check_delivery_arrived: { Args: never; Returns: undefined }
      check_request_deadlines: { Args: never; Returns: undefined }
      check_upcoming_events: { Args: never; Returns: undefined }
      cleanup_notification_dedup: { Args: never; Returns: undefined }
      enqueue_notification: {
        Args: {
          _dedup_suffix?: string
          _entity_id: string
          _entity_type: string
          _event_type: string
          _org_id: string
          _payload?: Json
          _text: string
        }
        Returns: number
      }
      ensure_user_initialized: {
        Args: { _org_name?: string }
        Returns: undefined
      }
      filter_element_stock: { Args: { _id: string }; Returns: number }
      find_user_by_full_name: {
        Args: { _name: string; _org_id: string }
        Returns: string
      }
      get_client_org_id: { Args: { _user_id: string }; Returns: string }
      get_executor_buttons: { Args: { _org_id: string }; Returns: Json }
      get_invitation_by_token: {
        Args: { _token: string }
        Returns: {
          email: string
          expires_at: string
          id: string
          name: string
          organization_id: string
          used_at: string
        }[]
      }
      get_my_contact_info: {
        Args: never
        Returns: {
          phone: string
          telegram_user_id: number
        }[]
      }
      get_notification_mode: { Args: { _org_id: string }; Returns: string }
      get_org_subscription_limits: {
        Args: { _org_id: string }
        Returns: {
          max_requests_per_month: number
          max_users: number
          plan_name: string
        }[]
      }
      get_organization_safe: {
        Args: { _org_id: string }
        Returns: {
          contact_email: string
          contact_phone: string
          created_at: string
          description: string
          id: string
          logo_url: string
          name: string
          primary_color: string
          secondary_color: string
          telegram_auto_send_on_create: boolean
          telegram_auto_send_on_status_change: boolean
          updated_at: string
        }[]
      }
      get_subscription_safe: {
        Args: { _org_id: string }
        Returns: {
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          organization_id: string
          plan_id: string
          status: string
          trial_ends_at: string
          updated_at: string
        }[]
      }
      get_telegram_auto_send_settings: {
        Args: { _org_id: string }
        Returns: {
          auto_send_on_create: boolean
          auto_send_on_status_change: boolean
        }[]
      }
      get_telegram_credentials: {
        Args: { _org_id: string }
        Returns: {
          telegram_auto_send_on_create: boolean
          telegram_auto_send_on_status_change: boolean
          telegram_auto_send_to_procurement: boolean
          telegram_bot_token: string
          telegram_chat_id: string
          telegram_deadline_chat_id: string
          telegram_invoice_chat_id: string
          telegram_procurement_chat_id: string
        }[]
      }
      has_active_subscription: { Args: { _org_id: string }; Returns: boolean }
      is_client: { Args: { _user_id: string }; Returns: boolean }
      is_telegram_configured: { Args: { _org_id: string }; Returns: boolean }
      log_audit_event: {
        Args: {
          _action: string
          _entity_id?: string
          _entity_type: string
          _new_values?: Json
          _old_values?: Json
          _organization_id: string
        }
        Returns: string
      }
      planner_upsert_auto_task: {
        Args: {
          _assignee: string
          _due: string
          _org: string
          _priority: string
          _request_id: string
          _rule: string
          _title: string
        }
        Returns: string
      }
      seed_notification_routing: {
        Args: { _org_id: string }
        Returns: undefined
      }
      spare_part_stock: { Args: { _id: string }; Returns: number }
      telegram_bot_configured: { Args: { _org_id: string }; Returns: boolean }
      user_can_create_requests: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_edit_requests: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_view_request: {
        Args: { _applicant_user_id: string; _org_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_org_access: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["organization_role"]
          _user_id: string
        }
        Returns: boolean
      }
      user_has_permission: {
        Args: { _org_id: string; _permission_key: string; _user_id: string }
        Returns: boolean
      }
      user_is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      organization_role: "owner" | "admin" | "member" | "editor" | "viewer"
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
    Enums: {
      organization_role: ["owner", "admin", "member", "editor", "viewer"],
    },
  },
} as const
