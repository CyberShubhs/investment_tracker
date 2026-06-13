"use client";

import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AUD, money } from "@/lib/format";

const PALETTE = ["#7cf5c0", "#4dd6a4", "#5aa9ff", "#a98bff", "#f5b14d", "#ff6b6b", "#9ad1ff", "#c9ffa6"];

interface SlicePoint {
  name: string;
  value: number;
}

export function AllocationPie({ data }: { data: SlicePoint[] }) {
  const filtered = data.filter((d) => d.value > 0);
  if (filtered.length === 0) {
    return <div className="text-xs text-muted text-center py-10">No data yet</div>;
  }
  return (
    <div className="h-48 sm:h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={filtered}
            dataKey="value"
            nameKey="name"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            stroke="none"
          >
            {filtered.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "#0e1218", border: "1px solid #1c2433", borderRadius: 12 }}
            labelStyle={{ color: "#7a869a" }}
            formatter={(v: number) => AUD.format(v)}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-xs">
        {filtered
          .slice()
          .sort((a, b) => b.value - a.value)
          .map((d) => {
            const i = filtered.indexOf(d);
            return (
              <div key={d.name} className="flex items-center gap-2 truncate">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                <span className="text-muted truncate">{d.name}</span>
                <span className="num ml-auto text-white/80">{money(d.value)}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

interface SeriesPoint {
  date: string;
  net_worth: number;
}

export function NetWorthArea({ data }: { data: SeriesPoint[] }) {
  if (data.length === 0) {
    return <div className="text-xs text-muted text-center py-10">No snapshots yet</div>;
  }
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="nw" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7cf5c0" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#7cf5c0" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tickFormatter={(v) => new Date(v).toLocaleDateString("en-AU", { month: "short" })}
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
            labelFormatter={(v) => new Date(v as string).toLocaleDateString("en-AU")}
            formatter={(v: number) => AUD.format(v)}
          />
          <Area type="monotone" dataKey="net_worth" stroke="#7cf5c0" strokeWidth={2} fill="url(#nw)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
