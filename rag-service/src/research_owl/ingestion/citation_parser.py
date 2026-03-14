"""Extract citations from paper references using LLM.

Parses the references/bibliography section of a paper to extract
paper titles and optional arxiv IDs, so they can be stored as
citation edges in the knowledge graph.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re

from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

ARXIV_ID_PATTERN = re.compile(
    r"""
    (?:arxiv[:\s./]+|arxiv\.org/(?:abs|pdf)/)  # arxiv prefix variants
    (\d{4}\.\d{4,5})                            # capture the ID (e.g. 2408.09869)
    """,
    re.IGNORECASE | re.VERBOSE,
)

BARE_ARXIV_PATTERN = re.compile(r"\b(\d{4}\.\d{4,5})\b")


_CITATION_SYSTEM = """You are an expert at parsing academic paper references.
Given a references section from a research paper, extract each reference as a structured entry.

Output ONLY a valid JSON array:
[
  {"title": "Full paper title", "arxiv_id": "YYMM.NNNNN or null"}
]

Rules:
- Extract the EXACT title of each referenced paper as written
- If an arxiv ID is present (format: YYMM.NNNNN, e.g. 2408.09869), include it
- If no arxiv ID is found for a reference, set arxiv_id to null
- Include ALL references, not just those with arxiv IDs
- Do NOT include the citing paper itself
- Keep titles verbatim — do not paraphrase or shorten"""


def title_to_cited_id(title: str) -> str:
    """Generate a stable cited_id from a paper title."""
    normalized = re.sub(r"\s+", " ", title.strip().lower())
    return "ref:" + hashlib.sha256(normalized.encode()).hexdigest()[:12]


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


def _parse_json_array(text: str) -> list[dict]:
    """Parse a JSON array from LLM response, handling code fences."""
    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if match:
        text = match.group(1)
    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
        return []
    except json.JSONDecodeError:
        match = re.search(r"\[.*\]", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                return []
        return []


async def parse_citations_llm(
    full_text: str,
    exclude_id: str | None,
    openai_client: AsyncOpenAI,
    model: str,
) -> list[dict]:
    """Parse citations from paper text using LLM.

    Returns list of dicts with keys:
        - cited_id: arxiv ID (if available) or generated ID from title
        - title: the paper title
    """
    refs_section = extract_references_section(full_text)
    if not refs_section:
        logger.info("No references section found, skipping LLM citation parsing")
        return []

    # Truncate to avoid token limits (references section only)
    truncated_refs = refs_section[:8000]

    try:
        response = await openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _CITATION_SYSTEM},
                {"role": "user", "content": f"Parse the following references:\n\n{truncated_refs}"},
            ],
            max_tokens=4000,
            temperature=0.0,
        )

        raw = response.choices[0].message.content or ""
        entries = _parse_json_array(raw)

        citations = []
        for entry in entries:
            title = entry.get("title", "").strip()
            if not title:
                continue

            arxiv_id = entry.get("arxiv_id")
            if arxiv_id and not re.match(r"^\d{4}\.\d{4,5}$", str(arxiv_id)):
                arxiv_id = None

            if arxiv_id and arxiv_id == exclude_id:
                continue

            cited_id = str(arxiv_id) if arxiv_id else title_to_cited_id(title)
            citations.append({"cited_id": cited_id, "title": title})

        logger.info(
            "LLM extracted %d citations (refs_section=%d chars)",
            len(citations),
            len(refs_section),
        )
        return citations

    except Exception:
        logger.exception("LLM citation parsing failed, falling back to regex")
        return _parse_citations_regex(full_text, exclude_id)


def _parse_citations_regex(
    full_text: str, exclude_id: str | None = None
) -> list[dict]:
    """Fallback: parse citations using regex (arxiv IDs only)."""
    refs_section = extract_references_section(full_text)

    if refs_section:
        arxiv_ids = extract_arxiv_ids(refs_section)
    else:
        arxiv_ids = extract_arxiv_ids(full_text)

    if exclude_id:
        arxiv_ids = [aid for aid in arxiv_ids if aid != exclude_id]

    return [{"cited_id": aid, "title": aid} for aid in arxiv_ids]


def parse_citations(full_text: str, exclude_id: str | None = None) -> list[dict]:
    """Synchronous regex-only citation parsing (legacy fallback).

    Returns list of dicts with key 'arxiv_id' for backward compat.
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
