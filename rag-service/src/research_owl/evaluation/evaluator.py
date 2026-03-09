"""Lightweight RAG evaluation using direct OpenAI calls.

Two metrics:
- correctness (pass/fail): Does the answer match the ground truth?
- factual_correctness (0.0–1.0): How factually accurate is the answer?
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

CORRECTNESS_SYSTEM = """You are an evaluation judge. Compare the model response to the expected answer.

Respond with ONLY a JSON object (no other text) with exactly two fields:
- "verdict": "pass" or "fail"
- "reason": a brief explanation (1-2 sentences)

Consider the response correct ("pass") if it:
1. Contains the key information from the expected answer
2. Is factually accurate based on the provided context
3. Adequately addresses the question asked"""

CORRECTNESS_USER = """Question: {question}
Expected Answer: {expected_answer}
Model Response: {response}
Retrieved Context: {context}"""

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


@dataclass
class EvalResult:
    """Aggregate evaluation results."""

    correctness: float | None = None
    factual_correctness: float | None = None
    item_results: list[EvalItemResult] | None = None


def _extract_json(text: str) -> dict:
    """Extract JSON object from LLM response text."""
    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Try to find JSON in markdown code block or raw braces
    match = re.search(r"\{[^{}]*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group())
    raise ValueError(f"No JSON found in: {text[:200]}")


def _build_client() -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=settings.ai_gateway_api_key,
        base_url=settings.ai_gateway_base_url,
    )


async def _judge_correctness(
    client: AsyncOpenAI,
    question: str,
    expected_answer: str,
    response: str,
    context: str,
) -> tuple[str | None, str | None]:
    """Return (verdict, reason) using LLM-as-judge."""
    try:
        resp = await client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {"role": "system", "content": CORRECTNESS_SYSTEM},
                {
                    "role": "user",
                    "content": CORRECTNESS_USER.format(
                        question=question,
                        expected_answer=expected_answer,
                        response=response,
                        context=context,
                    ),
                },
            ],
            temperature=0,
            max_tokens=200,
        )
        raw = resp.choices[0].message.content or ""
        data = _extract_json(raw)
        verdict = data.get("verdict", "").lower()
        reason = data.get("reason", "")
        if verdict not in ("pass", "fail"):
            verdict = "fail"
        return verdict, reason
    except Exception:
        logger.exception("Correctness judgment failed")
        return None, None


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
        raw = resp.choices[0].message.content or ""
        data = _extract_json(raw)
        score = float(data.get("score", 0))
        score = max(0.0, min(1.0, score))  # clamp
        reason = data.get("reason", "")
        return round(score, 4), reason
    except Exception:
        logger.exception("Factual correctness judgment failed")
        return None, None


async def run_evaluation(
    items: list[dict],
    query_func,
    retrieve_func,
    query_mode: str = "semantic",
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
            answer = await query_func(question, mode=query_mode)
            contexts = await retrieve_func(question, mode=query_mode)
        except Exception:
            logger.exception("Failed to query RAG for: %s", question[:80])
            answer = ""
            contexts = []

        context_str = "\n".join(contexts) if contexts else ""

        # Judge correctness (pass/fail)
        c_score, c_reason = await _judge_correctness(
            client, question, ground_truth, answer, context_str,
        )

        # Judge factual correctness (0-1)
        fc_score, _fc_reason = await _judge_factual_correctness(
            client, question, ground_truth, answer,
        )

        item_results.append(
            EvalItemResult(
                item_id=item["item_id"],
                question=question,
                ground_truth=ground_truth,
                answer=answer,
                contexts=contexts,
                correctness_score=c_score,
                correctness_reason=c_reason,
                factual_correctness=fc_score,
            )
        )

        if progress_callback:
            await progress_callback(i + 1, len(items))

    # Aggregate correctness pass rate
    scored = [ir for ir in item_results if ir.correctness_score is not None]
    if scored:
        pass_count = sum(1 for ir in scored if ir.correctness_score == "pass")
        correctness = round(pass_count / len(scored), 4)
    else:
        correctness = None

    # Aggregate factual correctness mean
    fc_scored = [ir for ir in item_results if ir.factual_correctness is not None]
    if fc_scored:
        factual_correctness = round(
            sum(ir.factual_correctness for ir in fc_scored) / len(fc_scored), 4  # type: ignore[arg-type]
        )
    else:
        factual_correctness = None

    return EvalResult(
        correctness=correctness,
        factual_correctness=factual_correctness,
        item_results=item_results,
    )
