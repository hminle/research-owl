"use client";

import { PresentationFlow } from "@/components/presentation/presentation-flow";
import { Presentation } from "lucide-react";

export default function PresentationPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-48px)]">
      <div className="px-6 py-3 border-b">
        <div className="flex items-center gap-2">
          <Presentation className="h-5 w-5 text-violet-600" />
          <h1 className="text-xl font-semibold">System Overview</h1>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <PresentationFlow />
      </div>
    </div>
  );
}
