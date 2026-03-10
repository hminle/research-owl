"use client";

import type { ToolUIPart } from "ai";
import {
  Tool,
  ToolContent,
  ToolHeader,
} from "@/components/ai-elements/tool";
import { FileText, Image } from "lucide-react";
import type { ChunkResult } from "@/lib/tools/search-chunks";

interface SearchChunksToolProps {
  part: ToolUIPart;
}

export function SearchChunksTool({ part }: SearchChunksToolProps) {
  const input = part.input as
    | { query?: string; top_k?: number; paper_id?: string }
    | undefined;
  const output = part.output as ChunkResult[] | undefined;
  const query = input?.query;

  return (
    <Tool defaultOpen>
      <ToolHeader
        state={part.state}
        title={query ? `Searching: "${query}"` : "Searching knowledge base..."}
        type={part.type}
      />
      {part.state === "output-available" && output && (
        <ToolContent>
          <div className="space-y-2 p-3">
            <p className="text-xs text-muted-foreground">
              Found {output.length} result
              {output.length !== 1 ? "s" : ""}
            </p>
            {output.map((chunk) => (
              <div
                key={chunk.id}
                className="rounded-md border bg-muted/30 p-3 space-y-1"
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
                    {(chunk.score * 100).toFixed(0)}% match
                  </span>
                </div>
                <p className="text-sm line-clamp-3">{chunk.content}</p>
              </div>
            ))}
          </div>
        </ToolContent>
      )}
    </Tool>
  );
}
