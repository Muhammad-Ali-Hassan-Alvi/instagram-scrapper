"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { DEFAULT_TARGET_ACCOUNTS } from "@/config/accounts";
import { ui } from "@/lib/ui-classes";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/content-performance", label: "All Posts" },
  { href: "/audience", label: "Audience" },
  { href: "/platform-benchmarking", label: "Benchmarking" },
  { href: "/exports", label: "Exports" },
] as const;

const ACCOUNTS = DEFAULT_TARGET_ACCOUNTS.filter((account) => account.platform === "instagram");

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className={`hidden w-60 shrink-0 p-4 lg:block ${ui.sidebar}`}>
      <p className="px-2 text-xs font-bold uppercase tracking-widest text-violet-600">
        Social Analytics
      </p>

      <nav className="mt-5 space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <p className="mt-6 px-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
        Accounts
      </p>
      <nav className="mt-2 space-y-1">
        {ACCOUNTS.map((account) => {
          const href = `/accounts/${account.username}`;
          const active = pathname === href;
          return (
            <Link
              key={account.username}
              href={href}
              className={`block rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-violet-50 font-medium text-violet-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              @{account.username}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
