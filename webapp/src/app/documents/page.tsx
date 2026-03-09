"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layers, Search, FileText, Image, Database } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";

interface ChunkItem {
  id: string;
  paper_id: string;
  paper_title: string;
  chunk_type: string;
  chunk_index: number;
  content: string;
  image_filename: string | null;
  score?: number;
}

interface ChunkListResponse {
  items: ChunkItem[];
  total: number;
}

interface Paper {
  paper_id: string;
  title: string | null;
  status: string;
}

interface CollectionStats {
  total_points: number;
  vectors_count: number;
  status: string;
}

export default function DocumentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ChunkItem[] | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<string>("all");
  const [chunkTypeFilter, setChunkTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data: stats } = useQuery<CollectionStats>({
    queryKey: ["chunk-stats"],
    queryFn: async () => {
      const res = await apiFetch("/api/rag/chunks/stats");
      return res.json();
    },
  });

  const { data: papers = [] } = useQuery<Paper[]>({
    queryKey: ["papers"],
    queryFn: async () => {
      const res = await apiFetch("/api/rag/papers");
      return res.json();
    },
  });

  const { data: chunks, isLoading } = useQuery<ChunkListResponse>({
    queryKey: [
      "chunks",
      selectedPaper,
      chunkTypeFilter,
      page,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedPaper !== "all") params.set("paper_id", selectedPaper);
      if (chunkTypeFilter !== "all") params.set("chunk_type", chunkTypeFilter);
      params.set("offset", String(page * pageSize));
      params.set("limit", String(pageSize));
      const res = await apiFetch(`/api/rag/chunks?${params}`);
      return res.json();
    },
    enabled: searchResults === null,
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    try {
      const res = await apiFetch("/api/rag/chunks/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          top_k: 20,
          paper_id: selectedPaper !== "all" ? selectedPaper : undefined,
        }),
      });
      const data = await res.json();
      setSearchResults(data);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults(null);
  };

  const displayItems = searchResults ?? chunks?.items ?? [];
  const totalItems = searchResults ? searchResults.length : chunks?.total ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground">
            Explore text chunks and image descriptions stored in Qdrant
          </p>
        </div>
        {stats && (
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="gap-1">
              <Database className="h-3 w-3" />
              {stats.total_points} chunks
            </Badge>
            <Badge
              variant={stats.status === "green" ? "default" : "outline"}
              className="gap-1"
            >
              {stats.status}
            </Badge>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[250px]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex gap-2"
          >
            <Input
              placeholder="Semantic search across chunks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button type="submit" disabled={isSearching} variant="secondary">
              <Search className="h-4 w-4 mr-1" />
              Search
            </Button>
            {searchResults && (
              <Button variant="ghost" onClick={clearSearch}>
                Clear
              </Button>
            )}
          </form>
        </div>

        <Select value={selectedPaper} onValueChange={(v) => { setSelectedPaper(v); setPage(0); setSearchResults(null); }}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All papers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All papers</SelectItem>
            {papers
              .filter((p) => p.status === "completed")
              .map((p) => (
                <SelectItem key={p.paper_id} value={p.paper_id}>
                  {p.title || p.paper_id}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <Select value={chunkTypeFilter} onValueChange={(v) => { setChunkTypeFilter(v); setPage(0); setSearchResults(null); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="image">Image</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent text-muted-foreground" />
        </div>
      ) : displayItems.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Layers className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            {searchResults !== null
              ? "No matching chunks found."
              : "No chunks yet. Ingest some papers first."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {searchResults
              ? `${totalItems} search results`
              : `Showing ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, totalItems)} of ${totalItems} chunks`}
          </p>
          <div className="space-y-2">
            {displayItems.map((chunk) => (
              <div
                key={chunk.id}
                className="rounded-lg border p-3 space-y-1.5"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  {chunk.chunk_type === "image" ? (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <Image className="h-3 w-3" />
                      Image
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <FileText className="h-3 w-3" />
                      Text
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    #{chunk.chunk_index}
                  </span>
                  {chunk.paper_title && (
                    <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                      {chunk.paper_title}
                    </span>
                  )}
                  {chunk.score != null && (
                    <Badge variant="default" className="text-[10px] ml-auto">
                      {chunk.score.toFixed(3)}
                    </Badge>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap line-clamp-4">
                  {chunk.content}
                </p>
                {chunk.image_filename && (
                  <p className="text-xs text-muted-foreground">
                    Source: {chunk.image_filename}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Pagination (only for browse mode, not search) */}
          {!searchResults && totalItems > pageSize && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {Math.ceil(totalItems / pageSize)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={(page + 1) * pageSize >= totalItems}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
