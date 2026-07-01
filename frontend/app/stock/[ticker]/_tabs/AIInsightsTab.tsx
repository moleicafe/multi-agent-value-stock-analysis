"use client";
import { useState, useEffect } from "react";
import { getStockAIDetail, analyzeStock } from "@/lib/api";
import { RefreshCw, Brain, Search } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AgentReport {
  agent_name: string;
  report_markdown: string;
  key_points: string[];
}

const AGENT_ORDER = [
  "Financial Health", "Bull Case", "Bear Case", "Valuation", "Technical Analysis",
  "News & Sentiment", "Market & Sector", "Insider & Institutional",
  "Risk Assessment", "ESG", "Macro Environment", "Judge / Synthesis",
];

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

export default function AIInsightsTab({ ticker }: { ticker: string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [activeAgent, setActiveAgent] = useState("Financial Health");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisLog, setAnalysisLog] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getStockAIDetail(ticker)
      .then(d => {
        setData(d);
        const reports = (d.agent_reports as AgentReport[]) ?? [];
        const preferred = reports.find(r => r.agent_name === "Financial Health" && r.report_markdown);
        const first = reports.find(r => r.report_markdown);
        setActiveAgent(preferred?.agent_name ?? first?.agent_name ?? "Financial Health");
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [ticker]);

  async function runAnalysis() {
    setAnalyzing(true);
    setAnalysisLog([]);
    setError("");
    setNotFound(false);
    try {
      const result = await analyzeStock(ticker);
      setAnalysisLog(result.logs?.map((l: { message: string }) => l.message) ?? []);
      const d = await getStockAIDetail(ticker);
      setData(d);
      const reports = (d.agent_reports as AgentReport[]) ?? [];
      const preferred = reports.find(r => r.agent_name === "Financial Health" && r.report_markdown);
      const first = reports.find(r => r.report_markdown);
      setActiveAgent(preferred?.agent_name ?? first?.agent_name ?? "Financial Health");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-600">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading AI analysis…
    </div>
  );

  if (notFound || !data) return (
    <div className="bg-[#0f1628] border border-slate-800 rounded-xl p-8 text-center">
      <Brain className="w-12 h-12 text-slate-700 mx-auto mb-4" />
      <p className="text-slate-300 font-semibold mb-2">No AI analysis found for {ticker}</p>
      <p className="text-slate-500 text-sm mb-6">Run the 12-agent analysis to get comprehensive insights from bull/bear case, financial health, valuation, technical analysis, and more.</p>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {analysisLog.length > 0 && (
        <div className="mb-4 bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-400 font-mono space-y-0.5 max-h-28 overflow-y-auto text-left">
          {analysisLog.map((l, i) => <div key={i}>&gt; {l}</div>)}
        </div>
      )}

      <button
        onClick={runAnalysis}
        disabled={analyzing}
        className="inline-flex items-center gap-2 px-6 py-3 bg-[#c9a84c] hover:bg-amber-400 disabled:opacity-50 text-black font-bold rounded-lg text-sm transition-colors"
      >
        {analyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        {analyzing ? "Running 12-Agent Analysis..." : "Run AI Analysis"}
      </button>

      {analyzing && <p className="text-xs text-slate-600 mt-3">This typically takes 2–3 minutes. All 12 agents run in parallel.</p>}
    </div>
  );

  const agentReports = (data.agent_reports as AgentReport[]) ?? [];
  const sorted = AGENT_ORDER
    .map(name => agentReports.find(r => r.agent_name === name))
    .filter(Boolean) as AgentReport[];
  const extras = agentReports.filter(r => !AGENT_ORDER.includes(r.agent_name));
  const allReports = [...sorted, ...extras];

  const rec = data.recommendation as string;
  const score = data.overall_score as number;

  const REC_COLORS: Record<string, string> = {
    BUY: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    HOLD: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    SELL: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="bg-[#0f1628] border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-3 flex-wrap mb-3">
          {rec && (
            <span className={`px-3 py-1 rounded-lg text-sm font-bold border ${REC_COLORS[rec] ?? ""}`}>{rec}</span>
          )}
          {score != null && (
            <span className={`text-sm font-bold ${score >= 7 ? "text-emerald-400" : score >= 5 ? "text-amber-400" : "text-red-400"}`}>
              Score: {score.toFixed(1)}/10
            </span>
          )}
          <span className="text-xs text-slate-600 ml-auto">
            Analyzed: {data.run_date ? new Date(data.run_date as string).toLocaleDateString() : "unknown"}
          </span>
          <button
            onClick={() => { setNotFound(true); setData(null); }}
            className="text-xs text-slate-600 hover:text-[#c9a84c] transition-colors"
          >
            Re-analyze →
          </button>
        </div>
        {!!(data.executive_summary ?? data.summary) && (
          <p className="text-slate-300 text-sm leading-relaxed">{String(data.executive_summary ?? data.summary ?? "")}</p>
        )}
      </div>

      {/* Two-pane layout: tab sidebar + content */}
      <div className="flex gap-4 min-h-[500px]">
        <div className="w-48 shrink-0 flex flex-col gap-1">
          {allReports.map(r => (
            <button
              key={r.agent_name}
              onClick={() => setActiveAgent(r.agent_name)}
              className={`text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between gap-1 ${
                activeAgent === r.agent_name
                  ? "bg-[#c9a84c]/15 text-[#c9a84c] border border-[#c9a84c]/30"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-800 border border-transparent"
              }`}
            >
              <span>{r.agent_name}</span>
              {!r.report_markdown && <span className="text-[9px] text-slate-700">—</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-[#0f1628] border border-slate-800 rounded-xl p-6 overflow-y-auto max-h-[700px]">
          {allReports
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
                  : <p className="text-slate-700 italic text-sm mt-6 text-center">No data returned for this agent — check logs/investai.log</p>
                }
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
