"""Generate architecture diagram PNGs for the JOSS paper."""

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import numpy as np


def draw_rounded_box(ax, x, y, w, h, label, sublabel="", color="#e0e7ff",
                     edgecolor="#6366f1", fontsize=10, sublabel_fontsize=8):
    """Draw a rounded rectangle with label."""
    box = FancyBboxPatch(
        (x - w/2, y - h/2), w, h,
        boxstyle="round,pad=0.1",
        facecolor=color, edgecolor=edgecolor, linewidth=1.5,
    )
    ax.add_patch(box)
    if sublabel:
        ax.text(x, y + 0.15, label, ha="center", va="center",
                fontsize=fontsize, fontweight="bold", color="#1e293b")
        ax.text(x, y - 0.2, sublabel, ha="center", va="center",
                fontsize=sublabel_fontsize, color="#64748b", style="italic")
    else:
        ax.text(x, y, label, ha="center", va="center",
                fontsize=fontsize, fontweight="bold", color="#1e293b")


def draw_arrow(ax, x1, y1, x2, y2, label="", color="#94a3b8", style="->,head_width=0.15,head_length=0.1",
               dashed=False):
    """Draw an arrow between two points."""
    ls = "--" if dashed else "-"
    ax.annotate(
        "", xy=(x2, y2), xytext=(x1, y1),
        arrowprops=dict(arrowstyle="->", color=color, lw=1.5,
                        linestyle=ls, shrinkA=8, shrinkB=8),
    )
    if label:
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        ax.text(mx, my + 0.15, label, ha="center", va="center",
                fontsize=7.5, color="#64748b",
                bbox=dict(boxstyle="round,pad=0.15", facecolor="white",
                          edgecolor="none", alpha=0.9))


# Color palette
BLUE = ("#dbeafe", "#3b82f6")      # services
EMERALD = ("#d1fae5", "#10b981")   # storage
VIOLET = ("#ede9fe", "#8b5cf6")    # AI/LLM
AMBER = ("#fef3c7", "#f59e0b")     # modules
ROSE = ("#ffe4e6", "#f43f5e")      # external
SKY = ("#e0f2fe", "#0ea5e9")       # tools
GRAY = ("#f1f5f9", "#64748b")      # user
ORANGE = ("#ffedd5", "#f97316")    # agents


# ──────────────────────────────────────────────────────────────
# Figure 1: System Overview
# ──────────────────────────────────────────────────────────────
def fig_system_overview():
    fig, ax = plt.subplots(1, 1, figsize=(10, 4.5))
    ax.set_xlim(-1, 11)
    ax.set_ylim(0, 4)
    ax.set_aspect("equal")
    ax.axis("off")

    # User
    draw_rounded_box(ax, 0.5, 2, 1.8, 1.0, "User", "Browser", GRAY[0], GRAY[1])
    # Webapp
    draw_rounded_box(ax, 3.2, 2, 2.0, 1.0, "Next.js Webapp", "Port 3000", BLUE[0], BLUE[1])
    # RAG Service
    draw_rounded_box(ax, 6.2, 2, 2.2, 1.0, "RAG Service", "FastAPI · Port 8000", VIOLET[0], VIOLET[1])
    # Storage
    draw_rounded_box(ax, 9.5, 3.2, 1.8, 0.8, "Qdrant", "Vector DB", EMERALD[0], EMERALD[1], fontsize=9)
    draw_rounded_box(ax, 9.5, 2, 1.8, 0.8, "SQLite", "Metadata", EMERALD[0], EMERALD[1], fontsize=9)
    draw_rounded_box(ax, 9.5, 0.8, 1.8, 0.8, "Knowledge\nGraph", "NetworkX", EMERALD[0], EMERALD[1], fontsize=9)

    # Arrows
    draw_arrow(ax, 1.4, 2, 2.2, 2, "HTTP")
    draw_arrow(ax, 4.2, 2, 5.1, 2, "API Proxy")
    draw_arrow(ax, 7.3, 2.4, 8.6, 3.2, "Vectors")
    draw_arrow(ax, 7.3, 2, 8.6, 2, "Metadata")
    draw_arrow(ax, 7.3, 1.6, 8.6, 0.8, "Traverse")


    fig.tight_layout()
    fig.savefig("paper/figures/system-overview.png", dpi=200, bbox_inches="tight",
                pad_inches=0.05, facecolor="white", edgecolor="none")
    plt.close(fig)
    print("Generated: system-overview.png")


