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
  image_url: z.string().nullable().optional(),
  score: z.number(),
});

export type ChunkResult = z.infer<typeof chunkSchema>;

export function enrichImageUrls<T extends { chunk_type: string; paper_id: string; image_filename?: string | null }>(
  chunks: T[],
): (T & { image_url?: string | null })[] {
  return chunks.map((chunk) => ({
    ...chunk,
    image_url:
      chunk.chunk_type === "image" && chunk.image_filename
        ? `/api/rag/images/${chunk.paper_id}/${chunk.image_filename}`
        : null,
  }));
}

export const searchChunksTool = tool({
  description:
    "Vector search within a SINGLE paper's text and figures. " +
    "Use ONLY for questions about one specific paper's content, finding exact passages, or single-paper deep dives. " +
    "Always pass a paper_id to scope results. " +
    "Do NOT use for cross-paper questions, comparisons, or finding related papers — use graph_search instead. " +
    "Returns relevant text chunks and image chunks with paper titles and relevance scores. " +
    "Image chunks include an image_url you can embed with markdown: ![description](image_url)",
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
    return enrichImageUrls(chunks);
  },
});

