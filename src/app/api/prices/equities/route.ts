import { requireUser } from "@/lib/server/auth";
import { fetchEquity, type EquityPrice } from "@/lib/server/prices";

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
  return Response.json({ prices, errors });
}
