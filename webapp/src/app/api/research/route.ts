import { createAgentUIStreamResponse } from "ai";
import { createOrchestratorAgent } from "@/lib/agents/orchestrator-agent";

export const maxDuration = 300;

export async function POST(request: Request) {
  const { messages, modelId }: { messages: unknown[]; modelId?: string } =
    await request.json();

  const agent = createOrchestratorAgent(modelId);

  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages,
  });
}
