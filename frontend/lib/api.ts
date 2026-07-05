// In the browser, derive the backend URL from the page's own hostname so
// network access (e.g. http://192.168.x.x:3000) works without rebuilding.
// Falls back to NEXT_PUBLIC_API_URL (build-time) or localhost for SSR.
function getBase(): string {
  if (typeof window !== "undefined") {
    const port = process.env.NEXT_PUBLIC_API_PORT || "8000";
    return `${window.location.protocol}//${window.location.hostname}:${port}/api`;
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
}
const BASE = getBase();

// Optional: matches the backend's INVESTAI_API_KEY, required only for
// analyze/delete. NOTE: NEXT_PUBLIC_ values ship in the browser bundle, so
// this gates casual LAN access — it is not a secret from your page's visitors.
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";
const authHeaders: Record<string, string> = API_KEY ? { "X-API-Key": API_KEY } : {};

async function get(path: string) {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Existing endpoints ──────────────────────────────────────────────────────

export async function analyzeStock(ticker: string) {
  const res = await fetch(`${BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({ ticker }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getWatchlist(filters?: Record<string, string | number>) {
  const params = new URLSearchParams();
  if (filters) Object.entries(filters).forEach(([k, v]) => v !== undefined && params.set(k, String(v)));
  const res = await fetch(`${BASE}/watchlist?${params}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getStockAIDetail(ticker: string) {
  return get(`/stock/${ticker}`);
}

export async function getSectors(): Promise<string[]> {
  const res = await fetch(`${BASE}/sectors`);
  if (!res.ok) return [];
  return res.json();
}

export async function deleteStock(ticker: string) {
  const res = await fetch(`${BASE}/stock/${ticker}`, { method: "DELETE", headers: authHeaders });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── New detail endpoints ──────────────────────────────────────────────────

export async function getMarketOverview() {
  return get("/market/overview");
}

export async function getMarketNews() {
  return get("/market/news");
}

export async function getStockDetail(ticker: string) {
  return get(`/stock/${ticker}/detail`);
}

export async function getStockChart(ticker: string, period = "1Y") {
  return get(`/stock/${ticker}/chart?period=${period}`);
}

export async function getStockFinancials(ticker: string) {
  return get(`/stock/${ticker}/financials`);
}

export async function getStockMetrics(ticker: string) {
  return get(`/stock/${ticker}/metrics`);
}

export async function getStockEarnings(ticker: string) {
  return get(`/stock/${ticker}/earnings`);
}

export async function getStockDividends(ticker: string) {
  return get(`/stock/${ticker}/dividends`);
}

export async function getStockNews(ticker: string) {
  return get(`/stock/${ticker}/news`);
}

export async function getStockValuation(ticker: string) {
  return get(`/stock/${ticker}/valuation`);
}

export async function getStockVMI(ticker: string) {
  return get(`/stock/${ticker}/vmi`);
}

export async function getStockCompareData(ticker: string) {
  return get(`/stock/${ticker}/compare`);
}
