"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  FileText,
  Brain,
  Quote,
  Images,
  Circle,
  CircleHelp,
} from "lucide-react";
import { apiProgressUrl } from "@/lib/api";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type StepStatus = "pending" | "in_progress" | "completed" | "failed";

interface StepState {
  status: StepStatus;
  started_at: number | null;
  completed_at: number | null;
  error: string | null;
}

type ProgressSnapshot = Record<string, StepState>;

const STEPS = [
  {
    key: "download",
    label: "Download",
    icon: Download,
    helpText:
      "Downloads the paper PDF from arXiv and stores it locally for the next stages.",
  },
  {
    key: "extract_text",
    label: "Extract Text",
    icon: FileText,
    helpText:
      "Runs Docling to extract title and full text from the PDF for downstream parsing.",
  },
  {
    key: "process_multimodal",
    label: "Multimodal",
    icon: Brain,
    helpText:
      "Uses RAGAnything + LightRAG to parse figures/tables/equations and index multimodal content into the knowledge graph.",
  },
  {
    key: "parse_citations",
    label: "Citations",
    icon: Quote,
    helpText:
      "Parses cited arXiv papers from extracted text and adds citation relationships into the graph.",
  },
  {
    key: "collect_images",
    label: "Images",
    icon: Images,
    helpText:
      "Scans parser output for extracted images and saves image metadata for the paper view.",
  },
] as const;

function StatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    case "failed":
      return <XCircle className="h-5 w-5 text-red-500" />;
    case "in_progress":
      return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
    default:
      return <Circle className="h-5 w-5 text-muted-foreground/40" />;
  }
}

function ElapsedTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Date.now() / 1000 - startedAt);
    }, 100);
    return () => clearInterval(id);
  }, [startedAt]);

  return (
    <span className="text-xs tabular-nums text-blue-600 font-medium">
      {elapsed.toFixed(1)}s
    </span>
  );
}

function Duration({ startedAt, completedAt }: { startedAt: number; completedAt: number }) {
  const dur = completedAt - startedAt;
  return (
    <span className="text-xs tabular-nums text-muted-foreground">
      {dur.toFixed(1)}s
    </span>
  );
}

function stepCardClasses(status: StepStatus): string {
  const base =
    "relative flex w-full max-w-[170px] flex-col items-center justify-between rounded-lg border-2 p-4 min-h-[132px] transition-all duration-300";
  switch (status) {
    case "completed":
      return `${base} border-green-300 bg-green-50`;
    case "in_progress":
      return `${base} border-blue-400 bg-blue-50 shadow-md`;
    case "failed":
      return `${base} border-red-300 bg-red-50`;
    default:
      return `${base} border-muted bg-muted/30`;
  }
}

function connectorClasses(sourceStatus: StepStatus): string {
  const base = "h-0.5 flex-1 min-w-4 transition-all duration-300 rounded-full";
  if (sourceStatus === "completed") return `${base} bg-green-400`;
  if (sourceStatus === "in_progress") return `${base} bg-blue-300 animate-pulse`;
  return `${base} bg-muted`;
}

interface PipelineStepperProps {
  paperId: string;
}

export function PipelineStepper({ paperId }: PipelineStepperProps) {
  const [progress, setProgress] = useState<ProgressSnapshot | null>(null);
  const [done, setDone] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(apiProgressUrl(paperId));
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      if (event.data === "[DONE]") {
        setDone(true);
        es.close();
        return;
      }
      try {
        const snapshot: ProgressSnapshot = JSON.parse(event.data);
        setProgress(snapshot);
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      setDone(true);
    };

    return () => {
      es.close();
    };
  }, [paperId]);

  if (!progress) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Connecting to pipeline...
        </span>
      </div>
    );
  }

  const allCompleted = STEPS.every(
    (s) => progress[s.key]?.status === "completed",
  );
  const hasFailed = STEPS.some((s) => progress[s.key]?.status === "failed");

  return (
    <div className="space-y-4">
      {/* Horizontal stepper — stacks vertically on mobile */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-0">
        {STEPS.map((step, i) => {
          const state = progress[step.key] ?? {
            status: "pending" as StepStatus,
            started_at: null,
            completed_at: null,
            error: null,
          };
          const Icon = step.icon;

          return (
            <div
              key={step.key}
              className="flex flex-col sm:flex-row items-center flex-1"
            >
              <div className={stepCardClasses(state.status)}>
                <div className="flex items-center gap-1.5">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium">{step.label}</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Explain ${step.label} step`}
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <CircleHelp className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      sideOffset={6}
                      className="max-w-64 text-left leading-relaxed"
                    >
                      {step.helpText}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <StatusIcon status={state.status} />
                <div className="h-5 flex items-center justify-center">
                  {state.status === "in_progress" && state.started_at && (
                    <ElapsedTimer startedAt={state.started_at} />
                  )}
                  {state.status === "completed" &&
                    state.started_at &&
                    state.completed_at && (
                      <Duration
                        startedAt={state.started_at}
                        completedAt={state.completed_at}
                      />
                    )}
                  {state.status === "failed" && state.error && (
                    <p className="text-xs text-red-600 text-center max-w-[140px] truncate">
                      {state.error}
                    </p>
                  )}
                </div>
              </div>
              {/* Connector */}
              {i < STEPS.length - 1 && (
                <>
                  {/* Horizontal connector (hidden on mobile) */}
                  <div className="hidden sm:block w-6">
                    <div className={connectorClasses(state.status)} />
                  </div>
                  {/* Vertical connector (visible on mobile) */}
                  <div className="sm:hidden flex justify-center">
                    <div
                      className={`w-0.5 h-4 transition-all duration-300 rounded-full ${
                        state.status === "completed"
                          ? "bg-green-400"
                          : state.status === "in_progress"
                            ? "bg-blue-300 animate-pulse"
                            : "bg-muted"
                      }`}
                    />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Status summary */}
      {done && (
        <div className="text-center text-sm">
          {allCompleted && (
            <p className="text-green-600 font-medium">
              Pipeline completed successfully!
            </p>
          )}
          {hasFailed && (
            <p className="text-red-600 font-medium">
              Pipeline failed. Check errors above.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
