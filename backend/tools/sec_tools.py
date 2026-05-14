import requests

SEC_BASE = "https://data.sec.gov"
HEADERS = {"User-Agent": "InvestAI research@investai.com"}


def _get_cik(ticker: str) -> str | None:
    """Resolve ticker to SEC CIK number."""
    try:
        resp = requests.get(
            "https://efts.sec.gov/LATEST/search-index?q=%22{}%22&dateRange=custom&startdt=2020-01-01&forms=10-K".format(ticker),
            headers=HEADERS,
            timeout=10,
        )
        # Use the company tickers JSON as a more reliable source
        tickers_resp = requests.get(
            "https://www.sec.gov/files/company_tickers.json",
            headers=HEADERS,
            timeout=10,
        )
        tickers_resp.raise_for_status()
        data = tickers_resp.json()
        for entry in data.values():
            if entry.get("ticker", "").upper() == ticker.upper():
                return str(entry["cik_str"]).zfill(10)
        return None
    except Exception:
        return None


def get_sec_filings(ticker: str, form_type: str = "10-K", count: int = 5) -> dict:
    """Fetch recent SEC filings for a company. form_type: 10-K, 10-Q, 8-K, DEF 14A."""
    cik = _get_cik(ticker)
    if not cik:
        return {"error": f"Could not resolve CIK for {ticker}", "ticker": ticker}

    try:
        resp = requests.get(
            f"{SEC_BASE}/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type={form_type}&dateb=&owner=include&count={count}&search_text=&output=atom",
            headers=HEADERS,
            timeout=15,
        )
        # Use submissions endpoint instead — more reliable JSON
        sub_resp = requests.get(
            f"{SEC_BASE}/submissions/CIK{cik}.json",
            headers=HEADERS,
            timeout=15,
        )
        sub_resp.raise_for_status()
        sub_data = sub_resp.json()

        filings = sub_data.get("filings", {}).get("recent", {})
        forms = filings.get("form", [])
        dates = filings.get("filingDate", [])
        accession = filings.get("accessionNumber", [])
        descriptions = filings.get("primaryDocument", [])

        results = []
        for i, form in enumerate(forms):
            if form == form_type:
                acc_clean = accession[i].replace("-", "")
                results.append({
                    "form": form,
                    "filing_date": dates[i],
                    "accession_number": accession[i],
                    "url": f"https://www.sec.gov/Archives/edgar/full-index/{dates[i][:4]}/{dates[i][5:7]}/",
                    "viewer_url": f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type={form_type}&dateb=&owner=include&count=5",
                })
                if len(results) >= count:
                    break

        return {
            "ticker": ticker,
            "cik": cik,
            "company_name": sub_data.get("name"),
            "form_type": form_type,
            "filings": results,
        }
    except Exception as e:
        return {"error": str(e), "ticker": ticker}


def get_company_facts(ticker: str) -> dict:
    """Get standardized financial facts from SEC XBRL data."""
    cik = _get_cik(ticker)
    if not cik:
        return {"error": f"Could not resolve CIK for {ticker}", "ticker": ticker}

    try:
        resp = requests.get(
            f"{SEC_BASE}/api/xbrl/companyfacts/CIK{cik}.json",
            headers=HEADERS,
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()

        us_gaap = data.get("facts", {}).get("us-gaap", {})
        key_facts = {}

        # Extract the most useful metrics
        interesting = [
            "Revenues", "NetIncomeLoss", "EarningsPerShareBasic",
            "Assets", "Liabilities", "StockholdersEquity",
            "CashAndCashEquivalentsAtCarryingValue",
            "LongTermDebt", "CommonStockSharesOutstanding",
        ]
        for fact_name in interesting:
            if fact_name in us_gaap:
                units = us_gaap[fact_name].get("units", {})
                unit_key = list(units.keys())[0] if units else None
                if unit_key:
                    values = units[unit_key]
                    # Get last 4 annual (10-K) values
                    annual = [v for v in values if v.get("form") == "10-K"][-4:]
                    key_facts[fact_name] = [
                        {"value": v.get("val"), "end": v.get("end"), "unit": unit_key}
                        for v in annual
                    ]

        return {"ticker": ticker, "cik": cik, "key_facts": key_facts}
    except Exception as e:
        return {"error": str(e), "ticker": ticker}
