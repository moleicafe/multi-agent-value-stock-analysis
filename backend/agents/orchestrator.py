import asyncio
import logging
import time
from datetime import datetime
from typing import Callable, Optional
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

from agents.financial_agent import run_financial_agent, FinancialReport
from agents.bull_agent import run_bull_agent, BullReport
from agents.bear_agent import run_bear_agent, BearReport
from agents.valuation_agent import run_valuation_agent, ValuationReport
from agents.technical_agent import run_technical_agent, TechnicalReport
from agents.news_agent import run_news_agent, NewsReport
from agents.market_agent import run_market_agent, MarketReport
from agents.insider_agent import run_insider_agent, InsiderReport
from agents.risk_agent import run_risk_agent, RiskReport
from agents.esg_agent import run_esg_agent, ESGReport
from agents.macro_agent import run_macro_agent, MacroReport
from agents.judge_agent import run_judge_agent, JudgeReport

from db.database import SessionLocal
from db.models import Stock, Analysis, AgentReport
from tools.finance_tools import get_stock_info


# Limit concurrent API calls to avoid rate limits (3 at a time)
_semaphore = asyncio.Semaphore(3)


async def _run_in_thread(fn, *args):
    """Run a synchronous agent function in a thread pool, respecting the concurrency limit."""
    async with _semaphore:
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor(max_workers=1) as executor:
            return await loop.run_in_executor(executor, fn, *args)


async def analyze_stock(
    ticker: str,
    progress_callback: Optional[Callable[[str], None]] = None,
) -> dict:
    """
    Orchestrate all sub-agents in parallel, then run the Judge, then save to DB.
    Returns the full analysis as a dict.
    """
    ticker = ticker.upper().strip()

    def log(msg: str):
        if progress_callback:
            progress_callback(msg)

    logger.info(f"Starting analysis for {ticker}")
    log(f"Starting analysis for {ticker}...")

    t0 = time.time()
    log("Launching 11 analyst agents in parallel...")
    logger.info(f"[{ticker}] Launching 11 analyst agents (semaphore=3)")
    results = await asyncio.gather(
        _run_in_thread(run_financial_agent, ticker),
        _run_in_thread(run_bull_agent, ticker),
        _run_in_thread(run_bear_agent, ticker),
        _run_in_thread(run_valuation_agent, ticker),
        _run_in_thread(run_technical_agent, ticker),
        _run_in_thread(run_news_agent, ticker),
        _run_in_thread(run_market_agent, ticker),
        _run_in_thread(run_insider_agent, ticker),
        _run_in_thread(run_risk_agent, ticker),
        _run_in_thread(run_esg_agent, ticker),
        _run_in_thread(run_macro_agent, ticker),
        return_exceptions=True,
    )
    elapsed = time.time() - t0
    logger.info(f"[{ticker}] All agents returned in {elapsed:.1f}s")

    agent_names = ["financial", "bull", "bear", "valuation", "technical", "news", "market", "insider", "risk", "esg", "macro"]
    for name, result in zip(agent_names, results):
        if isinstance(result, Exception):
            logger.error(f"[{ticker}] Agent '{name}' FAILED: {type(result).__name__}: {result}")
            log(f"  ✗ {name}: {type(result).__name__}")
        else:
            logger.info(f"[{ticker}] Agent '{name}' OK — report_markdown length={len(getattr(result, 'report_markdown', '') or '')}")
            log(f"  ✓ {name}")

    financial: FinancialReport = results[0] if not isinstance(results[0], Exception) else None
    bull: BullReport = results[1] if not isinstance(results[1], Exception) else None
    bear: BearReport = results[2] if not isinstance(results[2], Exception) else None
    valuation: ValuationReport = results[3] if not isinstance(results[3], Exception) else None
    technical: TechnicalReport = results[4] if not isinstance(results[4], Exception) else None
    news: NewsReport = results[5] if not isinstance(results[5], Exception) else None
    market: MarketReport = results[6] if not isinstance(results[6], Exception) else None
    insider: InsiderReport = results[7] if not isinstance(results[7], Exception) else None
    risk: RiskReport = results[8] if not isinstance(results[8], Exception) else None
    esg: ESGReport = results[9] if not isinstance(results[9], Exception) else None
    macro: MacroReport = results[10] if not isinstance(results[10], Exception) else None

    log("All agents complete. Running synthesis judge...")
    logger.info(f"[{ticker}] Running judge agent")

    # Build summary dict for the judge
    all_reports = {
        "financial": financial.model_dump() if financial else {"error": str(results[0])},
        "bull": bull.model_dump() if bull else {"error": str(results[1])},
        "bear": bear.model_dump() if bear else {"error": str(results[2])},
        "valuation": valuation.model_dump() if valuation else {"error": str(results[3])},
        "technical": technical.model_dump() if technical else {"error": str(results[4])},
        "news": news.model_dump() if news else {"error": str(results[5])},
        "market": market.model_dump() if market else {"error": str(results[6])},
        "insider": insider.model_dump() if insider else {"error": str(results[7])},
        "risk": risk.model_dump() if risk else {"error": str(results[8])},
        "esg": esg.model_dump() if esg else {"error": str(results[9])},
        "macro": macro.model_dump() if macro else {"error": str(results[10])},
    }

    judge: JudgeReport = await _run_in_thread(run_judge_agent, ticker, all_reports)
    logger.info(f"[{ticker}] Judge: {judge.recommendation}, score={judge.overall_score}, confidence={judge.confidence_score}")
    log(f"Judge: {judge.recommendation} (score {judge.overall_score}/10). Saving to database...")

    # Persist to DB
    stock_info = get_stock_info(ticker)
    _save_to_db(ticker, stock_info, financial, valuation, technical, news, insider, judge, all_reports)

    log(f"Analysis complete: {judge.recommendation} (score: {judge.overall_score}/10)")

    return {
        "ticker": ticker,
        "recommendation": judge.recommendation,
        "confidence_score": judge.confidence_score,
        "overall_score": judge.overall_score,
        "position_sizing": judge.position_sizing,
        "executive_summary": judge.executive_summary,
        "key_bull_points": judge.key_bull_points,
        "key_bear_points": judge.key_bear_points,
        "key_risks": judge.key_risks,
        "judge_report": judge.report_markdown,
        "agent_reports": {k: v.get("report_markdown", "") for k, v in all_reports.items()},
    }


