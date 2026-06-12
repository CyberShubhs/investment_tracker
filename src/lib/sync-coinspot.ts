import type { Asset } from "./types";
import { getAccessToken } from "./supabase";

export interface CoinspotSyncResult {
  created: number;
  updated: number;
  totalAud: number;
  fetchedAt: string;
  /** CoinSpot-synced assets no longer present in the API response. */
  missing: Asset[];
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

/** Pull CoinSpot balances and upsert crypto assets keyed by external_key. */
export async function syncCoinspot(
  assets: Asset[],
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

  const balances = json.balances ?? [];
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

  const missing = assets.filter(
    (a) => a.external_key?.startsWith("coinspot:") && !seen.has(a.external_key)
  );
  return { created, updated, totalAud, fetchedAt, missing };
}
