import type { Node, Edge } from "@xyflow/react";

// ─── Types ──────────────────────────────────────────────────────

export interface PresentationSlide {
  id: string;
  title: string;
  description: string;
  type: "cards" | "flow";
  cards?: CardData[];
  nodes?: Node[];
  edges?: Edge[];
}

export interface CardData {
  icon: string; // lucide icon name
  title: string;
  description: string;
  color: string;
}

// ─── Helpers ────────────────────────────────────────────────────

const nd = { draggable: false, connectable: false };

function pn(
  id: string,
  x: number,
  y: number,
  label: string,
  subtitle: string,
  color: string,
  icon: string,
): Node {
  return {
    id,
    type: "presentationNode",
    position: { x, y },
    data: { label, subtitle, color, icon },
    ...nd,
  };
}

const EDGE_COLOR = "#94a3b8";

function pe(
  id: string,
  source: string,
  target: string,
  label?: string,
): Edge {
  return {
    id,
    source,
    target,
    sourceHandle: "source-right",
    targetHandle: "target-left",
    type: "smoothstep",
    label,
    style: { strokeWidth: 2.5, stroke: EDGE_COLOR },
    labelStyle: { fontSize: 13, fill: "#64748b", fontWeight: 600 },
    labelBgStyle: { fill: "#ffffff", fillOpacity: 0.95 },
    labelBgPadding: [8, 5] as [number, number],
    labelBgBorderRadius: 6,
  };
}

