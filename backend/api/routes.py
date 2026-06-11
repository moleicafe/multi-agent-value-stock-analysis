import asyncio
import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from db.database import get_db
from db.models import Stock, Analysis, AgentReport
from agents.orchestrator import analyze_stock

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Request / Response schemas ──────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    ticker: str


class WatchlistFilters(BaseModel):
    recommendation: Optional[str] = None      # BUY / HOLD / SELL
    sector: Optional[str] = None
    valuation_verdict: Optional[str] = None   # UNDERVALUED / FAIR / OVERVALUED
    min_score: Optional[float] = None
    max_score: Optional[float] = None
    insider_trend: Optional[str] = None       # BUYING / NEUTRAL / SELLING
    sort_by: Optional[str] = "overall_score"
    sort_dir: Optional[str] = "desc"
    limit: Optional[int] = 50


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/analyze")
async def analyze(req: AnalyzeRequest):
    """
    Trigger a full multi-agent stock analysis.
    Runs all 11 agents, saves results to DB, returns final verdict.
    """
    ticker = req.ticker.upper().strip()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required")

    logger.info(f"POST /analyze — ticker={ticker}")
    logs = []
    def collect_log(msg: str):
        logger.info(f"[{ticker}] {msg}")
        logs.append({"time": datetime.utcnow().isoformat(), "message": msg})

    try:
        result = await analyze_stock(ticker, progress_callback=collect_log)
        logger.info(f"POST /analyze — {ticker} done: {result.get('recommendation')} score={result.get('overall_score')}")
        return {"success": True, "logs": logs, **result}
    except Exception as e:
        logger.error(f"POST /analyze — {ticker} FAILED: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/watchlist")
def get_watchlist(
    recommendation: Optional[str] = None,
    sector: Optional[str] = None,
    valuation_verdict: Optional[str] = None,
    min_score: Optional[float] = None,
    max_score: Optional[float] = None,
    insider_trend: Optional[str] = None,
    sort_by: str = "overall_score",
    sort_dir: str = "desc",
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """Return the watchlist with optional filters and sorting."""
    # Latest analysis per ticker via subquery
    from sqlalchemy import func, desc, asc
    subq = (
        db.query(
            Analysis.ticker,
            func.max(Analysis.run_date).label("latest_date"),
        )
        .group_by(Analysis.ticker)
        .subquery()
    )

    q = (
        db.query(Analysis, Stock)
        .join(subq, (Analysis.ticker == subq.c.ticker) & (Analysis.run_date == subq.c.latest_date))
        .join(Stock, Analysis.ticker == Stock.ticker)
    )

    # Apply filters
    if recommendation:
        q = q.filter(Analysis.recommendation == recommendation.upper())
    if sector:
        q = q.filter(Stock.sector.ilike(f"%{sector}%"))
    if valuation_verdict:
        q = q.filter(Analysis.valuation_verdict == valuation_verdict.upper())
    if min_score is not None:
        q = q.filter(Analysis.overall_score >= min_score)
    if max_score is not None:
        q = q.filter(Analysis.overall_score <= max_score)
    if insider_trend:
        q = q.filter(Analysis.insider_trend == insider_trend.upper())

    # Sorting
    sortable = {
        "overall_score": Analysis.overall_score,
        "confidence_score": Analysis.confidence_score,
        "pe_ratio": Analysis.pe_ratio,
        "revenue_growth_yoy": Analysis.revenue_growth_yoy,
        "net_margins": Analysis.net_margins,
        "news_sentiment_score": Analysis.news_sentiment_score,
        "run_date": Analysis.run_date,
        "market_cap": Analysis.market_cap,
        "current_price": Analysis.current_price,
    }
    sort_col = sortable.get(sort_by, Analysis.overall_score)
    q = q.order_by(desc(sort_col) if sort_dir == "desc" else asc(sort_col))
    q = q.limit(limit)

    rows = q.all()
    return [_format_watchlist_row(analysis, stock) for analysis, stock in rows]


@router.get("/stock/{ticker}")
def get_stock_detail(ticker: str, db: Session = Depends(get_db)):
    """Return full analysis details including all agent reports."""
    ticker = ticker.upper()

    analysis = (
        db.query(Analysis)
        .filter(Analysis.ticker == ticker)
        .order_by(Analysis.run_date.desc())
        .first()
    )
    if not analysis:
        raise HTTPException(status_code=404, detail=f"No analysis found for {ticker}")

    stock = db.get(Stock, ticker)
    agent_reports = (
        db.query(AgentReport)
        .filter(AgentReport.analysis_id == analysis.id)
        .all()
    )

    return {
        **_format_watchlist_row(analysis, stock),
        "summary": analysis.summary,
        "agent_reports": [
            {
                "agent_name": r.agent_name,
                "report_markdown": r.report_markdown,
                "key_points": r.key_points,
            }
            for r in agent_reports
        ],
        "description": stock.description if stock else None,
        "website": stock.website if stock else None,
    }


@router.get("/stock/{ticker}/history")
def get_stock_history(ticker: str, db: Session = Depends(get_db)):
    """Return all historical analyses for a ticker."""
    ticker = ticker.upper()
    analyses = (
        db.query(Analysis)
        .filter(Analysis.ticker == ticker)
        .order_by(Analysis.run_date.desc())
        .all()
    )
    return [_format_watchlist_row(a, None) for a in analyses]


@router.get("/sectors")
def get_sectors(db: Session = Depends(get_db)):
    """Return all unique sectors in the watchlist."""
    rows = db.query(Stock.sector).filter(Stock.sector.isnot(None)).distinct().all()
    return sorted([r[0] for r in rows if r[0]])


@router.delete("/stock/{ticker}")
def delete_stock(ticker: str, db: Session = Depends(get_db)):
    """Remove a stock and all its analyses from the watchlist."""
    ticker = ticker.upper()
    analyses = db.query(Analysis).filter(Analysis.ticker == ticker).all()
    for a in analyses:
        db.query(AgentReport).filter(AgentReport.analysis_id == a.id).delete()
        db.delete(a)
    stock = db.get(Stock, ticker)
    if stock:
        db.delete(stock)
    db.commit()
    return {"success": True, "deleted": ticker}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _format_watchlist_row(analysis: Analysis, stock: Optional[Stock]) -> dict:
    return {
        "ticker": analysis.ticker,
        "company_name": stock.company_name if stock else None,
        "sector": stock.sector if stock else None,
        "industry": stock.industry if stock else None,
        "recommendation": analysis.recommendation,
        "confidence_score": analysis.confidence_score,
        "overall_score": analysis.overall_score,
        "current_price": analysis.current_price,
        "market_cap": analysis.market_cap,
        "pe_ratio": analysis.pe_ratio,
        "forward_pe": analysis.forward_pe,
        "peg_ratio": analysis.peg_ratio,
        "ev_to_ebitda": analysis.ev_to_ebitda,
        "valuation_verdict": analysis.valuation_verdict,
        "revenue_growth_yoy": analysis.revenue_growth_yoy,
        "net_margins": analysis.net_margins,
        "debt_to_equity": analysis.debt_to_equity,
        "rsi": analysis.rsi,
        "price_vs_52w_high_pct": analysis.price_vs_52w_high_pct,
        "beta": analysis.beta,
        "news_sentiment_score": analysis.news_sentiment_score,
        "insider_trend": analysis.insider_trend,
        "analyst_recommendation": analysis.analyst_recommendation,
        "run_date": analysis.run_date.isoformat() if analysis.run_date else None,
    }
