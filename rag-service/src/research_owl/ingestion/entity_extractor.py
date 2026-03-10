"""LLM-powered entity extraction from research papers.

Extracts structured entities (methods, datasets, metrics, models, tasks)
and their relationships to papers using OpenAI structured output.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field

from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

ENTITY_TYPES = ["Method", "Dataset", "Metric", "Model", "Task"]
RELATION_TYPES = ["PROPOSES", "USES", "EVALUATES_ON", "MEASURES", "TRAINS", "BENCHMARKS", "ADDRESSES"]

_EXTRACTION_SYSTEM = """You are an expert at extracting structured information from research papers.
Given paper text, extract:
1. Entities: methods, datasets, metrics, models, and tasks mentioned
2. Relations: how the paper relates to each entity (proposes, uses, evaluates_on, etc.)

Output ONLY a valid JSON object with this exact structure:
{
  "entities": [
    {"type": "Method|Dataset|Metric|Model|Task", "name": "exact name", "description": "1-sentence description"}
  ],
  "relations": [
    {"predicate": "PROPOSES|USES|EVALUATES_ON|MEASURES|TRAINS|BENCHMARKS|ADDRESSES", "entity_type": "Method|Dataset|Metric|Model|Task", "entity_name": "exact name matching an entity above", "context": "short evidence snippet from the paper"}
  ]
}

Rules:
- Only include entities that are clearly named in the paper
- Use the exact name as written in the paper for entity names
- Each entity should appear at least once in the relations
- Keep descriptions concise (1 sentence max)
- The context field should be a direct quote or close paraphrase (under 100 chars)
- Do NOT include generic concepts like "deep learning" or "neural network" unless the paper proposes a specific novel variant"""

_EXTRACTION_USER = """Extract entities and relations from this research paper text.

Paper text:
{text}"""

# Common aliases for normalization
_ALIASES: dict[str, str] = {
    "large language model": "llm",
    "large language models": "llm",
    "convolutional neural network": "cnn",
    "convolutional neural networks": "cnn",
    "recurrent neural network": "rnn",
    "recurrent neural networks": "rnn",
    "generative adversarial network": "gan",
    "generative adversarial networks": "gan",
    "retrieval-augmented generation": "rag",
    "retrieval augmented generation": "rag",
    "graph neural network": "gnn",
    "graph neural networks": "gnn",
}


def normalize_name(name: str) -> str:
    """Normalize entity name for deduplication."""
    n = name.strip().lower()
    # Check known aliases
    if n in _ALIASES:
        return _ALIASES[n]
    # Remove common suffixes/punctuation
    n = re.sub(r"[^\w\s-]", "", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


@dataclass
class Entity:
    type: str
    name: str
    description: str = ""


@dataclass
class Relation:
    predicate: str
    entity_type: str
    entity_name: str
    context: str = ""


@dataclass
class ExtractionResult:
    entities: list[Entity] = field(default_factory=list)
    relations: list[Relation] = field(default_factory=list)


def _extract_key_sections(full_text: str, max_chars: int = 6000) -> str:
    """Extract abstract + intro + methods + conclusion sections."""
    sections: list[str] = []
    text = full_text

    # Try to find and extract key sections by markdown headers
    section_patterns = [
        (r"(?:^|\n)#+\s*Abstract\s*\n", r"(?:^|\n)#+\s*(?:1\.?\s*)?Introduction"),
        (r"(?:^|\n)#+\s*(?:1\.?\s*)?Introduction\s*\n", r"(?:^|\n)#+\s*(?:2|3)\.?"),
        (r"(?:^|\n)#+\s*(?:Conclusion|Summary)\s*\n", r"(?:^|\n)#+\s*(?:References|Acknowledge)"),
    ]

    for start_pat, end_pat in section_patterns:
        start_match = re.search(start_pat, text, re.IGNORECASE)
        if start_match:
            end_match = re.search(end_pat, text[start_match.end():], re.IGNORECASE)
            if end_match:
                section = text[start_match.start():start_match.end() + end_match.start()]
            else:
                section = text[start_match.start():start_match.start() + 3000]
            sections.append(section.strip())

    if sections:
        combined = "\n\n".join(sections)
        return combined[:max_chars]

    # Fallback: use first N chars (likely abstract + intro)
    return text[:max_chars]


def _parse_extraction_json(text: str) -> dict:
    """Parse JSON from LLM response, handling code fences."""
    # Try to extract from code fence
    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if match:
        text = match.group(1)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON object
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group())
        return {"entities": [], "relations": []}


async def extract_entities(
    paper_id: str,
    text: str,
    openai_client: AsyncOpenAI,
    model: str,
) -> ExtractionResult:
    """Extract entities and relations from paper text using LLM."""
    key_text = _extract_key_sections(text)

    if not key_text.strip():
        logger.warning("No text to extract entities from for paper %s", paper_id)
        return ExtractionResult()

    try:
        response = await openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _EXTRACTION_SYSTEM},
                {"role": "user", "content": _EXTRACTION_USER.format(text=key_text)},
            ],
            max_tokens=2000,
            temperature=0.1,
        )

        raw = response.choices[0].message.content or ""
        data = _parse_extraction_json(raw)

        entities = []
        for e in data.get("entities", []):
            if e.get("type") in ENTITY_TYPES and e.get("name"):
                entities.append(Entity(
                    type=e["type"],
                    name=e["name"],
                    description=e.get("description", ""),
                ))

        relations = []
        for r in data.get("relations", []):
            if r.get("predicate") in RELATION_TYPES and r.get("entity_name"):
                relations.append(Relation(
                    predicate=r["predicate"],
                    entity_type=r.get("entity_type", "Method"),
                    entity_name=r["entity_name"],
                    context=r.get("context", ""),
                ))

        logger.info(
            "Extracted %d entities and %d relations for paper %s",
            len(entities), len(relations), paper_id,
        )
        return ExtractionResult(entities=entities, relations=relations)

    except Exception:
        logger.exception("Entity extraction failed for paper %s", paper_id)
        return ExtractionResult()
