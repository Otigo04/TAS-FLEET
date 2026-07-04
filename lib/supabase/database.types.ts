export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type CompanyRole = 'owner' | 'admin' | 'member'

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      company_users: {
        Row: {
          company_id: string
          user_id: string
          role: CompanyRole
          created_at: string
        }
        Insert: {
          company_id: string
          user_id: string
          role?: CompanyRole
          created_at?: string
        }
        Update: {
          company_id?: string
          user_id?: string
          role?: CompanyRole
          created_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          id: string
          company_id: string
          actor_id: string | null
          actor_name: string
          table_name: string
          record_id: string | null
          action: 'insert' | 'update' | 'delete'
          old_data: Json | null
          new_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          actor_id?: string | null
          actor_name?: string
          table_name: string
          record_id?: string | null
          action: 'insert' | 'update' | 'delete'
          old_data?: Json | null
          new_data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          actor_id?: string | null
          actor_name?: string
          table_name?: string
          record_id?: string | null
          action?: 'insert' | 'update' | 'delete'
          old_data?: Json | null
          new_data?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      absences: {
        Row: {
          id: string
          company_id: string
          driver_id: string
          type: 'urlaub' | 'krankheit' | 'sonstiges'
          start_date: string
          end_date: string
          reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          driver_id: string
          type: 'urlaub' | 'krankheit' | 'sonstiges'
          start_date: string
          end_date: string
          reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          driver_id?: string
          type?: 'urlaub' | 'krankheit' | 'sonstiges'
          start_date?: string
          end_date?: string
          reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          id: string
          company_id: string
          name: string
          first_name: string | null
          last_name: string | null
          street: string | null
          street_number: string | null
          postal_code: string | null
          city: string | null
          birth_date: string | null
          nationality: string | null
          marital_status: string | null
          tax_class: string | null
          tax_id: string | null
          social_security_number: string | null
          health_insurance: string | null
          employment_start_date: string | null
          employed_as: string | null
          bank_name: string | null
          iban: string | null
          pschein_valid_until: string | null
          district: string | null
          current_shift: string
          notes: string[]
          weekly_target_hours: number | null
          annual_vacation_days: number | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          first_name?: string | null
          last_name?: string | null
          street?: string | null
          street_number?: string | null
          postal_code?: string | null
          city?: string | null
          birth_date?: string | null
          nationality?: string | null
          marital_status?: string | null
          tax_class?: string | null
          tax_id?: string | null
          social_security_number?: string | null
          health_insurance?: string | null
          employment_start_date?: string | null
          employed_as?: string | null
          bank_name?: string | null
          iban?: string | null
          pschein_valid_until?: string | null
          district?: string | null
          current_shift: string
          notes?: string[]
          weekly_target_hours?: number | null
          annual_vacation_days?: number | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          first_name?: string | null
          last_name?: string | null
          street?: string | null
          street_number?: string | null
          postal_code?: string | null
          city?: string | null
          birth_date?: string | null
          nationality?: string | null
          marital_status?: string | null
          tax_class?: string | null
          tax_id?: string | null
          social_security_number?: string | null
          health_insurance?: string | null
          employment_start_date?: string | null
          employed_as?: string | null
          bank_name?: string | null
          iban?: string | null
          pschein_valid_until?: string | null
          district?: string | null
          current_shift?: string
          notes?: string[]
          weekly_target_hours?: number | null
          annual_vacation_days?: number | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      shift_assignments: {
        Row: {
          id: string
          company_id: string
          shift_date: string
          shift_slot: 'Frueh' | 'Spaet' | 'Nacht'
          driver_id: string
          vehicle_id: string
          uber_zone: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          shift_date: string
          shift_slot: 'Frueh' | 'Spaet' | 'Nacht'
          driver_id: string
          vehicle_id: string
          uber_zone: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          shift_date?: string
          shift_slot?: 'Frueh' | 'Spaet' | 'Nacht'
          driver_id?: string
          vehicle_id?: string
          uber_zone?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      compliance_documents: {
        Row: {
          id: string
          company_id: string
          scope_type: 'driver' | 'vehicle'
          driver_id: string | null
          vehicle_id: string | null
          doc_type: string
          due_date: string
          status: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          scope_type: 'driver' | 'vehicle'
          driver_id?: string | null
          vehicle_id?: string | null
          doc_type: string
          due_date: string
          status: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          scope_type?: 'driver' | 'vehicle'
          driver_id?: string | null
          vehicle_id?: string | null
          doc_type?: string
          due_date?: string
          status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      incidents: {
        Row: {
          id: string
          company_id: string
          incident_type: string
          driver_id: string | null
          vehicle_id: string | null
          occurred_on: string
          severity: string
          status: string
          description: string
          cost_eur: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          incident_type: string
          driver_id?: string | null
          vehicle_id?: string | null
          occurred_on: string
          severity: string
          status: string
          description: string
          cost_eur?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          incident_type?: string
          driver_id?: string | null
          vehicle_id?: string | null
          occurred_on?: string
          severity?: string
          status?: string
          description?: string
          cost_eur?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          id: string
          company_id: string
          license_plate: string
          model: string
          status: string
          build_year: number | null
          vin: string | null
          color: string | null
          fuel_type: string | null
          hu_due: string | null
          insurance_company: string | null
          insurance_number: string | null
          insurance_due: string | null
          purchase_date: string | null
          mileage_km: number | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          license_plate: string
          model: string
          status: string
          build_year?: number | null
          vin?: string | null
          color?: string | null
          fuel_type?: string | null
          hu_due?: string | null
          insurance_company?: string | null
          insurance_number?: string | null
          insurance_due?: string | null
          purchase_date?: string | null
          mileage_km?: number | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          license_plate?: string
          model?: string
          status?: string
          build_year?: number | null
          vin?: string | null
          color?: string | null
          fuel_type?: string | null
          hu_due?: string | null
          insurance_company?: string | null
          insurance_number?: string | null
          insurance_due?: string | null
          purchase_date?: string | null
          mileage_km?: number | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          role: 'admin'
          first_name: string | null
          last_name: string | null
          avatar_url: string | null
          is_superadmin: boolean
          created_at: string
        }
        Insert: {
          id: string
          role?: 'admin'
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          is_superadmin?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          role?: 'admin'
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          is_superadmin?: boolean
          created_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          company_id: string
          key: string
          value: Json
          updated_at: string
        }
        Insert: {
          company_id: string
          key: string
          value?: Json
          updated_at?: string
        }
        Update: {
          company_id?: string
          key?: string
          value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          id: string
          company_id: string
          scope_type: 'driver' | 'vehicle' | 'incident' | 'compliance' | 'company'
          entity_id: string
          label: string | null
          storage_path: string
          mime_type: string | null
          size_bytes: number | null
          uploaded_by: string | null
          uploaded_by_name: string
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          scope_type: 'driver' | 'vehicle' | 'incident' | 'compliance' | 'company'
          entity_id: string
          label?: string | null
          storage_path: string
          mime_type?: string | null
          size_bytes?: number | null
          uploaded_by?: string | null
          uploaded_by_name?: string
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          scope_type?: 'driver' | 'vehicle' | 'incident' | 'compliance' | 'company'
          entity_id?: string
          label?: string | null
          storage_path?: string
          mime_type?: string | null
          size_bytes?: number | null
          uploaded_by?: string | null
          uploaded_by_name?: string
          created_at?: string
        }
        Relationships: []
      }
      timesheet_entries: {
        Row: {
          id: string
          company_id: string
          driver_id: string
          work_date: string
          start_time: string | null
          end_time: string | null
          pause: string | null
          work_hours: string | null
          overtime_hours: string | null
          work_hours_num: number
          overtime_num: number
          note: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          driver_id: string
          work_date: string
          start_time?: string | null
          end_time?: string | null
          pause?: string | null
          work_hours?: string | null
          overtime_hours?: string | null
          work_hours_num?: number
          overtime_num?: number
          note?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          driver_id?: string
          work_date?: string
          start_time?: string | null
          end_time?: string | null
          pause?: string | null
          work_hours?: string | null
          overtime_hours?: string | null
          work_hours_num?: number
          overtime_num?: number
          note?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      finance_entries: {
        Row: {
          id: string
          company_id: string
          entry_date: string
          kind: 'einnahme' | 'ausgabe'
          category: string
          description: string | null
          amount_eur: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          entry_date: string
          kind: 'einnahme' | 'ausgabe'
          category?: string
          description?: string | null
          amount_eur: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          entry_date?: string
          kind?: 'einnahme' | 'ausgabe'
          category?: string
          description?: string | null
          amount_eur?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_reads: {
        Row: {
          user_id: string
          company_id: string
          item_key: string
          read_at: string
        }
        Insert: {
          user_id: string
          company_id: string
          item_key: string
          read_at?: string
        }
        Update: {
          user_id?: string
          company_id?: string
          item_key?: string
          read_at?: string
        }
        Relationships: []
      }
      driver_notes: {
        Row: {
          id: string
          company_id: string
          driver_id: string
          author_id: string | null
          author_name: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          driver_id: string
          author_id?: string | null
          author_name?: string
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          driver_id?: string
          author_id?: string | null
          author_name?: string
          body?: string
          created_at?: string
        }
        Relationships: []
      }
      vehicle_maintenance: {
        Row: {
          id: string
          company_id: string
          vehicle_id: string
          service_date: string
          service_type: string
          mileage_km: number | null
          cost_eur: number
          note: string | null
          next_due_date: string | null
          next_due_km: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          vehicle_id: string
          service_date: string
          service_type: string
          mileage_km?: number | null
          cost_eur?: number
          note?: string | null
          next_due_date?: string | null
          next_due_km?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          vehicle_id?: string
          service_date?: string
          service_type?: string
          mileage_km?: number | null
          cost_eur?: number
          note?: string | null
          next_due_date?: string | null
          next_due_km?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      vehicle_costs: {
        Row: {
          id: string
          company_id: string
          vehicle_id: string
          cost_date: string
          category: string
          cost_type: string
          amount_eur: number
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          vehicle_id: string
          cost_date: string
          category: string
          cost_type?: string
          amount_eur?: number
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          vehicle_id?: string
          cost_date?: string
          category?: string
          cost_type?: string
          amount_eur?: number
          note?: string | null
          created_at?: string
        }
        Relationships: []
      }
      vehicle_revenue: {
        Row: {
          id: string
          company_id: string
          vehicle_id: string
          revenue_date: string
          amount_eur: number
          note: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          vehicle_id: string
          revenue_date: string
          amount_eur?: number
          note?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          vehicle_id?: string
          revenue_date?: string
          amount_eur?: number
          note?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_company_with_owner: {
        Args: { company_name: string }
        Returns: {
          id: string
          name: string
          slug: string
          created_at: string
        }
      }
      get_user_company_ids: {
        Args: Record<string, never>
        Returns: string[]
      }
      get_user_admin_company_ids: {
        Args: Record<string, never>
        Returns: string[]
      }
    }
    Enums: {
      company_role: CompanyRole
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
