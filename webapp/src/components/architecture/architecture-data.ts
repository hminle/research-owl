import type { Node, Edge } from "@xyflow/react";

// ─── Types ──────────────────────────────────────────────────────

export interface ComponentDetail {
  title: string;
  description: string;
  technologies: string[];
  keyFiles: string[];
  subComponents?: { name: string; description: string }[];
  dataFlow?: string[];
  endpoints?: { method: string; path: string; purpose: string }[];
}

export interface ArchView {
  id: string;
  label: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
}

// ─── Helpers ────────────────────────────────────────────────────

const EDGE_COLOR = "#94a3b8";
const EDGE_DASHED = "#9ca3af";
const nd = { draggable: true, connectable: false };

function n(
  id: string,
  type: string,
  x: number,
  y: number,
  label: string,
  subtitle: string,
  color: string,
): Node {
  return { id, type, position: { x, y }, data: { label, subtitle, color }, ...nd };
}

function e(
  id: string,
  source: string,
  target: string,
  label: string,
  sh: string,
  th: string,
  opts?: { dashed?: boolean },
): Edge {
  return {
    id,
    source,
    target,
    sourceHandle: sh,
    targetHandle: th,
    type: "smoothstep",
    label,
    style: {
      strokeWidth: 1.5,
      stroke: opts?.dashed ? EDGE_DASHED : EDGE_COLOR,
      ...(opts?.dashed ? { strokeDasharray: "6 3" } : {}),
    },
    labelStyle: { fontSize: 11, fill: "#64748b", fontWeight: 500 },
    labelBgStyle: { fill: "#ffffff", fillOpacity: 0.9 },
    labelBgPadding: [6, 4] as [number, number],
    labelBgBorderRadius: 4,
  };
}

// ═══════════════════════════════════════════════════════════════
// VIEW 1: SYSTEM OVERVIEW
// ═══════════════════════════════════════════════════════════════

const overviewNodes: Node[] = [
  n("user",        "archUser",     80,  60,  "User / Browser",       "",                          "gray"),
  n("webapp",      "archService",  340, 60,  "Next.js Webapp",       "Port 3000",                 "blue"),
  n("agent",       "archModule",   340, 440, "AI Agent",             "ToolLoopAgent",             "violet"),
  n("rag-service", "archService",  660, 60,  "RAG Service",          "FastAPI · Port 8000",       "emerald"),
  n("ingestion",   "archModule",   660, 250, "Ingestion Pipeline",   "PDF → Chunks → Embed",     "amber"),
  n("retrieval",   "archModule",   660, 440, "Hybrid Retriever",     "Graph + Vector + RRF",      "rose"),
  n("qdrant",      "archStorage",  980, 60,  "Qdrant",               "Vector DB · Port 6333",     "sky"),
  n("sqlite",      "archStorage",  980, 250, "SQLite",               "papers.db",                 "slate"),
  n("graph",       "archStorage",  980, 440, "Knowledge Graph",      "NetworkX · In-memory",      "orange"),
  n("external",    "archExternal", 660, 610, "External APIs",        "OpenAI · Arxiv · AI Gateway","gray"),
];

const overviewEdges: Edge[] = [
  e("o-user-webapp",   "user",       "webapp",      "HTTP",              "source-right", "target-left"),
  e("o-webapp-rag",    "webapp",     "rag-service", "API Proxy",         "source-right", "target-left"),
  e("o-rag-qdrant",    "rag-service","qdrant",      "",                  "source-right", "target-left"),
  e("o-ingest-sqlite", "ingestion",  "sqlite",      "Metadata",          "source-right", "target-left"),
  e("o-ret-graph",     "retrieval",  "graph",       "Traverse",          "source-right", "target-left"),
  e("o-webapp-agent",  "webapp",     "agent",       "Chat API",          "source-bottom","target-top"),
  e("o-rag-ingest",    "rag-service","ingestion",   "Ingest",            "source-bottom","target-top"),
  e("o-rag-ret",       "rag-service","retrieval",   "Search",            "source-left",  "target-left"),
  e("o-ingest-qdrant", "ingestion",  "qdrant",      "Store Vectors",     "source-top",   "target-bottom"),
  e("o-ingest-graph",  "ingestion",  "graph",       "Entities",          "source-bottom","target-top"),
  e("o-ret-qdrant",    "retrieval",  "qdrant",      "Vector Search",     "source-right", "target-bottom"),
  e("o-agent-rag",     "agent",      "rag-service", "Tool Calls",        "source-right", "target-bottom"),
  e("o-agent-ext",     "agent",      "external",    "LLM Calls",         "source-bottom","target-left",  { dashed: true }),
  e("o-ingest-ext",    "ingestion",  "external",    "PDF · Embed · Vision","source-bottom","target-top", { dashed: true }),
];

// ═══════════════════════════════════════════════════════════════
// VIEW 2: INGESTION PIPELINE
// ═══════════════════════════════════════════════════════════════

const ingestionNodes: Node[] = [
  // Column 1: Trigger
  n("i-url",       "archUser",    60,  60,  "ArXiv URL",               "User submits paper link",                     "gray"),
  n("i-api",       "archService", 60,  250, "FastAPI /ingest",         "Dedup check · create paper · background task","emerald"),
  n("i-sse",       "archExternal",60,  460, "SSE Progress",            "Real-time step status to frontend",           "gray"),
  // Column 2: Download + Extract
  n("i-download",  "archModule",  310, 60,  "① Download PDF",          "arxiv.org → data/pdfs/ · skip if cached",    "amber"),
  n("i-extract",   "archModule",  310, 250, "② Extract Text + Figures","Docling → markdown + PNGs",                  "amber"),
  // Column 3: Processing (vertical fan-out from Extract)
  n("i-embed",     "archModule",  600, 60,  "③ Embed Chunks",          "Chunk text · GPT-4o vision describes images","violet"),
  n("i-entities",  "archModule",  600, 200, "④ Extract Entities",      "GPT-4o-mini · 5 types · non-fatal",          "violet"),
  n("i-citations", "archModule",  600, 340, "⑤ Parse Citations",       "Regex · ArXiv IDs · excludes self",           "amber"),
  n("i-images",    "archModule",  600, 480, "⑥ Collect Images",        "Scan PNGs → save metadata",                   "amber"),
  // Column 4: Storage
  n("i-qdrant",    "archStorage", 900, 60,  "Qdrant",                  "text + image vectors stored",                 "sky"),
  n("i-sqlite",    "archStorage", 900, 280, "SQLite",                  "papers · entities · citations · images",      "slate"),
  // Column 5: Final
  n("i-graph",     "archStorage", 1160,280, "Rebuild Graph",           "NetworkX · full rebuild from SQLite",         "orange"),
];

