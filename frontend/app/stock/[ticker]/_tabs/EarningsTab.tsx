"use client";
import { useState, useEffect } from "react";
import { getStockEarnings } from "@/lib/api";
import { RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";

interface EarningsRecord {
  period: string;
  eps_actual: number | null;
  eps_estimate: number | null;
  eps_surprise: number | null;
  beat: boolean | null;
}

export default function EarningsTab({ ticker }: { ticker: string }) {
  const [data, setData] = useState<{ next_earnings_date: string | null; history: EarningsRecord[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStockEarnings(ticker)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-600">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading earnings…
    </div>
  );

  if (!data) return <p className="text-slate-600 text-sm">Failed to load earnings data.</p>;

  const { next_earnings_date, history } = data;
  const chartData = [...(history ?? [])].reverse().slice(-8);

  return (
    <div className="space-y-5">
      {next_earnings_date && (
        <div className="bg-[#c9a84c]/10 border border-[#c9a84c]/30 rounded-xl p-4 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#c9a84c] animate-pulse" />
          <div>
            <p className="text-xs text-[#c9a84c] font-semibold uppercase tracking-wider">Next Earnings Date</p>
            <p className="text-white font-bold">{new Date(next_earnings_date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          </div>
        </div>
      )}

      {chartData.length > 0 && (
        <div className="bg-[#0f1628] border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-5">EPS — Actual vs Estimate</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#0f1628", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#e2e8f0" }}
                itemStyle={{ color: "#c9a84c" }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [`$${Number(v ?? 0).toFixed(2)}`, ""]}
              />
              <ReferenceLine y={0} stroke="#334155" />
              <Bar dataKey="eps_estimate" name="Estimate" fill="#334155" radius={[3, 3, 0, 0]} />
              <Bar dataKey="eps_actual" name="Actual" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.beat === true ? "#22c55e" : entry.beat === false ? "#ef4444" : "#c9a84c"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-700 inline-block" /> Estimate</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Beat</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> Miss</span>
          </div>
        </div>
      )}

      {/* Table */}
      {history && history.length > 0 && (
        <div className="bg-[#0f1628] border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Period</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Estimate</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Actual</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Surprise</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Result</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r, i) => (
                <tr key={i} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                  <td className="px-4 py-3 text-xs text-slate-400">{r.period}</td>
                  <td className="px-4 py-3 text-right text-xs font-mono text-slate-400">
                    {r.eps_estimate != null ? `$${r.eps_estimate.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-mono font-semibold text-slate-200">
                    {r.eps_actual != null ? `$${r.eps_actual.toFixed(2)}` : "—"}
                  </td>
                  <td className={`px-4 py-3 text-right text-xs font-semibold ${r.eps_surprise != null && r.eps_surprise >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {r.eps_surprise != null ? `${r.eps_surprise >= 0 ? "+" : ""}${r.eps_surprise.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.beat === true
                      ? <TrendingUp className="w-4 h-4 text-emerald-400 mx-auto" />
                      : r.beat === false
                      ? <TrendingDown className="w-4 h-4 text-red-400 mx-auto" />
                      : <span className="text-slate-600 text-xs">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(!history || !history.length) && (
        <div className="bg-[#0f1628] border border-slate-800 rounded-xl p-8 text-center text-slate-600 text-sm">
          No earnings history available for {ticker}
        </div>
      )}
    </div>
  );
}
