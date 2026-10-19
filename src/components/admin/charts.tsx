"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatGHS } from "@/lib/money";

/** Categorical slots in fixed order (validated reference palette). */
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"];
const GRID = "#ecebe6";
const AXIS = "#8a93a3";

const monthLabel = (m: string) => {
  if (!/^\d{4}-\d{2}$/.test(m)) return m.length === 10 ? m.slice(5) : m; // day (MM-DD) or ISO week labels
  const [y, mo] = m.split("-");
  return new Date(Date.UTC(Number(y), Number(mo) - 1, 1)).toLocaleString("en-GH", { month: "short", timeZone: "UTC" });
};
const compactGHS = (v: number) => formatGHS(Math.round(v), { compact: true }).replace(".00", "");

function TooltipBox({ active, payload, label, money }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; money?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[10px] border border-border bg-surface px-3 py-2 text-[12.5px] shadow-[var(--shadow-lift)]">
      <p className="mb-1 font-medium">{label && /^\d{4}-\d{2}$/.test(label) ? `${monthLabel(label)} ${label.slice(0, 4)}` : label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-muted">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="tabular font-medium text-foreground">{money ? formatGHS(p.value) : p.value.toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
}

export function MonthlyBars({ data, dataKey, name, money = true, color = SERIES[0], height = 240 }: { data: Record<string, number | string>[]; dataKey: string; name: string; money?: boolean; color?: string; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label={`${name} by month`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fill: AXIS, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={money ? compactGHS : (v) => String(v)} tick={{ fill: AXIS, fontSize: 12 }} axisLine={false} tickLine={false} width={money ? 64 : 32} allowDecimals={false} />
          <Tooltip cursor={{ fill: "#0b122008" }} content={<TooltipBox money={money} />} />
          <Bar dataKey={dataKey} name={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyLine({ data, dataKey, name, money = true, color = SERIES[0], height = 240 }: { data: Record<string, number | string>[]; dataKey: string; name: string; money?: boolean; color?: string; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label={`${name} by month`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fill: AXIS, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={money ? compactGHS : (v) => String(v)} tick={{ fill: AXIS, fontSize: 12 }} axisLine={false} tickLine={false} width={money ? 64 : 32} allowDecimals={false} />
          <Tooltip cursor={{ stroke: AXIS, strokeDasharray: "3 3" }} content={<TooltipBox money={money} />} />
          <Line type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2} dot={{ r: 3, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal magnitude bars (status counts, best-sellers). Values are direct-labelled; single hue. */
export function HBarList({ rows, money }: { rows: { label: string; value: number }[]; money?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,140px)_1fr_auto] items-center gap-3 text-[13px]" title={`${r.label}: ${money ? formatGHS(r.value) : r.value}`}>
          <span className="truncate text-muted">{r.label}</span>
          <span className="h-2.5 rounded-full bg-surface-2">
            <span className="block h-full rounded-full" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: SERIES[0] }} />
          </span>
          <span className="tabular font-medium">{money ? formatGHS(r.value, { compact: true }) : r.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Inventory movements — grouped bars, ≤4 series in fixed palette order, with legend. */
export function InventoryBars({ data }: { data: { month: string; restock: number; reserved: number; released: number; dispatched: number }[] }) {
  const series = [
    { key: "restock", name: "Restocked" },
    { key: "reserved", name: "Reserved" },
    { key: "released", name: "Released" },
    { key: "dispatched", name: "Handed over" },
  ];
  return (
    <div style={{ height: 260 }} role="img" aria-label="Inventory movements by month">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fill: AXIS, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: AXIS, fontSize: 12 }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
          <Tooltip cursor={{ fill: "#0b122008" }} content={<TooltipBox />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#5b6475" }} />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={SERIES[i]} radius={[3, 3, 0, 0]} maxBarSize={10} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