const ingestionEdges: Edge[] = [
  // Trigger flow (column 1 → 2)
  e("i-0",  "i-url",      "i-api",       "POST",              "source-bottom","target-top"),
  e("i-0b", "i-api",      "i-download",  "background task",   "source-right", "target-left"),
  e("i-0c", "i-api",      "i-sse",       "progress events",   "source-bottom","target-top",  { dashed: true }),
  // Download → Extract (column 2, vertical)
  e("i-1",  "i-download", "i-extract",   "PDF file",          "source-bottom","target-top"),
  // Fan-out: Extract → 4 processing steps (column 2 → 3)
  e("i-2",  "i-extract",  "i-embed",     "text + figures",    "source-right", "target-left"),
  e("i-4",  "i-extract",  "i-entities",  "full text",         "source-right", "target-left"),
  e("i-6",  "i-extract",  "i-citations", "full text",         "source-right", "target-left"),
  e("i-7",  "i-extract",  "i-images",    "output dir / PNGs", "source-bottom","target-left"),
  // Processing → Storage (column 3 → 4)
  e("i-3",  "i-embed",    "i-qdrant",    "vectors",           "source-right", "target-left"),
  e("i-5",  "i-entities", "i-sqlite",    "entities + relations","source-right","target-left"),
  e("i-8",  "i-citations","i-sqlite",    "citations",         "source-right", "target-left"),
  e("i-9",  "i-images",   "i-sqlite",    "image metadata",    "source-right", "target-left"),
  // Storage → Graph rebuild (column 4 → 5)
  e("i-a",  "i-sqlite",   "i-graph",     "rebuild",           "source-right", "target-left"),
];

// ═══════════════════════════════════════════════════════════════
// VIEW 3: QUERY & CHAT FLOW
// ═══════════════════════════════════════════════════════════════

const queryNodes: Node[] = [
  n("q-user",   "archUser",     60,  200, "User Message",     "Chat page input",                     "gray"),
  n("q-agent",  "archService",  300, 200, "ToolLoopAgent",    "Max 6 steps · temp 0.5",              "violet"),
  n("q-llm",    "archExternal", 300, 30,  "LLM",             "Gemini 2.5 Flash / Claude",            "violet"),
  n("q-list",   "archModule",   580, 60,  "list_papers",     "GET /papers → paper list",             "blue"),
  n("q-hybrid", "archModule",   580, 220, "hybrid_search",   "Graph + Vector + RRF",                 "rose"),
  n("q-show",   "archModule",   580, 380, "show_image",      "Display figure/table in chat",         "blue"),
  n("q-qdrant", "archStorage",  860, 140, "Qdrant",          "Vector similarity search",             "sky"),
  n("q-sqlite", "archStorage",  860, 60,  "SQLite",          "Paper list + entity matching",         "slate"),
  n("q-graph",  "archStorage",  860, 300, "Knowledge Graph", "Entity → paper traversal",             "orange"),
];

const queryEdges: Edge[] = [
  e("q-1", "q-user",   "q-agent",  "message",        "source-right", "target-left"),
  e("q-2", "q-agent",  "q-llm",    "reason",         "source-top",   "target-bottom"),
  e("q-3", "q-agent",  "q-list",   "",               "source-right", "target-left"),
  e("q-5", "q-agent",  "q-hybrid", "",               "source-right", "target-left"),
  e("q-5b","q-agent",  "q-show",   "",               "source-bottom","target-left"),
  e("q-6", "q-list",   "q-sqlite", "",               "source-right", "target-left"),
  e("q-8", "q-hybrid", "q-graph",  "traverse",       "source-right", "target-left"),
  e("q-9", "q-hybrid", "q-qdrant", "scoped + global","source-right", "target-left"),
  e("q-a", "q-hybrid", "q-sqlite", "entity match",   "source-right", "target-left"),
];

// ═══════════════════════════════════════════════════════════════
// VIEW 4: DATA MODEL
// ═══════════════════════════════════════════════════════════════

const dataModelNodes: Node[] = [
  n("d-papers",     "archStorage", 80,  80,  "papers",          "paper_id · title · status · num_chunks",    "slate"),
  n("d-images",     "archStorage", 380, 30,  "images",          "paper_id · filename · caption",             "slate"),
  n("d-citations",  "archStorage", 380, 180, "citations",       "citing_id · cited_id (composite PK)",       "slate"),
  n("d-paper-ent",  "archStorage", 380, 330, "paper_entities",  "paper_id · entity_id · relation · context", "slate"),
  n("d-entities",   "archStorage", 680, 330, "entities",        "type · name · normalized_name · description","slate"),
  n("d-eval-ds",    "archStorage", 680, 30,  "eval_datasets",   "name · description · paper_ids · num_items","emerald"),
  n("d-eval-items", "archStorage", 960, 30,  "eval_items",      "question · ground_truth · metadata",        "emerald"),
  n("d-eval-runs",  "archStorage", 960, 180, "eval_runs",       "status · correctness · factual · results",  "emerald"),
  n("d-qdrant",     "archStorage", 80,  510, "Qdrant: research_owl", "1536d · COSINE · paper_id · content · chunk_type","sky"),
  n("d-networkx",   "archStorage", 480, 510, "NetworkX DiGraph","Paper nodes · Entity nodes · Typed edges",  "orange"),
];

const dataModelEdges: Edge[] = [
  e("d-1", "d-papers",    "d-images",    "1 : N",       "source-right", "target-left"),
  e("d-2", "d-papers",    "d-citations", "citing_id",   "source-right", "target-left"),
  e("d-3", "d-papers",    "d-paper-ent", "paper_id",    "source-bottom","target-left"),
  e("d-4", "d-paper-ent", "d-entities",  "entity_id",   "source-right", "target-left"),
  e("d-5", "d-eval-ds",   "d-eval-items","1 : N (CASCADE)","source-right","target-left"),
  e("d-6", "d-eval-ds",   "d-eval-runs", "dataset_id",  "source-right", "target-top"),
  e("d-7", "d-papers",    "d-qdrant",    "chunk vectors","source-bottom","target-top"),
  e("d-8", "d-papers",    "d-networkx",  "paper nodes",  "source-bottom","target-top", { dashed: true }),
  e("d-9", "d-entities",  "d-networkx",  "entity nodes", "source-bottom","target-top", { dashed: true }),
];

