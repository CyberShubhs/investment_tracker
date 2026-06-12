"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { StatCard, SectionCard, EmptyState } from "@/components/Card";
import { AllocationPie } from "@/components/Charts";
import { CashflowBars, type MonthPoint } from "@/components/CashflowBars";
import { money, shortDate } from "@/lib/format";
import { downloadCSV, toCSV } from "@/lib/csv";
import type { CashflowDirection, CashflowEntry, Frequency, RecurringRule } from "@/lib/types";

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

const NEW_CATEGORY = "__new__";

function thisMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("en-AU", { month: "long", year: "numeric" });
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface EntryForm {
  id?: string;
  date: string;
  direction: CashflowDirection;
  amount: string;
  category_id: string;
  new_category: string;
  notes: string;
}

const emptyEntry = (): EntryForm => ({
  date: today(),
  direction: "expense",
  amount: "",
  category_id: "",
  new_category: "",
  notes: "",
});

interface RuleForm {
  name: string;
  direction: CashflowDirection;
  amount: string;
  category_id: string;
  frequency: Frequency;
  start_date: string;
  end_date: string;
}

const emptyRule = (): RuleForm => ({
  name: "",
  direction: "income",
  amount: "",
  category_id: "",
  frequency: "monthly",
  start_date: today(),
  end_date: "",
});

