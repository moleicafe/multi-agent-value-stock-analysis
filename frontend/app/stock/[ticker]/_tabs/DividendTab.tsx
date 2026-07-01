"use client";
import { useState, useEffect } from "react";
import { getStockDividends } from "@/lib/api";
import { RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function DividendTab({ ticker }: { ticker: string }) {
  const [data, setData] = useState<{
    yield: number;
    rate: number;
    payout_ratio: number;
    ex_date: string | null;
    five_year_avg_yield: number | null;
    annual: { year: number; total: number }[];
    history: { date: string; amount: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStockDividends(ticker)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-600">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading dividend data…
    </div>
  );

  if (!data) return <p className="text-slate-600 text-sm">Failed to load dividend data.</p>;

  const noDividends = !data.rate && !data.yield;

  return (
    <div className="space-y-5">
      {noDividends ? (
        <div className="bg-[#0f1628] border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm">
          {ticker} does not pay a dividend
        </div>
      ) : (
        <>
          {/* Key stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Current Yield", value: data.yield != null ? `${data.yield.toFixed(2)}%` : null },
              { label: "Annual Rate", value: data.rate != null ? `$${data.rate.toFixed(2)}` : null },
              { label: "Payout Ratio", value: data.payout_ratio != null ? `${data.payout_ratio.toFixed(1)}%` : null },
              { label: "5yr Avg Yield", value: data.five_year_avg_yield != null ? `${data.five_year_avg_yield.toFixed(2)}%` : null },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#0f1628] border border-slate-800 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className="text-xl font-bold text-[#c9a84c]">{value ?? <span className="text-slate-700">—</span>}</p>
              </div>
            ))}
          </div>

          {data.ex_date && (
            <div className="bg-[#c9a84c]/10 border border-[#c9a84c]/30 rounded-xl p-4">
              <p className="text-xs text-[#c9a84c] font-semibold uppercase tracking-wider">Ex-Dividend Date</p>
              <p className="text-white font-bold mt-0.5">{data.ex_date}</p>
            </div>
          )}

          {/* Annual dividend chart */}
          {data.annual?.length > 0 && (
            <div className="bg-[#0f1628] border border-slate-800 rounded-xl p-5">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-5">Annual Dividends Paid</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.annual.slice(-10)} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#0f1628", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#e2e8f0" }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any) => [`$${Number(v ?? 0).toFixed(4)}`, "Total Dividends"]}
                  />
                  <Bar dataKey="total" fill="#c9a84c" fillOpacity={0.85} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* History table */}
          {data.history?.length > 0 && (
            <div className="bg-[#0f1628] border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-700">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dividend History</h3>
              </div>
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {data.history.map((d, i) => (
                      <tr key={i} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                        <td className="px-4 py-2.5 text-xs text-slate-400">{d.date}</td>
                        <td className="px-4 py-2.5 text-right text-xs font-mono text-[#c9a84c]">${d.amount.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