// ═══════════════════════════════════════════════════════════════
// VIEW 5: EVALUATION FLOW
// ═══════════════════════════════════════════════════════════════

const evalNodes: Node[] = [
  n("e-papers",   "archModule",  80,  80,  "Select Papers",    "Pick papers for eval",        "blue"),
  n("e-generate", "archModule",  330, 80,  "Generate Q&A",     "GPT-4o-mini · per-paper",     "violet"),
  n("e-dataset",  "archStorage", 580, 80,  "Eval Dataset",     "Q&A pairs in SQLite",         "slate"),
  n("e-run",      "archModule",  580, 300, "Start Eval Run",   "Background task · per-item",  "emerald"),
  n("e-query",    "archModule",  330, 300, "Query RAG",        "search_chunks / graph_search", "amber"),
  n("e-judge",    "archModule",  80,  300, "LLM Judge",        "Correctness + factual score",  "violet"),
  n("e-results",  "archStorage", 80,  500, "Results",          "Per-item scores · aggregates", "emerald"),
];

const evalEdges: Edge[] = [
  e("e-1", "e-papers",   "e-generate", "paper texts",  "source-right", "target-left"),
  e("e-2", "e-generate", "e-dataset",  "Q&A pairs",    "source-right", "target-left"),
  e("e-3", "e-dataset",  "e-run",      "select dataset","source-bottom","target-top"),
  e("e-4", "e-run",      "e-query",    "per question", "source-left",  "target-right"),
  e("e-5", "e-query",    "e-judge",    "answer + context","source-left","target-right"),
  e("e-6", "e-judge",    "e-results",  "scores",       "source-bottom","target-top"),
];

// ═══════════════════════════════════════════════════════════════
// VIEWS EXPORT
// ═══════════════════════════════════════════════════════════════

export const views: ArchView[] = [
  {
    id: "overview",
    label: "System Overview",
    description: "High-level view of all services and how they connect.",
    nodes: overviewNodes,
    edges: overviewEdges,
  },
  {
    id: "ingestion",
    label: "Ingestion Pipeline",
    description: "Step-by-step flow of how an arxiv paper gets processed and stored.",
    nodes: ingestionNodes,
    edges: ingestionEdges,
  },
  {
    id: "query",
    label: "Query & Chat",
    description: "How a user chat message flows through the AI agent, tools, and retrieval backends.",
    nodes: queryNodes,
    edges: queryEdges,
  },
  {
    id: "data-model",
    label: "Data Model",
    description: "SQLite tables, Qdrant collection, and NetworkX graph structure with relationships.",
    nodes: dataModelNodes,
    edges: dataModelEdges,
  },
  {
    id: "evaluation",
    label: "Evaluation",
    description: "Dataset generation, evaluation runs, and LLM-as-judge scoring pipeline.",
    nodes: evalNodes,
    edges: evalEdges,
  },
];

// ═══════════════════════════════════════════════════════════════
// COMPONENT DETAILS
// ═══════════════════════════════════════════════════════════════

// ── Overview details ────────────────────────────────────────────

