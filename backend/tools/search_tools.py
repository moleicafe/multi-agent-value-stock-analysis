import os
from dotenv import load_dotenv
from tavily import TavilyClient

load_dotenv()

_client = None


def _get_client() -> TavilyClient:
    global _client
    if _client is None:
        _client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
    return _client


def web_search(query: str, max_results: int = 5) -> dict:
    """Search the web and return relevant results with content snippets."""
    try:
        client = _get_client()
        response = client.search(
            query=query,
            max_results=max_results,
            search_depth="basic",
            include_answer=True,
        )
        results = []
        for r in response.get("results", []):
            results.append({
                "title": r.get("title"),
                "url": r.get("url"),
                "content": r.get("content"),
                "score": r.get("score"),
            })
        return {
            "query": query,
            "answer": response.get("answer"),
            "results": results,
        }
    except Exception as e:
        return {"error": str(e), "query": query}


def web_search_deep(query: str, max_results: int = 8) -> dict:
    """Deep search with full page content extraction. Use for detailed research."""
    try:
        client = _get_client()
        response = client.search(
            query=query,
            max_results=max_results,
            search_depth="advanced",
            include_answer=True,
            include_raw_content=False,
        )
        results = []
        for r in response.get("results", []):
            results.append({
                "title": r.get("title"),
                "url": r.get("url"),
                "content": r.get("content"),
                "score": r.get("score"),
            })
        return {
            "query": query,
            "answer": response.get("answer"),
            "results": results,
        }
    except Exception as e:
        return {"error": str(e), "query": query}
