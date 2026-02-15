from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None


class Source(BaseModel):
    page: int
    content_preview: str
    source_text: str
    content_type: str  # "table" or "text"
    match_type: str = "semantic"  # "keyword" or "semantic"


class ChatResponse(BaseModel):
    answer: str
    sources: list[Source]
    conversation_id: str
    rewritten_query: str | None = None


class IndexResponse(BaseModel):
    status: str
    num_chunks: int
