import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white p-8 text-center">
      <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight text-brand-primary">
        <span aria-hidden>🐫</span> SahariPay
      </h1>
      <p className="max-w-md text-neutral-500">
        Property management dashboard for tracking units, tenants, invoices, and payment
        verification.
      </p>
      <Link
        href="/login"
        className="rounded-md bg-brand-primary px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-primary-hover"
      >
        Sign in
      </Link>
    </main>
  );
}
