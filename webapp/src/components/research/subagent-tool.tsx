"use client";

import { useState } from "react";
import {
  BookOpen,
  ChevronDown,
  Globe,
  FlaskConical,
  FileText,
  CheckCircle2,
  Loader2,
  Circle,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MessageResponse } from "@/components/ai-elements/message";
import { ListPapersTool } from "@/components/list-papers-tool";
import { HybridSearchTool } from "@/components/hybrid-search-tool";
import { ShowImageTool } from "@/components/show-image-tool";
import { cn } from "@/lib/utils";

const AGENT_META: Record<
  string,
  { label: string; icon: typeof BookOpen; color: string }
> = {
  "tool-review_kb": {
    label: "KB Review Agent",
    icon: BookOpen,
    color: "text-blue-600",
  },
  "tool-scout_web": {
    label: "Web Scout Agent",
    icon: Globe,
    color: "text-green-600",
  },
  "tool-plan_research": {
    label: "Research Planner",
    icon: FlaskConical,
    color: "text-purple-600",
  },
  "tool-synthesize": {
    label: "Synthesis Agent",
    icon: FileText,
    color: "text-amber-600",
  },
};

type ToolState =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error"
  | "approval-requested"
  | "approval-responded"
  | "output-denied";

function StatusIndicator({ state }: { state: ToolState }) {
  switch (state) {
    case "output-available":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "output-error":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "input-available":
      return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground/40" />;
  }
}

function StatusLabel({ state, preliminary }: { state: ToolState; preliminary?: boolean }) {
  if (state === "output-available" && preliminary) return "Streaming...";
  if (state === "output-available") return "Completed";
  if (state === "output-error") return "Error";
  if (state === "input-available") return "Running";
  return "Pending";
}

interface SubagentToolProps {
  part: {
    type: string;
    state: ToolState;
    input?: { task?: string };
    output?: {
      parts?: Array<{
        type: string;
        text?: string;
        [key: string]: unknown;
      }>;
    };
    preliminary?: boolean;
    errorText?: string;
  };
}

export function SubagentTool({ part }: SubagentToolProps) {
  const meta = AGENT_META[part.type] ?? {
    label: part.type,
    icon: Circle,
    color: "text-muted-foreground",
  };
  const Icon = meta.icon;

  const isComplete = part.state === "output-available" && !part.preliminary;
  const isStreaming =
    part.state === "output-available" && part.preliminary === true;
  const isRunning = part.state === "input-available";

  const [expanded, setExpanded] = useState(true);

  const hasOutput = part.state === "output-available" && part.output;

  return (
    <div className="w-full rounded-lg border bg-card">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-accent/50 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-2.5">
          <Icon className={cn("h-4 w-4", meta.color)} />
          <span className="text-sm font-medium">{meta.label}</span>
          <Badge
            variant="secondary"
            className="gap-1 text-[10px] px-1.5 py-0"
          >
            <StatusIndicator state={part.state} />
            <StatusLabel state={part.state} preliminary={part.preliminary} />
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {part.input?.task && (
            <span className="text-xs text-muted-foreground max-w-[300px] truncate hidden sm:inline">
              {part.input.task}
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              expanded && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="border-t">
          {/* Task description */}
          {part.input?.task && (
            <div className="px-3 py-2 bg-muted/30 text-xs text-muted-foreground border-b">
              <span className="font-medium">Task:</span> {part.input.task}
            </div>
          )}

          {/* Subagent output — render nested parts */}
          {hasOutput && part.output?.parts && (
            <div className="p-3 space-y-3 max-h-[500px] overflow-y-auto">
              {part.output.parts.map((nestedPart, i) => {
                if (nestedPart.type === "text" && nestedPart.text) {
                  return (
                    <MessageResponse key={i}>{nestedPart.text}</MessageResponse>
                  );
                }
                // Render nested tool calls from subagents
                if (
                  nestedPart.type === "tool-list_papers" &&
                  "state" in nestedPart
                ) {
                  return (
                    <ListPapersTool
                      key={i}
                      part={nestedPart as never}
                    />
                  );
                }
                if (
                  nestedPart.type === "tool-hybrid_search" &&
                  "state" in nestedPart
                ) {
                  return (
                    <HybridSearchTool
                      key={i}
                      part={nestedPart as never}
                    />
                  );
                }
                if (
                  nestedPart.type === "tool-show_image" &&
                  "state" in nestedPart
                ) {
                  return (
                    <ShowImageTool
                      key={i}
                      part={nestedPart as never}
                    />
                  );
                }
                // Generic tool calls from subagents (search_arxiv, ingest_paper)
                if (
                  nestedPart.type?.startsWith("tool-") &&
                  "state" in nestedPart
                ) {
                  const toolName = nestedPart.type.replace("tool-", "");
                  const toolState = (nestedPart as unknown as { state: string }).state;
                  return (
                    <div
                      key={i}
                      className="rounded-md border bg-muted/30 p-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {toolName}
                        </Badge>
                        <span className="text-muted-foreground">
                          {toolState === "output-available"
                            ? "completed"
                            : toolState === "input-available"
                              ? "running..."
                              : toolState}
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              })}
              {(isStreaming || isRunning) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {isStreaming
                    ? "Agent is working..."
                    : "Waiting for agent to start..."}
                </div>
              )}
            </div>
          )}

          {/* Loading state when no output yet */}
          {!hasOutput && (isRunning || part.state === "input-streaming") && (
            <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Delegating task to {meta.label}...
            </div>
          )}

          {/* Error state */}
          {part.errorText && (
            <div className="p-3 text-xs text-destructive bg-destructive/10">
              {part.errorText}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
