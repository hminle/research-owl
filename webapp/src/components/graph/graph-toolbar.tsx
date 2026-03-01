"use client";

import { useState, useEffect } from "react";
import { Search, ZoomIn, ZoomOut, Maximize2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ENTITY_TYPE_COLORS } from "./types";

interface GraphToolbarProps {
  nodeCount: number;
  edgeCount: number;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  selectedTypes: Set<string>;
  availableTypes: string[];
  onToggleType: (type: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
}

export function GraphToolbar({
  nodeCount,
  edgeCount,
  searchTerm,
  onSearchChange,
  selectedTypes,
  availableTypes,
  onToggleType,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
}: GraphToolbarProps) {
  const [localSearch, setLocalSearch] = useState(searchTerm);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => onSearchChange(localSearch), 250);
    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  return (
    <div className="flex items-center gap-2 border-b px-4 py-2 bg-background shrink-0 flex-wrap">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search nodes..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="h-8 w-56 pl-8 text-sm"
        />
      </div>

      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => setFilterOpen(!filterOpen)}
        >
          <Filter className="h-3.5 w-3.5" />
          Types
          {selectedTypes.size < availableTypes.length && (
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
              {selectedTypes.size}
            </Badge>
          )}
        </Button>
        {filterOpen && (
          <div className="absolute top-full left-0 mt-1 z-50 rounded-md border bg-popover p-2 shadow-md space-y-1 min-w-[180px]">
            {availableTypes.map((type) => (
              <label
                key={type}
                className="flex items-center gap-2 text-sm cursor-pointer px-1 py-0.5 rounded hover:bg-muted"
              >
                <input
                  type="checkbox"
                  checked={selectedTypes.has(type)}
                  onChange={() => onToggleType(type)}
                  className="rounded"
                />
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      ENTITY_TYPE_COLORS[type.toLowerCase()] ?? "#6b7280",
                  }}
                />
                <span className="capitalize">{type}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 ml-auto">
        <span className="text-xs text-muted-foreground mr-2">
          {nodeCount} nodes &middot; {edgeCount} edges
        </span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onZoomIn} title="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onZoomOut} title="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onFitToScreen} title="Fit to screen">
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
