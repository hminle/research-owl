# Research Owl RAG Service

Local RAG service for arxiv papers. Uses Docling for PDF processing/OCR, Qdrant for vector storage, and sentence-transformers for embeddings.

## Setup

### Prerequisites

- Python 3.10+
- Docker (for Qdrant)

### Start Qdrant

```bash
cd rag-service
docker compose up -d
```

### Install

```bash
pip install -e .
```

### Run

```bash
uvicorn research_owl.main:app --reload
```

The API is available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

## API Usage

### Ingest a paper

```bash
curl -X POST http://localhost:8000/ingest \
  -H 'Content-Type: application/json' \
  -d '{"arxiv_url": "https://arxiv.org/pdf/2512.08564"}'
```

Ingestion runs in the background. Poll the paper status to track progress:

```bash
curl http://localhost:8000/papers/2512.08564
```

Status transitions: `pending` → `processing` → `completed` (or `failed`).

### List all papers

```bash
curl http://localhost:8000/papers
```

### Search

```bash
curl -X POST http://localhost:8000/search \
  -H 'Content-Type: application/json' \
  -d '{"query": "image signal processing", "top_k": 5}'
```

Filter by paper:

```bash
curl -X POST http://localhost:8000/search \
  -H 'Content-Type: application/json' \
  -d '{"query": "color correction", "top_k": 5, "paper_id": "2512.08564"}'
```

### List extracted images

```bash
curl http://localhost:8000/papers/2512.08564/images
```

Images are served at the `url` field in each result (e.g. `/static/images/2512.08564/figure_1.png`).

## Configuration

Settings can be overridden with environment variables (prefix `OWL_`):

| Variable | Default | Description |
|----------|---------|-------------|
| `OWL_QDRANT_URL` | `http://localhost:6333` | Qdrant server URL |
| `OWL_COLLECTION_NAME` | `papers` | Qdrant collection name |
| `OWL_EMBED_MODEL` | `all-MiniLM-L6-v2` | Sentence-transformers model |
| `OWL_EMBED_DIMENSION` | `384` | Embedding dimension |
| `OWL_DATA_DIR` | `data` | Directory for SQLite DB and images |
| `OWL_IMAGES_SCALE` | `2.0` | Scale factor for extracted images |
