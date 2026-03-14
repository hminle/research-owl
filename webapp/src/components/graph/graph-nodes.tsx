"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { FileText, Tag } from "lucide-react";

const hiddenHandle = "!w-0 !h-0 !min-w-0 !min-h-0 !border-0 !bg-transparent";

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

const entityColors: Record<string, { bg: string; border: string; text: string }> = {
  Method:  { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700" },
  Dataset: { bg: "bg-amber-50",   border: "border-amber-300",   text: "text-amber-700" },
  Metric:  { bg: "bg-violet-50",  border: "border-violet-300",  text: "text-violet-700" },
  Model:   { bg: "bg-sky-50",     border: "border-sky-300",     text: "text-sky-700" },
  Task:    { bg: "bg-rose-50",    border: "border-rose-300",    text: "text-rose-700" },
};

const defaultEntityColor = { bg: "bg-gray-50", border: "border-gray-300", text: "text-gray-700" };

export const PaperNode = memo(function PaperNode({ data }: NodeProps) {
  const label = (data.label as string) || "Untitled";
  const ingested = data.ingested as boolean;
  const truncated = label.length > 40 ? label.slice(0, 37) + "..." : label;

  const borderClass = ingested
    ? "border-blue-300 bg-blue-50"
    : "border-gray-300 bg-gray-50 border-dashed";
  const iconBg = ingested ? "bg-blue-100" : "bg-gray-100";
  const iconColor = ingested ? "text-blue-700" : "text-gray-500";
  const textColor = ingested ? "text-blue-700" : "text-gray-600";

  return (
    <div className={`rounded-xl border-2 ${borderClass} px-4 py-3 min-w-[160px] max-w-[240px] shadow-sm hover:shadow-md hover:scale-[1.02] cursor-pointer transition-all`}>
      <AllHandles />
      <div className="flex items-center gap-2">
        <div className={`rounded-lg p-1.5 ${iconBg} shrink-0`}>
          <FileText className={`h-4 w-4 ${iconColor}`} />
        </div>
        <div className={`text-sm font-semibold ${textColor} leading-tight`}>{truncated}</div>
      </div>
    </div>
  );
});

export const EntityNode = memo(function EntityNode({ data }: NodeProps) {
  const kind = (data.kind as string) || "Entity";
  const label = (data.label as string) || "Unknown";
  const truncated = label.length > 30 ? label.slice(0, 27) + "..." : label;
  const c = entityColors[kind] ?? defaultEntityColor;

  return (
    <div className={`rounded-xl border-2 ${c.border} ${c.bg} px-3 py-2 min-w-[120px] max-w-[200px] shadow-sm hover:shadow-md hover:scale-[1.02] cursor-pointer transition-all`}>
      <AllHandles />
      <div className="flex items-center gap-2">
        <div className={`rounded-lg p-1 ${c.bg}`}>
          <Tag className={`h-3.5 w-3.5 ${c.text}`} />
        </div>
        <div className="min-w-0">
          <div className={`text-xs font-semibold ${c.text} leading-tight`}>{truncated}</div>
          <div className="text-[10px] text-muted-foreground">{kind}</div>
        </div>
      </div>
    </div>
  );
});

export const graphNodeTypes = {
  paper: PaperNode,
  entity: EntityNode,
};
