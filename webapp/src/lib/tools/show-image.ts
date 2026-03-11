import { tool } from "ai";
import { z } from "zod";

export const showImageTool = tool({
  description:
    "Display an image from the knowledge base in the chat. " +
    "Use this when search results return image chunks (chunk_type='image') with an image_url. " +
    "Call this tool to visually show figures, tables, diagrams, or any image to the user.",
  inputSchema: z.object({
    url: z.string().describe("The image_url from a search result chunk"),
    caption: z
      .string()
      .optional()
      .describe("A short caption describing the image (e.g. 'Figure 2: Multi-decoder framework')"),
  }),
  execute: async ({ url, caption }) => {
    return { url, caption: caption ?? null };
  },
});
