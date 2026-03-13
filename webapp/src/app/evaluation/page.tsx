"use client";

import { useCallback, useState } from "react";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatasetList } from "@/components/evaluation/dataset-list";
import { DatasetDetail } from "@/components/evaluation/dataset-detail";
import { RunTrigger } from "@/components/evaluation/run-trigger";
import { RunProgress } from "@/components/evaluation/run-progress";
import { RunHistory } from "@/components/evaluation/run-history";
import { RunResultsTable } from "@/components/evaluation/run-results-table";
import { TrendsChart } from "@/components/evaluation/trends-chart";
import { useQueryClient } from "@tanstack/react-query";

type Tab = "datasets" | "runs" | "trends";

const TABS: { key: Tab; label: string }[] = [
  { key: "datasets", label: "Datasets" },
  { key: "runs", label: "Runs" },
  { key: "trends", label: "Trends" },
];

export default function EvaluationPage() {
  const [activeTab, setActiveTab] = useState<Tab>("datasets");
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>();
  const [selectedRunId, setSelectedRunId] = useState<string>();
  const [activeRunId, setActiveRunId] = useState<string>();
  const queryClient = useQueryClient();

  const handleRunComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["eval-runs"] });
    queryClient.invalidateQueries({ queryKey: ["eval-stats"] });
    if (activeRunId) {
      setSelectedRunId(activeRunId);
      setActiveRunId(undefined);
    }
  }, [activeRunId, queryClient]);

  return (
    <div className="px-6 py-4 space-y-4">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-amber-600" />
          <h1 className="text-xl font-semibold">RAG Evaluation</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Generate Q&A datasets, run evaluations, and track quality metrics
          over time.
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 rounded-lg border p-1 w-fit bg-muted/30">
        {TABS.map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? "default" : "ghost"}
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "datasets" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DatasetList
            onSelect={setSelectedDatasetId}
            selectedId={selectedDatasetId}
          />
          {selectedDatasetId ? (
            <DatasetDetail datasetId={selectedDatasetId} />
          ) : (
            <div className="flex items-center justify-center rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Select a dataset to view its Q&A items
            </div>
          )}
        </div>
      )}

      {activeTab === "runs" && (
        <div className="space-y-4">
          <RunTrigger
            onRunStarted={(runId) => {
              setActiveRunId(runId);
            }}
          />

          {activeRunId && (
            <RunProgress runId={activeRunId} onComplete={handleRunComplete} />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Run History
              </h3>
              <RunHistory
                onSelectRun={setSelectedRunId}
                selectedRunId={selectedRunId}
              />
            </div>
            <div>
              {selectedRunId ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Run Details
                  </h3>
                  <RunResultsTable runId={selectedRunId} />
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-dashed p-6 text-sm text-muted-foreground h-full">
                  Select a run to view detailed results
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "trends" && <TrendsChart />}
    </div>
  );
}
