import { ReactNode } from "react";

export function StatCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "good" | "bad";
}) {
  const toneCls = tone === "good" ? "text-accent" : tone === "bad" ? "text-danger" : "text-white";
  return (
    <div className="card p-4 sm:p-5">
      <div className="label">{label}</div>
      <div className={`stat-num ${toneCls}`}>{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}

export function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-10 px-4 border border-dashed border-bg-ring rounded-xl">
      <div className="text-sm font-medium text-white">{title}</div>
      {hint && <div className="text-xs text-muted mt-1 max-w-sm mx-auto">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
