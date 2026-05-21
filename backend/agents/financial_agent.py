import logging
from pydantic import BaseModel
from typing import Optional
from .base import run_agent, parse_json_from_response
from tools.finance_tools import (
    get_stock_info, get_income_statement, get_balance_sheet,
    get_cash_flow, get_key_metrics,
)

SYSTEM_PROMPT = """You are a professional financial analyst. Your job is to deeply analyze a company's
financial health using real financial data. You have access to tools to fetch income statements,
balance sheets, cash flows, and key metrics.

Analyze the data thoroughly and produce a structured report covering:
1. Revenue trend and growth rate
2. Profitability (gross, operating, net margins) and trend
3. Balance sheet strength (debt levels, liquidity ratios)
4. Cash flow quality (is FCF positive? growing?)
5. Return metrics (ROE, ROA)
6. Key financial risks or red flags
7. Overall financial health score (1-10) with justification

Be specific — cite actual numbers. Your final output must be valid JSON matching the schema provided."""

TOOLS = [
    {
        "name": "get_stock_info",
        "description": "Get basic stock info, current price, valuation ratios, and analyst ratings.",
        "input_schema": {
            "type": "object",
            "properties": {"ticker": {"type": "string", "description": "Stock ticker symbol e.g. AAPL"}},
            "required": ["ticker"],
        },
    },
    {
        "name": "get_income_statement",
        "description": "Get annual income statement: revenue, gross profit, operating income, net income.",
        "input_schema": {
            "type": "object",
            "properties": {"ticker": {"type": "string"}},
            "required": ["ticker"],
        },
    },
    {
        "name": "get_balance_sheet",
        "description": "Get annual balance sheet: total assets, liabilities, equity, cash, debt.",
        "input_schema": {
            "type": "object",
            "properties": {"ticker": {"type": "string"}},
            "required": ["ticker"],
        },
    },
    {
        "name": "get_cash_flow",
        "description": "Get annual cash flow statement: operating, investing, financing, free cash flow.",
        "input_schema": {
            "type": "object",
            "properties": {"ticker": {"type": "string"}},
            "required": ["ticker"],
        },
    },
    {
        "name": "get_key_metrics",
        "description": "Get key derived metrics: margins, ROE, ROA, debt/equity, current ratio.",
        "input_schema": {
            "type": "object",
            "properties": {"ticker": {"type": "string"}},
            "required": ["ticker"],
        },
    },
]

TOOL_HANDLERS = {
    "get_stock_info": get_stock_info,
    "get_income_statement": get_income_statement,
    "get_balance_sheet": get_balance_sheet,
    "get_cash_flow": get_cash_flow,
    "get_key_metrics": get_key_metrics,
}


class FinancialReport(BaseModel):
    ticker: str
    health_score: float                    # 1–10
    revenue_trend: str                     # GROWING / FLAT / DECLINING
    revenue_growth_yoy: Optional[float]
    gross_margin: Optional[float]
    operating_margin: Optional[float]
    net_margin: Optional[float]
    roe: Optional[float]
    roa: Optional[float]
    debt_to_equity: Optional[float]
    current_ratio: Optional[float]
    fcf_positive: Optional[bool]
    key_strengths: list[str]
    key_risks: list[str]
    report_markdown: str


def run_financial_agent(ticker: str) -> FinancialReport:
    user_message = f"""Analyze the financial health of {ticker.upper()}.

Use the available tools to fetch the income statement, balance sheet, cash flow statement,
and key metrics. Then return a JSON object with this exact structure:

{{
  "ticker": "{ticker.upper()}",
  "health_score": <float 1-10>,
  "revenue_trend": "<GROWING|FLAT|DECLINING>",
  "revenue_growth_yoy": <float or null>,
  "gross_margin": <float or null>,
  "operating_margin": <float or null>,
  "net_margin": <float or null>,
  "roe": <float or null>,
  "roa": <float or null>,
  "debt_to_equity": <float or null>,
  "current_ratio": <float or null>,
  "fcf_positive": <true|false|null>,
  "key_strengths": ["...", "..."],
  "key_risks": ["...", "..."],
  "report_markdown": "<full markdown analysis>"
}}

Return ONLY the JSON object, no other text."""

    try:
        raw = run_agent(
            system_prompt=SYSTEM_PROMPT,
            user_message=user_message,
            tools=TOOLS,
            tool_handlers=TOOL_HANDLERS,
        )
        data = parse_json_from_response(raw)
        return FinancialReport(**data)
    except Exception as e:
        logging.getLogger(__name__).error(f"Financial agent failed for {ticker}: {e}")
        raw_text = locals().get("raw", str(e))
        return FinancialReport(
            ticker=ticker.upper(),
            health_score=5.0,
            revenue_trend="FLAT",
            revenue_growth_yoy=None,
            gross_margin=None,
            operating_margin=None,
            net_margin=None,
            roe=None,
            roa=None,
            debt_to_equity=None,
            current_ratio=None,
            fcf_positive=None,
            key_strengths=[],
            key_risks=[f"Error: {str(e)}"],
            report_markdown=raw_text,
        )
