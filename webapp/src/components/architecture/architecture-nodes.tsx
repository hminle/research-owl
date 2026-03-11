"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Globe, Database, Cpu, User, Cloud } from "lucide-react";

const colorMap: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
  blue:    { bg: "bg-blue-50",    border: "border-blue-200",    text: "text-blue-700",    iconBg: "bg-blue-100" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", iconBg: "bg-emerald-100" },
  violet:  { bg: "bg-violet-50",  border: "border-violet-200",  text: "text-violet-700",  iconBg: "bg-violet-100" },
  amber:   { bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-700",   iconBg: "bg-amber-100" },
  rose:    { bg: "bg-rose-50",    border: "border-rose-200",    text: "text-rose-700",    iconBg: "bg-rose-100" },
  sky:     { bg: "bg-sky-50",     border: "border-sky-200",     text: "text-sky-700",     iconBg: "bg-sky-100" },
  slate:   { bg: "bg-slate-50",   border: "border-slate-200",   text: "text-slate-700",   iconBg: "bg-slate-100" },
  orange:  { bg: "bg-orange-50",  border: "border-orange-200",  text: "text-orange-700",  iconBg: "bg-orange-100" },
  gray:    { bg: "bg-gray-50",    border: "border-gray-200",    text: "text-gray-600",    iconBg: "bg-gray-100" },
};

function getColors(color: string) {
  return colorMap[color] ?? colorMap.gray;
}

const hiddenHandle = "!w-0 !h-0 !min-w-0 !min-h-0 !border-0 !bg-transparent";

interface ArchNodeData {
  label: string;
  subtitle?: string;
  color?: string;
  [key: string]: unknown;
}

function AllHandles() {
  return (
    <>
      <Handle type="target" position={Position.Left}   id="target-left"   className={hiddenHandle} />
      <Handle type="target" position={Position.Top}    id="target-top"    className={hiddenHandle} />
      <Handle type="target" position={Position.Right}  id="target-right"  className={hiddenHandle} />
      <Handle type="target" position={Position.Bottom} id="target-bottom" className={hiddenHandle} />
      <Handle type="source" position={Position.Left}   id="source-left"   className={hiddenHandle} />
      <Handle type="source" position={Position.Top}    id="source-top"    className={hiddenHandle} />
      <Handle type="source" position={Position.Right}  id="source-right"  className={hiddenHandle} />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className={hiddenHandle} />
    </>
  );
}

function NodeShell({
  data,
  icon: Icon,
}: {
  data: ArchNodeData;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const c = getColors(data.color ?? "gray");
  return (
    <div
      className={`rounded-xl border-2 ${c.border} ${c.bg} px-4 py-3 min-w-[180px] shadow-sm transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer`}
    >
      <AllHandles />
      <div className="flex items-center gap-2.5">
        <div className={`rounded-lg p-1.5 ${c.iconBg}`}>
          <Icon className={`h-4 w-4 ${c.text}`} />
        </div>
        <div className="min-w-0">
          <div className={`text-sm font-semibold leading-tight ${c.text}`}>
            {data.label}
          </div>
          {data.subtitle && (
            <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              {data.subtitle}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const ArchUserNode = memo(function ArchUserNode({ data }: NodeProps) {
  const d = data as ArchNodeData;
  return (
    <div className="rounded-full border-2 border-gray-200 bg-white px-5 py-3 shadow-sm hover:shadow-md hover:scale-[1.02] cursor-pointer transition-all">
      <AllHandles />
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">{d.label}</span>
      </div>
    </div>
  );
});

export const ArchServiceNode = memo(function ArchServiceNode({ data }: NodeProps) {
  return <NodeShell data={data as ArchNodeData} icon={Globe} />;
});

export const ArchModuleNode = memo(function ArchModuleNode({ data }: NodeProps) {
  return <NodeShell data={data as ArchNodeData} icon={Cpu} />;
});

export const ArchStorageNode = memo(function ArchStorageNode({ data }: NodeProps) {
  return <NodeShell data={data as ArchNodeData} icon={Database} />;
});

export const ArchExternalNode = memo(function ArchExternalNode({ data }: NodeProps) {
  return <NodeShell data={data as ArchNodeData} icon={Cloud} />;
});

export const nodeTypes = {
  archUser: ArchUserNode,
  archService: ArchServiceNode,
  archModule: ArchModuleNode,
  archStorage: ArchStorageNode,
  archExternal: ArchExternalNode,
};
