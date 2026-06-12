import type { Asset } from "./types";
import { getAccessToken } from "./supabase";

export interface RefreshSummary {
  updated: number;
  failed: { symbol: string; reason: string }[];
}

type UpdateAsset = (id: string, patch: Partial<Asset>) => void;

async function getJSON(path: string, token: string | null) {
  const res = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
  return json;
}

/**
 * Revalues all priceable assets:
 * - stock/etf with a symbol -> ASX price (Yahoo proxy), value = quantity * price
 * - crypto with a symbol (not CoinSpot-synced) -> CoinGecko AUD
 * - metal with weight -> gold spot (PAXG proxy), value = grams * purity * AUD/gram
 */
export async function refreshPrices(assets: Asset[], updateAsset: UpdateAsset): Promise<RefreshSummary> {
  const token = await getAccessToken();
  const summary: RefreshSummary = { updated: 0, failed: [] };

  const equities = assets.filter((a) => (a.type === "stock" || a.type === "etf") && a.symbol && a.quantity);
  const cryptos = assets.filter(
    (a) => a.type === "crypto" && a.symbol && a.quantity && a.price_source !== "coinspot"
  );
  const metals = assets.filter((a) => a.type === "metal" && a.weight_grams);

  const jobs: Promise<void>[] = [];

  if (equities.length > 0) {
    const symbols = Array.from(new Set(equities.map((a) => a.symbol!.toUpperCase())));
    jobs.push(
      getJSON(`/api/prices/equities?symbols=${symbols.join(",")}`, token)
        .then((data: { prices: Record<string, { price: number; time: string }>; errors: Record<string, string> }) => {
          for (const a of equities) {
            const p = data.prices[a.symbol!.toUpperCase()];
            if (p) {
              updateAsset(a.id, {
                current_value: Math.round(a.quantity! * p.price * 100) / 100,
                price_source: "yahoo",
                last_priced_at: p.time,
              });
              summary.updated++;
            } else {
              summary.failed.push({ symbol: a.symbol!, reason: data.errors[a.symbol!.toUpperCase()] ?? "No price" });
            }
          }
        })
        .catch((e) => {
          for (const a of equities) summary.failed.push({ symbol: a.symbol!, reason: e.message });
        })
    );
  }

  if (cryptos.length > 0) {
    const symbols = Array.from(new Set(cryptos.map((a) => a.symbol!.toUpperCase())));
    jobs.push(
      getJSON(`/api/prices/crypto?symbols=${symbols.join(",")}`, token)
        .then((data: { prices: Record<string, { aud: number; time: string }>; errors: Record<string, string> }) => {
          for (const a of cryptos) {
            const p = data.prices[a.symbol!.toUpperCase()];
            if (p) {
              updateAsset(a.id, {
                current_value: Math.round(a.quantity! * p.aud * 100) / 100,
                price_source: "coingecko",
                last_priced_at: p.time,
              });
              summary.updated++;
            } else {
              summary.failed.push({ symbol: a.symbol!, reason: data.errors[a.symbol!.toUpperCase()] ?? "No price" });
            }
          }
        })
        .catch((e) => {
          for (const a of cryptos) summary.failed.push({ symbol: a.symbol!, reason: e.message });
        })
    );
  }

  if (metals.length > 0) {
    jobs.push(
      getJSON(`/api/prices/gold`, token)
        .then((data: { aud_per_gram: number; time: string }) => {
          for (const a of metals) {
            updateAsset(a.id, {
              current_value: Math.round(a.weight_grams! * (a.purity ?? 1) * data.aud_per_gram * 100) / 100,
              price_source: "paxg",
              last_priced_at: data.time,
            });
            summary.updated++;
          }
        })
        .catch((e) => {
          for (const a of metals) summary.failed.push({ symbol: a.name, reason: e.message });
        })
    );
  }

  await Promise.all(jobs);
  return summary;
}

/** True if an asset's live price is missing or older than 24h (only for priceable assets). */
export function isStale(a: Asset): boolean {
  const priceable =
    ((a.type === "stock" || a.type === "etf" || a.type === "crypto") && Boolean(a.symbol) && Boolean(a.quantity)) ||
    (a.type === "metal" && Boolean(a.weight_grams));
  if (!priceable) return false;
  if (!a.last_priced_at) return true;
  return Date.now() - new Date(a.last_priced_at).getTime() > 24 * 3600 * 1000;
}
