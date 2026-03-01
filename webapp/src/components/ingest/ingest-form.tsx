"use client";

import { useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

const ARXIV_URL_RE = /arxiv\.org\/(?:abs|pdf)\/\d{4}\.\d{4,5}/;

interface IngestFormProps {
  onIngestStart: (paperId: string) => void;
  disabled?: boolean;
}

export function IngestForm({ onIngestStart, disabled }: IngestFormProps) {
  const [url, setUrl] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (arxivUrl: string) => {
      const res = await apiFetch("/api/rag/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arxiv_url: arxivUrl }),
      });
      return res.json() as Promise<{ paper_id: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["papers"] });
      onIngestStart(data.paper_id);
    },
  });

  const isValid = ARXIV_URL_RE.test(url);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || mutation.isPending || disabled) return;
    mutation.mutate(url);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <Input
          type="url"
          placeholder="https://arxiv.org/abs/2301.12345"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            mutation.reset();
          }}
          disabled={mutation.isPending || disabled}
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={!isValid || mutation.isPending || disabled}
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileUp className="h-4 w-4" />
          )}
          <span className="ml-1.5">Ingest</span>
        </Button>
      </div>
      {url && !isValid && (
        <p className="text-sm text-muted-foreground">
          Enter a valid arxiv URL (e.g. https://arxiv.org/abs/2301.12345)
        </p>
      )}
      {mutation.error && (
        <p className="text-sm text-destructive">
          {mutation.error instanceof Error
            ? mutation.error.message
            : "Submission failed"}
        </p>
      )}
    </form>
  );
}
