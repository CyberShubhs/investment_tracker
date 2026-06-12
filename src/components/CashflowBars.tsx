"use client";

import {
  Bar,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AUD } from "@/lib/format";

export interface MonthPoint {
  month: string; // YYYY-MM
  income: number;
  expense: number;
  net: number;
}

export function CashflowBars({ data }: { data: MonthPoint[] }) {
  if (data.every((d) => d.income === 0 && d.expense === 0)) {
    return <div className="text-xs text-muted text-center py-10">No cash flow entries yet</div>;
  }
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="month"
            tickFormatter={(v) => new Date(`${v}-01T00:00:00`).toLocaleDateString("en-AU", { month: "short" })}
            tick={{ fill: "#7a869a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => `${Math.round(v / 1000)}k`}
            tick={{ fill: "#7a869a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={{ background: "#0e1218", border: "1px solid #1c2433", borderRadius: 12 }}
            labelStyle={{ color: "#7a869a" }}
            labelFormatter={(v) =>
              new Date(`${v}-01T00:00:00`).toLocaleDateString("en-AU", { month: "long", year: "numeric" })
            }
            formatter={(v: number, name: string) => [AUD.format(v), name === "income" ? "Income" : name === "expense" ? "Expenses" : "Net"]}
          />
          <Bar dataKey="income" fill="#7cf5c0" radius={[3, 3, 0, 0]} maxBarSize={18} />
          <Bar dataKey="expense" fill="#ff6b6b" radius={[3, 3, 0, 0]} maxBarSize={18} />
          <Line type="monotone" dataKey="net" stroke="#5aa9ff" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
