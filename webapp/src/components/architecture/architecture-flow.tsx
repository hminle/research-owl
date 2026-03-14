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

import {
  Network,
  ArrowRightLeft,
  MessageSquareText,
  FlaskConical,
  BrainCircuit,
} from "lucide-react";

import { nodeTypes } from "./architecture-nodes";
import { DetailPanel } from "./detail-panel";
import { views, componentDetails } from "./architecture-data";

const VIEW_TABS = [
  { id: "overview",    label: "System Overview",    icon: Network },
  { id: "ingestion",   label: "Ingestion Pipeline", icon: ArrowRightLeft },
  { id: "chat",       label: "Chat",               icon: MessageSquareText },
  { id: "research",   label: "Research",           icon: BrainCircuit },
  { id: "evaluation",  label: "Evaluation",         icon: FlaskConical },
] as const;

const defaultEdgeOptions = {
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "#94a3b8" },
};

export function ArchitectureFlow() {
  const [activeViewId, setActiveViewId] = useState("overview");
  const activeView = views.find((v) => v.id === activeViewId) ?? views[0];

  const [nodes, setNodes, onNodesChange] = useNodesState(activeView.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(activeView.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rfInstance = useRef<ReactFlowInstance | null>(null);

  useEffect(() => {
    setNodes(activeView.nodes);
    setEdges(activeView.edges);
    setSelectedId(null);
    setTimeout(() => rfInstance.current?.fitView({ padding: 0.15, duration: 300 }), 50);
  }, [activeViewId, activeView, setNodes, setEdges]);

  const onNodeClick: NodeMouseHandler = useCallback((_event, node: Node) => {
    if (componentDetails[node.id]) {
      setSelectedId((prev) => (prev === node.id ? null : node.id));
    }
  }, []);

  const styledEdges: Edge[] = useMemo(() => {
    if (!selectedId) return edges;
    return edges.map((edge) => {
      const connected = edge.source === selectedId || edge.target === selectedId;
      return {
        ...edge,
        animated: connected,
        style: {
          ...edge.style,
          strokeWidth: connected ? 2.5 : 1.5,
          opacity: connected ? 1 : 0.25,
        },
      };
    });
  }, [edges, selectedId]);

  const styledNodes: Node[] = useMemo(() => {
    if (!selectedId) return nodes;
    const connectedIds = new Set<string>([selectedId]);
    edges.forEach((ed) => {
      if (ed.source === selectedId) connectedIds.add(ed.target);
      if (ed.target === selectedId) connectedIds.add(ed.source);
    });
    return nodes.map((node) => ({
      ...node,
      style: { opacity: connectedIds.has(node.id) ? 1 : 0.3, transition: "opacity 0.2s" },
    }));
  }, [nodes, edges, selectedId]);

  const detail = selectedId ? componentDetails[selectedId] : null;

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b bg-muted/30 overflow-x-auto">
        {VIEW_TABS.map((tab) => {
          const active = tab.id === activeViewId;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveViewId(tab.id)}
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
        <span className="ml-auto text-xs text-muted-foreground hidden sm:block">
          {activeView.description}
        </span>
      </div>

      {/* Canvas + Detail panel */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 relative">
          <ReactFlow
            nodes={styledNodes}
            edges={styledEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            onNodeClick={onNodeClick}
            onPaneClick={() => setSelectedId(null)}
            onInit={(instance) => { rfInstance.current = instance; }}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.3}
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

          <div className="absolute bottom-4 left-4 rounded-lg border bg-background/90 backdrop-blur px-3 py-2 text-[11px] space-y-1 shadow-sm">
            <div className="font-semibold text-xs">Click any node for details</div>
          </div>
        </div>

        {detail && (
          <div className="w-[380px] shrink-0 animate-in slide-in-from-right-4 duration-200">
            <DetailPanel detail={detail} onClose={() => setSelectedId(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
