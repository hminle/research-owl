"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { GitFork } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { GraphToolbar } from "@/components/graph/graph-toolbar";
import { DetailPanel } from "@/components/graph/detail-panel";
import type { GraphData, ForceGraphNode, ForceGraphLink, ForceGraphData } from "@/components/graph/types";
import type { KnowledgeGraphHandle } from "@/components/graph/knowledge-graph";

const KnowledgeGraph = dynamic(
  () => import("@/components/graph/knowledge-graph"),
  { ssr: false },
);

async function fetchGraph(): Promise<GraphData> {
  const res = await apiFetch("/api/rag/graph");
  return res.json();
}

export default function GraphPage() {
  const { data: rawData, error, isLoading } = useQuery({
    queryKey: ["graph"],
    queryFn: fetchGraph,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<ForceGraphNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<ForceGraphLink | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<KnowledgeGraphHandle>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const availableTypes = useMemo(() => {
    if (!rawData) return [];
    const types = new Set(rawData.nodes.map((n) => n.entity_type));
    return Array.from(types).sort();
  }, [rawData]);

  useEffect(() => {
    if (availableTypes.length > 0 && selectedTypes.size === 0) {
      setSelectedTypes(new Set(availableTypes));
    }
  }, [availableTypes, selectedTypes.size]);

  const graphData: ForceGraphData = useMemo(() => {
    if (!rawData) return { nodes: [], links: [] };

    const search = searchTerm.toLowerCase();
    const activeTypes = selectedTypes;

    let filteredNodes = rawData.nodes.filter(
      (n) => activeTypes.has(n.entity_type),
    );

    if (search) {
      filteredNodes = filteredNodes.filter((n) =>
        n.label.toLowerCase().includes(search),
      );
    }

    const nodeIds = new Set(filteredNodes.map((n) => n.id));

    const links: ForceGraphLink[] = rawData.edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({
        source: e.source,
        target: e.target,
        description: e.description,
        keywords: e.keywords,
        weight: e.weight,
      }));

    const degreeCounts = new Map<string, number>();
    for (const link of links) {
      const src = typeof link.source === "string" ? link.source : link.source.id;
      const tgt = typeof link.target === "string" ? link.target : link.target.id;
      degreeCounts.set(src, (degreeCounts.get(src) ?? 0) + 1);
      degreeCounts.set(tgt, (degreeCounts.get(tgt) ?? 0) + 1);
    }

    const nodes: ForceGraphNode[] = filteredNodes.map((n) => ({
      ...n,
      degree: degreeCounts.get(n.id) ?? 0,
    }));

    return { nodes, links };
  }, [rawData, searchTerm, selectedTypes]);

  const handleToggleType = useCallback((type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const handleNodeClick = useCallback((node: ForceGraphNode) => {
    setSelectedNode(node);
    setSelectedLink(null);
    setDetailOpen(true);
  }, []);

  const handleLinkClick = useCallback((link: ForceGraphLink) => {
    setSelectedLink(link);
    setSelectedNode(null);
    setDetailOpen(true);
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Loading knowledge graph...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-2">
          <GitFork className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load graph"}
          </p>
        </div>
      </div>
    );
  }

  if (!rawData || rawData.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-2">
          <GitFork className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            No graph data yet. Ingest some papers first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <GraphToolbar
        nodeCount={graphData.nodes.length}
        edgeCount={graphData.links.length}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedTypes={selectedTypes}
        availableTypes={availableTypes}
        onToggleType={handleToggleType}
        onZoomIn={() => graphRef.current?.zoomIn()}
        onZoomOut={() => graphRef.current?.zoomOut()}
        onFitToScreen={() => graphRef.current?.fitToScreen()}
      />
      <div ref={containerRef} className="flex-1 min-h-0">
        <KnowledgeGraph
          ref={graphRef}
          data={graphData}
          width={dimensions.width}
          height={dimensions.height}
          onNodeClick={handleNodeClick}
          onLinkClick={handleLinkClick}
        />
      </div>
      <DetailPanel
        open={detailOpen}
        onOpenChange={setDetailOpen}
        selectedNode={selectedNode}
        selectedLink={selectedLink}
        links={graphData.links}
      />
    </div>
  );
}
