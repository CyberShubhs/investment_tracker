import type { Asset } from "./types";
import { getAccessToken, getSupabase } from "./supabase";

/** Holdings worth less than this (AUD) are dust — skipped on import. */
const MIN_AUD_VALUE = 1;

export interface CoinspotSyncResult {
  created: number;
  updated: number;
  totalAud: number;
  fetchedAt: string;
  /** CoinSpot-synced assets that are now gone or worth < $1 — candidates for removal. */
  stale: Asset[];
}

type AddAsset = (a: Omit<Asset, "id" | "created_at" | "updated_at">) => void;
type UpdateAsset = (id: string, patch: Partial<Asset>) => void;

export async function coinspotStatus(): Promise<boolean> {
  const token = await getAccessToken();
  const res = await fetch("/api/coinspot/sync", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) return false;
  const json = (await res.json()) as { configured?: boolean };
  return Boolean(json.configured);
}

/**
 * Pull CoinSpot balances and upsert crypto assets keyed by external_key.
 * Matching uses the freshest asset list available (remote when signed in) so a
 * stale local cache can't cause duplicate-key insert failures.
 */
export async function syncCoinspot(
  localAssets: Asset[],
  addAsset: AddAsset,
  updateAsset: UpdateAsset
): Promise<CoinspotSyncResult> {
  const token = await getAccessToken();
  const res = await fetch("/api/coinspot/sync", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as {
    balances?: { symbol: string; quantity: number; audValue: number; rate: number }[];
    fetchedAt?: string;
    error?: string;
  };
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);

  // Source of truth for "does this holding already exist": remote DB when available.
  let assets = localAssets;
  const client = getSupabase();
  if (client) {
    const { data } = await client.from("assets").select("id, external_key, current_value");
    if (data) {
      const byKey = new Map(data.filter((r) => r.external_key).map((r) => [r.external_key as string, r]));
      assets = localAssets.filter((a) => !a.external_key || byKey.has(a.external_key));
      for (const r of data) {
        if (r.external_key && !localAssets.some((a) => a.id === r.id)) {
          assets.push({ id: r.id, external_key: r.external_key, current_value: Number(r.current_value) } as Asset);
        }
      }
    }
  }

  const balances = (json.balances ?? []).filter((b) => b.audValue >= MIN_AUD_VALUE);
  const fetchedAt = json.fetchedAt ?? new Date().toISOString();
  let created = 0;
  let updated = 0;
  let totalAud = 0;
  const seen = new Set<string>();

  for (const b of balances) {
    const key = `coinspot:${b.symbol}`;
    seen.add(key);
    totalAud += b.audValue;
    const existing = assets.find((a) => a.external_key === key);
    if (existing) {
      updateAsset(existing.id, {
        quantity: b.quantity,
        current_value: b.audValue,
        price_source: "coinspot",
        last_priced_at: fetchedAt,
      });
      updated++;
    } else {
      addAsset({
        name: `${b.symbol} (CoinSpot)`,
        type: "crypto",
        provider: "CoinSpot",
        symbol: b.symbol,
        quantity: b.quantity,
        current_value: b.audValue,
        currency: "AUD",
        price_source: "coinspot",
        last_priced_at: fetchedAt,
        external_key: key,
      });
      created++;
    }
  }

  const stale = assets.filter(
    (a) => a.external_key?.startsWith("coinspot:") && !seen.has(a.external_key)
  );
  return { created, updated, totalAud, fetchedAt, stale };
}
