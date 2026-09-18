import { createClient } from "@/lib/supabase/server";
import { RequestRow } from "./request-row";
import type { MaintenanceStatus } from "@tenantpay/shared";

export default async function MaintenancePage() {
  const supabase = await createClient();

  const { data: requests, error } = await supabase
    .from("maintenance_requests")
    .select("id, category, description, status, photo_url, created_at, profiles(full_name), leases(units(unit_number))")
    .order("created_at", { ascending: false });

  if (error) {
    return <p className="text-sm text-red-600">Failed to load requests: {error.message}</p>;
  }

  // photo_url is a path in the private "maintenance-photos" bucket — sign it for viewing.
  const rows = await Promise.all(
    (requests ?? []).map(async (r) => {
      let signedPhotoUrl: string | null = null;
      if (r.photo_url) {
        const { data } = await supabase.storage.from("maintenance-photos").createSignedUrl(r.photo_url, 60 * 10);
        signedPhotoUrl = data?.signedUrl ?? null;
      }
      return { ...r, signedPhotoUrl };
    })
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Maintenance Requests</h1>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {rows.map((r) => {
          const profile = r.profiles as unknown as { full_name: string } | null;
          const lease = r.leases as unknown as { units: { unit_number: string } | null } | null;
          return (
            <RequestRow
              key={r.id}
              id={r.id}
              tenantName={profile?.full_name ?? "Unknown tenant"}
              unitNumber={lease?.units?.unit_number ?? "—"}
              category={r.category}
              description={r.description}
              status={r.status as MaintenanceStatus}
              photoUrl={r.signedPhotoUrl}
              createdAt={r.created_at}
            />
          );
        })}
        {rows.length === 0 && (
          <p className="py-8 text-center text-neutral-400">No maintenance requests yet.</p>
        )}
      </div>
    </div>
  );
}
