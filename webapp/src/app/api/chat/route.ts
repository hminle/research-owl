import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type UIMessage,
} from "ai";
import { getAgentConfig } from "@/lib/ai/agent";

export const maxDuration = 60;

export async function POST(request: Request) {
  const {
    messages,
    modelId,
  }: { messages: UIMessage[]; modelId?: string } = await request.json();

  const config = getAgentConfig(modelId);
  const modelMessages = await convertToModelMessages(messages);

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const result = streamText({
        ...config,
        messages: modelMessages,
      });

      writer.merge(result.toUIMessageStream());
    },
    onError: () => "Oops, an error occurred!",
  });

  return createUIMessageStreamResponse({ stream });
}
