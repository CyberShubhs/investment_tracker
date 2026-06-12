"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { SectionCard, EmptyState } from "@/components/Card";
import { getSupabase, supabaseEnabled } from "@/lib/supabase";
import { money, shortDate } from "@/lib/format";
import { coinspotStatus, syncCoinspot, type CoinspotSyncResult } from "@/lib/sync-coinspot";
import { parseCommsecHoldings, type CommsecHolding } from "@/lib/commsec";
import { detectLegacyData, migrateLegacy, type LegacySummary } from "@/lib/migrate-local";
import type { Integration } from "@/lib/types";

const STATUS_LABEL: Record<Integration["status"], string> = {
  planned: "Planned",
  configured: "Configured",
  active: "Active",
  disabled: "Disabled",
};

const PLANNED = [
  { provider: "CoinSpot", notes: "Read-only API for balances. Never request withdrawal/trading permissions." },
  { provider: "CommSec", notes: "Holdings CSV import + live ASX prices." },
  { provider: "Open Banking", notes: "Future bank account sync (CDR)." },
];

type CommsecRow = CommsecHolding & { kind: "stock" | "etf" };

export default function IntegrationsPage() {
  const {
    db,
    syncStatus,
    addAsset,
    updateAsset,
    addIntegration,
    updateIntegration,
    removeIntegration,
    loadDemo,
    resetAll,
  } = useStore();
  const [provider, setProvider] = useState("");
  const [notes, setNotes] = useState("");

  // CoinSpot
  const [csConfigured, setCsConfigured] = useState<boolean | null>(null);
  const [csBusy, setCsBusy] = useState(false);
  const [csResult, setCsResult] = useState<CoinspotSyncResult | null>(null);
  const [csError, setCsError] = useState<string | null>(null);

  // CommSec
  const fileRef = useRef<HTMLInputElement>(null);
  const [commsecRows, setCommsecRows] = useState<CommsecRow[] | null>(null);
  const [commsecError, setCommsecError] = useState<string | null>(null);
  const [commsecDone, setCommsecDone] = useState<string | null>(null);

  // Legacy migration
  const [legacy, setLegacy] = useState<LegacySummary | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrateMsg, setMigrateMsg] = useState<string | null>(null);

  useEffect(() => {
    if (supabaseEnabled) {
      coinspotStatus().then(setCsConfigured);
      setLegacy(detectLegacyData());
    }
  }, []);

  const markIntegration = (name: string, status: Integration["status"], note?: string) => {
    const existing = db.integrations.find((i) => i.provider.toLowerCase() === name.toLowerCase());
    if (existing) updateIntegration(existing.id, { status, notes: note ?? existing.notes });
    else addIntegration({ provider: name, status, notes: note });
  };

  const doCoinspotSync = async () => {
    setCsBusy(true);
    setCsError(null);
    setCsResult(null);
    try {
      const result = await syncCoinspot(db.assets, addAsset, updateAsset);
      setCsResult(result);
      markIntegration("CoinSpot", "active", "Read-only balance sync");
      if (result.missing.length > 0) {
        const names = result.missing.map((a) => a.symbol ?? a.name).join(", ");
        if (confirm(`These CoinSpot holdings are no longer in your account: ${names}. Set their value to $0?`)) {
          for (const a of result.missing) {
            updateAsset(a.id, { quantity: 0, current_value: 0, last_priced_at: result.fetchedAt });
          }
        }
      }
    } catch (e) {
      setCsError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setCsBusy(false);
    }
  };

  const onCommsecFile = async (file: File) => {
    setCommsecError(null);
    setCommsecDone(null);
    const text = await file.text();
    const { holdings, error } = parseCommsecHoldings(text);
    if (error) {
      setCommsecError(error);
      setCommsecRows(null);
      return;
    }
    setCommsecRows(holdings.map((h) => ({ ...h, kind: "etf" as const })));
  };

  const confirmCommsecImport = async () => {
    if (!commsecRows) return;
    let created = 0;
    let updated = 0;
    for (const row of commsecRows) {
      const key = `commsec:${row.symbol}`;
      const existing = db.assets.find((a) => a.external_key === key);
      if (existing) {
        updateAsset(existing.id, { quantity: row.quantity, avg_cost: row.avg_cost, type: row.kind });
        updated++;
      } else {
        addAsset({
          name: `${row.symbol} (CommSec)`,
          type: row.kind,
          provider: "CommSec",
          symbol: row.symbol,
          quantity: row.quantity,
          avg_cost: row.avg_cost,
          current_value: 0,
          currency: "AUD",
          external_key: key,
        });
        created++;
      }
    }
    markIntegration("CommSec", "active", "Holdings CSV import + live ASX prices");
    setCommsecRows(null);
    if (fileRef.current) fileRef.current.value = "";
    setCommsecDone(
      `${created} added, ${updated} updated. Open Assets and hit "Refresh prices" to value the holdings.`
    );
  };

  const doMigrate = async () => {
    const client = getSupabase();
    if (!client) return;
    setMigrating(true);
    setMigrateMsg(null);
    try {
      const { data } = await client.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) throw new Error("Not signed in");
      const result = await migrateLegacy(client, userId);
      setLegacy(null);
      setMigrateMsg(
        `Imported ${result.total} items (${result.assets} assets, ${result.liabilities} liabilities, ${result.transactions} transactions, ${result.snapshots} snapshots). Reload to see them.`
      );
    } catch (e) {
      setMigrateMsg(e instanceof Error ? e.message : "Import failed");
    } finally {
      setMigrating(false);
    }
  };

  const signOut = async () => {
    await getSupabase()?.auth.signOut();
  };

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

  return (
    <div className="space-y-4">
      <SectionCard
        title="Storage & account"
        action={supabaseEnabled ? <button className="btn-ghost text-xs" onClick={signOut}>Sign out</button> : undefined}
      >
        <div className="text-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted">Mode</span>
            <span className="pill">{supabaseEnabled ? "Supabase cloud sync" : "Local / demo"}</span>
          </div>
          {supabaseEnabled && (
            <div className="flex items-center justify-between">
              <span className="text-muted">Sync</span>
              <span className={`pill ${syncStatus === "error" || syncStatus === "offline" ? "text-danger" : ""}`}>
                {syncStatus === "idle" && "Synced"}
                {syncStatus === "loading" && "Syncing…"}
                {syncStatus === "error" && "Sync error — changes may not be saved"}
                {syncStatus === "offline" && "Offline — viewing cached data"}
                {syncStatus === "local" && "Local"}
              </span>
            </div>
          )}
          <p className="text-xs text-muted leading-relaxed">
            {supabaseEnabled
              ? "Data is stored in Supabase under your account and cached locally for instant load + offline viewing."
              : "No Supabase env vars detected. Data is stored locally in your browser. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable cloud sync."}
          </p>
          {legacy && (
            <div className="border border-accent/30 bg-accent/5 rounded-lg p-3 text-xs">
              <div className="font-medium text-accent mb-1">Local data found</div>
              <p className="text-muted mb-2">
                {legacy.total} items from the previous local-only version ({legacy.assets} assets, {legacy.liabilities}{" "}
                liabilities, {legacy.transactions} transactions, {legacy.snapshots} snapshots).
              </p>
              <button className="btn-primary text-xs" onClick={doMigrate} disabled={migrating}>
                {migrating ? "Importing…" : `Import ${legacy.total} items into Supabase`}
              </button>
            </div>
          )}
          {migrateMsg && <p className="text-xs text-accent">{migrateMsg}</p>}
        </div>
      </SectionCard>

      <SectionCard title="CoinSpot — live balance sync">
        <div className="flex items-center gap-2 mb-2">
          <span className="pill">
            {!supabaseEnabled
              ? "Requires Supabase mode"
              : csConfigured === null
                ? "Checking…"
                : csConfigured
                  ? "Configured"
                  : "Not configured"}
          </span>
          <button
            className="btn-primary text-xs ml-auto"
            onClick={doCoinspotSync}
            disabled={csBusy || !csConfigured}
          >
            {csBusy ? "Syncing…" : "Sync CoinSpot"}
          </button>
        </div>
        {csConfigured === false && (
          <p className="text-xs text-muted">
            Generate a <strong>read-only</strong> API key in CoinSpot (Profile → API) and set{" "}
            <code className="text-accent">COINSPOT_API_KEY</code> / <code className="text-accent">COINSPOT_API_SECRET</code>{" "}
            in your server environment. Keys never touch the browser.
          </p>
        )}
        {csResult && (
          <p className="text-xs text-accent">
            Synced {csResult.created + csResult.updated} holdings ({csResult.created} new) ·{" "}
            {money(csResult.totalAud)} total · {shortDate(csResult.fetchedAt)}
          </p>
        )}
        {csError && <p className="text-xs text-danger">{csError}</p>}
      </SectionCard>

      <SectionCard title="CommSec — holdings import">
        <p className="text-xs text-muted mb-3">
          Export your holdings CSV from CommSec (Portfolio → Holdings) and import it here. Positions are matched by
          ticker and revalued with live ASX prices.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="text-xs"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onCommsecFile(f);
          }}
        />
        {commsecError && <p className="text-xs text-danger mt-2">{commsecError}</p>}
        {commsecDone && <p className="text-xs text-accent mt-2">{commsecDone}</p>}
        {commsecRows && (
          <div className="mt-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted text-left">
                  <th className="py-1">Code</th>
                  <th className="py-1">Units</th>
                  <th className="py-1">Avg cost</th>
                  <th className="py-1">Type</th>
                </tr>
              </thead>
              <tbody>
                {commsecRows.map((r, idx) => (
                  <tr key={r.symbol} className="border-t border-bg-ring">
                    <td className="py-1.5 font-medium">{r.symbol}</td>
                    <td className="py-1.5">{r.quantity}</td>
                    <td className="py-1.5">{r.avg_cost ? money(r.avg_cost, true) : "—"}</td>
                    <td className="py-1.5">
                      <select
                        className="select text-xs py-0.5 max-w-[90px]"
                        value={r.kind}
                        onChange={(e) =>
                          setCommsecRows((rows) =>
                            rows!.map((row, i) => (i === idx ? { ...row, kind: e.target.value as "stock" | "etf" } : row))
                          )
                        }
                      >
                        <option value="etf">ETF</option>
                        <option value="stock">Stock</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end gap-2 mt-3">
              <button className="btn-ghost text-xs" onClick={() => setCommsecRows(null)}>Cancel</button>
              <button className="btn-primary text-xs" onClick={confirmCommsecImport}>
                Import {commsecRows.length} holdings
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Other integrations"
        action={<button className="btn-ghost text-xs" onClick={seedPlanned}>Seed planned</button>}
      >
        <p className="text-xs text-muted mb-3 leading-relaxed">
          Read-only design: keys live in environment variables on the server, never the frontend. Never request
          withdrawal or trading permissions.
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

      <SectionCard title="Demo data">
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary text-xs" onClick={loadDemo}>Load demo data</button>
          <button
            className="btn-danger text-xs"
            onClick={() => {
              if (confirm(supabaseEnabled ? "Wipe ALL data (cloud + local)?" : "Wipe all local data?")) resetAll();
            }}
          >
            Reset all
          </button>
        </div>
        <p className="text-xs text-muted mt-3">
          Demo loads a realistic AUD profile to preview the dashboard.
          {supabaseEnabled ? " In cloud mode, demo data and resets affect your Supabase account too." : " Reset wipes local storage."}
        </p>
      </SectionCard>
    </div>
  );
}