function peCustom(
  id: string,
  source: string,
  target: string,
  sh: string,
  th: string,
  label?: string,
): Edge {
  return {
    ...pe(id, source, target, label),
    sourceHandle: sh,
    targetHandle: th,
  };
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 1: What is Research Owl? (cards)
// ═══════════════════════════════════════════════════════════════

const slide1: PresentationSlide = {
  id: "intro",
  title: "What is Research Owl?",
  description:
    "An AI research assistant that reads academic papers and answers your questions about them.",
  type: "cards",
  cards: [
    {
      icon: "FileUp",
      title: "Upload",
      description: "Give it a link to any academic paper",
      color: "amber",
    },
    {
      icon: "Brain",
      title: "Understand",
      description: "It reads, extracts key concepts, and remembers everything",
      color: "violet",
    },
    {
      icon: "MessageSquare",
      title: "Chat",
      description: "Ask questions and get cited, accurate answers",
      color: "blue",
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// SLIDE 2: The Big Picture (flow — 3 nodes)
// ═══════════════════════════════════════════════════════════════

const slide2: PresentationSlide = {
  id: "big-picture",
  title: "The Big Picture",
  description:
    "Three main parts work together: a web app you interact with, an AI brain that reasons, and a knowledge store that remembers.",
  type: "flow",
  nodes: [
    pn("app", 0, 100, "Web App", "What you see and use", "blue", "Monitor"),
    pn("brain", 400, 100, "AI Agent", "Reads, reasons, and answers", "violet", "Brain"),
    pn("store", 800, 100, "Knowledge Store", "Remembers everything", "emerald", "Database"),
  ],
  edges: [
    pe("bp-1", "app", "brain", "asks questions"),
    pe("bp-2", "brain", "store", "searches & stores"),
  ],
};

// ═══════════════════════════════════════════════════════════════
// SLIDE 3: How Papers Get In (flow — 4 steps)
// ═══════════════════════════════════════════════════════════════

const slide3: PresentationSlide = {
  id: "ingestion",
  title: "How Papers Get In",
  description:
    "Give it a paper link, and it reads, understands, and remembers it — fully automatically.",
  type: "flow",
  nodes: [
    pn("link", 0, 100, "Paper Link", "Paste an arxiv URL", "gray", "Link"),
    pn("read", 320, 100, "Read PDF", "Extracts all text and figures", "amber", "FileText"),
    pn("pieces", 640, 100, "Break Into Pieces", "Splits into searchable chunks", "amber", "Scissors"),
    pn("store", 960, 100, "Store & Index", "Saves in the knowledge store", "emerald", "Database"),
  ],
  edges: [
    pe("in-1", "link", "read"),
    pe("in-2", "read", "pieces"),
    pe("in-3", "pieces", "store"),
  ],
};

// ═══════════════════════════════════════════════════════════════
// SLIDE 4: How It Understands Papers (flow — concepts + map)
// ═══════════════════════════════════════════════════════════════

const slide4: PresentationSlide = {
  id: "understanding",
  title: "How It Understands Papers",
  description:
    "It identifies key concepts — methods, datasets, models — and builds a map of how papers connect to each other.",
  type: "flow",
  nodes: [
    pn("paper", 0, 120, "Paper", "The full text of a paper", "blue", "FileText"),
    pn("extract", 340, 0, "Find Concepts", "Methods, datasets, models, tasks", "violet", "Sparkles"),
    pn("refs", 340, 240, "Find References", "Links to other papers", "amber", "GitBranch"),
    pn("map", 720, 120, "Knowledge Map", "A web of connected papers and ideas", "emerald", "Share2"),
  ],
  edges: [
    peCustom("un-1", "paper", "extract", "source-right", "target-left"),
    peCustom("un-2", "paper", "refs", "source-right", "target-left"),
    peCustom("un-3", "extract", "map", "source-right", "target-left"),
    peCustom("un-4", "refs", "map", "source-right", "target-left"),
  ],
};

// ═══════════════════════════════════════════════════════════════
// SLIDE 5: How It Answers Questions (flow — 3 steps)
// ═══════════════════════════════════════════════════════════════

const slide5: PresentationSlide = {
  id: "answering",
  title: "How It Answers Questions",
  description:
    "You ask a question. The AI finds the most relevant sections from your papers, reasons about them, and writes a cited answer.",
  type: "flow",
  nodes: [
    pn("question", 0, 100, "Your Question", "Type anything about your papers", "gray", "MessageSquare"),
    pn("find", 380, 100, "Find Relevant Info", "Searches across all stored papers", "rose", "Search"),
    pn("answer", 760, 100, "AI Writes Answer", "Cited, accurate response", "violet", "PenTool"),
  ],
  edges: [
    pe("ans-1", "question", "find"),
    pe("ans-2", "find", "answer"),
  ],
};

// ═══════════════════════════════════════════════════════════════
// SLIDE 6: Smart Search (flow — two-lane merge)
// ═══════════════════════════════════════════════════════════════

const slide6: PresentationSlide = {
  id: "smart-search",
  title: "Smart Search",
  description:
    "It uses two search strategies at once and combines their results to find the best information.",
  type: "flow",
  nodes: [
    pn("query", 0, 130, "Your Question", "", "gray", "MessageSquare"),
    pn("text-search", 350, 10, "Text Search", "Finds similar-sounding passages", "sky", "FileSearch"),
    pn("graph-search", 350, 250, "Knowledge Map Search", "Follows connections between concepts", "orange", "Share2"),
    pn("merge", 730, 130, "Combine Results", "Picks the best from both strategies", "rose", "Merge"),
    pn("results", 1080, 130, "Best Results", "Most relevant paper sections", "emerald", "CheckCircle"),
  ],
  edges: [
    peCustom("ss-1", "query", "text-search", "source-right", "target-left"),
    peCustom("ss-2", "query", "graph-search", "source-right", "target-left"),
    peCustom("ss-3", "text-search", "merge", "source-right", "target-left"),
    peCustom("ss-4", "graph-search", "merge", "source-right", "target-left"),
    pe("ss-5", "merge", "results"),
  ],
};

// ═══════════════════════════════════════════════════════════════
// SLIDE 7: Quality Assurance (flow — loop)
// ═══════════════════════════════════════════════════════════════

const slide7: PresentationSlide = {
  id: "evaluation",
  title: "Quality Assurance",
  description:
    "We automatically test the system by generating questions, having it answer them, and grading the results with an AI judge.",
  type: "flow",
  nodes: [
    pn("gen", 0, 100, "Generate Questions", "Creates test Q&A from papers", "blue", "ListChecks"),
    pn("answer", 380, 100, "System Answers", "The AI tries to answer each one", "amber", "MessageSquare"),
    pn("judge", 760, 100, "AI Grades Results", "Scores accuracy and correctness", "violet", "Award"),
  ],
  edges: [
    pe("ev-1", "gen", "answer", "test questions"),
    pe("ev-2", "answer", "judge", "answers + context"),
  ],
};

// ═══════════════════════════════════════════════════════════════
// SLIDE 8: Under the Hood (cards — tech stack)
// ═══════════════════════════════════════════════════════════════

const slide8: PresentationSlide = {
  id: "tech-stack",
  title: "Under the Hood",
  description:
    "The technology stack powering Research Owl.",
  type: "cards",
  cards: [
    {
      icon: "Monitor",
      title: "Frontend",
      description: "Next.js, React, Tailwind CSS",
      color: "blue",
    },
    {
      icon: "Brain",
      title: "AI Models",
      description: "Gemini 2.5, Claude Haiku & Sonnet",
      color: "violet",
    },
    {
      icon: "Database",
      title: "Search & Storage",
      description: "Qdrant vector DB, SQLite, Knowledge Graph",
      color: "emerald",
    },
    {
      icon: "Server",
      title: "Backend",
      description: "FastAPI, Python, OpenAI embeddings",
      color: "amber",
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════

export const slides: PresentationSlide[] = [
  slide1,
  slide2,
  slide3,
  slide4,
  slide5,
  slide6,
  slide7,
  slide8,
];
