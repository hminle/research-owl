import { tool } from "ai";
import { z } from "zod";
import { ragFetch } from "@/lib/rag-server";

interface PaperInfo {
  paper_id: string;
  title: string;
  arxiv_url: string;
  status: string;
  num_chunks: number;
}

export const listPapersTool = tool({
  description:
    "List all papers in the knowledge base. Returns paper IDs (arxiv IDs), titles, and metadata. " +
    "Call this FIRST when you need to know which papers are available or to find the correct " +
    "paper_id for a paper the user mentions.",
  inputSchema: z.object({}),
  execute: async () => {
    const res = await ragFetch("/papers");
    const papers: PaperInfo[] = await res.json();
    return papers.map((p) => ({
      paper_id: p.paper_id,
      title: p.title,
      arxiv_url: p.arxiv_url,
      num_chunks: p.num_chunks,
    }));
  },
});
