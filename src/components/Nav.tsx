"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Dashboard" },
  { href: "/assets", label: "Assets" },
  { href: "/liabilities", label: "Liabilities" },
  { href: "/transactions", label: "Transactions" },
  { href: "/history", label: "History" },
  { href: "/integrations", label: "Integrations" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto no-scrollbar -mx-1 px-1">
      {items.map((it) => {
        const active = it.href === "/" ? path === "/" : path?.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={
              "shrink-0 px-3 py-1.5 rounded-full text-sm border transition-colors " +
              (active
                ? "bg-accent/15 border-accent/40 text-accent"
                : "border-bg-ring text-muted hover:text-white hover:border-white/20")
            }
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
