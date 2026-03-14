"use client";

import { X, FileText, Tag, ArrowRight } from "lucide-react";
import type { Node, Edge } from "@xyflow/react";

interface GraphDetailPanelProps {
  node: Node;
  edges: Edge[];
  allNodes: Node[];
  onClose: () => void;
}

export function GraphDetailPanel({ node, edges, allNodes, onClose }: GraphDetailPanelProps) {
  const isPaper = node.type === "paper";
  const d = node.data as Record<string, unknown>;
  const label = String(d.label ?? node.id);
  const kind = String(d.kind ?? "Entity");
  const paperId = d.paper_id ? String(d.paper_id) : "";
  const description = d.description ? String(d.description) : "";
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

  // Find connected edges
  const connections = edges
    .filter((e) => e.source === node.id || e.target === node.id)
    .map((e) => {
      const otherId = e.source === node.id ? e.target : e.source;
      const other = nodeMap.get(otherId);
      const otherData = other?.data as Record<string, unknown> | undefined;
      return {
        relation: (e.label as string) || "RELATED",
        direction: e.source === node.id ? "outgoing" : "incoming",
        nodeId: otherId,
        label: (otherData?.label as string) || otherId,
        kind: (otherData?.kind as string) || other?.type || "unknown",
      };
    });

  return (
    <div className="h-full border-l bg-background overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 backdrop-blur px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          {isPaper ? (
            <FileText className="h-4 w-4 text-blue-600 shrink-0" />
          ) : (
            <Tag className="h-4 w-4 text-emerald-600 shrink-0" />
          )}
          <h2 className="text-sm font-semibold truncate">{label}</h2>
        </div>
        <button onClick={onClose} className="shrink-0 rounded-md p-1 hover:bg-muted transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Type badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-muted">
            {isPaper ? "Paper" : kind}
          </span>
          {isPaper && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
              d.ingested ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
            }`}>
              {d.ingested ? "Ingested" : "External"}
            </span>
          )}
          {isPaper && paperId && (
            <span className="text-xs text-muted-foreground font-mono">{paperId}</span>
          )}
        </div>

        {/* Description for entities */}
        {!isPaper && description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        )}

        {/* Connections */}
        {connections.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <ArrowRight className="h-3.5 w-3.5" />
              Connections ({connections.length})
            </div>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {connections.map((conn, i) => (
                <div key={i} className="rounded-lg border p-2.5">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono font-medium">
                      {conn.relation}
                    </span>
                    <span className="text-muted-foreground">
                      {conn.direction === "outgoing" ? "->" : "<-"}
                    </span>
                  </div>
                  <div className="text-sm mt-1 leading-tight">{conn.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{conn.kind}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {connections.length === 0 && (
          <p className="text-sm text-muted-foreground">No connections found.</p>
        )}
      </div>
    </div>
  );
}
