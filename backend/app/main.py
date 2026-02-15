# FastAPI application for the Agentic RAG Chatbot.

import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.agent import run_agent, stream_agent
from app.config import settings
from app.ingestion import index_pdf
from app.logging import get_logger, setup_logging
from app.models import ChatRequest, ChatResponse

setup_logging()
log = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("app_starting", llm_model=settings.llm_model)

    chroma_path = Path(settings.chroma_dir)
    if not chroma_path.exists():
        log.info("auto_indexing_started", reason="chroma directory not found")
        start = time.time()
        num_chunks = index_pdf()
        duration = time.time() - start
        log.info("auto_indexing_complete", num_chunks=num_chunks, duration_s=round(duration, 2))
    else:
        log.info("auto_indexing_skipped", reason="chroma directory already exists")

    yield
    log.info("app_shutting_down")


app = FastAPI(
    title="Agentic RAG Chatbot",
    description="RAG chatbot for B. Braun medical product catalog",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


# Stream live status updates and the final answer via SSE
@app.post("/chat")
async def chat(request: ChatRequest):
    log.info("chat_request", message=request.message, conversation_id=request.conversation_id)

    return StreamingResponse(
        stream_agent(request.message, request.conversation_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
