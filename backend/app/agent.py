# LangGraph agentic RAG pipeline.
# Flow: retrieve -> grade_documents -> [generate | rewrite_query -> retrieve (max 1 retry)]

import uuid
from typing import TypedDict

from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph

from app.config import settings
from app.ingestion import get_vectorstore
from app.logging import get_logger
from app.models import ChatResponse, Source

log = get_logger(__name__)


class AgentState(TypedDict):
    query: str
    documents: list[Document]
    generation: str
    query_rewritten: bool
    conversation_id: str


def get_llm() -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.llm_model,
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
        temperature=0,
    )


# Fetch top-k relevant chunks from the vector store
def retrieve(state: AgentState) -> AgentState:
    log.info("node_retrieve", query=state["query"])
    vectorstore = get_vectorstore()
    docs = vectorstore.similarity_search(
        state["query"], k=settings.retrieval_k)
    log.info("retrieved_docs", count=len(docs))
    return {**state, "documents": docs}


GRADER_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are a relevance grader. Given a user question and a retrieved document, "
            "determine if the document contains information relevant to answering the question. "
            "Respond with ONLY 'yes' or 'no'.",
        ),
        (
            "human",
            "Question: {question}\n\nDocument:\n{document}",
        ),
    ]
)


# LLM-based filter: keep only chunks relevant to the query
def grade_documents(state: AgentState) -> AgentState:
    log.info("node_grade_documents", num_docs=len(state["documents"]))
    llm = get_llm()
    chain = GRADER_PROMPT | llm | StrOutputParser()

    relevant_docs = []
    for doc in state["documents"]:
        result = chain.invoke(
            {"question": state["query"], "document": doc.page_content}
        )
        if "yes" in result.lower():
            relevant_docs.append(doc)

    log.info("grading_complete", relevant=len(
        relevant_docs), total=len(state["documents"]))
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
    llm = get_llm()
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

    llm = get_llm()
    chain = GENERATE_PROMPT | llm | StrOutputParser()

    context = "\n\n---\n\n".join(
        f"[Page {doc.metadata.get('page', '?')}, Type: {doc.metadata.get('content_type', 'text')}]\n{doc.page_content}"
        for doc in state["documents"]
    )

    result = chain.invoke({"context": context, "question": state["query"]})
    log.info("generation_complete", answer_length=len(result))
    return {**state, "generation": result}


def build_graph() -> StateGraph:
    graph = StateGraph(AgentState)

    graph.add_node("retrieve", retrieve)
    graph.add_node("grade_documents", grade_documents)
    graph.add_node("rewrite_query", rewrite_query)
    graph.add_node("generate", generate)

    graph.set_entry_point("retrieve")
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


def run_agent(query: str, conversation_id: str | None = None) -> ChatResponse:
    conv_id = conversation_id or str(uuid.uuid4())
    log.info("agent_run_started", query=query, conversation_id=conv_id)

    result = rag_agent.invoke(
        {
            "query": query,
            "documents": [],
            "generation": "",
            "query_rewritten": False,
            "conversation_id": conv_id,
        }
    )

    sources = [
        Source(
            page=doc.metadata.get("page", 0),
            content_preview=doc.page_content[:150],
            content_type=doc.metadata.get("content_type", "text"),
        )
        for doc in result["documents"]
    ]

    log.info("agent_run_complete", conversation_id=conv_id,
             num_sources=len(sources))

    return ChatResponse(
        answer=result["generation"],
        sources=sources,
        conversation_id=conv_id,
    )
