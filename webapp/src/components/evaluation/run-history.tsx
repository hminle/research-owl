"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { MetricBadge } from "./metric-badge";
import { apiFetch } from "@/lib/api";

interface EvalRun {
  run_id: string;
  dataset_id: string;
  status: string;
  factual_correctness: number | null;
  context_relevance: number | null;
  num_items: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string | null;
}

interface EvalDataset {
  dataset_id: string;
  name: string;
}

interface RunHistoryProps {
  onSelectRun?: (runId: string) => void;
  selectedRunId?: string;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  running: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
  pending: <Clock className="h-4 w-4 text-muted-foreground" />,
  failed: <XCircle className="h-4 w-4 text-destructive" />,
};

export function RunHistory({ onSelectRun, selectedRunId }: RunHistoryProps) {
  const { data: runs = [], isLoading } = useQuery<EvalRun[]>({
    queryKey: ["eval-runs"],
    queryFn: async () => {
      const res = await apiFetch("/api/rag/eval/runs");
      return res.json();
    },
    refetchInterval: (query) => {
      const data = query.state.data as EvalRun[] | undefined;
      if (!data) return false;
      const hasActive = data.some(
        (r) => r.status === "running" || r.status === "pending",
      );
      return hasActive ? 5000 : false;
    },
  });

  const { data: datasets = [] } = useQuery<EvalDataset[]>({
    queryKey: ["eval-datasets"],
    queryFn: async () => {
      const res = await apiFetch("/api/rag/eval/datasets");
      return res.json();
    },
  });

  const datasetMap = Object.fromEntries(
    datasets.map((d) => [d.dataset_id, d.name]),
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <AlertCircle className="mx-auto h-6 w-6 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">
          No evaluation runs yet. Select a dataset and start a run above.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {runs.map((run) => (
        <button
          key={run.run_id}
          onClick={() => onSelectRun?.(run.run_id)}
          className={`w-full text-left rounded-lg border p-3 transition-colors hover:bg-accent/50 ${
            selectedRunId === run.run_id
              ? "border-primary bg-accent/30"
              : ""
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2">
              {STATUS_ICONS[run.status] ?? STATUS_ICONS.pending}
              <span className="text-sm font-medium">
                {datasetMap[run.dataset_id] || run.dataset_id}
              </span>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {run.num_items} items
            </span>
          </div>

          {run.status === "completed" && (
            <div className="flex flex-wrap gap-1.5">
              <MetricBadge label="Factual" value={run.factual_correctness} />
              <MetricBadge label="Context" value={run.context_relevance} />
            </div>
          )}

          {run.status === "failed" && run.error_message && (
            <p className="text-xs text-destructive truncate">
              {run.error_message}
            </p>
          )}

          {run.completed_at && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {new Date(run.completed_at).toLocaleString()}
            </p>
          )}
        </button>
      ))}
    </div>
  );
}
