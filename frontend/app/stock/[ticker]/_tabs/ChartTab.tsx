"use client";
import { useState, useEffect } from "react";
import { getStockChart } from "@/lib/api";
import { RefreshCw } from "lucide-react";
import type { OhlcBar } from "@/components/CandlestickChart";
import dynamic from "next/dynamic";

const CandlestickChart = dynamic(() => import("@/components/CandlestickChart"), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-96 text-slate-600"><RefreshCw className="w-5 h-5 animate-spin mr-2" />Loading chart…</div>,
});

const PERIODS = ["1W", "1M", "3M", "6M", "1Y", "3Y", "5Y"];

export default function ChartTab({ ticker }: { ticker: string }) {
  const [period, setPeriod] = useState("1Y");
  const [data, setData] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getStockChart(ticker, period)
      .then(res => setData(res.data ?? []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [ticker, period]);

  return (
    <div className="space-y-4">
      <div className="bg-[#0f1628] border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-white">Price Chart — {ticker}</h3>
          <div className="flex gap-1">
            {PERIODS.map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  period === p
                    ? "bg-[#c9a84c]/20 text-[#c9a84c] border border-[#c9a84c]/40"
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-96 text-slate-600">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            Loading chart…
          </div>
        ) : (
          <CandlestickChart data={data as OhlcBar[]} height={400} />
        )}
      </div>

      <div className="bg-[#0f1628] border border-slate-800 rounded-xl p-4">
        <p className="text-xs text-slate-600">
          OHLCV candlestick chart powered by TradingView Lightweight Charts. Green candles = up days, red candles = down days. Volume bars shown below.
        </p>
      </div>
    </div>
  );
}