# ──────────────────────────────────────────────────────────────
# Figure 2: Ingestion Pipeline
# ──────────────────────────────────────────────────────────────
def fig_ingestion_pipeline():
    fig, ax = plt.subplots(1, 1, figsize=(12, 5.5))
    ax.set_xlim(-0.5, 12)
    ax.set_ylim(-0.5, 4.8)
    ax.set_aspect("equal")
    ax.axis("off")

    # Input
    draw_rounded_box(ax, 0.8, 4, 1.6, 0.8, "ArXiv URL", "", GRAY[0], GRAY[1], fontsize=9)
    # API
    draw_rounded_box(ax, 3, 4, 1.8, 0.8, "FastAPI /ingest", "", BLUE[0], BLUE[1], fontsize=9)
    # Step 1
    draw_rounded_box(ax, 5.8, 4, 2.0, 0.8, "① Download PDF", "", AMBER[0], AMBER[1], fontsize=9)
    # Step 2
    draw_rounded_box(ax, 9, 4, 2.2, 0.8, "② Extract Text", "Docling", AMBER[0], AMBER[1], fontsize=9)

    # Branch down from step 2
    # Step 3
    draw_rounded_box(ax, 2.5, 2, 2.2, 0.8, "③ Embed Chunks", "OpenAI embeddings", VIOLET[0], VIOLET[1], fontsize=9)
    # Step 4
    draw_rounded_box(ax, 5.5, 2, 2.2, 0.8, "④ Extract Entities", "GPT-4o-mini", VIOLET[0], VIOLET[1], fontsize=9)
    # Step 5
    draw_rounded_box(ax, 8.5, 2, 2.2, 0.8, "⑤ Parse Citations", "Regex + LLM", AMBER[0], AMBER[1], fontsize=9)
    # Step 6
    draw_rounded_box(ax, 11, 2, 1.8, 0.8, "⑥ Images", "", AMBER[0], AMBER[1], fontsize=9)

    # Storage
    draw_rounded_box(ax, 2.5, 0.3, 1.6, 0.7, "Qdrant", "", EMERALD[0], EMERALD[1], fontsize=9)
    draw_rounded_box(ax, 6, 0.3, 1.6, 0.7, "SQLite", "", EMERALD[0], EMERALD[1], fontsize=9)
    draw_rounded_box(ax, 9.5, 0.3, 2.0, 0.7, "Knowledge\nGraph", "", EMERALD[0], EMERALD[1], fontsize=9)

    # Arrows top row
    draw_arrow(ax, 1.6, 4, 2.1, 4, "POST")
    draw_arrow(ax, 3.9, 4, 4.8, 4)
    draw_arrow(ax, 6.8, 4, 7.9, 4, "PDF")

    # Arrows from extract down
    draw_arrow(ax, 8.2, 3.6, 2.5, 2.4)
    draw_arrow(ax, 9, 3.6, 5.5, 2.4)
    draw_arrow(ax, 9.5, 3.6, 8.5, 2.4)
    draw_arrow(ax, 10, 3.6, 11, 2.4)

    # Arrows to storage
    draw_arrow(ax, 2.5, 1.6, 2.5, 0.7)
    draw_arrow(ax, 5.5, 1.6, 6, 0.7)
    draw_arrow(ax, 8.5, 1.6, 6.5, 0.7)
    draw_arrow(ax, 11, 1.6, 7, 0.7, "", dashed=True)
    draw_arrow(ax, 7, 0.3, 8.5, 0.3, "rebuild", dashed=True)


    fig.tight_layout()
    fig.savefig("paper/figures/ingestion-pipeline.png", dpi=200, bbox_inches="tight",
                pad_inches=0.05, facecolor="white", edgecolor="none")
    plt.close(fig)
    print("Generated: ingestion-pipeline.png")


