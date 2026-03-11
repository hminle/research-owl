"use client";

import { useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SlideNavigationProps {
  current: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onGoTo: (index: number) => void;
}

export function SlideNavigation({
  current,
  total,
  onPrev,
  onNext,
  onGoTo,
}: SlideNavigationProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    },
    [onPrev, onNext],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex items-center justify-between px-6 py-3 border-t bg-background/80 backdrop-blur-sm">
      {/* Prev button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onPrev}
        disabled={current === 0}
        className="gap-1"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </Button>

      {/* Progress dots */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <button
              key={i}
              onClick={() => onGoTo(i)}
              className={`
                rounded-full transition-all duration-300
                ${i === current
                  ? "h-2.5 w-2.5 bg-violet-500"
                  : "h-2 w-2 bg-gray-300 hover:bg-gray-400"
                }
              `}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground ml-2">
          {current + 1} / {total}
        </span>
      </div>

      {/* Next button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onNext}
        disabled={current === total - 1}
        className="gap-1"
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
