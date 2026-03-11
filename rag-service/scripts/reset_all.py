#!/usr/bin/env python3
"""Reset all data: drop and recreate SQLite tables, delete Qdrant collection,
and remove parsed image files.

Usage:
    cd rag-service
    python -m scripts.reset_all          # interactive confirmation
    python -m scripts.reset_all --yes    # skip confirmation
"""

import argparse
import shutil
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from research_owl.config import settings
from research_owl.db import init_db, _get_conn

QDRANT_COLLECTION = "research_owl"

TABLES_TO_CLEAR = [
    "images",
    "paper_entities",
    "citations",
    "eval_items",
    "eval_runs",
    "eval_datasets",
    "papers",
]


def reset_sqlite() -> None:
    db_path = settings.db_path
    if not db_path.exists():
        print(f"  No database at {db_path}, nothing to clear.")
        return

    init_db(db_path)
    conn = _get_conn()
    for table in TABLES_TO_CLEAR:
        try:
            conn.execute(f"DELETE FROM {table}")
            print(f"  Cleared table: {table}")
        except Exception as exc:
            print(f"  Skipped table {table}: {exc}")
    conn.commit()
    print("  SQLite reset complete.")


def reset_qdrant() -> None:
    url = settings.qdrant_url.rstrip("/")
    try:
        resp = httpx.delete(f"{url}/collections/{QDRANT_COLLECTION}", timeout=10)
        if resp.status_code == 200:
            print(f"  Deleted Qdrant collection '{QDRANT_COLLECTION}'.")
        else:
            print(f"  Qdrant responded {resp.status_code}: {resp.text}")
    except httpx.ConnectError:
        print(f"  Could not connect to Qdrant at {url}. Is it running?")


def reset_parsed_files() -> None:
    parsed_dir = settings.parsed_dir
    if not parsed_dir.exists():
        print("  No parsed directory found.")
        return
    count = 0
    for child in parsed_dir.iterdir():
        if child.is_dir():
            shutil.rmtree(child)
            count += 1
        else:
            child.unlink()
            count += 1
    print(f"  Removed {count} items from {parsed_dir}.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset all Research Owl data.")
    parser.add_argument("--yes", "-y", action="store_true", help="Skip confirmation prompt.")
    args = parser.parse_args()

    if not args.yes:
        answer = input(
            "This will DELETE all papers, images, eval data, Qdrant vectors, "
            "and parsed files.\nContinue? [y/N] "
        )
        if answer.strip().lower() not in ("y", "yes"):
            print("Aborted.")
            return

    print("\n[1/3] Resetting SQLite database...")
    reset_sqlite()

    print("\n[2/3] Resetting Qdrant collection...")
    reset_qdrant()

    print("\n[3/3] Cleaning parsed files...")
    reset_parsed_files()

    print("\nAll data has been reset.")


if __name__ == "__main__":
    main()
