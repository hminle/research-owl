import uuid

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)

from research_owl.models import SearchResult


class QdrantService:
    BATCH_SIZE = 100

    def __init__(self, url: str, collection_name: str, dimension: int):
        self._client = QdrantClient(url=url)
        self._collection = collection_name
        self._dimension = dimension

    def ensure_collection(self) -> None:
        collections = [c.name for c in self._client.get_collections().collections]
        if self._collection not in collections:
            self._client.create_collection(
                collection_name=self._collection,
                vectors_config=VectorParams(
                    size=self._dimension, distance=Distance.COSINE
                ),
            )

    def upsert_chunks(
        self,
        paper_id: str,
        texts: list[str],
        vectors: list[list[float]],
        metadatas: list[dict],
    ) -> None:
        points = [
            PointStruct(
                id=str(uuid.uuid4()),
                vector=vec,
                payload={"paper_id": paper_id, "text": text, **meta},
            )
            for text, vec, meta in zip(texts, vectors, metadatas)
        ]
        for i in range(0, len(points), self.BATCH_SIZE):
            batch = points[i : i + self.BATCH_SIZE]
            self._client.upsert(collection_name=self._collection, points=batch)

    def search(
        self,
        query_vector: list[float],
        top_k: int = 5,
        paper_id: str | None = None,
    ) -> list[SearchResult]:
        query_filter = None
        if paper_id:
            query_filter = Filter(
                must=[FieldCondition(key="paper_id", match=MatchValue(value=paper_id))]
            )
        hits = self._client.query_points(
            collection_name=self._collection,
            query=query_vector,
            query_filter=query_filter,
            limit=top_k,
        ).points
        results = []
        for hit in hits:
            payload = hit.payload or {}
            results.append(
                SearchResult(
                    paper_id=payload.get("paper_id", ""),
                    text=payload.get("text", ""),
                    score=hit.score,  # type: ignore[arg-type]
                    chunk_type=payload.get("chunk_type", "text"),
                    page_number=payload.get("page_number"),
                    headings=payload.get("headings", []),
                    image_url=payload.get("image_url"),
                )
            )
        return results

    def delete_by_paper(self, paper_id: str) -> None:
        self._client.delete(
            collection_name=self._collection,
            points_selector=Filter(
                must=[FieldCondition(key="paper_id", match=MatchValue(value=paper_id))]
            ),
        )
