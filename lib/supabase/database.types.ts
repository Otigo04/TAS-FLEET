export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      drivers: {
        Row: {
          id: string
          name: string
          pschein_valid_until: string
          district: string
          current_shift: string
          notes: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          pschein_valid_until: string
          district: string
          current_shift: string
          notes?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          pschein_valid_until?: string
          district?: string
          current_shift?: string
          notes?: string[]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      shift_assignments: {
        Row: {
          id: string
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
          scope_type: 'driver' | 'vehicle'
          driver_id: string | null
          vehicle_id: string | null
          doc_type: 'pschein' | 'hu' | 'versicherung' | 'uber_freigabe'
          due_date: string
          status: 'valid' | 'expiring' | 'expired' | 'pending'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          scope_type: 'driver' | 'vehicle'
          driver_id?: string | null
          vehicle_id?: string | null
          doc_type: 'pschein' | 'hu' | 'versicherung' | 'uber_freigabe'
          due_date: string
          status: 'valid' | 'expiring' | 'expired' | 'pending'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          scope_type?: 'driver' | 'vehicle'
          driver_id?: string | null
          vehicle_id?: string | null
          doc_type?: 'pschein' | 'hu' | 'versicherung' | 'uber_freigabe'
          due_date?: string
          status?: 'valid' | 'expiring' | 'expired' | 'pending'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      incidents: {
        Row: {
          id: string
          incident_type: 'schaeden' | 'bussgelder' | 'sperrungen'
          driver_id: string | null
          vehicle_id: string | null
          occurred_on: string
          severity: 'low' | 'medium' | 'high'
          status: 'open' | 'in_progress' | 'resolved'
          description: string
          cost_eur: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          incident_type: 'schaeden' | 'bussgelder' | 'sperrungen'
          driver_id?: string | null
          vehicle_id?: string | null
          occurred_on: string
          severity: 'low' | 'medium' | 'high'
          status: 'open' | 'in_progress' | 'resolved'
          description: string
          cost_eur?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          incident_type?: 'schaeden' | 'bussgelder' | 'sperrungen'
          driver_id?: string | null
          vehicle_id?: string | null
          occurred_on?: string
          severity?: 'low' | 'medium' | 'high'
          status?: 'open' | 'in_progress' | 'resolved'
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
          license_plate: string
          model: string
          status: 'active' | 'maintenance' | 'offline'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          license_plate: string
          model: string
          status: 'active' | 'maintenance' | 'offline'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          license_plate?: string
          model?: string
          status?: 'active' | 'maintenance' | 'offline'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          role: 'admin'
          created_at: string
        }
        Insert: {
          id: string
          role?: 'admin'
          created_at?: string
        }
        Update: {
          id?: string
          role?: 'admin'
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
