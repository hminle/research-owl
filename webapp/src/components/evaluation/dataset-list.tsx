"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { DatasetGenerateDialog } from "./dataset-generate-dialog";

interface EvalDataset {
  dataset_id: string;
  name: string;
  description: string;
  paper_ids: string[];
  num_items: number;
  created_at: string | null;
}

interface DatasetListProps {
  onSelect: (datasetId: string) => void;
  selectedId?: string;
}

export function DatasetList({ onSelect, selectedId }: DatasetListProps) {
  const queryClient = useQueryClient();

  const { data: datasets = [], isLoading } = useQuery<EvalDataset[]>({
    queryKey: ["eval-datasets"],
    queryFn: async () => {
      const res = await apiFetch("/api/rag/eval/datasets");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (datasetId: string) => {
      await apiFetch(`/api/rag/eval/datasets/${datasetId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eval-datasets"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          {datasets.length} dataset{datasets.length !== 1 ? "s" : ""}
        </h2>
        <DatasetGenerateDialog />
      </div>

      {datasets.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <Database className="mx-auto h-6 w-6 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            No datasets yet. Generate one from your ingested papers.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {datasets.map((ds) => (
            <button
              key={ds.dataset_id}
              onClick={() => onSelect(ds.dataset_id)}
              className={`w-full text-left rounded-lg border p-3 transition-colors hover:bg-accent/50 ${
                selectedId === ds.dataset_id
                  ? "border-primary bg-accent/30"
                  : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{ds.name}</p>
                  {ds.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {ds.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      {ds.num_items} items
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {ds.paper_ids.length} paper{ds.paper_ids.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMutation.mutate(ds.dataset_id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
