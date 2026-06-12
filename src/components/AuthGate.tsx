"use client";

import { useEffect, useState } from "react";
import { getSupabase, supabaseEnabled } from "@/lib/supabase";

type AuthState = "loading" | "signed-out" | "signed-in";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(supabaseEnabled ? "loading" : "signed-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const client = getSupabase();
    if (!client) return;
    client.auth.getSession().then(({ data }) => {
      setState(data.session ? "signed-in" : "signed-out");
    });
    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      setState(session ? "signed-in" : "signed-out");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!supabaseEnabled || state === "signed-in") return <>{children}</>;

  if (state === "loading") {
    return <div className="text-muted text-sm text-center py-20">Loading…</div>;
  }

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const client = getSupabase()!;
    const { error: err } = await client.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) setError(err.message);
  };

  return (
    <div className="max-w-sm mx-auto mt-16">
      <div className="card p-6">
        <h1 className="text-base font-semibold mb-1">Sign in</h1>
        <p className="text-xs text-muted mb-4">Your portfolio is private — sign in to continue.</p>
        <form onSubmit={signIn} className="space-y-3">
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="text-xs text-danger">{error}</div>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
