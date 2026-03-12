"use client";

import { GraphExplorer } from "@/components/graph/graph-explorer";
import { GitFork } from "lucide-react";

export default function GraphPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-48px)]">
      <div className="px-6 py-3 border-b">
        <div className="flex items-center gap-2">
          <GitFork className="h-5 w-5 text-emerald-600" />
          <h1 className="text-xl font-semibold">Graph Explorer</h1>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <GraphExplorer />
      </div>
    </div>
  );
}
