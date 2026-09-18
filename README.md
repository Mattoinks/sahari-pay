# TenantPay

Apartment payment tracking platform — see [SPEC.md](SPEC.md) for the full architecture and feature spec.

## Structure

```
apps/web       Next.js admin dashboard (landlords/property managers)
apps/mobile    Expo tenant app
packages/shared Types, Zod schemas, formatting, Supabase client factory shared by both apps
supabase/      SQL migrations (schema, RLS, triggers) and Edge Functions
```

This is an npm-workspaces monorepo (`npm install` at the repo root installs and links everything).

## 1. Set up Supabase

1. Create a project at https://supabase.com.
2. Install the Supabase CLI (`npm install -g supabase` or see their docs) and run:
   ```
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
   This applies [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql) — schema, RLS policies, and triggers.
3. In the Supabase dashboard, create a **private** Storage bucket named `payment-proofs`.
4. Create your first admin user: sign them up normally (via Supabase Auth), then in the SQL editor run:
   ```sql
   update profiles set role = 'admin' where email = 'you@example.com';
   ```
5. Copy your project's URL and anon key (Project Settings → API) into the env files below.

## 2. Web admin dashboard

```
cp apps/web/.env.local.example apps/web/.env.local
# fill in NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev:web
```

Visit http://localhost:3000, sign in with the admin account created above.

## 3. Tenant mobile app

```
cp apps/mobile/.env.example apps/mobile/.env
# fill in EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
npm run dev:mobile
```

Scan the QR code with Expo Go, or press `a`/`i` for an emulator/simulator. Sign in with a tenant account (create one via Supabase Auth, or add tenant invite flow — see SPEC.md Phase 2).

## Current status

Phase 1 (Foundation) is scaffolded: schema + RLS + triggers, monorepo, auth wiring on both clients,
and a thin end-to-end slice (admin overview stats, units/tenants read views, a working verification
queue with approve/reject, and the tenant home/pay/history/notifications/profile screens). CRUD for
tenants/leases/units, invoice generation, and PDF/CSV export are still open — see SPEC.md §7
for the build order.
