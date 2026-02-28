import sqlite3
from pathlib import Path

from research_owl.models import ImageInfo, PaperMetadata, PaperStatus

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
    _conn.execute(_CREATE_PAPERS_TABLE)
    _conn.execute(_CREATE_IMAGES_TABLE)
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
            url=f"/static/images/{paper_id}/{r['filename']}",
            page_number=r["page_number"],
            caption=r["caption"],
        )
        for r in rows
    ]
