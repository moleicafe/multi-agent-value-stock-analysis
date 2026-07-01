"use client";
import { useState, useEffect } from "react";
import { getStockNews } from "@/lib/api";
import { RefreshCw, ExternalLink } from "lucide-react";

interface Article {
  title: string;
  source: string;
  url: string;
  published_at: string;
  description?: string;
  urlToImage?: string;
}

export default function NewsTab({ ticker }: { ticker: string }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStockNews(ticker)
      .then(data => setArticles(Array.isArray(data) ? data : (data?.articles ?? [])))
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-600">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading news…
    </div>
  );

  if (!articles.length) return (
    <div className="bg-[#0f1628] border border-slate-800 rounded-xl p-8 text-center text-slate-600 text-sm">
      No recent news found for {ticker}. Check that NEWS_API_KEY is set.
    </div>
  );

  return (
    <div className="space-y-3">
      {articles.map((a, i) => (
        <a
          key={i}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-[#0f1628] border border-slate-800 rounded-xl p-4 hover:border-slate-600 hover:bg-slate-800/20 transition-colors group"
        >
          <div className="flex gap-4">
            {a.urlToImage && (
              <img
                src={a.urlToImage}
                alt=""
                className="w-20 h-16 object-cover rounded-lg shrink-0 bg-slate-800"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 group-hover:text-white line-clamp-2 leading-snug mb-1.5">
                {a.title}
              </p>
              {a.description && (
                <p className="text-xs text-slate-500 line-clamp-2 mb-1.5">{a.description}</p>
              )}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-[#c9a84c]">{a.source}</span>
                {a.published_at && (
                  <span className="text-xs text-slate-600">
                    {new Date(a.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                )}
                <ExternalLink className="w-3 h-3 text-slate-700 group-hover:text-slate-500 ml-auto shrink-0" />
              </div>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
