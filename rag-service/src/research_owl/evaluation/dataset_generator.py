"""Generate Q&A evaluation datasets from ingested papers using an LLM."""

from __future__ import annotations

import json
import logging
from pathlib import Path

from openai import AsyncOpenAI

from research_owl.config import settings

logger = logging.getLogger(__name__)

_QA_SYSTEM_PROMPT = """\
You are an expert at creating evaluation question-answer pairs from academic papers.
Given a section of a research paper, generate diverse Q&A pairs that test understanding of the content.

Rules:
- Questions should be specific and answerable from the provided text
- Answers should be concise but complete
- Cover different aspects: methodology, results, concepts, comparisons
- Output valid JSON array of objects with "question" and "ground_truth" keys
- Generate exactly {num_questions} Q&A pairs
"""

_QA_USER_PROMPT = """\
Generate {num_questions} question-answer pairs from the following paper text.
Return ONLY a JSON array, no other text.

Paper text:
{text}
"""


def _chunk_text(text: str, max_chars: int = 12000) -> list[str]:
    """Split text into chunks that fit within token limits."""
    if len(text) <= max_chars:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        end = start + max_chars
        # Try to break at a paragraph boundary
        if end < len(text):
            newline_pos = text.rfind("\n\n", start, end)
            if newline_pos > start:
                end = newline_pos
        chunks.append(text[start:end])
        start = end
    return chunks


async def generate_qa_pairs(
    paper_id: str,
    paper_text: str | None = None,
    num_questions: int = 10,
) -> list[dict]:
    """Generate Q&A pairs from a paper's text.

    If paper_text is not provided, attempts to read from parsed output directory.
    """
    if not paper_text:
        paper_text = _load_paper_text(paper_id)

    if not paper_text:
        raise ValueError(f"No text available for paper {paper_id}")

    client = AsyncOpenAI(
        api_key=settings.ai_gateway_api_key,
        base_url=settings.ai_gateway_base_url,
    )

    chunks = _chunk_text(paper_text)
    all_pairs: list[dict] = []
    remaining = num_questions

    for chunk in chunks:
        if remaining <= 0:
            break

        to_generate = min(remaining, max(3, num_questions // len(chunks)))

        try:
            response = await client.chat.completions.create(
                model=settings.llm_model,
                messages=[
                    {"role": "system", "content": _QA_SYSTEM_PROMPT.format(num_questions=to_generate)},
                    {"role": "user", "content": _QA_USER_PROMPT.format(num_questions=to_generate, text=chunk[:12000])},
                ],
                temperature=0.7,
            )

            content = response.choices[0].message.content or "[]"
            # Strip markdown code fences if present
            content = content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1] if "\n" in content else content[3:]
                if content.endswith("```"):
                    content = content[:-3]
                content = content.strip()
            parsed = json.loads(content)

            # Handle both {"pairs": [...]} and [...] formats
            if isinstance(parsed, dict):
                pairs = parsed.get("pairs") or parsed.get("questions") or parsed.get("qa_pairs") or []
                if not pairs:
                    # Try first list value in dict
                    for v in parsed.values():
                        if isinstance(v, list):
                            pairs = v
                            break
            elif isinstance(parsed, list):
                pairs = parsed
            else:
                pairs = []

            for pair in pairs:
                if isinstance(pair, dict) and "question" in pair and "ground_truth" in pair:
                    all_pairs.append({
                        "question": pair["question"],
                        "ground_truth": pair["ground_truth"],
                    })
                    remaining -= 1

        except Exception:
            logger.exception("Failed to generate Q&A from chunk for paper %s", paper_id)
            continue

    logger.info("Generated %d Q&A pairs for paper %s", len(all_pairs), paper_id)
    return all_pairs[:num_questions]


def _load_paper_text(paper_id: str) -> str | None:
    """Try to load paper text from the parsed output directory."""
    parsed_dir = settings.data_dir / "parsed" / paper_id
    if not parsed_dir.exists():
        return None

    # Look for markdown files first, then text files
    for pattern in ["*.md", "*.txt"]:
        for f in sorted(parsed_dir.glob(pattern)):
            text = f.read_text(encoding="utf-8", errors="ignore")
            if len(text) > 100:
                return text

    # Fallback: parse Docling JSON output (data/parsed/{id}/{id}/docling/{id}.json)
    for json_file in sorted(parsed_dir.rglob("*.json")):
        try:
            data = json.loads(json_file.read_text(encoding="utf-8"))
            texts = data.get("texts", [])
            if not texts:
                continue
            content_parts = []
            for t in texts:
                if t.get("content_layer") != "furniture" and t.get("text"):
                    content_parts.append(t["text"])
            full_text = "\n".join(content_parts)
            if len(full_text) > 100:
                return full_text
        except (json.JSONDecodeError, KeyError):
            continue

    return None


def get_paper_text(paper_id: str) -> str | None:
    """Get paper text, trying parsed output first, then re-extracting."""
    text = _load_paper_text(paper_id)
    if text:
        return text

    # Fallback: re-extract from PDF
    pdf_path = settings.data_dir / "pdfs" / f"{paper_id}.pdf"
    if pdf_path.exists():
        try:
            from research_owl.ingestion.pipeline import extract_text_and_figures
            _title, full_text, _num_images = extract_text_and_figures(pdf_path)
            return full_text
        except Exception:
            logger.exception("Failed to re-extract text for paper %s", paper_id)

    return None
