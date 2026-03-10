#!/usr/bin/env python3
"""Backfill entity extraction for already-ingested papers.

Runs LLM entity extraction on stored paper text and populates
the entities and paper_entities tables.

Usage:
    cd rag-service
    python -m scripts.backfill_entities
"""

import asyncio
import sys
from pathlib import Path

# Add src to path so we can import research_owl
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from openai import AsyncOpenAI

from research_owl.config import settings
from research_owl.db import (
    add_paper_entity,
    init_db,
    list_papers,
    upsert_entity,
)
from research_owl.evaluation.dataset_generator import get_paper_text
from research_owl.ingestion.entity_extractor import extract_entities, normalize_name
from research_owl.models import PaperStatus


async def main() -> None:
    init_db(settings.db_path)

    openai_client = AsyncOpenAI(
        api_key=settings.ai_gateway_api_key,
        base_url=settings.ai_gateway_base_url,
    )

    papers = list_papers()
    completed = [p for p in papers if p.status == PaperStatus.completed]

    print(f"Found {len(completed)} completed papers to extract entities from.")

    total_entities = 0
    total_relations = 0

    for paper in completed:
        text = get_paper_text(paper.paper_id)
        if not text:
            print(f"  [{paper.paper_id}] No text found, skipping.")
            continue

        print(f"  [{paper.paper_id}] Extracting entities...")
        extraction = await extract_entities(
            paper_id=paper.paper_id,
            text=text,
            openai_client=openai_client,
            model=settings.llm_model,
        )

        for entity in extraction.entities:
            norm = normalize_name(entity.name)
            entity_id = upsert_entity(entity.type, entity.name, norm, entity.description)
            for rel in extraction.relations:
                if rel.entity_name == entity.name:
                    add_paper_entity(paper.paper_id, entity_id, rel.predicate, rel.context)
                    total_relations += 1
            total_entities += 1

        print(f"  [{paper.paper_id}] {len(extraction.entities)} entities, {len(extraction.relations)} relations.")

    print(f"\nDone. Total entities: {total_entities}, Total relations: {total_relations}")


if __name__ == "__main__":
    asyncio.run(main())
