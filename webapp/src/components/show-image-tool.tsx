"use client";

import type { ToolUIPart } from "ai";
import {
  Tool,
  ToolContent,
  ToolHeader,
} from "@/components/ai-elements/tool";
import { ImageIcon } from "lucide-react";

interface ShowImageToolProps {
  part: ToolUIPart;
}

export function ShowImageTool({ part }: ShowImageToolProps) {
  const input = part.input as { url?: string; caption?: string } | undefined;
  const output = part.output as { url: string; caption: string | null } | undefined;
  const imageUrl = output?.url ?? input?.url;
  const caption = output?.caption ?? input?.caption;

  return (
    <Tool defaultOpen>
      <ToolHeader
        state={part.state}
        title={caption || "Image"}
        type={part.type}
        icon={<ImageIcon className="h-4 w-4" />}
      />
      {imageUrl && (
        <ToolContent>
          <div className="space-y-2">
            <img
              src={imageUrl}
              alt={caption || "Figure from paper"}
              className="rounded-md border max-w-full"
            />
            {caption && (
              <p className="text-xs text-muted-foreground">{caption}</p>
            )}
          </div>
        </ToolContent>
      )}
    </Tool>
  );
}
