import { requireUser } from "@/lib/server/auth";
import { fetchCryptoAud } from "@/lib/server/prices";

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

  try {
    return Response.json(await fetchCryptoAud(symbols));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed to fetch" }, { status: 502 });
  }
}
