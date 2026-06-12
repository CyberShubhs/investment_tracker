"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { StatCard, SectionCard, EmptyState } from "@/components/Card";
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

  const allocation = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of db.assets) {
      map.set(a.type, (map.get(a.type) ?? 0) + a.current_value);
    }
    return Array.from(map.entries()).map(([k, v]) => ({ name: ASSET_LABEL[k] ?? k, value: v }));
  }, [db.assets]);

  const liabilityBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of db.liabilities) {
      map.set(l.type, (map.get(l.type) ?? 0) + l.balance);
    }
    return Array.from(map.entries()).map(([k, v]) => ({ name: LIAB_LABEL[k] ?? k, value: v }));
  }, [db.liabilities]);

  const history = useMemo(() => {
    return [...db.snapshots]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => ({ date: s.date, net_worth: s.net_worth }));
  }, [db.snapshots]);

  const monthlyChange = useMemo(() => {
    const sorted = [...db.snapshots].sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length < 2) return null;
    const last = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    const diff = last.net_worth - prev.net_worth;
    const pctChange = prev.net_worth !== 0 ? (diff / Math.abs(prev.net_worth)) * 100 : 0;
    return { diff, pct: pctChange };
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
      setActionMsg(
        `${r.updated} price${r.updated === 1 ? "" : "s"} updated${r.failed.length ? `, ${r.failed.length} failed` : ""}.`
      );
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
      setActionMsg(`CoinSpot synced: ${r.created + r.updated} holdings, ${money(r.totalAud)}.`);
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
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Net worth" value={money(netWorth)} tone={netWorth >= 0 ? "good" : "bad"} />
        <StatCard label="Assets" value={money(totalAssets)} />
        <StatCard label="Liabilities" value={money(totalLiabilities)} tone={totalLiabilities > 0 ? "bad" : "default"} />
        <StatCard
          label="Monthly change"
          value={monthlyChange ? money(monthlyChange.diff) : "—"}
          sub={monthlyChange ? pct(monthlyChange.pct) : "Add a snapshot to track"}
          tone={!monthlyChange ? "default" : monthlyChange.diff >= 0 ? "good" : "bad"}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Link href="/cashflow" className="card p-4 hover:border-accent/40 transition-colors">
          <div className="label">Income · this month</div>
          <div className="stat-num text-accent">{money(cashflowMonth.income)}</div>
        </Link>
        <Link href="/cashflow" className="card p-4 hover:border-accent/40 transition-colors">
          <div className="label">Expenses · this month</div>
          <div className="stat-num text-danger">{money(cashflowMonth.expenses)}</div>
        </Link>
        <Link href="/cashflow" className="card p-4 hover:border-accent/40 transition-colors">
          <div className="label">Net savings</div>
          <div className={`stat-num ${cashflowMonth.net >= 0 ? "text-accent" : "text-danger"}`}>
            {money(cashflowMonth.net)}
          </div>
        </Link>
      </div>

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
          title="Holdings by provider"
          action={
            <div className="flex gap-2">
              {hasCoinspot && (
                <button className="btn-ghost text-xs" onClick={doCoinspot} disabled={busy !== null}>
                  {busy === "coinspot" ? "Syncing…" : "Sync CoinSpot"}
                </button>
              )}
              <button className="btn-ghost text-xs" onClick={doRefresh} disabled={busy !== null}>
                {busy === "refresh" ? "Refreshing…" : "Refresh prices"}
              </button>
            </div>
          }
        >
          {actionMsg && <div className="text-xs text-accent mb-2">{actionMsg}</div>}
          <ul className="divide-y divide-bg-ring">
            {providerGroups.map((g) => (
              <li key={g.provider} className="py-2.5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{g.provider}</span>
                    {g.stale && (
                      <span
                        className="h-2 w-2 rounded-full bg-amber-400 shrink-0"
                        title="Some holdings have no live price or it's older than 24h"
                      />
                    )}
                  </div>
                  <div className="text-xs text-muted">{g.count} holding{g.count === 1 ? "" : "s"}</div>
                </div>
                <div className="text-sm font-semibold">{money(g.total)}</div>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Asset allocation">
          <AllocationPie data={allocation} />
        </SectionCard>
        <SectionCard title="Liability breakdown">
          <AllocationPie data={liabilityBreakdown} />
        </SectionCard>
      </div>

      <SectionCard
        title="Net worth over time"
        action={
          <button onClick={() => createSnapshot()} className="btn-primary text-xs px-2 py-1.5">
            + Snapshot
          </button>
        }
      >
        <NetWorthArea data={history} />
        {history.length > 0 && (
          <div className="text-xs text-muted mt-2">
            Latest snapshot: {shortDate(history[history.length - 1].date)}
          </div>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link href="/assets" className="card p-4 hover:border-accent/40 transition-colors">
          <div className="text-xs text-muted">Manage</div>
          <div className="text-base font-semibold">Assets →</div>
          <div className="text-xs text-muted mt-1">{db.assets.length} item{db.assets.length === 1 ? "" : "s"}</div>
        </Link>
        <Link href="/liabilities" className="card p-4 hover:border-accent/40 transition-colors">
          <div className="text-xs text-muted">Manage</div>
          <div className="text-base font-semibold">Liabilities →</div>
          <div className="text-xs text-muted mt-1">{db.liabilities.length} item{db.liabilities.length === 1 ? "" : "s"}</div>
        </Link>
      </div>
    </div>
  );
}
