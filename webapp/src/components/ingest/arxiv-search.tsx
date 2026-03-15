"use client";

import { useState } from "react";
import { Search, Loader2, FileUp, ChevronDown, ChevronUp, Calendar, Tag } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";

interface ArxivResult {
  arxiv_id: string;
  title: string;
  authors: string[];
  abstract: string;
  pdf_url: string;
  published: string;
  categories: string[];
}

interface ArxivSearchResponse {
  results: ArxivResult[];
  total: number;
}

interface ArxivSearchProps {
  onIngest: (arxivUrl: string, title: string) => void;
  ingestingIds: Set<string>;
  ingestedIds: Set<string>;
  disabled?: boolean;
}

export function ArxivSearch({
  onIngest,
  ingestingIds,
  ingestedIds,
  disabled,
}: ArxivSearchProps) {
  const [query, setQuery] = useState("");
  const [maxResults, setMaxResults] = useState("10");

  const search = useMutation({
    mutationFn: async (q: string) => {
      const res = await apiFetch("/api/rag/search/arxiv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, max_results: Number(maxResults) }),
      });
      return res.json() as Promise<ArxivSearchResponse>;
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || search.isPending) return;
    search.mutate(trimmed);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          type="text"
          placeholder="Search arXiv papers (e.g. &quot;diffusion models for image generation&quot;)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={search.isPending || disabled}
          className="flex-1"
        />
        <Select value={maxResults} onValueChange={setMaxResults} disabled={search.isPending || disabled}>
          <SelectTrigger className="w-[80px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="30">30</SelectItem>
            <SelectItem value="50">50</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="submit"
          disabled={!query.trim() || search.isPending || disabled}
        >
          {search.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          <span className="ml-1.5">Search</span>
        </Button>
      </form>

      {search.error && (
        <p className="text-sm text-destructive">
          {search.error instanceof Error
            ? search.error.message
            : "Search failed"}
        </p>
      )}

      {search.data && search.data.results.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No results found. Try a different query.
        </p>
      )}

      {search.data && search.data.results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Found {search.data.total} papers
          </p>
          <div className="space-y-2">
            {search.data.results.map((paper) => (
              <ArxivResultCard
                key={paper.arxiv_id}
                paper={paper}
                onIngest={onIngest}
                isIngesting={ingestingIds.has(paper.arxiv_id)}
                isIngested={ingestedIds.has(paper.arxiv_id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ArxivResultCard({
  paper,
  onIngest,
  isIngesting,
  isIngested,
}: {
  paper: ArxivResult;
  onIngest: (arxivUrl: string, title: string) => void;
  isIngesting: boolean;
  isIngested: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const published = paper.published
    ? new Date(paper.published).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

  const authorDisplay =
    paper.authors.length > 3
      ? `${paper.authors.slice(0, 3).join(", ")} +${paper.authors.length - 3} more`
      : paper.authors.join(", ");

  return (
    <div className="rounded-lg border p-4 space-y-2 hover:border-foreground/20 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <h3 className="text-sm font-medium leading-snug">{paper.title}</h3>
          <p className="text-xs text-muted-foreground">{authorDisplay}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {published && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {published}
              </span>
            )}
            <span className="font-mono">{paper.arxiv_id}</span>
          </div>
        </div>
        <Button
          size="sm"
          variant={isIngested ? "outline" : "default"}
          disabled={isIngesting || isIngested}
          onClick={() =>
            onIngest(`https://arxiv.org/abs/${paper.arxiv_id}`, paper.title)
          }
          className="shrink-0"
        >
          {isIngesting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileUp className="h-3.5 w-3.5" />
          )}
          <span className="ml-1">
            {isIngested ? "Ingested" : isIngesting ? "Ingesting..." : "Ingest"}
          </span>
        </Button>
      </div>

      {paper.categories.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <Tag className="h-3 w-3 text-muted-foreground shrink-0" />
          {paper.categories.slice(0, 4).map((cat) => (
            <Badge key={cat} variant="secondary" className="text-[10px] px-1.5 py-0">
              {cat}
            </Badge>
          ))}
          {paper.categories.length > 4 && (
            <span className="text-[10px] text-muted-foreground">
              +{paper.categories.length - 4}
            </span>
          )}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
          {expanded ? "Hide abstract" : "Show abstract"}
        </button>
        {expanded && (
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            {paper.abstract}
          </p>
        )}
      </div>
    </div>
  );
}
