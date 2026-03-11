"use client";

import { ArchitectureFlow } from "@/components/architecture/architecture-flow";
import { Network } from "lucide-react";

export default function ArchitecturePage() {
  return (
    <div className="flex flex-col h-[calc(100vh-48px)]">
      <div className="px-6 py-3 border-b">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-violet-600" />
          <h1 className="text-xl font-semibold">Architecture</h1>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ArchitectureFlow />
      </div>
    </div>
  );
}
