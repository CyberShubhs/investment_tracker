"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Asset,
  CashflowCategory,
  CashflowDirection,
  CashflowEntry,
  DB,
  Integration,
  Liability,
  RecurringRule,
  Snapshot,
  Transaction,
} from "./types";
import { uid } from "./uid";
import { makeDemoDB } from "./demo";
import { getSupabase, supabaseEnabled } from "./supabase";
import * as M from "./db-mappers";
import { materializeRules } from "./recurring";

const KEY = "invest-track:v2";
const LEGACY_KEY = "invest-track:v1";

const empty: DB = {
  assets: [],
  liabilities: [],
  transactions: [],
  snapshots: [],
  integrations: [],
  cashflow_categories: [],
  cashflow_entries: [],
  recurring_rules: [],
};

const DEFAULT_CATEGORIES: { name: string; direction: CashflowDirection }[] = [
  { name: "Salary", direction: "income" },
  { name: "Interest", direction: "income" },
  { name: "Dividends", direction: "income" },
  { name: "Other income", direction: "income" },
  { name: "Rent / Mortgage", direction: "expense" },
  { name: "Groceries", direction: "expense" },
  { name: "Utilities", direction: "expense" },
  { name: "Transport", direction: "expense" },
  { name: "Subscriptions", direction: "expense" },
  { name: "Eating out", direction: "expense" },
  { name: "Health", direction: "expense" },
  { name: "Entertainment", direction: "expense" },
  { name: "Other", direction: "expense" },
];

function load(): DB {
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<DB>;
    return { ...empty, ...parsed };
  } catch {
    return empty;
  }
}

function save(db: DB) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(db));
}

/** undefined -> null so optional fields clear properly in Postgres patches. */
function patchRow(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) out[k] = v === undefined ? null : v;
  return out;
}

export type SyncStatus = "local" | "loading" | "idle" | "error" | "offline";

interface StoreCtx {
  db: DB;
  ready: boolean;
  syncStatus: SyncStatus;
  syncError: string | null;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  addAsset: (a: Omit<Asset, "id" | "created_at" | "updated_at">) => void;
  updateAsset: (id: string, patch: Partial<Asset>) => void;
  removeAsset: (id: string) => void;
  addLiability: (l: Omit<Liability, "id" | "created_at" | "updated_at">) => void;
  updateLiability: (id: string, patch: Partial<Liability>) => void;
  removeLiability: (id: string) => void;
  addTransaction: (t: Omit<Transaction, "id" | "created_at">) => void;
  removeTransaction: (id: string) => void;
  createSnapshot: (note?: string) => Snapshot;
  removeSnapshot: (id: string) => void;
  addIntegration: (i: Omit<Integration, "id" | "created_at">) => void;
  updateIntegration: (id: string, patch: Partial<Integration>) => void;
  removeIntegration: (id: string) => void;
  addCashflowEntry: (e: Omit<CashflowEntry, "id" | "created_at">) => void;
  updateCashflowEntry: (id: string, patch: Partial<CashflowEntry>) => void;
  removeCashflowEntry: (id: string) => void;
  addCategory: (name: string, direction: CashflowDirection) => CashflowCategory;
  removeCategory: (id: string) => void;
  addRecurringRule: (r: Omit<RecurringRule, "id" | "created_at">) => void;
  updateRecurringRule: (id: string, patch: Partial<RecurringRule>) => void;
  removeRecurringRule: (id: string) => void;
  loadDemo: () => void;
  resetAll: () => void;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB>(empty);
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(supabaseEnabled ? "loading" : "local");
  const [syncError, setSyncError] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const hydratedRef = useRef(false);

  // Fire-and-forget remote write; errors surface via syncStatus + syncError.
  const remote = useCallback(
    (fn: (c: SupabaseClient, userId: string) => PromiseLike<{ error: unknown }>) => {
      const client = getSupabase();
      const userId = userIdRef.current;
      if (!client || !userId) return;
      Promise.resolve(fn(client, userId)).then(({ error }) => {
        if (error) {
          console.error("Supabase write failed:", error);
          const msg =
            typeof error === "object" && error && "message" in error
              ? String((error as { message: unknown }).message)
              : String(error);
          setSyncError(msg);
          setSyncStatus("error");
        }
      });
    },
    []
  );

  // Hydrate: localStorage cache instantly, then Supabase as source of truth.
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const cached = load();
    setDb(cached);
    setReady(true);

    const client = getSupabase();
    if (!client) {
      // Local-only mode: seed default categories once so cash flow is usable.
      if (cached.cashflow_categories.length === 0) {
        const now = new Date().toISOString();
        const cats = DEFAULT_CATEGORIES.map((c) => ({ ...c, id: uid("c"), created_at: now }));
        setDb((d) => (d.cashflow_categories.length === 0 ? { ...d, cashflow_categories: cats } : d));
      }
      return;
    }

