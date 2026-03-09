"use client";

import Link from "next/link";
import { Library } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface Paper {
  paper_id: string;
  arxiv_url: string;
  title: string | null;
  status: string;
  num_chunks: number;
  num_images: number;
  error_message: string | null;
  created_at: string;
}

async function fetchPapers(): Promise<Paper[]> {
  const res = await apiFetch("/api/rag/papers");
  return res.json();
}

export default function PapersPage() {
  const { data: papers = [], error, isLoading } = useQuery({
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
            <Link
              key={paper.paper_id}
              href={
                paper.status === "processing" || paper.status === "pending"
                  ? `/ingest?paperId=${encodeURIComponent(paper.paper_id)}`
                  : "#"
              }
              aria-disabled={
                paper.status !== "processing" && paper.status !== "pending"
              }
              className={`block rounded-lg border p-4 space-y-1 transition-colors ${
                paper.status === "processing" || paper.status === "pending"
                  ? "cursor-pointer hover:bg-muted/40"
                  : "cursor-default"
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-sm">
                  {paper.title ?? paper.paper_id}
                </h2>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    paper.status === "completed"
                      ? "bg-green-100 text-green-700"
                      : paper.status === "processing"
                        ? "bg-blue-100 text-blue-700"
                        : paper.status === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {paper.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {paper.paper_id}
              </p>
              {paper.status === "completed" && (
                <p className="text-xs text-muted-foreground">
                  {paper.num_images} images
                </p>
              )}
              {(paper.status === "processing" || paper.status === "pending") && (
                <p className="text-xs text-muted-foreground">
                  Click to resume live pipeline view
                </p>
              )}
              {paper.error_message && (
                <p className="text-xs text-destructive">{paper.error_message}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
