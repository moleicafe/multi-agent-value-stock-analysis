from datetime import datetime
from sqlalchemy import (
    Column, String, Float, Integer, Text, DateTime,
    ForeignKey, JSON, UniqueConstraint,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Stock(Base):
    __tablename__ = "stocks"

    ticker = Column(String(10), primary_key=True)
    company_name = Column(String(255))
    sector = Column(String(100))
    industry = Column(String(100))
    country = Column(String(50))
    website = Column(String(255))
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    analyses = relationship("Analysis", back_populates="stock", order_by="Analysis.run_date.desc()")


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(10), ForeignKey("stocks.ticker"), nullable=False)
    run_date = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Final verdict
    recommendation = Column(String(10))       # BUY / HOLD / SELL
    confidence_score = Column(Float)          # 0.0 – 1.0
    overall_score = Column(Float)             # 1 – 10
    summary = Column(Text)

    # Price snapshot at time of analysis
    current_price = Column(Float)
    market_cap = Column(Float)

    # Valuation
    pe_ratio = Column(Float)
    forward_pe = Column(Float)
    peg_ratio = Column(Float)
    price_to_book = Column(Float)
    ev_to_ebitda = Column(Float)
    valuation_verdict = Column(String(20))    # UNDERVALUED / FAIR / OVERVALUED

    # Financials
    revenue_growth_yoy = Column(Float)
    earnings_growth_yoy = Column(Float)
    gross_margins = Column(Float)
    operating_margins = Column(Float)
    net_margins = Column(Float)
    return_on_equity = Column(Float)
    return_on_assets = Column(Float)
    debt_to_equity = Column(Float)
    current_ratio = Column(Float)
    free_cashflow = Column(Float)

    # Technicals
    rsi = Column(Float)
    price_vs_52w_high_pct = Column(Float)     # % below 52-week high
    price_vs_52w_low_pct = Column(Float)      # % above 52-week low
    beta = Column(Float)

    # Sentiment
    news_sentiment_score = Column(Float)      # -1.0 to 1.0
    analyst_target_price = Column(Float)
    analyst_recommendation = Column(String(20))

    # Insider / institutional
    insider_trend = Column(String(20))        # BUYING / SELLING / NEUTRAL
    short_interest = Column(Float)

    # Agent outputs (full markdown per agent)
    agent_reports = relationship("AgentReport", back_populates="analysis")

    stock = relationship("Stock", back_populates="analyses")

    __table_args__ = (
        UniqueConstraint("ticker", "run_date", name="uq_ticker_run_date"),
    )


class AgentReport(Base):
    __tablename__ = "agent_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id"), nullable=False)
    agent_name = Column(String(50), nullable=False)   # e.g. "bull", "bear", "financial"
    report_markdown = Column(Text)
    key_points = Column(JSON)                          # list of bullet point strings
    score = Column(Float)                              # agent's own sub-score if applicable
    created_at = Column(DateTime, default=datetime.utcnow)

    analysis = relationship("Analysis", back_populates="agent_reports")
