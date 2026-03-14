"use client";

import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type ReactFlowInstance,
  BackgroundVariant,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useQuery } from "@tanstack/react-query";
import { Loader2, GitFork, Share2, Filter } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { graphNodeTypes } from "./graph-nodes";
import { layoutGraph } from "./graph-layout";
import { GraphDetailPanel } from "./graph-detail-panel";

const VIEW_TABS = [
  { id: "citation", label: "Citation Graph", icon: GitFork },
  { id: "entity", label: "Entity Graph", icon: Share2 },
] as const;

type ViewId = (typeof VIEW_TABS)[number]["id"];

const defaultEdgeOptions = {
  markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: "#94a3b8" },
};

export function GraphExplorer() {
  const [activeView, setActiveView] = useState<ViewId>("citation");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showOnlyIngested, setShowOnlyIngested] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const rfInstance = useRef<ReactFlowInstance | null>(null);

  const endpoint =
    activeView === "citation"
      ? "/api/rag/graph/citation-graph"
      : "/api/rag/graph/entity-graph";

  const { data, isLoading } = useQuery({
    queryKey: ["graph", activeView],
    queryFn: async () => {
      const res = await apiFetch(endpoint);
      return res.json();
    },
  });

  useEffect(() => {
    if (!data) return;

    let filteredNodes = data.nodes ?? [];
    let filteredEdges = data.edges ?? [];

    if (showOnlyIngested) {
      const ingestedIds = new Set(
        filteredNodes
          .filter((n: { ingested?: boolean }) => n.ingested !== false)
          .map((n: { id: string }) => n.id),
      );
      filteredNodes = filteredNodes.filter(
        (n: { ingested?: boolean }) => n.ingested !== false,
      );
      filteredEdges = filteredEdges.filter(
        (e: { source: string; target: string }) =>
          ingestedIds.has(e.source) && ingestedIds.has(e.target),
      );
    }

    const { nodes: laidOutNodes, edges: laidOutEdges } = layoutGraph(
      filteredNodes,
      filteredEdges,
    );
    setNodes(laidOutNodes);
    setEdges(laidOutEdges);
    setSelectedId(null);
    setTimeout(() => rfInstance.current?.fitView({ padding: 0.15, duration: 300 }), 50);
  }, [data, showOnlyIngested, setNodes, setEdges]);

  const onNodeClick: NodeMouseHandler = useCallback((_event, node: Node) => {
    setSelectedId((prev) => (prev === node.id ? null : node.id));
  }, []);

  const styledEdges = useMemo(() => {
    if (!selectedId) return edges;
    return edges.map((edge) => {
      const connected = edge.source === selectedId || edge.target === selectedId;
      return {
        ...edge,
        animated: connected,
        style: {
          ...edge.style,
          strokeWidth: connected ? 2.5 : 1.5,
          opacity: connected ? 1 : 0.15,
        },
      };
    });
  }, [edges, selectedId]);

  const styledNodes = useMemo(() => {
    if (!selectedId) return nodes;
    const connectedIds = new Set<string>([selectedId]);
    edges.forEach((ed) => {
      if (ed.source === selectedId) connectedIds.add(ed.target);
      if (ed.target === selectedId) connectedIds.add(ed.source);
    });
    return nodes.map((node) => ({
      ...node,
      style: { opacity: connectedIds.has(node.id) ? 1 : 0.2, transition: "opacity 0.2s" },
    }));
  }, [nodes, edges, selectedId]);

  const selectedNode = selectedId ? nodes.find((n) => n.id === selectedId) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b bg-muted/30 overflow-x-auto">
        {VIEW_TABS.map((tab) => {
          const active = tab.id === activeView;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors
                ${active
                  ? "bg-background shadow-sm font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }
              `}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
        {activeView === "citation" && (
          <button
            onClick={() => setShowOnlyIngested((v) => !v)}
            className={`
              ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors border
              ${showOnlyIngested
                ? "bg-blue-50 border-blue-300 text-blue-700 font-medium"
                : "bg-background border-transparent text-muted-foreground hover:text-foreground hover:bg-background/50"
              }
            `}
          >
            <Filter className="h-3.5 w-3.5" />
            Ingested only
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground hidden sm:block">
          {nodes.length} nodes, {edges.length} edges
        </span>
      </div>

      {/* Canvas + Detail panel */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 relative">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              No graph data. Ingest papers to populate the graph.
            </div>
          ) : (
            <ReactFlow
              nodes={styledNodes}
              edges={styledEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={graphNodeTypes}
              defaultEdgeOptions={defaultEdgeOptions}
              onNodeClick={onNodeClick}
              onPaneClick={() => setSelectedId(null)}
              onInit={(instance) => { rfInstance.current = instance; }}
              fitView
              fitViewOptions={{ padding: 0.15 }}
              minZoom={0.2}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#e2e8f0" />
              <Controls showInteractive={false} className="!border-border !shadow-sm" />
              <MiniMap
                nodeStrokeWidth={3}
                className="!border-border !shadow-sm !bg-muted/50"
                maskColor="rgba(0,0,0,0.06)"
              />
            </ReactFlow>
          )}
        </div>

        {selectedNode && (
          <div className="w-[340px] shrink-0 animate-in slide-in-from-right-4 duration-200">
            <GraphDetailPanel
              node={selectedNode}
              edges={edges}
              allNodes={nodes}
              onClose={() => setSelectedId(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
