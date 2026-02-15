# Intelligent Agentic RAG for Medical Data

> **A self-governing, context-aware retrieval agent designed for high-precision extraction from complex medical product catalogs.**

---

## Why This Architecture?

This is not a standard "vector search wrapper." Medical product catalogs are dense, table-heavy, and require exact precision, hallucinating a syringe diameter is not an option.

This project implements an **Agentic RAG** system that prioritizes **accuracy, transparency, and self-correction**.

### Key Architectural Decisions

![Agent Graph](assets/agent_graph.png)

#### 1. **Hybrid Search (BM25 + Semantic Vector)**
*   **The Problem:** Standard vector search struggles with exact product IDs (e.g., "Art.-Nr. 4550242") because embedding models treat numbers abstractly. Keyword search (BM25) is great for IDs but fails at "needles for deep injections."
*   **The Solution:** I implemented a **Hybrid Retriever**. It runs both BM25 (keyword) and Vector (semantic) searches in parallel, deduplicates results, and re-ranks them.
*   **The Result:** Users can search by exact catalog number *or* vague natural language descriptions with equal success.

#### 2. **"Table-First" Ingestion Strategy**
*   **The Problem:** RAG pipelines often blindly chunk text, breaking tables mid-row or losing the column headers. In a medical catalog, a number like "0.45" is meaningless without its column header ("Diameter (mm)").
*   **The Solution:**
    *   I used `PyMuPDF` to detect and extract tables **independently**.
    *   Each table is converted to a clean Markdown format to preserve structure for the LLM.
    *   **Heuristic Context Injection:** The ingestion script intelligently scans the page text to find the **Product Name** (e.g., "Omnifix®") and prepends it to the table chunk. This ensures isolated tables always carry their context.

#### 3. **Self-Correcting Agentic Loop (LangGraph)**
*   **The Problem:** A simple RAG pipeline retrieves "something" and tries to answer, even if the retrieval was garbage.
*   **The Solution:** I used **LangGraph** to build a state machine with a **Retrieval Grader**.
    *   **Step 1:** Retrieve documents.
    *   **Step 2:** An LLM "Grader" evaluates if the documents are actually relevant to the query.
    *   **Step 3 (The Agentic Part):** If documents are irrelevant, the agent **does not give up**. It enters a **Query Rewrite** loop, reformulating the user's question to be more specific (e.g., adding "medical catalog" context) and tries retrieving again.
    *   **Step 4:** Only if valid documents are found does it generate an answer. If not, it honestly admits "I don't know," preventing hallucinations.

#### 4. **Smart Routing**
*   **The Problem:** Using an expensive RAG chain for "Hi" or "What is the weather?" is wasteful and confusing.
*   **The Solution:** A specialized **Router** classifies intent immediately. Casual conversation bypasses the heavy RAG machinery entirely, ensuring instant, cost-effective responses for non-query interactions.

---

## Tech Stack

*   **Orchestration:** [LangGraph](https://langchain-ai.github.io/langgraph/) (Stateful agent workflows)
*   **Framework:** [LangChain](https://www.langchain.com/)
*   **Vector Querying:** [ChromaDB](https://www.trychroma.com/) (Local vector store) -> *Chosen for simplicity and speed in a prototype environment.*
*   **Retrieval:** `Rank_BM25` + `OpenAI Embeddings` via OpenRouter.
*   **PDF Processing:** `PyMuPDF` -> *Chosen for superior table extraction capabilities compared to pypdf.*
*   **Backend:** FastAPI -> *High-performance, async Python API.*
*   **Frontend:** Next.js (React) -> *Modern, responsive chat interface.*

---

## Getting Started

### Prerequisites
*   Python 3.11+
*   Node.js 18+
*   An API Key for OpenRouter (or OpenAI)

### 1. Backend Setup

Move to the backend directory:
```bash
cd backend
```

Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

Install dependencies:
```bash
pip install -r requirements.txt
```

Configure Environment:
Create a `.env` file in `backend/` with the following content:
```ini
# backend/.env
OPENROUTER_API_KEY=sk-or-your-key-here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=google/gemini-2.0-flash-001
EMBEDDING_MODEL=openai/text-embedding-3-small
LOG_LEVEL=INFO
```

**Index the Data:**
The system is designed to **automatically index** the PDF on the first run if the vector database (`data/chroma`) is missing.
*Ensure `data/product_catalog_01.pdf` exists in the project root.*

Run the API:
```bash
# From the backend directory
uvicorn app.main:app --reload
```
*Watch the logs: "auto_indexing_started" will verify the process has begun.*

### 2. Frontend Setup

Open a new terminal and move to the frontend directory:
```bash
cd frontend
```

Install dependencies:
```bash
npm install
```

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start chatting.

---

## Future Ideas & Architectural Improvements

Since this is a prototype, I focused on the core self-correcting retrieval loop. However, for a production-ready system, I have identified several logic gaps and architectural improvements to handle complex edge cases:

1.  **Solving "Ambiguity" (The Consultant Approach)**
    *   **Current Limit:** If a user asks "show me needles", the system retrieves a random mix and tries to summarize them.
    *   **Idea:** Add a **Clarification Node**. If retrieval yields diverse results (e.g., both "Safety" and "Spinal" needles), the agent should not guess. Instead, it should ask: *"Which type of needle are you looking for?"*

2.  **Feedback-Driven Query Rewriting**
    *   **Current Limit:** When the `grade_documents` node rejects results, the `rewrite_query` node guesses a new query blindly, unaware of *why* the search failed.
    *   **Idea:** Pass **Grader Feedback** to the Rewriter. If the Grader rejected "Safety Syringes" because the user wanted "Standard", the Rewriter should explicitly exclude "Safety" in the next attempt.

3.  **Structured Data Handling (SQL/Tool Use)**
    *   **Current Limit:** Semantic search struggles with hard constraints like "shorter than 20mm".
    *   **Idea:** Specific queries should route to a **Structured Tool**. For specification inputs, the agent would generate a filter (e.g., `WHERE length < 20`) rather than relying on vector similarity.