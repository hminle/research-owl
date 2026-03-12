"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { apiFetch } from "@/lib/api";

interface EmbeddingPoint {
  id: string;
  x: number;
  y: number;
  paper_id: string;
  paper_title: string;
  chunk_type: string;
  content_preview: string;
}

const PAPER_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#e11d48", "#a855f7", "#0ea5e9", "#d946ef",
];

const CHUNK_TYPE_COLORS: Record<string, string> = {
  text: "#3b82f6",
  image: "#f59e0b",
};

type ColorMode = "paper" | "type";

export function EmbeddingsExplorer() {
  const [colorMode, setColorMode] = useState<ColorMode>("paper");

  const { data, isLoading } = useQuery<{ points: EmbeddingPoint[] }>({
    queryKey: ["embeddings-scatter"],
    queryFn: async () => {
      const res = await apiFetch("/api/rag/embeddings/scatter?limit=1000");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const points = data?.points ?? [];

  const groups = useMemo(() => {
    if (colorMode === "paper") {
      const byPaper = new Map<string, EmbeddingPoint[]>();
      for (const p of points) {
        const key = p.paper_id || "unknown";
        if (!byPaper.has(key)) byPaper.set(key, []);
        byPaper.get(key)!.push(p);
      }
      return Array.from(byPaper.entries()).map(([paperId, pts], i) => ({
        key: paperId,
        label: pts[0]?.paper_title
          ? pts[0].paper_title.length > 30
            ? pts[0].paper_title.slice(0, 27) + "..."
            : pts[0].paper_title
          : paperId,
        points: pts,
        color: PAPER_COLORS[i % PAPER_COLORS.length],
      }));
    } else {
      const byType = new Map<string, EmbeddingPoint[]>();
      for (const p of points) {
        const key = p.chunk_type || "text";
        if (!byType.has(key)) byType.set(key, []);
        byType.get(key)!.push(p);
      }
      return Array.from(byType.entries()).map(([type, pts]) => ({
        key: type,
        label: type.charAt(0).toUpperCase() + type.slice(1),
        points: pts,
        color: CHUNK_TYPE_COLORS[type] ?? "#6b7280",
      }));
    }
  }, [points, colorMode]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Computing UMAP reduction... This may take a few seconds.
        </p>
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        No embeddings found. Ingest papers to generate vector embeddings.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats + Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold tabular-nums">{points.length}</p>
            <p className="text-xs text-muted-foreground">Embeddings</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold tabular-nums">{groups.length}</p>
            <p className="text-xs text-muted-foreground">
              {colorMode === "paper" ? "Papers" : "Types"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-lg border p-1">
          <button
            onClick={() => setColorMode("paper")}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              colorMode === "paper"
                ? "bg-background shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            By Paper
          </button>
          <button
            onClick={() => setColorMode("type")}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              colorMode === "type"
                ? "bg-background shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            By Type
          </button>
        </div>
      </div>

      {/* Scatter Chart */}
      <div className="rounded-lg border p-4">
        <ResponsiveContainer width="100%" height={560}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              type="number"
              dataKey="x"
              name="UMAP-1"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
            />
            <YAxis
              type="number"
              dataKey="y"
              name="UMAP-2"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ strokeDasharray: "3 3" }}
            />
            <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
            {groups.map((group) => (
              <Scatter
                key={group.key}
                name={group.label}
                data={group.points}
                fill={group.color}
                opacity={0.7}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: EmbeddingPoint }> }) {
  if (!active || !payload?.[0]) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-lg border bg-popover px-3 py-2.5 shadow-md text-sm max-w-[300px]">
      <div className="font-medium text-foreground leading-tight">
        {point.paper_title || point.paper_id}
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
          point.chunk_type === "image"
            ? "bg-amber-100 text-amber-700"
            : "bg-blue-100 text-blue-700"
        }`}>
          {point.chunk_type}
        </span>
      </div>
      {point.content_preview && (
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
          {point.content_preview}
        </p>
      )}
    </div>
  );
}
