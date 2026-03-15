"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { OrchestratorUIMessage } from "@/lib/agents/orchestrator-agent";
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
import { SubagentTool } from "@/components/research/subagent-tool";
import { Microscope, Sparkles } from "lucide-react";

const SUGGESTIONS = [
  {
    label: "Diffusion models for white balance",
    prompt:
      "Research diffusion models applied to white balance correction.",
  },
  {
    label: "Vision-language models for white balance",
    prompt:
      "I want to research vision-language models (VLMs). How to apply it to white balance or ISP processing?",
  },
  {
    label: "Neural radiance fields for white balance",
    prompt:
      "Plan a research project on neural radiance fields (NeRF) for white balance or ISP processing. Review existing literature and propose experiments.",
  },
];

const _transportBody = { modelId: DEFAULT_MODEL as string };

export default function ResearchPage() {
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);

  useEffect(() => {
    _transportBody.modelId = selectedModel;
  }, [selectedModel]);

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/research",
        body: () => ({ modelId: _transportBody.modelId }),
      })
  );

  const { messages, sendMessage, status, stop } =
    useChat<OrchestratorUIMessage>({ transport });

  const isStreaming = status === "streaming";

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
      <div className="flex items-center gap-2 px-4 py-1.5 border-b">
        <Microscope className="h-4 w-4 text-amber-600" />
        <span className="text-sm font-medium">Deep Research</span>
        <span className="text-xs text-muted-foreground">
          Multi-agent research pipeline
        </span>
      </div>

      <Conversation className="flex-1">
        <ConversationContent className="max-w-4xl mx-auto w-full">
          {messages.length === 0 ? (
            <ConversationEmptyState>
              <div className="max-w-lg space-y-4">
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
                  <h3 className="font-medium text-sm">Deep Research Mode</h3>
                  <p className="text-muted-foreground text-sm">
                    Describe a research topic and I&apos;ll coordinate multiple
                    agents to review literature, search arXiv, plan experiments,
                    and produce a comprehensive research report.
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
                      {message.parts.filter((p) => p.type === "reasoning")
                        .length > 0 && (
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
                        if (
                          part.type === "tool-review_kb" ||
                          part.type === "tool-scout_web" ||
                          part.type === "tool-plan_research" ||
                          part.type === "tool-synthesize"
                        ) {
                          return (
                            <SubagentTool
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
        <div className="max-w-4xl mx-auto">
          <PromptInput
            onSubmit={handleSubmit}
            className="rounded-xl border shadow-xs"
          >
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe a research topic to investigate..."
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