const overviewDetails: Record<string, ComponentDetail> = {
  webapp: {
    title: "Next.js Webapp",
    description:
      "Frontend built with Next.js 16 and React 19. Provides chat UI (ToolLoopAgent), paper management, document browsing, and evaluation dashboard. API routes proxy requests to the RAG service.",
    technologies: ["Next.js 16", "React 19", "Vercel AI SDK", "Tailwind CSS 4 + shadcn/ui", "TanStack React Query"],
    keyFiles: [
      "webapp/src/app/page.tsx — Chat",
      "webapp/src/app/api/chat/route.ts",
      "webapp/src/app/api/rag/ — Proxy routes",
      "webapp/src/lib/rag-server.ts — RAG API client",
    ],
    subComponents: [
      { name: "Chat Page", description: "Streaming AI chat with ToolLoopAgent and 3 tools (list_papers, hybrid_search, show_image)." },
      { name: "Ingest Page", description: "Submit arxiv URLs with real-time SSE progress." },
      { name: "Papers Page", description: "Grid view of ingested papers with status badges." },
      { name: "Documents Page", description: "Browse and search chunks in Qdrant." },
      { name: "Evaluation Page", description: "Create eval datasets, run evaluations, view metrics." },
    ],
  },
  agent: {
    title: "AI Agent (ToolLoopAgent)",
    description:
      "Orchestrates LLM calls with tool use. Receives user messages, decides which tools to call, executes them in a loop (max 6 steps), and streams the final response.",
    technologies: ["Vercel AI SDK — ToolLoopAgent", "Gemini 2.5 Flash / Claude Haiku 4.5 / Claude Sonnet 4.5"],
    keyFiles: ["webapp/src/lib/agents/research-owl.ts", "webapp/src/lib/ai/providers.ts"],
    dataFlow: [
      "User sends chat message",
      "LLM decides which tool(s) to call",
      "Tools execute via API proxy → RAG service",
      "Results returned to LLM for reasoning",
      "Loop continues (max 6 steps) or streams final answer",
    ],
  },
  "rag-service": {
    title: "RAG Service (FastAPI)",
    description:
      "Python backend handling paper ingestion, chunking, embedding, vector storage, knowledge graph, hybrid retrieval, and evaluation.",
    technologies: ["FastAPI + uvicorn", "Python 3.11", "Docling", "OpenAI API", "NetworkX", "Qdrant client"],
    keyFiles: ["rag-service/src/research_owl/main.py", "rag-service/src/research_owl/config.py"],
    endpoints: [
      { method: "POST", path: "/ingest", purpose: "Start paper ingestion" },
      { method: "GET", path: "/papers", purpose: "List all papers" },
      { method: "POST", path: "/chunks/search", purpose: "Vector search" },
      { method: "POST", path: "/graph/search", purpose: "Hybrid graph+vector search" },
      { method: "POST", path: "/eval/runs", purpose: "Start evaluation run" },
      { method: "GET", path: "/health", purpose: "Health check" },
    ],
  },
  ingestion: {
    title: "Ingestion Pipeline",
    description:
      "Background pipeline: downloads PDF from arxiv, extracts text via Docling, chunks (1500/200), embeds with OpenAI, stores in Qdrant. Also extracts entities with LLM, parses citations, and builds the knowledge graph.",
    technologies: ["Docling", "OpenAI text-embedding-3-small", "GPT-4o vision", "GPT-4o-mini (entities)"],
    keyFiles: ["rag-service/src/research_owl/ingestion/pipeline.py", "rag-service/src/research_owl/main.py — _async_ingest()"],
    dataFlow: [
      "Receive arxiv URL → download PDF",
      "Docling extract → full markdown text",
      "Chunk (1500 chars, 200 overlap) → embed → Qdrant",
      "GPT-4o-mini extracts entities → SQLite + graph",
      "Regex parses citations → SQLite",
      "Rebuild NetworkX graph",
    ],
  },
  retrieval: {
    title: "Hybrid Retriever",
    description:
      "Combines knowledge graph traversal with vector search using Reciprocal Rank Fusion (RRF, k=60). Finds entities matching query terms, traverses the graph, runs scoped vector search, then merges with global search.",
    technologies: ["NetworkX", "Qdrant", "RRF merging (k=60)"],
    keyFiles: ["rag-service/src/research_owl/hybrid_retriever.py"],
    dataFlow: [
      "Substring-match entities in SQLite",
      "Graph traversal → connected paper IDs",
      "Scoped vector search (top 5 papers, 3 chunks each)",
      "Global vector search (fallback)",
      "RRF merge → ranked results with graph context",
    ],
  },
  qdrant: {
    title: "Qdrant Vector Database",
    description:
      "Stores paper text embeddings in collection \"research_owl\". 1536-dimensional vectors (OpenAI), cosine similarity. Supports filtered search by paper_id.",
    technologies: ["Qdrant (Docker)", "Cosine similarity", "1536-dim vectors"],
    keyFiles: ["rag-service/src/research_owl/qdrant_service.py"],
    subComponents: [
      { name: "Upsert", description: "Stores chunks with embeddings and payload (paper_id, text, metadata). Batches of 100." },
      { name: "Search", description: "Cosine similarity with optional paper_id filter. Returns top-k." },
    ],
  },
  sqlite: {
    title: "SQLite Database",
    description:
      "Persistent relational storage at rag-service/data/papers.db. Stores paper metadata, images, citations, entities, evaluation datasets and runs.",
    technologies: ["SQLite", "aiosqlite (async)"],
    keyFiles: ["rag-service/src/research_owl/db.py (626 lines)"],
    subComponents: [
      { name: "papers", description: "Paper metadata, status, title, arxiv URL, timestamps." },
      { name: "entities + paper_entities", description: "Extracted entities and many-to-many paper links." },
      { name: "citations", description: "Parsed references between papers." },
      { name: "eval_datasets / eval_runs", description: "Evaluation Q&A pairs and run results." },
    ],
  },
  graph: {
    title: "Knowledge Graph (NetworkX)",
    description:
      "In-memory directed graph. Paper nodes connect to entity nodes (Method, Dataset, Metric, Task, Model) via typed edges (USES, EVALUATES_ON, PROPOSES, etc.). Rebuilt from SQLite on startup and after ingestion.",
    technologies: ["NetworkX DiGraph", "In-memory", "Multi-hop traversal"],
    keyFiles: ["rag-service/src/research_owl/graph_service.py"],
    subComponents: [
      { name: "Paper nodes", description: "paper:{paper_id} with title attribute." },
      { name: "Entity nodes", description: "{type}:{normalized_name} — Method, Dataset, Metric, Task, Model." },
      { name: "Citation edges", description: "CITES relationship between papers." },
      { name: "Relation edges", description: "USES, EVALUATES_ON, PROPOSES, MEASURES, TRAINS, BENCHMARKS, ADDRESSES." },
    ],
  },
  external: {
    title: "External APIs",
    description:
      "OpenAI for embeddings (text-embedding-3-small), vision (GPT-4o), and entity extraction (GPT-4o-mini). Arxiv for PDF downloads. AI Gateway routes LLM chat requests to Gemini/Claude.",
    technologies: ["OpenAI API", "Arxiv", "Vercel AI Gateway"],
    keyFiles: ["rag-service/src/research_owl/config.py", "webapp/src/lib/ai/providers.ts"],
    subComponents: [
      { name: "OpenAI Embeddings", description: "text-embedding-3-small, 1536 dimensions." },
      { name: "GPT-4o Vision", description: "Generates text descriptions of paper figures." },
      { name: "GPT-4o-mini", description: "Entity extraction and evaluation judging." },
      { name: "AI Gateway", description: "Routes chat to Gemini 2.5 Flash, Claude Haiku 4.5, or Claude Sonnet 4.5." },
    ],
  },
};

// ── Ingestion details ───────────────────────────────────────────