# ──────────────────────────────────────────────────────────────
# Figure 3: Hybrid Retrieval (Chat Flow)
# ──────────────────────────────────────────────────────────────
def fig_hybrid_retrieval():
    fig, ax = plt.subplots(1, 1, figsize=(10, 6))
    ax.set_xlim(-0.5, 10)
    ax.set_ylim(-0.5, 6.5)
    ax.set_aspect("equal")
    ax.axis("off")

    # User query
    draw_rounded_box(ax, 1.2, 5.5, 2.0, 0.7, "User Query", "", GRAY[0], GRAY[1], fontsize=9)

    # Chat Agent
    draw_rounded_box(ax, 4.5, 5.5, 2.2, 0.7, "Chat Agent", "ToolLoopAgent", VIOLET[0], VIOLET[1], fontsize=9)

    # Hybrid Retriever
    draw_rounded_box(ax, 4.5, 4, 2.5, 0.8, "Hybrid Retriever", "RRF Fusion", ORANGE[0], ORANGE[1], fontsize=9)

    # Two branches
    # Entity matching
    draw_rounded_box(ax, 2, 2.5, 2.0, 0.7, "Entity Match", "Substring search", SKY[0], SKY[1], fontsize=9)
    # Graph traversal
    draw_rounded_box(ax, 2, 1.3, 2.0, 0.7, "Graph Traverse", "NetworkX", SKY[0], SKY[1], fontsize=9)
    # Scoped vector search
    draw_rounded_box(ax, 5, 2.5, 2.2, 0.7, "Scoped Search", "Graph papers", AMBER[0], AMBER[1], fontsize=9)
    # Global vector search
    draw_rounded_box(ax, 8, 2.5, 2.0, 0.7, "Global Search", "All papers", AMBER[0], AMBER[1], fontsize=9)

    # Storage
    draw_rounded_box(ax, 2, 0, 1.5, 0.6, "SQLite", "", EMERALD[0], EMERALD[1], fontsize=9)
    draw_rounded_box(ax, 5, 0, 1.5, 0.6, "Qdrant", "", EMERALD[0], EMERALD[1], fontsize=9)
    draw_rounded_box(ax, 8, 0, 2.0, 0.6, "Knowledge\nGraph", "", EMERALD[0], EMERALD[1], fontsize=9)

    # LLM
    draw_rounded_box(ax, 8, 5.5, 1.8, 0.7, "LLM", "Gemini / GPT / Claude", VIOLET[0], VIOLET[1], fontsize=9)

    # Arrows
    draw_arrow(ax, 2.2, 5.5, 3.4, 5.5)
    draw_arrow(ax, 4.5, 5.1, 4.5, 4.4, "tool call")
    draw_arrow(ax, 5.6, 5.5, 7.1, 5.5, "reason")

    draw_arrow(ax, 3.5, 3.6, 2.2, 2.9)
    draw_arrow(ax, 4.5, 3.6, 5, 2.9)
    draw_arrow(ax, 5.5, 3.6, 8, 2.9)

    draw_arrow(ax, 2, 2.1, 2, 1.7)
    draw_arrow(ax, 2, 0.9, 2, 0.3)
    draw_arrow(ax, 5, 2.1, 5, 0.3)
    draw_arrow(ax, 8, 2.1, 8, 0.6)
    draw_arrow(ax, 3, 1.3, 7, 0.6, "", dashed=True)


    fig.tight_layout()
    fig.savefig("paper/figures/hybrid-retrieval.png", dpi=200, bbox_inches="tight",
                pad_inches=0.05, facecolor="white", edgecolor="none")
    plt.close(fig)
    print("Generated: hybrid-retrieval.png")


