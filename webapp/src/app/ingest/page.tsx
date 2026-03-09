"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileUp, RotateCcw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { IngestForm } from "@/components/ingest/ingest-form";
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
  const paperIdFromQuery = searchParams.get("paperId");
  const paperId = paperIdFromQuery;

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

  const currentPaper = useMemo(
    () => papers.find((p) => p.paper_id === paperId) ?? null,
    [papers, paperId],
  );

  const pipelineActive =
    !!paperId &&
    (currentPaper === null ||
      currentPaper.status === "processing" ||
      currentPaper.status === "pending");

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
          Paste an arxiv URL to download, parse, and index a paper into the
          vector store.
        </p>
      </div>

      <div className="max-w-2xl">
        <IngestForm
          onIngestStart={handleIngestStart}
          disabled={pipelineActive}
        />
      </div>

      {paperId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Paper ID: <code className="font-mono text-foreground">{paperId}</code>
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
