"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Dashboard" },
  { href: "/cashflow", label: "Cash Flow" },
  { href: "/assets", label: "Assets" },
  { href: "/liabilities", label: "Liabilities" },
  { href: "/transactions", label: "Transactions" },
  { href: "/history", label: "History" },
  { href: "/integrations", label: "Settings" },
];

function isActive(path: string | null, href: string) {
  return href === "/" ? path === "/" : Boolean(path?.startsWith(href));
}

/** Desktop navigation — hidden on phones, where the bottom tab bar takes over. */
export function Nav() {
  const path = usePathname();
  return (
    <nav className="hidden sm:flex gap-1">
      {items.map((it) => {
        const active = isActive(path, it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={
              "shrink-0 px-3 py-1.5 rounded-full text-[13px] border transition-colors " +
              (active
                ? "bg-accent/15 border-accent/40 text-accent"
                : "border-transparent text-muted hover:text-white hover:border-bg-ring")
            }
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

const icon = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  ),
  cashflow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17V9M12 17V5M17 17v-6" />
      <path d="M3 21h18" />
    </svg>
  ),
  assets: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.2c0-1 1.1-1.7 2.5-1.7s2.5.7 2.5 1.7c0 2.6-5 1.9-5 4.6 0 1 1.1 1.7 2.5 1.7s2.5-.7 2.5-1.7" />
    </svg>
  ),
  liabilities: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10.5h18" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.06-.4.1-.8.1-1.2Z" />
    </svg>
  ),
};

const tabs = [
  { href: "/", label: "Home", icon: icon.home },
  { href: "/cashflow", label: "Cash Flow", icon: icon.cashflow },
  { href: "/assets", label: "Assets", icon: icon.assets },
  { href: "/liabilities", label: "Debts", icon: icon.liabilities },
  { href: "/integrations", label: "Settings", icon: icon.settings },
];

/** Bottom tab bar — phones only; sits above the iOS home indicator. */
export function MobileTabBar() {
  const path = usePathname();
  return (
    <nav className="tabbar sm:hidden">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={isActive(path, t.href) ? "active" : ""}>
          {t.icon}
          <span>{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}