# ──────────────────────────────────────────────────────────────
# Figure 4: Multi-Agent Research System
# ──────────────────────────────────────────────────────────────
def fig_multi_agent():
    fig, ax = plt.subplots(1, 1, figsize=(11, 6))
    ax.set_xlim(-0.5, 10.5)
    ax.set_ylim(0.4, 5.7)
    ax.set_aspect("equal")
    ax.axis("off")

    # User
    draw_rounded_box(ax, 1, 5, 1.8, 0.7, "User", "", GRAY[0], GRAY[1], fontsize=9)
    # Orchestrator
    draw_rounded_box(ax, 4.5, 5, 2.5, 0.8, "Orchestrator", "Research Director", VIOLET[0], VIOLET[1], fontsize=9)
    # LLM
    draw_rounded_box(ax, 8.5, 5, 1.8, 0.7, "LLM", "Gemini / GPT / Claude", VIOLET[0], VIOLET[1], fontsize=9)

    # Sub-agents
    draw_rounded_box(ax, 1.5, 3, 2.0, 0.8, "KB Review\nAgent", "", ORANGE[0], ORANGE[1], fontsize=9)
    draw_rounded_box(ax, 4, 3, 2.0, 0.8, "Web Scout\nAgent", "", ORANGE[0], ORANGE[1], fontsize=9)
    draw_rounded_box(ax, 6.5, 3, 2.0, 0.8, "Research\nPlanner", "", ORANGE[0], ORANGE[1], fontsize=9)
    draw_rounded_box(ax, 9, 3, 2.0, 0.8, "Synthesis\nAgent", "", ORANGE[0], ORANGE[1], fontsize=9)

    # Tools
    draw_rounded_box(ax, 1.5, 1, 1.8, 0.6, "hybrid_search", "", SKY[0], SKY[1], fontsize=8)
    draw_rounded_box(ax, 4, 1, 1.8, 0.6, "search_arxiv", "", SKY[0], SKY[1], fontsize=8)
    draw_rounded_box(ax, 6.5, 1, 1.8, 0.6, "search_web", "", SKY[0], SKY[1], fontsize=8)
    draw_rounded_box(ax, 9, 1, 1.8, 0.6, "show_image", "", SKY[0], SKY[1], fontsize=8)

    # Arrows
    draw_arrow(ax, 1.9, 5, 3.25, 5, "query")
    draw_arrow(ax, 5.75, 5, 7.6, 5, "reason")

    draw_arrow(ax, 3.5, 4.6, 1.5, 3.4, "①")
    draw_arrow(ax, 4.2, 4.6, 4, 3.4, "②")
    draw_arrow(ax, 5, 4.6, 6.5, 3.4, "③")
    draw_arrow(ax, 5.5, 4.6, 9, 3.4, "④")

    draw_arrow(ax, 1.5, 2.6, 1.5, 1.3)
    draw_arrow(ax, 4, 2.6, 4, 1.3)
    draw_arrow(ax, 6.5, 2.6, 6.5, 1.3)
    draw_arrow(ax, 9, 2.6, 9, 1.3)


    fig.tight_layout()
    fig.savefig("paper/figures/multi-agent.png", dpi=200, bbox_inches="tight",
                pad_inches=0.05, facecolor="white", edgecolor="none")
    plt.close(fig)
    print("Generated: multi-agent.png")


if __name__ == "__main__":
    import os
    os.makedirs("paper/figures", exist_ok=True)
    fig_system_overview()
    fig_ingestion_pipeline()
    fig_hybrid_retrieval()
    fig_multi_agent()
    print("All figures generated.")
