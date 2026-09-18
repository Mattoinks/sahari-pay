import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Service-role client for Edge Functions only — never ship the service role key to a client app.
export function createAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}
