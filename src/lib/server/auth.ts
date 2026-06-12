import { createClient } from "@supabase/supabase-js";

/**
 * Validates the caller's Supabase access token (Authorization: Bearer ...).
 * Returns the user id, or null if unauthenticated.
 * If Supabase isn't configured (local/demo mode), auth is skipped — routes
 * still work for local development but hold no user data anyway.
 */
export async function requireUser(req: Request): Promise<{ userId: string | null; response?: Response }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { userId: null };

  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return { userId: null, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const client = createClient(url, key);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    return { userId: null, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { userId: data.user.id };
}
