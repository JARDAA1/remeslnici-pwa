/**
 * Supabase browser client — lazy singleton.
 *
 * Uses the public anon key. All data access is filtered through
 * Row Level Security policies that match auth.uid() to user_id.
 *
 * The client is created lazily on first call to getSupabase().
 * This avoids throwing during Next.js build / SSR when env
 * variables are not yet available.
 *
 * Environment variables (set in .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL      — project URL (e.g. https://xyz.supabase.co)
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY — public anon key (safe for browser)
 *
 * NEVER use the service_role key in client code.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let client: SupabaseClient<Database> | null = null;

/**
 * Returns the singleton Supabase client.
 * Throws at runtime (not at import / build time) if env vars are missing.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable.");
  }
  if (!anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.");
  }

  client = createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return client;
}
