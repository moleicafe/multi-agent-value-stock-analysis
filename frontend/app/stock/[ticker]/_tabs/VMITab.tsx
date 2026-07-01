"use client";
import { useState, useEffect } from "react";
import { getStockVMI } from "@/lib/api";
import { RefreshCw, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface Criterion {
  name: string;
  description: string;
  status: "PASS" | "WARNING" | "FAIL";
  value: string;
}

const STATUS_CONFIG = {
  PASS:    { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
  WARNING: { icon: AlertCircle,  color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/30" },
  FAIL:    { icon: XCircle,      color: "text-red-400",     bg: "bg-red-500/10 border-red-500/30" },
};

export default function VMITab({ ticker }: { ticker: string }) {
  const [data, setData] = useState<{ criteria: Criterion[]; pass_count: number; total: number; score: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStockVMI(ticker)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-600">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Computing VMI…
    </div>
  );

  if (!data) return <p className="text-slate-600 text-sm">Failed to load VMI data.</p>;

  const { criteria, pass_count, total, score } = data;
  const scoreColor = score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-red-400";
  const verdict = score >= 80 ? "INVEST" : score >= 60 ? "WATCHLIST" : "AVOID";
  const verdictBg = score >= 80 ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : score >= 60 ? "bg-amber-500/15 border-amber-500/30 text-amber-400" : "bg-red-500/15 border-red-500/30 text-red-400";

  return (
    <div className="space-y-5">
      {/* Hero score */}
      <div className="bg-[#0f1628] border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">VMI Score</p>
            <div className="flex items-end gap-3">
              <p className={`text-5xl font-bold font-mono ${scoreColor}`}>{score}</p>
              <p className="text-slate-500 text-xl font-mono mb-1">/ 100</p>
            </div>
            <p className="text-xs text-slate-500 mt-1">{pass_count} of {total} criteria passed</p>
          </div>
          <div className={`border rounded-xl px-5 py-3 ${verdictBg}`}>
            <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">Verdict</p>
            <p className="text-2xl font-bold">{verdict}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-5 h-2.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500"}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-600 mt-1">
          <span>0</span>
          <span className="text-amber-600">60 (Watchlist)</span>
          <span className="text-emerald-600">80+ (Invest)</span>
          <span>100</span>
        </div>
      </div>

      {/* Criteria detail */}
      <div className="space-y-3">
        {criteria.map((c) => {
          const cfg = STATUS_CONFIG[c.status];
          const Icon = cfg.icon;
          return (
            <div key={c.name} className={`border rounded-xl p-4 flex items-start gap-4 ${cfg.bg}`}>
              <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${cfg.color}`} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className={`font-semibold text-sm ${cfg.color}`}>{c.name}</p>
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${cfg.color} bg-black/20`}>{c.value}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{c.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <p className="text-xs text-slate-600 leading-relaxed">
          VMI (Value & Moat Index) evaluates 5 criteria: revenue/FCF trend, EPS growth, competitive moat,
          operational efficiency, and debt levels. Each PASS = 20 points. Score ≥80: strong buy signal.
          Score 60–79: monitor. Score &lt;60: avoid or wait for improvement.
        </p>
      </div>
    </div>
  );
}
