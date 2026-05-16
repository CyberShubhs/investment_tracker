"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Asset, DB, Integration, Liability, Snapshot, Transaction } from "./types";
import { uid } from "./uid";
import { makeDemoDB } from "./demo";

const KEY = "invest-track:v1";

const empty: DB = {
  assets: [],
  liabilities: [],
  transactions: [],
  snapshots: [],
  integrations: [],
};

function load(): DB {
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as DB;
    return { ...empty, ...parsed };
  } catch {
    return empty;
  }
}

function save(db: DB) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(db));
}

interface StoreCtx {
  db: DB;
  ready: boolean;
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
  loadDemo: () => void;
  resetAll: () => void;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB>(empty);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDb(load());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) save(db);
  }, [db, ready]);

  const totalAssets = useMemo(() => db.assets.reduce((s, a) => s + (a.current_value || 0), 0), [db.assets]);
  const totalLiabilities = useMemo(() => db.liabilities.reduce((s, l) => s + (l.balance || 0), 0), [db.liabilities]);
  const netWorth = totalAssets - totalLiabilities;

  const addAsset: StoreCtx["addAsset"] = useCallback((a) => {
    const now = new Date().toISOString();
    setDb((d) => ({ ...d, assets: [...d.assets, { ...a, id: uid("a"), created_at: now, updated_at: now }] }));
  }, []);
  const updateAsset: StoreCtx["updateAsset"] = useCallback((id, patch) => {
    setDb((d) => ({
      ...d,
      assets: d.assets.map((a) => (a.id === id ? { ...a, ...patch, updated_at: new Date().toISOString() } : a)),
    }));
  }, []);
  const removeAsset: StoreCtx["removeAsset"] = useCallback((id) => {
    setDb((d) => ({ ...d, assets: d.assets.filter((a) => a.id !== id) }));
  }, []);

  const addLiability: StoreCtx["addLiability"] = useCallback((l) => {
    const now = new Date().toISOString();
    setDb((d) => ({ ...d, liabilities: [...d.liabilities, { ...l, id: uid("l"), created_at: now, updated_at: now }] }));
  }, []);
  const updateLiability: StoreCtx["updateLiability"] = useCallback((id, patch) => {
    setDb((d) => ({
      ...d,
      liabilities: d.liabilities.map((l) => (l.id === id ? { ...l, ...patch, updated_at: new Date().toISOString() } : l)),
    }));
  }, []);
  const removeLiability: StoreCtx["removeLiability"] = useCallback((id) => {
    setDb((d) => ({ ...d, liabilities: d.liabilities.filter((l) => l.id !== id) }));
  }, []);

  const addTransaction: StoreCtx["addTransaction"] = useCallback((t) => {
    setDb((d) => ({ ...d, transactions: [{ ...t, id: uid("t"), created_at: new Date().toISOString() }, ...d.transactions] }));
  }, []);
  const removeTransaction: StoreCtx["removeTransaction"] = useCallback((id) => {
    setDb((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== id) }));
  }, []);

  const createSnapshot: StoreCtx["createSnapshot"] = useCallback((note) => {
    const totals = {
      total_assets: db.assets.reduce((s, a) => s + (a.current_value || 0), 0),
      total_liabilities: db.liabilities.reduce((s, l) => s + (l.balance || 0), 0),
    };
    const snap: Snapshot = {
      id: uid("s"),
      date: new Date().toISOString(),
      total_assets: totals.total_assets,
      total_liabilities: totals.total_liabilities,
      net_worth: totals.total_assets - totals.total_liabilities,
      note,
    };
    setDb((d) => ({ ...d, snapshots: [...d.snapshots, snap] }));
    return snap;
  }, [db.assets, db.liabilities]);

  const removeSnapshot: StoreCtx["removeSnapshot"] = useCallback((id) => {
    setDb((d) => ({ ...d, snapshots: d.snapshots.filter((s) => s.id !== id) }));
  }, []);

  const addIntegration: StoreCtx["addIntegration"] = useCallback((i) => {
    setDb((d) => ({ ...d, integrations: [...d.integrations, { ...i, id: uid("i"), created_at: new Date().toISOString() }] }));
  }, []);
  const updateIntegration: StoreCtx["updateIntegration"] = useCallback((id, patch) => {
    setDb((d) => ({ ...d, integrations: d.integrations.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  }, []);
  const removeIntegration: StoreCtx["removeIntegration"] = useCallback((id) => {
    setDb((d) => ({ ...d, integrations: d.integrations.filter((i) => i.id !== id) }));
  }, []);

  const loadDemo: StoreCtx["loadDemo"] = useCallback(() => {
    setDb(makeDemoDB());
  }, []);
  const resetAll: StoreCtx["resetAll"] = useCallback(() => setDb(empty), []);

  const value: StoreCtx = {
    db,
    ready,
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
