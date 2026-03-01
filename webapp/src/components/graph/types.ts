export interface GraphNode {
  id: string;
  label: string;
  entity_type: string;
  description: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  description: string;
  keywords: string[];
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ForceGraphNode extends GraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  degree?: number;
}

export interface ForceGraphLink {
  source: string | ForceGraphNode;
  target: string | ForceGraphNode;
  description: string;
  keywords: string[];
  weight: number;
}

export interface ForceGraphData {
  nodes: ForceGraphNode[];
  links: ForceGraphLink[];
}

export const ENTITY_TYPE_COLORS: Record<string, string> = {
  person: "#3b82f6",
  concept: "#8b5cf6",
  method: "#10b981",
  dataset: "#f59e0b",
  paper: "#ef4444",
  organization: "#06b6d4",
  technology: "#ec4899",
};

export const DEFAULT_NODE_COLOR = "#6b7280";

export function getNodeColor(entityType: string): string {
  return ENTITY_TYPE_COLORS[entityType.toLowerCase()] ?? DEFAULT_NODE_COLOR;
}
