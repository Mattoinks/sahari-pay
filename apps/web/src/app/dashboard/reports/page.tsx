export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Financial Reporting</h1>
      <p className="text-sm text-neutral-500">
        Figures are computed server-side from <code className="rounded bg-neutral-100 px-1.5 py-0.5">invoices</code> and{" "}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5">transactions</code> — never re-derived client-side —
        so exports always match the ledger.
      </p>

      <form
        action="/api/reports/transactions.csv"
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
      >
        <label className="text-xs font-medium text-neutral-500">
          From
          <input name="start" type="date" className="mt-1 block rounded-md border border-neutral-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs font-medium text-neutral-500">
          To
          <input name="end" type="date" className="mt-1 block rounded-md border border-neutral-300 px-3 py-2 text-sm" />
        </label>
        <button
          type="submit"
          className="cursor-pointer rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-primary-hover"
        >
          Download transactions CSV
        </button>
      </form>

      <form
        action="/dashboard/reports/statement"
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
      >
        <label className="text-xs font-medium text-neutral-500">
          From
          <input name="start" type="date" className="mt-1 block rounded-md border border-neutral-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs font-medium text-neutral-500">
          To
          <input name="end" type="date" className="mt-1 block rounded-md border border-neutral-300 px-3 py-2 text-sm" />
        </label>
        <button
          type="submit"
          className="cursor-pointer rounded-md border border-brand-primary px-4 py-2 text-sm font-medium text-brand-primary transition-colors duration-150 hover:bg-brand-accent-soft"
        >
          View printable statement
        </button>
      </form>
    </div>
  );
}
