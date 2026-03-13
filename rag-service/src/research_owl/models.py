from enum import Enum

from pydantic import BaseModel


class PaperStatus(str, Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


# --- ArXiv Search ---


class ArxivSearchRequest(BaseModel):
    query: str
    max_results: int = 10
    sort_by: str = "relevance"


class ArxivSearchResultItem(BaseModel):
    arxiv_id: str
    title: str
    authors: list[str]
    abstract: str
    pdf_url: str
    published: str
    categories: list[str]


class ArxivSearchResponse(BaseModel):
    results: list[ArxivSearchResultItem]
    total: int


# --- Ingest ---


class IngestRequest(BaseModel):
    arxiv_url: str
    skip_embedding: bool = False


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


# --- RAG Query ---


class QueryRequest(BaseModel):
    query: str
    mode: str = "semantic"


class QueryResponse(BaseModel):
    response: str
    mode: str


# --- Chunk Explorer ---


class ChunkItem(BaseModel):
    id: str
    paper_id: str
    paper_title: str = ""
    chunk_type: str = "text"
    chunk_index: int = 0
    content: str = ""
    image_filename: str | None = None
    score: float | None = None


class ChunkListResponse(BaseModel):
    items: list[ChunkItem]
    total: int


class ChunkSearchRequest(BaseModel):
    query: str
    top_k: int = 10
    paper_id: str | None = None


class CollectionStats(BaseModel):
    total_points: int = 0
    vectors_count: int = 0
    status: str = "unknown"


# --- Images ---


class ImageInfo(BaseModel):
    filename: str
    url: str
    page_number: int | None = None
    caption: str | None = None


# --- Evaluation ---


class EvalRunStatus(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class EvalItemCreate(BaseModel):
    question: str
    ground_truth: str
    metadata: dict | None = None


class EvalItem(BaseModel):
    item_id: int
    dataset_id: str
    question: str
    ground_truth: str
    metadata: dict | None = None
    created_at: str | None = None


class EvalItemUpdate(BaseModel):
    question: str | None = None
    ground_truth: str | None = None
    metadata: dict | None = None


class DatasetCreateRequest(BaseModel):
    name: str
    description: str = ""
    items: list[EvalItemCreate] = []


class DatasetGenerateRequest(BaseModel):
    name: str
    description: str = ""
    paper_ids: list[str]
    num_questions: int = 10


class EvalDataset(BaseModel):
    dataset_id: str
    name: str
    description: str = ""
    paper_ids: list[str] = []
    num_items: int = 0
    created_at: str | None = None
    updated_at: str | None = None


class EvalDatasetDetail(EvalDataset):
    items: list[EvalItem] = []


class EvalRunRequest(BaseModel):
    dataset_id: str


class EvalItemResult(BaseModel):
    item_id: int
    question: str
    ground_truth: str
    answer: str = ""
    contexts: list[str] = []
    factual_correctness: float | None = None
    factual_correctness_reason: str | None = None
    context_relevance: float | None = None
    context_relevance_reason: str | None = None


class EvalRun(BaseModel):
    run_id: str
    dataset_id: str
    status: EvalRunStatus = EvalRunStatus.pending
    factual_correctness: float | None = None
    context_relevance: float | None = None
    num_items: int = 0
    error_message: str | None = None
    started_at: str | None = None
    completed_at: str | None = None
    created_at: str | None = None


class EvalRunDetail(EvalRun):
    item_results: list[EvalItemResult] = []


class EvalTrendPoint(BaseModel):
    run_id: str
    dataset_id: str
    completed_at: str
    factual_correctness: float | None = None
    context_relevance: float | None = None


class EvalStats(BaseModel):
    total_datasets: int = 0
    total_runs: int = 0
    total_items: int = 0
    trends: list[EvalTrendPoint] = []
