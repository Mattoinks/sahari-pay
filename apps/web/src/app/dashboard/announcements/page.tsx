import { createClient } from "@/lib/supabase/server";
import { AnnouncementForm } from "./announcement-form";

export default async function AnnouncementsPage() {
  const supabase = await createClient();

  const [{ data: announcements, error }, { data: properties }, { data: units }] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, title, body, audience, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("properties").select("id, name").order("name"),
    supabase.from("units").select("id, unit_number").order("unit_number"),
  ]);

  if (error) {
    return <p className="text-sm text-red-600">Failed to load announcements: {error.message}</p>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Announcements</h1>

      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-neutral-900">New announcement</h2>
        <AnnouncementForm properties={properties ?? []} units={units ?? []} />
      </section>

      <div className="space-y-3">
        {(announcements ?? []).map((a) => (
          <div key={a.id} className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="font-medium text-neutral-900">{a.title}</p>
              <span className="text-xs text-neutral-400">{new Date(a.created_at).toLocaleString()}</span>
            </div>
            <p className="mt-1 text-sm text-neutral-600">{a.body}</p>
            <p className="mt-2">
              <span className="inline-block rounded-full bg-brand-accent-soft px-2.5 py-0.5 text-xs font-medium text-brand-primary capitalize">
                {a.audience}
              </span>
            </p>
          </div>
        ))}
        {(announcements ?? []).length === 0 && (
          <p className="py-6 text-center text-neutral-400">No announcements yet.</p>
        )}
      </div>
    </div>
  );
}
