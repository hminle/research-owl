"""In-memory graph built from SQLite data using NetworkX.

Provides citation traversal and entity relationships
without requiring a separate graph database.
"""

from __future__ import annotations

import logging

import networkx as nx

from research_owl.db import (
    get_all_citations,
    get_paper_entities,
    list_papers,
    search_entities,
)

logger = logging.getLogger(__name__)


class GraphService:
    """Lightweight graph service backed by NetworkX."""

    def __init__(self) -> None:
        self.graph = nx.DiGraph()

    def rebuild(self) -> None:
        """Rebuild the in-memory graph from SQLite data."""
        self.graph.clear()

        # Add paper nodes
        papers = list_papers()
        for p in papers:
            if p.status.value == "completed":
                self.graph.add_node(
                    f"paper:{p.paper_id}",
                    kind="Paper",
                    paper_id=p.paper_id,
                    title=p.title or p.paper_id,
                )

        # Add citation edges
        citations = get_all_citations()
        for citing_id, cited_id in citations:
            src = f"paper:{citing_id}"
            dst = f"paper:{cited_id}"
            # Ensure both nodes exist (cited paper may not be ingested)
            if not self.graph.has_node(dst):
                self.graph.add_node(dst, kind="Paper", paper_id=cited_id, title=cited_id)
            if not self.graph.has_node(src):
                self.graph.add_node(src, kind="Paper", paper_id=citing_id, title=citing_id)
            self.graph.add_edge(src, dst, relation="CITES")

        # Add entity nodes and paper-entity edges
        all_entities = search_entities()
        entity_id_to_node: dict[int, str] = {}
        for e in all_entities:
            node_id = f"{e['type'].lower()}:{e['normalized_name']}"
            entity_id_to_node[e["id"]] = node_id
            self.graph.add_node(
                node_id,
                kind=e["type"],
                name=e["name"],
                normalized_name=e["normalized_name"],
                description=e.get("description", ""),
            )

        for p in papers:
            if p.status.value != "completed":
                continue
            paper_node = f"paper:{p.paper_id}"
            pes = get_paper_entities(p.paper_id)
            for pe in pes:
                entity_node = entity_id_to_node.get(pe["id"])
                if entity_node:
                    self.graph.add_edge(
                        paper_node,
                        entity_node,
                        relation=pe["relation"],
                        context=pe.get("context", ""),
                    )

        logger.info(
            "Graph rebuilt: %d nodes, %d edges",
            self.graph.number_of_nodes(),
            self.graph.number_of_edges(),
        )

    def get_citation_graph(self) -> dict:
        """Return full citation graph (paper nodes + CITES edges only)."""
        nodes = []
        for node_id, data in self.graph.nodes(data=True):
            if data.get("kind") == "Paper":
                nodes.append({
                    "id": node_id,
                    "kind": "Paper",
                    "label": data.get("title", data.get("paper_id", node_id)),
                    "paper_id": data.get("paper_id", ""),
                })

        edges = []
        for u, v, data in self.graph.edges(data=True):
            if data.get("relation") == "CITES":
                edges.append({"source": u, "target": v, "relation": "CITES"})

        return {"nodes": nodes, "edges": edges}

    def get_entity_graph(self) -> dict:
        """Return full entity graph (all nodes + non-CITES edges)."""
        nodes = []
        for node_id, data in self.graph.nodes(data=True):
            if data.get("kind") == "Paper":
                nodes.append({
                    "id": node_id,
                    "kind": "Paper",
                    "label": data.get("title", data.get("paper_id", node_id)),
                    "paper_id": data.get("paper_id", ""),
                })
            else:
                nodes.append({
                    "id": node_id,
                    "kind": data.get("kind", "Entity"),
                    "label": data.get("name", node_id),
                    "description": data.get("description", ""),
                })

        edges = []
        for u, v, data in self.graph.edges(data=True):
            rel = data.get("relation", "")
            if rel != "CITES":
                edges.append({
                    "source": u,
                    "target": v,
                    "relation": rel,
                })

        return {"nodes": nodes, "edges": edges}

    def get_paper_citations(self, paper_id: str, direction: str = "outgoing") -> list[dict]:
        """Get papers cited by / citing this paper."""
        paper_node = f"paper:{paper_id}"
        if not self.graph.has_node(paper_node):
            return []

        if direction == "outgoing":
            neighbors = [
                n for n in self.graph.successors(paper_node)
                if self.graph.nodes[n].get("kind") == "Paper"
                and self.graph.edges[paper_node, n].get("relation") == "CITES"
            ]
        else:
            neighbors = [
                n for n in self.graph.predecessors(paper_node)
                if self.graph.nodes[n].get("kind") == "Paper"
                and self.graph.edges[n, paper_node].get("relation") == "CITES"
            ]

        return [
            {
                "paper_id": self.graph.nodes[n].get("paper_id", ""),
                "title": self.graph.nodes[n].get("title", ""),
            }
            for n in neighbors
        ]

    def get_network(self, paper_id: str, depth: int = 2, max_nodes: int = 100) -> dict:
        """Return N-hop subgraph as {nodes, edges}."""
        paper_node = f"paper:{paper_id}"
        if not self.graph.has_node(paper_node):
            return {"nodes": [], "edges": []}

        # Use ego_graph on undirected view for N-hop neighborhood
        undirected = self.graph.to_undirected()
        subgraph = nx.ego_graph(undirected, paper_node, radius=depth)

        # Limit nodes
        nodes_list = list(subgraph.nodes)[:max_nodes]
        subgraph = subgraph.subgraph(nodes_list)

        nodes = []
        for n in subgraph.nodes:
            data = dict(self.graph.nodes[n])
            data["id"] = n
            nodes.append(data)

        edges = []
        # Use directed edges from original graph within the subgraph
        for u, v, data in self.graph.edges(data=True):
            if u in subgraph.nodes and v in subgraph.nodes:
                edges.append({
                    "source": u,
                    "target": v,
                    "relation": data.get("relation", ""),
                })

        return {"nodes": nodes, "edges": edges}

    def get_papers_for_entities(self, entity_names: list[str]) -> list[dict]:
        """Find papers connected to any of the given entity names.

        Returns papers with their graph context (which entities matched and how).
        """
        results: dict[str, dict] = {}

        for name in entity_names:
            # Try to find entity node by normalized name
            for node_id, data in self.graph.nodes(data=True):
                if data.get("kind", "") == "Paper":
                    continue
                if data.get("normalized_name", "") == name.lower():
                    # Find papers connected to this entity
                    for pred in self.graph.predecessors(node_id):
                        if self.graph.nodes[pred].get("kind") == "Paper":
                            pid = self.graph.nodes[pred].get("paper_id", "")
                            edge_data = self.graph.edges[pred, node_id]
                            if pid not in results:
                                results[pid] = {
                                    "paper_id": pid,
                                    "title": self.graph.nodes[pred].get("title", ""),
                                    "connections": [],
                                }
                            results[pid]["connections"].append(
                                f"{edge_data.get('relation', 'RELATED')} {data.get('name', name)}"
                            )

        return list(results.values())

