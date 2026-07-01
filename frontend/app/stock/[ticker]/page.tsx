"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Shield, ShieldAlert, ShieldOff } from "lucide-react";
import { getStockDetail } from "@/lib/api";
import dynamic from "next/dynamic";

const OverviewTab    = dynamic(() => import("./_tabs/OverviewTab"));
const FinancialsTab  = dynamic(() => import("./_tabs/FinancialsTab"));
const MetricsTab     = dynamic(() => import("./_tabs/MetricsTab"));
const ValuationTab   = dynamic(() => import("./_tabs/ValuationTab"));
const DividendTab    = dynamic(() => import("./_tabs/DividendTab"));
const CompareTab     = dynamic(() => import("./_tabs/CompareTab"));
const VMITab         = dynamic(() => import("./_tabs/VMITab"));
const AIInsightsTab  = dynamic(() => import("./_tabs/AIInsightsTab"));
const ChartTab       = dynamic(() => import("./_tabs/ChartTab"));
const NewsTab        = dynamic(() => import("./_tabs/NewsTab"));
const EarningsTab    = dynamic(() => import("./_tabs/EarningsTab"));

const TABS = [
  "Overview", "Financials", "Metrics", "Intrinsic Value",
  "Dividend", "Compare", "VMI", "AI Insights",
  "Chart", "News", "Earnings",
] as const;
type Tab = (typeof TABS)[number];

const MOAT_ICON = {
  WIDE:   <Shield className="w-4 h-4 text-emerald-400" />,
  NARROW: <ShieldAlert className="w-4 h-4 text-amber-400" />,
  NONE:   <ShieldOff className="w-4 h-4 text-slate-500" />,
};

const MOAT_LABEL = {
  WIDE:   "text-emerald-400",
  NARROW: "text-amber-400",
  NONE:   "text-slate-500",
};

function fmtBig(v: number | null) {
  if (v == null) return "—";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toFixed(0)}`;
}

export default function StockDetailPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = use(params);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    getStockDetail(ticker.toUpperCase())
      .then(setDetail)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
      <div className="text-center">
        <RefreshCw className="w-8 h-8 animate-spin text-[#c9a84c] mx-auto mb-3" />
        <p className="text-slate-400 text-sm">Loading {ticker.toUpperCase()}…</p>
      </div>
    </div>
  );

  if (error || !detail) return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-400 mb-3">{error || "Failed to load stock data"}</p>
        <Link href="/" className="text-[#c9a84c] hover:text-amber-300 text-sm">← Back to Dashboard</Link>
      </div>
    </div>
  );

  const sym = (detail.ticker ?? ticker.toUpperCase()) as string;
  const price = detail.current_price as number | null;
  const chg = detail.price_change as number | null;
  const chgPct = detail.price_change_pct as number | null;
  const moat = (detail.moat as string) ?? "NONE";
  const positive = (chgPct ?? 0) >= 0;

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      {/* Sticky header */}
      <div className="sticky top-16 z-30 bg-[#0a0e1a]/95 backdrop-blur border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            {/* Left: ticker + price */}
            <div className="flex items-center gap-5 flex-wrap">
              <Link href="/" className="text-slate-500 hover:text-slate-300 transition-colors shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-white font-mono">{sym}</h1>
                  <span className="text-slate-400 text-sm">{String(detail.company_name ?? "")}</span>
                  {/* Moat badge */}
                  <div className={`flex items-center gap-1.5 text-xs font-semibold ${MOAT_LABEL[moat as keyof typeof MOAT_LABEL]}`}>
                    {MOAT_ICON[moat as keyof typeof MOAT_ICON]}
                    <span>{moat} MOAT</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-500">{String(detail.sector ?? "")}</span>
                  {!!detail.industry && <span className="text-xs text-slate-700">· {String(detail.industry)}</span>}
                  {!!detail.exchange && <span className="text-xs text-slate-700">· {String(detail.exchange)}</span>}
                </div>
              </div>

              {/* Price block */}
              <div className="ml-2">
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-white font-mono">
                    {price != null ? `$${price.toFixed(2)}` : "—"}
                  </span>
                  {chg != null && chgPct != null && (
                    <div className={`flex items-center gap-1 mb-0.5 ${positive ? "text-emerald-400" : "text-red-400"}`}>
                      {positive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      <span className="text-sm font-semibold">
                        {positive ? "+" : ""}{chg.toFixed(2)} ({positive ? "+" : ""}{chgPct.toFixed(2)}%)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: quick stats */}
            <div className="flex gap-6 text-right shrink-0 flex-wrap">
              <div>
                <p className="text-xs text-slate-600">Mkt Cap</p>
                <p className="text-sm font-semibold text-slate-200">{fmtBig(detail.market_cap as number)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-600">P/E</p>
                <p className="text-sm font-semibold text-slate-200">
                  {detail.pe_ratio != null ? (detail.pe_ratio as number).toFixed(1) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-600">52W Range</p>
                <p className="text-sm font-semibold text-slate-200">
                  {detail.week_52_low != null && detail.week_52_high != null
                    ? `$${(detail.week_52_low as number).toFixed(0)} – $${(detail.week_52_high as number).toFixed(0)}`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-600">OracleValue</p>
                <p className="text-sm font-semibold text-[#c9a84c]">
                  {detail.oracle_value != null ? `$${(detail.oracle_value as number).toFixed(2)}` : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 mt-4 overflow-x-auto pb-px">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-t text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab
                    ? "text-[#c9a84c] border-[#c9a84c]"
                    : "text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === "Overview"        && <OverviewTab detail={detail} />}
        {activeTab === "Financials"      && <FinancialsTab ticker={sym} />}
        {activeTab === "Metrics"         && <MetricsTab ticker={sym} />}
        {activeTab === "Intrinsic Value" && <ValuationTab ticker={sym} currentPrice={price ?? undefined} />}
        {activeTab === "Dividend"        && <DividendTab ticker={sym} />}
        {activeTab === "Compare"         && <CompareTab ticker={sym} />}
        {activeTab === "VMI"             && <VMITab ticker={sym} />}
        {activeTab === "AI Insights"     && <AIInsightsTab ticker={sym} />}
        {activeTab === "Chart"           && <ChartTab ticker={sym} />}
        {activeTab === "News"            && <NewsTab ticker={sym} />}
        {activeTab === "Earnings"        && <EarningsTab ticker={sym} />}
      </div>
    </div>
  );
}
