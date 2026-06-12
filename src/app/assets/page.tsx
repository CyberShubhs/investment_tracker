"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { SectionCard, EmptyState } from "@/components/Card";
import { money, shortDate } from "@/lib/format";
import { downloadCSV, toCSV } from "@/lib/csv";
import { depreciatedValue } from "@/lib/depreciation";
import { refreshPrices, isStale, type RefreshSummary } from "@/lib/refresh-prices";
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
  { value: "metal", label: "Gold / Metals" },
  { value: "equipment", label: "Electronics / Equipment" },
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
  weight_grams: string;
  purity: string;
  purchase_price: string;
  purchase_date: string;
  depreciation_years: string;
  salvage_value: string;
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
  weight_grams: "",
  purity: "",
  purchase_price: "",
  purchase_date: "",
  depreciation_years: "",
  salvage_value: "",
};

export default function AssetsPage() {
  const { db, addAsset, updateAsset, removeAsset } = useStore();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<RefreshSummary | null>(null);

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
      weight_grams: a.weight_grams?.toString() ?? "",
      purity: a.purity?.toString() ?? "",
      purchase_price: a.purchase_price?.toString() ?? "",
      purchase_date: a.purchase_date?.slice(0, 10) ?? "",
      depreciation_years: a.depreciation_years?.toString() ?? "",
      salvage_value: a.salvage_value?.toString() ?? "",
    });
    setOpen(true);
  };

  const computedDepreciation =
    form.type === "equipment" && form.purchase_price && form.purchase_date && form.depreciation_years
      ? depreciatedValue(
          Number(form.purchase_price),
          form.purchase_date,
          Number(form.depreciation_years),
          form.salvage_value ? Number(form.salvage_value) : 0
        )
      : null;

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
      weight_grams: form.type === "metal" && form.weight_grams ? Number(form.weight_grams) : undefined,
      purity: form.type === "metal" && form.purity ? Number(form.purity) : undefined,
      purchase_price: form.type === "equipment" && form.purchase_price ? Number(form.purchase_price) : undefined,
      purchase_date: form.type === "equipment" && form.purchase_date ? form.purchase_date : undefined,
      depreciation_years:
        form.type === "equipment" && form.depreciation_years ? Number(form.depreciation_years) : undefined,
      salvage_value: form.type === "equipment" && form.salvage_value ? Number(form.salvage_value) : undefined,
    };
    if (!payload.name) return;
    if (form.id) updateAsset(form.id, payload);
    else addAsset(payload);
    setForm(emptyForm);
    setOpen(false);
  };

  const doRefresh = async () => {
    setRefreshing(true);
    setRefreshResult(null);
    try {
      setRefreshResult(await refreshPrices(db.assets, updateAsset));
    } finally {
      setRefreshing(false);
    }
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
        weight_grams: a.weight_grams ?? "",
        purchase_price: a.purchase_price ?? "",
        purchase_date: a.purchase_date ?? "",
        notes: a.notes ?? "",
        updated_at: a.updated_at,
      }))
    );
    downloadCSV("assets.csv", csv);
  };

  const anyPriceable = db.assets.some((a) => isStale(a) || a.last_priced_at);

  return (
    <div className="space-y-4">
      <SectionCard
        title={`Assets · ${money(totalA)}`}
        action={
          <div className="flex gap-2">
            <button className="btn-ghost text-xs" onClick={doRefresh} disabled={refreshing || db.assets.length === 0}>
              {refreshing ? "Refreshing…" : "Refresh prices"}
            </button>
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
        {refreshResult && (
          <div className="text-xs mb-3">
            <span className="text-accent">{refreshResult.updated} price{refreshResult.updated === 1 ? "" : "s"} updated.</span>
            {refreshResult.failed.length > 0 && (
              <span className="text-danger ml-2">
                Failed: {refreshResult.failed.map((f) => `${f.symbol} (${f.reason})`).join(", ")}
              </span>
            )}
          </div>
        )}

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

            {(form.type === "crypto" || form.type === "stock" || form.type === "etf") && (
              <>
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
              </>
            )}

            {form.type === "metal" && (
              <>
                <div>
                  <label className="label">Weight (grams)</label>
                  <input className="input" inputMode="decimal" value={form.weight_grams} onChange={(e) => setForm({ ...form, weight_grams: e.target.value })} placeholder="e.g. 31.1 for 1oz" />
                </div>
                <div>
                  <label className="label">Purity (0–1)</label>
                  <input className="input" inputMode="decimal" value={form.purity} onChange={(e) => setForm({ ...form, purity: e.target.value })} placeholder="0.9999" />
                </div>
                <div>
                  <label className="label">Average cost (total)</label>
                  <input className="input" inputMode="decimal" value={form.avg_cost} onChange={(e) => setForm({ ...form, avg_cost: e.target.value })} />
                </div>
              </>
            )}

            {form.type === "equipment" && (
              <>
                <div>
                  <label className="label">Purchase price</label>
                  <input className="input" inputMode="decimal" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} />
                </div>
                <div>
                  <label className="label">Purchase date</label>
                  <input className="input" type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
                </div>
                <div>
                  <label className="label">Useful life (years)</label>
                  <input className="input" inputMode="decimal" value={form.depreciation_years} onChange={(e) => setForm({ ...form, depreciation_years: e.target.value })} placeholder="e.g. 4" />
                </div>
                <div>
                  <label className="label">Salvage value</label>
                  <input className="input" inputMode="decimal" value={form.salvage_value} onChange={(e) => setForm({ ...form, salvage_value: e.target.value })} placeholder="0" />
                </div>
                {computedDepreciation !== null && (
                  <div className="sm:col-span-2 flex items-center gap-3 text-xs bg-accent/5 border border-accent/20 rounded-lg px-3 py-2">
                    <span className="text-muted">Estimated current value (straight-line):</span>
                    <span className="text-accent font-semibold">{money(computedDepreciation)}</span>
                    <button
                      type="button"
                      className="btn-ghost text-xs ml-auto"
                      onClick={() => setForm((f) => ({ ...f, current_value: String(computedDepreciation) }))}
                    >
                      Use this value
                    </button>
                  </div>
                )}
              </>
            )}

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
          <EmptyState title="No assets yet" hint="Cash, crypto, stocks, ETFs, property, gold, computers — add anything you own." />
        ) : (
          <ul className="divide-y divide-bg-ring">
            {db.assets.map((a) => (
              <li key={a.id} className="py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{a.name}</span>
                    <span className="pill capitalize">{a.type}</span>
                    {a.symbol && <span className="text-xs text-muted">{a.symbol}</span>}
                    {isStale(a) && (
                      <span
                        className="h-2 w-2 rounded-full bg-amber-400 shrink-0"
                        title={a.last_priced_at ? `Price from ${shortDate(a.last_priced_at)}` : "Never priced — hit Refresh prices"}
                      />
                    )}
                  </div>
                  <div className="text-xs text-muted truncate">
                    {a.provider || "—"}
                    {a.quantity ? ` · ${a.quantity} units` : ""}
                    {a.weight_grams ? ` · ${a.weight_grams} g` : ""}
                    {a.avg_cost ? ` · avg ${money(a.avg_cost, true)}` : ""}
                    {a.last_priced_at ? ` · priced ${shortDate(a.last_priced_at)}` : ""}
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
        {anyPriceable && (
          <p className="text-[11px] text-muted mt-3">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400 mr-1 align-middle" />
            = live price missing or older than 24h. Gold uses PAXG as a spot proxy (±1%).
          </p>
        )}
      </SectionCard>
    </div>
  );
}
