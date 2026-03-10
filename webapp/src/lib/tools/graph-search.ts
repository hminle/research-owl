import { tool } from "ai";
import { z } from "zod";
import { ragFetch } from "@/lib/rag-server";
import type { ChunkResult } from "./search-chunks";

interface GraphSearchResult extends ChunkResult {
  graph_context: string;
  rrf_score: number;
}

export const graphSearchTool = tool({
  description:
    "Search using the knowledge graph for cross-paper insights. " +
    "Use this when the user asks about relationships between methods, " +
    "comparisons across papers, or questions involving multiple concepts like " +
    "'what papers use method X' or 'compare approaches for task Y'. " +
    "Provides graph-augmented context showing how papers and concepts connect.",
  inputSchema: z.object({
    query: z
      .string()
      .describe("The search query to find relevant cross-paper information"),
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
    const results: GraphSearchResult[] = await res.json();
    return results;
  },
});
