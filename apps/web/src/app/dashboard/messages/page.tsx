import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function MessagesInboxPage() {
  const supabase = await createClient();

  const [{ data: tenants, error: tenantsError }, { data: recentMessages }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").eq("role", "tenant").order("full_name"),
    supabase
      .from("messages")
      .select("tenant_id, body, sender_id, created_at")
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  if (tenantsError) {
    return <p className="text-sm text-red-600">Failed to load tenants: {tenantsError.message}</p>;
  }

  const lastMessageByTenant = new Map<string, { body: string; sender_id: string; created_at: string }>();
  for (const m of recentMessages ?? []) {
    if (!lastMessageByTenant.has(m.tenant_id)) {
      lastMessageByTenant.set(m.tenant_id, m);
    }
  }

  const sortedTenants = [...(tenants ?? [])].sort((a, b) => {
    const aTime = lastMessageByTenant.get(a.id)?.created_at ?? "";
    const bTime = lastMessageByTenant.get(b.id)?.created_at ?? "";
    return bTime.localeCompare(aTime);
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Messages</h1>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {sortedTenants.map((t) => {
          const last = lastMessageByTenant.get(t.id);
          return (
            <Link
              key={t.id}
              href={`/dashboard/messages/${t.id}`}
              className="flex items-center justify-between gap-4 border-b border-neutral-100 px-4 py-4 transition-colors duration-150 last:border-b-0 hover:bg-neutral-50"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-neutral-900">{t.full_name}</p>
                <p className="truncate text-sm text-neutral-500">
                  {last ? `${last.sender_id === t.id ? "" : "You: "}${last.body}` : "No messages yet"}
                </p>
              </div>
              {last && (
                <span className="shrink-0 text-xs text-neutral-400">
                  {new Date(last.created_at).toLocaleDateString()}
                </span>
              )}
            </Link>
          );
        })}
        {sortedTenants.length === 0 && (
          <p className="py-8 text-center text-neutral-400">No tenants yet.</p>
        )}
      </div>
    </div>
  );
}
