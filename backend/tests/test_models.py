import pytest
from app.models import ChatRequest
from pydantic import ValidationError


def test_chat_request_accepts_message() -> None:
    request = ChatRequest(message="Hello")

    assert request.message == "Hello"
    assert request.conversation_id is None


def test_chat_request_requires_message() -> None:
    with pytest.raises(ValidationError):
        ChatRequest()
