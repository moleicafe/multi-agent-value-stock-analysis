"use client";
import { useState, useEffect } from "react";
import { getStockCompareData } from "@/lib/api";
import { Plus, X, RefreshCw } from "lucide-react";

interface CompareRow {
  ticker: string;
  name: string | null;
  price: number | null;
  change_pct: number | null;
  market_cap: number | null;
  pe_ratio: number | null;
  peg_ratio: number | null;
  price_to_sales: number | null;
  dividend_yield: number | null;
  debt_to_equity: number | null;
  current_ratio: number | null;
  roe: number | null;
  revenue: number | null;
  net_income: number | null;
  eps: number | null;
  gross_margin: number | null;
  sector: string | null;
}

const FIELDS: { key: keyof CompareRow; label: string; fmt: (v: number | null) => string }[] = [
  { key: "price",          label: "Price",           fmt: v => v != null ? `$${v.toFixed(2)}` : "—" },
  { key: "change_pct",     label: "Day Change",      fmt: v => v != null ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` : "—" },
  { key: "market_cap",     label: "Market Cap",      fmt: v => v != null ? fmtBig(v) : "—" },
  { key: "pe_ratio",       label: "P/E Ratio",       fmt: v => v != null ? v.toFixed(1) : "—" },
  { key: "peg_ratio",      label: "PEG Ratio",       fmt: v => v != null ? v.toFixed(2) : "—" },
  { key: "price_to_sales", label: "P/S Ratio",       fmt: v => v != null ? v.toFixed(2) : "—" },
  { key: "dividend_yield", label: "Div. Yield",      fmt: v => v != null ? `${v.toFixed(2)}%` : "—" },
  { key: "debt_to_equity", label: "Debt/Equity",     fmt: v => v != null ? v.toFixed(1) : "—" },
  { key: "current_ratio",  label: "Current Ratio",   fmt: v => v != null ? v.toFixed(2) : "—" },
  { key: "roe",            label: "ROE",             fmt: v => v != null ? `${v.toFixed(1)}%` : "—" },
  { key: "gross_margin",   label: "Gross Margin",    fmt: v => v != null ? `${v.toFixed(1)}%` : "—" },
  { key: "revenue",        label: "Revenue (TTM)",   fmt: v => v != null ? fmtBig(v) : "—" },
  { key: "eps",            label: "EPS (TTM)",       fmt: v => v != null ? `$${v.toFixed(2)}` : "—" },
];

function fmtBig(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toFixed(0)}`;
}

export default function CompareTab({ ticker }: { ticker: string }) {
  const [baseData, setBaseData] = useState<CompareRow | null>(null);
  const [rows, setRows] = useState<CompareRow[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getStockCompareData(ticker).then(d => setBaseData({ ...d, ticker })).catch(() => null);
  }, [ticker]);

  async function addTicker() {
    const t = input.trim().toUpperCase();
    if (!t || rows.some(r => r.ticker === t) || t === ticker) return;
    setInput("");
    setError("");
    setLoading(t);
    try {
      const data = await getStockCompareData(t);
      if (data.error) throw new Error(data.error);
      setRows(prev => [...prev, { ...data, ticker: t }]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : `Failed to fetch ${t}`);
    } finally {
      setLoading(null);
    }
  }

  const removeRow = (t: string) => setRows(prev => prev.filter(r => r.ticker !== t));

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && addTicker()}
          placeholder="Add ticker to compare (e.g. MSFT)"
          className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-[#c9a84c] w-60"
        />
        <button
          onClick={addTicker}
          disabled={!input.trim() || !!loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#c9a84c]/15 text-[#c9a84c] border border-[#c9a84c]/30 rounded-lg text-sm font-medium hover:bg-[#c9a84c]/25 transition-colors disabled:opacity-50"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add
        </button>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {rows.length === 0 ? (
        <div className="bg-[#0f1628] border border-slate-800 rounded-xl p-8 text-center text-slate-600 text-sm">
          Add up to 4 tickers above to compare side-by-side with {ticker}
        </div>
      ) : (
        <div className="bg-[#0f1628] border border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider w-40">Metric</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[#c9a84c] uppercase tracking-wider">
                  {ticker} <span className="text-slate-600 font-normal">(base)</span>
                  {baseData?.name && <div className="text-[10px] text-slate-500 font-normal truncate max-w-[140px] text-right">{baseData.name}</div>}
                </th>
                {rows.map(r => (
                  <th key={r.ticker} className="text-right px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">{r.ticker}</span>
                      <button onClick={() => removeRow(r.ticker)} className="text-slate-600 hover:text-red-400 ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FIELDS.map(f => (
                <tr key={f.key} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                  <td className="px-4 py-2.5 text-xs text-slate-500">{f.label}</td>
                  <td className="px-4 py-2.5 text-right text-xs font-mono text-slate-300">
                    {baseData ? f.fmt(baseData[f.key] as number | null) : "—"}
                  </td>
                  {rows.map(r => (
                    <td key={r.ticker} className="px-4 py-2.5 text-right text-xs font-mono text-slate-200">
                      {f.fmt(r[f.key] as number | null)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
