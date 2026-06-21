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
