"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMemo, useState } from "react";
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
import { Sparkles, BookOpen } from "lucide-react";

const SUGGESTIONS = [
  {
    label: "Explain transformers",
    prompt: "Explain the transformer architecture and self-attention mechanism in simple terms",
  },
  {
    label: "RAG overview",
    prompt: "What is Retrieval-Augmented Generation (RAG) and how does it improve LLM outputs?",
  },
  {
    label: "Research methodology",
    prompt: "What are the key steps in designing a good research methodology for a CS paper?",
  },
  {
    label: "Literature review tips",
    prompt: "How do I conduct an effective literature review for my research topic?",
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
  const _syncModel = useMemo(() => {
    _transportBody.modelId = selectedModel;
  }, [selectedModel]);

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ modelId: _transportBody.modelId }),
      })
  );

  const { messages, sendMessage, status, stop } = useChat({
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
    <div className="flex flex-col h-screen">
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-amber-600" />
            <div>
              <h1 className="text-xl font-semibold">Research Owl</h1>
              <p className="text-sm text-gray-500">
                AI-powered research assistant
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1.5" title="Session token usage">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5"
                />
              </svg>
              <span>{formatTokenCount(sessionTokenUsage.totalTokens)} tokens</span>
              {sessionTokenUsage.totalTokens > 0 && (
                <span className="text-gray-400">
                  ({formatTokenCount(sessionTokenUsage.inputTokens)} in /{" "}
                  {formatTokenCount(sessionTokenUsage.outputTokens)} out)
                </span>
              )}
            </div>
            <div className="h-3 w-px bg-gray-200" />
            <span>{messageCount} messages</span>
          </div>
        </div>
      </div>

      <Conversation className="flex-1">
        <ConversationContent className="max-w-3xl mx-auto w-full">
          {messages.length === 0 ? (
            <ConversationEmptyState>
              <div className="max-w-md space-y-4">
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
                      <MessageResponse>
                        {message.parts
                          .filter((part) => part.type === "text")
                          .map((part) => ("text" in part ? part.text : ""))
                          .join("")}
                      </MessageResponse>
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
