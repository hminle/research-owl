"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import type { ForceGraphNode, ForceGraphLink } from "./types";
import { getNodeColor } from "./types";

interface DetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedNode: ForceGraphNode | null;
  selectedLink: ForceGraphLink | null;
  links: ForceGraphLink[];
}

function getSourceId(link: ForceGraphLink): string {
  return typeof link.source === "string" ? link.source : link.source.id;
}

function getTargetId(link: ForceGraphLink): string {
  return typeof link.target === "string" ? link.target : link.target.id;
}

function getSourceLabel(link: ForceGraphLink): string {
  return typeof link.source === "string" ? link.source : link.source.label;
}

function getTargetLabel(link: ForceGraphLink): string {
  return typeof link.target === "string" ? link.target : link.target.label;
}

export function DetailPanel({
  open,
  onOpenChange,
  selectedNode,
  selectedLink,
  links,
}: DetailPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        {selectedNode && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: getNodeColor(selectedNode.entity_type) }}
                />
                {selectedNode.label}
              </SheetTitle>
              <SheetDescription>
                <Badge variant="outline" className="text-xs">
                  {selectedNode.entity_type}
                </Badge>
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-4 space-y-4">
              {selectedNode.description && (
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Description</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedNode.description}
                  </p>
                </div>
              )}
              <div className="space-y-1">
                <h4 className="text-sm font-medium">Connections</h4>
                <ul className="space-y-2">
                  {links
                    .filter(
                      (l) =>
                        getSourceId(l) === selectedNode.id ||
                        getTargetId(l) === selectedNode.id,
                    )
                    .map((l, i) => {
                      const isSource = getSourceId(l) === selectedNode.id;
                      const otherLabel = isSource
                        ? getTargetLabel(l)
                        : getSourceLabel(l);
                      return (
                        <li
                          key={i}
                          className="text-sm border rounded-md p-2 space-y-1"
                        >
                          <p className="text-muted-foreground">
                            {isSource ? (
                              <>
                                <span className="font-medium text-foreground">
                                  {selectedNode.label}
                                </span>
                                {" → "}
                                {otherLabel}
                              </>
                            ) : (
                              <>
                                {otherLabel}
                                {" → "}
                                <span className="font-medium text-foreground">
                                  {selectedNode.label}
                                </span>
                              </>
                            )}
                          </p>
                          {l.description && (
                            <p className="text-xs text-muted-foreground">
                              {l.description}
                            </p>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </div>
            </div>
          </>
        )}

        {selectedLink && !selectedNode && (
          <>
            <SheetHeader>
              <SheetTitle>Edge Details</SheetTitle>
              <SheetDescription>
                {getSourceLabel(selectedLink)} → {getTargetLabel(selectedLink)}
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-4 space-y-4">
              {selectedLink.description && (
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Description</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedLink.description}
                  </p>
                </div>
              )}
              {selectedLink.keywords?.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Keywords</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedLink.keywords.map((kw) => (
                      <Badge key={kw} variant="secondary" className="text-xs">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <h4 className="text-sm font-medium">Weight</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedLink.weight}
                </p>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
