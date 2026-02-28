import logging
import re
from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

from research_owl.config import settings
from research_owl.db import create_paper, get_images, get_paper, init_db, list_papers, save_images, update_paper
from research_owl.ingestion.chunker import ChunkRecord, chunk_document, create_chunker
from research_owl.ingestion.pipeline import process_pdf
from research_owl.models import (
    ImageInfo,
    IngestRequest,
    IngestResponse,
    PaperMetadata,
    PaperStatus,
    SearchRequest,
    SearchResponse,
)
from research_owl.vectorstore.embeddings import EmbeddingService
from research_owl.vectorstore.qdrant import QdrantService

logger = logging.getLogger(__name__)

embed_service: EmbeddingService
qdrant_service: QdrantService
chunker: object  # HybridChunker


@asynccontextmanager
async def lifespan(app: FastAPI):
    global embed_service, qdrant_service, chunker

    logging.basicConfig(level=logging.INFO)

    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.images_dir.mkdir(parents=True, exist_ok=True)

    init_db(settings.db_path)

    embed_service = EmbeddingService(settings.embed_model)
    qdrant_service = QdrantService(
        url=settings.qdrant_url,
        collection_name=settings.collection_name,
        dimension=settings.embed_dimension,
    )
    qdrant_service.ensure_collection()

    chunker = create_chunker(f"sentence-transformers/{settings.embed_model}")

    logger.info("Research Owl RAG service started")
    yield
    logger.info("Research Owl RAG service shutting down")


app = FastAPI(title="Research Owl RAG Service", lifespan=lifespan)

# Mount static files for serving extracted images
settings.images_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static/images", StaticFiles(directory=str(settings.images_dir)), name="images")


ARXIV_ID_PATTERN = re.compile(r"(\d{4}\.\d{4,5})")


def extract_arxiv_id(url: str) -> str:
    match = ARXIV_ID_PATTERN.search(url)
    if not match:
        raise ValueError(f"Could not extract arxiv ID from URL: {url}")
    return match.group(1)


def _run_ingestion(paper_id: str, arxiv_url: str) -> None:
    try:
        update_paper(paper_id, status=PaperStatus.processing.value)

        pipeline_result = process_pdf(
            arxiv_url=arxiv_url,
            paper_id=paper_id,
            images_dir=settings.images_dir,
            images_scale=settings.images_scale,
        )

        chunks: list[ChunkRecord] = chunk_document(chunker, pipeline_result.document)  # type: ignore[arg-type]

        if chunks:
            texts = [c.text for c in chunks]
            vectors = embed_service.embed(texts)
            metadatas = [
                {
                    "chunk_type": "text",
                    "page_number": c.page_number,
                    "headings": c.headings,
                }
                for c in chunks
            ]
            qdrant_service.upsert_chunks(paper_id, texts, vectors, metadatas)

        # Embed image/table captions so they are searchable
        caption_texts = []
        caption_metas = []
        for img in pipeline_result.images:
            if not img.caption:
                continue
            chunk_type = "table" if img.filename.startswith("table_") else "figure"
            caption_texts.append(img.caption)
            caption_metas.append({
                "chunk_type": chunk_type,
                "page_number": img.page_number,
                "headings": [],
                "image_url": f"/static/images/{paper_id}/{img.filename}",
            })
        if caption_texts:
            caption_vectors = embed_service.embed(caption_texts)
            qdrant_service.upsert_chunks(paper_id, caption_texts, caption_vectors, caption_metas)
            logger.info("Embedded %d image/table captions for paper %s", len(caption_texts), paper_id)

        if pipeline_result.images:
            save_images(
                paper_id,
                [
                    {"filename": img.filename, "page_number": img.page_number, "caption": img.caption}
                    for img in pipeline_result.images
                ],
            )

        update_paper(
            paper_id,
            status=PaperStatus.completed.value,
            title=pipeline_result.title,
            num_chunks=len(chunks),
            num_images=len(pipeline_result.images),
        )
        logger.info("Ingestion completed for paper %s: %d chunks, %d images", paper_id, len(chunks), len(pipeline_result.images))

    except Exception as e:
        logger.exception("Ingestion failed for paper %s", paper_id)
        update_paper(paper_id, status=PaperStatus.failed.value, error_message=str(e))


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
        # Re-try failed papers
        update_paper(paper_id, status=PaperStatus.pending.value, error_message=None)
    else:
        create_paper(paper_id, request.arxiv_url)

    background_tasks.add_task(_run_ingestion, paper_id, request.arxiv_url)
    return IngestResponse(paper_id=paper_id, status=PaperStatus.pending)


@app.get("/papers", response_model=list[PaperMetadata])
async def get_papers():
    return list_papers()


@app.get("/papers/{paper_id}", response_model=PaperMetadata)
async def get_paper_detail(paper_id: str):
    paper = get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    return paper


@app.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    query_vector = embed_service.embed([request.query])[0]
    results = qdrant_service.search(
        query_vector=query_vector,
        top_k=request.top_k,
        paper_id=request.paper_id,
    )
    return SearchResponse(results=results)


@app.get("/papers/{paper_id}/images", response_model=list[ImageInfo])
async def get_paper_images(paper_id: str):
    paper = get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    return get_images(paper_id)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("research_owl.main:app", host="0.0.0.0", port=8000, reload=True)
