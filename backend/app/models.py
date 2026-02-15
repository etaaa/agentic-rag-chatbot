from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None


class Source(BaseModel):
    page: int
    content_preview: str
    source_text: str
    content_type: str  # "table" or "text"


class ChatResponse(BaseModel):
    answer: str
    sources: list[Source]
    conversation_id: str


class IndexResponse(BaseModel):
    status: str
    num_chunks: int
