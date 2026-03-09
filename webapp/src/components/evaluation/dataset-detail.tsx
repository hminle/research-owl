"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

interface EvalItem {
  item_id: number;
  dataset_id: string;
  question: string;
  ground_truth: string;
}

interface DatasetDetail {
  dataset_id: string;
  name: string;
  description: string;
  paper_ids: string[];
  num_items: number;
  items: EvalItem[];
}

interface DatasetDetailProps {
  datasetId: string;
}

export function DatasetDetail({ datasetId }: DatasetDetailProps) {
  const queryClient = useQueryClient();

  const { data: dataset, isLoading } = useQuery<DatasetDetail>({
    queryKey: ["eval-dataset", datasetId],
    queryFn: async () => {
      const res = await apiFetch(`/api/rag/eval/datasets/${datasetId}`);
      return res.json();
    },
  });

  if (isLoading || !dataset) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-medium">{dataset.name}</h3>
        {dataset.description && (
          <p className="text-sm text-muted-foreground">{dataset.description}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {dataset.items.length} Q&A items
        </p>
      </div>

      <div className="space-y-2">
        {dataset.items.map((item) => (
          <EvalItemRow
            key={item.item_id}
            item={item}
            onUpdate={() =>
              queryClient.invalidateQueries({
                queryKey: ["eval-dataset", datasetId],
              })
            }
          />
        ))}
      </div>
    </div>
  );
}

function EvalItemRow({
  item,
  onUpdate,
}: {
  item: EvalItem;
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [question, setQuestion] = useState(item.question);
  const [groundTruth, setGroundTruth] = useState(item.ground_truth);

  const updateMutation = useMutation({
    mutationFn: async () => {
      await apiFetch(`/api/rag/eval/items/${item.item_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, ground_truth: groundTruth }),
      });
    },
    onSuccess: () => {
      setEditing(false);
      onUpdate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiFetch(`/api/rag/eval/items/${item.item_id}`, {
        method: "DELETE",
      });
    },
    onSuccess: onUpdate,
  });

  if (editing) {
    return (
      <div className="rounded-lg border p-3 space-y-2 bg-accent/20">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Question</label>
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Ground Truth</label>
          <Input
            value={groundTruth}
            onChange={(e) => setGroundTruth(e.target.value)}
            className="text-sm"
          />
        </div>
        <div className="flex gap-1.5 justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={() => {
              setEditing(false);
              setQuestion(item.question);
              setGroundTruth(item.ground_truth);
            }}
          >
            <X className="h-3 w-3 mr-1" />
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
          >
            <Save className="h-3 w-3 mr-1" />
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-3 group">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">Q: {item.question}</p>
          <p className="text-sm text-muted-foreground">A: {item.ground_truth}</p>
        </div>
        <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => deleteMutation.mutate()}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
