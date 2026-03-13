"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { MetricBadge } from "./metric-badge";
import { apiFetch } from "@/lib/api";

interface EvalItemResult {
  item_id: number;
  question: string;
  ground_truth: string;
  answer: string;
  contexts: string[];
  factual_correctness: number | null;
  factual_correctness_reason: string | null;
  context_relevance: number | null;
  context_relevance_reason: string | null;
}

interface RunDetail {
  run_id: string;
  dataset_id: string;
  status: string;
  factual_correctness: number | null;
  context_relevance: number | null;
  num_items: number;
  error_message: string | null;
  item_results: EvalItemResult[];
  started_at: string | null;
  completed_at: string | null;
}

interface RunResultsTableProps {
  runId: string;
}

export function RunResultsTable({ runId }: RunResultsTableProps) {
  const { data: run, isLoading } = useQuery<RunDetail>({
    queryKey: ["eval-run", runId],
    queryFn: async () => {
      const res = await apiFetch(`/api/rag/eval/runs/${runId}`);
      return res.json();
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 5000;
      return data.status === "running" || data.status === "pending" ? 5000 : false;
    },
  });

  if (isLoading || !run) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Aggregate scores */}
      <div className="flex flex-wrap gap-1.5">
        <MetricBadge label="Factual Correctness" value={run.factual_correctness} />
        <MetricBadge label="Context Relevance" value={run.context_relevance} />
      </div>

      {run.error_message && (
        <p className="text-sm text-destructive">{run.error_message}</p>
      )}

      {/* Per-item results */}
      {run.item_results.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            Per-item Results ({run.item_results.length})
          </h4>
          <div className="space-y-2">
            {run.item_results.map((ir) => {
              const passed = ir.factual_correctness != null && ir.factual_correctness >= 0.7;
              return (
                <div key={ir.item_id} className="rounded-lg border p-3 space-y-2">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Q: {ir.question}</p>
                    <p className="text-xs text-muted-foreground">
                      Expected: {ir.ground_truth}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      Answer: {ir.answer || "(empty)"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {ir.factual_correctness != null ? (
                      passed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Pass
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-2 py-0.5 text-xs font-medium text-red-800 dark:text-red-400">
                          <XCircle className="h-3 w-3" />
                          Fail
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground">N/A</span>
                    )}
                    <MetricBadge label="Factual" value={ir.factual_correctness} />
                    <MetricBadge label="Context" value={ir.context_relevance} />
                  </div>
                  {ir.factual_correctness_reason && (
                    <p className="text-xs text-muted-foreground">
                      {ir.factual_correctness_reason}
                    </p>
                  )}
                  {ir.context_relevance_reason && (
                    <p className="text-xs text-muted-foreground">
                      Context: {ir.context_relevance_reason}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
