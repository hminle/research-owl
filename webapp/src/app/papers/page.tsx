"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, FileText, Image, Library, Layers } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface Paper {
  paper_id: string;
  arxiv_url: string;
  title: string | null;
  status: string;
  num_chunks: number;
  num_images: number;
  error_message: string | null;
  created_at: string;
  updated_at?: string | null;
}

async function fetchPapers(): Promise<Paper[]> {
  const res = await apiFetch("/api/rag/papers");
  return res.json();
}

function StatusBadge({ status }: { status: string }) {
  const colorClass =
    status === "completed"
      ? "bg-green-100 text-green-700"
      : status === "processing"
        ? "bg-blue-100 text-blue-700"
        : status === "failed"
          ? "bg-red-100 text-red-700"
          : "bg-gray-100 text-gray-700";

  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}
    >
      {status}
    </span>
  );
}

export default function PapersPage() {
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);

  const {
    data: papers = [],
    error,
    isLoading,
  } = useQuery({
    queryKey: ["papers"],
    queryFn: fetchPapers,
    refetchInterval: (query) => {
      const data = query.state.data as Paper[] | undefined;
      if (!data) return false;
      const hasActive = data.some(
        (p) => p.status === "processing" || p.status === "pending",
      );
      return hasActive ? 5000 : false;
    },
  });

  return (
    <div className="px-6 py-4 space-y-4">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <Library className="h-5 w-5 text-amber-600" />
          <h1 className="text-xl font-semibold">Papers</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          All ingested papers in the vector store.
        </p>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading papers...</p>
      )}

      {error && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load papers"}
        </p>
      )}

      {!isLoading && papers.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">
          No papers ingested yet. Go to Ingest Paper to add one.
        </p>
      )}

      {papers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {papers.map((paper) => (
            <button
              key={paper.paper_id}
              type="button"
              onClick={() => setSelectedPaper(paper)}
              className="block w-full text-left rounded-lg border p-4 space-y-1 transition-colors cursor-pointer hover:bg-muted/40"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-sm line-clamp-2">
                  {paper.title ?? paper.paper_id}
                </h2>
                <StatusBadge status={paper.status} />
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {paper.paper_id}
              </p>
              {(paper.status === "processing" ||
                paper.status === "pending") && (
                <p className="text-xs text-muted-foreground">
                  Click to view details
                </p>
              )}
              {paper.error_message && (
                <p className="text-xs text-destructive line-clamp-1">
                  {paper.error_message}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      <Dialog
        open={selectedPaper !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedPaper(null);
        }}
      >
        {selectedPaper && (
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="leading-snug">
                {selectedPaper.title ?? selectedPaper.paper_id}
              </DialogTitle>
              <DialogDescription asChild>
                <span className="font-mono text-xs">
                  {selectedPaper.paper_id}
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border p-3 text-center space-y-1">
                <Layers className="h-4 w-4 mx-auto text-muted-foreground" />
                <p className="text-lg font-semibold">
                  {selectedPaper.num_chunks}
                </p>
                <p className="text-xs text-muted-foreground">Chunks</p>
              </div>
              <div className="rounded-md border p-3 text-center space-y-1">
                <Image className="h-4 w-4 mx-auto text-muted-foreground" />
                <p className="text-lg font-semibold">
                  {selectedPaper.num_images}
                </p>
                <p className="text-xs text-muted-foreground">Images</p>
              </div>
              <div className="rounded-md border p-3 text-center space-y-1">
                <FileText className="h-4 w-4 mx-auto text-muted-foreground" />
                <StatusBadge status={selectedPaper.status} />
                <p className="text-xs text-muted-foreground">Status</p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ArXiv URL</span>
                <a
                  href={selectedPaper.arxiv_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  {selectedPaper.paper_id}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {selectedPaper.created_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ingested at</span>
                  <span>
                    {new Date(selectedPaper.created_at).toLocaleString()}
                  </span>
                </div>
              )}
              {selectedPaper.updated_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated at</span>
                  <span>
                    {new Date(selectedPaper.updated_at).toLocaleString()}
                  </span>
                </div>
              )}
              {selectedPaper.error_message && (
                <div className="rounded-md bg-destructive/10 p-2">
                  <p className="text-xs text-destructive">
                    {selectedPaper.error_message}
                  </p>
                </div>
              )}
            </div>

            {(selectedPaper.status === "processing" ||
              selectedPaper.status === "pending") && (
              <DialogFooter>
                <Link
                  href={`/ingest?paperId=${encodeURIComponent(selectedPaper.paper_id)}`}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  View live pipeline
                </Link>
              </DialogFooter>
            )}
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
