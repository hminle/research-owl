"""Research Owl RAG Service.

FastAPI application that ingests arxiv papers via RAGAnything
(Docling parser + gpt-4o vision for multimodal KG entities),
indexes them in LightRAG (knowledge graph + vector search),
and exposes multi-mode query endpoints.
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
    create_paper,
    get_images,
    get_paper,
    init_db,
    list_papers,
    save_images,
    update_paper,
)
from research_owl.ingestion.citation_parser import parse_citations
from research_owl.ingestion.pipeline import process_pdf
from research_owl.lightrag_service import ResearchOwlRAG
from research_owl.progress import (
    StepStatus,
    create_progress,
    get_progress,
    update_step,
    wait_for_update,
)
from research_owl.models import (
    GraphData,
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

rag_service: ResearchOwlRAG

ARXIV_ID_PATTERN = re.compile(r"(\d{4}\.\d{4,5})")


def extract_arxiv_id(url: str) -> str:
    match = ARXIV_ID_PATTERN.search(url)
    if not match:
        raise ValueError(f"Could not extract arxiv ID from URL: {url}")
    return match.group(1)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global rag_service

    logging.basicConfig(level=logging.INFO)

    settings.data_dir.mkdir(parents=True, exist_ok=True)

    init_db(settings.db_path)

    rag_service = ResearchOwlRAG(
        working_dir=settings.lightrag_dir,
        api_key=settings.ai_gateway_api_key,
        base_url=settings.ai_gateway_base_url,
        llm_model=settings.llm_model,
        vision_model=settings.vision_model,
        embed_model=settings.embed_model,
        embed_dimension=settings.embed_dimension,
        qdrant_url=settings.qdrant_url,
    )
    await rag_service.initialize()

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


async def _async_ingest(paper_id: str, arxiv_url: str) -> None:
    """Async ingestion that runs on the main event loop.

    Blocking I/O (PDF download + Docling parsing) is offloaded to a thread
    so the event loop stays responsive. All LightRAG/RAGAnything calls
    remain on the main loop to avoid cross-loop resource conflicts.
    """
    current_step: str | None = None
    create_progress(paper_id)

    try:
        update_paper(paper_id, status=PaperStatus.processing.value)

        # Step 1: Download + extract text (handled together by process_pdf)
        current_step = "download"
        update_step(paper_id, "download", StepStatus.in_progress)

        pipeline_result = await asyncio.to_thread(
            process_pdf,
            arxiv_url=arxiv_url,
            paper_id=paper_id,
            download_dir=settings.data_dir / "pdfs",
        )

        update_step(paper_id, "download", StepStatus.completed)

        # Step 2: Extract text (mark completed since process_pdf handles both)
        current_step = "extract_text"
        update_step(paper_id, "extract_text", StepStatus.in_progress)
        # Text extraction happens inside process_pdf, so mark done immediately
        update_step(paper_id, "extract_text", StepStatus.completed)

        # Step 3: Process multimodal (RAGAnything)
        current_step = "process_multimodal"
        update_step(paper_id, "process_multimodal", StepStatus.in_progress)

        output_dir = settings.data_dir / "parsed" / paper_id
        await rag_service.process_document(
            file_path=pipeline_result.local_pdf_path,
            output_dir=output_dir,
            doc_id=paper_id,
        )

        update_step(paper_id, "process_multimodal", StepStatus.completed)

        # Step 4: Parse citations
        current_step = "parse_citations"
        update_step(paper_id, "parse_citations", StepStatus.in_progress)

        citations = parse_citations(
            pipeline_result.full_text,
            exclude_id=paper_id,
        )
        if citations:
            await rag_service.insert_citations(
                paper_id=paper_id,
                paper_title=pipeline_result.title or "",
                citations=citations,
            )

        update_step(paper_id, "parse_citations", StepStatus.completed)

        # Step 5: Collect images
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
            num_chunks=0,
            num_images=num_images,
        )
        logger.info(
            "Ingestion completed for paper %s: %d images, %d citations",
            paper_id,
            num_images,
            len(citations),
        )

    except Exception as e:
        logger.exception("Ingestion failed for paper %s", paper_id)
        if current_step:
            update_step(paper_id, current_step, StepStatus.failed, error=str(e))
        update_paper(paper_id, status=PaperStatus.failed.value, error_message=str(e))


def _count_images(output_dir) -> int:
    """Count image files in the RAGAnything output directory."""
    from pathlib import Path

    output_path = Path(output_dir)
    if not output_path.exists():
        return 0
    return sum(
        1 for f in output_path.rglob("*")
        if f.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".svg"}
    )


def _collect_image_records(output_dir, paper_id: str) -> list[dict]:
    """Collect image metadata from the RAGAnything output directory."""
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

    background_tasks.add_task(_async_ingest, paper_id, request.arxiv_url)
    return IngestResponse(paper_id=paper_id, status=PaperStatus.pending)


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
# LightRAG Query
# ---------------------------------------------------------------------------


@app.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest):
    """Query the knowledge graph + vector store via LightRAG.

    Modes:
    - local: entity-focused retrieval
    - global: relationship-focused retrieval
    - hybrid: combines local and global
    - mix: KG + vector retrieval (recommended default)
    - naive: plain vector search
    """
    try:
        result = await rag_service.query(request.query, mode=request.mode)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return QueryResponse(response=result, mode=request.mode)


# ---------------------------------------------------------------------------
# Graph export
# ---------------------------------------------------------------------------


@app.get("/graph", response_model=GraphData)
async def get_graph():
    """Export the full knowledge graph for visualization."""
    data = rag_service.export_graph()
    return GraphData(**data)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@app.get("/health")
async def health():
    return {"status": "ok", "service": "research-owl"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("research_owl.main:app", host="0.0.0.0", port=8000, reload=True)
