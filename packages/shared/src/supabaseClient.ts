import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Both apps call this with their own env vars (Next.js: NEXT_PUBLIC_*, Expo: EXPO_PUBLIC_*).
// Never pass a service-role key here — this client is used from the browser/app, RLS does the enforcing.
export function createSupabaseClient(url: string, anonKey: string): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error("Supabase URL and anon key are required to create a client");
  }
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}
