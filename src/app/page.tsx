"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { StatCard, SectionCard, EmptyState } from "@/components/Card";
import { AllocationPie, NetWorthArea } from "@/components/Charts";
import { money, pct, shortDate } from "@/lib/format";
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
  const { db, ready, totalAssets, totalLiabilities, netWorth, createSnapshot, loadDemo } = useStore();

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

  if (!ready) return <div className="text-muted text-sm">Loading…</div>;

  const isEmpty = db.assets.length === 0 && db.liabilities.length === 0;

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
