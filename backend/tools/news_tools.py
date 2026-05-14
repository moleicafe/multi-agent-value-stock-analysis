import os
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

NEWS_API_KEY = os.getenv("NEWS_API_KEY")
NEWS_BASE = "https://newsapi.org/v2"


def get_stock_news(ticker: str, company_name: str = "", days: int = 30, max_articles: int = 20) -> dict:
    """Fetch recent news articles for a stock. Returns titles, descriptions, sources, sentiment hints."""
    query = f"{ticker} stock"
    if company_name:
        query = f"{company_name} OR {ticker} stock"

    from_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

    try:
        resp = requests.get(
            f"{NEWS_BASE}/everything",
            params={
                "q": query,
                "from": from_date,
                "sortBy": "relevancy",
                "language": "en",
                "pageSize": max_articles,
                "apiKey": NEWS_API_KEY,
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()

        articles = []
        for a in data.get("articles", []):
            articles.append({
                "title": a.get("title"),
                "description": a.get("description"),
                "source": a.get("source", {}).get("name"),
                "published_at": a.get("publishedAt"),
                "url": a.get("url"),
                "urlToImage": a.get("urlToImage"),
            })

        return {
            "ticker": ticker,
            "query": query,
            "total_results": data.get("totalResults", 0),
            "articles": articles,
        }
    except Exception as e:
        return {"error": str(e), "ticker": ticker}


def get_market_news(topic: str = "stock market", days: int = 7, max_articles: int = 10) -> dict:
    """Fetch general market/macro news for context."""
    from_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    try:
        resp = requests.get(
            f"{NEWS_BASE}/everything",
            params={
                "q": topic,
                "from": from_date,
                "sortBy": "publishedAt",
                "language": "en",
                "pageSize": max_articles,
                "apiKey": NEWS_API_KEY,
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        articles = [
            {
                "title": a.get("title"),
                "description": a.get("description"),
                "source": a.get("source", {}).get("name"),
                "published_at": a.get("publishedAt"),
                "url": a.get("url"),
                "urlToImage": a.get("urlToImage"),
            }
            for a in data.get("articles", [])
        ]
        return {"topic": topic, "articles": articles}
    except Exception as e:
        return {"error": str(e), "topic": topic}
