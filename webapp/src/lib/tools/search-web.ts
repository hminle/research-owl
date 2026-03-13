import { gateway } from "@ai-sdk/gateway";
import { generateText, tool } from "ai";
import { z } from "zod";

export const searchWebTool = tool({
  description:
    "Search the internet for information using Perplexity Search. " +
    "Supports multiple search queries in a single call for efficient research. " +
    "Use this for finding recent research, blog posts, documentation, news, " +
    "or any general web information beyond arXiv papers.",
  inputSchema: z.object({
    queries: z
      .array(z.string())
      .min(1)
      .max(5)
      .describe(
        "One or more search queries to run. Each query should be specific and self-contained. " +
          "Use multiple queries to research different aspects in parallel " +
          "(e.g., different angles on a research topic, related tools, datasets, or benchmarks)."
      ),
  }),
  execute: async ({ queries }) => {
    const dateTimeStr = new Date().toLocaleString("en-US", {
      timeZone: "UTC",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });

    const results = await Promise.allSettled(
      queries.map(async (query) => {
        try {
          console.log(`[searchWeb] Searching for: "${query}"`);

          const { text } = await generateText({
            model: gateway.languageModel("google/gemini-2.5-flash"),
            tools: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              perplexity_search: gateway.tools.perplexitySearch() as any,
            },
            prompt: `Current date and time: ${dateTimeStr}

Search the web for: "${query}"

Instructions:
- Find the most accurate, up-to-date information available
- Include specific details, data points, and findings when available
- Cite your sources (website names and URLs)
- Be concise but thorough — include all relevant details`,
          });

          console.log(`[searchWeb] Search completed for: "${query}"`);

          return {
            success: true as const,
            query,
            results: text,
          };
        } catch (error) {
          const errorMsg =
            error instanceof Error
              ? error.message
              : "Failed to search the web";
          console.error(`[searchWeb] Error for "${query}":`, errorMsg);

          return {
            success: false as const,
            query,
            error: errorMsg,
          };
        }
      })
    );

    const searchResults = results.map((r) =>
      r.status === "fulfilled"
        ? r.value
        : {
            success: false as const,
            query: "",
            error: "Search failed unexpectedly",
          }
    );

    if (searchResults.length === 1) {
      return searchResults[0];
    }

    return {
      success: searchResults.every((r) => r.success),
      query: queries.join(" | "),
      results: searchResults,
    };
  },
});
