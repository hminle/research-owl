"""Arxiv PDF download and text extraction.

Downloads PDFs from arxiv and extracts full text with Docling for
chunking, embedding, and citation parsing.
"""

from __future__ import annotations

import logging
import re
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from docling.document_converter import DocumentConverter

logger = logging.getLogger(__name__)

ARXIV_PDF_TEMPLATE = "https://arxiv.org/pdf/{arxiv_id}"


@dataclass
class PipelineResult:
    local_pdf_path: Path
    title: str | None = None
    full_text: str = ""


def _ensure_pdf_url(arxiv_url: str) -> str:
    """Convert any arxiv URL variant to a direct PDF URL."""
    match = re.search(r"(\d{4}\.\d{4,5})", arxiv_url)
    if match:
        return ARXIV_PDF_TEMPLATE.format(arxiv_id=match.group(1))
    return arxiv_url


def download_pdf(arxiv_url: str, paper_id: str, download_dir: Path) -> Path:
    """Download an arxiv PDF to a local file."""
    download_dir.mkdir(parents=True, exist_ok=True)
    local_path = download_dir / f"{paper_id}.pdf"

    if local_path.exists():
        logger.info("PDF already exists: %s", local_path)
        return local_path

    pdf_url = _ensure_pdf_url(arxiv_url)
    logger.info("Downloading PDF from %s", pdf_url)
    urllib.request.urlretrieve(pdf_url, local_path)
    logger.info("Downloaded PDF to %s (%.1f MB)", local_path, local_path.stat().st_size / 1e6)
    return local_path


def extract_text(local_pdf_path: Path) -> tuple[str | None, str]:
    """Extract title and full markdown text from a PDF using Docling.

    This is a lightweight pass just for citation parsing -- no image
    extraction or table rendering needed.
    """
    converter = DocumentConverter()
    result = converter.convert(str(local_pdf_path))
    document = result.document

    title = document.name if hasattr(document, "name") else None

    full_text = ""
    if hasattr(document, "export_to_markdown"):
        full_text = document.export_to_markdown()
    elif hasattr(document, "export_to_text"):
        full_text = document.export_to_text()
    else:
        texts = []
        for item, _level in document.iterate_items():
            if hasattr(item, "text") and item.text:
                texts.append(item.text)
        full_text = "\n\n".join(texts)

    return title, full_text


def process_pdf(
    arxiv_url: str,
    paper_id: str,
    download_dir: Path,
) -> PipelineResult:
    """Download arxiv PDF and extract text.

    Returns the local PDF path and extracted text for chunking and citation parsing.
    """
    local_path = download_pdf(arxiv_url, paper_id, download_dir)
    title, full_text = extract_text(local_path)

    logger.info(
        "Processed paper %s: title=%r, text_len=%d",
        paper_id,
        title,
        len(full_text),
    )

    return PipelineResult(
        local_pdf_path=local_path,
        title=title,
        full_text=full_text,
    )