const ingestionDetails: Record<string, ComponentDetail> = {
  "i-url": {
    title: "ArXiv URL Input",
    description: "The user submits an arxiv URL (e.g. https://arxiv.org/abs/2004.01354). The system extracts the arxiv ID using regex pattern (\\d{4}\\.\\d{4,5}).",
    technologies: ["Regex parsing"],
    keyFiles: ["webapp/src/components/ingest/ingest-form.tsx"],
  },
  "i-api": {
    title: "FastAPI /ingest Endpoint",
    description: "Receives the POST request, extracts the arxiv ID, performs deduplication (returns immediately if paper is already completed/processing), resets to pending if previously failed, or creates a new paper row in SQLite. Then enqueues _async_ingest as a FastAPI BackgroundTask and returns immediately with status 'pending'.",
    technologies: ["FastAPI", "BackgroundTasks"],
    keyFiles: ["rag-service/src/research_owl/main.py — ingest(), _async_ingest()"],
    dataFlow: [
      "Extract arxiv ID from URL",
      "Dedup check: if completed/processing → return immediately",
      "If failed → reset to pending; if new → create_paper()",
      "Enqueue _async_ingest() as background task",
      "Return { paper_id, status: 'pending' } to frontend",
    ],
  },
  "i-download": {
    title: "Step 1: Download PDF",
    description: "Downloads the PDF from arxiv.org using urllib.request.urlretrieve. Converts any arxiv URL variant to a direct PDF link: https://arxiv.org/pdf/{arxiv_id}. Caches to data/pdfs/{paper_id}.pdf — skips download if file already exists.",
    technologies: ["urllib.request", "arxiv.org"],
    keyFiles: ["rag-service/src/research_owl/ingestion/pipeline.py — download_pdf()"],
  },
  "i-extract": {
    title: "Step 2: Extract Text + Figures",
    description: "Uses Docling DocumentConverter to parse the PDF into structured markdown text and export figures/tables as PNG files. Both download and extraction happen together in process_pdf(). The extract_text step is marked complete immediately since process_pdf() already did the work.",
    technologies: ["Docling (DocumentConverter)", "Markdown export", "Figure/table PNG export"],
    keyFiles: ["rag-service/src/research_owl/ingestion/pipeline.py — extract_text_and_figures(), process_pdf()"],
    dataFlow: [
      "Docling DocumentConverter processes the PDF",
      "export_to_markdown() → full text",
      "Figures and tables exported as PNGs to output directory",
      "Returns PipelineResult with title, full_text, image_count",
    ],
  },
  "i-embed": {
    title: "Step 3: Embed Chunks",
    description: "Chunks the full text (1500 chars, 200 overlap), embeds each chunk with OpenAI text-embedding-3-small (1536d). If figures exist, GPT-4o vision generates text descriptions which are also embedded. All vectors are upserted into Qdrant in batches of 100.",
    technologies: ["OpenAI text-embedding-3-small", "1536 dimensions", "GPT-4o vision (figures)", "Sliding window (1500/200)"],
    keyFiles: ["rag-service/src/research_owl/qdrant_service.py — ingest_document(), _chunk_text(), embed_texts()"],
    dataFlow: [
      "Split text into chunks (1500 chars, 200 overlap)",
      "If images found: GPT-4o vision describes each image",
      "Embed all chunks + image descriptions → 1536d vectors",
      "Upsert into Qdrant 'research_owl' collection (batches of 100)",
    ],
  },
  "i-qdrant": {
    title: "Qdrant Vector Store",
    description: "Vectors are upserted into the \"research_owl\" collection in batches of 100. Each point has a UUID id, the embedding vector, and payload: paper_id, paper_title, chunk_type (text/image), chunk_index, content, and optionally image_filename.",
    technologies: ["Qdrant", "Batch upsert (100)", "Cosine distance"],
    keyFiles: ["rag-service/src/research_owl/qdrant_service.py — ingest_document()"],
    subComponents: [
      { name: "Text chunks", description: "chunk_type='text', chunk_index=0..N, content=chunk text" },
      { name: "Image chunks", description: "chunk_type='image', content=GPT-4o description, image_filename=..." },
    ],
  },
  "i-entities": {
    title: "Step 4: Extract Entities (non-fatal)",
    description: "Uses GPT-4o-mini to extract structured entities from key sections (Abstract, Introduction, Conclusion — max 6000 chars). Returns entity types: Method, Dataset, Metric, Model, Task. Also extracts relations: PROPOSES, USES, EVALUATES_ON, MEASURES, TRAINS, BENCHMARKS, ADDRESSES. If this step fails, the pipeline continues — it is non-fatal.",
    technologies: ["GPT-4o-mini", "Structured JSON output", "temperature=0.1"],
    keyFiles: ["rag-service/src/research_owl/ingestion/entity_extractor.py"],
    dataFlow: [
      "Extract key sections (Abstract, Intro, Conclusion) — max 6000 chars",
      "LLM call with structured JSON schema",
      "Parse entities: {type, name, description}",
      "Parse relations: {predicate, entity_type, entity_name, context}",
      "upsert_entity() + add_paper_entity() → SQLite",
      "On failure: logs warning, pipeline continues",
    ],
  },
  "i-citations": {
    title: "Step 5: Parse Citations",
    description: "Extracts arxiv IDs from the paper text using regex patterns. Matches both full arxiv URLs and bare IDs (YYYY.NNNNN format, years 2006–2030). Self-citations are excluded (exclude_id=paper_id).",
    technologies: ["Regex (ARXIV_ID_PATTERN, BARE_ARXIV_PATTERN)", "Year filter: 06–30"],
    keyFiles: ["rag-service/src/research_owl/ingestion/citation_parser.py"],
    dataFlow: [
      "extract_references_section() — find References/Bibliography header",
      "extract_arxiv_ids() — regex match arxiv IDs",
      "Filter out self-citations (exclude paper_id)",
      "save_citations() — INSERT OR IGNORE into citations table",
    ],
  },
  "i-images": {
    title: "Step 6: Collect Images",
    description: "Scans the Docling output directory for exported figure/table PNG files. Collects metadata (filename, page_number, caption) and saves to SQLite via save_images(). This is the metadata collection step — the actual image extraction happened in step 2.",
    technologies: ["File system scan", "PNG/JPG/GIF/SVG"],
    keyFiles: ["rag-service/src/research_owl/main.py — _count_images(), _collect_image_records()"],
  },
  "i-sqlite": {
    title: "SQLite Metadata Store",
    description: "Stores all structured metadata extracted during ingestion: paper record (status, title, chunk count), entity records, paper-entity relationships with relation types and context, citation links, and image records. Paper status is updated to 'completed' after all steps succeed.",
    technologies: ["SQLite", "aiosqlite"],
    keyFiles: ["rag-service/src/research_owl/db.py"],
    subComponents: [
      { name: "papers", description: "update_paper() — status=completed, title, num_chunks, num_images" },
      { name: "entities", description: "upsert_entity() — type, name, normalized_name, description" },
      { name: "paper_entities", description: "add_paper_entity() — paper_id, entity_id, relation, context" },
      { name: "citations", description: "save_citations() — citing_id, cited_id pairs" },
      { name: "images", description: "save_images() — filename, page_number, caption" },
    ],
  },
  "i-graph": {
    title: "Rebuild Knowledge Graph",
    description: "After all 6 steps succeed and the paper is marked completed, the entire NetworkX graph is rebuilt from scratch. This ensures the new paper's entities, citations, and relations are immediately available for graph-based queries.",
    technologies: ["NetworkX DiGraph", "Full rebuild from SQLite"],
    keyFiles: ["rag-service/src/research_owl/graph_service.py — rebuild()"],
    dataFlow: [
      "Load completed papers → add paper nodes",
      "Load all citations → add CITES edges (create missing paper nodes)",
      "Load all entities → add entity nodes",
      "For each paper: load paper_entities → add relation edges",
    ],
  },
  "i-sse": {
    title: "SSE Progress Tracking",
    description: "The progress.py module maintains an in-memory dict keyed by paper_id. Each step transition (pending → in_progress → completed/failed) fires an asyncio.Event, which wakes up SSE consumers on the frontend. The PipelineStepper component shows a live progress indicator for each of the 6 steps.",
    technologies: ["asyncio.Event", "SSE (Server-Sent Events)", "In-memory progress store"],
    keyFiles: ["rag-service/src/research_owl/progress.py", "webapp/src/components/ingest/pipeline-stepper.tsx"],
    dataFlow: [
      "Each step calls update_step(paper_id, step, status)",
      "update_step() sets timestamps and fires asyncio.Event",
      "SSE endpoint /papers/{paper_id}/progress streams updates",
      "Frontend PipelineStepper shows real-time step status",
    ],
  },
};

