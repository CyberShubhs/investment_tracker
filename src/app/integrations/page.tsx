"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { SectionCard, EmptyState } from "@/components/Card";
import { supabaseEnabled } from "@/lib/supabase";
import type { Integration } from "@/lib/types";

const STATUS_LABEL: Record<Integration["status"], string> = {
  planned: "Planned",
  configured: "Configured",
  active: "Active",
  disabled: "Disabled",
};

const PLANNED = [
  { provider: "CoinSpot", notes: "Read-only API for balances. Never request withdrawal/trading permissions." },
  { provider: "CommSec", notes: "Manual CSV / statement import for now." },
  { provider: "Stock Price API", notes: "ASX / Yahoo price feed for stocks and ETFs." },
  { provider: "Open Banking", notes: "Future bank account sync (CDR)." },
];

export default function IntegrationsPage() {
  const { db, addIntegration, updateIntegration, removeIntegration, loadDemo, resetAll } = useStore();
  const [provider, setProvider] = useState("");
  const [notes, setNotes] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!provider.trim()) return;
    addIntegration({ provider: provider.trim(), status: "planned", notes: notes.trim() || undefined });
    setProvider("");
    setNotes("");
  };

  const seedPlanned = () => {
    const existing = new Set(db.integrations.map((i) => i.provider.toLowerCase()));
    for (const p of PLANNED) {
      if (!existing.has(p.provider.toLowerCase())) {
        addIntegration({ provider: p.provider, status: "planned", notes: p.notes });
      }
    }
  };

  const importCSV = () => {
    alert("CSV import coming soon. Export is available today on Assets, Liabilities, Transactions and History.");
  };

  return (
    <div className="space-y-4">
      <SectionCard title="Storage">
        <div className="text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted">Mode</span>
            <span className="pill">{supabaseEnabled ? "Supabase (configured)" : "Local / demo"}</span>
          </div>
          <p className="text-xs text-muted mt-3 leading-relaxed">
            {supabaseEnabled
              ? "Supabase env vars are present. Schema is in supabase/schema.sql. Wire up auth and queries to enable cloud sync."
              : "No Supabase env vars detected. Data is stored locally in your browser. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable cloud sync."}
          </p>
        </div>
      </SectionCard>

      <SectionCard
        title="Planned integrations"
        action={<button className="btn-ghost text-xs" onClick={seedPlanned}>Seed planned</button>}
      >
        <p className="text-xs text-muted mb-3 leading-relaxed">
          Read-only design: keys live in environment variables on the server, never the frontend.
          Never request withdrawal or trading permissions.
        </p>

        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="sm:col-span-1">
            <label className="label">Provider</label>
            <input className="input" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="CoinSpot, CommSec…" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What this connection will do" />
          </div>
          <div className="sm:col-span-3 flex justify-end">
            <button type="submit" className="btn-primary text-xs">+ Add</button>
          </div>
        </form>

        {db.integrations.length === 0 ? (
          <EmptyState title="No integrations yet" hint="Track providers you plan to connect later." />
        ) : (
          <ul className="divide-y divide-bg-ring">
            {db.integrations.map((i) => (
              <li key={i.id} className="py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{i.provider}</div>
                  {i.notes && <div className="text-xs text-muted">{i.notes}</div>}
                </div>
                <select
                  className="select max-w-[140px] text-xs"
                  value={i.status}
                  onChange={(e) => updateIntegration(i.id, { status: e.target.value as Integration["status"] })}
                >
                  {(Object.keys(STATUS_LABEL) as Integration["status"][]).map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
                <button className="text-xs text-danger hover:underline" onClick={() => removeIntegration(i.id)}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Import / export">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="card p-4">
            <div className="text-sm font-medium">CSV export</div>
            <p className="text-xs text-muted mt-1">
              Use the Export CSV button on each section to download your assets, liabilities, transactions and snapshots.
            </p>
          </div>
          <div className="card p-4">
            <div className="text-sm font-medium">CSV import</div>
            <p className="text-xs text-muted mt-1 mb-3">
              Bulk import from CoinSpot / CommSec / brokers. Coming soon.
            </p>
            <button className="btn-ghost text-xs" onClick={importCSV}>Try import (placeholder)</button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Demo data">
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary text-xs" onClick={loadDemo}>Load demo data</button>
          <button className="btn-danger text-xs" onClick={() => { if (confirm("Wipe all local data?")) resetAll(); }}>Reset all</button>
        </div>
        <p className="text-xs text-muted mt-3">
          Demo loads a realistic AUD profile to preview the dashboard. Reset wipes local storage.
        </p>
      </SectionCard>
    </div>
  );
}
