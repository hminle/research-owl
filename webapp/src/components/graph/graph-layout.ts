import type { Node, Edge } from "@xyflow/react";

interface ApiNode {
  id: string;
  kind: string;
  label: string;
  paper_id?: string;
  description?: string;
  ingested?: boolean;
}

interface ApiEdge {
  source: string;
  target: string;
  relation: string;
}

/**
 * Lay out nodes in a force-directed-like grid.
 * Papers with more connections are placed closer to center.
 */
export function layoutGraph(
  apiNodes: ApiNode[],
  apiEdges: ApiEdge[],
): { nodes: Node[]; edges: Edge[] } {
  // Compute degree for each node
  const degree = new Map<string, number>();
  for (const n of apiNodes) degree.set(n.id, 0);
  for (const e of apiEdges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }

  // Sort by degree descending (high-degree nodes first = center)
  const sorted = [...apiNodes].sort(
    (a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0),
  );

  // Separate papers and entities
  const papers = sorted.filter((n) => n.kind === "Paper");
  const entities = sorted.filter((n) => n.kind !== "Paper");

  const nodeMap = new Map<string, Node>();

  // Place papers in a grid
  const paperCols = Math.max(3, Math.ceil(Math.sqrt(papers.length)));
  const spacingX = 280;
  const spacingY = 120;

  papers.forEach((n, i) => {
    const col = i % paperCols;
    const row = Math.floor(i / paperCols);
    nodeMap.set(n.id, {
      id: n.id,
      type: "paper",
      position: { x: col * spacingX, y: row * spacingY },
      data: { label: n.label, paper_id: n.paper_id, ingested: n.ingested ?? false },
    });
  });

  // Place entities around the papers
  if (entities.length > 0) {
    const paperRows = Math.ceil(papers.length / paperCols);
    const entityOffsetY = (paperRows + 1) * spacingY;
    const entityCols = Math.max(4, Math.ceil(Math.sqrt(entities.length)));
    const entitySpacingX = 220;
    const entitySpacingY = 100;

    entities.forEach((n, i) => {
      const col = i % entityCols;
      const row = Math.floor(i / entityCols);
      nodeMap.set(n.id, {
        id: n.id,
        type: "entity",
        position: { x: col * entitySpacingX, y: entityOffsetY + row * entitySpacingY },
        data: { label: n.label, kind: n.kind, description: n.description },
      });
    });
  }

  const nodes = Array.from(nodeMap.values());

  const edges: Edge[] = apiEdges
    .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
    .map((e, i) => ({
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      label: e.relation,
      style: { stroke: "#94a3b8", strokeWidth: 1.5 },
      labelStyle: { fontSize: 10, fill: "#64748b" },
    }));

  return { nodes, edges };
}
