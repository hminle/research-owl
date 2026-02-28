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


# --- Search ---

class SearchRequest(BaseModel):
    query: str
    top_k: int = 5
    paper_id: str | None = None


class SearchResult(BaseModel):
    paper_id: str
    text: str
    score: float
    chunk_type: str = "text"  # "text", "figure", "table"
    page_number: int | None = None
    headings: list[str] = []
    image_url: str | None = None


class SearchResponse(BaseModel):
    results: list[SearchResult]


# --- Images ---

class ImageInfo(BaseModel):
    filename: str
    url: str
    page_number: int | None = None
    caption: str | None = None
