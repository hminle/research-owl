"use client";

import type { ToolUIPart } from "ai";
import {
  Tool,
  ToolContent,
  ToolHeader,
} from "@/components/ai-elements/tool";
import { BookOpen } from "lucide-react";

interface PaperInfo {
  paper_id: string;
  title: string;
  arxiv_url: string;
  num_chunks: number;
}

interface ListPapersToolProps {
  part: ToolUIPart;
}

export function ListPapersTool({ part }: ListPapersToolProps) {
  const output = part.output as PaperInfo[] | undefined;

  return (
    <Tool>
      <ToolHeader
        state={part.state}
        title="Listing papers in knowledge base"
        type={part.type}
      />
      {part.state === "output-available" && output && (
        <ToolContent>
          <div className="space-y-1.5 p-3">
            <p className="text-xs text-muted-foreground">
              {output.length} paper{output.length !== 1 ? "s" : ""} available
            </p>
            {output.map((paper) => (
              <div
                key={paper.paper_id}
                className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs"
              >
                <BookOpen className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="font-medium truncate">{paper.title}</span>
                <span className="ml-auto shrink-0 text-muted-foreground">
                  {paper.paper_id}
                </span>
              </div>
            ))}
          </div>
        </ToolContent>
      )}
    </Tool>
  );
}