// ── Query details ───────────────────────────────────────────────

const queryDetails: Record<string, ComponentDetail> = {
  "q-user": {
    title: "User Chat Message",
    description: "User types a message in the chat page. The frontend uses useChat() from @ai-sdk/react with a DefaultChatTransport. Messages are sent as POST to /api/chat with the selected model ID. Responses are streamed back via SSE.",
    technologies: ["@ai-sdk/react — useChat()", "DefaultChatTransport"],
    keyFiles: ["webapp/src/app/page.tsx — handleSubmit()"],
  },
  "q-agent": {
    title: "ToolLoopAgent",
    description: "The core orchestrator. Creates a ToolLoopAgent with system instructions, 3 tools (list_papers, hybrid_search, show_image), temperature=0.5, and stops after 6 steps. The agent reasons about which tool(s) to call, executes them, appends results, and loops until it produces a text response.",
    technologies: ["Vercel AI SDK — ToolLoopAgent", "stepCountIs(6)", "temperature 0.5"],
    keyFiles: ["webapp/src/lib/agents/research-owl.ts — createResearchOwlAgent()"],
    dataFlow: [
      "Receive messages + system instructions",
      "LLM decides: tool call or text response",
      "If tool call → execute tool → append result → loop",
      "If text → stream response to client",
      "Max 6 steps, then forced stop",
    ],
  },
  "q-llm": {
    title: "LLM / AI Gateway",
    description: "The language model that powers the agent's reasoning. Selected per-chat by the user. Requests go through the Vercel AI Gateway which routes to the appropriate provider.",
    technologies: ["@ai-sdk/gateway", "OpenAI-compatible API"],
    keyFiles: ["webapp/src/lib/ai/providers.ts"],
    subComponents: [
      { name: "google/gemini-2.5-flash", description: "Default model. Fast, good tool use." },
      { name: "anthropic/claude-haiku-4.5", description: "Fast Anthropic model." },
      { name: "anthropic/claude-sonnet-4.5", description: "Reasoning model with extended thinking." },
    ],
  },
  "q-list": {
    title: "list_papers Tool",
    description: "Simplest tool — fetches all papers from the RAG service. Returns paper_id, title, arxiv_url, and num_chunks. The agent calls this first to discover available papers and their IDs for use in subsequent search tools.",
    technologies: ["ragFetch('/papers')", "GET /papers"],
    keyFiles: ["webapp/src/lib/tools/list-papers.ts"],
  },
  "q-hybrid": {
    title: "hybrid_search Tool",
    description: "The primary search tool. Combines knowledge graph traversal with vector search using Reciprocal Rank Fusion (RRF). Discovers related papers through entity matching, runs scoped + global vector search, and merges results. Replaces the old search_chunks tool (raw vector search is still available in the RAG service for evaluation).",
    technologies: ["HybridRetriever", "NetworkX", "Qdrant", "RRF (k=60)"],
    keyFiles: ["webapp/src/lib/tools/hybrid-search.ts", "rag-service/src/research_owl/hybrid_retriever.py"],
    dataFlow: [
      "Split query into words (length > 2)",
      "Substring match entities in SQLite (normalized_name LIKE %word%)",
      "Get paper_ids connected to matched entities",
      "Graph traversal: find papers linked to entity names",
      "Scoped vector search: top 5 papers × 3 chunks each",
      "Global vector search: top_k chunks (fallback)",
      "RRF merge: score = 1/(60 + rank + 1) per source",
      "Return: chunks + graph_context + rrf_score",
    ],
  },
  "q-show": {
    title: "show_image Tool",
    description: "Display a figure or table image in the chat. Used when search results include image chunks (chunk_type='image') with an image_url. The tool returns url and caption for the UI to render; it does not call the RAG service.",
    technologies: ["Tool output only", "No backend call"],
    keyFiles: ["webapp/src/lib/tools/show-image.ts"],
  },
  "q-qdrant": {
    title: "Qdrant Vector Search",
    description: "The vector search backend used by hybrid_search. Embeds the query, then performs cosine similarity search in the research_owl collection. Supports filtering by paper_id for scoped searches.",
    technologies: ["Qdrant", "Cosine similarity", "KEYWORD index on paper_id"],
    keyFiles: ["rag-service/src/research_owl/qdrant_service.py — search_chunks()"],
  },
  "q-sqlite": {
    title: "SQLite (Entity Matching)",
    description: "Used by list_papers for paper metadata, and by hybrid_search for entity matching. The entity search performs substring matching: SELECT FROM entities WHERE normalized_name LIKE '%word%'.",
    technologies: ["SQLite", "Substring LIKE matching"],
    keyFiles: ["rag-service/src/research_owl/db.py — list_papers(), search_entities(), get_papers_for_entity_names()"],
  },
  "q-graph": {
    title: "Knowledge Graph Traversal",
    description: "The hybrid_search tool traverses the NetworkX graph to find papers connected to matched entities. For each entity name, finds the entity node, then follows edges to discover paper nodes. Returns papers with connection context (e.g. 'USES BERT').",
    technologies: ["NetworkX DiGraph", "Predecessor traversal"],
    keyFiles: ["rag-service/src/research_owl/graph_service.py — get_papers_for_entities()"],
  },
};

// ── Data model details ──────────────────────────────────────────

