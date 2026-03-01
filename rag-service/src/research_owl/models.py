from enum import Enum

from pydantic import BaseModel


class PaperStatus(str, Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


# --- Ingest ---


class IngestRequest(BaseModel):
    arxiv_url: str


class IngestResponse(BaseModel):
    paper_id: str
    status: PaperStatus


# --- Paper metadata ---


class PaperMetadata(BaseModel):
    paper_id: str
    arxiv_url: str
    title: str | None = None
    status: PaperStatus
    num_chunks: int = 0
    num_images: int = 0
    error_message: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


# --- LightRAG Query ---


class QueryRequest(BaseModel):
    query: str
    mode: str = "mix"


class QueryResponse(BaseModel):
    response: str
    mode: str


# --- Graph Export ---


class GraphNode(BaseModel):
    id: str
    label: str
    entity_type: str | None = None
    description: str | None = None


class GraphEdge(BaseModel):
    source: str
    target: str
    description: str | None = None
    keywords: str | None = None
    weight: float = 1.0


class GraphData(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


# --- Images ---


class ImageInfo(BaseModel):
    filename: str
    url: str
    page_number: int | None = None
    caption: str | None = None
