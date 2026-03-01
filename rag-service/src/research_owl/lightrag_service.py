"""RAG-Anything service wrapper for Research Owl.

Handles initialization, multimodal document processing, querying, and graph export
using RAGAnything (built on LightRAG) with Docling parser and gpt-4o vision model
via Vercel AI Gateway.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

import numpy as np
from lightrag import LightRAG, QueryParam
from lightrag.llm.openai import openai_complete_if_cache, openai_embed
from lightrag.utils import wrap_embedding_func_with_attrs
from raganything import RAGAnything
from raganything.config import RAGAnythingConfig

logger = logging.getLogger(__name__)


class ResearchOwlRAG:
    """Wrapper around RAGAnything configured for Research Owl.

    RAGAnything extends LightRAG with multimodal document understanding:
    figures, tables, and equations become first-class KG entities analyzed
    by a vision LLM (gpt-4o).
    """

    def __init__(
        self,
        working_dir: str | Path,
        api_key: str,
        base_url: str,
        llm_model: str,
        vision_model: str,
        embed_model: str,
        embed_dimension: int,
        qdrant_url: str,
    ) -> None:
        self._working_dir = str(working_dir)
        self._api_key = api_key
        self._base_url = base_url
        self._llm_model = llm_model
        self._vision_model = vision_model
        self._embed_model = embed_model
        self._embed_dimension = embed_dimension
        self._qdrant_url = qdrant_url
        self._rag_anything: RAGAnything | None = None
        self._lightrag: LightRAG | None = None

    def _build_llm_func(self):
        api_key = self._api_key
        base_url = self._base_url
        llm_model = self._llm_model

        async def llm_model_func(
            prompt, system_prompt=None, history_messages=[], keyword_extraction=False, **kwargs
        ) -> str:
            return await openai_complete_if_cache(
                llm_model,
                prompt,
                system_prompt=system_prompt,
                history_messages=history_messages,
                api_key=api_key,
                base_url=base_url,
                **kwargs,
            )

        return llm_model_func

    def _build_vision_func(self):
        api_key = self._api_key
        base_url = self._base_url
        vision_model = self._vision_model

        async def vision_model_func(
            prompt, system_prompt=None, history_messages=[], image_data=None, **kwargs
        ) -> str:
            if image_data:
                # Build multipart content with image for the OpenAI vision API.
                images = [image_data] if isinstance(image_data, str) else image_data
                content = [{"type": "text", "text": prompt}]
                for img in images:
                    content.append({
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{img}"},
                    })
                messages = list(history_messages)
                if system_prompt:
                    messages.insert(0, {"role": "system", "content": system_prompt})
                messages.append({"role": "user", "content": content})
                return await openai_complete_if_cache(
                    vision_model,
                    "",
                    api_key=api_key,
                    base_url=base_url,
                    messages=messages,
                    **kwargs,
                )
            return await openai_complete_if_cache(
                vision_model,
                prompt,
                system_prompt=system_prompt,
                history_messages=history_messages,
                api_key=api_key,
                base_url=base_url,
                **kwargs,
            )

        return vision_model_func

    def _build_embedding_func(self):
        api_key = self._api_key
        base_url = self._base_url
        embed_model = self._embed_model
        embed_dim = self._embed_dimension

        @wrap_embedding_func_with_attrs(
            embedding_dim=embed_dim,
            max_token_size=8192,
            model_name=embed_model,
        )
        async def embedding_func(texts: list[str]) -> np.ndarray:
            return await openai_embed.func(
                texts,
                model=embed_model,
                api_key=api_key,
                base_url=base_url,
            )

        return embedding_func

    async def initialize(self) -> None:
        """Initialize RAGAnything with LightRAG + Docling parser + vision model."""
        Path(self._working_dir).mkdir(parents=True, exist_ok=True)

        os.environ.setdefault("QDRANT_URL", self._qdrant_url)
        os.environ.setdefault("OPENAI_API_KEY", self._api_key)

        self._lightrag = LightRAG(
            working_dir=self._working_dir,
            llm_model_func=self._build_llm_func(),
            llm_model_name=self._llm_model,
            embedding_func=self._build_embedding_func(),
            vector_storage="QdrantVectorDBStorage",
            graph_storage="NetworkXStorage",
        )
        await self._lightrag.initialize_storages()

        config = RAGAnythingConfig(
            parser="docling",
            working_dir=self._working_dir,
            parser_output_dir=str(Path(self._working_dir) / "parsed_output"),
        )

        self._rag_anything = RAGAnything(
            lightrag=self._lightrag,
            vision_model_func=self._build_vision_func(),
            config=config,
        )

        logger.info("RAGAnything initialized (working_dir=%s, parser=docling)", self._working_dir)

    async def finalize(self) -> None:
        """Clean up RAGAnything + LightRAG resources."""
        if self._rag_anything:
            await self._rag_anything.finalize_storages()
            logger.info("RAGAnything finalized")

    @property
    def rag(self) -> RAGAnything:
        if self._rag_anything is None:
            raise RuntimeError("RAGAnything not initialized. Call initialize() first.")
        return self._rag_anything

    @property
    def lightrag(self) -> LightRAG:
        if self._lightrag is None:
            raise RuntimeError("LightRAG not initialized. Call initialize() first.")
        return self._lightrag

    async def process_document(
        self,
        file_path: str | Path,
        output_dir: str | Path | None = None,
        doc_id: str | None = None,
    ) -> None:
        """Process a document with RAGAnything (Docling parser + gpt-4o vision).

        Parses the PDF, extracts multimodal content (figures, tables, equations),
        analyzes them with the vision LLM, and inserts everything into LightRAG
        as KG entities and vector chunks.
        """
        kwargs = {}
        if output_dir is not None:
            Path(output_dir).mkdir(parents=True, exist_ok=True)
            kwargs["output_dir"] = str(output_dir)
        if doc_id is not None:
            kwargs["doc_id"] = doc_id

        await self.rag.process_document_complete(
            file_path=str(file_path),
            **kwargs,
        )
        logger.info("RAGAnything processed document: %s", file_path)

    async def insert_citations(self, paper_id: str, paper_title: str, citations: list[dict]) -> None:
        """Inject citation relationships into LightRAG's knowledge graph.

        Args:
            paper_id: The arxiv ID of the citing paper.
            paper_title: Title of the citing paper.
            citations: List of dicts with keys: arxiv_id, title (optional).
        """
        if not citations:
            return

        entities = [
            {
                "entity_name": f"Paper:{paper_id}",
                "entity_type": "paper",
                "description": paper_title or f"Arxiv paper {paper_id}",
                "source_id": paper_id,
            }
        ]
        relationships = []

        for cite in citations:
            cited_id = cite["arxiv_id"]
            cited_title = cite.get("title", f"Arxiv paper {cited_id}")

            entities.append({
                "entity_name": f"Paper:{cited_id}",
                "entity_type": "paper",
                "description": cited_title,
                "source_id": paper_id,
            })
            relationships.append({
                "src_id": f"Paper:{paper_id}",
                "tgt_id": f"Paper:{cited_id}",
                "description": f"{paper_title or paper_id} cites {cited_title or cited_id}",
                "keywords": "citation reference",
                "weight": 1.0,
                "source_id": paper_id,
            })

        custom_kg = {"entities": entities, "relationships": relationships}
        await self.lightrag.ainsert_custom_kg(custom_kg)
        logger.info(
            "Injected %d citation relationships for paper %s",
            len(relationships),
            paper_id,
        )

    async def query(self, query: str, mode: str = "mix") -> str:
        """Query LightRAG with the specified mode.

        Modes: local, global, hybrid, mix, naive
        """
        valid_modes = {"local", "global", "hybrid", "mix", "naive"}
        if mode not in valid_modes:
            raise ValueError(f"Invalid mode '{mode}'. Must be one of {valid_modes}")

        result = await self.lightrag.aquery(
            query,
            param=QueryParam(mode=mode),
        )
        return str(result)

    def export_graph(self) -> dict:
        """Export the knowledge graph as nodes and edges for visualization."""
        try:
            graph = self.lightrag.chunk_entity_relation_graph
            if graph is None:
                return {"nodes": [], "edges": []}

            nodes = []
            for node_id, data in graph._graph.nodes(data=True):
                nodes.append({
                    "id": str(node_id),
                    "label": str(node_id),
                    "entity_type": data.get("entity_type", "unknown"),
                    "description": data.get("description", ""),
                })

            edges = []
            for src, tgt, data in graph._graph.edges(data=True):
                edges.append({
                    "source": str(src),
                    "target": str(tgt),
                    "description": data.get("description", ""),
                    "keywords": data.get("keywords", ""),
                    "weight": data.get("weight", 1.0),
                })

            return {"nodes": nodes, "edges": edges}
        except Exception:
            logger.exception("Failed to export graph")
            return {"nodes": [], "edges": []}
