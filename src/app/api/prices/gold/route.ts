import { requireUser } from "@/lib/server/auth";
import { fetchGoldAud } from "@/lib/server/prices";

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  try {
    return Response.json(await fetchGoldAud());
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed to fetch" }, { status: 502 });
  }
}
