import { createBrowserClient } from "@supabase/ssr";

// Use this in Client Components. Server Components/actions/middleware use ./server.ts instead
// so the session cookie is read/refreshed on the right side of the request.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
