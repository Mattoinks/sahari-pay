import { Suspense } from "react";
import {
  Squares2X2Icon,
  BuildingOffice2Icon,
  UsersIcon,
  BanknotesIcon,
  ClipboardDocumentCheckIcon,
  MegaphoneIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  WrenchScrewdriverIcon,
  ChatBubbleLeftRightIcon,
  CalendarDaysIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";
import { NavLink } from "./nav-link";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: Squares2X2Icon },
  { href: "/dashboard/units", label: "Units", icon: BuildingOffice2Icon },
  { href: "/dashboard/tenants", label: "Tenants", icon: UsersIcon, countKey: "tenants" as const },
  { href: "/dashboard/billing", label: "Billing", icon: BanknotesIcon },
  { href: "/dashboard/verification", label: "Verification", icon: ClipboardDocumentCheckIcon, countKey: "verification" as const },
  { href: "/dashboard/maintenance", label: "Maintenance", icon: WrenchScrewdriverIcon, countKey: "maintenance" as const },
  { href: "/dashboard/messages", label: "Messages", icon: ChatBubbleLeftRightIcon, countKey: "messages" as const },
  { href: "/dashboard/viewings", label: "Viewings", icon: CalendarDaysIcon, countKey: "viewings" as const },
  { href: "/dashboard/announcements", label: "Announcements", icon: MegaphoneIcon },
  { href: "/dashboard/advertisements", label: "Advertisements", icon: PhotoIcon },
  { href: "/dashboard/audit-log", label: "Audit Log", icon: ClipboardDocumentListIcon },
  { href: "/dashboard/reports", label: "Reports", icon: ChartBarIcon },
];

function NavItems({ counts }: { counts?: Record<string, number> }) {
  return (
    <>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.href}
          href={item.href}
          label={item.label}
          icon={<item.icon className="h-5 w-5 shrink-0" />}
          badge={item.countKey ? counts?.[item.countKey] : undefined}
        />
      ))}
    </>
  );
}

// "Needs attention" counts — the only proactive signal an admin gets besides visiting each page
// directly. Split into its own Suspense-wrapped component so these four extra queries don't
// block the very first paint of every navigation — the nav shell (and the page underneath it)
// renders immediately, and badges pop in a beat later once this resolves.
async function NavItemsWithCounts() {
  const supabase = await createClient();
  const [
    { count: verificationCount },
    { count: maintenanceCount },
    { count: messagesCount },
    { count: tenantsCount },
    { count: viewingsCount },
  ] = await Promise.all([
    supabase.from("transactions").select("*", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("maintenance_requests").select("*", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("messages").select("*", { count: "exact", head: true }).is("read_at", null),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("approval_status", "pending"),
    supabase.from("viewing_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const counts: Record<string, number> = {
    verification: verificationCount ?? 0,
    maintenance: maintenanceCount ?? 0,
    messages: messagesCount ?? 0,
    tenants: tenantsCount ?? 0,
    viewings: viewingsCount ?? 0,
  };
  return <NavItems counts={counts} />;
}

// No auth check here — apps/web/src/proxy.ts (middleware) already validates the session and
// admin role on every request to /dashboard/*, redirecting before this layout ever runs. Doing
// it again here was a second network round-trip to Supabase Auth on every single navigation for
// no extra safety (the real enforcement is RLS on each query, per proxy.ts's own comment).
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col overflow-y-auto bg-brand-primary p-4 print:hidden">
        <p className="mb-8 flex items-center gap-2 px-2 text-lg font-semibold tracking-tight text-white">
          <span aria-hidden>🐫</span> SahariPay
        </p>
        <nav className="flex-1 space-y-1">
          <Suspense fallback={<NavItems />}>
            <NavItemsWithCounts />
          </Suspense>
        </nav>
        <div className="mt-8 border-t border-white/15 pt-4">
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 bg-white p-8">{children}</main>
    </div>
  );
}