def _save_to_db(ticker, stock_info, financial, valuation, technical, news, insider, judge, all_reports):
    logger.info(f"[{ticker}] Saving to DB")
    db = SessionLocal()
    try:
        # Upsert stock
        stock = db.get(Stock, ticker)
        if not stock:
            stock = Stock(ticker=ticker)
            db.add(stock)
        stock.company_name = stock_info.get("company_name")
        stock.sector = stock_info.get("sector")
        stock.industry = stock_info.get("industry")
        stock.country = stock_info.get("country")
        stock.website = stock_info.get("website")
        stock.description = stock_info.get("description")

        # Create analysis record
        analysis = Analysis(
            ticker=ticker,
            run_date=datetime.utcnow(),
            recommendation=judge.recommendation,
            confidence_score=judge.confidence_score,
            overall_score=judge.overall_score,
            summary=judge.executive_summary,
            current_price=stock_info.get("current_price"),
            market_cap=stock_info.get("market_cap"),
            pe_ratio=stock_info.get("pe_ratio"),
            forward_pe=stock_info.get("forward_pe"),
            peg_ratio=stock_info.get("peg_ratio"),
            price_to_book=stock_info.get("price_to_book"),
            ev_to_ebitda=stock_info.get("ev_to_ebitda"),
            valuation_verdict=valuation.verdict if valuation else None,
            revenue_growth_yoy=financial.revenue_growth_yoy if financial else None,
            gross_margins=financial.gross_margin if financial else None,
            operating_margins=financial.operating_margin if financial else None,
            net_margins=financial.net_margin if financial else None,
            return_on_equity=financial.roe if financial else None,
            return_on_assets=financial.roa if financial else None,
            debt_to_equity=financial.debt_to_equity if financial else None,
            current_ratio=financial.current_ratio if financial else None,
            rsi=technical.rsi if technical else None,
            price_vs_52w_high_pct=technical.price_vs_52w_high_pct if technical else None,
            price_vs_52w_low_pct=technical.price_vs_52w_low_pct if technical else None,
            beta=stock_info.get("beta"),
            news_sentiment_score=news.sentiment_score if news else None,
            analyst_target_price=stock_info.get("analyst_target_price"),
            analyst_recommendation=stock_info.get("recommendation_key"),
            insider_trend=insider.insider_trend if insider else None,
            short_interest=stock_info.get("short_percent_of_float"),
        )
        db.add(analysis)
        db.flush()  # get analysis.id

        # Save individual agent reports
        agent_name_map = {
            "financial": "Financial Health",
            "bull": "Bull Case",
            "bear": "Bear Case",
            "valuation": "Valuation",
            "technical": "Technical Analysis",
            "news": "News & Sentiment",
            "market": "Market & Sector",
            "insider": "Insider & Institutional",
            "risk": "Risk Assessment",
            "esg": "ESG",
            "macro": "Macro Environment",
        }
        for key, label in agent_name_map.items():
            report_data = all_reports.get(key, {})
            markdown = report_data.get("report_markdown", "")
            logger.info(f"[{ticker}] Saving '{label}' — markdown length={len(markdown)}")
            agent_report = AgentReport(
                analysis_id=analysis.id,
                agent_name=label,
                report_markdown=markdown,
                key_points=_extract_key_points(key, report_data),
            )
            db.add(agent_report)

        # Save the judge's full synthesis report as its own tab
        db.add(AgentReport(
            analysis_id=analysis.id,
            agent_name="Judge / Synthesis",
            report_markdown=judge.report_markdown or "",
            key_points=(judge.key_bull_points or [])[:3] + (judge.key_bear_points or [])[:3],
        ))

        db.commit()
        logger.info(f"[{ticker}] DB save complete")
    except Exception as e:
        logger.error(f"[{ticker}] DB save FAILED: {e}")
        db.rollback()
        raise e
    finally:
        db.close()


def _extract_key_points(agent_key: str, report_data: dict) -> list:
    """Pull structured bullet points from each agent's report."""
    field_map = {
        "financial": ["key_strengths", "key_risks"],
        "bull": ["key_catalysts", "competitive_advantages"],
        "bear": ["key_risks", "red_flags"],
        "valuation": [],
        "technical": [],
        "news": ["key_events", "upcoming_catalysts"],
        "market": ["key_tailwinds", "key_headwinds"],
        "insider": ["notable_activity"],
        "risk": ["top_risks"],
        "esg": ["esg_controversies", "esg_positives"],
        "macro": ["key_macro_factors"],
    }
    points = []
    for field in field_map.get(agent_key, []):
        items = report_data.get(field, [])
        if isinstance(items, list):
            points.extend(items)
    return points
