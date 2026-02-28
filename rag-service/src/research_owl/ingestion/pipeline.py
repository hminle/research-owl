import logging
from dataclasses import dataclass, field
from pathlib import Path

from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling_core.types.doc import ImageRefMode, PictureItem, TableItem

logger = logging.getLogger(__name__)


@dataclass
class ImageRecord:
    filename: str
    page_number: int | None = None
    caption: str | None = None


@dataclass
class PipelineResult:
    document: object  # DoclingDocument
    title: str | None = None
    images: list[ImageRecord] = field(default_factory=list)


def process_pdf(arxiv_url: str, paper_id: str, images_dir: Path, images_scale: float = 2.0) -> PipelineResult:
    pipeline_options = PdfPipelineOptions(
        generate_picture_images=True,
        generate_table_images=True,
        images_scale=images_scale,
        do_table_structure=True,
    )

    converter = DocumentConverter(
        format_options={"pdf": PdfFormatOption(pipeline_options=pipeline_options)}
    )

    result = converter.convert(arxiv_url)
    document = result.document

    title = document.name if hasattr(document, "name") else None

    paper_images_dir = images_dir / paper_id
    paper_images_dir.mkdir(parents=True, exist_ok=True)

    image_records: list[ImageRecord] = []
    img_counter = 0

    for item, _level in document.iterate_items():
        if isinstance(item, PictureItem):
            img_counter += 1
            filename = f"figure_{img_counter}.png"
            image = item.get_image(document)
            if image is not None:
                image.save(paper_images_dir / filename, "PNG")

                caption = None
                if item.caption_text(document):
                    caption = item.caption_text(document)

                page_no = item.prov[0].page_no if item.prov else None

                image_records.append(
                    ImageRecord(filename=filename, page_number=page_no, caption=caption)
                )
        elif isinstance(item, TableItem):
            img_counter += 1
            filename = f"table_{img_counter}.png"
            image = item.get_image(document)
            if image is not None:
                image.save(paper_images_dir / filename, "PNG")

                caption = None
                if item.caption_text(document):
                    caption = item.caption_text(document)

                page_no = item.prov[0].page_no if item.prov else None

                image_records.append(
                    ImageRecord(filename=filename, page_number=page_no, caption=caption)
                )

    logger.info("Extracted %d images from paper %s", len(image_records), paper_id)

    return PipelineResult(document=document, title=title, images=image_records)
