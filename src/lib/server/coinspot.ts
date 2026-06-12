import { createHmac } from "crypto";

const API_BASE = "https://www.coinspot.com.au/api/v2/ro";

export function coinspotConfigured(): boolean {
  return Boolean(process.env.COINSPOT_API_KEY && process.env.COINSPOT_API_SECRET);
}

export interface CoinspotBalance {
  symbol: string;
  quantity: number;
  audValue: number;
  rate: number;
}

/**
 * Read-only balances via CoinSpot API v2.
 * Signature is HMAC-SHA512 of the exact JSON body bytes; nonce must strictly
 * increase per key, so Date.now() works as long as the key isn't shared.
 */
export async function fetchBalances(): Promise<CoinspotBalance[]> {
  const key = process.env.COINSPOT_API_KEY;
  const secret = process.env.COINSPOT_API_SECRET;
  if (!key || !secret) throw new Error("CoinSpot API key/secret not configured");

  const body = JSON.stringify({ nonce: Date.now() });
  const sign = createHmac("sha512", secret).update(body).digest("hex");

  const res = await fetch(`${API_BASE}/my/balances`, {
    method: "POST",
    headers: { "Content-Type": "application/json", key, sign },
    body,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`CoinSpot HTTP ${res.status}`);

  const json = (await res.json()) as {
    status: string;
    message?: string;
    // CoinSpot returns an array of single-key objects:
    // [{ "BTC": { balance, audbalance, rate } }, ...]
    balances?: Record<string, { balance: number; audbalance: number; rate: number }>[];
  };
  if (json.status !== "ok") throw new Error(json.message ?? "CoinSpot returned an error");

  const out: CoinspotBalance[] = [];
  for (const entry of json.balances ?? []) {
    for (const [symbol, b] of Object.entries(entry)) {
      out.push({
        symbol: symbol.toUpperCase(),
        quantity: Number(b.balance) || 0,
        audValue: Number(b.audbalance) || 0,
        rate: Number(b.rate) || 0,
      });
    }
  }
  return out.filter((b) => b.quantity > 0);
}
