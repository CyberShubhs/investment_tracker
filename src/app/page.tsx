"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { SectionCard, EmptyState } from "@/components/Card";
import { AllocationPie, NetWorthArea } from "@/components/Charts";
import { money, pct, shortDate } from "@/lib/format";
import { refreshPrices, isStale, type RefreshSummary } from "@/lib/refresh-prices";
import { syncCoinspot } from "@/lib/sync-coinspot";
import Link from "next/link";

const ASSET_LABEL: Record<string, string> = {
  cash: "Cash",
  crypto: "Crypto",
  stock: "Stocks",
  etf: "ETFs",
  property: "Property",
  vehicle: "Vehicles",
  super: "Super",
  jewellery: "Jewellery",
  metal: "Gold/Metals",
  equipment: "Equipment",
  business: "Business",
  other: "Other",
};

const LIAB_LABEL: Record<string, string> = {
  mortgage: "Mortgage",
  car_loan: "Car Loan",
  credit_card: "Credit Card",
  personal_loan: "Personal Loan",
  bnpl: "BNPL",
  hecs: "HECS",
  family: "Family/Friend",
  other: "Other",
};

export default function DashboardPage() {
  const { db, ready, totalAssets, totalLiabilities, netWorth, createSnapshot, loadDemo, updateAsset, addAsset } =
    useStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<"assets" | "debts">("assets");

  const allocation = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of db.assets) map.set(a.type, (map.get(a.type) ?? 0) + a.current_value);
    return Array.from(map.entries()).map(([k, v]) => ({ name: ASSET_LABEL[k] ?? k, value: v }));
  }, [db.assets]);

  const liabilityBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of db.liabilities) map.set(l.type, (map.get(l.type) ?? 0) + l.balance);
    return Array.from(map.entries()).map(([k, v]) => ({ name: LIAB_LABEL[k] ?? k, value: v }));
  }, [db.liabilities]);

  const history = useMemo(
    () =>
      [...db.snapshots]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((s) => ({ date: s.date, net_worth: s.net_worth })),
    [db.snapshots]
  );

  const monthlyChange = useMemo(() => {
    const sorted = [...db.snapshots].sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length < 2) return null;
    const last = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    const diff = last.net_worth - prev.net_worth;
    return { diff, pct: prev.net_worth !== 0 ? (diff / Math.abs(prev.net_worth)) * 100 : 0 };
  }, [db.snapshots]);

  const cashflowMonth = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7);
    let income = 0;
    let expenses = 0;
    for (const e of db.cashflow_entries) {
      if (e.date.slice(0, 7) !== month) continue;
      if (e.direction === "income") income += e.amount;
      else expenses += e.amount;
    }
    return { income, expenses, net: income - expenses };
  }, [db.cashflow_entries]);

  const providerGroups = useMemo(() => {
    const map = new Map<string, { total: number; count: number; stale: boolean }>();
    for (const a of db.assets) {
      const key = a.provider?.trim() || "Manual";
      const g = map.get(key) ?? { total: 0, count: 0, stale: false };
      g.total += a.current_value;
      g.count += 1;
      g.stale = g.stale || isStale(a);
      map.set(key, g);
    }
    return Array.from(map.entries())
      .map(([provider, g]) => ({ provider, ...g }))
      .sort((a, b) => b.total - a.total);
  }, [db.assets]);

  const doRefresh = async () => {
    setBusy("refresh");
    setActionMsg(null);
    try {
      const r: RefreshSummary = await refreshPrices(db.assets, updateAsset);
      setActionMsg(`${r.updated} updated${r.failed.length ? `, ${r.failed.length} failed` : ""}`);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setBusy(null);
    }
  };

  const doCoinspot = async () => {
    setBusy("coinspot");
    setActionMsg(null);
    try {
      const r = await syncCoinspot(db.assets, addAsset, updateAsset);
      setActionMsg(`CoinSpot: ${r.created + r.updated} holdings, ${money(r.totalAud)}`);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "CoinSpot sync failed");
    } finally {
      setBusy(null);
    }
  };

  if (!ready) return <div className="text-muted text-sm">Loading…</div>;

  const isEmpty = db.assets.length === 0 && db.liabilities.length === 0;
  const hasCoinspot = providerGroups.some((g) => g.provider.toLowerCase() === "coinspot");

  return (
    <div className="space-y-5">
      {/* Hero — the one number that matters */}
      <section className="pt-3 pb-1">
        <div className="label">Net worth</div>
        <div className={`num text-[2.6rem] sm:text-6xl font-semibold leading-none ${netWorth >= 0 ? "text-white" : "text-danger"}`}>
          {money(netWorth)}
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap text-[13px]">
          {monthlyChange && (
            <span
              className={`num inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${
                monthlyChange.diff >= 0
                  ? "text-accent border-accent/30 bg-accent/10"
                  : "text-danger border-danger/30 bg-danger/10"
              }`}
            >
              {monthlyChange.diff >= 0 ? "▲" : "▼"} {money(Math.abs(monthlyChange.diff))} · {pct(monthlyChange.pct)}
            </span>
          )}
          <span className="num text-muted">
            <span className="text-white/80">{money(totalAssets)}</span> assets
          </span>
          <span className="text-bg-ring">|</span>
          <Link href="/liabilities" className="num text-muted hover:text-white">
            <span className={totalLiabilities > 0 ? "text-danger/90" : "text-white/80"}>{money(totalLiabilities)}</span> debts
          </Link>
        </div>
      </section>

      {/* This month's cash flow — one strip, not three cards */}
      <Link href="/cashflow" className="card flex items-stretch divide-x divide-bg-ring overflow-hidden hover:border-accent/30 transition-colors">
        {[
          { label: "In", value: cashflowMonth.income, cls: "text-accent" },
          { label: "Out", value: cashflowMonth.expenses, cls: "text-danger" },
          { label: "Saved", value: cashflowMonth.net, cls: cashflowMonth.net >= 0 ? "text-white" : "text-danger" },
        ].map((c) => (
          <div key={c.label} className="flex-1 px-4 py-3.5">
            <div className="label !mb-0.5">{c.label} · {new Date().toLocaleDateString("en-AU", { month: "short" })}</div>
            <div className={`num text-base sm:text-lg font-semibold ${c.cls}`}>{money(c.value)}</div>
          </div>
        ))}
      </Link>

      {isEmpty && (
        <SectionCard title="Welcome">
          <EmptyState
            title="No data yet"
            hint="Add your assets and liabilities to see your net worth, or load demo data to see how it looks."
            action={
              <div className="flex gap-2 justify-center flex-wrap">
                <Link href="/assets" className="btn-primary">Add an asset</Link>
                <button onClick={loadDemo} className="btn-ghost">Load demo data</button>
              </div>
            }
          />
        </SectionCard>
      )}

      {db.assets.length > 0 && (
        <SectionCard
          title="Holdings"
          action={
            <div className="flex gap-2">
              {hasCoinspot && (
                <button className="btn-ghost text-xs !py-1.5" onClick={doCoinspot} disabled={busy !== null}>
                  {busy === "coinspot" ? "Syncing…" : "Sync CoinSpot"}
                </button>
              )}
              <button className="btn-ghost text-xs !py-1.5" onClick={doRefresh} disabled={busy !== null}>
                {busy === "refresh" ? "…" : "Refresh prices"}
              </button>
            </div>
          }
        >
          {actionMsg && <div className="num text-xs text-accent mb-2">{actionMsg}</div>}
          <ul className="divide-y divide-bg-ring">
            {providerGroups.map((g) => (
              <li key={g.provider} className="py-2.5 flex items-center gap-3">
                <div className="min-w-0 flex-1 flex items-center gap-2">
                  <span className="text-sm font-medium">{g.provider}</span>
                  <span className="pill">{g.count}</span>
                  {g.stale && (
                    <span className="h-1.5 w-1.5 rounded-full bg-warn shrink-0" title="Prices need a refresh" />
                  )}
                </div>
                <div className="num text-sm font-semibold">{money(g.total)}</div>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard
        title="Breakdown"
        action={
          <div className="flex rounded-full border border-bg-ring p-0.5 text-xs">
            {(["assets", "debts"] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBreakdown(b)}
                className={`px-3 py-1 rounded-full capitalize transition-colors ${
                  breakdown === b ? "bg-accent/15 text-accent" : "text-muted hover:text-white"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        }
      >
        <AllocationPie data={breakdown === "assets" ? allocation : liabilityBreakdown} />
      </SectionCard>

      <SectionCard
        title="Net worth over time"
        action={
          <button onClick={() => createSnapshot()} className="btn-primary text-xs !py-1.5">
            + Snapshot
          </button>
        }
      >
        <NetWorthArea data={history} />
        {history.length > 0 && (
          <div className="flex items-center justify-between mt-2 text-xs text-muted">
            <span>Latest: {shortDate(history[history.length - 1].date)}</span>
            <Link href="/history" className="hover:text-white">All snapshots →</Link>
          </div>
        )}
      </SectionCard>

      <div className="flex justify-center gap-5 text-[13px] text-muted pb-2">
        <Link href="/transactions" className="hover:text-white">Transactions</Link>
        <Link href="/history" className="hover:text-white">History</Link>
        <Link href="/integrations" className="hover:text-white">Settings</Link>
      </div>
    </div>
  );
}
