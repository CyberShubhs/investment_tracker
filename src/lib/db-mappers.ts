import type {
  Asset,
  CashflowCategory,
  CashflowEntry,
  DB,
  Integration,
  Liability,
  RecurringRule,
  Snapshot,
  Transaction,
} from "./types";

/**
 * Supabase row <-> app type mapping.
 * Types are already snake_case; the work here is null/number normalization
 * and stripping/adding user_id, which never lives in app state.
 */

type Row = Record<string, unknown>;

function num(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return isFinite(n) ? n : undefined;
}

function str(v: unknown): string | undefined {
  return v === null || v === undefined ? undefined : String(v);
}

export function rowToAsset(r: Row): Asset {
  return {
    id: String(r.id),
    name: String(r.name),
    type: r.type as Asset["type"],
    provider: str(r.provider),
    symbol: str(r.symbol),
    quantity: num(r.quantity),
    avg_cost: num(r.avg_cost),
    current_value: num(r.current_value) ?? 0,
    currency: str(r.currency) ?? "AUD",
    notes: str(r.notes),
    weight_grams: num(r.weight_grams),
    purity: num(r.purity),
    purchase_price: num(r.purchase_price),
    purchase_date: str(r.purchase_date),
    depreciation_years: num(r.depreciation_years),
    salvage_value: num(r.salvage_value),
    price_source: str(r.price_source) as Asset["price_source"],
    last_priced_at: str(r.last_priced_at),
    external_key: str(r.external_key),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export function rowToLiability(r: Row): Liability {
  return {
    id: String(r.id),
    name: String(r.name),
    type: r.type as Liability["type"],
    balance: num(r.balance) ?? 0,
    interest_rate: num(r.interest_rate),
    repayment_amount: num(r.repayment_amount),
    frequency: str(r.frequency) as Liability["frequency"],
    linked_asset_id: r.linked_asset_id === undefined ? null : (r.linked_asset_id as string | null),
    currency: str(r.currency) ?? "AUD",
    notes: str(r.notes),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export function rowToTransaction(r: Row): Transaction {
  return {
    id: String(r.id),
    date: String(r.date),
    kind: r.kind as Transaction["kind"],
    asset_id: (r.asset_id as string | null) ?? null,
    liability_id: (r.liability_id as string | null) ?? null,
    amount: num(r.amount) ?? 0,
    quantity: num(r.quantity),
    price: num(r.price),
    notes: str(r.notes),
    created_at: String(r.created_at),
  };
}

export function rowToSnapshot(r: Row): Snapshot {
  return {
    id: String(r.id),
    date: String(r.date),
    total_assets: num(r.total_assets) ?? 0,
    total_liabilities: num(r.total_liabilities) ?? 0,
    net_worth: num(r.net_worth) ?? 0,
    note: str(r.note),
  };
}

export function rowToIntegration(r: Row): Integration {
  return {
    id: String(r.id),
    provider: String(r.provider),
    status: r.status as Integration["status"],
    notes: str(r.notes),
    created_at: String(r.created_at),
  };
}

export function rowToCategory(r: Row): CashflowCategory {
  return {
    id: String(r.id),
    name: String(r.name),
    direction: r.direction as CashflowCategory["direction"],
    created_at: String(r.created_at),
  };
}

export function rowToEntry(r: Row): CashflowEntry {
  return {
    id: String(r.id),
    date: String(r.date),
    direction: r.direction as CashflowEntry["direction"],
    amount: num(r.amount) ?? 0,
    category_id: (r.category_id as string | null) ?? null,
    notes: str(r.notes),
    recurring_rule_id: (r.recurring_rule_id as string | null) ?? null,
    created_at: String(r.created_at),
  };
}

export function rowToRule(r: Row): RecurringRule {
  return {
    id: String(r.id),
    name: String(r.name),
    direction: r.direction as RecurringRule["direction"],
    amount: num(r.amount) ?? 0,
    category_id: (r.category_id as string | null) ?? null,
    frequency: r.frequency as RecurringRule["frequency"],
    start_date: String(r.start_date),
    end_date: (r.end_date as string | null) ?? null,
    active: Boolean(r.active),
    created_at: String(r.created_at),
  };
}

/** undefined -> null so optional fields clear properly in Postgres. */
function nullable<T extends Row>(obj: T): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(obj)) out[k] = v === undefined ? null : v;
  return out;
}

export function assetToRow(a: Asset, userId: string): Row {
  return nullable({ ...a, user_id: userId });
}
export function liabilityToRow(l: Liability, userId: string): Row {
  return nullable({ ...l, user_id: userId });
}
export function transactionToRow(t: Transaction, userId: string): Row {
  return nullable({ ...t, user_id: userId });
}
export function snapshotToRow(s: Snapshot, userId: string): Row {
  return nullable({ ...s, user_id: userId });
}
export function integrationToRow(i: Integration, userId: string): Row {
  return nullable({ ...i, user_id: userId });
}
export function categoryToRow(c: CashflowCategory, userId: string): Row {
  return nullable({ ...c, user_id: userId });
}
export function entryToRow(e: CashflowEntry, userId: string): Row {
  return nullable({ ...e, user_id: userId });
}
export function ruleToRow(r: RecurringRule, userId: string): Row {
  return nullable({ ...r, user_id: userId });
}

export const TABLE: Record<keyof DB, string> = {
  assets: "assets",
  liabilities: "liabilities",
  transactions: "transactions",
  snapshots: "net_worth_snapshots",
  integrations: "integrations",
  cashflow_categories: "cashflow_categories",
  cashflow_entries: "cashflow_entries",
  recurring_rules: "recurring_rules",
};
