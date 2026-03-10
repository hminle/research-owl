import json
import sqlite3
import uuid
from pathlib import Path

from research_owl.models import (
    EvalDataset,
    EvalDatasetDetail,
    EvalItem,
    EvalItemResult,
    EvalRun,
    EvalRunDetail,
    EvalRunStatus,
    EvalTrendPoint,
    ImageInfo,
    PaperMetadata,
    PaperStatus,
)

_CREATE_PAPERS_TABLE = """
CREATE TABLE IF NOT EXISTS papers (
    paper_id    TEXT PRIMARY KEY,
    arxiv_url   TEXT NOT NULL,
    title       TEXT,
    status      TEXT NOT NULL DEFAULT 'pending',
    num_chunks  INTEGER NOT NULL DEFAULT 0,
    num_images  INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
"""

_CREATE_IMAGES_TABLE = """
CREATE TABLE IF NOT EXISTS images (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    paper_id    TEXT NOT NULL REFERENCES papers(paper_id),
    filename    TEXT NOT NULL,
    page_number INTEGER,
    caption     TEXT
);
"""

_CREATE_EVAL_DATASETS_TABLE = """
CREATE TABLE IF NOT EXISTS eval_datasets (
    dataset_id  TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    paper_ids   TEXT NOT NULL DEFAULT '[]',
    num_items   INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
"""

_CREATE_EVAL_ITEMS_TABLE = """
CREATE TABLE IF NOT EXISTS eval_items (
    item_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset_id  TEXT NOT NULL REFERENCES eval_datasets(dataset_id) ON DELETE CASCADE,
    question    TEXT NOT NULL,
    ground_truth TEXT NOT NULL,
    metadata    TEXT NOT NULL DEFAULT '{}',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
"""

