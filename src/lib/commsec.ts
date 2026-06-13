import { parseCSV } from "./csv";

export interface CommsecHolding {
  symbol: string;
  quantity: number;
  avg_cost?: number;
  /** Listing currency: AUD for ASX exports, USD/etc for international exports. */
  currency: string;
}

const CODE_HEADERS = ["code", "security", "symbol", "asx code"];
const UNITS_HEADERS = ["avail units", "available units", "units", "quantity", "qty", "total units"];
const COST_HEADERS = ["purchase $", "purchase", "avg cost", "average cost", "purchase price", "avg price", "cost"];
const CURRENCY_HEADERS = ["cur", "currency"];

function findCol(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const i = headers.findIndex((h) => h === c || h.startsWith(c));
    if (i >= 0) return i;
  }
  return -1;
}

function parseNum(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = Number(s.replace(/[$,\s]/g, ""));
  return isFinite(n) ? n : undefined;
}

/**
 * Tolerant parser for CommSec holdings CSV exports (ASX and International).
 * Finds the header row (exports have preamble lines like "Account Number: …"),
 * then extracts code + units (+ average cost and currency when present).
 * Section rows like "CHESS", "Subtotal", "Total" have no units and are skipped.
 */
export function parseCommsecHoldings(text: string): { holdings: CommsecHolding[]; error?: string } {
  const rows = parseCSV(text);
  if (rows.length === 0) return { holdings: [], error: "Empty file" };

  let headerIdx = -1;
  let codeCol = -1;
  let unitsCol = -1;
  let costCol = -1;
  let currencyCol = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const headers = rows[i].map((h) => h.trim().toLowerCase());
    const c = findCol(headers, CODE_HEADERS);
    const u = findCol(headers, UNITS_HEADERS);
    if (c >= 0 && u >= 0) {
      headerIdx = i;
      codeCol = c;
      unitsCol = u;
      costCol = findCol(headers, COST_HEADERS);
      currencyCol = findCol(headers, CURRENCY_HEADERS);
      break;
    }
  }
  if (headerIdx < 0) {
    return { holdings: [], error: "Couldn't find Code + Units columns. Export the holdings CSV from CommSec Portfolio." };
  }

  const holdings: CommsecHolding[] = [];
  for (const row of rows.slice(headerIdx + 1)) {
    const symbol = (row[codeCol] ?? "").trim().toUpperCase();
    const quantity = parseNum(row[unitsCol]);
    if (!symbol || !/^[A-Z0-9]{1,6}$/.test(symbol) || symbol === "TOTAL" || !quantity || quantity <= 0) continue;
    holdings.push({
      symbol,
      quantity,
      avg_cost: costCol >= 0 ? parseNum(row[costCol]) : undefined,
      currency: currencyCol >= 0 ? (row[currencyCol] ?? "").trim().toUpperCase() || "AUD" : "AUD",
    });
  }
  return holdings.length > 0 ? { holdings } : { holdings, error: "No holdings rows found in file" };
}
