import json
from pydantic import BaseModel
from typing import Optional
from .base import run_agent, parse_json_from_response
from tools.finance_tools import get_stock_info, get_key_metrics, get_cash_flow
from tools.search_tools import web_search

SYSTEM_PROMPT = """You are a valuation specialist. Your job is to determine whether a stock is
undervalued, fairly valued, or overvalued using multiple valuation methods.

Methods to apply:
1. Relative valuation: P/E vs sector average, P/E vs 5-year historical, PEG ratio, EV/EBITDA vs peers
2. Price-to-growth: Is the P/E justified by the growth rate? (PEG < 1 = potentially undervalued)
3. Price-to-book and Price-to-sales vs sector
4. Analyst consensus: current price vs mean target price (upside/downside %)
5. DCF rough estimate: use FCF, estimate 5-year growth, discount at 10% WACC
6. Dividend yield vs historical if applicable

Conclude with a clear verdict: UNDERVALUED / FAIR / OVERVALUED and by roughly how much (%)."""

TOOLS = [
    {
        "name": "get_stock_info",
        "description": "Get current price, P/E, forward P/E, PEG, P/B, P/S, EV/EBITDA, analyst targets.",
        "input_schema": {"type": "object", "properties": {"ticker": {"type": "string"}}, "required": ["ticker"]},
    },
    {
        "name": "get_key_metrics",
        "description": "Get growth rates, FCF, margins for DCF inputs.",
        "input_schema": {"type": "object", "properties": {"ticker": {"type": "string"}}, "required": ["ticker"]},
    },
    {
        "name": "get_cash_flow",
        "description": "Get free cash flow history for DCF analysis.",
        "input_schema": {"type": "object", "properties": {"ticker": {"type": "string"}}, "required": ["ticker"]},
    },
    {
        "name": "web_search",
        "description": "Search for sector average P/E, peer comparison, valuation analysis.",
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
    "get_stock_info": get_stock_info,
    "get_key_metrics": get_key_metrics,
    "get_cash_flow": get_cash_flow,
    "web_search": web_search,
}


class ValuationReport(BaseModel):
    ticker: str
    verdict: str                          # UNDERVALUED / FAIR / OVERVALUED
    estimated_fair_value: Optional[float] # estimated intrinsic value per share
    current_price: Optional[float]
    upside_downside_pct: Optional[float]  # positive = upside, negative = downside
    pe_ratio: Optional[float]
    sector_avg_pe: Optional[float]
    peg_ratio: Optional[float]
    ev_to_ebitda: Optional[float]
    dcf_estimate: Optional[float]
    report_markdown: str


def run_valuation_agent(ticker: str) -> ValuationReport:
    user_message = f"""Perform a comprehensive valuation analysis of {ticker.upper()}.

Use tools to get current valuation ratios, FCF, growth rates, and analyst targets.
Search for sector average P/E and comparable company multiples.
Run a rough DCF and compare all methods.

Return ONLY this JSON:
{{
  "ticker": "{ticker.upper()}",
  "verdict": "<UNDERVALUED|FAIR|OVERVALUED>",
  "estimated_fair_value": <float or null>,
  "current_price": <float or null>,
  "upside_downside_pct": <float or null>,
  "pe_ratio": <float or null>,
  "sector_avg_pe": <float or null>,
  "peg_ratio": <float or null>,
  "ev_to_ebitda": <float or null>,
  "dcf_estimate": <float or null>,
  "report_markdown": "<full markdown valuation analysis>"
}}"""

    try:
        raw = run_agent(SYSTEM_PROMPT, user_message, TOOLS, TOOL_HANDLERS)
        data = parse_json_from_response(raw)
        return ValuationReport(**data)
    except Exception as e:
        import logging; logging.getLogger(__name__).error(f"Valuation agent failed for {ticker}: {e}")
        return ValuationReport(
            ticker=ticker.upper(), verdict="FAIR", estimated_fair_value=None,
            current_price=None, upside_downside_pct=None, pe_ratio=None,
            sector_avg_pe=None, peg_ratio=None, ev_to_ebitda=None,
            dcf_estimate=None, report_markdown=str(e),
        )
