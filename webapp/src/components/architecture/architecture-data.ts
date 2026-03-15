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
  n("user",        "archUser",     80,  200, "User / Browser",       "",                          "gray"),
  n("webapp",      "archService",  340, 200, "Next.js Webapp",       "Port 3000",                 "blue"),
  n("rag-service", "archService",  620, 200, "RAG Service",          "FastAPI · Port 8000",       "emerald"),
  n("qdrant",      "archStorage",  920, 60,  "Qdrant",               "Vector DB · Port 6333",     "sky"),
  n("sqlite",      "archStorage",  920, 220, "SQLite",               "papers.db",                 "slate"),
  n("graph",       "archStorage",  920, 380, "Knowledge Graph",      "NetworkX · In-memory",      "orange"),
];

const overviewEdges: Edge[] = [
  e("o-user-webapp",   "user",       "webapp",      "HTTP",              "source-right", "target-left"),
  e("o-webapp-rag",    "webapp",     "rag-service", "API Proxy",         "source-right", "target-left"),
  e("o-rag-qdrant",    "rag-service","qdrant",      "Vectors",           "source-right", "target-left"),
  e("o-rag-sqlite",    "rag-service","sqlite",      "Metadata",          "source-right", "target-left"),
  e("o-rag-graph",     "rag-service","graph",       "Traverse",          "source-right", "target-left"),
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
// VIEW 3: CHAT – User ↔ AI Agent ↔ Tools ↔ Storage
// ═══════════════════════════════════════════════════════════════

const chatNodes: Node[] = [
  // Row 1: User + LLM
  n("q-user",   "archUser",     340, 20,  "User",             "Chat page input",                     "gray"),
  n("q-llm",    "archExternal", 640, 20,  "LLM",             "Gemini / OpenAI GPT / Claude",         "violet"),
  // Row 2: AI Agent (ToolLoopAgent)
  n("q-agent",  "archService",  310, 170, "Chat Agent",       "ToolLoopAgent · max 6 steps · temp 0.5","violet"),
  // Row 3: Tools (below agent)
  n("q-list",   "archModule",   60,  370, "list_papers",     "GET /papers → paper list",             "blue"),
  n("q-hybrid", "archModule",   330, 370, "hybrid_search",   "Graph + Vector + RRF",                 "rose"),
  n("q-show",   "archModule",   620, 370, "show_image",      "Display figure/table in chat",         "blue"),
  // Row 4: Storage backends
  n("q-sqlite", "archStorage",  60,  560, "SQLite",          "Paper list + entity matching",         "slate"),
  n("q-qdrant", "archStorage",  340, 560, "Qdrant",          "Vector similarity search",             "sky"),
  n("q-graph",  "archStorage",  620, 560, "Knowledge Graph", "Entity → paper traversal",             "orange"),
];

const chatEdges: Edge[] = [
  // User → Agent
  e("q-1", "q-user",   "q-agent",  "message",        "source-bottom", "target-top"),
  // Agent ↔ LLM
  e("q-2", "q-agent",  "q-llm",    "reason + decide","source-right",  "target-bottom"),
  // Agent → Tools (tool calls)
  e("q-3", "q-agent",  "q-list",   "tool call",      "source-bottom", "target-top"),
  e("q-4", "q-agent",  "q-hybrid", "tool call",      "source-bottom", "target-top"),
  e("q-5", "q-agent",  "q-show",   "tool call",      "source-bottom", "target-top"),
  // Tools → Storage
  e("q-6", "q-list",   "q-sqlite", "GET /papers",    "source-bottom", "target-top"),
  e("q-7", "q-hybrid", "q-sqlite", "entity match",   "source-bottom", "target-top"),
  e("q-8", "q-hybrid", "q-qdrant", "scoped + global","source-bottom", "target-top"),
  e("q-9", "q-hybrid", "q-graph",  "traverse",       "source-bottom", "target-top",  { dashed: true }),
];

// ═══════════════════════════════════════════════════════════════
// VIEW 4: DATA MODEL
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// VIEW 4: EVALUATION FLOW
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
// VIEW 5: RESEARCH MULTI-AGENT SYSTEM
// ═══════════════════════════════════════════════════════════════

const researchNodes: Node[] = [
  // Row 1: User + LLM
  n("r-user",       "archUser",     340, 20,  "User",                "Research page input",                     "gray"),
  n("r-llm",        "archExternal", 700, 20,  "LLM",                "Gemini / OpenAI GPT / Claude",            "violet"),
  // Row 2: Orchestrator
  n("r-orch",       "archService",  340, 170, "Orchestrator Agent",  "Research Director · max 12 steps · temp 0.3","violet"),
  // Row 3: Sub-agents (left to right flow)
  n("r-kb",         "archModule",   20,  380, "KB Review Agent",     "Search existing papers · max 10 steps",   "blue"),
  n("r-web",        "archModule",   280, 380, "Web Scout Agent",     "Find new arXiv papers · max 10 steps",    "emerald"),
  n("r-plan",       "archModule",   540, 380, "Research Planner",    "Design experiments · max 8 steps",        "rose"),
  n("r-synth",      "archModule",   800, 380, "Synthesis Agent",     "Final report · max 6 steps",              "amber"),
  // Row 4: Tools
  n("r-list",       "archModule",   20,  580, "list_papers",         "GET /papers → paper list",                "blue"),
  n("r-hybrid",     "archModule",   170, 580, "hybrid_search",       "Graph + Vector + RRF",                    "blue"),
  n("r-arxiv",      "archModule",   370, 580, "search_arxiv",        "ArXiv API search",                        "emerald"),
  n("r-websearch",  "archModule",   530, 580, "search_web",          "Perplexity web search",                   "emerald"),
  n("r-show",       "archModule",   800, 580, "show_image",          "Display figure in chat",                  "amber"),
  // Row 5: Storage backends
  n("r-sqlite",     "archStorage",  20,  750, "SQLite",              "Paper list + entity matching",            "slate"),
  n("r-qdrant",     "archStorage",  200, 750, "Qdrant",              "Vector similarity search",                "sky"),
  n("r-graph",      "archStorage",  380, 750, "Knowledge Graph",     "Entity → paper traversal",                "orange"),
  n("r-external",   "archExternal", 530, 750, "ArXiv / Web",         "External sources",                        "gray"),
];

const researchEdges: Edge[] = [
  // User → Orchestrator ↔ LLM
  e("r-1",  "r-user",      "r-orch",      "research query",  "source-bottom", "target-top"),
  e("r-2",  "r-orch",      "r-llm",       "reason + decide", "source-right",  "target-bottom"),
  // Orchestrator → Sub-agents (delegation)
  e("r-3",  "r-orch",      "r-kb",        "① delegate",      "source-bottom", "target-top"),
  e("r-4",  "r-orch",      "r-web",       "② delegate",      "source-bottom", "target-top"),
  e("r-5",  "r-orch",      "r-plan",      "③ delegate",      "source-bottom", "target-top"),
  e("r-6",  "r-orch",      "r-synth",     "④ delegate",      "source-bottom", "target-top"),
  // KB Review → its tools
  e("r-7",  "r-kb",        "r-list",      "tool call",       "source-bottom", "target-top"),
  e("r-8",  "r-kb",        "r-hybrid",    "tool call",       "source-bottom", "target-top"),
  // Web Scout → its tools
  e("r-9",  "r-web",       "r-arxiv",     "tool call",       "source-bottom", "target-top"),
  e("r-10", "r-web",       "r-websearch", "tool call",       "source-bottom", "target-top"),
  // Research Planner → its tools
  e("r-11", "r-plan",      "r-hybrid",    "verify details",  "source-bottom", "target-top",  { dashed: true }),
  e("r-12", "r-plan",      "r-arxiv",     "lookup baselines","source-bottom", "target-top",  { dashed: true }),
  // Synthesis → its tools
  e("r-13", "r-synth",     "r-hybrid",    "verify details",  "source-bottom", "target-top",  { dashed: true }),
  e("r-14", "r-synth",     "r-show",      "tool call",       "source-bottom", "target-top"),
  // Tools → Storage
  e("r-15", "r-list",      "r-sqlite",    "GET /papers",     "source-bottom", "target-top"),
  e("r-16", "r-hybrid",    "r-sqlite",    "entity match",    "source-bottom", "target-top"),
  e("r-17", "r-hybrid",    "r-qdrant",    "vector search",   "source-bottom", "target-top"),
  e("r-18", "r-hybrid",    "r-graph",     "traverse",        "source-bottom", "target-top",  { dashed: true }),
  e("r-19", "r-arxiv",     "r-external",  "arXiv API",       "source-bottom", "target-top"),
  e("r-20", "r-websearch", "r-external",  "Perplexity",      "source-bottom", "target-top"),
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
    id: "chat",
    label: "Chat",
    description: "How a user chat message flows through the AI agent, tools, and retrieval backends.",
    nodes: chatNodes,
    edges: chatEdges,
  },
  {
    id: "evaluation",
    label: "Evaluation",
    description: "Dataset generation, evaluation runs, and LLM-as-judge scoring pipeline.",
    nodes: evalNodes,
    edges: evalEdges,
  },
  {
    id: "research",
    label: "Research",
    description: "Multi-agent system: orchestrator delegates to specialized agents for literature review, web search, planning, and synthesis.",
    nodes: researchNodes,
    edges: researchEdges,
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
    title: "Chat Agent (ToolLoopAgent)",
    description: "The core orchestrator. Creates a ToolLoopAgent with system instructions, 3 tools (list_papers, hybrid_search, show_image), temperature=0.5, and stops after 6 steps. The agent reasons about which tool(s) to call, executes them, appends results, and loops until it produces a text response.",
    technologies: ["Vercel AI SDK — ToolLoopAgent", "stepCountIs(6)", "temperature 0.5"],
    keyFiles: ["webapp/src/lib/agents/chat-agent.ts — createChatAgent()"],
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
    description: "The primary search tool. Combines knowledge graph traversal with vector search using Reciprocal Rank Fusion (RRF). First, entity matching finds papers related to query terms via the knowledge graph. Then two parallel vector searches run: a scoped search (filtered to graph-discovered papers only, retrieving top 3 chunks per paper for the top 5 papers) and a global search (unfiltered across all papers, retrieving top_k chunks). Finally, RRF merges both ranked lists into a single result. RRF assigns each chunk a score of 1/(k + rank) where k=60 is a smoothing constant that prevents top-ranked results from dominating. Chunks appearing in both scoped and global results get their scores summed, naturally boosting results that are both topically relevant (via graph) and semantically similar (via embeddings).",
    technologies: ["HybridRetriever", "NetworkX", "Qdrant", "RRF (k=60)"],
    keyFiles: ["webapp/src/lib/tools/hybrid-search.ts", "rag-service/src/research_owl/hybrid_retriever.py"],
    dataFlow: [
      "Split query into words (length > 2)",
      "Substring match entities in SQLite (normalized_name LIKE %word%)",
      "Graph traversal: find papers linked to matched entities",
      "Scoped vector search: filtered to graph-discovered papers only (top 5 papers × 3 chunks each)",
      "Global vector search: unfiltered across all papers (top_k chunks)",
      "RRF merge: score = 1/(60 + rank) per source, summed for chunks in both lists",
      "Return: ranked chunks + graph_context + rrf_score",
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

// ── Research details ─────────────────────────────────────────────

const researchDetails: Record<string, ComponentDetail> = {
  "r-user": {
    title: "User Research Query",
    description: "User types a research topic in the Research page. The frontend uses useChat() from @ai-sdk/react. Messages are sent as POST to /api/research with the selected model ID. The API has a 300-second timeout to support deep multi-agent research flows.",
    technologies: ["@ai-sdk/react — useChat()", "DefaultChatTransport"],
    keyFiles: ["webapp/src/app/research/page.tsx"],
  },
  "r-orch": {
    title: "Orchestrator Agent (Research Director)",
    description: "The central coordinator that delegates work to four specialized sub-agents in sequence. Starts with review_kb to search existing KB, then scout_web for new papers, plan_research to design experiments with combined findings, and finally synthesize to produce the final report. Each sub-agent streams results back; the orchestrator passes accumulated context forward.",
    technologies: ["Vercel AI SDK — ToolLoopAgent", "stepCountIs(12)", "temperature 0.3"],
    keyFiles: ["webapp/src/lib/agents/orchestrator-agent.ts"],
    dataFlow: [
      "Receive user research query",
      "① Delegate to KB Review Agent — search existing papers",
      "② Delegate to Web Scout Agent — find new arXiv papers + web resources",
      "③ Delegate to Research Planner — design experiments with combined findings",
      "④ Delegate to Synthesis Agent — produce final polished report",
      "Stream complete report back to user",
    ],
    subComponents: [
      { name: "review_kb", description: "Delegates to KB Review Agent to search ingested papers." },
      { name: "scout_web", description: "Delegates to Web Scout Agent for arXiv + web search." },
      { name: "plan_research", description: "Delegates to Research Planner with accumulated findings." },
      { name: "synthesize", description: "Delegates to Synthesis Agent for final report." },
    ],
  },
  "r-llm": {
    title: "LLM / AI Gateway",
    description: "The language model that powers all agent reasoning. Each agent makes independent LLM calls through the Vercel AI Gateway. The orchestrator and all sub-agents share the same model, selected by the user.",
    technologies: ["@ai-sdk/gateway", "OpenAI-compatible API"],
    keyFiles: ["webapp/src/lib/ai/providers.ts"],
    subComponents: [
      { name: "google/gemini-2.5-flash", description: "Default model. Fast, good tool use." },
      { name: "anthropic/claude-haiku-4.5", description: "Fast Anthropic model." },
      { name: "anthropic/claude-sonnet-4.5", description: "Reasoning model with extended thinking." },
    ],
  },
  "r-kb": {
    title: "KB Review Agent",
    description: "Searches and analyzes papers already ingested into the Research Owl knowledge base. Calls list_papers to discover available papers, performs multiple hybrid_search queries with different formulations, and returns a structured literature summary with key methods, datasets, results, gaps, and connections between papers.",
    technologies: ["ToolLoopAgent", "stepCountIs(10)", "temperature 0.3"],
    keyFiles: ["webapp/src/lib/agents/kb-review-agent.ts"],
    dataFlow: [
      "Call list_papers to see available papers",
      "Perform multiple hybrid_search queries with different formulations",
      "Analyze and cross-reference results",
      "Return structured summary: papers found, methods, datasets, gaps",
    ],
    subComponents: [
      { name: "list_papers", description: "Enumerate all papers in the knowledge base." },
      { name: "hybrid_search", description: "Graph + vector search across ingested papers." },
      { name: "show_image", description: "Display key figures and diagrams." },
    ],
  },
  "r-web": {
    title: "Web Scout Agent",
    description: "Finds new academic papers on arXiv NOT already in the knowledge base, plus supplementary web resources. Uses multiple search strategies: main topic queries, specific sub-queries for different aspects, method/dataset/author name searches. Also searches the web for blog posts, tutorials, GitHub repos, and benchmarks.",
    technologies: ["ToolLoopAgent", "stepCountIs(10)", "temperature 0.3"],
    keyFiles: ["webapp/src/lib/agents/web-scout-agent.ts"],
    dataFlow: [
      "Search arXiv with multiple query formulations",
      "Search by method names, dataset names, author names",
      "Sort by relevance AND submitted_date for recent papers",
      "Web search for blog posts, tutorials, GitHub repos",
      "Return: papers found, key themes, recent trends",
    ],
    subComponents: [
      { name: "search_arxiv", description: "Search arXiv with configurable sort (relevance, date)." },
      { name: "search_web", description: "Perplexity-powered web search for supplementary resources." },
    ],
  },
  "r-plan": {
    title: "Research Planner Agent",
    description: "Designs structured research plans and experiments based on combined literature findings from the KB Review and Web Scout agents. Identifies research gaps, formulates research questions and hypotheses, designs experiments with specific datasets/baselines/metrics, and plans ablation studies.",
    technologies: ["ToolLoopAgent", "stepCountIs(8)", "temperature 0.4"],
    keyFiles: ["webapp/src/lib/agents/research-planner-agent.ts"],
    dataFlow: [
      "Receive combined findings from KB Review + Web Scout",
      "Identify research gaps and opportunities",
      "Formulate 2–4 specific research questions + hypotheses",
      "Design experiments: datasets, baselines, metrics, ablations",
      "Assess risks with mitigation strategies",
    ],
    subComponents: [
      { name: "hybrid_search", description: "Verify specific details in KB." },
      { name: "search_arxiv", description: "Look up specific baselines or referenced papers." },
    ],
  },
  "r-synth": {
    title: "Synthesis Agent",
    description: "Combines ALL findings from the previous three agents into a polished, comprehensive research document. Produces a complete report with executive summary, literature review (internal + external), comparison tables, research gaps, full research plan, and references with arxiv IDs.",
    technologies: ["ToolLoopAgent", "stepCountIs(6)", "temperature 0.4"],
    keyFiles: ["webapp/src/lib/agents/synthesis-agent.ts"],
    dataFlow: [
      "Receive accumulated context from all previous agents",
      "Verify specific details via hybrid_search if needed",
      "Include key figures via show_image",
      "Produce: executive summary, lit review, gaps, research plan, impact",
    ],
    subComponents: [
      { name: "hybrid_search", description: "Verify specific details or retrieve figures." },
      { name: "show_image", description: "Display figures from KB in the final report." },
    ],
  },
  "r-list": {
    title: "list_papers Tool",
    description: "Fetches all papers from the RAG service. Returns paper_id, title, arxiv_url, and num_chunks. Used by the KB Review Agent to discover what papers are available for analysis.",
    technologies: ["ragFetch('/papers')", "GET /papers"],
    keyFiles: ["webapp/src/lib/tools/list-papers.ts"],
  },
  "r-hybrid": {
    title: "hybrid_search Tool",
    description: "Primary search tool combining knowledge graph traversal with vector search using Reciprocal Rank Fusion (RRF). Used by KB Review, Research Planner, and Synthesis agents. Entity matching discovers papers via the graph, then scoped + global vector searches are merged via RRF (k=60).",
    technologies: ["HybridRetriever", "NetworkX", "Qdrant", "RRF (k=60)"],
    keyFiles: ["webapp/src/lib/tools/hybrid-search.ts", "rag-service/src/research_owl/hybrid_retriever.py"],
    dataFlow: [
      "Entity matching in SQLite (normalized_name LIKE %word%)",
      "Graph traversal: find papers linked to matched entities",
      "Scoped vector search: filtered to graph-discovered papers",
      "Global vector search: unfiltered across all papers",
      "RRF merge: score = 1/(60 + rank), summed for overlap",
    ],
  },
  "r-arxiv": {
    title: "search_arxiv Tool",
    description: "Searches the arXiv API for academic papers. Supports configurable query, max_results (1–20), and sort_by (relevance, submitted_date, last_updated). Returns arxiv_id, title, authors, abstract, pdf_url, published date, and categories.",
    technologies: ["ArXiv API", "POST /search/arxiv"],
    keyFiles: ["webapp/src/lib/tools/search-arxiv.ts"],
  },
  "r-websearch": {
    title: "search_web Tool",
    description: "Internet search powered by Perplexity via LLM. Accepts 1–5 parallel search queries. Finds blog posts, documentation, news, benchmarks, and GitHub repos relevant to the research topic. Returns structured results with citations and source URLs.",
    technologies: ["Gemini", "OpenAI GPT", "Perplexity Search", "Parallel queries"],
    keyFiles: ["webapp/src/lib/tools/search-web.ts"],
  },
  "r-show": {
    title: "show_image Tool",
    description: "Displays a figure or table image in the chat. Used by the Synthesis Agent to include key visuals in the final report. Returns url and caption for the UI to render — no backend call needed.",
    technologies: ["Tool output only", "No backend call"],
    keyFiles: ["webapp/src/lib/tools/show-image.ts"],
  },
  "r-sqlite": {
    title: "SQLite (Entity Matching)",
    description: "Used by list_papers for paper metadata, and by hybrid_search for entity matching. Entity search performs substring matching on normalized_name.",
    technologies: ["SQLite", "Substring LIKE matching"],
    keyFiles: ["rag-service/src/research_owl/db.py"],
  },
  "r-qdrant": {
    title: "Qdrant Vector Search",
    description: "Vector search backend used by hybrid_search. Embeds the query and performs cosine similarity search in the research_owl collection. Supports filtering by paper_id for scoped searches.",
    technologies: ["Qdrant", "Cosine similarity", "1536-dim vectors"],
    keyFiles: ["rag-service/src/research_owl/qdrant_service.py"],
  },
  "r-graph": {
    title: "Knowledge Graph Traversal",
    description: "The hybrid_search tool traverses the NetworkX graph to find papers connected to matched entities. For each entity name, finds the entity node, then follows edges to discover paper nodes with connection context.",
    technologies: ["NetworkX DiGraph", "Predecessor traversal"],
    keyFiles: ["rag-service/src/research_owl/graph_service.py"],
  },
  "r-external": {
    title: "External Sources",
    description: "ArXiv API for academic paper discovery and Perplexity-powered web search for supplementary resources like blog posts, tutorials, GitHub repositories, and benchmarks.",
    technologies: ["ArXiv API", "Perplexity Search", "Gemini", "OpenAI GPT", "Claude"],
    keyFiles: ["webapp/src/lib/tools/search-arxiv.ts", "webapp/src/lib/tools/search-web.ts"],
  },
};

// ── Merge all details ───────────────────────────────────────────

export const componentDetails: Record<string, ComponentDetail> = {
  ...overviewDetails,
  ...ingestionDetails,
  ...queryDetails,
  ...evalDetails,
  ...researchDetails,
};
