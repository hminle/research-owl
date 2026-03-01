# Research Owl RAG Service

RAG-Anything powered research assistant for arxiv papers. Ingests PDFs with multimodal understanding (figures, tables, equations analyzed by gpt-4o vision), builds a knowledge graph via LightRAG, and exposes multi-mode query endpoints.

## Architecture

```
arxiv URL
  │
  ├─ Docling ──────────► text extraction (for citation parsing)
  │
  └─ RAGAnything ──────► Docling parser + gpt-4o vision
       │                    │
       │                    ├─ text ──► LightRAG entity extraction ──► KG + vectors
       │                    ├─ figures ──► gpt-4o analysis ──► KG entities
       │                    ├─ tables ──► gpt-4o analysis ──► KG entities
       │                    └─ equations ──► gpt-4o analysis ──► KG entities
       │
       ├─ citation_parser ──► arxiv ID regex ──► insert_custom_kg (citation edges)
       │
       └─ LightRAG (Qdrant vectors + NetworkX graph)
            │
            └─ query modes: local / global / hybrid / mix / naive
```

**Key libraries:**

| Library | Role |
|---------|------|
| [RAG-Anything](https://github.com/HKUDS/RAG-Anything) | Multimodal document processing + LightRAG insertion |
| [LightRAG](https://github.com/HKUDS/LightRAG) | Entity extraction, knowledge graph, vector search, multi-mode queries |
| [Docling](https://github.com/DS4SD/docling) | PDF parsing (used as RAGAnything's parser backend) |
| Qdrant | Vector storage for embeddings |
| NetworkX | In-memory graph storage for the knowledge graph |
| FastAPI | HTTP API layer |

**LLM / embedding models (via [Vercel AI Gateway](https://ai-gateway.vercel.sh)):**

| Model | Purpose |
|-------|---------|
| `openai/gpt-4o-mini` | Entity/relationship extraction (LightRAG) |
| `openai/gpt-4o` | Vision analysis of figures, tables, equations (RAGAnything) |
| `openai/text-embedding-3-small` | Text embeddings (1536 dimensions) |

## Project structure

```
rag-service/
├── pyproject.toml
├── docker-compose.yml              # Qdrant
├── .env                            # OWL_AI_GATEWAY_API_KEY, OWL_QDRANT_URL, OPENAI_API_KEY, OPENAI_API_BASE
└── src/research_owl/
    ├── main.py                     # FastAPI app, ingestion flow, endpoints
    ├── config.py                   # Settings (pydantic-settings, OWL_ prefix)
    ├── models.py                   # Pydantic request/response models
    ├── db.py                       # SQLite paper metadata + image records
    ├── lightrag_service.py         # ResearchOwlRAG wrapper (RAGAnything + LightRAG)
    └── ingestion/
        ├── pipeline.py             # PDF download + Docling text extraction
        └── citation_parser.py      # Arxiv ID extraction from references
```

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

### Configure

Create a `.env` file (or edit the existing one):

```bash
# pydantic-settings uses the OWL_ prefix for config
OWL_AI_GATEWAY_API_KEY=your_vercel_ai_gateway_key
OWL_QDRANT_URL=http://localhost:6333

# LightRAG internals read these env vars directly (see "Important notes" below)
OPENAI_API_KEY=your_vercel_ai_gateway_key      # same key, needed by LightRAG openai_embed
OPENAI_API_BASE=https://ai-gateway.vercel.sh/v1
```

### Run

```bash
uvicorn research_owl.main:app --reload
```

API at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/ingest` | Submit an arxiv URL for ingestion (background task) |
| `GET` | `/papers` | List all ingested papers |
| `GET` | `/papers/{paper_id}` | Get paper metadata and status |
| `GET` | `/papers/{paper_id}/images` | List extracted images for a paper |
| `POST` | `/query` | Query the knowledge graph + vector store |
| `GET` | `/graph` | Export the full knowledge graph (nodes + edges) |
| `GET` | `/health` | Health check |

### Ingest a paper

```bash
curl -X POST http://localhost:8000/ingest \
  -H 'Content-Type: application/json' \
  -d '{"arxiv_url": "https://arxiv.org/pdf/2408.09869"}'
```

Ingestion runs in the background. Poll the paper status:

```bash
curl http://localhost:8000/papers/2408.09869
```

Status transitions: `pending` -> `processing` -> `completed` (or `failed`).

### Query

```bash
curl -X POST http://localhost:8000/query \
  -H 'Content-Type: application/json' \
  -d '{"query": "document understanding", "mode": "mix"}'
```

Modes:
- `local` -- entity-focused retrieval
- `global` -- relationship-focused retrieval
- `hybrid` -- combines local and global
- `mix` -- KG + vector retrieval (recommended default)
- `naive` -- plain vector search

### Get knowledge graph

```bash
curl http://localhost:8000/graph
```

Returns `{"nodes": [...], "edges": [...]}` for visualization.

## Ingestion flow

1. **Download** -- arxiv PDF saved to `data/pdfs/{paper_id}.pdf`
2. **Text extraction** -- Docling converts PDF to markdown (~50s on CPU, runs in thread via `asyncio.to_thread`)
3. **RAGAnything processing** -- Docling parser + gpt-4o vision:
   - Pure text is chunked and inserted into LightRAG (entity extraction + embedding)
   - Figures, tables, equations are analyzed by gpt-4o and become KG entities
   - Parsed output stored in `data/parsed/{paper_id}/`
4. **Citation parsing** -- regex extracts arxiv IDs from the references section
5. **Citation injection** -- citation relationships added to the KG via `ainsert_custom_kg`
6. **Metadata update** -- SQLite record updated with title, image count, status

### Ingestion timing

Approximate times observed on CPU (varies by paper size):

| Phase | Small paper (~15 pages) | Large paper (~60 pages) |
|-------|------------------------|------------------------|
| PDF download | ~2s | ~5s |
| Docling text extraction | ~50s | ~3min |
| RAGAnything text processing | ~2min | ~8min |
| Multimodal item processing | ~10min (31 items) | ~60min (148 items) |
| **Total** | **~15min** | **~70min+** |

Multimodal processing is the bottleneck -- each item requires an LLM call for vision analysis + entity extraction + embedding.

## Data storage

| What | Where |
|------|-------|
| Paper metadata | `data/papers.db` (SQLite) |
| Downloaded PDFs | `data/pdfs/` |
| RAGAnything parsed output | `data/parsed/{paper_id}/` |
| LightRAG working directory | `data/lightrag/` |
| Vector embeddings | Qdrant (port 6333) |
| Knowledge graph | NetworkX (in `data/lightrag/`) |

## Configuration

Settings via environment variables (prefix `OWL_`):

| Variable | Default | Description |
|----------|---------|-------------|
| `OWL_AI_GATEWAY_API_KEY` | (required) | Vercel AI Gateway API key |
| `OWL_AI_GATEWAY_BASE_URL` | `https://ai-gateway.vercel.sh/v1` | Gateway base URL |
| `OWL_LLM_MODEL` | `openai/gpt-4o-mini` | LLM for entity extraction |
| `OWL_VISION_MODEL` | `openai/gpt-4o` | Vision LLM for figure/table/equation analysis |
| `OWL_EMBED_MODEL` | `openai/text-embedding-3-small` | Embedding model |
| `OWL_EMBED_DIMENSION` | `1536` | Embedding dimension |
| `OWL_QDRANT_URL` | `http://localhost:6333` | Qdrant server URL |
| `OWL_DATA_DIR` | `data` | Root directory for all stored data |

Additionally, these must be set in `.env` for LightRAG internals (see important notes):

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | Same as `OWL_AI_GATEWAY_API_KEY` -- needed by LightRAG's `openai_embed` |
| `OPENAI_API_BASE` | Same as `OWL_AI_GATEWAY_BASE_URL` -- needed by LightRAG's `create_openai_async_client` |

## Important notes

### Env var duplication (`OPENAI_API_KEY` / `OPENAI_API_BASE`)

LightRAG's `openai_embed` function internally calls `create_openai_async_client` which falls back to `os.environ["OPENAI_API_KEY"]` when building the OpenAI client. Even though we pass `api_key=` explicitly to `openai_embed.func()`, certain internal code paths (retry decorators, embedding during entity extraction) bypass our wrapper and hit the env var fallback. Same applies to `OPENAI_API_BASE` for the base URL.

We also call `os.environ.setdefault("OPENAI_API_KEY", ...)` in `lightrag_service.py:initialize()` as a safety net, but setting both in `.env` is the most reliable approach.

### Vision function and multipart messages

The OpenAI API does not accept an `images` kwarg on `completions.create()`. RAGAnything passes `image_data=base64_string` to the vision function. Our `_build_vision_func` converts this into proper multipart message content blocks (`image_url` type with base64 data URI) before calling `openai_complete_if_cache`.

### Background ingestion and event loops

Ingestion runs as an async background task on the main event loop (via FastAPI `BackgroundTasks`). This is critical because LightRAG creates internal `PriorityQueue` objects during initialization that are bound to the event loop they were created on. Using `asyncio.run()` (which creates a new loop) causes "PriorityQueue is bound to a different event loop" errors.

The blocking Docling PDF parsing (~50s) is offloaded to a thread via `asyncio.to_thread()` so it doesn't block the main event loop.

### Embedding token limit

Some large table chunks can exceed the `text-embedding-3-small` context limit of 8192 tokens. LightRAG logs this as a non-fatal error and skips that chunk. The rest of the document processes normally.

## Known issues

### `local`, `hybrid`, and `mix` query modes return "None"

**Status**: open, needs investigation

The `global` and `naive` query modes work correctly and return rich responses. However, `local`, `hybrid`, and `mix` modes return `"None"` for all queries tested.

- `global` works -- relationship-focused retrieval across entities
- `naive` works -- plain vector search on chunk embeddings
- `local` returns "None" -- entity-focused retrieval fails
- `hybrid` returns "None" -- combines local + global, but local component fails
- `mix` returns "None" -- KG + vector, but KG component fails

The knowledge graph data is present (549+ nodes, 733+ edges verified via `/graph`), and Qdrant collections have data (entities: 549, relationships: 733, chunks: 44+). The issue is likely in how LightRAG matches query terms to entity names in the vector store during the `local` retrieval step.

Possible causes to investigate:
- LightRAG entity VDB query may need a minimum similarity threshold adjustment
- Entity names in the graph may not match the query embedding space well
- The `QueryParam` may need additional configuration (e.g. `top_k`, `max_token_for_text_unit`)
- Version-specific behavior in `lightrag-hku==1.4.10`

### Paper title extraction

Docling's `document.name` returns the arxiv ID (e.g. `"2504.07959"`) instead of the actual paper title. The `title` field in paper metadata shows the arxiv ID rather than the human-readable title.

## Bugs fixed (2026-03-01)

1. **`.env` prefix mismatch** -- Config class uses `env_prefix = "OWL_"` but `.env` had vars without the prefix, so `settings.ai_gateway_api_key` was always empty string. Fixed by adding `OWL_` prefix to `.env` vars.

2. **Missing `OPENAI_API_KEY` env var** -- LightRAG's `openai_embed` internally requires `OPENAI_API_KEY` in the environment. Added explicit env var in `.env` and `os.environ.setdefault()` in `initialize()`.

3. **Vision function `images` kwarg** -- `openai_complete_if_cache` passes `**kwargs` to `completions.create()`. Passing `images=[...]` caused `got an unexpected keyword argument 'images'`. Fixed by building proper multipart content blocks in `_build_vision_func`.

4. **Event loop conflict** -- `asyncio.run()` in background task created a new event loop, but LightRAG's `PriorityQueue` objects were bound to the main loop. Fixed by running `_async_ingest` as an async background task on the main loop and offloading blocking Docling work to `asyncio.to_thread()`.

5. **Sync `insert_custom_kg` in async context** -- `lightrag.insert_custom_kg()` internally calls `loop.run_until_complete()` which fails inside an already-running loop. Fixed by using `await lightrag.ainsert_custom_kg()`.

## Test results (2026-03-01)

Tested with two papers:
- `2504.07959` -- CCMNet (color constancy, ~15 pages, 31 multimodal items)
- `2512.08564` -- Modular Neural ISP (~60 pages, 148 multimodal items)

| Test | Result |
|------|--------|
| Ingest 2504.07959 | Completed: 549 nodes, 733 edges, 14 images, 4 citations |
| Ingest 2512.08564 | Completed text processing (600 entities, 415 relations), multimodal in progress |
| `GET /papers` | Lists both papers with correct status |
| `GET /papers/{id}/images` | Returns 14 image records for first paper |
| `POST /query` (naive) | Rich response about color constancy techniques |
| `POST /query` (global) | Cross-paper response referencing both documents |
| `POST /query` (local) | Returns "None" (see known issues) |
| `POST /query` (hybrid) | Returns "None" (see known issues) |
| `POST /query` (mix) | Returns "None" (see known issues) |
| `GET /graph` | 1231 nodes, 1293 edges (both papers combined) |
| `GET /health` | OK |
| Server responsiveness during ingestion | OK -- async background task doesn't block API |
