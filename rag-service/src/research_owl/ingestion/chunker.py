import logging
from dataclasses import dataclass, field

from docling_core.transforms.chunker.hybrid_chunker import HybridChunker
from docling_core.transforms.chunker.tokenizer.huggingface import HuggingFaceTokenizer

logger = logging.getLogger(__name__)


@dataclass
class ChunkRecord:
    text: str
    page_number: int | None = None
    headings: list[str] = field(default_factory=list)


def create_chunker(tokenizer_model: str = "sentence-transformers/all-MiniLM-L6-v2") -> HybridChunker:
    from transformers import AutoTokenizer

    hf_tokenizer = AutoTokenizer.from_pretrained(tokenizer_model)
    tokenizer = HuggingFaceTokenizer(tokenizer=hf_tokenizer)
    return HybridChunker(tokenizer=tokenizer)


def chunk_document(chunker: HybridChunker, document: object) -> list[ChunkRecord]:
    chunks = list(chunker.chunk(document))  # type: ignore[arg-type]
    logger.info("Chunked document into %d raw chunks", len(chunks))
    records = []
    for i, chunk in enumerate(chunks):
        try:
            text = chunker.contextualize(chunk)
        except Exception:
            logger.warning("contextualize failed for chunk %d, using raw text", i)
            text = chunk.text

        headings: list[str] = []
        if chunk.meta and hasattr(chunk.meta, "headings") and chunk.meta.headings:
            headings = [h if isinstance(h, str) else str(h) for h in chunk.meta.headings]

        page_number = None
        if chunk.meta and hasattr(chunk.meta, "doc_items") and chunk.meta.doc_items:
            first_item = chunk.meta.doc_items[0]
            if hasattr(first_item, "prov") and first_item.prov:
                page_number = first_item.prov[0].page_no

        records.append(ChunkRecord(text=text, page_number=page_number, headings=headings))
    return records