const dataModelDetails: Record<string, ComponentDetail> = {
  "d-papers": {
    title: "papers Table",
    description: "Core table storing metadata for each ingested paper. Primary key is the arxiv ID (e.g. '2004.01354'). Tracks ingestion status, chunk/image counts, and timestamps.",
    technologies: ["SQLite"],
    keyFiles: ["rag-service/src/research_owl/db.py — create_paper(), update_paper(), list_papers()"],
    subComponents: [
      { name: "paper_id TEXT PK", description: "ArXiv ID (e.g. '2004.01354')" },
      { name: "arxiv_url TEXT NOT NULL", description: "Original arxiv URL" },
      { name: "title TEXT", description: "Paper title (extracted by Docling)" },
      { name: "status TEXT DEFAULT 'pending'", description: "pending → processing → completed/failed" },
      { name: "num_chunks INTEGER", description: "Number of text chunks stored in Qdrant" },
      { name: "num_images INTEGER", description: "Number of figure images found" },
      { name: "error_message TEXT", description: "Error details if status=failed" },
      { name: "created_at, updated_at TEXT", description: "Timestamps (datetime('now'))" },
    ],
  },
  "d-images": {
    title: "images Table",
    description: "Stores metadata for figures extracted from papers. Each image links to a paper via paper_id foreign key.",
    technologies: ["SQLite"],
    keyFiles: ["rag-service/src/research_owl/db.py — save_images(), get_images()"],
    subComponents: [
      { name: "id INTEGER PK AUTOINCREMENT", description: "Auto-generated ID" },
      { name: "paper_id TEXT NOT NULL FK", description: "References papers(paper_id)" },
      { name: "filename TEXT NOT NULL", description: "Image filename on disk" },
      { name: "page_number INTEGER", description: "PDF page number (nullable)" },
      { name: "caption TEXT", description: "Figure caption (nullable)" },
    ],
  },
  "d-citations": {
    title: "citations Table",
    description: "Stores citation links between papers. Uses a composite primary key of (citing_id, cited_id). No explicit foreign keys — both columns contain paper IDs that may or may not exist in the papers table.",
    technologies: ["SQLite"],
    keyFiles: ["rag-service/src/research_owl/db.py — save_citations(), get_citations(), get_all_citations()"],
    subComponents: [
      { name: "citing_id TEXT NOT NULL", description: "Paper that contains the citation" },
      { name: "cited_id TEXT NOT NULL", description: "Paper being cited" },
      { name: "PRIMARY KEY (citing_id, cited_id)", description: "Composite key prevents duplicates" },
    ],
  },
  "d-paper-ent": {
    title: "paper_entities Table",
    description: "Junction table linking papers to entities with typed relations. Each row represents one relationship like 'paper X USES entity Y'. Composite primary key of (paper_id, entity_id, relation).",
    technologies: ["SQLite"],
    keyFiles: ["rag-service/src/research_owl/db.py — add_paper_entity(), get_paper_entities()"],
    subComponents: [
      { name: "paper_id TEXT NOT NULL", description: "References papers(paper_id)" },
      { name: "entity_id INTEGER NOT NULL", description: "References entities(id)" },
      { name: "relation TEXT NOT NULL", description: "USES, PROPOSES, EVALUATES_ON, MEASURES, TRAINS, BENCHMARKS, ADDRESSES" },
      { name: "context TEXT", description: "Optional context text for the relationship" },
    ],
  },
  "d-entities": {
    title: "entities Table",
    description: "Stores unique entities extracted from papers by GPT-4o-mini. Each entity has a type, name, and normalized name (lowercase, stripped). Unique constraint on (type, normalized_name) prevents duplicates.",
    technologies: ["SQLite"],
    keyFiles: ["rag-service/src/research_owl/db.py — upsert_entity(), search_entities()"],
    subComponents: [
      { name: "id INTEGER PK AUTOINCREMENT", description: "Auto-generated ID" },
      { name: "type TEXT NOT NULL", description: "Method, Dataset, Metric, Model, or Task" },
      { name: "name TEXT NOT NULL", description: "Display name (original casing)" },
      { name: "normalized_name TEXT NOT NULL", description: "Lowercased, stripped (for matching)" },
      { name: "description TEXT", description: "Brief description from LLM extraction" },
      { name: "UNIQUE(type, normalized_name)", description: "Prevents duplicate entities" },
    ],
  },
  "d-eval-ds": {
    title: "eval_datasets Table",
    description: "Evaluation datasets containing Q&A pairs for RAG testing. Each dataset is linked to specific papers and contains multiple eval items. Supports LLM-generated or manual Q&A pairs.",
    technologies: ["SQLite"],
    keyFiles: ["rag-service/src/research_owl/db.py — create_eval_dataset(), list_eval_datasets()"],
    subComponents: [
      { name: "dataset_id TEXT PK", description: "UUID identifier" },
      { name: "name TEXT NOT NULL", description: "Dataset name" },
      { name: "description TEXT", description: "Dataset description" },
      { name: "paper_ids TEXT DEFAULT '[]'", description: "JSON array of source paper IDs" },
      { name: "num_items INTEGER DEFAULT 0", description: "Count of Q&A pairs" },
    ],
  },
  "d-eval-items": {
    title: "eval_items Table",
    description: "Individual Q&A pairs within an evaluation dataset. Generated by GPT-4o-mini from paper text or created manually. Each item has a question and expected ground truth answer.",
    technologies: ["SQLite"],
    keyFiles: ["rag-service/src/research_owl/db.py — add_eval_items(), update_eval_item()"],
    subComponents: [
      { name: "item_id INTEGER PK AUTOINCREMENT", description: "Auto-generated ID" },
      { name: "dataset_id TEXT NOT NULL FK", description: "References eval_datasets (ON DELETE CASCADE)" },
      { name: "question TEXT NOT NULL", description: "Evaluation question" },
      { name: "ground_truth TEXT NOT NULL", description: "Expected correct answer" },
      { name: "metadata TEXT DEFAULT '{}'", description: "JSON metadata (paper_id, etc.)" },
    ],
  },
  "d-eval-runs": {
    title: "eval_runs Table",
    description: "Records of evaluation runs against a dataset. Each run queries the RAG system with every Q&A item, judges the answers, and stores aggregate scores (correctness pass rate, factual score 0–1).",
    technologies: ["SQLite"],
    keyFiles: ["rag-service/src/research_owl/db.py — create_eval_run(), update_eval_run()"],
    subComponents: [
      { name: "run_id TEXT PK", description: "UUID identifier" },
      { name: "dataset_id TEXT NOT NULL FK", description: "References eval_datasets" },
      { name: "status TEXT DEFAULT 'pending'", description: "pending → running → completed/failed" },
      { name: "query_mode TEXT DEFAULT 'mix'", description: "Search mode: semantic, graph, or mix" },
      { name: "correctness REAL", description: "Aggregate pass rate (0–1)" },
      { name: "factual_correctness REAL", description: "Aggregate factual score (0–1)" },
      { name: "item_results TEXT DEFAULT '[]'", description: "JSON array of per-item results" },
    ],
  },
  "d-qdrant": {
    title: "Qdrant Collection: research_owl",
    description: "Vector database collection storing all paper chunk embeddings. Each point has a UUID, a 1536-dimensional vector, and a payload with paper metadata. Indexed on paper_id and chunk_type for filtered searches.",
    technologies: ["Qdrant", "COSINE distance", "KEYWORD payload index"],
    keyFiles: ["rag-service/src/research_owl/qdrant_service.py"],
    subComponents: [
      { name: "Vector: 1536 dims, COSINE", description: "OpenAI text-embedding-3-small embeddings" },
      { name: "paper_id (KEYWORD index)", description: "Enables paper-scoped filtered search" },
      { name: "chunk_type (KEYWORD index)", description: "'text' or 'image'" },
      { name: "content", description: "Full chunk text or image description" },
      { name: "paper_title, chunk_index", description: "Additional metadata for display" },
    ],
  },
  "d-networkx": {
    title: "NetworkX DiGraph",
    description: "In-memory directed graph rebuilt from SQLite on startup. Paper nodes (paper:{id}) connect to entity nodes ({type}:{name}) via typed relation edges. Also contains citation edges (CITES) between papers.",
    technologies: ["NetworkX DiGraph", "Rebuilt on startup + after ingestion"],
    keyFiles: ["rag-service/src/research_owl/graph_service.py"],
    subComponents: [
      { name: "Paper nodes", description: "paper:{paper_id} — kind='Paper', title attribute" },
      { name: "Entity nodes", description: "{type}:{normalized_name} — kind='Method'/'Dataset'/etc." },
      { name: "Citation edges", description: "paper → paper with relation='CITES'" },
      { name: "Relation edges", description: "paper → entity with relation='USES'/'PROPOSES'/etc. + context" },
    ],
  },
};

