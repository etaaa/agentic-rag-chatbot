# PDF ingestion: extract text and tables, chunk, and index into ChromaDB.

import shutil
from pathlib import Path

import fitz
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings

from app.config import settings
from app.logging import get_logger

log = get_logger(__name__)


# Convert a PyMuPDF table (list of rows) into a markdown table string
def _table_to_markdown(table: list[list[str | None]]) -> str:
    if not table or not table[0]:
        return ""

    rows = []
    for row in table:
        rows.append([cell.replace("\n", " ").strip() if cell else "" for cell in row])

    header = "| " + " | ".join(rows[0]) + " |"
    separator = "| " + " | ".join("---" for _ in rows[0]) + " |"
    body_lines = []
    for row in rows[1:]:
        body_lines.append("| " + " | ".join(row) + " |")

    return "\n".join([header, separator] + body_lines)


# Walk each page, extract full text and tables as separate LangChain Documents
def extract_chunks_from_pdf(pdf_path: str) -> list[Document]:
    doc = fitz.open(pdf_path)
    chunks: list[Document] = []

    for page_idx in range(len(doc)):
        page = doc[page_idx]
        page_num = page_idx + 1

        tables = page.find_tables()
        table_areas = []
        table_chunks = []

        for table in tables.tables:
            data = table.extract()
            # Skip tiny/empty tables (likely PDF artifacts)
            if len(data) < 2 or len(data[0]) < 2:
                continue

            md = _table_to_markdown(data)
            if not md.strip():
                continue

            table_areas.append(table.bbox)
            table_chunks.append(md)

        page_text = page.get_text().strip()

        # Only create a text chunk if the page has meaningful content
        if page_text and len(page_text) > 50:
            chunks.append(
                Document(
                    page_content=page_text,
                    metadata={
                        "page": page_num,
                        "content_type": "text",
                        "source": Path(pdf_path).name,
                    },
                )
            )

        # Each table gets its own chunk, prefixed with the product heading for context
        for md in table_chunks:
            heading = _extract_heading(page_text)
            content = f"Product: {heading}\n\n{md}" if heading else md

            chunks.append(
                Document(
                    page_content=content,
                    metadata={
                        "page": page_num,
                        "content_type": "table",
                        "source": Path(pdf_path).name,
                    },
                )
            )

    doc.close()
    log.info("pdf_extracted", num_chunks=len(chunks), pdf_path=pdf_path)
    return chunks


# Heuristic: grab the first short line or one containing ® as the product name
def _extract_heading(page_text: str) -> str:
    lines = page_text.strip().split("\n")
    for line in lines:
        line = line.strip()
        if len(line) < 5 or line.isdigit():
            continue
        if "®" in line or len(line) < 80:
            return line
    return ""


def get_embeddings() -> OpenAIEmbeddings:
    return OpenAIEmbeddings(
        model=settings.embedding_model,
        openai_api_key=settings.openrouter_api_key,
        openai_api_base=settings.openrouter_base_url,
    )


# Wipe existing index, re-extract chunks from PDF, embed, and store in ChromaDB
def index_pdf(pdf_path: str | None = None) -> int:
    pdf_path = pdf_path or settings.pdf_path
    log.info("indexing_started", pdf_path=pdf_path)

    chroma_path = Path(settings.chroma_dir)
    if chroma_path.exists():
        shutil.rmtree(chroma_path)

    chunks = extract_chunks_from_pdf(pdf_path)

    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=get_embeddings(),
        persist_directory=settings.chroma_dir,
    )

    log.info("indexing_complete", num_chunks=len(chunks))
    return len(chunks)


def get_vectorstore() -> Chroma:
    return Chroma(
        persist_directory=settings.chroma_dir,
        embedding_function=get_embeddings(),
    )
