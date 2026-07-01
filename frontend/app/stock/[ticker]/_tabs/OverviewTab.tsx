"use client";
import SpiderChart from "@/components/SpiderChart";

interface Props {
  detail: Record<string, unknown>;
}

function Row({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`flex justify-between py-2.5 border-b border-slate-800/60 last:border-0 ${highlight ? "bg-[#c9a84c]/5 -mx-3 px-3 rounded" : ""}`}>
      <span className="text-slate-500 text-sm">{label}</span>
      <span className="text-slate-200 text-sm font-medium text-right">{value ?? <span className="text-slate-700">—</span>}</span>
    </div>
  );
}

function fmtBig(v: number | null) {
  if (v == null) return null;
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toLocaleString()}`;
}

function fmtPct(v: number | null) {
  if (v == null) return null;
  return `${(v * 100).toFixed(2)}%`;
}

const MOAT_COLORS: Record<string, string> = {
  WIDE: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  NARROW: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  NONE: "bg-slate-700/50 text-slate-400 border-slate-600",
};

export default function OverviewTab({ detail }: Props) {
  const d = detail;
  const radarScores = d.radar_scores as Record<string, number> | undefined;
  const moat = d.moat as string ?? "NONE";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

      {/* Left: key stats */}
      <div className="space-y-4">
        <div className="bg-[#0f1628] border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Price & Market</h3>
          <Row label="Current Price" value={d.current_price != null ? `$${(d.current_price as number).toFixed(2)}` : null} highlight />
          <Row label="52W High" value={d.week_52_high != null ? `$${(d.week_52_high as number).toFixed(2)}` : null} />
          <Row label="52W Low" value={d.week_52_low != null ? `$${(d.week_52_low as number).toFixed(2)}` : null} />
          <Row label="Market Cap" value={fmtBig(d.market_cap as number)} />
          <Row label="Enterprise Value" value={fmtBig(d.enterprise_value as number)} />
          <Row label="Volume" value={d.volume != null ? (d.volume as number).toLocaleString() : null} />
          <Row label="Avg Volume (3M)" value={d.avg_volume != null ? (d.avg_volume as number).toLocaleString() : null} />
          <Row label="Beta" value={d.beta != null ? (d.beta as number).toFixed(2) : null} />
          <Row label="Shares Outstanding" value={fmtBig(d.shares_outstanding as number)?.replace("$", "")} />
        </div>

        <div className="bg-[#0f1628] border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Fundamentals</h3>
          <Row label="P/E Ratio" value={d.pe_ratio != null ? (d.pe_ratio as number).toFixed(1) : null} />
          <Row label="Forward P/E" value={d.forward_pe != null ? (d.forward_pe as number).toFixed(1) : null} />
          <Row label="PEG Ratio" value={d.peg_ratio != null ? (d.peg_ratio as number).toFixed(2) : null} />
          <Row label="Price/Book" value={d.price_to_book != null ? (d.price_to_book as number).toFixed(2) : null} />
          <Row label="Price/Sales" value={d.price_to_sales != null ? (d.price_to_sales as number).toFixed(2) : null} />
          <Row label="EV/EBITDA" value={d.ev_to_ebitda != null ? (d.ev_to_ebitda as number).toFixed(1) : null} />
          <Row label="EPS (TTM)" value={d.eps != null ? `$${(d.eps as number).toFixed(2)}` : null} />
          <Row label="Forward EPS" value={d.forward_eps != null ? `$${(d.forward_eps as number).toFixed(2)}` : null} />
        </div>

        <div className="bg-[#0f1628] border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Profitability</h3>
          <Row label="Gross Margin" value={fmtPct(d.gross_margins as number)} />
          <Row label="Operating Margin" value={fmtPct(d.operating_margins as number)} />
          <Row label="Net Margin" value={fmtPct(d.net_margins as number)} />
          <Row label="Return on Equity" value={fmtPct(d.roe as number)} />
          <Row label="Return on Assets" value={fmtPct(d.roa as number)} />
          <Row label="Revenue (TTM)" value={fmtBig(d.revenue as number)} />
          <Row label="Revenue Growth YoY" value={fmtPct(d.revenue_growth as number)} />
          <Row label="Earnings Growth YoY" value={fmtPct(d.earnings_growth as number)} />
        </div>

        {!!d.description && (
          <div className="bg-[#0f1628] border border-slate-800 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">About</h3>
            <p className="text-slate-300 text-sm leading-relaxed line-clamp-6">{String(d.description)}</p>
            {!!d.employees && <p className="text-xs text-slate-500 mt-2">{(d.employees as number).toLocaleString()} employees · {String(d.country ?? "")}</p>}
            {!!d.website && (
              <a href={String(d.website)} target="_blank" rel="noopener noreferrer" className="text-xs text-[#c9a84c] hover:text-amber-300 mt-1 inline-block">
                {String(d.website)} →
              </a>
            )}
          </div>
        )}
      </div>

      {/* Right: radar + moat + analyst */}
      <div className="space-y-4">
        {/* Moat badge */}
        <div className={`border rounded-xl p-4 flex items-center gap-4 ${MOAT_COLORS[moat]}`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-0.5">Competitive Moat</p>
            <p className="text-2xl font-bold">{moat}</p>
          </div>
          <div className="text-xs opacity-60 leading-relaxed ml-auto max-w-[200px] text-right">
            {moat === "WIDE" && "Strong durable advantage — ROE ≥20%, gross margin ≥40%, positive FCF"}
            {moat === "NARROW" && "Moderate competitive edge — ROE ≥10%, gross margin ≥25%"}
            {moat === "NONE" && "No significant competitive advantage detected"}
          </div>
        </div>

        {/* Radar chart */}
        {radarScores && (
          <div className="bg-[#0f1628] border border-slate-800 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Oracle Score Radar</h3>
            <SpiderChart scores={radarScores as unknown as Parameters<typeof SpiderChart>[0]["scores"]} size={280} />
            <div className="grid grid-cols-3 gap-2 mt-4">
              {Object.entries(radarScores).map(([k, v]) => (
                <div key={k} className="text-center">
                  <p className="text-[10px] text-slate-500 capitalize">{k.replace("_", " ")}</p>
                  <p className={`text-sm font-bold ${v >= 70 ? "text-emerald-400" : v >= 40 ? "text-amber-400" : "text-red-400"}`}>{v}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analyst consensus */}
        <div className="bg-[#0f1628] border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Analyst Consensus</h3>
          <Row label="Target Price" value={d.analyst_target != null ? `$${(d.analyst_target as number).toFixed(2)}` : null} highlight />
          <Row label="Target High" value={d.analyst_target_high != null ? `$${(d.analyst_target_high as number).toFixed(2)}` : null} />
          <Row label="Target Low" value={d.analyst_target_low != null ? `$${(d.analyst_target_low as number).toFixed(2)}` : null} />
          <Row label="Recommendation" value={d.recommendation != null ? (
            <span className="capitalize">{(d.recommendation as string).replace(/_/g, " ")}</span>
          ) : null} />
          {d.analyst_target != null && d.current_price != null && (
            <Row
              label="Upside to Target"
              value={(() => {
                const upside = ((d.analyst_target as number) / (d.current_price as number) - 1) * 100;
                return (
                  <span className={upside >= 0 ? "text-emerald-400" : "text-red-400"}>
                    {upside >= 0 ? "+" : ""}{upside.toFixed(1)}%
                  </span>
                );
              })()}
            />
          )}
          <Row label="Short Interest" value={d.short_interest != null ? `${((d.short_interest as number) * 100).toFixed(1)}%` : null} />
          <Row label="Next Earnings" value={d.next_earnings_date as string} />
        </div>

        {/* Health indicators */}
        <div className="bg-[#0f1628] border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Balance Sheet Snapshot</h3>
          <Row label="Total Cash" value={fmtBig(d.total_cash as number)} />
          <Row label="Total Debt" value={fmtBig(d.total_debt as number)} />
          <Row label="Free Cash Flow" value={fmtBig(d.free_cashflow as number)} />
          <Row label="Operating Cash Flow" value={fmtBig(d.operating_cashflow as number)} />
          <Row label="Current Ratio" value={d.current_ratio != null ? (d.current_ratio as number).toFixed(2) : null} />
          <Row label="Quick Ratio" value={d.quick_ratio != null ? (d.quick_ratio as number).toFixed(2) : null} />
          <Row label="Debt/Equity" value={d.debt_to_equity != null ? (d.debt_to_equity as number).toFixed(1) : null} />
        </div>
      </div>
    </div>
  );
}
