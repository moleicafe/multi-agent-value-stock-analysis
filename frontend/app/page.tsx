"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Newspaper, RefreshCw, ArrowRight, Activity } from "lucide-react";
import { getMarketOverview, getMarketNews, getWatchlist } from "@/lib/api";

interface IndexCard {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  change_pct: number | null;
  monthly_pct: number | null;
  ytd_pct: number | null;
  sparkline: number[];
}

interface NewsArticle {
  title: string;
  source: string;
  url: string;
  published_at: string;
  description?: string;
  urlToImage?: string;
}

interface WatchlistStock {
  ticker: string;
  company_name: string;
  recommendation: string;
  overall_score: number;
  current_price: number;
  sector: string;
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data?.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const h = 32;
  const w = 80;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        stroke={positive ? "#22c55e" : "#ef4444"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function pct(v: number | null) {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function clr(v: number | null) {
  if (v == null) return "text-slate-400";
  return v >= 0 ? "text-emerald-400" : "text-red-400";
}

const QUOTES = [
  { text: "The stock market is a device for transferring money from the impatient to the patient.", author: "Warren Buffett" },
  { text: "In the short run, the market is a voting machine but in the long run, it is a weighing machine.", author: "Benjamin Graham" },
  { text: "It's not whether you're right or wrong that's important, but how much money you make when you're right.", author: "George Soros" },
  { text: "The four most dangerous words in investing are: 'this time it's different.'", author: "Sir John Templeton" },
  { text: "Risk comes from not knowing what you're doing.", author: "Warren Buffett" },
];

const REC_COLORS: Record<string, string> = {
  BUY: "text-emerald-400",
  HOLD: "text-amber-400",
  SELL: "text-red-400",
};

export default function DashboardPage() {
  const [indices, setIndices] = useState<IndexCard[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [quoteIdx] = useState(() => Math.floor(Math.random() * QUOTES.length));

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      getMarketOverview(),
      getMarketNews(),
      getWatchlist({ sort_by: "overall_score", sort_dir: "desc", limit: 8 }),
    ]).then(([idxRes, newsRes, wlRes]) => {
      if (idxRes.status === "fulfilled") setIndices(idxRes.value);
      if (newsRes.status === "fulfilled") setNews(Array.isArray(newsRes.value) ? newsRes.value : (newsRes.value?.articles ?? []));
      if (wlRes.status === "fulfilled") setWatchlist(wlRes.value);
      setLoading(false);
    });
  }, []);

  const quote = QUOTES[quoteIdx];

  return (
    <div className="min-h-screen bg-[#0a0e1a] p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-1">Market Dashboard</h1>
        <p className="text-slate-500 text-sm">{new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      </div>

      {/* Index cards */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-[#c9a84c]" />
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Market Indices</h2>
          {loading && <RefreshCw className="w-3 h-3 animate-spin text-slate-600" />}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-[#0f1628] border border-slate-800 rounded-xl p-4 h-28 animate-pulse" />
              ))
            : indices.map(idx => (
                <div key={idx.symbol} className="bg-[#0f1628] border border-slate-800 rounded-xl p-4 hover:border-slate-600 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">{idx.name}</p>
                      <p className="text-lg font-bold text-white font-mono">
                        {idx.price != null ? idx.price.toLocaleString() : "—"}
                      </p>
                    </div>
                    <Sparkline data={idx.sparkline} positive={(idx.change_pct ?? 0) >= 0} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${clr(idx.change_pct)}`}>
                      {pct(idx.change_pct)}
                    </span>
                    {idx.ytd_pct != null && (
                      <span className={`text-xs ${clr(idx.ytd_pct)}`}>YTD {pct(idx.ytd_pct)}</span>
                    )}
                  </div>
                </div>
              ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Top watchlist picks */}
        <div className="lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#c9a84c]" />
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Top Picks</h2>
            </div>
            <Link href="/watchlist" className="text-xs text-[#c9a84c] hover:text-amber-300 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="bg-[#0f1628] border border-slate-800 rounded-xl divide-y divide-slate-800">
            {watchlist.length === 0 ? (
              <div className="p-6 text-center text-slate-600 text-sm">
                <p>No stocks analyzed yet.</p>
                <Link href="/watchlist" className="text-[#c9a84c] text-xs mt-1 inline-block hover:text-amber-300">
                  Add stocks to watchlist →
                </Link>
              </div>
            ) : watchlist.map(s => (
              <Link
                key={s.ticker}
                href={`/stock/${s.ticker}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white text-sm">{s.ticker}</span>
                    <span className={`text-xs font-semibold ${REC_COLORS[s.recommendation] ?? "text-slate-400"}`}>{s.recommendation}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[160px]">{s.company_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono font-semibold text-white">${s.current_price?.toFixed(2) ?? "—"}</p>
                  <p className={`text-xs font-bold ${s.overall_score >= 7 ? "text-emerald-400" : s.overall_score >= 5 ? "text-amber-400" : "text-red-400"}`}>
                    {s.overall_score?.toFixed(1) ?? "—"}/10
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {/* Investor quote */}
          <div className="mt-4 bg-[#0f1628] border border-[#c9a84c]/20 rounded-xl p-4">
            <p className="text-slate-300 text-sm italic leading-relaxed mb-2">"{quote.text}"</p>
            <p className="text-[#c9a84c] text-xs font-medium">— {quote.author}</p>
          </div>
        </div>

        {/* News feed */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Newspaper className="w-4 h-4 text-[#c9a84c]" />
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Market News</h2>
            {loading && <RefreshCw className="w-3 h-3 animate-spin text-slate-600" />}
          </div>

          <div className="space-y-3">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-[#0f1628] border border-slate-800 rounded-xl p-4 h-20 animate-pulse" />
                ))
              : news.slice(0, 12).map((article, i) => (
                  <a
                    key={i}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-[#0f1628] border border-slate-800 rounded-xl p-4 hover:border-slate-600 hover:bg-slate-800/30 transition-colors group"
                  >
                    <div className="flex gap-3">
                      {article.urlToImage && (
                        <img
                          src={article.urlToImage}
                          alt=""
                          className="w-16 h-16 object-cover rounded-lg shrink-0 bg-slate-800"
                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 font-medium leading-snug group-hover:text-white transition-colors line-clamp-2">
                          {article.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs text-[#c9a84c]">{article.source}</span>
                          {article.published_at && (
                            <span className="text-xs text-slate-600">
                              {new Date(article.published_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </a>
                ))}

            {!loading && news.length === 0 && (
              <div className="bg-[#0f1628] border border-slate-800 rounded-xl p-8 text-center text-slate-600 text-sm">
                News unavailable — check your NEWS_API_KEY environment variable
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
