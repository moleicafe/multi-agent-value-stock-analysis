import json
from pydantic import BaseModel
from .base import run_agent, parse_json_from_response
from tools.finance_tools import get_stock_info
from tools.search_tools import web_search_deep
from tools.news_tools import get_market_news

SYSTEM_PROMPT = """You are a market and sector research analyst. Your job is to analyze
the broader market context for a specific stock:

1. Sector analysis: Is this sector in favor or out of favor with investors?
2. Industry trends: What macro and structural trends are driving this industry?
3. Competitive landscape: Who are the main competitors and how does this company compare?
4. Market share: Is this company gaining or losing market share?
5. TAM (Total Addressable Market): How large is the opportunity and what % does the company have?
6. Macro tailwinds and headwinds: interest rates, inflation, FX, regulation, geopolitics
7. Analyst sector outlook: what do top analysts think about this sector?

Give an overall market position verdict: LEADER / STRONG_COMPETITOR / AVERAGE / LAGGARD"""

TOOLS = [
    {
        "name": "get_stock_info",
        "description": "Get sector, industry, and company description.",
        "input_schema": {"type": "object", "properties": {"ticker": {"type": "string"}}, "required": ["ticker"]},
    },
    {
        "name": "web_search_deep",
        "description": "Research sector trends, competitors, market share, TAM.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "max_results": {"type": "integer", "default": 6},
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_market_news",
        "description": "Get macro and sector news.",
        "input_schema": {
            "type": "object",
            "properties": {
                "topic": {"type": "string"},
                "days": {"type": "integer", "default": 14},
                "max_articles": {"type": "integer", "default": 10},
            },
        },
    },
]

TOOL_HANDLERS = {
    "get_stock_info": get_stock_info,
    "web_search_deep": web_search_deep,
    "get_market_news": get_market_news,
}


class MarketReport(BaseModel):
    ticker: str
    market_position: str               # LEADER / STRONG_COMPETITOR / AVERAGE / LAGGARD
    sector_outlook: str                # BULLISH / NEUTRAL / BEARISH
    main_competitors: list[str]
    market_share_trend: str            # GAINING / STABLE / LOSING
    key_tailwinds: list[str]
    key_headwinds: list[str]
    report_markdown: str


def run_market_agent(ticker: str) -> MarketReport:
    user_message = f"""Analyze the market and competitive position of {ticker.upper()}.

Research the sector, competitors, market share trends, TAM, and macro factors.

Return ONLY this JSON:
{{
  "ticker": "{ticker.upper()}",
  "market_position": "<LEADER|STRONG_COMPETITOR|AVERAGE|LAGGARD>",
  "sector_outlook": "<BULLISH|NEUTRAL|BEARISH>",
  "main_competitors": ["...", "..."],
  "market_share_trend": "<GAINING|STABLE|LOSING>",
  "key_tailwinds": ["...", "..."],
  "key_headwinds": ["...", "..."],
  "report_markdown": "<full markdown market analysis>"
}}"""

    try:
        raw = run_agent(SYSTEM_PROMPT, user_message, TOOLS, TOOL_HANDLERS)
        data = parse_json_from_response(raw)
        return MarketReport(**data)
    except Exception as e:
        import logging; logging.getLogger(__name__).error(f"Market agent failed for {ticker}: {e}")
        return MarketReport(
            ticker=ticker.upper(), market_position="AVERAGE", sector_outlook="NEUTRAL",
            main_competitors=[], market_share_trend="STABLE",
            key_tailwinds=[], key_headwinds=[], report_markdown=str(e),
        )
