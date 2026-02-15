# PDF ingestion: extract text and tables, chunk, and index into ChromaDB.

import shutil
from pathlib import Path

import fitz
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever
from langchain_core.callbacks import CallbackManagerForRetrieverRun
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


class HybridRetriever(BaseRetriever):
    vector_retriever: BaseRetriever
    bm25_retriever: BaseRetriever

    def _get_relevant_documents(
        self, query: str, *, run_manager: CallbackManagerForRetrieverRun
    ) -> list[Document]:
        # Simple combination: BM25 first, then Vector.
        # Deduplicate by page content.

        bm25_docs = self.bm25_retriever.invoke(query)
        vector_docs = self.vector_retriever.invoke(query)

        # Combine and deduplicate
        seen = set()
        combined = []

        # Prioritize BM25 for exact matches
        for doc in bm25_docs:
            if doc.page_content not in seen:
                seen.add(doc.page_content)
                combined.append(doc)

        for doc in vector_docs:
            if doc.page_content not in seen:
                seen.add(doc.page_content)
                combined.append(doc)

        return combined


def get_retriever() -> BaseRetriever:
    vectorstore = get_vectorstore()
    vector_retriever = vectorstore.as_retriever(
        search_kwargs={"k": settings.retrieval_k})

    try:
        from langchain_community.retrievers import BM25Retriever

        # Verify we can access the underlying collection
        if not vectorstore._collection.count():
             return vector_retriever

        # fetch all docs to build BM25 index
        # Chroma's get() returns dict with 'documents' and 'metadatas'
        data = vectorstore.get()
        docs_content = data["documents"]
        metadatas = data["metadatas"]

        if not docs_content:
            return vector_retriever

        # Reconstruct documents for BM25
        full_docs = []
        for i in range(len(docs_content)):
            full_docs.append(
                Document(page_content=docs_content[i], metadata=metadatas[i])
            )

        bm25_retriever = BM25Retriever.from_documents(full_docs)
        bm25_retriever.k = settings.retrieval_k

        log.info("hybrid_retriever_initialized",
                 num_docs=len(full_docs))
        return HybridRetriever(vector_retriever=vector_retriever, bm25_retriever=bm25_retriever)

    except ImportError:
        log.warning("rank_bm25 not found, falling back to vector search only")
        return vector_retriever
    except Exception as e:
        log.error("hybrid_retriever_failed", error=str(e))
        return vector_retriever