export default function CashflowPage() {
  const {
    db,
    ready,
    addCashflowEntry,
    updateCashflowEntry,
    removeCashflowEntry,
    addCategory,
    addRecurringRule,
    updateRecurringRule,
    removeRecurringRule,
  } = useStore();

  const [month, setMonth] = useState(thisMonth);
  const [form, setForm] = useState<EntryForm>(emptyEntry);
  const [formOpen, setFormOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState<RuleForm>(emptyRule);
  const [ruleOpen, setRuleOpen] = useState(false);

  const catName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of db.cashflow_categories) map.set(c.id, c.name);
    return map;
  }, [db.cashflow_categories]);

  const monthEntries = useMemo(
    () =>
      db.cashflow_entries
        .filter((e) => e.date.slice(0, 7) === month)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [db.cashflow_entries, month]
  );

  const income = monthEntries.filter((e) => e.direction === "income").reduce((s, e) => s + e.amount, 0);
  const expenses = monthEntries.filter((e) => e.direction === "expense").reduce((s, e) => s + e.amount, 0);
  const net = income - expenses;
  const savingsRate = income > 0 ? (net / income) * 100 : null;

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of monthEntries) {
      if (e.direction !== "expense") continue;
      const name = (e.category_id && catName.get(e.category_id)) || "Uncategorised";
      map.set(name, (map.get(name) ?? 0) + e.amount);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [monthEntries, catName]);

  const trend: MonthPoint[] = useMemo(() => {
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) months.push(shiftMonth(thisMonth(), -i));
    const byMonth = new Map<string, { income: number; expense: number }>(
      months.map((m) => [m, { income: 0, expense: 0 }])
    );
    for (const e of db.cashflow_entries) {
      const bucket = byMonth.get(e.date.slice(0, 7));
      if (!bucket) continue;
      bucket[e.direction] += e.amount;
    }
    return months.map((m) => {
      const b = byMonth.get(m)!;
      return { month: m, income: b.income, expense: b.expense, net: b.income - b.expense };
    });
  }, [db.cashflow_entries]);

  const categoriesFor = (direction: CashflowDirection) =>
    db.cashflow_categories.filter((c) => c.direction === direction);

  const startEdit = (e: CashflowEntry) => {
    setForm({
      id: e.id,
      date: e.date.slice(0, 10),
      direction: e.direction,
      amount: String(e.amount),
      category_id: e.category_id ?? "",
      new_category: "",
      notes: e.notes ?? "",
    });
    setFormOpen(true);
  };

  const submitEntry = (ev: React.FormEvent) => {
    ev.preventDefault();
    const amount = Number(form.amount);
    if (!amount || amount <= 0) return;
    let categoryId: string | null = form.category_id || null;
    if (form.category_id === NEW_CATEGORY) {
      const name = form.new_category.trim();
      if (!name) return;
      categoryId = addCategory(name, form.direction).id;
    }
    const payload = {
      date: form.date,
      direction: form.direction,
      amount,
      category_id: categoryId,
      notes: form.notes.trim() || undefined,
    };
    if (form.id) updateCashflowEntry(form.id, payload);
    else addCashflowEntry(payload);
    setForm(emptyEntry());
    setFormOpen(false);
  };

  const submitRule = (ev: React.FormEvent) => {
    ev.preventDefault();
    const amount = Number(ruleForm.amount);
    if (!ruleForm.name.trim() || !amount || amount <= 0) return;
    addRecurringRule({
      name: ruleForm.name.trim(),
      direction: ruleForm.direction,
      amount,
      category_id: ruleForm.category_id || null,
      frequency: ruleForm.frequency,
      start_date: ruleForm.start_date,
      end_date: ruleForm.end_date || null,
      active: true,
    });
    setRuleForm(emptyRule());
    setRuleOpen(false);
  };

  const exportCSV = () => {
    const csv = toCSV(
      [...db.cashflow_entries]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((e) => ({
          date: e.date.slice(0, 10),
          direction: e.direction,
          amount: e.amount,
          category: (e.category_id && catName.get(e.category_id)) || "",
          notes: e.notes ?? "",
          recurring: e.recurring_rule_id ? "yes" : "",
        }))
    );
    downloadCSV("cashflow.csv", csv);
  };

  if (!ready) return <div className="text-muted text-sm">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button className="btn-ghost text-xs" onClick={() => setMonth((m) => shiftMonth(m, -1))}>← Prev</button>
        <div className="text-sm font-semibold">{monthLabel(month)}</div>
        <button
          className="btn-ghost text-xs"
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          disabled={month >= thisMonth()}
        >
          Next →
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Income" value={money(income)} tone="good" />
        <StatCard label="Expenses" value={money(expenses)} tone={expenses > 0 ? "bad" : "default"} />
        <StatCard label="Net savings" value={money(net)} tone={net >= 0 ? "good" : "bad"} />
        <StatCard
          label="Savings rate"
          value={savingsRate === null ? "—" : `${savingsRate.toFixed(0)}%`}
          sub={savingsRate === null ? "No income this month" : undefined}
          tone={savingsRate === null ? "default" : savingsRate >= 0 ? "good" : "bad"}
        />
      </div>

      <SectionCard
        title="Entries"
        action={
          <div className="flex gap-2">
            <button className="btn-ghost text-xs" onClick={exportCSV} disabled={db.cashflow_entries.length === 0}>
              Export CSV
            </button>
            <button
              className="btn-primary text-xs"
              onClick={() => {
                setForm(emptyEntry());
                setFormOpen((v) => !v);
              }}
            >
              {formOpen ? "Close" : "+ Add entry"}
            </button>
          </div>
        }
      >
        {formOpen && (
          <form onSubmit={submitEntry} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div>
              <label className="label">Type</label>
              <select
                className="select"
                value={form.direction}
                onChange={(e) => setForm({ ...form, direction: e.target.value as CashflowDirection, category_id: "" })}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
            <div>
              <label className="label">Amount (AUD)</label>
              <input className="input" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="select" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">Uncategorised</option>
                {categoriesFor(form.direction).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value={NEW_CATEGORY}>+ New category…</option>
              </select>
            </div>
            {form.category_id === NEW_CATEGORY && (
              <div className="sm:col-span-2">
                <label className="label">New category name</label>
                <input className="input" value={form.new_category} onChange={(e) => setForm({ ...form, new_category: e.target.value })} required />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => { setFormOpen(false); setForm(emptyEntry()); }}>Cancel</button>
              <button type="submit" className="btn-primary">{form.id ? "Save" : "Add entry"}</button>
            </div>
          </form>
        )}

        {monthEntries.length === 0 ? (
          <EmptyState title="No entries this month" hint="Log income and expenses, or set up recurring rules below for salary, rent and bills." />
        ) : (
          <ul className="divide-y divide-bg-ring">
            {monthEntries.map((e) => (
              <li key={e.id} className="py-2.5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {(e.category_id && catName.get(e.category_id)) || (e.notes || "Uncategorised")}
                    </span>
                    {e.recurring_rule_id && <span className="pill text-[10px]">recurring</span>}
                  </div>
                  <div className="text-xs text-muted">
                    {shortDate(e.date)}
                    {e.notes && e.category_id ? ` · ${e.notes}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-semibold ${e.direction === "income" ? "text-accent" : "text-danger"}`}>
                    {e.direction === "income" ? "+" : "−"}{money(e.amount)}
                  </div>
                  <div className="flex gap-1 justify-end mt-0.5">
                    <button className="text-xs text-muted hover:text-white" onClick={() => startEdit(e)}>Edit</button>
                    <button className="text-xs text-danger hover:underline" onClick={() => removeCashflowEntry(e.id)}>Delete</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title={`Spending by category — ${monthLabel(month)}`}>
          <AllocationPie data={byCategory} />
        </SectionCard>
        <SectionCard title="12-month trend">
          <CashflowBars data={trend} />
        </SectionCard>
      </div>

      <SectionCard
        title="Recurring rules"
        action={
          <button
            className="btn-primary text-xs"
            onClick={() => {
              setRuleForm(emptyRule());
              setRuleOpen((v) => !v);
            }}
          >
            {ruleOpen ? "Close" : "+ Add rule"}
          </button>
        }
      >
        <p className="text-xs text-muted mb-3">
          Rules auto-create entries when the app loads — e.g. monthly salary, weekly rent. Toggling a rule off stops
          future entries; existing ones stay.
        </p>

        {ruleOpen && (
          <form onSubmit={submitRule} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="label">Name</label>
              <input className="input" value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} placeholder="Salary, Rent…" required />
            </div>
            <div>
              <label className="label">Type</label>
              <select
                className="select"
                value={ruleForm.direction}
                onChange={(e) => setRuleForm({ ...ruleForm, direction: e.target.value as CashflowDirection, category_id: "" })}
              >
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div>
              <label className="label">Amount (AUD)</label>
              <input className="input" inputMode="decimal" value={ruleForm.amount} onChange={(e) => setRuleForm({ ...ruleForm, amount: e.target.value })} required />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="select" value={ruleForm.category_id} onChange={(e) => setRuleForm({ ...ruleForm, category_id: e.target.value })}>
                <option value="">Uncategorised</option>
                {categoriesFor(ruleForm.direction).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Frequency</label>
              <select className="select" value={ruleForm.frequency} onChange={(e) => setRuleForm({ ...ruleForm, frequency: e.target.value as Frequency })}>
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">First occurrence</label>
              <input className="input" type="date" value={ruleForm.start_date} onChange={(e) => setRuleForm({ ...ruleForm, start_date: e.target.value })} required />
            </div>
            <div>
              <label className="label">End date (optional)</label>
              <input className="input" type="date" value={ruleForm.end_date} onChange={(e) => setRuleForm({ ...ruleForm, end_date: e.target.value })} />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => { setRuleOpen(false); setRuleForm(emptyRule()); }}>Cancel</button>
              <button type="submit" className="btn-primary">Add rule</button>
            </div>
          </form>
        )}

        {db.recurring_rules.length === 0 ? (
          <EmptyState title="No recurring rules" hint="Add your salary and regular bills so they're tracked automatically." />
        ) : (
          <ul className="divide-y divide-bg-ring">
            {db.recurring_rules.map((r: RecurringRule) => (
              <li key={r.id} className="py-2.5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{r.name}</span>
                    <span className="pill text-[10px] capitalize">{r.frequency}</span>
                    {!r.active && <span className="pill text-[10px] text-danger">paused</span>}
                  </div>
                  <div className="text-xs text-muted">
                    {(r.category_id && catName.get(r.category_id)) || "Uncategorised"} · from {shortDate(r.start_date)}
                    {r.end_date ? ` to ${shortDate(r.end_date)}` : ""}
                  </div>
                </div>
                <div className={`text-sm font-semibold ${r.direction === "income" ? "text-accent" : "text-danger"}`}>
                  {r.direction === "income" ? "+" : "−"}{money(r.amount)}
                </div>
                <div className="flex gap-1">
                  <button
                    className="text-xs text-muted hover:text-white"
                    onClick={() => updateRecurringRule(r.id, { active: !r.active })}
                  >
                    {r.active ? "Pause" : "Resume"}
                  </button>
                  <button className="text-xs text-danger hover:underline" onClick={() => removeRecurringRule(r.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
