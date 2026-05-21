import json
import math
from pydantic import BaseModel
from typing import Optional
from .base import run_agent, parse_json_from_response
from tools.finance_tools import get_price_history, get_stock_info, get_options_data

SYSTEM_PROMPT = """You are a technical analyst. Analyze price action, momentum, and market structure
to assess the stock's technical setup. You will receive raw OHLCV data and must compute indicators.

Compute and interpret:
1. RSI (14-period): >70 overbought, <30 oversold
2. 50-day and 200-day simple moving averages (SMA) — golden cross / death cross
3. Price vs 52-week high and low (% from each)
4. Recent trend (last 30 days: up/down/sideways)
5. Volume trend (increasing/decreasing on up days)
6. Support and resistance levels
7. Put/call ratio if options data available (>1.2 bearish, <0.7 bullish)

Give a clear technical verdict: BULLISH / NEUTRAL / BEARISH setup."""

TOOLS = [
    {
        "name": "get_price_history",
        "description": "Get OHLCV price history. Use period='1y' for full year of data.",
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string"},
                "period": {"type": "string", "default": "1y"},
            },
            "required": ["ticker"],
        },
    },
    {
        "name": "get_stock_info",
        "description": "Get 52-week high/low, beta, current price.",
        "input_schema": {"type": "object", "properties": {"ticker": {"type": "string"}}, "required": ["ticker"]},
    },
    {
        "name": "get_options_data",
        "description": "Get put/call ratio from options market.",
        "input_schema": {"type": "object", "properties": {"ticker": {"type": "string"}}, "required": ["ticker"]},
    },
]

TOOL_HANDLERS = {
    "get_price_history": get_price_history,
    "get_stock_info": get_stock_info,
    "get_options_data": get_options_data,
}


class TechnicalReport(BaseModel):
    ticker: str
    verdict: str                         # BULLISH / NEUTRAL / BEARISH
    rsi: Optional[float]
    ma_50: Optional[float]
    ma_200: Optional[float]
    golden_cross: Optional[bool]         # 50MA > 200MA
    price_vs_52w_high_pct: Optional[float]
    price_vs_52w_low_pct: Optional[float]
    trend_30d: str                       # UPTREND / DOWNTREND / SIDEWAYS
    support_level: Optional[float]
    resistance_level: Optional[float]
    put_call_ratio: Optional[float]
    report_markdown: str


def run_technical_agent(ticker: str) -> TechnicalReport:
    user_message = f"""Perform a technical analysis of {ticker.upper()}.

Fetch 1 year of price history and compute RSI, 50-day SMA, 200-day SMA.
Get the 52-week high/low from stock info.
Check the options put/call ratio.

Return ONLY this JSON:
{{
  "ticker": "{ticker.upper()}",
  "verdict": "<BULLISH|NEUTRAL|BEARISH>",
  "rsi": <float or null>,
  "ma_50": <float or null>,
  "ma_200": <float or null>,
  "golden_cross": <true|false|null>,
  "price_vs_52w_high_pct": <float — % below 52w high, negative means below>,
  "price_vs_52w_low_pct": <float — % above 52w low>,
  "trend_30d": "<UPTREND|DOWNTREND|SIDEWAYS>",
  "support_level": <float or null>,
  "resistance_level": <float or null>,
  "put_call_ratio": <float or null>,
  "report_markdown": "<full markdown technical analysis>"
}}"""

    try:
        raw = run_agent(SYSTEM_PROMPT, user_message, TOOLS, TOOL_HANDLERS)
        data = parse_json_from_response(raw)
        return TechnicalReport(**data)
    except Exception as e:
        import logging; logging.getLogger(__name__).error(f"Technical agent failed for {ticker}: {e}")
        return TechnicalReport(
            ticker=ticker.upper(), verdict="NEUTRAL", rsi=None, ma_50=None,
            ma_200=None, golden_cross=None, price_vs_52w_high_pct=None,
            price_vs_52w_low_pct=None, trend_30d="SIDEWAYS", support_level=None,
            resistance_level=None, put_call_ratio=None, report_markdown=str(e),
        )
