# FastAPI application for the Agentic RAG Chatbot.

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agent import run_agent
from app.config import settings
from app.ingestion import index_pdf
from app.logging import get_logger, setup_logging
from app.models import ChatRequest, ChatResponse, IndexResponse

setup_logging()
log = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("app_starting", llm_model=settings.llm_model)
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


# Trigger PDF re-indexing into the vector store
@app.post("/index", response_model=IndexResponse)
async def index_catalog():
    start = time.time()
    num_chunks = index_pdf()
    duration = time.time() - start
    log.info("indexing_api_complete", num_chunks=num_chunks, duration_s=round(duration, 2))
    return IndexResponse(status="ok", num_chunks=num_chunks)


# Run the agentic RAG pipeline and return an answer with sources
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    start = time.time()
    log.info("chat_request", message=request.message, conversation_id=request.conversation_id)

    response = run_agent(request.message, request.conversation_id)

    duration = time.time() - start
    log.info(
        "chat_response",
        conversation_id=response.conversation_id,
        num_sources=len(response.sources),
        duration_s=round(duration, 2),
    )
    return response
