/** Server-side price fetchers. All return AUD values where possible. */

const GRAMS_PER_TROY_OZ = 31.1035;

const YAHOO_HEADERS = {
  // Yahoo's v8 chart endpoint 403s without a browser-like UA.
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

export interface EquityPrice {
  price: number;
  currency: string;
  time: string;
}

/** Price via Yahoo's v8 chart endpoint. Symbol is used verbatim — callers
 *  append .AX for ASX listings; bare symbols (AAPL) resolve to US listings. */
export async function fetchEquity(symbol: string): Promise<EquityPrice> {
  const yahooSymbol = symbol;
  let res: Response | null = null;
  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    res = await fetch(
      `https://${host}/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`,
      { headers: YAHOO_HEADERS, next: { revalidate: 300 } }
    );
    if (res.ok) break;
  }
  if (!res || !res.ok) throw new Error(`Yahoo ${res?.status} for ${yahooSymbol}`);
  const json = (await res.json()) as {
    chart?: { result?: { meta?: { regularMarketPrice?: number; currency?: string } }[]; error?: { description?: string } };
  };
  const meta = json.chart?.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) {
    throw new Error(json.chart?.error?.description ?? `No price for ${yahooSymbol}`);
  }
  return { price: meta.regularMarketPrice, currency: meta.currency ?? "AUD", time: new Date().toISOString() };
}

/** Common CoinGecko ids for symbols people actually hold. */
const SYMBOL_TO_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  DOT: "polkadot",
  LINK: "chainlink",
  LTC: "litecoin",
  MATIC: "matic-network",
  POL: "matic-network",
  AVAX: "avalanche-2",
  BNB: "binancecoin",
  TRX: "tron",
  XLM: "stellar",
  UNI: "uniswap",
  ATOM: "cosmos",
  ALGO: "algorand",
  SHIB: "shiba-inu",
  PEPE: "pepe",
  USDT: "tether",
  USDC: "usd-coin",
  PAXG: "pax-gold",
};

export interface CryptoPrices {
  prices: Record<string, { aud: number; time: string }>;
  errors: Record<string, string>;
}

/** Batch AUD prices from CoinGecko's free simple/price endpoint. */
export async function fetchCryptoAud(symbols: string[]): Promise<CryptoPrices> {
  const prices: CryptoPrices["prices"] = {};
  const errors: CryptoPrices["errors"] = {};
  const known = symbols.filter((s) => {
    if (SYMBOL_TO_ID[s.toUpperCase()]) return true;
    errors[s] = "Unknown symbol — set value manually";
    return false;
  });
  if (known.length === 0) return { prices, errors };

  const ids = Array.from(new Set(known.map((s) => SYMBOL_TO_ID[s.toUpperCase()])));
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=aud`,
    { next: { revalidate: 300 } }
  );
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const json = (await res.json()) as Record<string, { aud?: number }>;
  const time = new Date().toISOString();
  for (const s of known) {
    const aud = json[SYMBOL_TO_ID[s.toUpperCase()]]?.aud;
    if (aud === undefined) errors[s] = "No price returned";
    else prices[s.toUpperCase()] = { aud, time };
  }
  return { prices, errors };
}

/** AUD per 1 USD. Tries Yahoo AUDUSD=X, falls back to CoinGecko USDT/AUD. */
export async function fetchAudPerUsd(): Promise<number> {
  try {
    const { price } = await fetchEquity("AUDUSD=X"); // USD per 1 AUD
    if (price > 0) return 1 / price;
  } catch {
    /* fall through to CoinGecko */
  }
  const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=aud", {
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`FX rate unavailable (CoinGecko ${res.status})`);
  const json = (await res.json()) as { tether?: { aud?: number } };
  const rate = json.tether?.aud;
  if (!rate) throw new Error("FX rate unavailable");
  return rate;
}

export interface GoldPrice {
  aud_per_oz: number;
  aud_per_gram: number;
  source: "paxg";
  time: string;
}

/** Gold spot proxied via PAXG (1 token ≈ 1 troy oz, tracks spot within ~1%). */
export async function fetchGoldAud(): Promise<GoldPrice> {
  const { prices, errors } = await fetchCryptoAud(["PAXG"]);
  const paxg = prices.PAXG;
  if (!paxg) throw new Error(errors.PAXG ?? "No gold price");
  return {
    aud_per_oz: paxg.aud,
    aud_per_gram: paxg.aud / GRAMS_PER_TROY_OZ,
    source: "paxg",
    time: paxg.time,
  };
}
