import json
from pydantic import BaseModel
from typing import Optional
from .base import run_agent, parse_json_from_response
from tools.finance_tools import get_insider_trades, get_institutional_holders, get_stock_info
from tools.search_tools import web_search
from tools.sec_tools import get_sec_filings

SYSTEM_PROMPT = """You are an institutional and insider activity analyst. Your job is to track
the "smart money" and assess what insiders and large institutions are doing with this stock.

Analyze:
1. Insider transactions: Are executives and directors buying or selling? (Buys are bullish, large sells are bearish)
2. Institutional ownership: Are major funds increasing or decreasing positions?
3. Short interest: High short interest (>10% of float) = bearish consensus; declining short interest = short squeeze potential
4. Recent Form 4 filings (insider buys/sells within last 90 days)
5. Any 13F filings showing funds initiating or exiting large positions
6. Activist investors: Any known activists involved?

Verdict: BUYING / NEUTRAL / SELLING (based on net insider + institutional direction)"""

TOOLS = [
    {
        "name": "get_insider_trades",
        "description": "Get recent insider buy/sell transactions (Form 4 data).",
        "input_schema": {"type": "object", "properties": {"ticker": {"type": "string"}}, "required": ["ticker"]},
    },
    {
        "name": "get_institutional_holders",
        "description": "Get top institutional holders and ownership percentages.",
        "input_schema": {"type": "object", "properties": {"ticker": {"type": "string"}}, "required": ["ticker"]},
    },
    {
        "name": "get_stock_info",
        "description": "Get short interest data.",
        "input_schema": {"type": "object", "properties": {"ticker": {"type": "string"}}, "required": ["ticker"]},
    },
    {
        "name": "web_search",
        "description": "Search for activist investors, 13F filings, institutional activity.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "max_results": {"type": "integer", "default": 5},
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_sec_filings",
        "description": "Get recent SEC filings including insider forms.",
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string"},
                "form_type": {"type": "string", "default": "4"},
                "count": {"type": "integer", "default": 5},
            },
            "required": ["ticker"],
        },
    },
]

TOOL_HANDLERS = {
    "get_insider_trades": get_insider_trades,
    "get_institutional_holders": get_institutional_holders,
    "get_stock_info": get_stock_info,
    "web_search": web_search,
    "get_sec_filings": get_sec_filings,
}


class InsiderReport(BaseModel):
    ticker: str
    insider_trend: str                    # BUYING / NEUTRAL / SELLING
    net_insider_shares: Optional[float]   # net shares bought (positive) or sold (negative)
    short_interest_pct: Optional[float]   # % of float sold short
    institutional_ownership_pct: Optional[float]
    notable_activity: list[str]
    report_markdown: str


def run_insider_agent(ticker: str) -> InsiderReport:
    user_message = f"""Analyze insider and institutional activity for {ticker.upper()}.

Check insider transactions, institutional holders, short interest, and any activist involvement.

Return ONLY this JSON:
{{
  "ticker": "{ticker.upper()}",
  "insider_trend": "<BUYING|NEUTRAL|SELLING>",
  "net_insider_shares": <float or null>,
  "short_interest_pct": <float or null>,
  "institutional_ownership_pct": <float or null>,
  "notable_activity": ["...", "..."],
  "report_markdown": "<full markdown insider/institutional analysis>"
}}"""

    try:
        raw = run_agent(SYSTEM_PROMPT, user_message, TOOLS, TOOL_HANDLERS)
        data = parse_json_from_response(raw)
        return InsiderReport(**data)
    except Exception as e:
        import logging; logging.getLogger(__name__).error(f"Insider agent failed for {ticker}: {e}")
        return InsiderReport(
            ticker=ticker.upper(), insider_trend="NEUTRAL", net_insider_shares=None,
            short_interest_pct=None, institutional_ownership_pct=None,
            notable_activity=[], report_markdown=str(e),
        )