    (async () => {
      const { data: sess } = await client.auth.getSession();
      const userId = sess.session?.user.id ?? null;
      userIdRef.current = userId;
      if (!userId) {
        setSyncStatus("error");
        return;
      }
      try {
        const q = (table: string, order = "created_at") =>
          client.from(table).select("*").order(order, { ascending: true }).then(({ data, error }) => {
            if (error) throw error;
            return data ?? [];
          });

        const [assets, liabilities, transactions, snapshots, integrations, categories, entries, rules] =
          await Promise.all([
            q("assets"),
            q("liabilities"),
            q("transactions"),
            q("net_worth_snapshots", "date"),
            q("integrations"),
            q("cashflow_categories"),
            q("cashflow_entries", "date"),
            q("recurring_rules"),
          ]);

        let next: DB = {
          assets: assets.map(M.rowToAsset),
          liabilities: liabilities.map(M.rowToLiability),
          transactions: transactions.map(M.rowToTransaction).reverse(),
          snapshots: snapshots.map(M.rowToSnapshot),
          integrations: integrations.map(M.rowToIntegration),
          cashflow_categories: categories.map(M.rowToCategory),
          cashflow_entries: entries.map(M.rowToEntry),
          recurring_rules: rules.map(M.rowToRule),
        };

        // Seed default categories whenever remote has none. Upsert with
        // ignoreDuplicates makes this safe to retry on every load.
        if (next.cashflow_categories.length === 0) {
          const now = new Date().toISOString();
          const cats: CashflowCategory[] = DEFAULT_CATEGORIES.map((c) => ({
            ...c,
            id: uid("c"),
            created_at: now,
          }));
          next = { ...next, cashflow_categories: cats };
          remote((c, u) =>
            c.from("cashflow_categories").upsert(
              cats.map((cat) => M.categoryToRow(cat, u)),
              { onConflict: "user_id,direction,name", ignoreDuplicates: true }
            )
          );
        }

        // Catch up recurring entries (idempotent across devices via unique constraint).
        const due = materializeRules(next.recurring_rules, next.cashflow_entries);
        if (due.length > 0) {
          next = { ...next, cashflow_entries: [...next.cashflow_entries, ...due] };
          remote((c, u) =>
            c.from("cashflow_entries").upsert(
              due.map((e) => M.entryToRow(e, u)),
              { onConflict: "user_id,recurring_rule_id,date", ignoreDuplicates: true }
            )
          );
        }

        setDb(next);
        save(next);
        setSyncStatus("idle");
        setSyncError(null);
      } catch (err) {
        console.error("Supabase hydrate failed:", err);
        setSyncStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
      }
    })();
  }, [remote]);

  useEffect(() => {
    if (ready) save(db);
  }, [db, ready]);

  const totalAssets = useMemo(() => db.assets.reduce((s, a) => s + (a.current_value || 0), 0), [db.assets]);
  const totalLiabilities = useMemo(() => db.liabilities.reduce((s, l) => s + (l.balance || 0), 0), [db.liabilities]);
  const netWorth = totalAssets - totalLiabilities;

  const addAsset: StoreCtx["addAsset"] = useCallback((a) => {
    const now = new Date().toISOString();
    const asset: Asset = { ...a, id: uid("a"), created_at: now, updated_at: now };
    setDb((d) => ({ ...d, assets: [...d.assets, asset] }));
    remote((c, u) => c.from("assets").insert(M.assetToRow(asset, u)));
  }, [remote]);
  const updateAsset: StoreCtx["updateAsset"] = useCallback((id, patch) => {
    const now = new Date().toISOString();
    setDb((d) => ({
      ...d,
      assets: d.assets.map((a) => (a.id === id ? { ...a, ...patch, updated_at: now } : a)),
    }));
    remote((c) => c.from("assets").update(patchRow({ ...patch, updated_at: now })).eq("id", id));
  }, [remote]);
  const removeAsset: StoreCtx["removeAsset"] = useCallback((id) => {
    setDb((d) => ({ ...d, assets: d.assets.filter((a) => a.id !== id) }));
    remote((c) => c.from("assets").delete().eq("id", id));
  }, [remote]);

  const addLiability: StoreCtx["addLiability"] = useCallback((l) => {
    const now = new Date().toISOString();
    const liab: Liability = { ...l, id: uid("l"), created_at: now, updated_at: now };
    setDb((d) => ({ ...d, liabilities: [...d.liabilities, liab] }));
    remote((c, u) => c.from("liabilities").insert(M.liabilityToRow(liab, u)));
  }, [remote]);
  const updateLiability: StoreCtx["updateLiability"] = useCallback((id, patch) => {
    const now = new Date().toISOString();
    setDb((d) => ({
      ...d,
      liabilities: d.liabilities.map((l) => (l.id === id ? { ...l, ...patch, updated_at: now } : l)),
    }));
    remote((c) => c.from("liabilities").update(patchRow({ ...patch, updated_at: now })).eq("id", id));
  }, [remote]);
  const removeLiability: StoreCtx["removeLiability"] = useCallback((id) => {
    setDb((d) => ({ ...d, liabilities: d.liabilities.filter((l) => l.id !== id) }));
    remote((c) => c.from("liabilities").delete().eq("id", id));
  }, [remote]);

  const addTransaction: StoreCtx["addTransaction"] = useCallback((t) => {
    const tx: Transaction = { ...t, id: uid("t"), created_at: new Date().toISOString() };
    setDb((d) => ({ ...d, transactions: [tx, ...d.transactions] }));
    remote((c, u) => c.from("transactions").insert(M.transactionToRow(tx, u)));
  }, [remote]);
  const removeTransaction: StoreCtx["removeTransaction"] = useCallback((id) => {
    setDb((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== id) }));
    remote((c) => c.from("transactions").delete().eq("id", id));
  }, [remote]);

  const createSnapshot: StoreCtx["createSnapshot"] = useCallback((note) => {
    const total_assets = db.assets.reduce((s, a) => s + (a.current_value || 0), 0);
    const total_liabilities = db.liabilities.reduce((s, l) => s + (l.balance || 0), 0);
    const snap: Snapshot = {
      id: uid("s"),
      date: new Date().toISOString(),
      total_assets,
      total_liabilities,
      net_worth: total_assets - total_liabilities,
      note,
    };
    setDb((d) => ({ ...d, snapshots: [...d.snapshots, snap] }));
    remote((c, u) => c.from("net_worth_snapshots").insert(M.snapshotToRow(snap, u)));
    return snap;
  }, [db.assets, db.liabilities, remote]);

  const removeSnapshot: StoreCtx["removeSnapshot"] = useCallback((id) => {
    setDb((d) => ({ ...d, snapshots: d.snapshots.filter((s) => s.id !== id) }));
    remote((c) => c.from("net_worth_snapshots").delete().eq("id", id));
  }, [remote]);

  const addIntegration: StoreCtx["addIntegration"] = useCallback((i) => {
    const integ: Integration = { ...i, id: uid("i"), created_at: new Date().toISOString() };
    setDb((d) => ({ ...d, integrations: [...d.integrations, integ] }));
    remote((c, u) => c.from("integrations").insert(M.integrationToRow(integ, u)));
  }, [remote]);
  const updateIntegration: StoreCtx["updateIntegration"] = useCallback((id, patch) => {
    setDb((d) => ({ ...d, integrations: d.integrations.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
    remote((c) => c.from("integrations").update(patchRow({ ...patch })).eq("id", id));
  }, [remote]);
  const removeIntegration: StoreCtx["removeIntegration"] = useCallback((id) => {
    setDb((d) => ({ ...d, integrations: d.integrations.filter((i) => i.id !== id) }));
    remote((c) => c.from("integrations").delete().eq("id", id));
  }, [remote]);

  const addCashflowEntry: StoreCtx["addCashflowEntry"] = useCallback((e) => {
    const entry: CashflowEntry = { ...e, id: uid("e"), created_at: new Date().toISOString() };
    setDb((d) => ({ ...d, cashflow_entries: [...d.cashflow_entries, entry] }));
    remote((c, u) => c.from("cashflow_entries").insert(M.entryToRow(entry, u)));
  }, [remote]);
  const updateCashflowEntry: StoreCtx["updateCashflowEntry"] = useCallback((id, patch) => {
    setDb((d) => ({
      ...d,
      cashflow_entries: d.cashflow_entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
    remote((c) => c.from("cashflow_entries").update(patchRow({ ...patch })).eq("id", id));
  }, [remote]);
  const removeCashflowEntry: StoreCtx["removeCashflowEntry"] = useCallback((id) => {
    setDb((d) => ({ ...d, cashflow_entries: d.cashflow_entries.filter((e) => e.id !== id) }));
    remote((c) => c.from("cashflow_entries").delete().eq("id", id));
  }, [remote]);

  const addCategory: StoreCtx["addCategory"] = useCallback((name, direction) => {
    const cat: CashflowCategory = { id: uid("c"), name, direction, created_at: new Date().toISOString() };
    setDb((d) => ({ ...d, cashflow_categories: [...d.cashflow_categories, cat] }));
    remote((c, u) => c.from("cashflow_categories").insert(M.categoryToRow(cat, u)));
    return cat;
  }, [remote]);
  const removeCategory: StoreCtx["removeCategory"] = useCallback((id) => {
    setDb((d) => ({
      ...d,
      cashflow_categories: d.cashflow_categories.filter((c) => c.id !== id),
      // mirror Postgres "on delete set null"
      cashflow_entries: d.cashflow_entries.map((e) => (e.category_id === id ? { ...e, category_id: null } : e)),
      recurring_rules: d.recurring_rules.map((r) => (r.category_id === id ? { ...r, category_id: null } : r)),
    }));
    remote((c) => c.from("cashflow_categories").delete().eq("id", id));
  }, [remote]);

  const addRecurringRule: StoreCtx["addRecurringRule"] = useCallback((r) => {
    const rule: RecurringRule = { ...r, id: uid("r"), created_at: new Date().toISOString() };
    const due = materializeRules([rule], []);
    setDb((d) => ({
      ...d,
      recurring_rules: [...d.recurring_rules, rule],
      cashflow_entries: [...d.cashflow_entries, ...due],
    }));
    remote(async (c, u) => {
      const { error } = await c.from("recurring_rules").insert(M.ruleToRow(rule, u));
      if (error) return { error };
      if (due.length === 0) return { error: null };
      return c.from("cashflow_entries").upsert(
        due.map((e) => M.entryToRow(e, u)),
        { onConflict: "user_id,recurring_rule_id,date", ignoreDuplicates: true }
      );
    });
  }, [remote]);
  const updateRecurringRule: StoreCtx["updateRecurringRule"] = useCallback((id, patch) => {
    setDb((d) => ({
      ...d,
      recurring_rules: d.recurring_rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
    remote((c) => c.from("recurring_rules").update(patchRow({ ...patch })).eq("id", id));
  }, [remote]);
  const removeRecurringRule: StoreCtx["removeRecurringRule"] = useCallback((id) => {
    setDb((d) => ({
      ...d,
      recurring_rules: d.recurring_rules.filter((r) => r.id !== id),
      cashflow_entries: d.cashflow_entries.map((e) =>
        e.recurring_rule_id === id ? { ...e, recurring_rule_id: null } : e
      ),
    }));
    remote((c) => c.from("recurring_rules").delete().eq("id", id));
  }, [remote]);

  const loadDemo: StoreCtx["loadDemo"] = useCallback(() => {
    const demo = makeDemoDB();
    setDb(demo);
    remote(async (c, u) => {
      // FK order: assets before liabilities, categories before entries.
      const steps: [string, Record<string, unknown>[]][] = [
        ["assets", demo.assets.map((a) => M.assetToRow(a, u))],
        ["liabilities", demo.liabilities.map((l) => M.liabilityToRow(l, u))],
        ["net_worth_snapshots", demo.snapshots.map((s) => M.snapshotToRow(s, u))],
        ["integrations", demo.integrations.map((i) => M.integrationToRow(i, u))],
        ["cashflow_categories", demo.cashflow_categories.map((cat) => M.categoryToRow(cat, u))],
        ["cashflow_entries", demo.cashflow_entries.map((e) => M.entryToRow(e, u))],
      ];
      for (const [table, rows] of steps) {
        if (rows.length === 0) continue;
        const { error } = await c.from(table).insert(rows);
        if (error) return { error };
      }
      return { error: null };
    });
  }, [remote]);

  const resetAll: StoreCtx["resetAll"] = useCallback(() => {
    setDb(empty);
    remote(async (c, u) => {
      // FK-safe delete order.
      for (const table of [
        "cashflow_entries",
        "recurring_rules",
        "cashflow_categories",
        "transactions",
        "liabilities",
        "assets",
        "net_worth_snapshots",
        "integrations",
      ]) {
        const { error } = await c.from(table).delete().eq("user_id", u);
        if (error) return { error };
      }
      return { error: null };
    });
  }, [remote]);

  const value: StoreCtx = {
    db,
    ready,
    syncStatus,
    syncError,
    totalAssets,
    totalLiabilities,
    netWorth,
    addAsset,
    updateAsset,
    removeAsset,
    addLiability,
    updateLiability,
    removeLiability,
    addTransaction,
    removeTransaction,
    createSnapshot,
    removeSnapshot,
    addIntegration,
    updateIntegration,
    removeIntegration,
    addCashflowEntry,
    updateCashflowEntry,
    removeCashflowEntry,
    addCategory,
    removeCategory,
    addRecurringRule,
    updateRecurringRule,
    removeRecurringRule,
    loadDemo,
    resetAll,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore must be used within StoreProvider");
  return c;
}
