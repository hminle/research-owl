"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";

interface EvalDataset {
  dataset_id: string;
  name: string;
  num_items: number;
}

interface RunTriggerProps {
  onRunStarted?: (runId: string) => void;
}

export function RunTrigger({ onRunStarted }: RunTriggerProps) {
  const [datasetId, setDatasetId] = useState("");
  const queryClient = useQueryClient();

  const { data: datasets = [] } = useQuery<EvalDataset[]>({
    queryKey: ["eval-datasets"],
    queryFn: async () => {
      const res = await apiFetch("/api/rag/eval/datasets");
      return res.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/rag/eval/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset_id: datasetId }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["eval-runs"] });
      onRunStarted?.(data.run_id);
    },
  });

  const selectedDs = datasets.find((d) => d.dataset_id === datasetId);
  const canRun = datasetId && selectedDs && selectedDs.num_items > 0 && !mutation.isPending;

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <h3 className="text-sm font-medium">Start Evaluation Run</h3>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1 flex-1 min-w-[180px]">
          <label className="text-xs text-muted-foreground">Dataset</label>
          <Select value={datasetId} onValueChange={setDatasetId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select dataset..." />
            </SelectTrigger>
            <SelectContent>
              {datasets.map((ds) => (
                <SelectItem key={ds.dataset_id} value={ds.dataset_id}>
                  {ds.name} ({ds.num_items} items)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end">
          <Button onClick={() => mutation.mutate()} disabled={!canRun}>
            {mutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 mr-1.5" />
            )}
            Run
          </Button>
        </div>
      </div>

      {mutation.isError && (
        <p className="text-sm text-destructive">
          {(mutation.error as Error).message}
        </p>
      )}
    </div>
  );
}
