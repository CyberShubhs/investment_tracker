"use client";

import { useStore } from "@/lib/store";
import { SectionCard, EmptyState } from "@/components/Card";
import { NetWorthArea } from "@/components/Charts";
import { money, shortDate } from "@/lib/format";
import { downloadCSV, toCSV } from "@/lib/csv";

export default function HistoryPage() {
  const { db, createSnapshot, removeSnapshot } = useStore();
  const sorted = [...db.snapshots].sort((a, b) => a.date.localeCompare(b.date));

  const exportCSV = () => {
    const csv = toCSV(
      sorted.map((s) => ({
        date: s.date,
        total_assets: s.total_assets,
        total_liabilities: s.total_liabilities,
        net_worth: s.net_worth,
        note: s.note ?? "",
      }))
    );
    downloadCSV("snapshots.csv", csv);
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title="Net worth history"
        action={
          <div className="flex gap-2">
            <button className="btn-ghost text-xs" onClick={exportCSV} disabled={sorted.length === 0}>
              Export CSV
            </button>
            <button className="btn-primary text-xs" onClick={() => createSnapshot()}>
              + Create snapshot
            </button>
          </div>
        }
      >
        <NetWorthArea data={sorted.map((s) => ({ date: s.date, net_worth: s.net_worth }))} />
      </SectionCard>

      <SectionCard title="Snapshots">
        {sorted.length === 0 ? (
          <EmptyState
            title="No snapshots yet"
            hint="Create one whenever you want to log a point-in-time net worth. The dashboard chart uses these."
          />
        ) : (
          <ul className="divide-y divide-bg-ring">
            {[...sorted].reverse().map((s) => (
              <li key={s.id} className="py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{shortDate(s.date)}</div>
                  <div className="text-xs text-muted">
                    Assets {money(s.total_assets)} · Liabilities {money(s.total_liabilities)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-sm font-semibold">{money(s.net_worth)}</div>
                  <button className="text-xs text-danger hover:underline" onClick={() => removeSnapshot(s.id)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
