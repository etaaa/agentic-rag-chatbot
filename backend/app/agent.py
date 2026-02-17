# LangGraph agentic RAG pipeline.
# Flow: retrieve -> grade_documents -> [generate | rewrite_query -> retrieve (max 1 retry)]

import json
import re
import uuid
from collections.abc import Generator
from typing import Any, TypedDict, cast

from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph
from pydantic import SecretStr

from app.config import settings
from app.ingestion import get_retriever
from app.log import get_logger

log = get_logger(__name__)


class AgentState(TypedDict):
    query: str
    documents: list[Document]
    generation: str
    query_rewritten: bool
    route: str


llm = ChatOpenAI(
    model=settings.llm_model,
    api_key=SecretStr(settings.openrouter_api_key) if settings.openrouter_api_key else None,
    base_url=settings.openrouter_base_url,
    temperature=0,
)


ROUTER_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are a classifier. Determine if the user's input is a question about medical products/catalogs (search) "
            "or if it is a general conversation, greeting, or off-topic question (chat). "
            "Examples: "
            "'Hi', 'Who are you?', 'Thanks' -> chat "
            "'What is the capital of France?', 'Write a poem', 'Python code' -> chat "
            "'What syringes do you have?', 'Product 123', 'Needle specs' -> search "
            "Output ONLY 'search' or 'chat'.",
        ),
        ("human", "{query}"),
    ]
)


def router(state: AgentState) -> AgentState:
    log.info("node_router", query=state["query"])
    chain = ROUTER_PROMPT | llm | StrOutputParser()
    result = chain.invoke({"query": state["query"]})
    decision = result.strip().lower()

    # Fallback to search if unclear
    if decision not in ["search", "chat"]:
        decision = "search"

    log.info("router_decision", decision=decision)
    return {**state, "route": decision}


CASUAL_CHAT_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are a helpful assistant for the SANOVIO B. Braun catalog. "
            "If the user greets you, be polite and offer help with the catalog. "
            "If the user asks an off-topic question (e.g. general knowledge, coding, weather), "
            "politely refuse and state that you can only help with B. Braun medical products. "
            "Do NOT try to answer off-topic questions. "
            "Do NOT make up product info.",
        ),
        ("human", "{query}"),
    ]
)


def casual_chat(state: AgentState) -> AgentState:
    log.info("node_casual_chat", query=state["query"])
    chain = CASUAL_CHAT_PROMPT | llm | StrOutputParser()
    result = chain.invoke({"query": state["query"]})
    return {**state, "generation": result, "documents": []}


# Fetch top-k relevant chunks from the vector store
def retrieve(state: AgentState) -> AgentState:
    log.info("node_retrieve", query=state["query"])
    retriever = get_retriever()
    docs = retriever.invoke(state["query"])
    log.info("retrieved_docs", count=len(docs))
    return {**state, "documents": docs}


BATCH_GRADER_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are a relevance grader. You will be given a user question and a list of retrieved documents. "
            "Your task is to identify which documents contain information relevant to answering the question. "
            "Output ONLY a comma-separated list of the indices (1-based) of the relevant documents (e.g., '1, 3, 5'). "
            "If no documents are relevant, output 'none'.",
        ),
        (
            "human",
            "Question: {question}\n\nDocuments:\n{documents}",
        ),
    ]
)


# LLM-based filter: keep only chunks relevant to the query (Batched)
def grade_documents(state: AgentState) -> AgentState:
    log.info("node_grade_documents", num_docs=len(state["documents"]))

    if not state["documents"]:
        return state

    chain = BATCH_GRADER_PROMPT | llm | StrOutputParser()

    doc_strings = [
        f"Document {i + 1}:\n{doc.page_content}" for i, doc in enumerate(state["documents"])
    ]
    formatted_docs = "\n\n".join(doc_strings)

    result = chain.invoke({"question": state["query"], "documents": formatted_docs})

    # Parse results
    clean_result = result.strip().lower()
    relevant_indices = set()

    if "none" not in clean_result:
        for num in re.findall(r"\d+", clean_result):
            relevant_indices.add(int(num) - 1)

    relevant_docs = [doc for i, doc in enumerate(state["documents"]) if i in relevant_indices]

    log.info("grading_complete", relevant=len(relevant_docs), total=len(state["documents"]))
    return {**state, "documents": relevant_docs}


# Route: generate if docs exist, rewrite once if none, else generate fallback
def decide_next(state: AgentState) -> str:
    if state["documents"]:
        return "generate"
    if not state["query_rewritten"]:
        return "rewrite_query"
    return "generate"


REWRITE_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are a query rewriter. Rewrite the user's question to be more specific "
            "and better suited for searching a German medical product catalog (syringes, needles, etc.). "
            "Keep the meaning but improve the search terms. Output ONLY the rewritten query.",
        ),
        ("human", "{query}"),
    ]
)


