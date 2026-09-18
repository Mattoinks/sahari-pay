"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-md bg-brand-primary px-4 py-2 text-sm text-white hover:bg-brand-primary-hover print:hidden"
    >
      Print / Save as PDF
    </button>
  );
}
