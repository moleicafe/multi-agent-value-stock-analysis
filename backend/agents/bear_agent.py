import json
from pydantic import BaseModel
from typing import Optional
from .base import run_agent, parse_json_from_response
from tools.finance_tools import get_stock_info, get_key_metrics
from tools.search_tools import web_search_deep
from tools.news_tools import get_stock_news

SYSTEM_PROMPT = """You are a bearish equity analyst and short-seller. Your job is to identify every compelling
reason to SELL or AVOID this stock. Be rigorous, skeptical, and thorough.

Look for:
- Valuation concerns (overpriced vs growth, high P/E, high EV/EBITDA)
- Slowing revenue or earnings growth
- Margin compression trends
- Competitive threats and market share erosion
- Regulatory, legal, or geopolitical risks
- Heavy insider selling or institutional exits
- High short interest (smart money betting against)
- Balance sheet weaknesses (high debt, low cash)
- Macro headwinds for the sector
- Management credibility issues
- Earnings misses or guidance cuts
- Technology disruption risk

Be specific with numbers. Build the strongest honest bear case."""

TOOLS = [
    {
        "name": "get_stock_info",
        "description": "Get stock info, valuation ratios, short interest.",
        "input_schema": {"type": "object", "properties": {"ticker": {"type": "string"}}, "required": ["ticker"]},
    },
    {
        "name": "get_key_metrics",
        "description": "Get growth rates, margins, debt ratios.",
        "input_schema": {"type": "object", "properties": {"ticker": {"type": "string"}}, "required": ["ticker"]},
    },
    {
        "name": "get_stock_news",
        "description": "Get recent news that may reveal risks or negative developments.",
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string"},
                "company_name": {"type": "string", "default": ""},
                "days": {"type": "integer", "default": 30},
                "max_articles": {"type": "integer", "default": 15},
            },
            "required": ["ticker"],
        },
    },
    {
        "name": "web_search_deep",
        "description": "Search for bear case, risks, lawsuits, competition, short seller reports.",
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
    "get_stock_news": get_stock_news,
    "web_search_deep": web_search_deep,
}


class BearReport(BaseModel):
    ticker: str
    bear_score: float                  # 1–10, how strong is the bear case
    valuation_risk: str                # HIGH / MEDIUM / LOW
    competitive_threat: str            # HIGH / MEDIUM / LOW
    key_risks: list[str]
    red_flags: list[str]
    downside_risk: Optional[str]       # e.g. "20-30% downside"
    report_markdown: str


def run_bear_agent(ticker: str) -> BearReport:
    user_message = f"""Build the strongest bear case for {ticker.upper()}.

Use tools to identify risks, competitive threats, valuation concerns, and negative news.
Search the web for short seller reports, analyst downgrades, lawsuits, regulatory issues.

Return ONLY this JSON:
{{
  "ticker": "{ticker.upper()}",
  "bear_score": <float 1-10>,
  "valuation_risk": "<HIGH|MEDIUM|LOW>",
  "competitive_threat": "<HIGH|MEDIUM|LOW>",
  "key_risks": ["...", "..."],
  "red_flags": ["...", "..."],
  "downside_risk": "<string or null>",
  "report_markdown": "<full markdown bear case>"
}}"""

    try:
        raw = run_agent(SYSTEM_PROMPT, user_message, TOOLS, TOOL_HANDLERS)
        data = parse_json_from_response(raw)
        return BearReport(**data)
    except Exception as e:
        import logging; logging.getLogger(__name__).error(f"Bear agent failed for {ticker}: {e}")
        return BearReport(
            ticker=ticker.upper(), bear_score=5.0, valuation_risk="MEDIUM",
            competitive_threat="MEDIUM", key_risks=[], red_flags=[],
            downside_risk=None, report_markdown=str(e),
        )