_CREATE_EVAL_RUNS_TABLE = """
CREATE TABLE IF NOT EXISTS eval_runs (
    run_id              TEXT PRIMARY KEY,
    dataset_id          TEXT NOT NULL REFERENCES eval_datasets(dataset_id),
    status              TEXT NOT NULL DEFAULT 'pending',
    query_mode          TEXT NOT NULL DEFAULT 'mix',
    correctness         REAL,
    factual_correctness REAL,
    num_items           INTEGER NOT NULL DEFAULT 0,
    error_message       TEXT,
    item_results        TEXT NOT NULL DEFAULT '[]',
    started_at          TEXT,
    completed_at        TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


_CREATE_CITATIONS_TABLE = """
CREATE TABLE IF NOT EXISTS citations (
    citing_id TEXT NOT NULL,
    cited_id  TEXT NOT NULL,
    PRIMARY KEY (citing_id, cited_id)
);
"""

_CREATE_ENTITIES_TABLE = """
CREATE TABLE IF NOT EXISTS entities (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    type            TEXT NOT NULL,
    name            TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    description     TEXT,
    UNIQUE(type, normalized_name)
);
"""

_CREATE_PAPER_ENTITIES_TABLE = """
CREATE TABLE IF NOT EXISTS paper_entities (
    paper_id   TEXT NOT NULL,
    entity_id  INTEGER NOT NULL,
    relation   TEXT NOT NULL,
    context    TEXT,
    PRIMARY KEY (paper_id, entity_id, relation)
);
"""


def _connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn


_conn: sqlite3.Connection | None = None


def init_db(db_path: Path) -> None:
    global _conn
    db_path.parent.mkdir(parents=True, exist_ok=True)
    _conn = _connect(db_path)
    _conn.execute("PRAGMA foreign_keys = ON;")
    _conn.execute(_CREATE_PAPERS_TABLE)
    _conn.execute(_CREATE_IMAGES_TABLE)
    _conn.execute(_CREATE_EVAL_DATASETS_TABLE)
    _conn.execute(_CREATE_EVAL_ITEMS_TABLE)
    _conn.execute(_CREATE_EVAL_RUNS_TABLE)
    _conn.execute(_CREATE_CITATIONS_TABLE)
    _conn.execute(_CREATE_ENTITIES_TABLE)
    _conn.execute(_CREATE_PAPER_ENTITIES_TABLE)
    _conn.commit()


def _get_conn() -> sqlite3.Connection:
    if _conn is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return _conn


def create_paper(paper_id: str, arxiv_url: str) -> PaperMetadata:
    conn = _get_conn()
    conn.execute(
        "INSERT INTO papers (paper_id, arxiv_url, status) VALUES (?, ?, ?)",
        (paper_id, arxiv_url, PaperStatus.pending.value),
    )
    conn.commit()
    return get_paper(paper_id)  # type: ignore[return-value]


def update_paper(paper_id: str, **kwargs: object) -> PaperMetadata | None:
    conn = _get_conn()
    if not kwargs:
        return get_paper(paper_id)
    sets = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values())
    vals.append(paper_id)
    conn.execute(
        f"UPDATE papers SET {sets}, updated_at = datetime('now') WHERE paper_id = ?",
        vals,
    )
    conn.commit()
    return get_paper(paper_id)


def get_paper(paper_id: str) -> PaperMetadata | None:
    conn = _get_conn()
    row = conn.execute("SELECT * FROM papers WHERE paper_id = ?", (paper_id,)).fetchone()
    if row is None:
        return None
    return PaperMetadata(**dict(row))


def list_papers() -> list[PaperMetadata]:
    conn = _get_conn()
    rows = conn.execute("SELECT * FROM papers ORDER BY created_at DESC").fetchall()
    return [PaperMetadata(**dict(r)) for r in rows]


def resolve_paper_id(paper_id_or_name: str) -> str | None:
    """Resolve a paper_id or title to the actual paper_id.

    Returns the paper_id if found by exact ID match, or by case-insensitive
    title substring match. Returns None if no match.
    """
    conn = _get_conn()
    # Try exact ID match first
    row = conn.execute(
        "SELECT paper_id FROM papers WHERE paper_id = ?", (paper_id_or_name,)
    ).fetchone()
    if row:
        return row["paper_id"]

    # Try case-insensitive title match
    row = conn.execute(
        "SELECT paper_id FROM papers WHERE LOWER(title) LIKE '%' || LOWER(?) || '%'",
        (paper_id_or_name,),
    ).fetchone()
    if row:
        return row["paper_id"]

    return None


def save_images(paper_id: str, images: list[dict]) -> None:
    conn = _get_conn()
    conn.execute("DELETE FROM images WHERE paper_id = ?", (paper_id,))
    conn.executemany(
        "INSERT INTO images (paper_id, filename, page_number, caption) VALUES (?, ?, ?, ?)",
        [(paper_id, img["filename"], img.get("page_number"), img.get("caption")) for img in images],
    )
    conn.commit()


def get_images(paper_id: str) -> list[ImageInfo]:
    conn = _get_conn()
    rows = conn.execute(
        "SELECT filename, page_number, caption FROM images WHERE paper_id = ? ORDER BY id",
        (paper_id,),
    ).fetchall()
    return [
        ImageInfo(
            filename=r["filename"],
            url=f"/static/parsed/{paper_id}/{r['filename']}",
            page_number=r["page_number"],
            caption=r["caption"],
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Eval Datasets
# ---------------------------------------------------------------------------


def _row_to_dataset(row: sqlite3.Row) -> EvalDataset:
    d = dict(row)
    d["paper_ids"] = json.loads(d["paper_ids"])
    return EvalDataset(**d)


def create_eval_dataset(
    name: str,
    description: str = "",
    paper_ids: list[str] | None = None,
) -> EvalDataset:
    conn = _get_conn()
    dataset_id = uuid.uuid4().hex[:12]
    conn.execute(
        "INSERT INTO eval_datasets (dataset_id, name, description, paper_ids) VALUES (?, ?, ?, ?)",
        (dataset_id, name, description, json.dumps(paper_ids or [])),
    )
    conn.commit()
    return get_eval_dataset(dataset_id)  # type: ignore[return-value]


def get_eval_dataset(dataset_id: str) -> EvalDataset | None:
    conn = _get_conn()
    row = conn.execute("SELECT * FROM eval_datasets WHERE dataset_id = ?", (dataset_id,)).fetchone()
    if row is None:
        return None
    return _row_to_dataset(row)


def list_eval_datasets() -> list[EvalDataset]:
    conn = _get_conn()
    rows = conn.execute("SELECT * FROM eval_datasets ORDER BY created_at DESC").fetchall()
    return [_row_to_dataset(r) for r in rows]


def update_eval_dataset(dataset_id: str, **kwargs: object) -> EvalDataset | None:
    conn = _get_conn()
    if not kwargs:
        return get_eval_dataset(dataset_id)
    if "paper_ids" in kwargs:
        kwargs["paper_ids"] = json.dumps(kwargs["paper_ids"])
    sets = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values())
    vals.append(dataset_id)
    conn.execute(
        f"UPDATE eval_datasets SET {sets}, updated_at = datetime('now') WHERE dataset_id = ?",
        vals,
    )
    conn.commit()
    return get_eval_dataset(dataset_id)


def delete_eval_dataset(dataset_id: str) -> bool:
    conn = _get_conn()
    conn.execute("DELETE FROM eval_items WHERE dataset_id = ?", (dataset_id,))
    cur = conn.execute("DELETE FROM eval_datasets WHERE dataset_id = ?", (dataset_id,))
    conn.commit()
    return cur.rowcount > 0


def get_eval_dataset_detail(dataset_id: str) -> EvalDatasetDetail | None:
    ds = get_eval_dataset(dataset_id)
    if ds is None:
        return None
    items = list_eval_items(dataset_id)
    return EvalDatasetDetail(**ds.model_dump(), items=items)


# ---------------------------------------------------------------------------
# Eval Items
# ---------------------------------------------------------------------------


def _row_to_item(row: sqlite3.Row) -> EvalItem:
    d = dict(row)
    d["metadata"] = json.loads(d["metadata"]) if d.get("metadata") else None
    return EvalItem(**d)


def add_eval_items(dataset_id: str, items: list[dict]) -> list[EvalItem]:
    conn = _get_conn()
    created = []
    for item in items:
        cur = conn.execute(
            "INSERT INTO eval_items (dataset_id, question, ground_truth, metadata) VALUES (?, ?, ?, ?)",
            (dataset_id, item["question"], item["ground_truth"], json.dumps(item.get("metadata") or {})),
        )
        created.append(cur.lastrowid)
    # Update num_items count
    count = conn.execute("SELECT COUNT(*) FROM eval_items WHERE dataset_id = ?", (dataset_id,)).fetchone()[0]
    conn.execute("UPDATE eval_datasets SET num_items = ?, updated_at = datetime('now') WHERE dataset_id = ?", (count, dataset_id))
    conn.commit()
    return [_row_to_item(conn.execute("SELECT * FROM eval_items WHERE item_id = ?", (rid,)).fetchone()) for rid in created]


def list_eval_items(dataset_id: str) -> list[EvalItem]:
    conn = _get_conn()
    rows = conn.execute("SELECT * FROM eval_items WHERE dataset_id = ? ORDER BY item_id", (dataset_id,)).fetchall()
    return [_row_to_item(r) for r in rows]


def update_eval_item(item_id: int, **kwargs: object) -> EvalItem | None:
    conn = _get_conn()
    if not kwargs:
        row = conn.execute("SELECT * FROM eval_items WHERE item_id = ?", (item_id,)).fetchone()
        return _row_to_item(row) if row else None
    if "metadata" in kwargs:
        kwargs["metadata"] = json.dumps(kwargs["metadata"])
    sets = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values())
    vals.append(item_id)
    conn.execute(f"UPDATE eval_items SET {sets} WHERE item_id = ?", vals)
    conn.commit()
    row = conn.execute("SELECT * FROM eval_items WHERE item_id = ?", (item_id,)).fetchone()
    return _row_to_item(row) if row else None


def delete_eval_item(item_id: int) -> bool:
    conn = _get_conn()
    row = conn.execute("SELECT dataset_id FROM eval_items WHERE item_id = ?", (item_id,)).fetchone()
    if not row:
        return False
    dataset_id = row["dataset_id"]
    conn.execute("DELETE FROM eval_items WHERE item_id = ?", (item_id,))
    count = conn.execute("SELECT COUNT(*) FROM eval_items WHERE dataset_id = ?", (dataset_id,)).fetchone()[0]
    conn.execute("UPDATE eval_datasets SET num_items = ?, updated_at = datetime('now') WHERE dataset_id = ?", (count, dataset_id))
    conn.commit()
    return True


# ---------------------------------------------------------------------------
# Eval Runs
# ---------------------------------------------------------------------------


def _row_to_run(row: sqlite3.Row) -> EvalRun:
    return EvalRun(**dict(row))


def create_eval_run(dataset_id: str, query_mode: str = "mix", num_items: int = 0) -> EvalRun:
    conn = _get_conn()
    run_id = uuid.uuid4().hex[:12]
    conn.execute(
        "INSERT INTO eval_runs (run_id, dataset_id, query_mode, num_items) VALUES (?, ?, ?, ?)",
        (run_id, dataset_id, query_mode, num_items),
    )
    conn.commit()
    return get_eval_run(run_id)  # type: ignore[return-value]


def get_eval_run(run_id: str) -> EvalRun | None:
    conn = _get_conn()
    row = conn.execute("SELECT * FROM eval_runs WHERE run_id = ?", (run_id,)).fetchone()
    if row is None:
        return None
    return _row_to_run(row)


def get_eval_run_detail(run_id: str) -> EvalRunDetail | None:
    conn = _get_conn()
    row = conn.execute("SELECT * FROM eval_runs WHERE run_id = ?", (run_id,)).fetchone()
    if row is None:
        return None
    d = dict(row)
    item_results_raw = json.loads(d.pop("item_results", "[]"))
    item_results = [EvalItemResult(**ir) for ir in item_results_raw]
    return EvalRunDetail(**d, item_results=item_results)


def list_eval_runs(dataset_id: str | None = None) -> list[EvalRun]:
    conn = _get_conn()
    if dataset_id:
        rows = conn.execute("SELECT * FROM eval_runs WHERE dataset_id = ? ORDER BY created_at DESC", (dataset_id,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM eval_runs ORDER BY created_at DESC").fetchall()
    return [_row_to_run(r) for r in rows]


def update_eval_run(run_id: str, **kwargs: object) -> EvalRun | None:
    conn = _get_conn()
    if not kwargs:
        return get_eval_run(run_id)
    if "item_results" in kwargs:
        kwargs["item_results"] = json.dumps([ir.model_dump() if hasattr(ir, "model_dump") else ir for ir in kwargs["item_results"]])
    sets = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values())
    vals.append(run_id)
    conn.execute(f"UPDATE eval_runs SET {sets} WHERE run_id = ?", vals)
    conn.commit()
    return get_eval_run(run_id)


def get_eval_trends(dataset_id: str | None = None) -> list[EvalTrendPoint]:
    conn = _get_conn()
    if dataset_id:
        rows = conn.execute(
            "SELECT run_id, dataset_id, completed_at, correctness, factual_correctness "
            "FROM eval_runs WHERE status = 'completed' AND dataset_id = ? ORDER BY completed_at ASC",
            (dataset_id,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT run_id, dataset_id, completed_at, correctness, factual_correctness "
            "FROM eval_runs WHERE status = 'completed' ORDER BY completed_at ASC",
        ).fetchall()
    return [EvalTrendPoint(**dict(r)) for r in rows]


def get_eval_stats(dataset_id: str | None = None) -> dict:
    conn = _get_conn()
    total_datasets = conn.execute("SELECT COUNT(*) FROM eval_datasets").fetchone()[0]
    total_items = conn.execute("SELECT COUNT(*) FROM eval_items").fetchone()[0]
    if dataset_id:
        total_runs = conn.execute("SELECT COUNT(*) FROM eval_runs WHERE dataset_id = ?", (dataset_id,)).fetchone()[0]
    else:
        total_runs = conn.execute("SELECT COUNT(*) FROM eval_runs").fetchone()[0]
    trends = get_eval_trends(dataset_id)
    return {
        "total_datasets": total_datasets,
        "total_runs": total_runs,
        "total_items": total_items,
        "trends": trends,
    }


# ---------------------------------------------------------------------------
# Citations
# ---------------------------------------------------------------------------


def save_citations(citing_id: str, cited_ids: list[str]) -> int:
    """Store citation edges. Returns number of new citations added."""
    conn = _get_conn()
    count = 0
    for cited_id in cited_ids:
        try:
            conn.execute(
                "INSERT OR IGNORE INTO citations (citing_id, cited_id) VALUES (?, ?)",
                (citing_id, cited_id),
            )
            count += 1
        except Exception:
            pass
    conn.commit()
    return count


def get_citations(paper_id: str, direction: str = "outgoing") -> list[str]:
    """Get citation IDs. direction: 'outgoing' (this paper cites) or 'incoming' (cited by)."""
    conn = _get_conn()
    if direction == "outgoing":
        rows = conn.execute("SELECT cited_id FROM citations WHERE citing_id = ?", (paper_id,)).fetchall()
        return [r["cited_id"] for r in rows]
    else:
        rows = conn.execute("SELECT citing_id FROM citations WHERE cited_id = ?", (paper_id,)).fetchall()
        return [r["citing_id"] for r in rows]


def get_all_citations() -> list[tuple[str, str]]:
    """Get all citation edges as (citing_id, cited_id) tuples."""
    conn = _get_conn()
    rows = conn.execute("SELECT citing_id, cited_id FROM citations").fetchall()
    return [(r["citing_id"], r["cited_id"]) for r in rows]


# ---------------------------------------------------------------------------
# Entities
# ---------------------------------------------------------------------------


def upsert_entity(entity_type: str, name: str, normalized_name: str, description: str | None = None) -> int:
    """Insert or update an entity. Returns the entity ID."""
    conn = _get_conn()
    row = conn.execute(
        "SELECT id FROM entities WHERE type = ? AND normalized_name = ?",
        (entity_type, normalized_name),
    ).fetchone()
    if row:
        if description:
            conn.execute(
                "UPDATE entities SET description = ? WHERE id = ?",
                (description, row["id"]),
            )
            conn.commit()
        return row["id"]
    cur = conn.execute(
        "INSERT INTO entities (type, name, normalized_name, description) VALUES (?, ?, ?, ?)",
        (entity_type, name, normalized_name, description),
    )
    conn.commit()
    return cur.lastrowid  # type: ignore[return-value]


def add_paper_entity(paper_id: str, entity_id: int, relation: str, context: str | None = None) -> None:
    """Link a paper to an entity with a relation type."""
    conn = _get_conn()
    conn.execute(
        "INSERT OR IGNORE INTO paper_entities (paper_id, entity_id, relation, context) VALUES (?, ?, ?, ?)",
        (paper_id, entity_id, relation, context),
    )
    conn.commit()


def get_paper_entities(paper_id: str) -> list[dict]:
    """Get all entities for a paper."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT e.id, e.type, e.name, e.normalized_name, e.description, pe.relation, pe.context "
        "FROM paper_entities pe JOIN entities e ON pe.entity_id = e.id "
        "WHERE pe.paper_id = ? ORDER BY e.type, e.name",
        (paper_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_entity_papers(entity_type: str, normalized_name: str) -> list[dict]:
    """Get all papers connected to an entity."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT p.paper_id, p.title, pe.relation, pe.context "
        "FROM paper_entities pe "
        "JOIN entities e ON pe.entity_id = e.id "
        "JOIN papers p ON pe.paper_id = p.paper_id "
        "WHERE e.type = ? AND e.normalized_name = ? "
        "ORDER BY p.paper_id",
        (entity_type, normalized_name),
    ).fetchall()
    return [dict(r) for r in rows]


def search_entities(entity_type: str | None = None, query: str | None = None) -> list[dict]:
    """Search entities by type and/or name substring."""
    conn = _get_conn()
    conditions = []
    params: list[str] = []
    if entity_type:
        conditions.append("e.type = ?")
        params.append(entity_type)
    if query:
        conditions.append("e.normalized_name LIKE ?")
        params.append(f"%{query.lower()}%")
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    rows = conn.execute(
        f"SELECT e.*, COUNT(pe.paper_id) as paper_count "
        f"FROM entities e LEFT JOIN paper_entities pe ON e.id = pe.entity_id "
        f"{where} GROUP BY e.id ORDER BY paper_count DESC, e.name",
        params,
    ).fetchall()
    return [dict(r) for r in rows]


def get_papers_for_entity_names(normalized_names: list[str]) -> list[str]:
    """Get paper IDs connected to any of the given entity names."""
    if not normalized_names:
        return []
    conn = _get_conn()
    placeholders = ",".join("?" for _ in normalized_names)
    rows = conn.execute(
        f"SELECT DISTINCT pe.paper_id FROM paper_entities pe "
        f"JOIN entities e ON pe.entity_id = e.id "
        f"WHERE e.normalized_name IN ({placeholders})",
        normalized_names,
    ).fetchall()
    return [r["paper_id"] for r in rows]


def get_graph_stats() -> dict:
    """Get graph statistics."""
    conn = _get_conn()
    num_papers = conn.execute("SELECT COUNT(*) FROM papers WHERE status = 'completed'").fetchone()[0]
    num_citations = conn.execute("SELECT COUNT(*) FROM citations").fetchone()[0]
    num_entities = conn.execute("SELECT COUNT(*) FROM entities").fetchone()[0]
    num_relations = conn.execute("SELECT COUNT(*) FROM paper_entities").fetchone()[0]
    entity_types = conn.execute(
        "SELECT type, COUNT(*) as count FROM entities GROUP BY type ORDER BY count DESC"
    ).fetchall()
    return {
        "papers": num_papers,
        "citations": num_citations,
        "entities": num_entities,
        "relations": num_relations,
        "entity_types": {r["type"]: r["count"] for r in entity_types},
    }
