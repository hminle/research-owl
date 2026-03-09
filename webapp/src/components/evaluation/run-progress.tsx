"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface RunProgressProps {
  runId: string;
  onComplete?: () => void;
}

interface ProgressData {
  status: string;
  completed: number;
  total: number;
  error: string | null;
}

export function RunProgress({ runId, onComplete }: RunProgressProps) {
  const [progress, setProgress] = useState<ProgressData | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/rag/eval/runs/${runId}/progress`);

    es.onmessage = (event) => {
      if (event.data === "[DONE]") {
        es.close();
        onComplete?.();
        return;
      }
      try {
        const data = JSON.parse(event.data) as ProgressData;
        setProgress(data);
        if (data.status === "completed" || data.status === "failed") {
          es.close();
          onComplete?.();
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      onComplete?.();
    };

    return () => es.close();
  }, [runId, onComplete]);

  if (!progress) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Connecting...
      </div>
    );
  }

  const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {progress.status === "completed" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : progress.status === "failed" ? (
            <XCircle className="h-4 w-4 text-destructive" />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          )}
          <span className="capitalize">{progress.status}</span>
        </div>
        <span className="text-muted-foreground tabular-nums">
          {progress.completed}/{progress.total} items
        </span>
      </div>
      <Progress value={pct} />
      {progress.error && (
        <p className="text-xs text-destructive">{progress.error}</p>
      )}
    </div>
  );
}
