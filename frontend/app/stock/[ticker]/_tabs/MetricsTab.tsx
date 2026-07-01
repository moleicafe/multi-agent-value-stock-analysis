"use client";
import { useState, useEffect } from "react";
import { getStockMetrics } from "@/lib/api";
import { RefreshCw } from "lucide-react";

function MetricSection({ title, items }: { title: string; items: [string, number | null, string?][] }) {
  return (
    <div className="bg-[#0f1628] border border-slate-800 rounded-xl p-5">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">{title}</h3>
      <div className="space-y-0">
        {items.map(([label, value, unit]) => (
          <div key={label} className="flex justify-between py-2.5 border-b border-slate-800/60 last:border-0">
            <span className="text-slate-400 text-sm">{label}</span>
            <span className="text-slate-200 text-sm font-mono font-medium">
              {value != null ? `${value}${unit ?? ""}` : <span className="text-slate-700">—</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MetricsTab({ ticker }: { ticker: string }) {
  const [data, setData] = useState<Record<string, Record<string, number | null>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStockMetrics(ticker)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-600">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading metrics…
    </div>
  );

  if (!data) return <p className="text-slate-600 text-sm">Failed to load metrics.</p>;

  const v = data.valuation ?? {};
  const p = data.profitability ?? {};
  const g = data.growth ?? {};
  const h = data.financial_health ?? {};
  const d = data.dividends ?? {};

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <MetricSection title="Valuation Multiples" items={[
        ["P/E Ratio (TTM)", v.pe_ratio != null ? parseFloat(v.pe_ratio.toFixed(1)) : null],
        ["Forward P/E", v.forward_pe != null ? parseFloat(v.forward_pe.toFixed(1)) : null],
        ["PEG Ratio", v.peg_ratio != null ? parseFloat(v.peg_ratio.toFixed(2)) : null],
        ["Price / Sales", v.price_to_sales != null ? parseFloat(v.price_to_sales.toFixed(2)) : null, "x"],
        ["Price / Book", v.price_to_book != null ? parseFloat(v.price_to_book.toFixed(2)) : null, "x"],
        ["EV / EBITDA", v.ev_to_ebitda != null ? parseFloat(v.ev_to_ebitda.toFixed(1)) : null, "x"],
        ["EV / Revenue", v.ev_to_revenue != null ? parseFloat(v.ev_to_revenue.toFixed(2)) : null, "x"],
        ["Earnings Yield", v.earnings_yield != null ? parseFloat(v.earnings_yield.toFixed(2)) : null, "%"],
      ]} />

      <MetricSection title="Profitability" items={[
        ["Gross Margin", p.gross_margin != null ? parseFloat(p.gross_margin.toFixed(1)) : null, "%"],
        ["Operating Margin", p.op_margin != null ? parseFloat(p.op_margin.toFixed(1)) : null, "%"],
        ["Net Profit Margin", p.net_margin != null ? parseFloat(p.net_margin.toFixed(1)) : null, "%"],
        ["EBITDA Margin", p.ebitda_margin != null ? parseFloat(p.ebitda_margin.toFixed(1)) : null, "%"],
        ["Return on Equity", p.roe != null ? parseFloat(p.roe.toFixed(1)) : null, "%"],
        ["Return on Assets", p.roa != null ? parseFloat(p.roa.toFixed(1)) : null, "%"],
      ]} />

      <MetricSection title="Growth (YoY)" items={[
        ["Revenue Growth", g.revenue_yoy != null ? parseFloat(g.revenue_yoy.toFixed(1)) : null, "%"],
        ["Earnings Growth", g.earnings_yoy != null ? parseFloat(g.earnings_yoy.toFixed(1)) : null, "%"],
        ["EPS Growth", g.eps_yoy != null ? parseFloat(g.eps_yoy.toFixed(1)) : null, "%"],
      ]} />

      <MetricSection title="Financial Health" items={[
        ["Current Ratio", h.current_ratio != null ? parseFloat(h.current_ratio.toFixed(2)) : null],
        ["Quick Ratio", h.quick_ratio != null ? parseFloat(h.quick_ratio.toFixed(2)) : null],
        ["Debt / Equity", h.debt_to_equity != null ? parseFloat(h.debt_to_equity.toFixed(1)) : null],
        ["Debt / EBITDA", h.debt_to_ebitda != null ? parseFloat(h.debt_to_ebitda.toFixed(1)) : null, "x"],
        ["FCF per Share", h.fcf_per_share != null ? parseFloat(h.fcf_per_share.toFixed(2)) : null, " USD"],
      ]} />

      <MetricSection title="Dividends" items={[
        ["Dividend Yield", d.yield != null ? parseFloat(d.yield.toFixed(2)) : null, "%"],
        ["Annual Rate", d.rate != null ? parseFloat(d.rate.toFixed(2)) : null, " USD"],
        ["Payout Ratio", d.payout_ratio != null ? parseFloat(d.payout_ratio.toFixed(1)) : null, "%"],
      ]} />
    </div>
  );
}
