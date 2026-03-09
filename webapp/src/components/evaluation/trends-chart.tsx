"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

interface EvalStats {
  total_datasets: number;
  total_runs: number;
  total_items: number;
  trends: {
    run_id: string;
    dataset_id: string;
    completed_at: string;
    correctness: number | null;
    factual_correctness: number | null;
  }[];
}

interface EvalDataset {
  dataset_id: string;
  name: string;
}

export function TrendsChart() {
  const [filterDataset, setFilterDataset] = useState<string>("all");

  const { data: stats, isLoading } = useQuery<EvalStats>({
    queryKey: ["eval-stats", filterDataset],
    queryFn: async () => {
      const path =
        filterDataset && filterDataset !== "all"
          ? `/api/rag/eval/stats?dataset_id=${filterDataset}`
          : "/api/rag/eval/stats";
      const res = await apiFetch(path);
      return res.json();
    },
  });

  const { data: datasets = [] } = useQuery<EvalDataset[]>({
    queryKey: ["eval-datasets"],
    queryFn: async () => {
      const res = await apiFetch("/api/rag/eval/datasets");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const chartData = (stats?.trends ?? []).map((t) => ({
    date: new Date(t.completed_at).toLocaleDateString(),
    run_id: t.run_id.slice(0, 8),
    correctness: t.correctness != null ? Math.round(t.correctness * 100) : null,
    factual_correctness: t.factual_correctness != null ? Math.round(t.factual_correctness * 100) : null,
  }));

  return (
    <div className="space-y-4">
      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold tabular-nums">{stats?.total_datasets ?? 0}</p>
          <p className="text-xs text-muted-foreground">Datasets</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold tabular-nums">{stats?.total_runs ?? 0}</p>
          <p className="text-xs text-muted-foreground">Runs</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold tabular-nums">{stats?.total_items ?? 0}</p>
          <p className="text-xs text-muted-foreground">Q&A Items</p>
        </div>
      </div>

      {/* Filter + Chart */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Correctness Over Time</h3>
          </div>
          <Select value={filterDataset} onValueChange={setFilterDataset}>
            <SelectTrigger className="w-[180px]" size="sm">
              <SelectValue placeholder="All datasets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All datasets</SelectItem>
              {datasets.map((ds) => (
                <SelectItem key={ds.dataset_id} value={ds.dataset_id}>
                  {ds.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {chartData.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            No completed runs yet. Run an evaluation to see trends.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
                className="text-muted-foreground"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "0.5rem",
                  fontSize: "0.75rem",
                }}
                formatter={(value) => [`${value}%`]}
              />
              <Legend
                wrapperStyle={{ fontSize: "0.75rem" }}
              />
              <Line
                type="monotone"
                dataKey="correctness"
                name="Correctness"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="factual_correctness"
                name="Factual Correctness"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
