# Research Owl

An AI research assistant that reads academic papers, answers your questions, and conducts deep research with multiple specialized AI agents.

Give it a link to any academic paper — it reads, extracts key concepts, and remembers everything. Then ask questions and get cited, accurate answers, or let AI agents collaborate to produce deep research reports.

## Who Uses Research Owl?

- **PhD Students** — Quickly survey a new field, find related work, and identify research gaps for their thesis
- **Researchers** — Keep up with the latest papers, cross-reference findings, and plan new experiments
- **Research Teams** — Build a shared knowledge base of papers the team has read and query it together
- **ML Engineers** — Find SOTA baselines, compare methods, and discover which datasets to benchmark on

## Use Cases

- **Literature Review** — Survey a topic across all your papers
- **Paper Q&A** — Ask questions about specific papers and get cited answers
- **Experiment Planning** — Get baselines, datasets, and metrics from existing literature
- **Explore Connections** — Discover how papers and concepts link together
- **Deep Research** — AI agents collaborate to produce comprehensive research reports

## Architecture

### System Overview

High-level view of all services and how they connect.

```mermaid
graph LR
    User["User / Browser"] -->|HTTP| Webapp["Next.js Webapp<br/>Port 3000"]
    Webapp -->|API Proxy| RAG["RAG Service<br/>FastAPI · Port 8000"]
    RAG -->|Vectors| Qdrant["Qdrant<br/>Vector DB · Port 6333"]
    RAG -->|Metadata| SQLite["SQLite<br/>papers.db"]
    RAG -->|Traverse| Graph["Knowledge Graph<br/>NetworkX · In-memory"]
```

### Ingestion Pipeline

Step-by-step flow of how an arxiv paper gets processed and stored.

```mermaid
graph LR
    URL["ArXiv URL"] -->|POST| API["FastAPI /ingest"]
    API -->|background task| Download["① Download PDF"]
    API -.->|progress events| SSE["SSE Progress"]
    Download -->|PDF file| Extract["② Extract Text + Figures<br/>Docling"]
    Extract -->|text + figures| Embed["③ Embed Chunks<br/>OpenAI embeddings"]
    Extract -->|full text| Entities["④ Extract Entities<br/>GPT-4o-mini"]
    Extract -->|full text| Citations["⑤ Parse Citations<br/>Regex · ArXiv IDs"]
    Extract -->|PNGs| Images["⑥ Collect Images"]
    Embed -->|vectors| QdrantStore["Qdrant"]
    Entities -->|entities + relations| SQLiteStore["SQLite"]
    Citations -->|citations| SQLiteStore
    Images -->|image metadata| SQLiteStore
    SQLiteStore -->|rebuild| GraphStore["Knowledge Graph<br/>NetworkX"]
```

### Chat Flow

How a user chat message flows through the AI agent, tools, and retrieval backends.

```mermaid
graph TD
    User["User"] -->|message| Agent["Chat Agent<br/>ToolLoopAgent · max 6 steps"]
    Agent -->|reason + decide| LLM["LLM<br/>Gemini 2.5 Flash / Claude"]

    Agent -->|tool call| ListPapers["list_papers"]
    Agent -->|tool call| HybridSearch["hybrid_search<br/>Graph + Vector + RRF"]
    Agent -->|tool call| ShowImage["show_image"]

    ListPapers -->|query| SQLite1["SQLite"]
    HybridSearch -->|entity match| SQLite2["SQLite"]
    HybridSearch -->|scoped + global| Qdrant["Qdrant"]
    HybridSearch -.->|traverse| Graph["Knowledge Graph"]
```

### Research Multi-Agent System

Multi-agent system: an orchestrator delegates to specialized agents for literature review, web search, planning, and synthesis.

```mermaid
graph TD
    User["User"] -->|research query| Orch["Orchestrator Agent<br/>Research Director · max 12 steps"]
    Orch -->|reason + decide| LLM["LLM<br/>Gemini 2.5 Flash / Claude"]

    Orch -->|"① delegate"| KB["KB Review Agent<br/>Search existing papers"]
    Orch -->|"② delegate"| Web["Web Scout Agent<br/>Find new arXiv papers"]
    Orch -->|"③ delegate"| Planner["Research Planner<br/>Design experiments"]
    Orch -->|"④ delegate"| Synth["Synthesis Agent<br/>Final report"]

    KB -->|tool call| ListPapers["list_papers"]
    KB -->|tool call| HybridSearch["hybrid_search"]
    Web -->|tool call| ArXiv["search_arxiv"]
    Web -->|tool call| WebSearch["search_web<br/>Perplexity"]
    Planner -.->|verify details| HybridSearch
    Planner -.->|lookup baselines| ArXiv
    Synth -.->|verify details| HybridSearch
    Synth -->|tool call| ShowImage["show_image"]

    ListPapers --> SQLite["SQLite"]
    HybridSearch --> SQLite
    HybridSearch --> Qdrant["Qdrant"]
    HybridSearch -.-> Graph["Knowledge Graph"]
    ArXiv --> External["ArXiv / Web"]
    WebSearch --> External
```

### Evaluation Pipeline

Dataset generation, evaluation runs, and LLM-as-judge scoring pipeline.

```mermaid
graph LR
    Papers["Select Papers"] -->|paper texts| Generate["Generate Q&A<br/>GPT-4o-mini"]
    Generate -->|Q&A pairs| Dataset["Eval Dataset<br/>SQLite"]
    Dataset -->|select dataset| Run["Start Eval Run<br/>Background task"]
    Run -->|per question| Query["Query RAG<br/>search_chunks / graph_search"]
    Query -->|answer + context| Judge["LLM Judge<br/>Correctness + factual score"]
    Judge -->|scores| Results["Results<br/>Per-item scores · aggregates"]
```

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js, React, Tailwind CSS, shadcn/ui |
| **AI Models** | Gemini 2.5, Claude Haiku & Sonnet |
| **Search & Storage** | Qdrant vector DB, SQLite, NetworkX Knowledge Graph |
| **Backend** | FastAPI, Python, OpenAI embeddings |

## Roadmap

- **Citation Chain Ingestion** — Automatically ingest referenced papers to build a deeper and interconnected knowledge base
- **Multi-User Collaboration** — Shared workspaces where teams can annotate, discuss, and query papers together
- **Fine-Tuned Embeddings** — Domain-specific embedding models trained on academic text for more accurate retrieval
- **Research Writing Assistant** — Draft paper sections with proper citations pulled directly from your knowledge base
