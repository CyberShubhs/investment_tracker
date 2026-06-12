import type { CashflowEntry, Frequency, RecurringRule } from "./types";
import { uid } from "./uid";

/** Parse YYYY-MM-DD as a local date (avoids UTC off-by-one). */
export function parseYMD(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toYMD(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** n-th occurrence of a rule starting at `start`. Month-based frequencies keep
 *  the anchor day-of-month, clamped to the target month's length (31st -> 30th/28th). */
function occurrence(start: Date, frequency: Frequency, n: number): Date {
  if (frequency === "weekly" || frequency === "fortnightly") {
    const days = (frequency === "weekly" ? 7 : 14) * n;
    const d = new Date(start);
    d.setDate(d.getDate() + days);
    return d;
  }
  const monthsPer = frequency === "monthly" ? 1 : frequency === "quarterly" ? 3 : 12;
  const total = start.getMonth() + monthsPer * n;
  const year = start.getFullYear() + Math.floor(total / 12);
  const month = total % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(start.getDate(), lastDay));
}

/** All due dates (YYYY-MM-DD) for a rule up to `asOf` (inclusive), respecting end_date. */
export function dueDates(rule: RecurringRule, asOf: Date = new Date()): string[] {
  const start = parseYMD(rule.start_date);
  const end = rule.end_date ? parseYMD(rule.end_date) : null;
  const limit = end && end < asOf ? end : asOf;
  const out: string[] = [];
  for (let n = 0; ; n++) {
    const d = occurrence(start, rule.frequency, n);
    if (d > limit) break;
    out.push(toYMD(d));
    if (n > 2000) break; // safety: ~38 years of weekly entries
  }
  return out;
}

/** Entries that should exist for active rules but don't yet. Pure — caller persists. */
export function materializeRules(
  rules: RecurringRule[],
  entries: CashflowEntry[],
  asOf: Date = new Date()
): CashflowEntry[] {
  const existing = new Set(
    entries
      .filter((e) => e.recurring_rule_id)
      .map((e) => `${e.recurring_rule_id}:${e.date.slice(0, 10)}`)
  );
  const created: CashflowEntry[] = [];
  const now = new Date().toISOString();
  for (const rule of rules) {
    if (!rule.active) continue;
    for (const date of dueDates(rule, asOf)) {
      if (existing.has(`${rule.id}:${date}`)) continue;
      created.push({
        id: uid("e"),
        date,
        direction: rule.direction,
        amount: rule.amount,
        category_id: rule.category_id ?? null,
        notes: rule.name,
        recurring_rule_id: rule.id,
        created_at: now,
      });
    }
  }
  return created;
}
