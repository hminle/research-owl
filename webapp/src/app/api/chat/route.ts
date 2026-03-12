import { createAgentUIStreamResponse } from "ai";
import { createChatAgent } from "@/lib/agents/chat-agent";

export const maxDuration = 60;

export async function POST(request: Request) {
  const { messages, modelId }: { messages: unknown[]; modelId?: string } =
    await request.json();

  const agent = createChatAgent(modelId);

  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages,
  });
}
