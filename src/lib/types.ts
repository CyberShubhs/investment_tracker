export type AssetType =
  | "cash"
  | "crypto"
  | "stock"
  | "etf"
  | "property"
  | "vehicle"
  | "super"
  | "jewellery"
  | "metal"
  | "equipment"
  | "business"
  | "other";

export type PriceSource = "manual" | "coinspot" | "yahoo" | "coingecko" | "paxg";

export type LiabilityType =
  | "mortgage"
  | "car_loan"
  | "credit_card"
  | "personal_loan"
  | "bnpl"
  | "hecs"
  | "family"
  | "other";

export type TxKind =
  | "buy"
  | "sell"
  | "deposit"
  | "withdrawal"
  | "dividend"
  | "repayment"
  | "fee"
  | "valuation";

export type Frequency = "weekly" | "fortnightly" | "monthly" | "quarterly" | "yearly";

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  provider?: string;
  symbol?: string;
  quantity?: number;
  avg_cost?: number;
  current_value: number;
  currency: string;
  notes?: string;
  /** Metal assets: weight in grams and purity (e.g. 0.9999). */
  weight_grams?: number;
  purity?: number;
  /** Equipment assets: straight-line depreciation inputs. */
  purchase_price?: number;
  purchase_date?: string;
  depreciation_years?: number;
  salvage_value?: number;
  /** Live pricing metadata. */
  price_source?: PriceSource;
  last_priced_at?: string;
  /** Idempotency key for synced holdings, e.g. "coinspot:BTC". */
  external_key?: string;
  created_at: string;
  updated_at: string;
}

export interface Liability {
  id: string;
  name: string;
  type: LiabilityType;
  balance: number;
  interest_rate?: number;
  repayment_amount?: number;
  frequency?: Frequency;
  linked_asset_id?: string | null;
  notes?: string;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  date: string;
  kind: TxKind;
  asset_id?: string | null;
  liability_id?: string | null;
  amount: number;
  quantity?: number;
  price?: number;
  notes?: string;
  created_at: string;
}

export interface Snapshot {
  id: string;
  date: string;
  total_assets: number;
  total_liabilities: number;
  net_worth: number;
  note?: string;
}

export interface Integration {
  id: string;
  provider: string;
  status: "planned" | "configured" | "active" | "disabled";
  notes?: string;
  created_at: string;
}

export type CashflowDirection = "income" | "expense";

export interface CashflowCategory {
  id: string;
  name: string;
  direction: CashflowDirection;
  created_at: string;
}

export interface CashflowEntry {
  id: string;
  date: string;
  direction: CashflowDirection;
  amount: number;
  category_id?: string | null;
  notes?: string;
  recurring_rule_id?: string | null;
  created_at: string;
}

export interface RecurringRule {
  id: string;
  name: string;
  direction: CashflowDirection;
  amount: number;
  category_id?: string | null;
  frequency: Frequency;
  start_date: string;
  end_date?: string | null;
  active: boolean;
  created_at: string;
}

export interface DB {
  assets: Asset[];
  liabilities: Liability[];
  transactions: Transaction[];
  snapshots: Snapshot[];
  integrations: Integration[];
  cashflow_categories: CashflowCategory[];
  cashflow_entries: CashflowEntry[];
  recurring_rules: RecurringRule[];
}
