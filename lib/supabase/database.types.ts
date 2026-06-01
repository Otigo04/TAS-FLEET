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
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          pschein_valid_until: string
          district: string
          current_shift: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          pschein_valid_until?: string
          district?: string
          current_shift?: string
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
