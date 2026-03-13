"""Lightweight RAG evaluation using direct OpenAI calls.

Two metrics:
- factual_correctness (0.0–1.0): How factually accurate is the answer?
- context_relevance (0.0–1.0): How relevant is the retrieved context to the question?
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass

from openai import AsyncOpenAI

from research_owl.config import settings
from research_owl.models import EvalItemResult

logger = logging.getLogger(__name__)

FACTUAL_SYSTEM = """You are an evaluation judge. Score the factual accuracy of the model response compared to the reference answer.

Respond with ONLY a JSON object (no other text) with exactly two fields:
- "score": a float between 0.0 and 1.0 (0 = completely wrong, 1 = perfectly accurate)
- "reason": a brief explanation (1-2 sentences)

Scoring guide:
- 1.0: All claims match the reference and are factually correct
- 0.7-0.9: Most key facts are correct with minor omissions
- 0.4-0.6: Some correct facts but significant gaps or errors
- 0.1-0.3: Mostly incorrect or irrelevant
- 0.0: Completely wrong or contradicts the reference"""

FACTUAL_USER = """Question: {question}
Reference Answer: {reference}
Model Response: {response}"""

CONTEXT_RELEVANCE_SYSTEM = """You are an evaluation judge. Score how relevant the retrieved context is for answering the given question.

Respond with ONLY a JSON object (no other text) with exactly two fields:
- "score": a float between 0.0 and 1.0 (0 = completely irrelevant, 1 = perfectly relevant)
- "reason": a brief explanation (1-2 sentences)

Scoring guide:
- 1.0: Context contains all information needed to fully answer the question
- 0.7-0.9: Context contains most relevant information with minor gaps
- 0.4-0.6: Context is partially relevant but missing key information
- 0.1-0.3: Context is mostly irrelevant to the question
- 0.0: Context is completely unrelated to the question"""

CONTEXT_RELEVANCE_USER = """Question: {question}
Expected Answer: {expected_answer}
Retrieved Context: {context}"""


@dataclass
class EvalResult:
    """Aggregate evaluation results."""

    factual_correctness: float | None = None
    context_relevance: float | None = None
    item_results: list[EvalItemResult] | None = None


def _extract_json(text: str) -> dict:
    """Extract JSON object from LLM response text."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Try markdown code block
    md_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if md_match:
        return json.loads(md_match.group(1))
    # Try raw braces
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group())
    raise ValueError(f"No JSON found in: {text[:200]}")


def _build_client() -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=settings.ai_gateway_api_key,
        base_url=settings.ai_gateway_base_url,
    )


async def _judge_factual_correctness(
    client: AsyncOpenAI,
    question: str,
    reference: str,
    response: str,
) -> tuple[float | None, str | None]:
    """Return (score, reason) using LLM-as-judge."""
    try:
        resp = await client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {"role": "system", "content": FACTUAL_SYSTEM},
                {
                    "role": "user",
                    "content": FACTUAL_USER.format(
                        question=question,
                        reference=reference,
                        response=response,
                    ),
                },
            ],
            temperature=0,
            max_tokens=200,
        )
        raw = resp.choices[0].message.content or "{}"
        data = _extract_json(raw)
        score = float(data.get("score", 0))
        score = max(0.0, min(1.0, score))  # clamp
        reason = data.get("reason", "")
        return round(score, 4), reason
    except Exception:
        logger.exception("Factual correctness judgment failed")
        return None, None


async def _judge_context_relevance(
    client: AsyncOpenAI,
    question: str,
    expected_answer: str,
    context: str,
) -> tuple[float | None, str | None]:
    """Return (score, reason) for context relevance using LLM-as-judge."""
    try:
        resp = await client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {"role": "system", "content": CONTEXT_RELEVANCE_SYSTEM},
                {
                    "role": "user",
                    "content": CONTEXT_RELEVANCE_USER.format(
                        question=question,
                        expected_answer=expected_answer,
                        context=context,
                    ),
                },
            ],
            temperature=0,
            max_tokens=200,
        )
        raw = resp.choices[0].message.content or "{}"
        data = _extract_json(raw)
        score = float(data.get("score", 0))
        score = max(0.0, min(1.0, score))  # clamp
        reason = data.get("reason", "")
        return round(score, 4), reason
    except Exception:
        logger.exception("Context relevance judgment failed")
        return None, None


async def run_evaluation(
    items: list[dict],
    query_func,
    retrieve_func,
    progress_callback=None,
) -> EvalResult:
    """Run evaluation on a set of Q&A items."""
    client = _build_client()
    item_results: list[EvalItemResult] = []

    for i, item in enumerate(items):
        question = item["question"]
        ground_truth = item["ground_truth"]

        # Query the RAG pipeline
        try:
            answer = await query_func(question, mode="semantic")
            contexts = await retrieve_func(question, mode="semantic")
        except Exception:
            logger.exception("Failed to query RAG for: %s", question[:80])
            answer = ""
            contexts = []

        context_str = "\n".join(contexts) if contexts else ""

        # Judge factual correctness (0-1)
        fc_score, fc_reason = await _judge_factual_correctness(
            client, question, ground_truth, answer,
        )

        # Judge context relevance (0-1)
        cr_score, cr_reason = await _judge_context_relevance(
            client, question, ground_truth, context_str,
        )

        item_results.append(
            EvalItemResult(
                item_id=item["item_id"],
                question=question,
                ground_truth=ground_truth,
                answer=answer,
                contexts=contexts,
                factual_correctness=fc_score,
                factual_correctness_reason=fc_reason,
                context_relevance=cr_score,
                context_relevance_reason=cr_reason,
            )
        )

        if progress_callback:
            await progress_callback(i + 1, len(items))

    # Aggregate factual correctness mean
    fc_scored = [ir for ir in item_results if ir.factual_correctness is not None]
    if fc_scored:
        factual_correctness = round(
            sum(ir.factual_correctness for ir in fc_scored) / len(fc_scored), 4  # type: ignore[arg-type]
        )
    else:
        factual_correctness = None

    # Aggregate context relevance mean
    cr_scored = [ir for ir in item_results if ir.context_relevance is not None]
    if cr_scored:
        context_relevance = round(
            sum(ir.context_relevance for ir in cr_scored) / len(cr_scored), 4  # type: ignore[arg-type]
        )
    else:
        context_relevance = None

    return EvalResult(
        factual_correctness=factual_correctness,
        context_relevance=context_relevance,
        item_results=item_results,
    )
