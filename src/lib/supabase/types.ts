/**
 * Supabase Database type definitions.
 *
 * Generated manually to match the SQL schema in
 * supabase/migrations/00001_initial_schema.sql
 *
 * These types provide autocomplete and type safety for all
 * Supabase client queries (select, insert, update, delete).
 */

export interface Database {
  public: {
    Tables: {
      jobs: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          client: string;
          default_hourly_rate: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          client: string;
          default_hourly_rate: number;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          client?: string;
          default_hourly_rate?: number;
          active?: boolean;
          created_at?: string;
        };
      };
      work_entries: {
        Row: {
          id: string;
          user_id: string;
          job_id: string;
          date: string;
          start_time: string;
          end_time: string;
          hourly_rate_used: number;
          kilometers: number;
          km_rate_used: number;
          labor_total: number;
          km_total: number;
          expenses_total: number;
          grand_total: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          job_id: string;
          date: string;
          start_time: string;
          end_time: string;
          hourly_rate_used: number;
          kilometers: number;
          km_rate_used: number;
          labor_total: number;
          km_total: number;
          expenses_total: number;
          grand_total: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          job_id?: string;
          date?: string;
          start_time?: string;
          end_time?: string;
          hourly_rate_used?: number;
          kilometers?: number;
          km_rate_used?: number;
          labor_total?: number;
          km_total?: number;
          expenses_total?: number;
          grand_total?: number;
          created_at?: string;
        };
      };
      expenses: {
        Row: {
          id: string;
          user_id: string;
          work_entry_id: string;
          amount: number;
          category: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          work_entry_id: string;
          amount: number;
          category: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          work_entry_id?: string;
          amount?: number;
          category?: string;
          created_at?: string;
        };
      };
    };
  };
}
