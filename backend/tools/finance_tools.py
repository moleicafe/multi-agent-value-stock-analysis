import os
import requests
import yfinance as yf
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

AV_KEY = os.getenv("ALPHA_VANTAGE_API_KEY")
AV_BASE = "https://www.alphavantage.co/query"


def get_stock_info(ticker: str) -> dict:
    """Basic company info, price, market cap, P/E, beta."""
    try:
        t = yf.Ticker(ticker)
        info = t.info
        return {
            "ticker": ticker.upper(),
            "company_name": info.get("longName"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "market_cap": info.get("marketCap"),
            "current_price": info.get("currentPrice") or info.get("regularMarketPrice"),
            "previous_close": info.get("previousClose"),
            "fifty_two_week_high": info.get("fiftyTwoWeekHigh"),
            "fifty_two_week_low": info.get("fiftyTwoWeekLow"),
            "pe_ratio": info.get("trailingPE"),
            "forward_pe": info.get("forwardPE"),
            "peg_ratio": info.get("pegRatio"),
            "price_to_book": info.get("priceToBook"),
            "price_to_sales": info.get("priceToSalesTrailing12Months"),
            "ev_to_ebitda": info.get("enterpriseToEbitda"),
            "ev_to_revenue": info.get("enterpriseToRevenue"),
            "beta": info.get("beta"),
            "dividend_yield": info.get("dividendYield"),
            "short_ratio": info.get("shortRatio"),
            "short_percent_of_float": info.get("shortPercentOfFloat"),
            "analyst_target_price": info.get("targetMeanPrice"),
            "recommendation_mean": info.get("recommendationMean"),
            "recommendation_key": info.get("recommendationKey"),
            "number_of_analyst_opinions": info.get("numberOfAnalystOpinions"),
            "description": info.get("longBusinessSummary"),
            "website": info.get("website"),
            "employees": info.get("fullTimeEmployees"),
            "country": info.get("country"),
        }
    except Exception as e:
        return {"error": str(e), "ticker": ticker}


def get_income_statement(ticker: str) -> dict:
    """Annual income statement — revenue, net income, margins."""
    try:
        t = yf.Ticker(ticker)
        annual = t.financials
        if annual is None or annual.empty:
            return {"error": "No income statement data", "ticker": ticker}
        # Return last 4 years
        result = {}
        for col in annual.columns[:4]:
            year = str(col.year) if hasattr(col, "year") else str(col)
            result[year] = {k: (None if v != v else float(v)) for k, v in annual[col].items()}
        return {"ticker": ticker, "annual_income_statement": result}
    except Exception as e:
        return {"error": str(e), "ticker": ticker}


def get_balance_sheet(ticker: str) -> dict:
    """Annual balance sheet — assets, liabilities, equity."""
    try:
        t = yf.Ticker(ticker)
        bs = t.balance_sheet
        if bs is None or bs.empty:
            return {"error": "No balance sheet data", "ticker": ticker}
        result = {}
        for col in bs.columns[:4]:
            year = str(col.year) if hasattr(col, "year") else str(col)
            result[year] = {k: (None if v != v else float(v)) for k, v in bs[col].items()}
        return {"ticker": ticker, "annual_balance_sheet": result}
    except Exception as e:
        return {"error": str(e), "ticker": ticker}


def get_cash_flow(ticker: str) -> dict:
    """Annual cash flow — operating, investing, financing, free cash flow."""
    try:
        t = yf.Ticker(ticker)
        cf = t.cashflow
        if cf is None or cf.empty:
            return {"error": "No cash flow data", "ticker": ticker}
        result = {}
        for col in cf.columns[:4]:
            year = str(col.year) if hasattr(col, "year") else str(col)
            result[year] = {k: (None if v != v else float(v)) for k, v in cf[col].items()}
        return {"ticker": ticker, "annual_cash_flow": result}
    except Exception as e:
        return {"error": str(e), "ticker": ticker}


def get_key_metrics(ticker: str) -> dict:
    """Derived key metrics: revenue growth, margins, ROE, ROA, debt/equity."""
    try:
        t = yf.Ticker(ticker)
        info = t.info
        return {
            "ticker": ticker,
            "revenue_growth_yoy": info.get("revenueGrowth"),
            "earnings_growth_yoy": info.get("earningsGrowth"),
            "gross_margins": info.get("grossMargins"),
            "operating_margins": info.get("operatingMargins"),
            "profit_margins": info.get("profitMargins"),
            "return_on_equity": info.get("returnOnEquity"),
            "return_on_assets": info.get("returnOnAssets"),
            "debt_to_equity": info.get("debtToEquity"),
            "current_ratio": info.get("currentRatio"),
            "quick_ratio": info.get("quickRatio"),
            "free_cashflow": info.get("freeCashflow"),
            "operating_cashflow": info.get("operatingCashflow"),
            "total_revenue": info.get("totalRevenue"),
            "total_debt": info.get("totalDebt"),
            "total_cash": info.get("totalCash"),
            "ebitda": info.get("ebitda"),
        }
    except Exception as e:
        return {"error": str(e), "ticker": ticker}


def get_price_history(ticker: str, period: str = "1y") -> dict:
    """OHLCV price history. period: 1mo, 3mo, 6mo, 1y, 2y, 5y."""
    try:
        t = yf.Ticker(ticker)
        hist = t.history(period=period)
        if hist.empty:
            return {"error": "No price history", "ticker": ticker}
        records = []
        for date, row in hist.iterrows():
            records.append({
                "date": str(date.date()),
                "open": round(float(row["Open"]), 4),
                "high": round(float(row["High"]), 4),
                "low": round(float(row["Low"]), 4),
                "close": round(float(row["Close"]), 4),
                "volume": int(row["Volume"]),
            })
        return {"ticker": ticker, "period": period, "history": records}
    except Exception as e:
        return {"error": str(e), "ticker": ticker}


def get_analyst_ratings(ticker: str) -> dict:
    """Analyst upgrades/downgrades and recommendations."""
    try:
        t = yf.Ticker(ticker)
        info = t.info
        recs = t.recommendations
        result = {
            "ticker": ticker,
            "target_mean_price": info.get("targetMeanPrice"),
            "target_high_price": info.get("targetHighPrice"),
            "target_low_price": info.get("targetLowPrice"),
            "recommendation_key": info.get("recommendationKey"),
            "recommendation_mean": info.get("recommendationMean"),
            "number_of_analysts": info.get("numberOfAnalystOpinions"),
        }
        if recs is not None and not recs.empty:
            recent = recs.head(10)
            result["recent_ratings"] = recent.to_dict(orient="records")
        return result
    except Exception as e:
        return {"error": str(e), "ticker": ticker}


def get_earnings_history(ticker: str) -> dict:
    """EPS estimates vs actuals — earnings surprises."""
    try:
        t = yf.Ticker(ticker)
        earnings = t.earnings_history
        if earnings is None or earnings.empty:
            return {"error": "No earnings history", "ticker": ticker}
        records = earnings.head(8).to_dict(orient="records")
        return {"ticker": ticker, "earnings_history": records}
    except Exception as e:
        return {"error": str(e), "ticker": ticker}


def get_institutional_holders(ticker: str) -> dict:
    """Top institutional holders and ownership percentage."""
    try:
        t = yf.Ticker(ticker)
        inst = t.institutional_holders
        major = t.major_holders
        result = {"ticker": ticker}
        if inst is not None and not inst.empty:
            result["institutional_holders"] = inst.head(15).to_dict(orient="records")
        if major is not None and not major.empty:
            result["major_holders"] = major.to_dict(orient="records")
        return result
    except Exception as e:
        return {"error": str(e), "ticker": ticker}


def get_insider_trades(ticker: str) -> dict:
    """Recent insider transactions (buys/sells)."""
    try:
        t = yf.Ticker(ticker)
        insider = t.insider_transactions
        if insider is None or insider.empty:
            return {"error": "No insider transaction data", "ticker": ticker}
        records = insider.head(20).to_dict(orient="records")
        return {"ticker": ticker, "insider_transactions": records}
    except Exception as e:
        return {"error": str(e), "ticker": ticker}


def get_options_data(ticker: str) -> dict:
    """Put/call ratio and nearest expiry options chain summary."""
    try:
        t = yf.Ticker(ticker)
        expirations = t.options
        if not expirations:
            return {"error": "No options data", "ticker": ticker}
        nearest = expirations[0]
        chain = t.option_chain(nearest)
        calls_vol = int(chain.calls["volume"].sum()) if "volume" in chain.calls else 0
        puts_vol = int(chain.puts["volume"].sum()) if "volume" in chain.puts else 0
        put_call_ratio = round(puts_vol / calls_vol, 3) if calls_vol > 0 else None
        return {
            "ticker": ticker,
            "nearest_expiry": nearest,
            "call_volume": calls_vol,
            "put_volume": puts_vol,
            "put_call_ratio": put_call_ratio,
            "available_expirations": list(expirations[:5]),
        }
    except Exception as e:
        return {"error": str(e), "ticker": ticker}
