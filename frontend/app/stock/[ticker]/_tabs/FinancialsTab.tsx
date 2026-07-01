"use client";
import { useState, useEffect } from "react";
import { getStockFinancials } from "@/lib/api";
import { RefreshCw } from "lucide-react";

type FinData = {
  income_annual: Record<string, Record<string, number | null>>;
  income_quarterly: Record<string, Record<string, number | null>>;
  balance_annual: Record<string, Record<string, number | null>>;
  cashflow_annual: Record<string, Record<string, number | null>>;
};

const KEY_INCOME = [
  "Total Revenue", "Cost Of Revenue", "Gross Profit",
  "Operating Expense", "Operating Income", "EBITDA",
  "Net Income", "Diluted EPS",
];
const KEY_BALANCE = [
  "Cash And Cash Equivalents", "Total Assets", "Total Liabilities Net Minority Interest",
  "Total Equity Gross Minority Interest", "Long Term Debt", "Current Liabilities",
  "Accounts Receivable", "Inventory",
];
const KEY_CASHFLOW = [
  "Operating Cash Flow", "Capital Expenditure", "Free Cash Flow",
  "Issuance Of Debt", "Repayment Of Debt", "Common Stock Issuance",
];

function fmt(v: number | null) {
  if (v == null) return <span className="text-slate-700">—</span>;
  const abs = Math.abs(v);
  const neg = v < 0;
  let s = "";
  if (abs >= 1e12) s = `${(abs / 1e12).toFixed(1)}T`;
  else if (abs >= 1e9) s = `${(abs / 1e9).toFixed(1)}B`;
  else if (abs >= 1e6) s = `${(abs / 1e6).toFixed(1)}M`;
  else s = abs.toFixed(0);
  return <span className={neg ? "text-red-400" : ""}>{neg ? `(${s})` : s}</span>;
}

function FinTable({ data, keys }: { data: Record<string, Record<string, number | null>>; keys: string[] }) {
  const years = Object.keys(data).sort((a, b) => b.localeCompare(a));
  if (!years.length) return <p className="text-slate-600 text-sm py-4">No data available</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider w-48">Item</th>
            {years.map(y => (
              <th key={y} className="text-right py-2 px-3 text-xs font-medium text-slate-400 uppercase tracking-wider">{y}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keys.map(key => (
            <tr key={key} className="border-b border-slate-800/60 hover:bg-slate-800/20">
              <td className="py-2.5 px-3 text-slate-400 text-xs">{key}</td>
              {years.map(y => (
                <td key={y} className="py-2.5 px-3 text-right text-xs font-mono">{fmt(data[y]?.[key] ?? null)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const VIEWS = ["Income Statement", "Balance Sheet", "Cash Flow"] as const;
type ViewType = (typeof VIEWS)[number];

export default function FinancialsTab({ ticker }: { ticker: string }) {
  const [data, setData] = useState<FinData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewType>("Income Statement");
  const [period, setPeriod] = useState<"annual" | "quarterly">("annual");

  useEffect(() => {
    getStockFinancials(ticker)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-600">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading financials…
    </div>
  );

  if (!data) return <p className="text-slate-600 text-sm">Failed to load financial data.</p>;

  const tableData: Record<string, Record<string, number | null>> =
    view === "Income Statement"
      ? (period === "annual" ? data.income_annual : data.income_quarterly)
      : view === "Balance Sheet"
      ? data.balance_annual
      : data.cashflow_annual;

  const keys = view === "Income Statement" ? KEY_INCOME : view === "Balance Sheet" ? KEY_BALANCE : KEY_CASHFLOW;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {VIEWS.map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                view === v
                  ? "bg-[#c9a84c]/15 text-[#c9a84c] border border-[#c9a84c]/30"
                  : "text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-600"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        {view === "Income Statement" && (
          <div className="flex gap-1 ml-2">
            {(["annual", "quarterly"] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  period === p
                    ? "bg-slate-700 text-slate-200"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-600 ml-auto">Values in USD · B = Billion · M = Million</p>
      </div>

      <div className="bg-[#0f1628] border border-slate-800 rounded-xl p-5">
        <FinTable data={tableData} keys={keys} />
      </div>
    </div>
  );
}
