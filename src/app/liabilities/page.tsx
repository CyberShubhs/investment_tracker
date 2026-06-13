"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { SectionCard, EmptyState } from "@/components/Card";
import { money } from "@/lib/format";
import { downloadCSV, toCSV } from "@/lib/csv";
import type { Frequency, Liability, LiabilityType } from "@/lib/types";

const TYPES: { value: LiabilityType; label: string }[] = [
  { value: "mortgage", label: "Mortgage" },
  { value: "car_loan", label: "Car Loan" },
  { value: "credit_card", label: "Credit Card" },
  { value: "personal_loan", label: "Personal Loan" },
  { value: "bnpl", label: "BNPL" },
  { value: "hecs", label: "HECS" },
  { value: "family", label: "Family / Friend" },
  { value: "other", label: "Other" },
];

const FREQS: Frequency[] = ["weekly", "fortnightly", "monthly", "quarterly", "yearly"];

interface FormState {
  id?: string;
  name: string;
  type: LiabilityType;
  balance: string;
  interest_rate: string;
  repayment_amount: string;
  frequency: Frequency | "";
  linked_asset_id: string;
  notes: string;
  currency: string;
}

const emptyForm: FormState = {
  name: "",
  type: "mortgage",
  balance: "",
  interest_rate: "",
  repayment_amount: "",
  frequency: "monthly",
  linked_asset_id: "",
  notes: "",
  currency: "AUD",
};

export default function LiabilitiesPage() {
  const { db, addLiability, updateLiability, removeLiability } = useStore();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [open, setOpen] = useState(false);

  const totalL = db.liabilities.reduce((s, l) => s + l.balance, 0);

  const startEdit = (l: Liability) => {
    setForm({
      id: l.id,
      name: l.name,
      type: l.type,
      balance: l.balance.toString(),
      interest_rate: l.interest_rate?.toString() ?? "",
      repayment_amount: l.repayment_amount?.toString() ?? "",
      frequency: l.frequency ?? "",
      linked_asset_id: l.linked_asset_id ?? "",
      notes: l.notes ?? "",
      currency: l.currency,
    });
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      type: form.type,
      balance: Number(form.balance || 0),
      interest_rate: form.interest_rate ? Number(form.interest_rate) : undefined,
      repayment_amount: form.repayment_amount ? Number(form.repayment_amount) : undefined,
      frequency: form.frequency || undefined,
      linked_asset_id: form.linked_asset_id || null,
      notes: form.notes.trim() || undefined,
      currency: form.currency.trim() || "AUD",
    };
    if (!payload.name) return;
    if (form.id) updateLiability(form.id, payload);
    else addLiability(payload);
    setForm(emptyForm);
    setOpen(false);
  };

  const exportCSV = () => {
    const csv = toCSV(
      db.liabilities.map((l) => ({
        name: l.name,
        type: l.type,
        balance: l.balance,
        interest_rate: l.interest_rate ?? "",
        repayment_amount: l.repayment_amount ?? "",
        frequency: l.frequency ?? "",
        linked_asset_id: l.linked_asset_id ?? "",
        currency: l.currency,
        notes: l.notes ?? "",
        updated_at: l.updated_at,
      }))
    );
    downloadCSV("liabilities.csv", csv);
  };

  return (
    <SectionCard
      title={`Liabilities · ${money(totalL)}`}
      action={
        <div className="flex gap-2">
          <button className="btn-ghost text-xs" onClick={exportCSV} disabled={db.liabilities.length === 0}>
            Export CSV
          </button>
          <button
            className="btn-primary text-xs"
            onClick={() => {
              setForm(emptyForm);
              setOpen((v) => !v);
            }}
          >
            {open ? "Close" : "+ Add liability"}
          </button>
        </div>
      }
    >
      {open && (
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="sm:col-span-2">
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as LiabilityType })}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Balance</label>
            <input className="input" inputMode="decimal" required value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} />
          </div>
          <div>
            <label className="label">Interest rate (%)</label>
            <input className="input" inputMode="decimal" value={form.interest_rate} onChange={(e) => setForm({ ...form, interest_rate: e.target.value })} />
          </div>
          <div>
            <label className="label">Repayment amount</label>
            <input className="input" inputMode="decimal" value={form.repayment_amount} onChange={(e) => setForm({ ...form, repayment_amount: e.target.value })} />
          </div>
          <div>
            <label className="label">Frequency</label>
            <select className="select" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as Frequency | "" })}>
              <option value="">—</option>
              {FREQS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Linked asset</label>
            <select className="select" value={form.linked_asset_id} onChange={(e) => setForm({ ...form, linked_asset_id: e.target.value })}>
              <option value="">—</option>
              {db.assets.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea className="textarea" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => { setOpen(false); setForm(emptyForm); }}>Cancel</button>
            <button type="submit" className="btn-primary">{form.id ? "Save" : "Add liability"}</button>
          </div>
        </form>
      )}

      {db.liabilities.length === 0 ? (
        <EmptyState title="No liabilities yet" hint="Add mortgages, car loans, credit cards or anything else you owe." />
      ) : (
        <ul className="divide-y divide-bg-ring">
          {db.liabilities.map((l) => (
            <li key={l.id} className="py-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{l.name}</span>
                  <span className="pill capitalize">{l.type.replace("_", " ")}</span>
                </div>
                <div className="text-xs text-muted truncate">
                  {l.interest_rate ? `${l.interest_rate}%` : "—"}
                  {l.repayment_amount ? ` · ${money(l.repayment_amount, true)} / ${l.frequency ?? ""}` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="num text-sm font-semibold text-danger">{money(l.balance)}</div>
                <div className="flex gap-1 justify-end mt-1">
                  <button className="text-xs text-muted hover:text-white" onClick={() => startEdit(l)}>Edit</button>
                  <button className="text-xs text-danger hover:underline" onClick={() => removeLiability(l.id)}>Delete</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
