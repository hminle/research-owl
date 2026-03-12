import { tool } from "ai";
import { z } from "zod";
import { ragFetch } from "@/lib/rag-server";

interface ArxivResult {
  arxiv_id: string;
  title: string;
  authors: string[];
  abstract: string;
  pdf_url: string;
  published: string;
  categories: string[];
}

interface ArxivSearchResponse {
  results: ArxivResult[];
  total: number;
}

export const searchArxivTool = tool({
  description:
    "Search arXiv for academic papers by query. Returns titles, authors, abstracts, and arxiv IDs. " +
    "Use this to find papers NOT already in the knowledge base.",
  inputSchema: z.object({
    query: z
      .string()
      .describe("The search query (e.g. 'diffusion models for image generation')"),
    max_results: z
      .number()
      .min(1)
      .max(20)
      .default(10)
      .describe("Number of results to return (default 10)"),
    sort_by: z
      .enum(["relevance", "submitted_date", "last_updated"])
      .default("relevance")
      .describe("Sort order for results"),
  }),
  execute: async ({ query, max_results, sort_by }) => {
    const res = await ragFetch("/search/arxiv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, max_results, sort_by }),
    });
    const data: ArxivSearchResponse = await res.json();
    return data.results;
  },
});
