"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface NavLinkProps {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number;
}

export function NavLink({ href, label, icon, badge }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150 ${
        isActive
          ? "bg-white/15 font-medium text-white"
          : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {!!badge && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-semibold text-brand-primary">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}
