import json
from pydantic import BaseModel
from typing import Optional
from .base import run_agent, parse_json_from_response
from tools.finance_tools import get_stock_info, get_key_metrics, get_analyst_ratings, get_earnings_history
from tools.search_tools import web_search_deep

SYSTEM_PROMPT = """You are a bullish equity analyst building the strongest possible investment case for a stock.
Your job is to identify and articulate ALL compelling reasons to BUY this stock.

Look for:
- Revenue and earnings growth trajectory
- Competitive moat (brand, network effects, switching costs, cost advantages, patents)
- Total addressable market (TAM) expansion opportunities
- New products, services, or markets being entered
- Management quality and track record
- Strong analyst consensus or recent upgrades
- Catalysts: upcoming earnings, product launches, macro tailwinds
- Undervaluation relative to growth (PEG ratio, forward P/E)
- Capital return (buybacks, dividends)
- Earnings beat history

Be specific with numbers. Build the strongest honest bull case."""

TOOLS = [
    {
        "name": "get_stock_info",
        "description": "Get stock info, valuation ratios, analyst target price and recommendation.",
        "input_schema": {"type": "object", "properties": {"ticker": {"type": "string"}}, "required": ["ticker"]},
    },
    {
        "name": "get_key_metrics",
        "description": "Get growth rates, margins, ROE, ROA.",
        "input_schema": {"type": "object", "properties": {"ticker": {"type": "string"}}, "required": ["ticker"]},
    },
    {
        "name": "get_analyst_ratings",
        "description": "Get analyst price targets and recommendation consensus.",
        "input_schema": {"type": "object", "properties": {"ticker": {"type": "string"}}, "required": ["ticker"]},
    },
    {
        "name": "get_earnings_history",
        "description": "Get EPS estimates vs actuals to see earnings beat/miss history.",
        "input_schema": {"type": "object", "properties": {"ticker": {"type": "string"}}, "required": ["ticker"]},
    },
    {
        "name": "web_search_deep",
        "description": "Search the web for bull case, growth catalysts, competitive advantages.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "max_results": {"type": "integer", "default": 6},
            },
            "required": ["query"],
        },
    },
]

TOOL_HANDLERS = {
    "get_stock_info": get_stock_info,
    "get_key_metrics": get_key_metrics,
    "get_analyst_ratings": get_analyst_ratings,
    "get_earnings_history": get_earnings_history,
    "web_search_deep": web_search_deep,
}


class BullReport(BaseModel):
    ticker: str
    bull_score: float                  # 1–10, how strong is the bull case
    moat_strength: str                 # WIDE / NARROW / NONE
    growth_outlook: str                # STRONG / MODERATE / WEAK
    key_catalysts: list[str]
    competitive_advantages: list[str]
    upside_potential: Optional[float]  # % upside to analyst target
    report_markdown: str


def run_bull_agent(ticker: str) -> BullReport:
    user_message = f"""Build the strongest bull case for {ticker.upper()}.

Use tools to gather data on growth, competitive advantages, analyst targets, earnings history, and upcoming catalysts.
Search the web for recent bull thesis, growth drivers, and positive developments.

Return ONLY this JSON:
{{
  "ticker": "{ticker.upper()}",
  "bull_score": <float 1-10>,
  "moat_strength": "<WIDE|NARROW|NONE>",
  "growth_outlook": "<STRONG|MODERATE|WEAK>",
  "key_catalysts": ["...", "..."],
  "competitive_advantages": ["...", "..."],
  "upside_potential": <float % or null>,
  "report_markdown": "<full markdown bull case>"
}}"""

    try:
        raw = run_agent(SYSTEM_PROMPT, user_message, TOOLS, TOOL_HANDLERS)
        data = parse_json_from_response(raw)
        return BullReport(**data)
    except Exception as e:
        import logging; logging.getLogger(__name__).error(f"Bull agent failed for {ticker}: {e}")
        return BullReport(
            ticker=ticker.upper(), bull_score=5.0, moat_strength="NARROW",
            growth_outlook="MODERATE", key_catalysts=[], competitive_advantages=[],
            upside_potential=None, report_markdown=getattr(e, '__context__', None) and str(e) or str(e),
        )
