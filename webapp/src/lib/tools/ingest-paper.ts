import { tool } from "ai";
import { z } from "zod";
import { ragFetch } from "@/lib/rag-server";

export const ingestPaperTool = tool({
  description:
    "Trigger ingestion of an arXiv paper into the knowledge base. " +
    "The paper will be downloaded, parsed, chunked, and embedded. " +
    "Use this after finding a relevant paper via search_arxiv to add it for deeper analysis.",
  inputSchema: z.object({
    arxiv_id: z
      .string()
      .describe("The arXiv paper ID (e.g. '2301.12345')"),
  }),
  execute: async ({ arxiv_id }) => {
    const res = await ragFetch("/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arxiv_url: `https://arxiv.org/abs/${arxiv_id}` }),
    });
    const data: { paper_id: string; status: string } = await res.json();
    return data;
  },
});
