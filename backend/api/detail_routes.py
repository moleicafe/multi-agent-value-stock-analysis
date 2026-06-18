"""
Comprehensive stock detail endpoints — feeds the full StockOracle-style UI.
All computation is server-side so the frontend stays thin.
"""
import math
import logging
from datetime import datetime
from fastapi import APIRouter
import yfinance as yf

from tools.news_tools import get_stock_news, get_market_news

logger = logging.getLogger(__name__)
router = APIRouter()


# ── helpers ──────────────────────────────────────────────────────────────────

def _s(v, default=None):
    """Return default for None or NaN."""
    if v is None:
        return default
    try:
        return default if math.isnan(float(v)) else v
    except Exception:
        return v


def _pct(v):
    return round((_s(v) or 0) * 100, 2)


def _compute_moat(info: dict) -> str:
    roe = _pct(info.get("returnOnEquity"))
    gross = _pct(info.get("grossMargins"))
    net = _pct(info.get("profitMargins"))
    fcf = _s(info.get("freeCashflow"), 0)
    if roe >= 20 and gross >= 40 and net >= 15 and fcf > 0:
        return "WIDE"
    elif roe >= 10 and gross >= 25:
        return "NARROW"
    return "NONE"


def _compute_radar(info: dict) -> dict:
    roe     = _pct(info.get("returnOnEquity"))
    gross   = _pct(info.get("grossMargins"))
    op      = _pct(info.get("operatingMargins"))
    net     = _pct(info.get("profitMargins"))
    rev_g   = _pct(info.get("revenueGrowth"))
    eps_g   = _pct(info.get("earningsGrowth"))
    cr      = _s(info.get("currentRatio"), 1)
    d2e     = (_s(info.get("debtToEquity"), 50)) / 100
    fcf     = _s(info.get("freeCashflow"), 0)
    beta    = _s(info.get("beta"), 1)
    target  = _s(info.get("targetMeanPrice"), 0)
    price   = _s(info.get("currentPrice"), 1) or 1
    rec     = _s(info.get("recommendationMean"), 3)
    pe      = _s(info.get("trailingPE"), 50) or 50

    profitability    = min(100, max(0, gross * 0.30 + op * 0.30 + net * 0.20 + roe * 0.20))
    growth           = min(100, max(0, 50 + (rev_g * 0.5 + eps_g * 0.5)))
    fin_strength     = min(100, max(0, min(40, cr * 15) + max(0, 40 - d2e * 20) + (20 if fcf > 0 else 0)))
    moat_score       = min(100, max(0, roe * 1.5 + gross * 0.5 + (20 if fcf > 0 else 0)))
    upside           = ((target / price) - 1) * 100 if target and target > 0 else 0
    valuation        = min(100, max(0, max(0, 50 - min(pe, 100) * 0.4 + 20) + min(50, max(0, upside * 0.8 + 20))))
    predictability   = min(100, max(0, 100 - abs(beta - 1) * 30 + (5 - min(rec, 5)) * 10))

    return {
        "predictability":    round(predictability),
        "profitability":     round(profitability),
        "growth":            round(growth),
        "moat":              round(moat_score),
        "financial_strength": round(fin_strength),
        "valuation":         round(valuation),
    }


