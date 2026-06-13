import { requireUser } from "@/lib/server/auth";
import { fetchAudPerUsd, fetchEquity, type EquityPrice } from "@/lib/server/prices";

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  const symbols = (new URL(req.url).searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  if (symbols.length === 0) {
    return Response.json({ error: "symbols query param required" }, { status: 400 });
  }

  const prices: Record<string, EquityPrice> = {};
  const errors: Record<string, string> = {};
  await Promise.all(
    symbols.map(async (s) => {
      try {
        prices[s] = await fetchEquity(s);
      } catch (e) {
        errors[s] = e instanceof Error ? e.message : "Failed to fetch";
      }
    })
  );

  // Include the FX rate whenever any result isn't AUD so the client can
  // convert USD market values into AUD portfolio values.
  let aud_per_usd: number | null = null;
  if (Object.values(prices).some((p) => p.currency !== "AUD")) {
    try {
      aud_per_usd = await fetchAudPerUsd();
    } catch (e) {
      errors["FX"] = e instanceof Error ? e.message : "FX rate unavailable";
    }
  }

  return Response.json({ prices, errors, aud_per_usd });
}
