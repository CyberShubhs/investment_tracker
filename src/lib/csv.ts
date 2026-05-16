function escape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCSV<T extends Record<string, unknown>>(rows: T[], cols?: (keyof T)[]): string {
  if (rows.length === 0) return cols ? cols.join(",") + "\n" : "";
  const headers = cols ?? (Object.keys(rows[0]) as (keyof T)[]);
  const head = headers.map(String).join(",");
  const body = rows.map((r) => headers.map((h) => escape(r[h])).join(",")).join("\n");
  return head + "\n" + body + "\n";
}

export function downloadCSV(filename: string, csv: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
