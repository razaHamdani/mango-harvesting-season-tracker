// Auto-generated placeholder types matching supabase/schema.sql
// Replace with: npx supabase gen types typescript --project-id <project-id> > src/types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: "landlord" | "contractor" | "admin";
          full_name: string;
          email: string;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: "landlord" | "contractor" | "admin";
          full_name: string;
          email: string;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: "landlord" | "contractor" | "admin";
          full_name?: string;
          email?: string;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      farms: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          acreage: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          acreage: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          acreage?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      seasons: {
        Row: {
          id: string;
          owner_id: string;
          year: number;
          status: "draft" | "active" | "closed";
          contractor_name: string;
          contractor_phone: string | null;
          contractor_cnic: string | null;
          predetermined_amount: number;
          spray_landlord_pct: number;
          fertilizer_landlord_pct: number;
          agreed_boxes: number;
          created_at: string;
          closed_at: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          year: number;
          status?: "draft" | "active" | "closed";
          contractor_name: string;
          contractor_phone?: string | null;
          contractor_cnic?: string | null;
          predetermined_amount: number;
          spray_landlord_pct?: number;
          fertilizer_landlord_pct?: number;
          agreed_boxes?: number;
          created_at?: string;
          closed_at?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          year?: number;
          status?: "draft" | "active" | "closed";
          contractor_name?: string;
          contractor_phone?: string | null;
          contractor_cnic?: string | null;
          predetermined_amount?: number;
          spray_landlord_pct?: number;
          fertilizer_landlord_pct?: number;
          agreed_boxes?: number;
          created_at?: string;
          closed_at?: string | null;
        };
        Relationships: [];
      };
      season_farms: {
        Row: {
          id: string;
          season_id: string;
          farm_id: string;
        };
        Insert: {
          id?: string;
          season_id: string;
          farm_id: string;
        };
        Update: {
          id?: string;
          season_id?: string;
          farm_id?: string;
        };
        Relationships: [];
      };
      installments: {
        Row: {
          id: string;
          season_id: string;
          installment_number: number;
          expected_amount: number;
          due_date: string;
          paid_amount: number | null;
          paid_date: string | null;
          receipt_photo_path: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          season_id: string;
          installment_number: number;
          expected_amount: number;
          due_date: string;
          paid_amount?: number | null;
          paid_date?: string | null;
          receipt_photo_path?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          season_id?: string;
          installment_number?: number;
          expected_amount?: number;
          due_date?: string;
          paid_amount?: number | null;
          paid_date?: string | null;
          receipt_photo_path?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      activities: {
        Row: {
          id: string;
          season_id: string;
          farm_id: string;
          type: "spray" | "water" | "fertilize" | "harvest";
          activity_date: string;
          item_name: string | null;
          meter_reading: number | null;
          boxes_collected: number | null;
          description: string | null;
          photo_path: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          season_id: string;
          farm_id: string;
          type: "spray" | "water" | "fertilize" | "harvest";
          activity_date: string;
          item_name?: string | null;
          meter_reading?: number | null;
          boxes_collected?: number | null;
          description?: string | null;
          photo_path?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          season_id?: string;
          farm_id?: string;
          type?: "spray" | "water" | "fertilize" | "harvest";
          activity_date?: string;
          item_name?: string | null;
          meter_reading?: number | null;
          boxes_collected?: number | null;
          description?: string | null;
          photo_path?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          id: string;
          season_id: string;
          farm_id: string | null;
          category: "electricity" | "spray" | "fertilizer" | "labor" | "misc";
          amount: number;
          landlord_cost: number;
          expense_date: string;
          description: string | null;
          photo_path: string | null;
          linked_activity_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          season_id: string;
          farm_id?: string | null;
          category: "electricity" | "spray" | "fertilizer" | "labor" | "misc";
          amount: number;
          landlord_cost: number;
          expense_date: string;
          description?: string | null;
          photo_path?: string | null;
          linked_activity_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          season_id?: string;
          farm_id?: string | null;
          category?: "electricity" | "spray" | "fertilizer" | "labor" | "misc";
          amount?: number;
          landlord_cost?: number;
          expense_date?: string;
          description?: string | null;
          photo_path?: string | null;
          linked_activity_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      workers: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          phone: string | null;
          monthly_salary: number | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          phone?: string | null;
          monthly_salary?: number | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          phone?: string | null;
          monthly_salary?: number | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      get_season_insights: {
        Args: { p_season_id: string };
        Returns: Json;
      };
    };
    Views: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience aliases
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Profile = Tables<"profiles">;
export type Farm = Tables<"farms">;
export type Season = Tables<"seasons">;
export type SeasonFarm = Tables<"season_farms">;
export type Installment = Tables<"installments">;
export type Activity = Tables<"activities">;
export type Expense = Tables<"expenses">;
export type Worker = Tables<"workers">;

export type SeasonStatus = Season["status"];
export type ActivityType = Activity["type"];
export type ExpenseCategory = Expense["category"];
export type ProfileRole = Profile["role"];
