import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS entirely. Only ever import this into server actions /
// route handlers, never into anything that ships to the browser. Needs SUPABASE_SERVICE_ROLE_KEY
// (no NEXT_PUBLIC_ prefix) set in apps/web/.env.local — get it from Project Settings → API →
// "secret" key. Keep it out of chat/commits.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to apps/web/.env.local (Project Settings → API → secret key)."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
