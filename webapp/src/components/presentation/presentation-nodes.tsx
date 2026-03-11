"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Brain,
  Database,
  FileText,
  FileUp,
  Link,
  MessageSquare,
  Monitor,
  Scissors,
  Search,
  PenTool,
  Sparkles,
  GitBranch,
  Share2,
  FileSearch,
  Merge,
  CheckCircle,
  ListChecks,
  Award,
  Server,
  type LucideIcon,
} from "lucide-react";

const colorMap: Record<string, { bg: string; border: string; text: string; accent: string }> = {
  blue:    { bg: "bg-blue-50",    border: "border-blue-200",    text: "text-blue-700",    accent: "bg-blue-500" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", accent: "bg-emerald-500" },
  violet:  { bg: "bg-violet-50",  border: "border-violet-200",  text: "text-violet-700",  accent: "bg-violet-500" },
  amber:   { bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-700",   accent: "bg-amber-500" },
  rose:    { bg: "bg-rose-50",    border: "border-rose-200",    text: "text-rose-700",    accent: "bg-rose-500" },
  sky:     { bg: "bg-sky-50",     border: "border-sky-200",     text: "text-sky-700",     accent: "bg-sky-500" },
  orange:  { bg: "bg-orange-50",  border: "border-orange-200",  text: "text-orange-700",  accent: "bg-orange-500" },
  gray:    { bg: "bg-gray-50",    border: "border-gray-200",    text: "text-gray-600",    accent: "bg-gray-400" },
};

const iconMap: Record<string, LucideIcon> = {
  Brain,
  Database,
  FileText,
  FileUp,
  Link,
  MessageSquare,
  Monitor,
  Scissors,
  Search,
  PenTool,
  Sparkles,
  GitBranch,
  Share2,
  FileSearch,
  Merge,
  CheckCircle,
  ListChecks,
  Award,
  Server,
};

const hiddenHandle = "!w-0 !h-0 !min-w-0 !min-h-0 !border-0 !bg-transparent";

interface PresentationNodeData {
  label: string;
  subtitle?: string;
  color?: string;
  icon?: string;
  [key: string]: unknown;
}

function AllHandles() {
  return (
    <>
      <Handle type="target" position={Position.Left} id="target-left" className={hiddenHandle} />
      <Handle type="target" position={Position.Top} id="target-top" className={hiddenHandle} />
      <Handle type="target" position={Position.Right} id="target-right" className={hiddenHandle} />
      <Handle type="target" position={Position.Bottom} id="target-bottom" className={hiddenHandle} />
      <Handle type="source" position={Position.Left} id="source-left" className={hiddenHandle} />
      <Handle type="source" position={Position.Top} id="source-top" className={hiddenHandle} />
      <Handle type="source" position={Position.Right} id="source-right" className={hiddenHandle} />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className={hiddenHandle} />
    </>
  );
}

export const PresentationNode = memo(function PresentationNode({ data }: NodeProps) {
  const d = data as PresentationNodeData;
  const c = colorMap[d.color ?? "gray"] ?? colorMap.gray;
  const Icon = iconMap[d.icon ?? ""] ?? Database;

  return (
    <div
      className={`
        rounded-2xl border-2 ${c.border} ${c.bg}
        min-w-[220px] max-w-[260px] px-5 py-4
        shadow-md
      `}
    >
      <AllHandles />
      <div className="flex items-center gap-3">
        <div className={`rounded-xl p-2.5 ${c.accent} shrink-0`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="min-w-0">
          <div className={`text-base font-bold leading-tight ${c.text}`}>
            {d.label}
          </div>
          {d.subtitle && (
            <div className="text-sm text-muted-foreground leading-snug mt-1">
              {d.subtitle}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export const presentationNodeTypes = {
  presentationNode: PresentationNode,
};
