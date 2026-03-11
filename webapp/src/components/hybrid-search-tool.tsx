"use client";

import type { ToolUIPart } from "ai";
import {
  Tool,
  ToolContent,
  ToolHeader,
} from "@/components/ai-elements/tool";
import { FileText, Image, Network } from "lucide-react";
import type { HybridSearchResult } from "@/lib/tools/hybrid-search";

interface HybridSearchToolProps {
  part: ToolUIPart;
}

export function HybridSearchTool({ part }: HybridSearchToolProps) {
  const input = part.input as
    | { query?: string; top_k?: number }
    | undefined;
  const output = part.output as HybridSearchResult[] | undefined;
  const query = input?.query;

  return (
    <Tool defaultOpen>
      <ToolHeader
        state={part.state}
        title={query ? `Hybrid search: "${query}"` : "Searching papers..."}
        type={part.type}
        icon={<Network className="h-4 w-4" />}
      />
      {part.state === "output-available" && output && (
        <ToolContent>
          <div className="space-y-2 p-3">
            <p className="text-xs text-muted-foreground">
              Found {output.length} result
              {output.length !== 1 ? "s" : ""} across knowledge graph
            </p>
            {output.map((chunk) => (
              <div
                key={chunk.id}
                className="rounded-md border bg-muted/30 p-3 space-y-1.5"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {chunk.chunk_type === "image" ? (
                    <Image className="h-3 w-3" />
                  ) : (
                    <FileText className="h-3 w-3" />
                  )}
                  <span className="font-medium truncate">
                    {chunk.paper_title || chunk.paper_id}
                  </span>
                  <span className="ml-auto shrink-0">
                    {(chunk.rrf_score * 100).toFixed(0)}% relevance
                  </span>
                </div>
                {chunk.graph_context && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Network className="h-3 w-3 text-primary/70" />
                    <span className="text-primary/70">{chunk.graph_context}</span>
                  </div>
                )}
                {chunk.image_url && (
                  <img
                    src={chunk.image_url}
                    alt={chunk.content?.slice(0, 120) ?? "Figure"}
                    className="rounded-md border max-h-48 w-auto"
                  />
                )}
                <p className="text-sm line-clamp-3">{chunk.content}</p>
              </div>
            ))}
          </div>
        </ToolContent>
      )}
    </Tool>
  );
}
