"use client";

import { EmbeddingsExplorer } from "@/components/embeddings/embeddings-explorer";
import { ScatterChart } from "lucide-react";

export default function EmbeddingsPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-48px)]">
      <div className="px-6 py-3 border-b">
        <div className="flex items-center gap-2">
          <ScatterChart className="h-5 w-5 text-orange-600" />
          <h1 className="text-xl font-semibold">Embeddings Explorer</h1>
        </div>
      </div>
      <div className="flex-1 min-h-0 p-6 overflow-y-auto">
        <EmbeddingsExplorer />
      </div>
    </div>
  );
}
