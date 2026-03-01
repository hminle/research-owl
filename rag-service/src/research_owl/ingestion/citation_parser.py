"""Extract arxiv citation IDs from paper text.

Scans the references/bibliography section of a paper for arxiv IDs
so they can be injected as citation edges in the knowledge graph.
"""

from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

ARXIV_ID_PATTERN = re.compile(
    r"""
    (?:arxiv[:\s./]+|arxiv\.org/(?:abs|pdf)/)  # arxiv prefix variants
    (\d{4}\.\d{4,5})                            # capture the ID (e.g. 2408.09869)
    """,
    re.IGNORECASE | re.VERBOSE,
)

BARE_ARXIV_PATTERN = re.compile(r"\b(\d{4}\.\d{4,5})\b")


def extract_references_section(full_text: str) -> str:
    """Extract the references/bibliography section from markdown text."""
    patterns = [
        r"(?:^|\n)#+\s*References?\s*\n",
        r"(?:^|\n)#+\s*Bibliography\s*\n",
        r"(?:^|\n)\*\*References?\*\*\s*\n",
        r"(?:^|\n)References?\s*\n={3,}",
    ]

    for pattern in patterns:
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            return full_text[match.start() :]

    lower = full_text.lower()
    idx = lower.rfind("\nreferences\n")
    if idx == -1:
        idx = lower.rfind("\nreferences ")
    if idx != -1:
        return full_text[idx:]

    return ""


def extract_arxiv_ids(text: str) -> list[str]:
    """Extract unique arxiv IDs from text, preferring explicit arxiv mentions."""
    ids: set[str] = set()

    for match in ARXIV_ID_PATTERN.finditer(text):
        ids.add(match.group(1))

    if not ids:
        for match in BARE_ARXIV_PATTERN.finditer(text):
            candidate = match.group(1)
            year = int(candidate[:2])
            if 6 <= year <= 30:
                ids.add(candidate)

    return sorted(ids)


def parse_citations(full_text: str, exclude_id: str | None = None) -> list[dict]:
    """Parse citations from paper text, returning arxiv IDs found in references.

    Args:
        full_text: Full markdown text of the paper.
        exclude_id: The paper's own arxiv ID (to avoid self-citation).

    Returns:
        List of dicts with key 'arxiv_id'.
    """
    refs_section = extract_references_section(full_text)

    if refs_section:
        arxiv_ids = extract_arxiv_ids(refs_section)
    else:
        arxiv_ids = extract_arxiv_ids(full_text)

    if exclude_id:
        arxiv_ids = [aid for aid in arxiv_ids if aid != exclude_id]

    citations = [{"arxiv_id": aid} for aid in arxiv_ids]

    logger.info(
        "Extracted %d arxiv citation IDs (refs_section=%d chars)",
        len(citations),
        len(refs_section),
    )
    return citations
