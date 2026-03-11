import { tool } from "ai";
import { z } from "zod";
import { ragFetch } from "@/lib/rag-server";
import type { ChunkResult } from "./search-chunks";
import { enrichImageUrls } from "./search-chunks";

interface HybridSearchResult extends ChunkResult {
  graph_context: string;
  rrf_score: number;
}

export type { HybridSearchResult };

export const hybridSearchTool = tool({
  description:
    "Hybrid search combining knowledge graph traversal with vector search across ALL papers. " +
    "This is the primary search tool — use it for any question about paper content. " +
    "Works for: single-paper deep dives, cross-paper comparisons, finding related papers, " +
    "relationship questions, broad topic exploration, or any research question. " +
    "Returns chunks ranked by Reciprocal Rank Fusion (RRF) with graph_context showing " +
    "how papers and concepts connect via the knowledge graph. " +
    "Image chunks include an image_url you can embed with markdown: ![description](image_url)",
  inputSchema: z.object({
    query: z
      .string()
      .describe("The search query to find relevant information across papers"),
    top_k: z
      .number()
      .min(1)
      .max(20)
      .default(10)
      .describe("Number of results to return (default 10)"),
  }),
  execute: async ({ query, top_k }) => {
    const res = await ragFetch("/graph/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, top_k }),
    });
    const results: HybridSearchResult[] = await res.json();
    return enrichImageUrls(results);
  },
});
