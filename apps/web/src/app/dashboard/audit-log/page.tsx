import { createClient } from "@/lib/supabase/server";

export default async function AuditLogPage() {
  const supabase = await createClient();
  const { data: logs, error } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, before_state, after_state, created_at, profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return <p className="text-sm text-red-600">Failed to load audit log: {error.message}</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Audit Log</h1>
      <p className="text-sm text-neutral-500">Every change to invoices and transactions, most recent first.</p>

      <div className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {(logs ?? []).map((log) => {
          const actor = log.profiles as unknown as { full_name: string } | null;
          return (
            <details key={log.id} className="px-4 py-3 transition-colors duration-150 open:bg-neutral-50">
              <summary className="cursor-pointer text-sm">
                <span className="font-medium text-neutral-900">{log.action}</span> on{" "}
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs">{log.entity_type}</span> by{" "}
                {actor?.full_name ?? "system"} —{" "}
                <span className="text-neutral-400">{new Date(log.created_at).toLocaleString()}</span>
              </summary>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-medium text-neutral-500">Before</p>
                  <pre className="overflow-auto rounded bg-neutral-50 p-2 text-xs">
                    {JSON.stringify(log.before_state, null, 2) ?? "—"}
                  </pre>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-neutral-500">After</p>
                  <pre className="overflow-auto rounded bg-neutral-50 p-2 text-xs">
                    {JSON.stringify(log.after_state, null, 2) ?? "—"}
                  </pre>
                </div>
              </div>
            </details>
          );
        })}
        {(logs ?? []).length === 0 && (
          <p className="py-6 text-center text-neutral-400">No activity yet.</p>
        )}
      </div>
    </div>
  );
}
