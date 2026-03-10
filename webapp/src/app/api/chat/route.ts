import { createAgentUIStreamResponse } from "ai";
import { createResearchOwlAgent } from "@/lib/agents/research-owl";

export const maxDuration = 60;

export async function POST(request: Request) {
  const { messages, modelId }: { messages: unknown[]; modelId?: string } =
    await request.json();

  const agent = createResearchOwlAgent(modelId);

  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages,
  });
}
