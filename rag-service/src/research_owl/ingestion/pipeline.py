"""Arxiv PDF download, text extraction, and figure export.

Downloads PDFs from arxiv and extracts full text + figures with Docling
for chunking, embedding, vision description, and citation parsing.
"""

from __future__ import annotations

import logging
import re
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling_core.types.doc import PictureItem, TableItem

logger = logging.getLogger(__name__)

ARXIV_PDF_TEMPLATE = "https://arxiv.org/pdf/{arxiv_id}"


@dataclass
class PipelineResult:
    local_pdf_path: Path
    title: str | None = None
    full_text: str = ""
    num_images: int = 0


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


def extract_text_and_figures(
    local_pdf_path: Path,
    output_dir: Path | None = None,
    images_scale: float = 2.0,
) -> tuple[str | None, str, int]:
    """Extract title, markdown text, and figures/tables from a PDF.

    When *output_dir* is provided, figures (``PictureItem``) and tables
    (``TableItem``) are saved as PNGs so the downstream vision model can
    describe them for multimodal RAG.

    Returns ``(title, full_text, num_images_saved)``.
    """
    pipeline_options = PdfPipelineOptions()
    pipeline_options.images_scale = images_scale
    pipeline_options.generate_picture_images = True
    pipeline_options.generate_page_images = False

    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
        }
    )
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

    num_images = 0
    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)
        doc_stem = local_pdf_path.stem
        picture_counter = 0
        table_counter = 0

        for element, _level in document.iterate_items():
            try:
                if isinstance(element, PictureItem):
                    picture_counter += 1
                    img = element.get_image(document)
                    if img is not None:
                        out_path = output_dir / f"{doc_stem}-picture-{picture_counter}.png"
                        img.save(str(out_path), "PNG")
                        num_images += 1
                        logger.info("Saved figure: %s", out_path.name)
                elif isinstance(element, TableItem):
                    table_counter += 1
                    img = element.get_image(document)
                    if img is not None:
                        out_path = output_dir / f"{doc_stem}-table-{table_counter}.png"
                        img.save(str(out_path), "PNG")
                        num_images += 1
                        logger.info("Saved table image: %s", out_path.name)
            except Exception:
                logger.warning(
                    "Could not export image from %s", local_pdf_path.name, exc_info=True
                )

    return title, full_text, num_images


def process_pdf(
    arxiv_url: str,
    paper_id: str,
    download_dir: Path,
    output_dir: Path | None = None,
    images_scale: float = 2.0,
) -> PipelineResult:
    """Download arxiv PDF, extract text, and export figures.

    *output_dir*: where to save extracted figure/table PNGs.
    *images_scale*: Docling render scale (1.0 ≈ 72 DPI).
    """
    local_path = download_pdf(arxiv_url, paper_id, download_dir)
    title, full_text, num_images = extract_text_and_figures(
        local_path,
        output_dir=output_dir,
        images_scale=images_scale,
    )

    logger.info(
        "Processed paper %s: title=%r, text_len=%d, images=%d",
        paper_id,
        title,
        len(full_text),
        num_images,
    )

    return PipelineResult(
        local_pdf_path=local_path,
        title=title,
        full_text=full_text,
        num_images=num_images,
    )