# Reformulate the query for better retrieval on the German catalog
def rewrite_query(state: AgentState) -> AgentState:
    log.info("node_rewrite_query", original_query=state["query"])
    chain = REWRITE_PROMPT | llm | StrOutputParser()
    new_query = chain.invoke({"query": state["query"]})
    log.info("query_rewritten", new_query=new_query)
    return {**state, "query": new_query, "query_rewritten": True}


GENERATE_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are a helpful assistant that answers questions about a B. Braun medical product catalog.
You MUST answer in English, regardless of the language of the question.
Use ONLY the provided context to answer. Do NOT make up information.

Rules:
1. Always cite the source page number(s) in your answer, e.g. "(Page 10)".
2. When referencing products, include the product ID/Art.-Nr. if available.
3. If tables are provided, present data in a clear structured format.
4. If the context does not contain enough information to answer, say:
   "I don't have enough information in the catalog to answer this question."
5. Be precise and concise.""",
        ),
        (
            "human",
            "Context:\n{context}\n\nQuestion: {question}",
        ),
    ]
)


# Produce a final answer from the graded context, or a fallback if no docs remain
def generate(state: AgentState) -> AgentState:
    log.info("node_generate", num_docs=len(state["documents"]))

    if not state["documents"]:
        return {
            **state,
            "generation": "I don't have enough information in the catalog to answer this question.",
        }

    chain = GENERATE_PROMPT | llm | StrOutputParser()

    context = "\n\n---\n\n".join(
        f"[Page {doc.metadata.get('page', '?')}, Type: {doc.metadata.get('content_type', 'text')}]\n{doc.page_content}"
        for doc in state["documents"]
    )

    result = chain.invoke({"context": context, "question": state["query"]})
    log.info("generation_complete", answer_length=len(result))
    return {**state, "generation": result}


def build_graph() -> Any:
    graph = StateGraph(AgentState)

    graph.add_node("router", router)
    graph.add_node("casual_chat", casual_chat)
    graph.add_node("retrieve", retrieve)
    graph.add_node("grade_documents", grade_documents)
    graph.add_node("rewrite_query", rewrite_query)
    graph.add_node("generate", generate)

    graph.set_entry_point("router")

    graph.add_conditional_edges(
        "router", lambda state: state["route"], {"search": "retrieve", "chat": "casual_chat"}
    )

    graph.add_edge("casual_chat", END)
    graph.add_edge("retrieve", "grade_documents")
    graph.add_conditional_edges(
        "grade_documents",
        decide_next,
        {"generate": "generate", "rewrite_query": "rewrite_query"},
    )
    graph.add_edge("rewrite_query", "retrieve")
    graph.add_edge("generate", END)

    return graph.compile()


# Compiled once at import time to avoid rebuilding per request
rag_agent = build_graph()


NODE_STATUS_LABELS: dict[str, str] = {
    "retrieve": "Searching documents...",
    "grade_documents": "Evaluating relevance...",
    "rewrite_query": "Refining search...",
    "generate": "Generating answer...",
    "router": "Understanding intent...",
    "casual_chat": "Thinking...",
}


def _sse_event(data: dict[str, Any]) -> str:
    return f"data: {json.dumps(data)}\n\n"


def stream_agent(query: str, conversation_id: str | None = None) -> Generator[str, None, None]:
    conv_id = conversation_id or str(uuid.uuid4())
    log.info("agent_stream_started", query=query, conversation_id=conv_id)

    initial_state: AgentState = {
        "query": query,
        "documents": [],
        "generation": "",
        "query_rewritten": False,
        "route": "search",
    }

    result: AgentState | None = None
    for event in rag_agent.stream(initial_state):
        for node_name, node_output in event.items():
            result = cast(AgentState, node_output)
            label = NODE_STATUS_LABELS.get(node_name)
            if label:
                yield _sse_event({"type": "status", "message": label})

    if result is None:
        yield _sse_event(
            {
                "type": "answer",
                "answer": "Something went wrong — no result from the agent.",
                "sources": [],
                "conversation_id": conv_id,
            }
        )
        return

    sources = [
        {
            "page": doc.metadata.get("page", 0),
            "content_preview": doc.page_content[:150],
            "content_type": doc.metadata.get("content_type", "text"),
            "source_text": doc.page_content,
            "match_type": doc.metadata.get("match_type", "Unknown Match"),
        }
        for doc in result.get("documents", [])
    ]

    log.info("agent_stream_complete", conversation_id=conv_id, num_sources=len(sources))

    yield _sse_event(
        {
            "type": "answer",
            "answer": result.get("generation", ""),
            "sources": sources,
            "conversation_id": conv_id,
            "rewritten_query": result.get("query") if result.get("query_rewritten") else None,
        }
    )
