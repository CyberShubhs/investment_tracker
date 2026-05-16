import type { DB } from "./types";
import { uid } from "./uid";

export function makeDemoDB(): DB {
  const now = new Date();
  const iso = (offsetDays = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString();
  };

  const assets = [
    { id: uid("a"), name: "Everyday Savings", type: "cash" as const, provider: "ING", current_value: 18500, currency: "AUD", created_at: iso(-300), updated_at: iso(-1) },
    { id: uid("a"), name: "Bitcoin", type: "crypto" as const, provider: "CoinSpot", symbol: "BTC", quantity: 0.45, avg_cost: 38000, current_value: 41250, currency: "AUD", created_at: iso(-280), updated_at: iso(-1) },
    { id: uid("a"), name: "VAS ETF", type: "etf" as const, provider: "CommSec", symbol: "VAS", quantity: 120, avg_cost: 88.4, current_value: 11820, currency: "AUD", created_at: iso(-250), updated_at: iso(-1) },
    { id: uid("a"), name: "Apartment - Brunswick", type: "property" as const, current_value: 685000, currency: "AUD", created_at: iso(-700), updated_at: iso(-20) },
    { id: uid("a"), name: "Toyota Corolla", type: "vehicle" as const, current_value: 19500, currency: "AUD", created_at: iso(-400), updated_at: iso(-30) },
    { id: uid("a"), name: "Australian Super", type: "super" as const, provider: "AustralianSuper", current_value: 64200, currency: "AUD", created_at: iso(-900), updated_at: iso(-5) },
  ];

  const liabilities = [
    { id: uid("l"), name: "Mortgage - Brunswick", type: "mortgage" as const, balance: 412000, interest_rate: 6.14, repayment_amount: 2800, frequency: "monthly" as const, linked_asset_id: assets[3].id, currency: "AUD", created_at: iso(-700), updated_at: iso(-2) },
    { id: uid("l"), name: "Car Loan", type: "car_loan" as const, balance: 11200, interest_rate: 8.5, repayment_amount: 480, frequency: "monthly" as const, linked_asset_id: assets[4].id, currency: "AUD", created_at: iso(-400), updated_at: iso(-2) },
    { id: uid("l"), name: "Credit Card", type: "credit_card" as const, balance: 1450, interest_rate: 19.99, repayment_amount: 250, frequency: "monthly" as const, currency: "AUD", created_at: iso(-200), updated_at: iso(-1) },
    { id: uid("l"), name: "HECS-HELP", type: "hecs" as const, balance: 18700, interest_rate: 3.2, currency: "AUD", created_at: iso(-1500), updated_at: iso(-90) },
  ];

  const totalA = assets.reduce((s, a) => s + a.current_value, 0);
  const totalL = liabilities.reduce((s, l) => s + l.balance, 0);

  const snapshots = Array.from({ length: 6 }).map((_, i) => {
    const monthsAgo = 5 - i;
    const drift = (Math.sin(i * 1.2) * 8000) + i * 4500;
    const a = totalA - 27000 + i * 4800 + drift;
    const l = totalL + 4000 - i * 800;
    const d = new Date(now);
    d.setMonth(d.getMonth() - monthsAgo);
    return {
      id: uid("s"),
      date: d.toISOString(),
      total_assets: Math.round(a),
      total_liabilities: Math.round(l),
      net_worth: Math.round(a - l),
    };
  });

  const integrations = [
    { id: uid("i"), provider: "CoinSpot", status: "planned" as const, notes: "Read-only API key for balances", created_at: iso(-1) },
    { id: uid("i"), provider: "CommSec", status: "planned" as const, notes: "Manual CSV/statement import", created_at: iso(-1) },
    { id: uid("i"), provider: "Stock Price API", status: "planned" as const, notes: "Yahoo / ASX price feed", created_at: iso(-1) },
    { id: uid("i"), provider: "Open Banking", status: "planned" as const, notes: "Future bank account sync", created_at: iso(-1) },
  ];

  return { assets, liabilities, transactions: [], snapshots, integrations };
}
