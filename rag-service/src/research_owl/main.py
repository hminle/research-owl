"""Research Owl RAG Service.

FastAPI application that ingests arxiv papers, chunks text,
embeds with OpenAI text-embedding-3-small, describes figures
with GPT-4o vision, stores in Qdrant, and exposes semantic
search query endpoints with LLM-as-judge evaluation.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from research_owl.config import settings
from research_owl.db import (
    add_eval_items,
    add_paper_entity,
    create_eval_dataset,
    create_eval_run,
    create_paper,
    delete_eval_dataset,
    delete_eval_item,
    get_citations,
    get_eval_dataset,
    get_eval_dataset_detail,
    get_eval_run,
    get_eval_run_detail,
    get_eval_stats,
    get_graph_stats,
    get_images,
    get_paper,
    get_paper_entities,
    init_db,
    list_eval_datasets,
    list_eval_items,
    list_eval_runs,
    list_papers,
    resolve_paper_id,
    save_citations,
    save_images,
    search_entities,
    update_eval_dataset,
    update_eval_item,
    update_eval_run,
    update_paper,
    upsert_entity,
)
from research_owl.arxiv_search import search_arxiv
from research_owl.ingestion.citation_parser import parse_citations
from research_owl.ingestion.entity_extractor import extract_entities, normalize_name
from research_owl.ingestion.pipeline import process_pdf
from research_owl.graph_service import GraphService
from research_owl.hybrid_retriever import HybridRetriever
from research_owl.qdrant_service import QdrantRAGService
from research_owl.progress import (
    StepStatus,
    create_progress,
    get_progress,
    update_step,
    wait_for_update,
)
from research_owl.models import (
    ArxivSearchRequest,
    ArxivSearchResponse,
    ArxivSearchResultItem,
    ChunkListResponse,
    ChunkSearchRequest,
    CollectionStats,
    DatasetCreateRequest,
    DatasetGenerateRequest,
    EvalDataset,
    EvalDatasetDetail,
    EvalItem,
    EvalItemCreate,
    EvalItemUpdate,
    EvalRun,
    EvalRunDetail,
    EvalRunRequest,
    EvalRunStatus,
    EvalStats,
    ImageInfo,
    IngestRequest,
    IngestResponse,
    PaperMetadata,
    PaperStatus,
    QueryRequest,
    QueryResponse,
)

load_dotenv()

logger = logging.getLogger(__name__)

rag_service: QdrantRAGService
graph_service: GraphService
hybrid_retriever: HybridRetriever

ARXIV_ID_PATTERN = re.compile(r"(\d{4}\.\d{4,5})")


def extract_arxiv_id(url: str) -> str:
    match = ARXIV_ID_PATTERN.search(url)
    if not match:
        raise ValueError(f"Could not extract arxiv ID from URL: {url}")
    return match.group(1)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global rag_service, graph_service, hybrid_retriever

    logging.basicConfig(level=logging.INFO)

    settings.data_dir.mkdir(parents=True, exist_ok=True)

    init_db(settings.db_path)

    rag_service = QdrantRAGService(
        api_key=settings.ai_gateway_api_key,
        base_url=settings.ai_gateway_base_url,
        llm_model=settings.llm_model,
        vision_model=settings.vision_model,
        embed_model=settings.embed_model,
        embed_dimension=settings.embed_dimension,
        qdrant_url=settings.qdrant_url,
    )
    await rag_service.initialize()

    graph_service = GraphService()
    graph_service.rebuild()

    hybrid_retriever = HybridRetriever(graph=graph_service, rag=rag_service)

    logger.info("Research Owl RAG service started")
    yield

    await rag_service.finalize()
    logger.info("Research Owl RAG service shutting down")


app = FastAPI(title="Research Owl RAG Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

parsed_dir = settings.data_dir / "parsed"
parsed_dir.mkdir(parents=True, exist_ok=True)
app.mount(
    "/static/parsed",
    StaticFiles(directory=str(parsed_dir)),
    name="parsed",
)


# ---------------------------------------------------------------------------
# Ingestion
# ---------------------------------------------------------------------------


async def _async_ingest(paper_id: str, arxiv_url: str, skip_embedding: bool = False) -> None:
    """Async ingestion pipeline.

    1. Download PDF + extract text with Docling (in thread)
    2. Chunk text, embed with OpenAI, describe images with GPT-4o, store in Qdrant
    3. Parse citations from full text
    4. Collect image metadata

    If skip_embedding is True, skip steps 2-5 and just register the paper
    metadata (useful when vectors already exist in Qdrant).
    """
    current_step: str | None = None
    create_progress(paper_id)

    try:
        update_paper(paper_id, status=PaperStatus.processing.value)

        # Step 1: Download + extract text + export figures (handled by process_pdf)
        current_step = "download"
        update_step(paper_id, "download", StepStatus.in_progress)

        output_dir = settings.parsed_dir / paper_id
        output_dir.mkdir(parents=True, exist_ok=True)

        pipeline_result = await asyncio.to_thread(
            process_pdf,
            arxiv_url=arxiv_url,
            paper_id=paper_id,
            download_dir=settings.data_dir / "pdfs",
            output_dir=output_dir,
            images_scale=settings.images_scale,
        )

        update_step(paper_id, "download", StepStatus.completed)

        # Step 2: Extract text (mark completed since process_pdf handles both)
        current_step = "extract_text"
        update_step(paper_id, "extract_text", StepStatus.in_progress)
        update_step(paper_id, "extract_text", StepStatus.completed)

        if skip_embedding:
            # Skip embedding/chunking — just count existing vectors in Qdrant
            num_chunks = await rag_service.count_vectors(paper_id)
            for step in ("embed_chunks", "extract_entities", "parse_citations", "collect_images"):
                update_step(paper_id, step, StepStatus.completed)
            current_step = None

            update_paper(
                paper_id,
                status=PaperStatus.completed.value,
                title=pipeline_result.title,
                num_chunks=num_chunks,
                num_images=0,
            )
            logger.info(
                "Metadata-only ingestion for paper %s: title=%r, %d existing vectors",
                paper_id,
                pipeline_result.title,
                num_chunks,
            )
            return

        # Step 3: Embed chunks into Qdrant (text + images described by vision model)
        current_step = "embed_chunks"
        update_step(paper_id, "embed_chunks", StepStatus.in_progress)

        ingest_result = await rag_service.ingest_document(
            paper_id=paper_id,
            full_text=pipeline_result.full_text,
            title=pipeline_result.title,
            image_dir=output_dir,
        )

        update_step(paper_id, "embed_chunks", StepStatus.completed)

        # Step 4: Extract entities
        current_step = "extract_entities"
        update_step(paper_id, "extract_entities", StepStatus.in_progress)

        try:
            extraction = await extract_entities(
                paper_id=paper_id,
                text=pipeline_result.full_text,
                openai_client=rag_service.openai,
                model=settings.llm_model,
            )
            for entity in extraction.entities:
                norm = normalize_name(entity.name)
                entity_id = upsert_entity(entity.type, entity.name, norm, entity.description)
                # Find matching relations for this entity
                for rel in extraction.relations:
                    if rel.entity_name == entity.name:
                        add_paper_entity(paper_id, entity_id, rel.predicate, rel.context)
            logger.info("Stored %d entities for paper %s", len(extraction.entities), paper_id)
        except Exception as e:
            logger.warning("Entity extraction failed for %s: %s (non-fatal)", paper_id, e)

        update_step(paper_id, "extract_entities", StepStatus.completed)

        # Step 5: Parse citations
        current_step = "parse_citations"
        update_step(paper_id, "parse_citations", StepStatus.in_progress)

        citations = parse_citations(
            pipeline_result.full_text,
            exclude_id=paper_id,
        )
        if citations:
            save_citations(paper_id, [c["arxiv_id"] for c in citations])

        update_step(paper_id, "parse_citations", StepStatus.completed)

        # Step 6: Collect images
        current_step = "collect_images"
        update_step(paper_id, "collect_images", StepStatus.in_progress)

        num_images = _count_images(output_dir)
        if num_images > 0:
            image_records = _collect_image_records(output_dir, paper_id)
            if image_records:
                save_images(paper_id, image_records)

        update_step(paper_id, "collect_images", StepStatus.completed)
        current_step = None

        update_paper(
            paper_id,
            status=PaperStatus.completed.value,
            title=pipeline_result.title,
            num_chunks=ingest_result["num_chunks"],
            num_images=num_images,
        )
        # Rebuild in-memory graph with new data
        graph_service.rebuild()

        logger.info(
            "Ingestion completed for paper %s: %d chunks, %d images, %d citations",
            paper_id,
            ingest_result["num_chunks"],
            num_images,
            len(citations),
        )

    except Exception as e:
        logger.exception("Ingestion failed for paper %s", paper_id)
        if current_step:
            update_step(paper_id, current_step, StepStatus.failed, error=str(e))
        update_paper(paper_id, status=PaperStatus.failed.value, error_message=str(e))


def _count_images(output_dir) -> int:
    """Count image files in the parsed output directory."""
    from pathlib import Path

    output_path = Path(output_dir)
    if not output_path.exists():
        return 0
    return sum(
        1 for f in output_path.rglob("*")
        if f.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".svg"}
    )


def _collect_image_records(output_dir, paper_id: str) -> list[dict]:
    """Collect image metadata from the parsed output directory."""
    from pathlib import Path

    output_path = Path(output_dir)
    records = []
    for f in sorted(output_path.rglob("*")):
        if f.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".svg"}:
            records.append({
                "filename": f.name,
                "page_number": None,
                "caption": None,
            })
    return records


@app.post("/ingest", response_model=IngestResponse)
async def ingest(request: IngestRequest, background_tasks: BackgroundTasks):
    try:
        paper_id = extract_arxiv_id(request.arxiv_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    existing = get_paper(paper_id)
    if existing:
        if existing.status in (PaperStatus.completed, PaperStatus.processing):
            return IngestResponse(paper_id=paper_id, status=existing.status)
        update_paper(paper_id, status=PaperStatus.pending.value, error_message=None)
    else:
        create_paper(paper_id, request.arxiv_url)

    background_tasks.add_task(_async_ingest, paper_id, request.arxiv_url, request.skip_embedding)
    return IngestResponse(paper_id=paper_id, status=PaperStatus.pending)


# ---------------------------------------------------------------------------
# ArXiv Search
# ---------------------------------------------------------------------------


@app.post("/search/arxiv", response_model=ArxivSearchResponse)
async def arxiv_search(request: ArxivSearchRequest):
    """Search arXiv for papers matching a query."""
    raw_results = await asyncio.to_thread(
        search_arxiv,
        query=request.query,
        max_results=request.max_results,
        sort_by=request.sort_by,
    )
    items = [
        ArxivSearchResultItem(
            arxiv_id=r.arxiv_id,
            title=r.title,
            authors=r.authors,
            abstract=r.abstract,
            pdf_url=r.pdf_url,
            published=r.published,
            categories=r.categories,
        )
        for r in raw_results
    ]
    return ArxivSearchResponse(results=items, total=len(items))


# ---------------------------------------------------------------------------
# Paper metadata
# ---------------------------------------------------------------------------


@app.get("/papers", response_model=list[PaperMetadata])
async def get_papers():
    return list_papers()


@app.get("/papers/{paper_id}", response_model=PaperMetadata)
async def get_paper_detail(paper_id: str):
    paper = get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    return paper


@app.get("/papers/{paper_id}/progress")
async def paper_progress(paper_id: str):
    """SSE endpoint streaming pipeline progress for a paper."""
    paper = get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    async def event_stream():
        progress = get_progress(paper_id)

        # If no live progress, synthesize from paper status
        if progress is None:
            from research_owl.progress import PIPELINE_STEPS

            if paper.status == PaperStatus.completed:
                synth = {
                    name: {"status": "completed", "started_at": None, "completed_at": None, "error": None}
                    for name in PIPELINE_STEPS
                }
            elif paper.status == PaperStatus.failed:
                synth = {
                    name: {"status": "failed", "started_at": None, "completed_at": None, "error": paper.error_message}
                    for name in PIPELINE_STEPS
                }
            else:
                synth = {
                    name: {"status": "pending", "started_at": None, "completed_at": None, "error": None}
                    for name in PIPELINE_STEPS
                }
            yield f"data: {json.dumps(synth)}\n\n"
            yield "data: [DONE]\n\n"
            return

        # Stream live progress updates
        while True:
            snapshot = progress.to_dict()
            yield f"data: {json.dumps(snapshot)}\n\n"

            if progress.is_terminal():
                yield "data: [DONE]\n\n"
                return

            await wait_for_update(paper_id, timeout=2.0)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/papers/{paper_id}/images", response_model=list[ImageInfo])
async def get_paper_images(paper_id: str):
    paper = get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    return get_images(paper_id)


# ---------------------------------------------------------------------------
# RAG Query
# ---------------------------------------------------------------------------


@app.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest):
    """Query the Qdrant vector store with semantic search.

    Modes:
    - semantic: cosine similarity search across all papers
    - paper:<paper_id>: search within a specific paper
    """
    try:
        result = await rag_service.query(request.query, mode=request.mode)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return QueryResponse(response=result, mode=request.mode)


# ---------------------------------------------------------------------------
# Chunk Explorer
# ---------------------------------------------------------------------------


@app.get("/chunks", response_model=ChunkListResponse)
async def list_chunks(
    paper_id: str | None = None,
    chunk_type: str | None = None,
    offset: int = 0,
    limit: int = 20,
):
    """List document chunks stored in Qdrant."""
    result = await rag_service.list_chunks(
        paper_id=paper_id,
        chunk_type=chunk_type,
        offset=offset,
        limit=limit,
    )
    return result


@app.post("/chunks/search")
async def search_chunks(request: ChunkSearchRequest):
    """Search chunks by semantic similarity."""
    paper_id = request.paper_id
    if paper_id:
        resolved = resolve_paper_id(paper_id)
        if resolved:
            paper_id = resolved
    results = await rag_service.search_chunks(
        query=request.query,
        top_k=request.top_k,
        paper_id=paper_id,
    )
    return results


@app.get("/chunks/stats", response_model=CollectionStats)
async def chunk_stats():
    """Get Qdrant collection statistics."""
    return await rag_service.get_collection_stats()


# ---------------------------------------------------------------------------
# Evaluation — Datasets
# ---------------------------------------------------------------------------

# In-memory progress tracking for eval operations
_eval_progress: dict[str, dict] = {}


@app.post("/eval/datasets/generate", response_model=EvalDataset)
async def generate_dataset(request: DatasetGenerateRequest, background_tasks: BackgroundTasks):
    """Auto-generate a Q&A evaluation dataset from ingested papers."""
    # Validate all paper IDs exist and are completed
    for pid in request.paper_ids:
        paper = get_paper(pid)
        if not paper:
            raise HTTPException(status_code=404, detail=f"Paper {pid} not found")
        if paper.status != PaperStatus.completed:
            raise HTTPException(status_code=400, detail=f"Paper {pid} is not completed (status: {paper.status.value})")

    ds = create_eval_dataset(
        name=request.name,
        description=request.description,
        paper_ids=request.paper_ids,
    )

    _eval_progress[ds.dataset_id] = {"status": "running", "completed": 0, "total": len(request.paper_ids), "error": None}

    background_tasks.add_task(
        _async_generate_dataset,
        ds.dataset_id,
        request.paper_ids,
        request.num_questions,
    )

    return ds


async def _async_generate_dataset(dataset_id: str, paper_ids: list[str], num_questions: int) -> None:
    from research_owl.evaluation.dataset_generator import generate_qa_pairs, get_paper_text

    try:
        questions_per_paper = max(1, num_questions // len(paper_ids))
        total_generated = 0

        for i, paper_id in enumerate(paper_ids):
            paper_text = get_paper_text(paper_id)
            if not paper_text:
                logger.warning("No text found for paper %s, skipping", paper_id)
                continue

            pairs = await generate_qa_pairs(
                paper_id=paper_id,
                paper_text=paper_text,
                num_questions=questions_per_paper,
            )

            if pairs:
                add_eval_items(dataset_id, pairs)
                total_generated += len(pairs)

            _eval_progress[dataset_id] = {
                "status": "running",
                "completed": i + 1,
                "total": len(paper_ids),
                "error": None,
            }

        update_eval_dataset(dataset_id, num_items=total_generated)
        _eval_progress[dataset_id] = {"status": "completed", "completed": len(paper_ids), "total": len(paper_ids), "error": None}
        logger.info("Generated %d Q&A items for dataset %s", total_generated, dataset_id)

    except Exception as e:
        logger.exception("Dataset generation failed for %s", dataset_id)
        _eval_progress[dataset_id] = {"status": "failed", "completed": 0, "total": len(paper_ids), "error": str(e)}


@app.post("/eval/datasets", response_model=EvalDataset)
async def create_dataset(request: DatasetCreateRequest):
    """Create a dataset manually with optional initial items."""
    ds = create_eval_dataset(name=request.name, description=request.description)
    if request.items:
        add_eval_items(ds.dataset_id, [item.model_dump() for item in request.items])
        ds = get_eval_dataset(ds.dataset_id)  # type: ignore[assignment]
    return ds


@app.get("/eval/datasets", response_model=list[EvalDataset])
async def get_datasets():
    return list_eval_datasets()


@app.get("/eval/datasets/{dataset_id}", response_model=EvalDatasetDetail)
async def get_dataset_detail(dataset_id: str):
    ds = get_eval_dataset_detail(dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return ds


@app.put("/eval/datasets/{dataset_id}", response_model=EvalDataset)
async def update_dataset(dataset_id: str, request: DatasetCreateRequest):
    ds = get_eval_dataset(dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    updated = update_eval_dataset(dataset_id, name=request.name, description=request.description)
    return updated


@app.delete("/eval/datasets/{dataset_id}")
async def delete_dataset(dataset_id: str):
    if not delete_eval_dataset(dataset_id):
        raise HTTPException(status_code=404, detail="Dataset not found")
    return {"ok": True}


@app.post("/eval/items", response_model=list[EvalItem])
async def add_items(dataset_id: str, items: list[EvalItemCreate]):
    ds = get_eval_dataset(dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return add_eval_items(dataset_id, [item.model_dump() for item in items])


@app.put("/eval/items/{item_id}", response_model=EvalItem)
async def update_item(item_id: int, request: EvalItemUpdate):
    kwargs = request.model_dump(exclude_none=True)
    updated = update_eval_item(item_id, **kwargs)
    if not updated:
        raise HTTPException(status_code=404, detail="Item not found")
    return updated


@app.delete("/eval/items/{item_id}")
async def delete_item(item_id: int):
    if not delete_eval_item(item_id):
        raise HTTPException(status_code=404, detail="Item not found")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Evaluation — Runs
# ---------------------------------------------------------------------------


@app.post("/eval/runs", response_model=EvalRun)
async def start_eval_run(request: EvalRunRequest, background_tasks: BackgroundTasks):
    """Start an evaluation run on a dataset."""
    ds = get_eval_dataset_detail(request.dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if not ds.items:
        raise HTTPException(status_code=400, detail="Dataset has no items")

    run = create_eval_run(
        dataset_id=request.dataset_id,
        query_mode=request.query_mode,
        num_items=len(ds.items),
    )

    _eval_progress[run.run_id] = {"status": "running", "completed": 0, "total": len(ds.items), "error": None}

    background_tasks.add_task(
        _async_run_evaluation,
        run.run_id,
        [item.model_dump() for item in ds.items],
        request.query_mode,
    )

    return run


async def _async_run_evaluation(run_id: str, items: list[dict], query_mode: str) -> None:
    from research_owl.evaluation.evaluator import run_evaluation

    update_eval_run(
        run_id,
        status=EvalRunStatus.running.value,
        started_at="datetime('now')",
    )
    # Fix: use actual SQL datetime
    from research_owl.db import _get_conn
    conn = _get_conn()
    conn.execute("UPDATE eval_runs SET started_at = datetime('now') WHERE run_id = ?", (run_id,))
    conn.commit()

    async def progress_cb(completed: int, total: int):
        _eval_progress[run_id] = {"status": "running", "completed": completed, "total": total, "error": None}

    try:
        result = await run_evaluation(
            items=items,
            query_func=rag_service.query,
            retrieve_func=rag_service.retrieve_contexts,
            query_mode=query_mode,
            progress_callback=progress_cb,
        )

        update_eval_run(
            run_id,
            status=EvalRunStatus.completed.value,
            correctness=result.correctness,
            factual_correctness=result.factual_correctness,
            item_results=result.item_results or [],
        )
        conn = _get_conn()
        conn.execute("UPDATE eval_runs SET completed_at = datetime('now') WHERE run_id = ?", (run_id,))
        conn.commit()

        _eval_progress[run_id] = {"status": "completed", "completed": len(items), "total": len(items), "error": None}
        logger.info("Evaluation run %s completed", run_id)

    except Exception as e:
        logger.exception("Evaluation run %s failed", run_id)
        update_eval_run(run_id, status=EvalRunStatus.failed.value, error_message=str(e))
        _eval_progress[run_id] = {"status": "failed", "completed": 0, "total": len(items), "error": str(e)}


@app.get("/eval/runs", response_model=list[EvalRun])
async def get_runs(dataset_id: str | None = None):
    return list_eval_runs(dataset_id)


@app.get("/eval/runs/{run_id}", response_model=EvalRunDetail)
async def get_run_detail(run_id: str):
    run = get_eval_run_detail(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@app.get("/eval/runs/{run_id}/progress")
async def eval_run_progress(run_id: str):
    """SSE endpoint streaming evaluation run progress."""
    run = get_eval_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    async def event_stream():
        while True:
            progress = _eval_progress.get(run_id)
            if progress:
                yield f"data: {json.dumps(progress)}\n\n"
                if progress["status"] in ("completed", "failed"):
                    yield "data: [DONE]\n\n"
                    return
            else:
                # No live progress — check DB status
                current = get_eval_run(run_id)
                if current and current.status in (EvalRunStatus.completed, EvalRunStatus.failed):
                    yield f"data: {json.dumps({'status': current.status.value, 'completed': current.num_items, 'total': current.num_items, 'error': current.error_message})}\n\n"
                    yield "data: [DONE]\n\n"
                    return
                yield f"data: {json.dumps({'status': 'pending', 'completed': 0, 'total': 0, 'error': None})}\n\n"

            await asyncio.sleep(1)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/eval/stats", response_model=EvalStats)
async def eval_stats(dataset_id: str | None = None):
    return get_eval_stats(dataset_id)


# ---------------------------------------------------------------------------
# Graph — Citations & Entities
# ---------------------------------------------------------------------------


@app.get("/graph/paper/{paper_id}/citations")
async def paper_citations(paper_id: str, direction: str = "outgoing"):
    """Get papers cited by / citing this paper."""
    return graph_service.get_paper_citations(paper_id, direction)


@app.get("/graph/paper/{paper_id}/entities")
async def paper_entities(paper_id: str):
    """Get all entities extracted from a paper."""
    return get_paper_entities(paper_id)


@app.get("/graph/paper/{paper_id}/network")
async def paper_network(paper_id: str, depth: int = 2):
    """Get N-hop subgraph around a paper."""
    return graph_service.get_network(paper_id, depth=min(depth, 3), max_nodes=100)


@app.get("/graph/entities")
async def list_entities(type: str | None = None, q: str | None = None):
    """Search entities by type and/or name substring."""
    return search_entities(entity_type=type, query=q)


@app.get("/graph/stats")
async def graph_stats():
    """Get graph statistics."""
    return get_graph_stats()


@app.post("/graph/search")
async def graph_search(request: ChunkSearchRequest):
    """Hybrid graph+vector search. Uses entity matching to scope vector search."""
    results = await hybrid_retriever.retrieve(
        query=request.query,
        top_k=request.top_k,
    )
    return results


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@app.get("/health")
async def health():
    return {"status": "ok", "service": "research-owl"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("research_owl.main:app", host="0.0.0.0", port=8000, reload=True)
