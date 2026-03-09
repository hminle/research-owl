"""In-memory progress tracking for paper ingestion pipeline.

Stores per-step status for the 5 pipeline phases and notifies
SSE consumers via asyncio.Event without polling.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class StepStatus(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    failed = "failed"


PIPELINE_STEPS = [
    "download",
    "extract_text",
    "embed_chunks",
    "parse_citations",
    "collect_images",
]


@dataclass
class StepState:
    status: StepStatus = StepStatus.pending
    started_at: float | None = None
    completed_at: float | None = None
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status.value,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "error": self.error,
        }


@dataclass
class PipelineProgress:
    steps: dict[str, StepState] = field(default_factory=dict)
    _event: asyncio.Event = field(default_factory=asyncio.Event, repr=False)

    def to_dict(self) -> dict[str, Any]:
        return {name: step.to_dict() for name, step in self.steps.items()}

    def is_terminal(self) -> bool:
        return all(
            s.status in (StepStatus.completed, StepStatus.failed)
            for s in self.steps.values()
        )


# Global store: paper_id -> PipelineProgress
_store: dict[str, PipelineProgress] = {}


def create_progress(paper_id: str) -> PipelineProgress:
    """Initialize progress tracking for a paper."""
    progress = PipelineProgress(
        steps={name: StepState() for name in PIPELINE_STEPS}
    )
    _store[paper_id] = progress
    return progress


def get_progress(paper_id: str) -> PipelineProgress | None:
    return _store.get(paper_id)


def update_step(
    paper_id: str,
    step_name: str,
    status: StepStatus,
    error: str | None = None,
) -> None:
    """Update a pipeline step and notify waiting consumers."""
    progress = _store.get(paper_id)
    if progress is None:
        return

    step = progress.steps.get(step_name)
    if step is None:
        return

    step.status = status
    if status == StepStatus.in_progress:
        step.started_at = time.time()
    elif status in (StepStatus.completed, StepStatus.failed):
        step.completed_at = time.time()
        if error:
            step.error = error

    # Wake up SSE consumers
    progress._event.set()
    progress._event.clear()


async def wait_for_update(paper_id: str, timeout: float = 2.0) -> bool:
    """Wait for a progress update. Returns True if update received, False on timeout."""
    progress = _store.get(paper_id)
    if progress is None:
        return False
    try:
        await asyncio.wait_for(progress._event.wait(), timeout=timeout)
        return True
    except asyncio.TimeoutError:
        return False


def remove_progress(paper_id: str) -> None:
    """Clean up progress data for a paper."""
    _store.pop(paper_id, None)
