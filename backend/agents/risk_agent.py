import json
from pydantic import BaseModel
from .base import run_agent, parse_json_from_response
from tools.finance_tools import get_stock_info, get_key_metrics, get_balance_sheet
from tools.search_tools import web_search_deep
from tools.sec_tools import get_sec_filings

SYSTEM_PROMPT = """You are a risk analyst specializing in equity investment risk assessment.
Your job is to identify, categorize, and rate ALL material risks for this stock.

Categories to cover:
1. Business risks: customer concentration, product obsolescence, supply chain
2. Financial risks: high debt, negative FCF, covenant breaches, refinancing risk
3. Regulatory/legal: antitrust, lawsuits, compliance, data privacy, FDA approval risk
4. Geopolitical: tariffs, sanctions, country exposure, currency risk
5. Management/governance: key person risk, compensation concerns, board independence
6. Macro risks: interest rate sensitivity, inflation impact, recession vulnerability
7. ESG risks: environmental liabilities, social controversies, governance issues
8. Technology disruption: is a competitor or new tech threatening the business model?

Rate each risk: HIGH / MEDIUM / LOW
Give an overall risk rating: HIGH / MEDIUM / LOW"""

TOOLS = [
    {
        "name": "get_stock_info",
        "description": "Get company info, sector, beta (market risk proxy).",
        "input_schema": {"type": "object", "properties": {"ticker": {"type": "string"}}, "required": ["ticker"]},
    },
    {
        "name": "get_key_metrics",
        "description": "Get debt levels, current ratio for financial risk assessment.",
        "input_schema": {"type": "object", "properties": {"ticker": {"type": "string"}}, "required": ["ticker"]},
    },
    {
        "name": "get_balance_sheet",
        "description": "Get balance sheet for detailed debt and liquidity analysis.",
        "input_schema": {"type": "object", "properties": {"ticker": {"type": "string"}}, "required": ["ticker"]},
    },
    {
        "name": "web_search_deep",
        "description": "Search for lawsuits, regulatory issues, controversies, risk factors.",
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
        "name": "get_sec_filings",
        "description": "Fetch 10-K filing where risk factors are disclosed.",
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string"},
                "form_type": {"type": "string", "default": "10-K"},
                "count": {"type": "integer", "default": 1},
            },
            "required": ["ticker"],
        },
    },
]

TOOL_HANDLERS = {
    "get_stock_info": get_stock_info,
    "get_key_metrics": get_key_metrics,
    "get_balance_sheet": get_balance_sheet,
    "web_search_deep": web_search_deep,
    "get_sec_filings": get_sec_filings,
}


class RiskReport(BaseModel):
    ticker: str
    overall_risk: str              # HIGH / MEDIUM / LOW
    business_risk: str
    financial_risk: str
    regulatory_risk: str
    macro_risk: str
    top_risks: list[str]
    report_markdown: str


def run_risk_agent(ticker: str) -> RiskReport:
    user_message = f"""Perform a comprehensive risk assessment for {ticker.upper()}.

Research business, financial, regulatory, geopolitical, and macro risks.
Check recent lawsuits, regulatory actions, and SEC risk factor disclosures.

Return ONLY this JSON:
{{
  "ticker": "{ticker.upper()}",
  "overall_risk": "<HIGH|MEDIUM|LOW>",
  "business_risk": "<HIGH|MEDIUM|LOW>",
  "financial_risk": "<HIGH|MEDIUM|LOW>",
  "regulatory_risk": "<HIGH|MEDIUM|LOW>",
  "macro_risk": "<HIGH|MEDIUM|LOW>",
  "top_risks": ["...", "...", "..."],
  "report_markdown": "<full markdown risk analysis>"
}}"""

    try:
        raw = run_agent(SYSTEM_PROMPT, user_message, TOOLS, TOOL_HANDLERS)
        data = parse_json_from_response(raw)
        return RiskReport(**data)
    except Exception as e:
        import logging; logging.getLogger(__name__).error(f"Risk agent failed for {ticker}: {e}")
        return RiskReport(
            ticker=ticker.upper(), overall_risk="MEDIUM", business_risk="MEDIUM",
            financial_risk="MEDIUM", regulatory_risk="MEDIUM", macro_risk="MEDIUM",
            top_risks=[], report_markdown=str(e),
        )
