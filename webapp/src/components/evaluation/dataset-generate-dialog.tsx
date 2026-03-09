"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

interface Paper {
  paper_id: string;
  title: string | null;
  status: string;
}

export function DatasetGenerateDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [numQuestions, setNumQuestions] = useState(10);
  const [selectedPapers, setSelectedPapers] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data: papers = [] } = useQuery<Paper[]>({
    queryKey: ["papers"],
    queryFn: async () => {
      const res = await apiFetch("/api/rag/papers");
      return res.json();
    },
  });

  const completedPapers = papers.filter((p) => p.status === "completed");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/rag/eval/datasets/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          paper_ids: selectedPapers,
          num_questions: numQuestions,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eval-datasets"] });
      setOpen(false);
      setName("");
      setDescription("");
      setSelectedPapers([]);
      setNumQuestions(10);
    },
  });

  function togglePaper(paperId: string) {
    setSelectedPapers((prev) =>
      prev.includes(paperId)
        ? prev.filter((id) => id !== paperId)
        : [...prev, paperId],
    );
  }

  const canSubmit = name.trim() && selectedPapers.length > 0 && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          Generate Dataset
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Q&A Dataset</DialogTitle>
          <DialogDescription>
            Auto-generate evaluation Q&A pairs from ingested papers using an LLM.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. RAG Paper Eval v1"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Questions per paper</label>
            <Input
              type="number"
              min={1}
              max={50}
              value={numQuestions}
              onChange={(e) => setNumQuestions(Number(e.target.value))}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Select papers ({selectedPapers.length} selected)
            </label>
            <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1">
              {completedPapers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2 text-center">
                  No completed papers available. Ingest papers first.
                </p>
              ) : (
                completedPapers.map((paper) => (
                  <label
                    key={paper.paper_id}
                    className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPapers.includes(paper.paper_id)}
                      onChange={() => togglePaper(paper.paper_id)}
                      className="rounded"
                    />
                    <span className="truncate">
                      {paper.title || paper.paper_id}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto shrink-0">
                      {paper.paper_id}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        {mutation.isError && (
          <p className="text-sm text-destructive">
            {(mutation.error as Error).message}
          </p>
        )}

        <DialogFooter>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit}
          >
            {mutation.isPending && (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            )}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