def _compute_valuation(info: dict) -> tuple:
    price   = _s(info.get("currentPrice"), 0)
    eps     = _s(info.get("trailingEps"), 0)
    fwd_eps = _s(info.get("forwardEps"), 0) or eps
    book    = _s(info.get("bookValue"), 0)
    fcf     = _s(info.get("freeCashflow"), 0)
    shares  = _s(info.get("sharesOutstanding"), 1) or 1
    rev     = _s(info.get("totalRevenue"), 0)
    growth  = min(_s(info.get("earningsGrowth"), 0.10), 0.25)
    target  = _s(info.get("targetMeanPrice"))

    rev_ps  = rev / shares if shares > 0 else 0
    fcf_ps  = fcf / shares if shares > 0 else 0

    graham = round(math.sqrt(22.5 * abs(eps) * abs(book)), 2) if eps > 0 and book > 0 else None
    pe_val  = round(eps * 15, 2) if eps > 0 else None
    fpe_val = round(fwd_eps * 15, 2) if fwd_eps > 0 else None
    ps_val  = round(rev_ps * 2.5, 2) if rev_ps > 0 else None
    pb_val  = round(book * 3, 2) if book > 0 else None

    dcf_val = None
    if fcf_ps > 0:
        try:
            disc, tg = 0.10, 0.03
            dcf = sum(fcf_ps * (1 + growth) ** i / (1 + disc) ** i for i in range(1, 11))
            term = fcf_ps * (1 + growth) ** 10 * (1 + tg) / (disc - tg)
            dcf_val = round(dcf + term / (1 + disc) ** 10, 2)
        except Exception:
            pass

    models = {
        "dcf":           dcf_val,
        "pe_based":      pe_val,
        "forward_pe":    fpe_val,
        "ps_based":      ps_val,
        "pb_based":      pb_val,
        "graham":        graham,
        "analyst_target": round(target, 2) if target else None,
    }
    vals = [v for v in models.values() if v is not None]
    oracle = round(sum(vals) / len(vals), 2) if vals else None
    return oracle, models


def _compute_vmi(info: dict) -> dict:
    rev_g  = _pct(info.get("revenueGrowth"))
    eps_g  = _pct(info.get("earningsGrowth"))
    op_m   = _pct(info.get("operatingMargins"))
    roa    = _pct(info.get("returnOnAssets"))
    d2e    = _s(info.get("debtToEquity"), 0)
    fcf    = _s(info.get("freeCashflow"), 0)
    moat   = _compute_moat(info)

    def status(passed, warn_cond):
        return "PASS" if passed else ("WARNING" if warn_cond else "FAIL")

    criteria = [
        {
            "name": "Financials",
            "description": "Revenue growth > 0 and free cash flow positive",
            "status": status(rev_g > 0 and fcf > 0, rev_g > -5),
            "value": f"Rev {rev_g:+.1f}%",
        },
        {
            "name": "Positive Growth Rates",
            "description": "EPS growth > 0%",
            "status": status(eps_g > 0, eps_g > -5),
            "value": f"EPS {eps_g:+.1f}%",
        },
        {
            "name": "Moat",
            "description": "Wide or Narrow competitive advantage",
            "status": "PASS" if moat in ("WIDE", "NARROW") else "FAIL",
            "value": moat,
        },
        {
            "name": "Profitable & Efficient",
            "description": "Operating margin > 15%, ROA > 5%",
            "status": status(op_m > 15 and roa > 5, op_m > 5),
            "value": f"Op margin {op_m:.1f}%",
        },
        {
            "name": "Conservative Debt",
            "description": "Debt/Equity < 100",
            "status": status(d2e < 100, d2e < 200),
            "value": f"D/E {d2e:.0f}",
        },
    ]
    passes = sum(1 for c in criteria if c["status"] == "PASS")
    return {"criteria": criteria, "pass_count": passes, "total": len(criteria), "score": round(passes / len(criteria) * 100)}


# ── market endpoints ──────────────────────────────────────────────────────────

@router.get("/market/overview")
def market_overview():
    """Major index snapshot with sparklines and period returns."""
    indices = {"^GSPC": "S&P 500", "^DJI": "Dow Jones", "^NDX": "Nasdaq 100", "^RUT": "Russell 2000"}
    result = []
    for sym, name in indices.items():
        try:
            t = yf.Ticker(sym)
            info = t.info
            hist = t.history(period="1y")
            price = _s(info.get("regularMarketPrice") or info.get("currentPrice"))
            prev  = _s(info.get("previousClose") or info.get("regularMarketPreviousClose"))
            chg   = round(price - prev, 2) if price and prev else None
            chg_pct = round((price / prev - 1) * 100, 2) if price and prev and prev != 0 else None
            monthly_pct = ytd_pct = None
            sparkline = []
            if not hist.empty:
                closes = hist["Close"]
                cur = float(closes.iloc[-1])
                if len(closes) >= 22:
                    monthly_pct = round((cur / float(closes.iloc[-22]) - 1) * 100, 2)
                yr_data = closes[closes.index.year == closes.index[-1].year]
                if len(yr_data) >= 2:
                    ytd_pct = round((cur / float(yr_data.iloc[0]) - 1) * 100, 2)
                sparkline = [round(float(v), 2) for v in closes.tail(20)]
            result.append({
                "symbol": sym, "name": name, "price": round(price, 2) if price else None,
                "change": chg, "change_pct": chg_pct,
                "monthly_pct": monthly_pct, "ytd_pct": ytd_pct,
                "sparkline": sparkline,
            })
        except Exception as e:
            logger.warning(f"market_overview {sym}: {e}")
            result.append({"symbol": sym, "name": name})
    return result


