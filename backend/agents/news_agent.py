import json
from pydantic import BaseModel
from typing import Optional
from .base import run_agent, parse_json_from_response
from tools.news_tools import get_stock_news, get_market_news
from tools.search_tools import web_search
from tools.finance_tools import get_stock_info

SYSTEM_PROMPT = """You are a news and sentiment analyst specializing in equity research.
Your job is to analyze recent news coverage of a stock and assess:

1. Overall sentiment of recent news (very positive / positive / neutral / negative / very negative)
2. Key events in the last 30 days (earnings, product launches, partnerships, lawsuits, CEO changes)
3. Media narrative — what story is the press telling about this company?
4. Any upcoming events that could be catalysts (earnings date, product launches, FDA decisions, etc.)
5. Macro news that affects this specific company/sector
6. Social sentiment signals if available

Assign a sentiment score from -1.0 (very negative) to +1.0 (very positive)."""

TOOLS = [
    {
        "name": "get_stock_news",
        "description": "Get recent news articles about the stock.",
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string"},
                "company_name": {"type": "string", "default": ""},
                "days": {"type": "integer", "default": 30},
                "max_articles": {"type": "integer", "default": 20},
            },
            "required": ["ticker"],
        },
    },
    {
        "name": "get_market_news",
        "description": "Get macro/market news relevant to the sector.",
        "input_schema": {
            "type": "object",
            "properties": {
                "topic": {"type": "string", "default": "stock market"},
                "days": {"type": "integer", "default": 7},
                "max_articles": {"type": "integer", "default": 10},
            },
        },
    },
    {
        "name": "get_stock_info",
        "description": "Get company name and sector for context.",
        "input_schema": {"type": "object", "properties": {"ticker": {"type": "string"}}, "required": ["ticker"]},
    },
    {
        "name": "web_search",
        "description": "Search for specific news, events, or upcoming catalysts.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "max_results": {"type": "integer", "default": 5},
            },
            "required": ["query"],
        },
    },
]

TOOL_HANDLERS = {
    "get_stock_news": get_stock_news,
    "get_market_news": get_market_news,
    "get_stock_info": get_stock_info,
    "web_search": web_search,
}


class NewsReport(BaseModel):
    ticker: str
    sentiment_score: float             # -1.0 to 1.0
    sentiment_label: str               # VERY_POSITIVE / POSITIVE / NEUTRAL / NEGATIVE / VERY_NEGATIVE
    key_events: list[str]
    upcoming_catalysts: list[str]
    media_narrative: str               # 1-2 sentence summary of the overall story
    report_markdown: str


def run_news_agent(ticker: str) -> NewsReport:
    user_message = f"""Analyze the news sentiment and recent developments for {ticker.upper()}.

Fetch recent news articles, search for key events and upcoming catalysts.
Look at macro news relevant to this company's sector.

Return ONLY this JSON:
{{
  "ticker": "{ticker.upper()}",
  "sentiment_score": <float -1.0 to 1.0>,
  "sentiment_label": "<VERY_POSITIVE|POSITIVE|NEUTRAL|NEGATIVE|VERY_NEGATIVE>",
  "key_events": ["...", "..."],
  "upcoming_catalysts": ["...", "..."],
  "media_narrative": "<1-2 sentence summary>",
  "report_markdown": "<full markdown news analysis>"
}}"""

    try:
        raw = run_agent(SYSTEM_PROMPT, user_message, TOOLS, TOOL_HANDLERS)
        data = parse_json_from_response(raw)
        return NewsReport(**data)
    except Exception as e:
        import logging; logging.getLogger(__name__).error(f"News agent failed for {ticker}: {e}")
        return NewsReport(
            ticker=ticker.upper(), sentiment_score=0.0, sentiment_label="NEUTRAL",
            key_events=[], upcoming_catalysts=[], media_narrative="",
            report_markdown=str(e),
        )
