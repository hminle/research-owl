#!/usr/bin/env python3
"""Backfill citation graph for already-ingested papers.

Re-parses citations from stored paper text and populates the citations table.
Run once after adding the citations table to the schema.

Usage:
    cd rag-service
    python -m scripts.backfill_citations
"""

import sys
from pathlib import Path

# Add src to path so we can import research_owl
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from research_owl.config import settings
from research_owl.db import init_db, list_papers, save_citations
from research_owl.evaluation.dataset_generator import get_paper_text
from research_owl.ingestion.citation_parser import parse_citations
from research_owl.models import PaperStatus


def main() -> None:
    init_db(settings.db_path)
    papers = list_papers()
    completed = [p for p in papers if p.status == PaperStatus.completed]

    print(f"Found {len(completed)} completed papers to backfill citations for.")

    total_citations = 0
    for paper in completed:
        text = get_paper_text(paper.paper_id)
        if not text:
            print(f"  [{paper.paper_id}] No text found, skipping.")
            continue

        citations = parse_citations(text, exclude_id=paper.paper_id)
        if citations:
            cited_ids = [c["arxiv_id"] for c in citations]
            save_citations(paper.paper_id, cited_ids)
            total_citations += len(cited_ids)
            print(f"  [{paper.paper_id}] {len(cited_ids)} citations stored.")
        else:
            print(f"  [{paper.paper_id}] No arxiv citations found.")

    print(f"\nDone. Total citations stored: {total_citations}")


if __name__ == "__main__":
    main()
