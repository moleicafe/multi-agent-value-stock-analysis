import json
from pydantic import BaseModel
from .base import run_agent, parse_json_from_response
from tools.finance_tools import get_stock_info
from tools.search_tools import web_search_deep
from tools.news_tools import get_market_news

SYSTEM_PROMPT = """You are a macro economist and top-down equity analyst.
Your job is to assess how the current macroeconomic environment affects this specific stock.

Analyze:
1. Interest rate environment: How does the Fed rate cycle affect this company's valuation and operations?
2. Inflation impact: Is this company a price maker or taker? Can it pass on costs?
3. GDP growth: Is this stock cyclical or defensive? How does a slowdown affect it?
4. Dollar strength: Does this company have significant international revenue? FX impact?
5. Commodity prices: Does this company use oil, metals, or agricultural inputs?
6. Consumer spending trends: For consumer-facing companies — are consumers strong or stretched?
7. Credit conditions: Can this company refinance debt easily? Credit spread environment?
8. Geopolitical risks: China exposure, Russia/Ukraine, Middle East, tariffs, trade wars?
9. Current economic cycle position: Early/mid/late cycle — which sectors outperform?

Give a macro verdict for this specific stock: TAILWIND / NEUTRAL / HEADWIND"""

TOOLS = [
    {
        "name": "get_stock_info",
        "description": "Get sector, country, beta to understand macro sensitivity.",
        "input_schema": {"type": "object", "properties": {"ticker": {"type": "string"}}, "required": ["ticker"]},
    },
    {
        "name": "web_search_deep",
        "description": "Research current macro environment and sector-specific macro impacts.",
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
        "description": "Get current macro/economic news.",
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


class MacroReport(BaseModel):
    ticker: str
    macro_verdict: str             # TAILWIND / NEUTRAL / HEADWIND
    rate_sensitivity: str          # HIGH / MEDIUM / LOW (how much does rate change matter?)
    cyclicality: str               # CYCLICAL / DEFENSIVE / GROWTH
    fx_exposure: str               # HIGH / MEDIUM / LOW
    key_macro_factors: list[str]
    report_markdown: str


def run_macro_agent(ticker: str) -> MacroReport:
    user_message = f"""Analyze how the current macroeconomic environment affects {ticker.upper()}.

Research interest rates, inflation, GDP, FX, geopolitics, and commodity prices as they relate to this company.

Return ONLY this JSON:
{{
  "ticker": "{ticker.upper()}",
  "macro_verdict": "<TAILWIND|NEUTRAL|HEADWIND>",
  "rate_sensitivity": "<HIGH|MEDIUM|LOW>",
  "cyclicality": "<CYCLICAL|DEFENSIVE|GROWTH>",
  "fx_exposure": "<HIGH|MEDIUM|LOW>",
  "key_macro_factors": ["...", "..."],
  "report_markdown": "<full markdown macro analysis>"
}}"""

    try:
        raw = run_agent(SYSTEM_PROMPT, user_message, TOOLS, TOOL_HANDLERS)
        data = parse_json_from_response(raw)
        return MacroReport(**data)
    except Exception as e:
        import logging; logging.getLogger(__name__).error(f"Macro agent failed for {ticker}: {e}")
        return MacroReport(
            ticker=ticker.upper(), macro_verdict="NEUTRAL", rate_sensitivity="MEDIUM",
            cyclicality="GROWTH", fx_exposure="MEDIUM",
            key_macro_factors=[], report_markdown=str(e),
        )