// ── Evaluation details ──────────────────────────────────────────

const evalDetails: Record<string, ComponentDetail> = {
  "e-papers": {
    title: "Select Papers",
    description: "User selects which ingested papers to use as source material for evaluation dataset generation. The paper texts (from parsed markdown or re-extracted from PDF) are used to generate Q&A pairs.",
    technologies: ["Webapp UI — DatasetGenerateDialog"],
    keyFiles: ["webapp/src/app/evaluation/page.tsx", "rag-service/src/research_owl/evaluation/dataset_generator.py"],
  },
  "e-generate": {
    title: "Generate Q&A Pairs",
    description: "Uses GPT-4o-mini to generate question-answer pairs from paper text. Text is split into ~12k-char chunks to stay within token limits. System prompt instructs the LLM to create diverse Q&A pairs covering key concepts, methods, and results.",
    technologies: ["GPT-4o-mini", "~12k char chunks", "Structured JSON output"],
    keyFiles: ["rag-service/src/research_owl/evaluation/dataset_generator.py — generate_qa_pairs()"],
    dataFlow: [
      "Load paper text (parsed markdown / Docling JSON / re-extract from PDF)",
      "Split into ~12k-char chunks for token limits",
      "Per chunk: LLM generates [{question, ground_truth}] pairs",
      "Collect all pairs → add_eval_items() → SQLite",
    ],
  },
  "e-dataset": {
    title: "Eval Dataset",
    description: "A collection of Q&A pairs stored in SQLite. Each dataset links to source papers and contains eval_items (question + ground_truth). Datasets can be auto-generated or manually curated.",
    technologies: ["SQLite — eval_datasets + eval_items tables"],
    keyFiles: ["rag-service/src/research_owl/db.py — create_eval_dataset(), add_eval_items()"],
  },
  "e-run": {
    title: "Start Eval Run",
    description: "Creates an evaluation run against a selected dataset. Runs as a background task, processing each Q&A item sequentially. Supports query_mode: 'semantic' (vector only) or 'mix' (hybrid). Progress is streamed via SSE.",
    technologies: ["FastAPI BackgroundTasks", "SSE progress streaming"],
    keyFiles: ["rag-service/src/research_owl/main.py — _async_run_evaluation()", "rag-service/src/research_owl/evaluation/evaluator.py"],
  },
  "e-query": {
    title: "Query RAG (Per Item)",
    description: "For each Q&A item, the evaluator queries the RAG system with the question. In 'semantic' mode, uses vector search directly. In 'mix' mode, uses the hybrid retriever. Returns both the generated answer and the retrieved contexts.",
    technologies: ["QdrantRAGService.search_chunks()", "HybridRetriever.retrieve()"],
    keyFiles: ["rag-service/src/research_owl/evaluation/evaluator.py — run_evaluation()"],
  },
  "e-judge": {
    title: "LLM Judge",
    description: "Two-stage evaluation using GPT-4o-mini as judge. (1) Correctness: pass/fail — does the answer match the ground truth given the context? (2) Factual correctness: 0–1 score — how factually accurate is the answer compared to the reference?",
    technologies: ["GPT-4o-mini (judge model)", "Structured JSON output"],
    keyFiles: ["rag-service/src/research_owl/evaluation/evaluator.py"],
    subComponents: [
      { name: "Correctness Judge", description: "Binary pass/fail. Compares answer against ground truth and retrieved context." },
      { name: "Factual Judge", description: "0–1 continuous score. Rates factual accuracy of the answer vs reference." },
    ],
  },
  "e-results": {
    title: "Results & Metrics",
    description: "Aggregated evaluation results. Per-item: correctness (pass/fail), factual_correctness (0–1), retrieved contexts, generated answer. Aggregated: correctness rate (% passed), mean factual score. Trends tracked across runs.",
    technologies: ["SQLite — eval_runs.item_results", "Recharts (webapp trends)"],
    keyFiles: ["rag-service/src/research_owl/db.py — get_eval_run_detail(), get_eval_stats()"],
    subComponents: [
      { name: "Per-item results", description: "Question, answer, ground_truth, correctness, factual_score" },
      { name: "Aggregate metrics", description: "Correctness rate + mean factual score" },
      { name: "Trends", description: "Chart of metrics across eval runs over time" },
    ],
  },
};

// ── Merge all details ───────────────────────────────────────────

export const componentDetails: Record<string, ComponentDetail> = {
  ...overviewDetails,
  ...ingestionDetails,
  ...queryDetails,
  ...dataModelDetails,
  ...evalDetails,
};
