"use client";
import { useState, useEffect } from "react";
import { getStockValuation } from "@/lib/api";
import { RefreshCw } from "lucide-react";

const MODEL_LABELS: Record<string, { label: string; desc: string }> = {
  dcf:           { label: "DCF (10yr)", desc: "Discounted cash flow — 10% discount rate, 3% terminal growth" },
  pe_based:      { label: "P/E Based", desc: "Historical market avg P/E of 15× applied to trailing EPS" },
  forward_pe:    { label: "Forward P/E", desc: "15× forward EPS estimate" },
  ps_based:      { label: "P/S Based", desc: "2.5× price-to-sales revenue per share" },
  pb_based:      { label: "P/B Based", desc: "3× book value per share" },
  graham:        { label: "Graham Number", desc: "√(22.5 × EPS × Book Value) — Ben Graham's intrinsic value formula" },
  analyst_target: { label: "Analyst Target", desc: "Consensus mean analyst price target" },
};

export default function ValuationTab({ ticker, currentPrice }: { ticker: string; currentPrice?: number }) {
  const [data, setData] = useState<{
    current_price: number;
    oracle_value: number | null;
    models: Record<string, number | null>;
    upside_pct: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStockValuation(ticker)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-600">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Computing valuation models…
    </div>
  );

  if (!data) return <p className="text-slate-600 text-sm">Failed to load valuation data.</p>;

  const price = data.current_price ?? currentPrice ?? 0;
  const oracle = data.oracle_value;
  const upside = data.upside_pct;

  return (
    <div className="space-y-5">
      {/* Oracle Value hero */}
      <div className="bg-[#0f1628] border border-[#c9a84c]/30 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#c9a84c] uppercase tracking-wider mb-1">OracleValue™</p>
            <p className="text-4xl font-bold text-white font-mono">
              {oracle != null ? `$${oracle.toFixed(2)}` : "N/A"}
            </p>
            <p className="text-xs text-slate-500 mt-1">Weighted average of {Object.values(data.models).filter(v => v != null).length} valuation models</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500 mb-1">Current Price</p>
            <p className="text-2xl font-bold text-slate-200 font-mono">${price.toFixed(2)}</p>
            {upside != null && (
              <p className={`text-lg font-bold mt-1 ${upside >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {upside >= 0 ? "+" : ""}{upside.toFixed(1)}% {upside >= 0 ? "upside" : "downside"}
              </p>
            )}
          </div>
        </div>

        {/* Visual bar */}
        {oracle != null && price > 0 && (
          <div className="mt-5">
            <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`absolute left-0 h-full rounded-full ${upside != null && upside >= 0 ? "bg-emerald-500" : "bg-red-500"}`}
                style={{ width: `${Math.min(100, (price / Math.max(price, oracle)) * 100)}%` }}
              />
              <div
                className="absolute h-full w-0.5 bg-[#c9a84c]"
                style={{ left: `${Math.min(100, (oracle / Math.max(price, oracle)) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>$0</span>
              <span className="text-slate-400">Current: ${price.toFixed(0)}</span>
              <span className="text-[#c9a84c]">Oracle: ${oracle.toFixed(0)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Individual models */}
      <div className="bg-[#0f1628] border border-slate-800 rounded-xl p-5">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Model Breakdown</h3>
        <div className="space-y-3">
          {Object.entries(data.models).map(([key, val]) => {
            const meta = MODEL_LABELS[key];
            const pct = val != null && price > 0 ? ((val / price - 1) * 100) : null;
            return (
              <div key={key} className="flex items-center gap-4 py-2 border-b border-slate-800/60 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 font-medium">{meta?.label ?? key}</p>
                  <p className="text-xs text-slate-600 truncate">{meta?.desc}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-mono font-bold text-slate-100">
                    {val != null ? `$${val.toFixed(2)}` : <span className="text-slate-700">N/A</span>}
                  </p>
                  {pct != null && (
                    <p className={`text-xs font-semibold ${pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <p className="text-xs text-slate-600 leading-relaxed">
          OracleValue is the average of all available models. Models requiring missing data (e.g. negative EPS for Graham) are excluded.
          Not financial advice — always do your own research.
        </p>
      </div>
    </div>
  );
}
