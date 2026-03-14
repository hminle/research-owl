#!/usr/bin/env python3
"""Backfill citation graph for already-ingested papers.

Re-parses citations from stored paper text using LLM to extract
paper titles (not just arxiv IDs) and populates the citations table.

Usage:
    cd rag-service
    python -m scripts.backfill_citations
"""

import asyncio
import sys
from pathlib import Path

from openai import AsyncOpenAI

# Add src to path so we can import research_owl
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from research_owl.config import settings
from research_owl.db import clear_citations, init_db, list_papers, save_citations
from research_owl.evaluation.dataset_generator import get_paper_text
from research_owl.ingestion.citation_parser import parse_citations_llm
from research_owl.models import PaperStatus


async def main() -> None:
    init_db(settings.db_path)
    papers = list_papers()
    completed = [p for p in papers if p.status == PaperStatus.completed]

    print(f"Found {len(completed)} completed papers to backfill citations for.")

    openai_client = AsyncOpenAI(
        api_key=settings.ai_gateway_api_key,
        base_url=settings.ai_gateway_base_url,
    )

    # Clear existing citations so we rebuild with titles
    clear_citations()
    print("Cleared existing citations for fresh backfill.")

    total_citations = 0
    for paper in completed:
        text = get_paper_text(paper.paper_id)
        if not text:
            print(f"  [{paper.paper_id}] No text found, skipping.")
            continue

        citations = await parse_citations_llm(
            text,
            exclude_id=paper.paper_id,
            openai_client=openai_client,
            model=settings.llm_model,
        )
        if citations:
            save_citations(paper.paper_id, citations=citations)
            total_citations += len(citations)
            print(f"  [{paper.paper_id}] {len(citations)} citations stored.")
        else:
            print(f"  [{paper.paper_id}] No citations found.")

    print(f"\nDone. Total citations stored: {total_citations}")


if __name__ == "__main__":
    asyncio.run(main())
