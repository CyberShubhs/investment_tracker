export type AssetType =
  | "cash"
  | "crypto"
  | "stock"
  | "etf"
  | "property"
  | "vehicle"
  | "super"
  | "jewellery"
  | "business"
  | "other";

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

export interface DB {
  assets: Asset[];
  liabilities: Liability[];
  transactions: Transaction[];
  snapshots: Snapshot[];
  integrations: Integration[];
}
