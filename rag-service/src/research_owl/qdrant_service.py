"""Qdrant-native RAG service for Research Owl.

Direct Qdrant vector storage,
OpenAI embeddings (text-embedding-3-small), and GPT-4o vision
for multimodal document understanding.
"""

from __future__ import annotations

import base64
import logging
import uuid
from pathlib import Path

from openai import AsyncOpenAI
from qdrant_client import AsyncQdrantClient, models

logger = logging.getLogger(__name__)

COLLECTION_NAME = "research_owl"
CHUNK_SIZE = 1500  # characters per chunk
CHUNK_OVERLAP = 200  # overlap between chunks


def _chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks."""
    if not text:
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk.strip())
        if end >= len(text):
            break
        start = end - overlap
    return chunks


class QdrantRAGService:
    """Qdrant-native RAG service with OpenAI embeddings and GPT-4o vision."""

    def __init__(
        self,
        api_key: str,
        base_url: str,
        llm_model: str,
        vision_model: str,
        embed_model: str,
        embed_dimension: int,
        qdrant_url: str,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url
        self._llm_model = llm_model
        self._vision_model = vision_model
        self._embed_model = embed_model
        self._embed_dimension = embed_dimension
        self._qdrant_url = qdrant_url
        self._openai: AsyncOpenAI | None = None
        self._qdrant: AsyncQdrantClient | None = None

    async def initialize(self) -> None:
        """Initialize OpenAI client and Qdrant collection."""
        self._openai = AsyncOpenAI(
            api_key=self._api_key,
            base_url=self._base_url,
        )
        self._qdrant = AsyncQdrantClient(url=self._qdrant_url)

        # Create collection if it doesn't exist
        collections = await self._qdrant.get_collections()
        exists = any(c.name == COLLECTION_NAME for c in collections.collections)
        if not exists:
            await self._qdrant.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=models.VectorParams(
                    size=self._embed_dimension,
                    distance=models.Distance.COSINE,
                ),
            )
            # Create payload indices for filtering
            await self._qdrant.create_payload_index(
                collection_name=COLLECTION_NAME,
                field_name="paper_id",
                field_schema=models.PayloadSchemaType.KEYWORD,
            )
            await self._qdrant.create_payload_index(
                collection_name=COLLECTION_NAME,
                field_name="chunk_type",
                field_schema=models.PayloadSchemaType.KEYWORD,
            )
            logger.info("Created Qdrant collection: %s", COLLECTION_NAME)
        else:
            logger.info("Qdrant collection already exists: %s", COLLECTION_NAME)

    async def finalize(self) -> None:
        """Clean up resources."""
        if self._qdrant:
            await self._qdrant.close()
            logger.info("Qdrant client closed")

    @property
    def openai(self) -> AsyncOpenAI:
        if self._openai is None:
            raise RuntimeError("Service not initialized. Call initialize() first.")
        return self._openai

    @property
    def qdrant(self) -> AsyncQdrantClient:
        if self._qdrant is None:
            raise RuntimeError("Service not initialized. Call initialize() first.")
        return self._qdrant

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Embed texts using OpenAI text-embedding-3-small."""
        if not texts:
            return []
        response = await self.openai.embeddings.create(
            model=self._embed_model,
            input=texts,
        )
        return [item.embedding for item in response.data]

    async def describe_image(self, image_path: Path, context: str = "") -> str:
        """Describe an image using GPT-4o vision."""
        with open(image_path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode("utf-8")

        suffix = image_path.suffix.lower()
        mime = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif"}.get(suffix, "image/png")

        prompt = "Describe this figure/table from a research paper in detail. Include all key information, data points, labels, and relationships shown."
        if context:
            prompt += f"\n\nContext from the paper: {context}"

        response = await self.openai.chat.completions.create(
            model=self._vision_model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_data}"}},
                    ],
                }
            ],
            max_tokens=500,
        )
        return response.choices[0].message.content or ""

    async def ingest_document(
        self,
        paper_id: str,
        full_text: str,
        title: str | None = None,
        image_dir: Path | None = None,
    ) -> dict:
        """Chunk text, describe images, embed everything, store in Qdrant.

        Returns dict with num_chunks, num_images.
        """
        points: list[models.PointStruct] = []

        # Chunk and embed text
        chunks = _chunk_text(full_text)
        if chunks:
            embeddings = await self.embed_texts(chunks)
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                points.append(
                    models.PointStruct(
                        id=str(uuid.uuid4()),
                        vector=embedding,
                        payload={
                            "paper_id": paper_id,
                            "paper_title": title or "",
                            "chunk_type": "text",
                            "chunk_index": i,
                            "content": chunk,
                        },
                    )
                )

        # Process images with vision model
        num_images = 0
        if image_dir and image_dir.exists():
            image_files = sorted(
                f for f in image_dir.rglob("*")
                if f.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif"}
            )
            for img_file in image_files:
                try:
                    description = await self.describe_image(img_file, context=title or "")
                    if description:
                        [embedding] = await self.embed_texts([description])
                        points.append(
                            models.PointStruct(
                                id=str(uuid.uuid4()),
                                vector=embedding,
                                payload={
                                    "paper_id": paper_id,
                                    "paper_title": title or "",
                                    "chunk_type": "image",
                                    "chunk_index": num_images,
                                    "content": description,
                                    "image_filename": img_file.name,
                                },
                            )
                        )
                        num_images += 1
                except Exception:
                    logger.exception("Failed to process image: %s", img_file)

        # Upsert to Qdrant in batches
        batch_size = 100
        for i in range(0, len(points), batch_size):
            batch = points[i : i + batch_size]
            await self.qdrant.upsert(
                collection_name=COLLECTION_NAME,
                points=batch,
            )

        logger.info(
            "Ingested paper %s: %d text chunks, %d images",
            paper_id, len(chunks), num_images,
        )
        return {"num_chunks": len(chunks), "num_images": num_images}

    async def count_vectors(self, paper_id: str) -> int:
        """Count vectors for a paper in Qdrant."""
        result = await self.qdrant.count(
            collection_name=COLLECTION_NAME,
            count_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="paper_id",
                        match=models.MatchValue(value=paper_id),
                    )
                ]
            ),
            exact=True,
        )
        return result.count

    async def delete_paper_chunks(self, paper_id: str) -> None:
        """Delete all chunks for a paper from Qdrant."""
        await self.qdrant.delete(
            collection_name=COLLECTION_NAME,
            points_selector=models.FilterSelector(
                filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="paper_id",
                            match=models.MatchValue(value=paper_id),
                        )
                    ]
                )
            ),
        )
        logger.info("Deleted chunks for paper %s", paper_id)

    async def query(self, query: str, mode: str = "semantic", top_k: int = 5) -> str:
        """Query the RAG pipeline: embed query, search Qdrant, generate answer with LLM.

        Modes:
        - semantic: standard cosine similarity search
        - paper:<paper_id>: search within a specific paper
        """
        contexts = await self.retrieve_contexts(query, mode=mode, top_k=top_k)

        if not contexts:
            return "I could not find relevant information to answer this question."

        context_text = "\n\n---\n\n".join(contexts)

        response = await self.openai.chat.completions.create(
            model=self._llm_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a research assistant. Answer the question based on the provided context from research papers. "
                        "If the context doesn't contain enough information, say so. Be specific and cite details from the context."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Context:\n{context_text}\n\nQuestion: {query}",
                },
            ],
            max_tokens=1000,
        )
        return response.choices[0].message.content or ""

    async def retrieve_contexts(self, query: str, mode: str = "semantic", top_k: int = 5) -> list[str]:
        """Retrieve context chunks from Qdrant without generating an answer.

        Used for evaluation and for the query pipeline.
        """
        [query_embedding] = await self.embed_texts([query])

        # Build filter if mode specifies a paper
        query_filter = None
        if mode.startswith("paper:"):
            paper_id = mode.split(":", 1)[1]
            query_filter = models.Filter(
                must=[
                    models.FieldCondition(
                        key="paper_id",
                        match=models.MatchValue(value=paper_id),
                    )
                ]
            )

        results = await self.qdrant.query_points(
            collection_name=COLLECTION_NAME,
            query=query_embedding,
            query_filter=query_filter,
            limit=top_k,
            with_payload=True,
        )

        contexts = []
        for point in results.points:
            content = point.payload.get("content", "") if point.payload else ""
            paper_title = point.payload.get("paper_title", "") if point.payload else ""
            chunk_type = point.payload.get("chunk_type", "text") if point.payload else "text"
            prefix = f"[{paper_title}]" if paper_title else ""
            if chunk_type == "image":
                prefix += " [Figure/Table]"
            if content:
                contexts.append(f"{prefix} {content}".strip())

        return contexts

    async def list_chunks(
        self,
        paper_id: str | None = None,
        chunk_type: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> dict:
        """List chunks for the document/chunk explorer.

        Returns dict with items (list of chunk dicts) and total count.
        """
        must_conditions = []
        if paper_id:
            must_conditions.append(
                models.FieldCondition(
                    key="paper_id",
                    match=models.MatchValue(value=paper_id),
                )
            )
        if chunk_type:
            must_conditions.append(
                models.FieldCondition(
                    key="chunk_type",
                    match=models.MatchValue(value=chunk_type),
                )
            )

        filter_ = models.Filter(must=must_conditions) if must_conditions else None

        # Get count
        count_result = await self.qdrant.count(
            collection_name=COLLECTION_NAME,
            count_filter=filter_,
            exact=True,
        )

        # Scroll through chunks — fetch offset+limit and slice
        fetch_limit = offset + limit
        points, _next_offset = await self.qdrant.scroll(
            collection_name=COLLECTION_NAME,
            scroll_filter=filter_,
            limit=fetch_limit,
            with_payload=True,
            with_vectors=False,
        )
        points = points[offset:]

        items = []
        for point in points:
            payload = point.payload or {}
            items.append({
                "id": str(point.id),
                "paper_id": payload.get("paper_id", ""),
                "paper_title": payload.get("paper_title", ""),
                "chunk_type": payload.get("chunk_type", "text"),
                "chunk_index": payload.get("chunk_index", 0),
                "content": payload.get("content", ""),
                "image_filename": payload.get("image_filename"),
            })

        return {"items": items, "total": count_result.count}

    async def search_chunks(self, query: str, top_k: int = 10, paper_id: str | None = None) -> list[dict]:
        """Search chunks by semantic similarity for the explorer."""
        [query_embedding] = await self.embed_texts([query])

        query_filter = None
        if paper_id:
            query_filter = models.Filter(
                must=[
                    models.FieldCondition(
                        key="paper_id",
                        match=models.MatchValue(value=paper_id),
                    )
                ]
            )

        results = await self.qdrant.query_points(
            collection_name=COLLECTION_NAME,
            query=query_embedding,
            query_filter=query_filter,
            limit=top_k,
            with_payload=True,
        )

        items = []
        for point in results.points:
            payload = point.payload or {}
            items.append({
                "id": str(point.id),
                "paper_id": payload.get("paper_id", ""),
                "paper_title": payload.get("paper_title", ""),
                "chunk_type": payload.get("chunk_type", "text"),
                "chunk_index": payload.get("chunk_index", 0),
                "content": payload.get("content", ""),
                "image_filename": payload.get("image_filename"),
                "score": point.score,
            })

        return items

    async def get_collection_stats(self) -> dict:
        """Get collection statistics for the explorer."""
        try:
            info = await self.qdrant.get_collection(COLLECTION_NAME)
            return {
                "total_points": info.points_count or 0,
                "vectors_count": info.indexed_vectors_count or 0,
                "status": str(info.status) if info.status else "unknown",
            }
        except Exception:
            return {"total_points": 0, "vectors_count": 0, "status": "unknown"}
