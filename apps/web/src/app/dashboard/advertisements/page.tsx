import { createClient } from "@/lib/supabase/server";
import { AdvertisementForm } from "./advertisement-form";
import { AdvertisementRow } from "./advertisement-row";

export default async function AdvertisementsPage() {
  const supabase = await createClient();

  const { data: ads, error } = await supabase
    .from("advertisements")
    .select("id, image_path, caption, link_url, opens_scheduler, is_active, display_order")
    .order("display_order", { ascending: true });

  if (error) {
    return <p className="text-sm text-red-600">Failed to load: {error.message}</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Advertisements</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Promo banners shown as an auto-sliding carousel on the tenant app&apos;s Home screen. Recommended size:
          1200×445px (~2.7:1), JPG or WebP, under 500KB. If a banner opens the scheduler, a &quot;Book now&quot; badge
          is added automatically in the top-right corner.
        </p>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-neutral-900">Add banner</h2>
        <AdvertisementForm />
      </section>

      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        {(ads ?? []).map((ad) => {
          const imageUrl = supabase.storage.from("advertisements").getPublicUrl(ad.image_path).data.publicUrl;
          return (
            <AdvertisementRow
              key={ad.id}
              id={ad.id}
              imageUrl={imageUrl}
              imagePath={ad.image_path}
              caption={ad.caption}
              linkUrl={ad.link_url}
              opensScheduler={ad.opens_scheduler}
              isActive={ad.is_active}
            />
          );
        })}
        {(ads ?? []).length === 0 && <p className="py-8 text-center text-neutral-400">No banners yet — add one above.</p>}
      </section>
    </div>
  );
}
