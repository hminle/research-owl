"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileUp, RotateCcw, Search, Link } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IngestForm } from "@/components/ingest/ingest-form";
import { ArxivSearch } from "@/components/ingest/arxiv-search";
import { PipelineStepper } from "@/components/ingest/pipeline-stepper";
import { apiFetch } from "@/lib/api";

interface Paper {
  paper_id: string;
  status: string;
}

async function fetchPapers(): Promise<Paper[]> {
  const res = await apiFetch("/api/rag/papers");
  return res.json();
}

export default function IngestPage() {
  return (
    <Suspense>
      <IngestPageContent />
    </Suspense>
  );
}

function IngestPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const paperIdFromQuery = searchParams.get("paperId");
  const paperId = paperIdFromQuery;

  // Track papers being ingested from search results (by arxiv_id)
  const [ingestingIds, setIngestingIds] = useState<Set<string>>(new Set());

  const { data: papers = [] } = useQuery({
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

  // Set of paper IDs already ingested (completed or processing)
  const ingestedIds = useMemo(
    () => new Set(papers.map((p) => p.paper_id)),
    [papers],
  );

  const currentPaper = useMemo(
    () => papers.find((p) => p.paper_id === paperId) ?? null,
    [papers, paperId],
  );

  const pipelineActive =
    !!paperId &&
    (currentPaper === null ||
      currentPaper.status === "processing" ||
      currentPaper.status === "pending");

  const ingestMutation = useMutation({
    mutationFn: async ({ arxivUrl, title }: { arxivUrl: string; title?: string }) => {
      const res = await apiFetch("/api/rag/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arxiv_url: arxivUrl, title }),
      });
      return res.json() as Promise<{ paper_id: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["papers"] });
      setIngestingIds((prev) => {
        const next = new Set(prev);
        next.delete(data.paper_id);
        return next;
      });
    },
    onError: (_err, { arxivUrl }) => {
      // Extract ID from URL to clear ingesting state
      const match = arxivUrl.match(/(\d{4}\.\d{4,5})/);
      if (match) {
        setIngestingIds((prev) => {
          const next = new Set(prev);
          next.delete(match[1]);
          return next;
        });
      }
    },
  });

  const handleSearchIngest = useCallback(
    (arxivUrl: string, title?: string) => {
      const match = arxivUrl.match(/(\d{4}\.\d{4,5})/);
      if (match) {
        setIngestingIds((prev) => new Set(prev).add(match[1]));
      }
      ingestMutation.mutate({ arxivUrl, title });
    },
    [ingestMutation],
  );

  function handleIngestStart(id: string) {
    router.replace(`/ingest?paperId=${encodeURIComponent(id)}`);
  }

  function handleReset() {
    router.replace("/ingest");
  }

  return (
    <div className="px-6 py-4 space-y-4">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <FileUp className="h-5 w-5 text-amber-600" />
          <h1 className="text-xl font-semibold">Ingest Paper</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Search arXiv for papers or paste a URL to download, parse, and index
          into the vector store.
        </p>
      </div>

      <div className="max-w-2xl">
        <Tabs defaultValue="search">
          <TabsList>
            <TabsTrigger value="search">
              <Search className="h-3.5 w-3.5" />
              Search arXiv
            </TabsTrigger>
            <TabsTrigger value="url">
              <Link className="h-3.5 w-3.5" />
              Paste URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="pt-4">
            <ArxivSearch
              onIngest={handleSearchIngest}
              ingestingIds={ingestingIds}
              ingestedIds={ingestedIds}
              disabled={pipelineActive}
            />
          </TabsContent>

          <TabsContent value="url" className="pt-4">
            <IngestForm
              onIngestStart={handleIngestStart}
              disabled={pipelineActive}
            />
          </TabsContent>
        </Tabs>
      </div>

      {paperId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Paper ID:{" "}
              <code className="font-mono text-foreground">{paperId}</code>
            </p>
          </div>
          <PipelineStepper paperId={paperId} />
          <div className="flex justify-center pt-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Ingest Another
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
