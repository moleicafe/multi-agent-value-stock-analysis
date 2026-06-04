import json
from pydantic import BaseModel
from typing import Optional
from .base import run_agent, parse_json_from_response
from tools.finance_tools import get_stock_info
from tools.search_tools import web_search_deep

SYSTEM_PROMPT = """You are an ESG (Environmental, Social, Governance) analyst.
Assess the company across all three ESG dimensions:

Environmental:
- Carbon footprint and net-zero commitments
- Energy sources (renewable vs fossil)
- Environmental violations or controversies
- Climate risk exposure (physical and transition risk)

Social:
- Employee relations, diversity and inclusion metrics
- Labor practices and supply chain ethics
- Community relations and social controversies
- Customer privacy and data protection

Governance:
- Board independence and diversity
- Executive compensation vs performance
- Shareholder rights and voting structure (dual class shares?)
- Accounting transparency and audit quality
- History of shareholder-unfriendly actions

Rate each dimension: STRONG / ADEQUATE / WEAK
Give an overall ESG verdict and flag any ESG-related investment risks."""

TOOLS = [
    {
        "name": "get_stock_info",
        "description": "Get basic company info and sector.",
        "input_schema": {"type": "object", "properties": {"ticker": {"type": "string"}}, "required": ["ticker"]},
    },
    {
        "name": "web_search_deep",
        "description": "Research ESG scores, controversies, sustainability reports, governance issues.",
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
    "web_search_deep": web_search_deep,
}


class ESGReport(BaseModel):
    ticker: str
    environmental_rating: str       # STRONG / ADEQUATE / WEAK
    social_rating: str
    governance_rating: str
    overall_esg: str                # STRONG / ADEQUATE / WEAK
    esg_controversies: list[str]
    esg_positives: list[str]
    report_markdown: str


def run_esg_agent(ticker: str) -> ESGReport:
    user_message = f"""Perform an ESG analysis of {ticker.upper()}.

Research environmental commitments, social practices, and governance quality.
Look for ESG controversies, lawsuits, and positive sustainability initiatives.

Return ONLY this JSON:
{{
  "ticker": "{ticker.upper()}",
  "environmental_rating": "<STRONG|ADEQUATE|WEAK>",
  "social_rating": "<STRONG|ADEQUATE|WEAK>",
  "governance_rating": "<STRONG|ADEQUATE|WEAK>",
  "overall_esg": "<STRONG|ADEQUATE|WEAK>",
  "esg_controversies": ["...", "..."],
  "esg_positives": ["...", "..."],
  "report_markdown": "<full markdown ESG analysis>"
}}"""

    try:
        raw = run_agent(SYSTEM_PROMPT, user_message, TOOLS, TOOL_HANDLERS)
        data = parse_json_from_response(raw)
        return ESGReport(**data)
    except Exception as e:
        import logging; logging.getLogger(__name__).error(f"ESG agent failed for {ticker}: {e}")
        return ESGReport(
            ticker=ticker.upper(), environmental_rating="ADEQUATE", social_rating="ADEQUATE",
            governance_rating="ADEQUATE", overall_esg="ADEQUATE",
            esg_controversies=[], esg_positives=[], report_markdown=str(e),
        )
