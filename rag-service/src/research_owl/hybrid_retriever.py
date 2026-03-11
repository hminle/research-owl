"""Hybrid retriever combining graph traversal with vector search.

Uses entity matching to find relevant papers via the graph, then
scopes vector search to those papers. Merges results using
Reciprocal Rank Fusion (RRF).
"""

from __future__ import annotations

import asyncio
import logging

from research_owl.db import get_papers_for_entity_names, search_entities
from research_owl.graph_service import GraphService
from research_owl.qdrant_service import QdrantRAGService

logger = logging.getLogger(__name__)

# RRF constant (standard value from the original RRF paper)
_RRF_K = 60


def _rrf_score(rank: int) -> float:
    """Reciprocal Rank Fusion score for a given rank (0-indexed)."""
    return 1.0 / (_RRF_K + rank + 1)


class HybridRetriever:
    """Combines graph entity matching with Qdrant vector search."""

    def __init__(self, graph: GraphService, rag: QdrantRAGService) -> None:
        self.graph = graph
        self.rag = rag

    async def retrieve(self, query: str, top_k: int = 10) -> list[dict]:
        """Hybrid retrieval: graph-scoped + global vector search, merged with RRF.

        1. Find entities matching query terms (substring match, no LLM call)
        2. Get paper_ids connected to those entities via graph
        3. Scoped vector search on graph-discovered papers
        4. Global vector search as fallback
        5. Merge with RRF, annotate with graph context
        """
        # Step 1: Find matching entities by substring
        query_lower = query.lower()
        words = [w for w in query_lower.split() if len(w) > 2]

        matched_entities: list[dict] = []
        for word in words:
            matches = search_entities(query=word)
            matched_entities.extend(matches)

        # Deduplicate by entity ID
        seen_ids: set[int] = set()
        unique_entities: list[dict] = []
        for e in matched_entities:
            if e["id"] not in seen_ids:
                seen_ids.add(e["id"])
                unique_entities.append(e)

        entity_names = [e["normalized_name"] for e in unique_entities]

        # Step 2: Get paper IDs from graph
        graph_paper_ids = get_papers_for_entity_names(entity_names)

        # Build graph context map — call once, index by paper_id
        graph_context: dict[str, list[str]] = {}
        if entity_names:
            paper_results = self.graph.get_papers_for_entities(entity_names)
            for pr in paper_results:
                graph_context[pr["paper_id"]] = pr.get("connections", [])

        # Embed query once, reuse for all vector searches
        [query_vector] = await self.rag.embed_texts([query])

        # Step 3: Scoped vector search (only if we found graph papers)
        scoped_results: list[dict] = []
        if graph_paper_ids:
            scoped_tasks = [
                self.rag.search_chunks(
                    query=query,
                    top_k=3,
                    paper_id=pid,
                    query_vector=query_vector,
                )
                for pid in graph_paper_ids[:5]
            ]
            scoped_batches = await asyncio.gather(*scoped_tasks)
            for batch in scoped_batches:
                scoped_results.extend(batch)

        # Step 4: Global vector search
        global_results = await self.rag.search_chunks(
            query=query,
            top_k=top_k,
            query_vector=query_vector,
        )

        # Step 5: Merge with RRF
        # Score each chunk by its rank in each result set
        chunk_scores: dict[str, float] = {}
        chunk_data: dict[str, dict] = {}

        for rank, chunk in enumerate(scoped_results):
            cid = chunk["id"]
            chunk_scores[cid] = chunk_scores.get(cid, 0) + _rrf_score(rank)
            chunk_data[cid] = chunk

        for rank, chunk in enumerate(global_results):
            cid = chunk["id"]
            chunk_scores[cid] = chunk_scores.get(cid, 0) + _rrf_score(rank)
            chunk_data[cid] = chunk

        # Sort by combined RRF score
        sorted_ids = sorted(chunk_scores.keys(), key=lambda x: chunk_scores[x], reverse=True)

        results = []
        for cid in sorted_ids[:top_k]:
            chunk = chunk_data[cid]
            pid = chunk.get("paper_id", "")
            gc = graph_context.get(pid, [])
            chunk["graph_context"] = ", ".join(gc) if gc else ""
            chunk["rrf_score"] = chunk_scores[cid]
            results.append(chunk)

        logger.info(
            "Hybrid retrieval: %d entity matches, %d graph papers, %d scoped chunks, %d global chunks -> %d results",
            len(unique_entities), len(graph_paper_ids),
            len(scoped_results), len(global_results), len(results),
        )

        return results
