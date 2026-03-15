"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ListPapersTool } from "@/components/list-papers-tool";
import { HybridSearchTool } from "@/components/hybrid-search-tool";
import { ShowImageTool } from "@/components/show-image-tool";
import type { ChatAgentUIMessage } from "@/lib/agents/chat-agent";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "@/lib/ai/providers";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Spinner } from "@/components/ui/spinner";
import { Sparkles } from "lucide-react";

const SUGGESTIONS = [
  {
    label: "How does deep WB editing work?",
    prompt: "How does the Deep White-Balance Editing paper use a multi-decoder architecture to correct and manipulate white balance in sRGB images?",
  },
  {
    label: "Modular ISP pipeline",
    prompt: "What are the key modules in the Modular Neural ISP framework, and how does it generalize to unseen cameras?",
  },
  {
    label: "Show architecture figure",
    prompt: "Show me the architecture figure from the Deep White-Balance Editing paper.",
  },
  {
    label: "Compare the approaches",
    prompt: "Compare the approaches in Deep WB Editing, Modular Neural ISP, and CCMNet. How do they each handle camera-specific color processing?",
  },
];

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

function formatTokenCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

const _transportBody = { modelId: DEFAULT_MODEL as string };

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);

  // Keep transport body in sync
  useEffect(() => {
    _transportBody.modelId = selectedModel;
  }, [selectedModel]);

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ modelId: _transportBody.modelId }),
      })
  );

  const { messages, sendMessage, status, stop } = useChat<ChatAgentUIMessage>({
    transport,
  });

  const isStreaming = status === "streaming";

  const sessionTokenUsage = useMemo<TokenUsage>(() => {
    let inputTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;

    for (const msg of messages) {
      if (msg.role === "assistant") {
        const meta = msg.metadata as
          | { usage?: { inputTokens?: number; outputTokens?: number } }
          | undefined;
        if (meta?.usage) {
          const inp = meta.usage.inputTokens ?? 0;
          const out = meta.usage.outputTokens ?? 0;
          inputTokens += inp;
          outputTokens += out;
          totalTokens += inp + out;
        }
      }
    }

    return { inputTokens, outputTokens, totalTokens };
  }, [messages]);

  const messageCount = messages.filter((m) => m.role === "user").length;

  const handleSubmit = ({ text }: { text: string }) => {
    if (!text.trim()) return;
    sendMessage({
      role: "user",
      parts: [{ type: "text", text }],
    });
    setInput("");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      <div className="flex items-center justify-end gap-4 px-4 py-1.5 text-xs text-muted-foreground">
        <span>{formatTokenCount(sessionTokenUsage.totalTokens)} tokens</span>
        <div className="h-3 w-px bg-border" />
        <span>{messageCount} messages</span>
      </div>

      <Conversation className="flex-1">
        <ConversationContent className="max-w-3xl mx-auto w-full">
          {messages.length === 0 ? (
            <ConversationEmptyState>
              <div className="max-w-md space-y-4">
                <div className="flex justify-center">
                  <Image
                    src="/cute-owl-that-read-book.svg"
                    alt="Research Owl mascot"
                    width={64}
                    height={64}
                    className="h-32 w-32"
                    priority
                  />
                </div>
                <div className="space-y-1">
                  <h3 className="font-medium text-sm">Welcome to Research Owl</h3>
                  <p className="text-muted-foreground text-sm">
                    Ask me about research papers, concepts, methodology, or anything academic.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => handleSubmit({ text: s.prompt })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <Sparkles className="h-3 w-3" />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((message, index) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.role === "assistant" ? (
                    <>
                      {message.parts.filter((p) => p.type === "reasoning").length > 0 && (
                        <Reasoning
                          className="w-full"
                          isStreaming={
                            index === messages.length - 1 &&
                            isStreaming &&
                            message.parts.at(-1)?.type === "reasoning"
                          }
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>
                            {message.parts
                              .filter((p) => p.type === "reasoning")
                              .map((p) => ("text" in p ? p.text : ""))
                              .join("\n\n")}
                          </ReasoningContent>
                        </Reasoning>
                      )}
                      {message.parts.map((part, i) => {
                        if (part.type === "text") {
                          return (
                            <MessageResponse key={`${message.id}-${i}`}>
                              {part.text}
                            </MessageResponse>
                          );
                        }
                        if (part.type === "tool-list_papers") {
                          return (
                            <ListPapersTool
                              key={`${message.id}-${i}`}
                              part={part}
                            />
                          );
                        }
                        if (part.type === "tool-hybrid_search") {
                          return (
                            <HybridSearchTool
                              key={`${message.id}-${i}`}
                              part={part}
                            />
                          );
                        }
                        if (part.type === "tool-show_image") {
                          return (
                            <ShowImageTool
                              key={`${message.id}-${i}`}
                              part={part}
                            />
                          );
                        }
                        return null;
                      })}
                      {index === messages.length - 1 &&
                        isStreaming &&
                        message.parts.length === 0 && <Spinner />}
                    </>
                  ) : (
                    message.parts
                      .filter((part) => part.type === "text")
                      .map((part) => ("text" in part ? part.text : ""))
                      .join("")
                  )}
                </MessageContent>
              </Message>
            ))
          )}
          {status === "submitted" && <Spinner />}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t bg-white px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <PromptInput
            onSubmit={handleSubmit}
            className="rounded-xl border shadow-xs"
          >
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about research papers, concepts, methodology..."
              disabled={status === "streaming" || status === "submitted"}
            />
            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputSelect
                  value={selectedModel}
                  onValueChange={setSelectedModel}
                >
                  <PromptInputSelectTrigger className="w-auto gap-1 text-xs">
                    <PromptInputSelectValue />
                  </PromptInputSelectTrigger>
                  <PromptInputSelectContent>
                    {AVAILABLE_MODELS.map((model) => (
                      <PromptInputSelectItem key={model.id} value={model.id}>
                        {model.label}
                      </PromptInputSelectItem>
                    ))}
                  </PromptInputSelectContent>
                </PromptInputSelect>
              </PromptInputTools>
              <PromptInputSubmit
                status={status}
                onStop={stop}
                disabled={!input.trim() && !isStreaming}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
