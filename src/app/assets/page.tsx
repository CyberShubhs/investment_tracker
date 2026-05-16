"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { SectionCard, EmptyState } from "@/components/Card";
import { money } from "@/lib/format";
import { downloadCSV, toCSV } from "@/lib/csv";
import type { Asset, AssetType } from "@/lib/types";

const TYPES: { value: AssetType; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "crypto", label: "Crypto" },
  { value: "stock", label: "Stock" },
  { value: "etf", label: "ETF" },
  { value: "property", label: "Property" },
  { value: "vehicle", label: "Vehicle" },
  { value: "super", label: "Super" },
  { value: "jewellery", label: "Jewellery" },
  { value: "business", label: "Business" },
  { value: "other", label: "Other" },
];

interface FormState {
  id?: string;
  name: string;
  type: AssetType;
  provider: string;
  symbol: string;
  quantity: string;
  avg_cost: string;
  current_value: string;
  currency: string;
  notes: string;
}

const emptyForm: FormState = {
  name: "",
  type: "cash",
  provider: "",
  symbol: "",
  quantity: "",
  avg_cost: "",
  current_value: "",
  currency: "AUD",
  notes: "",
};

export default function AssetsPage() {
  const { db, addAsset, updateAsset, removeAsset } = useStore();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [open, setOpen] = useState(false);

  const totalA = db.assets.reduce((s, a) => s + a.current_value, 0);

  const startEdit = (a: Asset) => {
    setForm({
      id: a.id,
      name: a.name,
      type: a.type,
      provider: a.provider ?? "",
      symbol: a.symbol ?? "",
      quantity: a.quantity?.toString() ?? "",
      avg_cost: a.avg_cost?.toString() ?? "",
      current_value: a.current_value.toString(),
      currency: a.currency,
      notes: a.notes ?? "",
    });
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      type: form.type,
      provider: form.provider.trim() || undefined,
      symbol: form.symbol.trim() || undefined,
      quantity: form.quantity ? Number(form.quantity) : undefined,
      avg_cost: form.avg_cost ? Number(form.avg_cost) : undefined,
      current_value: Number(form.current_value || 0),
      currency: form.currency.trim() || "AUD",
      notes: form.notes.trim() || undefined,
    };
    if (!payload.name) return;
    if (form.id) updateAsset(form.id, payload);
    else addAsset(payload);
    setForm(emptyForm);
    setOpen(false);
  };

  const exportCSV = () => {
    const csv = toCSV(
      db.assets.map((a) => ({
        name: a.name,
        type: a.type,
        provider: a.provider ?? "",
        symbol: a.symbol ?? "",
        quantity: a.quantity ?? "",
        avg_cost: a.avg_cost ?? "",
        current_value: a.current_value,
        currency: a.currency,
        notes: a.notes ?? "",
        updated_at: a.updated_at,
      }))
    );
    downloadCSV("assets.csv", csv);
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title={`Assets · ${money(totalA)}`}
        action={
          <div className="flex gap-2">
            <button className="btn-ghost text-xs" onClick={exportCSV} disabled={db.assets.length === 0}>
              Export CSV
            </button>
            <button
              className="btn-primary text-xs"
              onClick={() => {
                setForm(emptyForm);
                setOpen((v) => !v);
              }}
            >
              {open ? "Close" : "+ Add asset"}
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
              <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AssetType })}>
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Provider / Platform</label>
              <input className="input" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="ING, CoinSpot, CommSec…" />
            </div>
            <div>
              <label className="label">Symbol / Ticker</label>
              <input className="input" value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} placeholder="BTC, VAS…" />
            </div>
            <div>
              <label className="label">Quantity</label>
              <input className="input" inputMode="decimal" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div>
              <label className="label">Average cost</label>
              <input className="input" inputMode="decimal" value={form.avg_cost} onChange={(e) => setForm({ ...form, avg_cost: e.target.value })} />
            </div>
            <div>
              <label className="label">Current value (AUD)</label>
              <input className="input" inputMode="decimal" required value={form.current_value} onChange={(e) => setForm({ ...form, current_value: e.target.value })} />
            </div>
            <div>
              <label className="label">Currency</label>
              <input className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <textarea className="textarea" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => { setOpen(false); setForm(emptyForm); }}>Cancel</button>
              <button type="submit" className="btn-primary">{form.id ? "Save" : "Add asset"}</button>
            </div>
          </form>
        )}

        {db.assets.length === 0 ? (
          <EmptyState title="No assets yet" hint="Cash, crypto, stocks, ETFs, property, vehicles — add anything you own." />
        ) : (
          <ul className="divide-y divide-bg-ring">
            {db.assets.map((a) => (
              <li key={a.id} className="py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{a.name}</span>
                    <span className="pill capitalize">{a.type}</span>
                    {a.symbol && <span className="text-xs text-muted">{a.symbol}</span>}
                  </div>
                  <div className="text-xs text-muted truncate">
                    {a.provider || "—"}
                    {a.quantity ? ` · ${a.quantity} units` : ""}
                    {a.avg_cost ? ` · avg ${money(a.avg_cost, true)}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{money(a.current_value)}</div>
                  <div className="flex gap-1 justify-end mt-1">
                    <button className="text-xs text-muted hover:text-white" onClick={() => startEdit(a)}>Edit</button>
                    <button className="text-xs text-danger hover:underline" onClick={() => removeAsset(a.id)}>Delete</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
