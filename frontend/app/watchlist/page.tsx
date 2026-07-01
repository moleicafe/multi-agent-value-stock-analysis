"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getFilteredRowModel, flexRender,
  type ColumnDef, type SortingState,
} from "@tanstack/react-table";
import { Search, RefreshCw, Trash2, ChevronUp, ChevronDown, ExternalLink, TrendingUp, TrendingDown, Minus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { analyzeStock, getWatchlist, deleteStock, getSectors, getStockAIDetail } from "@/lib/api";

type Stock = {
  ticker: string;
  company_name: string;
  sector: string;
  industry: string;
  recommendation: string;
  confidence_score: number;
  overall_score: number;
  current_price: number;
  market_cap: number;
  pe_ratio: number;
  forward_pe: number;
  peg_ratio: number;
  ev_to_ebitda: number;
  valuation_verdict: string;
  revenue_growth_yoy: number;
  net_margins: number;
  debt_to_equity: number;
  rsi: number;
  price_vs_52w_high_pct: number;
  beta: number;
  news_sentiment_score: number;
  insider_trend: string;
  analyst_recommendation: string;
  run_date: string;
};

const REC_COLORS: Record<string, string> = {
  BUY: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  HOLD: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  SELL: "bg-red-500/20 text-red-400 border border-red-500/30",
};

const VAL_COLORS: Record<string, string> = {
  UNDERVALUED: "text-emerald-400",
  FAIR: "text-slate-400",
  OVERVALUED: "text-red-400",
};

const INSIDER_ICONS: Record<string, React.ReactNode> = {
  BUYING: <TrendingUp size={14} className="text-emerald-400" />,
  SELLING: <TrendingDown size={14} className="text-red-400" />,
  NEUTRAL: <Minus size={14} className="text-slate-400" />,
};

function fmt(v: number | null, suffix = "", decimals = 1): React.ReactNode {
  if (v == null) return <span className="text-slate-600">—</span>;
  return `${v.toFixed(decimals)}${suffix}`;
}

function fmtBig(v: number | null): React.ReactNode {
  if (v == null) return <span className="text-slate-600">—</span>;
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toFixed(0)}`;
}

function SentimentBar({ score }: { score: number | null }) {
  if (score == null) return <span className="text-slate-600">—</span>;
  const pct = Math.round(((score + 1) / 2) * 100);
  const color = score > 0.2 ? "bg-emerald-500" : score < -0.2 ? "bg-red-500" : "bg-amber-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400">{score.toFixed(2)}</span>
    </div>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-slate-600">—</span>;
  const color = score >= 7 ? "text-emerald-400" : score >= 5 ? "text-amber-400" : "text-red-400";
  return <span className={`font-bold text-sm ${color}`}>{score.toFixed(1)}</span>;
}

export default function WatchlistPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [sorting, setSorting] = useState<SortingState>([{ id: "overall_score", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [tickerInput, setTickerInput] = useState("");
  const [analysisLog, setAnalysisLog] = useState<string[]>([]);
  const [filters, setFilters] = useState({ recommendation: "", sector: "", valuation_verdict: "" });
  const [sectors, setSectors] = useState<string[]>([]);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadWatchlist = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filters.recommendation) params.recommendation = filters.recommendation;
      if (filters.sector) params.sector = filters.sector;
      if (filters.valuation_verdict) params.valuation_verdict = filters.valuation_verdict;
      setStocks(await getWatchlist(params));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadWatchlist(); }, [loadWatchlist]);
  useEffect(() => { getSectors().then(setSectors); }, []);

  async function handleAnalyze() {
    if (!tickerInput.trim()) return;
    setAnalyzing(true);
    setAnalysisLog([]);
    setError("");
    try {
      const result = await analyzeStock(tickerInput.trim().toUpperCase());
      setAnalysisLog(result.logs?.map((l: { message: string }) => l.message) ?? []);
      await loadWatchlist();
      setTickerInput("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleDelete(ticker: string) {
    await deleteStock(ticker);
    setStocks(s => s.filter(x => x.ticker !== ticker));
  }

  const columns: ColumnDef<Stock>[] = [
    {
      accessorKey: "ticker",
      header: "Ticker",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/stock/${row.original.ticker}`}
            className="font-mono font-bold text-[#c9a84c] hover:text-amber-300 flex items-center gap-1"
          >
            {row.original.ticker}
            <ExternalLink size={10} />
          </Link>
          <button
            onClick={() => setSelectedStock(row.original.ticker)}
            className="text-[9px] text-slate-600 hover:text-blue-400 border border-slate-700 hover:border-blue-600 rounded px-1 py-0.5 transition-colors"
            title="AI Analysis"
          >
            AI
          </button>
        </div>
      ),
    },
    {
      accessorKey: "company_name",
      header: "Company",
      cell: ({ getValue }) => (
        <span className="text-sm text-slate-300 max-w-[140px] truncate block">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "recommendation",
      header: "Rec",
      cell: ({ getValue }) => {
        const rec = getValue() as string;
        return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${REC_COLORS[rec] ?? ""}`}>{rec}</span>;
      },
    },
    {
      accessorKey: "overall_score",
      header: "Score",
      cell: ({ getValue }) => <ScoreBadge score={getValue() as number} />,
    },
    {
      accessorKey: "confidence_score",
      header: "Conf",
      cell: ({ getValue }) => fmt((getValue() as number) * 100, "%", 0),
    },
    {
      accessorKey: "current_price",
      header: "Price",
      cell: ({ getValue }) => <span className="font-mono">${fmt(getValue() as number, "", 2)}</span>,
    },
    {
      accessorKey: "market_cap",
      header: "Mkt Cap",
      cell: ({ getValue }) => fmtBig(getValue() as number),
    },
    {
      accessorKey: "pe_ratio",
      header: "P/E",
      cell: ({ getValue }) => fmt(getValue() as number),
    },
    {
      accessorKey: "ev_to_ebitda",
      header: "EV/EBITDA",
      cell: ({ getValue }) => fmt(getValue() as number),
    },
    {
      accessorKey: "valuation_verdict",
      header: "Valuation",
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return <span className={`text-xs font-medium ${VAL_COLORS[v] ?? "text-slate-400"}`}>{v}</span>;
      },
    },
    {
      accessorKey: "revenue_growth_yoy",
      header: "Rev Growth",
      cell: ({ getValue }) => {
        const v = getValue() as number;
        if (v == null) return <span className="text-slate-600">—</span>;
        const color = v > 0 ? "text-emerald-400" : "text-red-400";
        return <span className={color}>{(v * 100).toFixed(1)}%</span>;
      },
    },
    {
      accessorKey: "net_margins",
      header: "Net Margin",
      cell: ({ getValue }) => {
        const v = getValue() as number;
        if (v == null) return <span className="text-slate-600">—</span>;
        return `${(v * 100).toFixed(1)}%`;
      },
    },
    {
      accessorKey: "rsi",
      header: "RSI",
      cell: ({ getValue }) => {
        const v = getValue() as number;
        if (v == null) return <span className="text-slate-600">—</span>;
        const color = v > 70 ? "text-red-400" : v < 30 ? "text-emerald-400" : "text-slate-300";
        return <span className={color}>{v.toFixed(1)}</span>;
      },
    },
    {
      accessorKey: "news_sentiment_score",
      header: "Sentiment",
      cell: ({ getValue }) => <SentimentBar score={getValue() as number} />,
    },
    {
      accessorKey: "insider_trend",
      header: "Insiders",
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return (
          <div className="flex items-center gap-1">
            {INSIDER_ICONS[v] ?? null}
            <span className="text-xs text-slate-400">{v}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "sector",
      header: "Sector",
      cell: ({ getValue }) => <span className="text-xs text-slate-500">{getValue() as string}</span>,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <button
          onClick={() => handleDelete(row.original.ticker)}
          className="text-slate-600 hover:text-red-400 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      ),
    },
  ];

  const table = useReactTable({
    data: stocks,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="min-h-screen bg-[#0a0e1a] p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Watchlist</h1>
        <p className="text-slate-500 text-sm">Multi-agent AI stock analysis — click a ticker for full detail, or AI for analysis report</p>
      </div>

      <div className="flex gap-3 mb-6">
        <input
          value={tickerInput}
          onChange={e => setTickerInput(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && handleAnalyze()}
          placeholder="Enter ticker (e.g. AAPL)"
          className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-[#c9a84c] w-56"
          disabled={analyzing}
        />
        <button
          onClick={handleAnalyze}
          disabled={analyzing || !tickerInput}
          className="bg-[#c9a84c] hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
        >
          {analyzing ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
          {analyzing ? "Analyzing..." : "Run AI Analysis"}
        </button>
        <button
          onClick={loadWatchlist}
          className="text-slate-400 hover:text-white border border-slate-700 rounded-lg px-3 py-2.5 transition-colors"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {analysisLog.length > 0 && (
        <div className="mb-4 bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-400 font-mono space-y-0.5 max-h-28 overflow-y-auto">
          {analysisLog.map((l, i) => <div key={i}>&gt; {l}</div>)}
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-950 border border-red-800 text-red-400 text-sm rounded-lg p-3">{error}</div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
          placeholder="Search all columns..."
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-[#c9a84c] w-48"
        />
        {(["BUY", "HOLD", "SELL"] as const).map(r => (
          <button
            key={r}
            onClick={() => setFilters(f => ({ ...f, recommendation: f.recommendation === r ? "" : r }))}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              filters.recommendation === r ? REC_COLORS[r] : "border-slate-700 text-slate-500 hover:text-slate-300"
            }`}
          >
            {r}
          </button>
        ))}
        <select
          value={filters.sector}
          onChange={e => setFilters(f => ({ ...f, sector: e.target.value }))}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none"
        >
          <option value="">All Sectors</option>
          {sectors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filters.valuation_verdict}
          onChange={e => setFilters(f => ({ ...f, valuation_verdict: e.target.value }))}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none"
        >
          <option value="">All Valuations</option>
          <option value="UNDERVALUED">Undervalued</option>
          <option value="FAIR">Fair</option>
          <option value="OVERVALUED">Overvalued</option>
        </select>
        {(filters.recommendation || filters.sector || filters.valuation_verdict) && (
          <button
            onClick={() => setFilters({ recommendation: "", sector: "", valuation_verdict: "" })}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id} className="border-b border-slate-800">
                {hg.headers.map(header => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={`px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap bg-slate-900/60 ${
                      header.column.getCanSort() ? "cursor-pointer hover:text-slate-300 select-none" : ""
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" && <ChevronUp size={12} />}
                      {header.column.getIsSorted() === "desc" && <ChevronDown size={12} />}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-16 text-slate-600">
                  <RefreshCw size={20} className="animate-spin mx-auto mb-2" />
                  Loading...
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-16 text-slate-600">
                  No stocks analyzed yet. Enter a ticker above to run the AI analysis.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, i) => (
                <tr
                  key={row.id}
                  className={`border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors ${
                    i % 2 === 0 ? "bg-transparent" : "bg-slate-900/20"
                  }`}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-3 py-3 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-700 mt-3">{stocks.length} stocks in watchlist</p>

      {selectedStock && (
        <AIReportModal ticker={selectedStock} onClose={() => setSelectedStock(null)} />
      )}
    </div>
  );
}

function MarkdownReport({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="text-lg font-bold text-white mt-5 mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-semibold text-slate-100 mt-4 mb-2 border-b border-slate-700 pb-1">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold text-slate-200 mt-3 mb-1">{children}</h3>,
        p: ({ children }) => <p className="text-slate-300 text-sm leading-relaxed mb-3">{children}</p>,
        ul: ({ children }) => <ul className="list-disc list-outside text-slate-300 text-sm mb-3 space-y-1 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-outside text-slate-300 text-sm mb-3 space-y-1 pl-5">{children}</ol>,
        li: ({ children }) => <li className="text-slate-300 text-sm leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
        em: ({ children }) => <em className="text-slate-400 italic">{children}</em>,
        code: ({ children }) => <code className="bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
        blockquote: ({ children }) => <blockquote className="border-l-2 border-[#c9a84c] pl-4 my-3 text-slate-400 italic text-sm">{children}</blockquote>,
        table: ({ children }) => (
          <div className="overflow-x-auto mb-4 rounded-lg border border-slate-700">
            <table className="w-full text-sm border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-slate-800">{children}</thead>,
        tbody: ({ children }) => <tbody className="divide-y divide-slate-700">{children}</tbody>,
        th: ({ children }) => <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">{children}</th>,
        td: ({ children }) => <td className="px-3 py-2 text-slate-300 text-xs">{children}</td>,
        tr: ({ children }) => <tr className="hover:bg-slate-800/40 transition-colors">{children}</tr>,
        hr: () => <hr className="border-slate-700 my-4" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function AIReportModal({ ticker, onClose }: { ticker: string; onClose: () => void }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [activeAgent, setActiveAgent] = useState<string>("Financial Health");
  const [loadErr, setLoadErr] = useState("");

  useEffect(() => {
    getStockAIDetail(ticker)
      .then(d => {
        setData(d);
        const reports = (d.agent_reports as Array<{ agent_name: string; report_markdown: string }>) ?? [];
        const preferred = reports.find(r => r.agent_name === "Financial Health" && r.report_markdown);
        const first = reports.find(r => r.report_markdown);
        setActiveAgent(preferred?.agent_name ?? first?.agent_name ?? "Financial Health");
      })
      .catch(e => setLoadErr(e.message));
  }, [ticker]);

  const REC_COLORS: Record<string, string> = {
    BUY: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    HOLD: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    SELL: "bg-red-500/20 text-red-400 border border-red-500/30",
  };

  if (loadErr) return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0f1629] border border-red-800 rounded-xl p-8 text-red-400 text-sm max-w-md">
        <p className="font-semibold mb-2">No AI analysis found for {ticker}</p>
        <p className="text-slate-500 text-xs mb-4">Run an AI analysis first using the "Run AI Analysis" button.</p>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-sm">Close</button>
      </div>
    </div>
  );

  if (!data) return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <RefreshCw size={24} className="animate-spin text-[#c9a84c]" />
    </div>
  );

  const rec = data.recommendation as string;
  const agentReports = (data.agent_reports as Array<{ agent_name: string; report_markdown: string; key_points: string[] }>) ?? [];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0f1629] border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between p-6 border-b border-slate-700">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-bold text-white">{ticker}</h2>
              {rec && <span className={`px-2.5 py-1 rounded text-sm font-bold ${REC_COLORS[rec] ?? ""}`}>{rec}</span>}
              {data.overall_score != null && (
                <span className="text-slate-400 text-sm">
                  Score: <span className={`font-bold ${(data.overall_score as number) >= 7 ? "text-emerald-400" : (data.overall_score as number) >= 5 ? "text-amber-400" : "text-red-400"}`}>{(data.overall_score as number).toFixed(1)}</span>
                </span>
              )}
            </div>
            <p className="text-slate-500 text-sm">{data.company_name as string} · {data.sector as string}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/stock/${ticker}`} className="text-xs text-[#c9a84c] hover:text-amber-300 border border-[#c9a84c]/30 hover:border-[#c9a84c]/60 px-2 py-1 rounded transition-colors">
              Full Detail →
            </Link>
            <button onClick={onClose} className="text-slate-500 hover:text-white text-xl px-2">✕</button>
          </div>
        </div>

        {!!(data.executive_summary ?? data.summary) && (
          <div className="px-6 py-4 bg-slate-800/30 border-b border-slate-700">
            <p className="text-slate-300 text-sm leading-relaxed">{String(data.executive_summary ?? data.summary ?? "")}</p>
          </div>
        )}

        <div className="flex flex-1 min-h-0">
          <div className="w-48 border-r border-slate-700 p-3 flex flex-col gap-1 overflow-y-auto">
            {agentReports.map(r => (
              <button
                key={r.agent_name}
                onClick={() => setActiveAgent(r.agent_name)}
                className={`text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between gap-1 ${
                  activeAgent === r.agent_name
                    ? "bg-[#c9a84c]/15 text-[#c9a84c] border border-[#c9a84c]/30"
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                }`}
              >
                <span>{r.agent_name}</span>
                {!r.report_markdown && <span className="text-[9px] text-slate-700 shrink-0">—</span>}
              </button>
            ))}
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            {agentReports
              .filter(r => r.agent_name === activeAgent)
              .map(r => (
                <div key={r.agent_name}>
                  {r.key_points?.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {r.key_points.slice(0, 4).map((p, i) => (
                        <span key={i} className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded border border-slate-700 max-w-xs truncate">{p}</span>
                      ))}
                    </div>
                  )}
                  {r.report_markdown
                    ? <MarkdownReport content={r.report_markdown} />
                    : <p className="text-slate-700 italic text-sm mt-6 text-center">No data returned for this agent — check <code className="text-slate-600 text-xs">logs/investai.log</code> for details.</p>
                  }
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
