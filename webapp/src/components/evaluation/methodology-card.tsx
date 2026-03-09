"use client";

import { useState } from "react";
import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Target,
} from "lucide-react";

export function MethodologyCard() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border bg-card">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-accent/30 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-900/30">
            <Brain className="h-4 w-4 text-amber-700 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">
              How Evaluation Works
            </h3>
            <p className="text-xs text-muted-foreground">
              LLM-as-Judge with two complementary metrics
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <div className="h-px bg-border" />

          {/* Pipeline overview */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground leading-relaxed">
              For each Q&A item, we query the RAG pipeline to get an answer and
              retrieved contexts, then use an LLM judge to evaluate the response
              against the ground truth.
            </p>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Correctness */}
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-100 dark:bg-emerald-900/30">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h4 className="text-sm font-medium">Correctness</h4>
                <span className="ml-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                  Pass / Fail
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Binary judgment of whether the RAG answer captures the key
                information from the expected answer. The aggregate score is the
                <span className="font-medium text-foreground"> pass rate </span>
                across all items (e.g. 67% means 4 of 6 items passed).
              </p>
              <div className="text-[11px] text-muted-foreground/80 space-y-0.5">
                <p>Considers: key information coverage, factual accuracy against retrieved context, question addressal</p>
              </div>
            </div>

            {/* Factual Correctness */}
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-100 dark:bg-blue-900/30">
                  <Target className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <h4 className="text-sm font-medium">Factual Correctness</h4>
                <span className="ml-auto rounded-full bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-400">
                  0 &ndash; 100%
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Granular score measuring how factually accurate the response is
                compared to the reference answer. The aggregate is the
                <span className="font-medium text-foreground"> mean score </span>
                across all items.
              </p>
              <div className="text-[11px] text-muted-foreground/80 space-y-0.5">
                <p>Scale: 90%+ excellent, 70-89% good, 40-69% partial, &lt;40% poor</p>
              </div>
            </div>
          </div>

          {/* How it works steps */}
          <div className="rounded-md bg-muted/40 p-3 space-y-2">
            <h4 className="text-xs font-medium flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3" />
              Evaluation Pipeline
            </h4>
            <ol className="text-[11px] text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>
                <span className="font-medium text-foreground/80">Query RAG</span>
                {" "}&mdash; send the question through the same retrieval + generation
                pipeline used in production
              </li>
              <li>
                <span className="font-medium text-foreground/80">Judge Correctness</span>
                {" "}&mdash; LLM compares the answer to the expected answer with
                retrieved context, returns pass/fail with reasoning
              </li>
              <li>
                <span className="font-medium text-foreground/80">Score Factual Accuracy</span>
                {" "}&mdash; LLM scores how factually accurate the answer is on
                a 0&ndash;1 scale against the reference
              </li>
              <li>
                <span className="font-medium text-foreground/80">Aggregate</span>
                {" "}&mdash; compute pass rate (correctness) and mean score
                (factual correctness) across all items
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
