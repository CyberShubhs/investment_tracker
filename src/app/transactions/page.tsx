"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { SectionCard, EmptyState } from "@/components/Card";
import { money, shortDate } from "@/lib/format";
import { downloadCSV, toCSV } from "@/lib/csv";
import type { TxKind } from "@/lib/types";

const KINDS: { value: TxKind; label: string }[] = [
  { value: "buy", label: "Buy" },
  { value: "sell", label: "Sell" },
  { value: "deposit", label: "Deposit" },
  { value: "withdrawal", label: "Withdrawal" },
  { value: "dividend", label: "Dividend" },
  { value: "repayment", label: "Repayment" },
  { value: "fee", label: "Fee" },
  { value: "valuation", label: "Valuation update" },
];

interface FormState {
  date: string;
  kind: TxKind;
  asset_id: string;
  liability_id: string;
  amount: string;
  quantity: string;
  price: string;
  notes: string;
}

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): FormState => ({
  date: today(),
  kind: "buy",
  asset_id: "",
  liability_id: "",
  amount: "",
  quantity: "",
  price: "",
  notes: "",
});

export default function TransactionsPage() {
  const { db, addTransaction, removeTransaction, updateAsset, updateLiability } = useStore();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [open, setOpen] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount || 0);
    addTransaction({
      date: form.date,
      kind: form.kind,
      asset_id: form.asset_id || null,
      liability_id: form.liability_id || null,
      amount,
      quantity: form.quantity ? Number(form.quantity) : undefined,
      price: form.price ? Number(form.price) : undefined,
      notes: form.notes.trim() || undefined,
    });

    // Light-weight side effects on balances.
    if (form.kind === "valuation" && form.asset_id && amount > 0) {
      updateAsset(form.asset_id, { current_value: amount });
    } else if (form.kind === "repayment" && form.liability_id && amount > 0) {
      const l = db.liabilities.find((x) => x.id === form.liability_id);
      if (l) updateLiability(l.id, { balance: Math.max(0, l.balance - amount) });
    }

    setForm(emptyForm());
    setOpen(false);
  };

  const exportCSV = () => {
    const csv = toCSV(
      db.transactions.map((t) => ({
        date: t.date,
        kind: t.kind,
        asset: db.assets.find((a) => a.id === t.asset_id)?.name ?? "",
        liability: db.liabilities.find((l) => l.id === t.liability_id)?.name ?? "",
        amount: t.amount,
        quantity: t.quantity ?? "",
        price: t.price ?? "",
        notes: t.notes ?? "",
      }))
    );
    downloadCSV("transactions.csv", csv);
  };

  return (
    <SectionCard
      title="Transactions"
      action={
        <div className="flex gap-2">
          <button className="btn-ghost text-xs" onClick={exportCSV} disabled={db.transactions.length === 0}>
            Export CSV
          </button>
          <button className="btn-primary text-xs" onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : "+ Add transaction"}
          </button>
        </div>
      }
    >
      {open && (
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </div>
          <div>
            <label className="label">Kind</label>
            <select className="select" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as TxKind })}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Asset</label>
            <select className="select" value={form.asset_id} onChange={(e) => setForm({ ...form, asset_id: e.target.value })}>
              <option value="">—</option>
              {db.assets.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Liability</label>
            <select className="select" value={form.liability_id} onChange={(e) => setForm({ ...form, liability_id: e.target.value })}>
              <option value="">—</option>
              {db.liabilities.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Amount</label>
            <input className="input" inputMode="decimal" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div>
            <label className="label">Quantity</label>
            <input className="input" inputMode="decimal" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div>
            <label className="label">Price</label>
            <input className="input" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Add transaction</button>
          </div>
        </form>
      )}

      {db.transactions.length === 0 ? (
        <EmptyState
          title="No transactions yet"
          hint="Log buys, sells, deposits, dividends, repayments, fees or valuation updates."
        />
      ) : (
        <ul className="divide-y divide-bg-ring">
          {db.transactions.map((t) => {
            const asset = db.assets.find((a) => a.id === t.asset_id);
            const liab = db.liabilities.find((l) => l.id === t.liability_id);
            return (
              <li key={t.id} className="py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="pill capitalize">{t.kind}</span>
                    <span className="text-sm font-medium truncate">{asset?.name ?? liab?.name ?? "—"}</span>
                  </div>
                  <div className="text-xs text-muted truncate">
                    {shortDate(t.date)}
                    {t.quantity ? ` · ${t.quantity}` : ""}
                    {t.price ? ` @ ${money(t.price, true)}` : ""}
                    {t.notes ? ` · ${t.notes}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-sm font-semibold">{money(t.amount)}</div>
                  <button className="text-xs text-danger hover:underline" onClick={() => removeTransaction(t.id)}>Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
