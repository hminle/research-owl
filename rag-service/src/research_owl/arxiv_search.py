"""ArXiv paper search using the arxiv Python library."""

from __future__ import annotations

import logging
from dataclasses import dataclass

import arxiv

logger = logging.getLogger(__name__)


@dataclass
class ArxivResult:
    arxiv_id: str
    title: str
    authors: list[str]
    abstract: str
    pdf_url: str
    published: str
    categories: list[str]


def search_arxiv(
    query: str,
    max_results: int = 10,
    sort_by: str = "relevance",
) -> list[ArxivResult]:
    """Search arXiv for papers matching a query.

    Args:
        query: Search query string.
        max_results: Maximum number of results (1-50).
        sort_by: Sort criterion — "relevance", "submitted_date", or "last_updated".

    Returns:
        List of ArxivResult with paper metadata.
    """
    max_results = min(max(1, max_results), 50)

    sort_map = {
        "relevance": arxiv.SortCriterion.Relevance,
        "submitted_date": arxiv.SortCriterion.SubmittedDate,
        "last_updated": arxiv.SortCriterion.LastUpdatedDate,
    }
    criterion = sort_map.get(sort_by, arxiv.SortCriterion.Relevance)

    client = arxiv.Client()
    search = arxiv.Search(
        query=query,
        max_results=max_results,
        sort_by=criterion,
    )

    results: list[ArxivResult] = []
    for paper in client.results(search):
        # Extract arxiv ID from the entry_id URL
        # e.g. "http://arxiv.org/abs/2301.12345v1" → "2301.12345"
        raw_id = paper.entry_id.split("/abs/")[-1]
        arxiv_id = raw_id.split("v")[0]  # strip version

        results.append(
            ArxivResult(
                arxiv_id=arxiv_id,
                title=paper.title,
                authors=[a.name for a in paper.authors],
                abstract=paper.summary,
                pdf_url=paper.pdf_url or f"https://arxiv.org/pdf/{arxiv_id}",
                published=paper.published.isoformat() if paper.published else "",
                categories=list(paper.categories),
            )
        )

    logger.info("arXiv search for %r returned %d results", query, len(results))
    return results