@router.get("/market/news")
def market_news_feed():
    return get_market_news("stock market investing", days=3, max_articles=20)


# ── stock detail endpoints ────────────────────────────────────────────────────

@router.get("/stock/{ticker}/detail")
def stock_detail_full(ticker: str):
    """Comprehensive aggregated data for the stock detail header + right panel."""
    ticker = ticker.upper()
    try:
        t = yf.Ticker(ticker)
        info = t.info
        next_earn = None
        try:
            cal = t.calendar
            if cal is not None:
                if isinstance(cal, dict):
                    dates = cal.get("Earnings Date") or []
                    next_earn = str(dates[0].date()) if dates else None
                elif hasattr(cal, "loc") and "Earnings Date" in cal.index:
                    for v in cal.loc["Earnings Date"]:
                        if hasattr(v, "date"):
                            next_earn = str(v.date()); break
        except Exception:
            pass

        oracle_val, val_models = _compute_valuation(info)
        moat = _compute_moat(info)
        radar = _compute_radar(info)
        vmi = _compute_vmi(info)
        price = _s(info.get("currentPrice") or info.get("regularMarketPrice"))
        prev  = _s(info.get("previousClose"))

        ex_div = info.get("exDividendDate")
        if ex_div and isinstance(ex_div, (int, float)):
            try:
                ex_div = datetime.utcfromtimestamp(ex_div).strftime("%Y-%m-%d")
            except Exception:
                ex_div = None

        return {
            "ticker": ticker,
            "company_name": info.get("longName"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "exchange": info.get("exchange"),
            "country": info.get("country"),
            "website": info.get("website"),
            "description": info.get("longBusinessSummary"),
            "employees": info.get("fullTimeEmployees"),
            "current_price": round(price, 2) if price else None,
            "previous_close": round(prev, 2) if prev else None,
            "price_change": round(price - prev, 2) if price and prev else None,
            "price_change_pct": round((price / prev - 1) * 100, 2) if price and prev and prev != 0 else None,
            "market_cap": info.get("marketCap"),
            "enterprise_value": info.get("enterpriseValue"),
            "shares_outstanding": info.get("sharesOutstanding"),
            "volume": info.get("volume"),
            "avg_volume": info.get("averageVolume"),
            "week_52_high": info.get("fiftyTwoWeekHigh"),
            "week_52_low": info.get("fiftyTwoWeekLow"),
            "pe_ratio": _s(info.get("trailingPE")),
            "forward_pe": _s(info.get("forwardPE")),
            "peg_ratio": _s(info.get("pegRatio")),
            "price_to_book": _s(info.get("priceToBook")),
            "price_to_sales": _s(info.get("priceToSalesTrailing12Months")),
            "ev_to_ebitda": _s(info.get("enterpriseToEbitda")),
            "ev_to_revenue": _s(info.get("enterpriseToRevenue")),
            "beta": _s(info.get("beta")),
            "eps": _s(info.get("trailingEps")),
            "forward_eps": _s(info.get("forwardEps")),
            "dividend_yield": _s(info.get("dividendYield")),
            "dividend_rate": _s(info.get("dividendRate")),
            "ex_dividend_date": ex_div,
            "payout_ratio": _s(info.get("payoutRatio")),
            "gross_margins": _s(info.get("grossMargins")),
            "operating_margins": _s(info.get("operatingMargins")),
            "net_margins": _s(info.get("profitMargins")),
            "roe": _s(info.get("returnOnEquity")),
            "roa": _s(info.get("returnOnAssets")),
            "revenue": info.get("totalRevenue"),
            "revenue_growth": _s(info.get("revenueGrowth")),
            "earnings_growth": _s(info.get("earningsGrowth")),
            "debt_to_equity": _s(info.get("debtToEquity")),
            "current_ratio": _s(info.get("currentRatio")),
            "quick_ratio": _s(info.get("quickRatio")),
            "total_debt": info.get("totalDebt"),
            "total_cash": info.get("totalCash"),
            "free_cashflow": info.get("freeCashflow"),
            "operating_cashflow": info.get("operatingCashflow"),
            "ebitda": info.get("ebitda"),
            "book_value": _s(info.get("bookValue")),
            "analyst_target": _s(info.get("targetMeanPrice")),
            "analyst_target_high": _s(info.get("targetHighPrice")),
            "analyst_target_low": _s(info.get("targetLowPrice")),
            "recommendation": info.get("recommendationKey"),
            "short_interest": _s(info.get("shortPercentOfFloat")),
            "moat": moat,
            "oracle_value": oracle_val,
            "valuation_models": val_models,
            "radar_scores": radar,
            "vmi": vmi,
            "next_earnings_date": next_earn,
        }
    except Exception as e:
        logger.error(f"stock_detail_full {ticker}: {e}")
        return {"error": str(e), "ticker": ticker}


@router.get("/stock/{ticker}/chart")
def stock_chart(ticker: str, period: str = "1y"):
    """OHLCV in TradingView Lightweight Charts format."""
    ticker = ticker.upper()
    try:
        period_map = {"1D": "5d", "1W": "1mo", "1M": "1mo", "3M": "3mo", "6M": "6mo", "1Y": "1y", "3Y": "3y", "5Y": "5y"}
        yf_period = period_map.get(period.upper(), period)
        hist = yf.Ticker(ticker).history(period=yf_period)
        if hist.empty:
            return {"error": "No data", "ticker": ticker}
        data = [
            {
                "time": str(row.name.date()),
                "open": round(float(row["Open"]), 4),
                "high": round(float(row["High"]), 4),
                "low": round(float(row["Low"]), 4),
                "close": round(float(row["Close"]), 4),
                "volume": int(row["Volume"]),
            }
            for _, row in hist.iterrows()
        ]
        return {"ticker": ticker, "period": period, "data": data}
    except Exception as e:
        return {"error": str(e), "ticker": ticker}


@router.get("/stock/{ticker}/financials")
def stock_financials(ticker: str):
    """Income statement, balance sheet, cash flow — annual + quarterly."""
    ticker = ticker.upper()
    try:
        t = yf.Ticker(ticker)

        def df_to_dict(df, cols=4):
            if df is None or df.empty:
                return {}
            result = {}
            for col in df.columns[:cols]:
                yr = str(col.year) if hasattr(col, "year") else str(col)
                result[yr] = {k: (None if (v != v) else (round(float(v)) if isinstance(v, float) else v))
                              for k, v in df[col].items()}
            return result

        return {
            "ticker": ticker,
            "income_annual":   df_to_dict(t.financials),
            "income_quarterly": df_to_dict(t.quarterly_financials, 8),
            "balance_annual":  df_to_dict(t.balance_sheet),
            "balance_quarterly": df_to_dict(t.quarterly_balance_sheet, 8),
            "cashflow_annual": df_to_dict(t.cashflow),
            "cashflow_quarterly": df_to_dict(t.quarterly_cashflow, 8),
        }
    except Exception as e:
        return {"error": str(e), "ticker": ticker}


@router.get("/stock/{ticker}/metrics")
def stock_metrics(ticker: str):
    """Full metrics table for Company Metrics tab."""
    ticker = ticker.upper()
    try:
        info = yf.Ticker(ticker).info
        return {
            "ticker": ticker,
            "valuation": {
                "pe_ratio":     _s(info.get("trailingPE")),
                "forward_pe":   _s(info.get("forwardPE")),
                "peg_ratio":    _s(info.get("pegRatio")),
                "price_to_sales": _s(info.get("priceToSalesTrailing12Months")),
                "price_to_book":  _s(info.get("priceToBook")),
                "ev_to_ebitda":   _s(info.get("enterpriseToEbitda")),
                "ev_to_revenue":  _s(info.get("enterpriseToRevenue")),
                "earnings_yield": round(1 / _s(info.get("trailingPE"), 100) * 100, 2),
            },
            "profitability": {
                "gross_margin":  _pct(info.get("grossMargins")),
                "op_margin":     _pct(info.get("operatingMargins")),
                "net_margin":    _pct(info.get("profitMargins")),
                "roe":           _pct(info.get("returnOnEquity")),
                "roa":           _pct(info.get("returnOnAssets")),
                "ebitda_margin": round(_s(info.get("ebitda"), 0) / max(_s(info.get("totalRevenue"), 1), 1) * 100, 2) if info.get("ebitda") and info.get("totalRevenue") else None,
            },
            "growth": {
                "revenue_yoy":   _pct(info.get("revenueGrowth")),
                "earnings_yoy":  _pct(info.get("earningsGrowth")),
                "eps_yoy":       _pct(info.get("earningsGrowth")),
                "rev_per_share_growth": None,
            },
            "financial_health": {
                "current_ratio": _s(info.get("currentRatio")),
                "quick_ratio":   _s(info.get("quickRatio")),
                "debt_to_equity": _s(info.get("debtToEquity")),
                "interest_coverage": None,
                "debt_to_ebitda": round(_s(info.get("totalDebt"), 0) / max(_s(info.get("ebitda"), 1), 1), 2) if info.get("totalDebt") and info.get("ebitda") else None,
                "fcf_per_share": round(_s(info.get("freeCashflow"), 0) / max(_s(info.get("sharesOutstanding"), 1), 1), 2) if info.get("freeCashflow") and info.get("sharesOutstanding") else None,
            },
            "dividends": {
                "yield":           _pct(info.get("dividendYield")),
                "rate":            _s(info.get("dividendRate")),
                "payout_ratio":    _pct(info.get("payoutRatio")),
                "ex_date":         None,
            },
        }
    except Exception as e:
        return {"error": str(e), "ticker": ticker}


@router.get("/stock/{ticker}/earnings")
def stock_earnings(ticker: str):
    """Earnings history with EPS beats/misses."""
    ticker = ticker.upper()
    try:
        t = yf.Ticker(ticker)

        # Try multiple yfinance attributes for earnings history
        hist = None
        for attr in ("earnings_history", "quarterly_earnings"):
            try:
                h = getattr(t, attr, None)
                if h is not None and hasattr(h, "empty") and not h.empty:
                    hist = h
                    break
            except Exception:
                pass

        records = []
        if hist is not None:
            # Normalise column names across yfinance versions
            cols = {c.lower(): c for c in hist.columns}
            actual_col   = cols.get("epsactual") or cols.get("eps actual") or cols.get("reported eps")
            estimate_col = cols.get("epsestimate") or cols.get("eps estimate") or cols.get("estimated eps")
            surprise_col = cols.get("epssurprise") or cols.get("surprise(%)")

            for idx, row in hist.head(12).iterrows():
                actual   = _s(row.get(actual_col)) if actual_col else None
                estimate = _s(row.get(estimate_col)) if estimate_col else None
                surprise_raw = _s(row.get(surprise_col)) if surprise_col else None
                date_val = idx
                records.append({
                    "period": str(date_val.date() if hasattr(date_val, "date") else date_val),
                    "eps_actual":   round(actual, 2) if actual is not None else None,
                    "eps_estimate": round(estimate, 2) if estimate is not None else None,
                    "eps_surprise": round(float(surprise_raw), 2) if surprise_raw is not None else (
                        round((actual / estimate - 1) * 100, 2) if actual is not None and estimate is not None and estimate != 0 else None
                    ),
                    "beat": bool(actual > estimate) if actual is not None and estimate is not None else None,
                })

        # Next earnings date
        next_earn = None
        try:
            cal = t.calendar
            if cal is not None:
                if isinstance(cal, dict):
                    dates = cal.get("Earnings Date") or []
                    next_earn = str(dates[0].date()) if dates else None
                elif hasattr(cal, "loc"):
                    row = cal.loc["Earnings Date"] if "Earnings Date" in cal.index else None
                    if row is not None:
                        for v in (row if hasattr(row, "__iter__") else [row]):
                            if hasattr(v, "date"):
                                next_earn = str(v.date())
                                break
        except Exception:
            pass

        return {"ticker": ticker, "next_earnings_date": next_earn, "history": records}
    except Exception as e:
        return {"error": str(e), "ticker": ticker}


@router.get("/stock/{ticker}/dividends")
def stock_dividends(ticker: str):
    """Dividend history, yield, payout ratio."""
    ticker = ticker.upper()
    try:
        t = yf.Ticker(ticker)
        info = t.info
        divs = t.dividends

        annual = {}
        records = []
        if divs is not None and not divs.empty:
            for date, amount in divs.items():
                yr = date.year
                annual[yr] = annual.get(yr, 0) + float(amount)
                records.append({"date": str(date.date()), "amount": round(float(amount), 4)})
            records.reverse()

        ex_div = info.get("exDividendDate")
        if isinstance(ex_div, (int, float)):
            try:
                ex_div = datetime.utcfromtimestamp(ex_div).strftime("%Y-%m-%d")
            except Exception:
                ex_div = None

        return {
            "ticker": ticker,
            "yield": _pct(info.get("dividendYield")),
            "rate": _s(info.get("dividendRate")),
            "payout_ratio": _pct(info.get("payoutRatio")),
            "ex_date": ex_div,
            "five_year_avg_yield": _pct(info.get("fiveYearAvgDividendYield")),
            "annual": [{"year": yr, "total": round(amt, 4)} for yr, amt in sorted(annual.items())],
            "history": records[:40],
        }
    except Exception as e:
        return {"error": str(e), "ticker": ticker}


@router.get("/stock/{ticker}/news")
def stock_news_feed(ticker: str):
    """Latest news with thumbnail URLs."""
    ticker = ticker.upper()
    try:
        t = yf.Ticker(ticker)
        company = (t.info or {}).get("longName", "")
        return get_stock_news(ticker, company_name=company, days=14, max_articles=20)
    except Exception as e:
        return {"error": str(e), "ticker": ticker}


@router.get("/stock/{ticker}/valuation")
def stock_valuation(ticker: str):
    """Intrinsic value model comparison."""
    ticker = ticker.upper()
    try:
        info = yf.Ticker(ticker).info
        oracle, models = _compute_valuation(info)
        price = _s(info.get("currentPrice") or info.get("regularMarketPrice"))
        return {
            "ticker": ticker,
            "current_price": round(price, 2) if price else None,
            "oracle_value": oracle,
            "models": models,
            "upside_pct": round((oracle / price - 1) * 100, 1) if oracle and price and price > 0 else None,
        }
    except Exception as e:
        return {"error": str(e), "ticker": ticker}


@router.get("/stock/{ticker}/vmi")
def stock_vmi(ticker: str):
    """VMI scoring criteria."""
    ticker = ticker.upper()
    try:
        info = yf.Ticker(ticker).info
        return {"ticker": ticker, **_compute_vmi(info)}
    except Exception as e:
        return {"error": str(e), "ticker": ticker}


@router.get("/stock/{ticker}/compare")
def stock_compare_data(ticker: str):
    """Flat metrics snapshot for the compare table."""
    ticker = ticker.upper()
    try:
        info = yf.Ticker(ticker).info
        price = _s(info.get("currentPrice") or info.get("regularMarketPrice"))
        prev  = _s(info.get("previousClose"))
        chg_pct = round((price / prev - 1) * 100, 2) if price and prev and prev != 0 else None
        return {
            "ticker": ticker,
            "name": info.get("longName"),
            "price": round(price, 2) if price else None,
            "change_pct": chg_pct,
            "market_cap": info.get("marketCap"),
            "pe_ratio": _s(info.get("trailingPE")),
            "peg_ratio": _s(info.get("pegRatio")),
            "price_to_sales": _s(info.get("priceToSalesTrailing12Months")),
            "dividend_yield": _pct(info.get("dividendYield")),
            "debt_to_equity": _s(info.get("debtToEquity")),
            "current_ratio": _s(info.get("currentRatio")),
            "roe": _pct(info.get("returnOnEquity")),
            "revenue": info.get("totalRevenue"),
            "net_income": info.get("netIncomeToCommon"),
            "eps": _s(info.get("trailingEps")),
            "gross_margin": _pct(info.get("grossMargins")),
            "sector": info.get("sector"),
        }
    except Exception as e:
        return {"error": str(e), "ticker": ticker}
