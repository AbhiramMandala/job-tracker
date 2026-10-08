"""Internal Pydantic models for Google organic results. All fields optional."""

from pydantic import BaseModel, Field


class OrganicResult(BaseModel):
    position: int = 0
    title: str = ""
    link: str = ""
    displayed_link: str = ""
    snippet: str = ""
    source: str = ""


def parse_organic_results(body: object) -> list[OrganicResult]:
    """Extract organic_results defensively. Empty list is valid (zero results)."""
    if not isinstance(body, dict):
        return []
    raw_items = body.get("organic_results")
    if raw_items is None:
        return []
    if not isinstance(raw_items, list):
        return []
    results: list[OrganicResult] = []
    for position, raw in enumerate(raw_items, start=1):
        if not isinstance(raw, dict):
            continue
        results.append(
            OrganicResult(
                position=int(raw.get("position") or position),
                title=str(raw.get("title") or ""),
                link=str(raw.get("link") or ""),
                displayed_link=str(raw.get("displayed_link") or ""),
                snippet=str(raw.get("snippet") or ""),
                source=str(raw.get("source") or ""),
            )
        )
    return results


class NewsItem(BaseModel):
    title: str = ""
    link: str = ""
    source: str = ""
    snippet: str = ""
    date: str = ""
    iso_date: str = ""


def parse_news_results(body: object) -> list[NewsItem]:
    """Extract news_results defensively. Empty list is valid (zero results)."""
    if not isinstance(body, dict):
        return []
    raw_items = body.get("news_results")
    if raw_items is None:
        return []
    if not isinstance(raw_items, list):
        return []
    items: list[NewsItem] = []
    for raw in raw_items:
        if not isinstance(raw, dict):
            continue
        source = raw.get("source")
        source_name = ""
        if isinstance(source, dict):
            source_name = str(source.get("name") or "")
        elif isinstance(source, str):
            source_name = source
        items.append(
            NewsItem(
                title=str(raw.get("title") or ""),
                link=str(raw.get("link") or ""),
                source=source_name,
                snippet=str(raw.get("snippet") or ""),
                date=str(raw.get("date") or ""),
                iso_date=str(raw.get("iso_date") or ""),
            )
        )
    return items
