import json
from pydantic import BaseModel
from typing import Optional
from .base import run_agent, parse_json_from_response

SYSTEM_PROMPT = """You are a senior portfolio manager and investment committee chair.
You receive research reports from 10 specialist analysts covering a stock from every angle.
Your job is to synthesize all inputs, weigh the evidence, resolve conflicts, and deliver
a final investment decision with a clear rationale.

Scoring rubric (1-10):
- 9-10: Strong BUY — high conviction, multiple tailwinds, clear upside
- 7-8: BUY — more positives than negatives, reasonable risk/reward
- 5-6: HOLD — mixed signals, wait for more clarity
- 3-4: SELL — more negatives than positives, better opportunities elsewhere
- 1-2: Strong SELL — multiple red flags, significant downside risk

Your output must include:
1. Final recommendation (BUY / HOLD / SELL)
2. Confidence score (0.0 - 1.0)
3. Overall score (1-10)
4. Executive summary (3-4 sentences max)
5. Key bull points (top 3)
6. Key bear points (top 3)
7. Key risks to your thesis
8. Suggested position sizing: FULL / HALF / STARTER / NONE"""

TOOLS = []  # Judge receives all data in the prompt, no tools needed


class JudgeReport(BaseModel):
    ticker: str
    recommendation: str              # BUY / HOLD / SELL
    confidence_score: float          # 0.0 – 1.0
    overall_score: float             # 1 – 10
    position_sizing: str             # FULL / HALF / STARTER / NONE
    executive_summary: str
    key_bull_points: list[str]
    key_bear_points: list[str]
    key_risks: list[str]
    report_markdown: str


def run_judge_agent(ticker: str, all_reports: dict) -> JudgeReport:
    """
    all_reports: dict with keys matching agent names, values are their report dicts/models.
    """
    reports_text = json.dumps(all_reports, default=str, indent=2)

    user_message = f"""You have received the following analyst reports for {ticker.upper()}:

{reports_text}

Based on ALL reports above, deliver your final investment verdict.

Return ONLY this JSON:
{{
  "ticker": "{ticker.upper()}",
  "recommendation": "<BUY|HOLD|SELL>",
  "confidence_score": <float 0.0-1.0>,
  "overall_score": <float 1-10>,
  "position_sizing": "<FULL|HALF|STARTER|NONE>",
  "executive_summary": "<3-4 sentence summary>",
  "key_bull_points": ["...", "...", "..."],
  "key_bear_points": ["...", "...", "..."],
  "key_risks": ["...", "..."],
  "report_markdown": "<full markdown synthesis report>"
}}"""

    try:
        raw = run_agent(
            system_prompt=SYSTEM_PROMPT,
            user_message=user_message,
            tools=[],
            tool_handlers={},
            max_iterations=3,
        )
        data = parse_json_from_response(raw)
        return JudgeReport(**data)
    except Exception as e:
        import logging; logging.getLogger(__name__).error(f"Judge agent failed for {ticker}: {e}")
        return JudgeReport(
            ticker=ticker.upper(), recommendation="HOLD", confidence_score=0.5,
            overall_score=5.0, position_sizing="NONE",
            executive_summary="Synthesis incomplete due to an error.",
            key_bull_points=[], key_bear_points=[], key_risks=[str(e)],
            report_markdown=str(e),
        )
