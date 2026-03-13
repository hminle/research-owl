# API Reference

Base URL: `http://localhost:8000`

---

## Health

### `GET /health`

Health check endpoint.

**Response** `200`:
```json
{ "status": "ok" }
```

---

## Paper Ingestion

### `POST /ingest`

Start background ingestion of an ArXiv paper.

**Request Body**:
```json
{ "arxiv_url": "https://arxiv.org/abs/2401.12345" }
```

**Response** `202`:
```json
{
  "paper_id": "2401.12345",
  "status": "pending",
  "message": "Ingestion started"
}
```

### `GET /papers`

List all ingested papers.

**Response** `200`:
```json
[
  {
    "paper_id": "2401.12345",
    "arxiv_url": "https://arxiv.org/abs/2401.12345",
    "title": "Paper Title",
    "status": "completed",
    "num_chunks": 42,
    "num_images": 5,
    "error_message": null,
    "created_at": "2024-01-15T10:30:00"
  }
]
```

### `GET /papers/{paper_id}`

Get a single paper's metadata.

**Response** `200`: Same schema as list item above.

**Response** `404`:
```json
{ "detail": "Paper not found" }
```

### `GET /papers/{paper_id}/progress`

SSE stream of ingestion progress. Each event is a JSON object with step statuses.

**Response**: `text/event-stream`
```
data: {"steps": {"download": {"status": "completed", ...}, "extract_text": {"status": "in_progress", ...}, ...}}
```

### `GET /papers/{paper_id}/images`

Get list of images extracted from a paper.

**Response** `200`:
```json
[
  {
    "image_id": 1,
    "paper_id": "2401.12345",
    "filename": "fig_1.png",
    "caption": "Figure 1: Architecture overview"
  }
]
```

---

## RAG Query

### `POST /query`

Semantic search with LLM-generated answer.

**Request Body**:
```json
{
  "query": "What is the main contribution?",
  "mode": "semantic",
  "top_k": 5
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `query` | string | (required) | Natural language question |
| `mode` | string | `"semantic"` | `"semantic"` for all papers, `"paper:<id>"` for specific paper |
| `top_k` | int | `5` | Number of context chunks to retrieve |

**Response** `200`:
```json
{
  "answer": "The main contribution is..."
}
```

---

## Chunks

### `GET /chunks`

Browse document chunks with pagination and filtering.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `paper_id` | string | null | Filter by paper |
| `chunk_type` | string | null | `"text"` or `"image"` |
| `offset` | int | 0 | Pagination offset |
| `limit` | int | 20 | Page size |

**Response** `200`:
```json
{
  "chunks": [
    {
      "id": "uuid",
      "paper_id": "2401.12345",
      "paper_title": "Paper Title",
      "chunk_type": "text",
      "chunk_index": 0,
      "content": "chunk text..."
    }
  ],
  "total": 42,
  "offset": 0,
  "limit": 20
}
```

### `POST /chunks/search`

Semantic search over chunks.

**Request Body**:
```json
{
  "query": "transformer architecture",
  "top_k": 10,
  "paper_id": null
}
```

**Response** `200`:
```json
{
  "results": [
    {
      "id": "uuid",
      "paper_id": "2401.12345",
      "content": "...",
      "score": 0.87
    }
  ]
}
```

### `GET /chunks/stats`

Get Qdrant collection statistics.

**Response** `200`:
```json
{
  "points_count": 1234,
  "status": "green"
}
```

---

## Knowledge Graph

### `GET /graph/paper/{paper_id}/citations`

Get papers cited by or citing this paper.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `direction` | string | `"cited"` | `"cited"` or `"citing"` |

**Response** `200`:
```json
[
  {
    "paper_id": "2403.456",
    "title": "Cited Paper Title"
  }
]
```

### `GET /graph/paper/{paper_id}/entities`

Get entities extracted from a paper.

**Response** `200`:
```json
[
  {
    "entity_id": 1,
    "type": "Method",
    "name": "Transformer",
    "relation": "PROPOSES",
    "context": "The paper proposes a novel Transformer variant"
  }
]
```

### `GET /graph/paper/{paper_id}/network`

Get N-hop subgraph around a paper (for visualization).

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `depth` | int | `2` | Number of hops |
| `max_nodes` | int | `50` | Maximum nodes to return |

**Response** `200`:
```json
{
  "nodes": [
    { "id": "paper:2401.123", "kind": "paper", "title": "..." },
    { "id": "method:transformer", "kind": "entity", "name": "Transformer" }
  ],
  "edges": [
    { "source": "paper:2401.123", "target": "method:transformer", "relation": "PROPOSES" }
  ]
}
```

### `GET /graph/entities`

Search entities by type and/or name.

**Query Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `type` | string | Entity type filter (`Method`, `Dataset`, `Metric`, `Model`, `Task`) |
| `query` | string | Name substring search |

### `GET /graph/stats`

Get graph statistics (node/edge counts by type).

### `POST /graph/search`

Hybrid graph + vector search.

**Request Body**:
```json
{
  "query": "transformer attention mechanism",
  "top_k": 10
}
```

**Response** `200`:
```json
{
  "results": [
    {
      "content": "...",
      "paper_id": "2401.12345",
      "score": 0.034,
      "graph_context": "Related to entities: transformer, attention"
    }
  ]
}
```

---

## Evaluation

### Datasets

#### `POST /eval/datasets/generate`

Auto-generate Q&A dataset from papers (background task).

**Request Body**:
```json
{
  "name": "My Eval Set",
  "paper_ids": ["2401.12345"],
  "num_questions": 10
}
```

#### `POST /eval/datasets`

Create an empty dataset manually.

#### `GET /eval/datasets`

List all evaluation datasets.

#### `GET /eval/datasets/{dataset_id}`

Get dataset with its Q&A items.

#### `PUT /eval/datasets/{dataset_id}`

Update dataset name/description.

#### `DELETE /eval/datasets/{dataset_id}`

Delete dataset and its items.

### Items

#### `POST /eval/items`

Add Q&A items to a dataset.

**Request Body**:
```json
{
  "dataset_id": 1,
  "items": [
    { "question": "What is...?", "ground_truth": "It is..." }
  ]
}
```

#### `PUT /eval/items/{item_id}`

Update a Q&A item.

#### `DELETE /eval/items/{item_id}`

Delete a Q&A item.

### Runs

#### `POST /eval/runs`

Start an evaluation run (background task).

**Request Body**:
```json
{
  "dataset_id": 1,
  "query_mode": "semantic"
}
```

#### `GET /eval/runs`

List evaluation runs. Optional `dataset_id` filter.

#### `GET /eval/runs/{run_id}`

Get run details including per-item results.

#### `GET /eval/runs/{run_id}/progress`

SSE stream of evaluation progress.

#### `GET /eval/stats`

Aggregate evaluation statistics across all runs.
