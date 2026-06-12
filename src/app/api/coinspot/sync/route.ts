import { requireUser } from "@/lib/server/auth";
import { coinspotConfigured, fetchBalances } from "@/lib/server/coinspot";

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  return Response.json({ configured: coinspotConfigured() });
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  if (!coinspotConfigured()) {
    return Response.json(
      { error: "CoinSpot not configured. Set COINSPOT_API_KEY and COINSPOT_API_SECRET (read-only key)." },
      { status: 400 }
    );
  }
  try {
    const balances = await fetchBalances();
    return Response.json({ balances, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "CoinSpot sync failed" }, { status: 502 });
  }
}
