"use client";

import { cn } from "@/lib/utils";

interface MetricBadgeProps {
  label: string;
  value: number | null | undefined;
  className?: string;
}

export function MetricBadge({ label, value, className }: MetricBadgeProps) {
  if (value == null) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground",
          className,
        )}
      >
        {label}: N/A
      </span>
    );
  }

  const pct = Math.round(value * 100);
  const color =
    value >= 0.7
      ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
      : value >= 0.4
        ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"
        : "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        color,
        className,
      )}
    >
      {label}: {pct}%
    </span>
  );
}

export function MetricScoreBar({ value }: { value: number | null | undefined }) {
  if (value == null) return null;

  const pct = Math.round(value * 100);
  const color =
    value >= 0.7
      ? "bg-emerald-500"
      : value >= 0.4
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}
