export function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export const th = "bg-neutral-50 px-4 py-3 text-left text-xs font-medium tracking-wide text-neutral-500 uppercase";
export const td = "border-t border-neutral-100 px-4 py-3";
export const trHover = "transition-colors duration-150 hover:bg-neutral-50";
export const emptyRow = "px-4 py-8 text-center text-neutral-400";
