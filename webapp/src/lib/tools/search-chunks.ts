import { tool } from "ai";
import { z } from "zod";
import { ragFetch } from "@/lib/rag-server";

const chunkSchema = z.object({
  id: z.string(),
  paper_id: z.string(),
  paper_title: z.string(),
  chunk_type: z.string(),
  chunk_index: z.number(),
  content: z.string(),
  image_filename: z.string().nullable().optional(),
  score: z.number(),
});

export type ChunkResult = z.infer<typeof chunkSchema>;

export const searchChunksTool = tool({
  description:
    "Search the knowledge base of ingested research papers by semantic similarity. " +
    "Use this tool when the user asks about specific paper content, needs evidence or citations, " +
    "or when you need to ground your response in actual paper text. " +
    "Returns relevant text chunks with paper titles and relevance scores. " +
    "Include the paper name or topic directly in the query for best results — do NOT use paper_id unless you know the exact arxiv ID (e.g. '2004.01354').",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "The search query to find relevant paper chunks. Include the paper name or key terms in the query for best results."
      ),
    top_k: z
      .number()
      .min(1)
      .max(20)
      .default(5)
      .describe("Number of results to return (default 5)"),
    paper_id: z
      .string()
      .optional()
      .describe(
        "Optional arxiv paper ID (e.g. '2004.01354') to scope search to a specific paper. " +
        "Do NOT pass paper titles here — only use exact arxiv IDs. Omit if unsure."
      ),
  }),
  execute: async ({ query, top_k, paper_id }) => {
    const res = await ragFetch("/chunks/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, top_k, paper_id }),
    });
    const chunks: ChunkResult[] = await res.json();
    return chunks;
  },
});

