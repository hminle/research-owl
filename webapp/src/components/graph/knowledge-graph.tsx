"use client";

import { useRef, useCallback, useEffect, useImperativeHandle, forwardRef } from "react";
import ForceGraph2D from "react-force-graph-2d";
import type { ForceGraphNode, ForceGraphLink, ForceGraphData } from "./types";
import { getNodeColor } from "./types";

const ZOOM_LABEL_THRESHOLD = 1.5;
const MIN_NODE_RADIUS = 4;
const MAX_NODE_RADIUS = 16;

export interface KnowledgeGraphHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fitToScreen: () => void;
}

interface KnowledgeGraphProps {
  data: ForceGraphData;
  width: number;
  height: number;
  onNodeClick?: (node: ForceGraphNode) => void;
  onLinkClick?: (link: ForceGraphLink) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FGRef = any;

const KnowledgeGraph = forwardRef<KnowledgeGraphHandle, KnowledgeGraphProps>(
  function KnowledgeGraph({ data, width, height, onNodeClick, onLinkClick }, ref) {
    const fgRef = useRef<FGRef>(undefined);

    useImperativeHandle(ref, () => ({
      zoomIn() {
        const fg = fgRef.current;
        if (!fg) return;
        fg.zoom(fg.zoom() * 1.5, 300);
      },
      zoomOut() {
        const fg = fgRef.current;
        if (!fg) return;
        fg.zoom(fg.zoom() / 1.5, 300);
      },
      fitToScreen() {
        fgRef.current?.zoomToFit(400, 40);
      },
    }));

    useEffect(() => {
      const fg = fgRef.current;
      if (!fg) return;
      fg.d3Force("charge")?.strength(-120);
    }, []);

    useEffect(() => {
      const timer = setTimeout(() => {
        fgRef.current?.zoomToFit(400, 40);
      }, 800);
      return () => clearTimeout(timer);
    }, [data]);

    const nodeCanvasObject = useCallback(
      (node: ForceGraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const x = node.x ?? 0;
        const y = node.y ?? 0;
        const degree = node.degree ?? 1;
        const radius = Math.min(MIN_NODE_RADIUS + Math.sqrt(degree) * 2, MAX_NODE_RADIUS) / globalScale;
        const color = getNodeColor(node.entity_type);

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 0.5 / globalScale;
        ctx.stroke();

        if (globalScale > ZOOM_LABEL_THRESHOLD) {
          const fontSize = Math.max(10 / globalScale, 1.5);
          ctx.font = `${fontSize}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = "rgba(0,0,0,0.85)";
          ctx.fillText(node.label, x, y + radius + 1 / globalScale);
        }
      },
      [],
    );

    const nodePointerAreaPaint = useCallback(
      (node: ForceGraphNode, color: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const x = node.x ?? 0;
        const y = node.y ?? 0;
        const degree = node.degree ?? 1;
        const radius = Math.min(MIN_NODE_RADIUS + Math.sqrt(degree) * 2, MAX_NODE_RADIUS) / globalScale;
        ctx.beginPath();
        ctx.arc(x, y, radius + 2 / globalScale, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
      },
      [],
    );

    const handleNodeClick = useCallback(
      (node: ForceGraphNode) => onNodeClick?.(node),
      [onNodeClick],
    );

    const handleLinkClick = useCallback(
      (link: ForceGraphLink) => onLinkClick?.(link),
      [onLinkClick],
    );

    return (
      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        width={width}
        height={height}
        nodeId="id"
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={nodePointerAreaPaint}
        linkWidth={(link: ForceGraphLink) => Math.max(0.5, (link.weight ?? 1) * 1.5)}
        linkColor={() => "rgba(156,163,175,0.4)"}
        linkDirectionalParticles={0}
        onNodeClick={handleNodeClick}
        onLinkClick={handleLinkClick}
        d3AlphaDecay={0.05}
        d3VelocityDecay={0.3}
        warmupTicks={50}
        cooldownTicks={100}
        enableNodeDrag
        enableZoomInteraction
        enablePanInteraction
      />
    );
  },
);

export default KnowledgeGraph;
