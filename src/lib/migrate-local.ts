import type { SupabaseClient } from "@supabase/supabase-js";
import type { DB } from "./types";
import * as M from "./db-mappers";

const LEGACY_KEY = "invest-track:v1";
const MIGRATED_FLAG = "invest-track:migrated:v1";

export interface LegacySummary {
  assets: number;
  liabilities: number;
  transactions: number;
  snapshots: number;
  integrations: number;
  total: number;
}

/** Legacy V1 data that hasn't been imported yet, if any. */
export function detectLegacyData(): LegacySummary | null {
  if (typeof window === "undefined") return null;
  if (localStorage.getItem(MIGRATED_FLAG)) return null;
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const db = JSON.parse(raw) as Partial<DB>;
    const summary: LegacySummary = {
      assets: db.assets?.length ?? 0,
      liabilities: db.liabilities?.length ?? 0,
      transactions: db.transactions?.length ?? 0,
      snapshots: db.snapshots?.length ?? 0,
      integrations: db.integrations?.length ?? 0,
      total: 0,
    };
    summary.total =
      summary.assets + summary.liabilities + summary.transactions + summary.snapshots + summary.integrations;
    return summary.total > 0 ? summary : null;
  } catch {
    return null;
  }
}

/**
 * One-time import of legacy localStorage data into Supabase.
 * Old ids (a_xxx style) are remapped to fresh uuids with FK references kept
 * intact. The legacy key is left untouched as a rollback backup.
 */
export async function migrateLegacy(client: SupabaseClient, userId: string): Promise<LegacySummary> {
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) throw new Error("No legacy data found");
  const legacy = JSON.parse(raw) as Partial<DB>;

  const idMap = new Map<string, string>();
  const mapId = (old: string) => {
    let fresh = idMap.get(old);
    if (!fresh) {
      fresh = crypto.randomUUID();
      idMap.set(old, fresh);
    }
    return fresh;
  };
  const mapRef = (old: string | null | undefined) => (old ? idMap.get(old) ?? null : null);

  const assets = (legacy.assets ?? []).map((a) => ({ ...a, id: mapId(a.id) }));
  const liabilities = (legacy.liabilities ?? []).map((l) => ({
    ...l,
    id: mapId(l.id),
    linked_asset_id: mapRef(l.linked_asset_id),
  }));
  const transactions = (legacy.transactions ?? []).map((t) => ({
    ...t,
    id: mapId(t.id),
    asset_id: mapRef(t.asset_id),
    liability_id: mapRef(t.liability_id),
  }));
  const snapshots = (legacy.snapshots ?? []).map((s) => ({ ...s, id: mapId(s.id) }));
  const integrations = (legacy.integrations ?? []).map((i) => ({ ...i, id: mapId(i.id) }));

  // FK dependency order: assets first, then everything referencing them.
  const steps: [string, Record<string, unknown>[]][] = [
    ["assets", assets.map((a) => M.assetToRow(a, userId))],
    ["liabilities", liabilities.map((l) => M.liabilityToRow(l, userId))],
    ["transactions", transactions.map((t) => M.transactionToRow(t, userId))],
    ["net_worth_snapshots", snapshots.map((s) => M.snapshotToRow(s, userId))],
    ["integrations", integrations.map((i) => M.integrationToRow(i, userId))],
  ];
  for (const [table, rows] of steps) {
    if (rows.length === 0) continue;
    const { error } = await client.from(table).insert(rows);
    if (error) throw new Error(`Import failed at ${table}: ${String((error as { message?: string }).message ?? error)}`);
  }

  localStorage.setItem(MIGRATED_FLAG, "1");
  return {
    assets: assets.length,
    liabilities: liabilities.length,
    transactions: transactions.length,
    snapshots: snapshots.length,
    integrations: integrations.length,
    total: assets.length + liabilities.length + transactions.length + snapshots.length + integrations.length,
  };
}
