# Enterprise Offline AI Accelerator & Autonomous Workspace Suite

A production-grade, 100% data-isolated AI infrastructure mesh bridging real-time asynchronous streaming pipelines, metadata-filtered vector databases, and stateful autonomous agent loops.

---

## 🏗️ Core Architecture Overview

This workspace houses a modern decoupling of a Next.js frontend console and a FastAPI event-driven asynchronous backend. The entire platform runs completely offline on local consumer hardware using quantized open-source model weights via Ollama, ensuring absolute enterprise security compliance for proprietary enterprise source code and sensitive data assets.

```
┌────────────────────────────────────────┐
│         Next.js Client Cockpit         │
└────────────┬──────────────▲────────────┘
             │ POST Request │ SSE Stream
             ▼              │
┌───────────────────────────┴────────────┐
│         FastAPI Middleware Layer       │
└────────────┬──────────────▲────────────┘
             │              │ Invoke / Resume
             ▼              │
┌───────────────────────────┴────────────┐
│    LangGraph Stateful Agent Engine     │
└───────┬────────────────────────┬───────┘
        │                        │
        ▼ (Tool Call)            ▼ (Tool Call)
┌─────────────────────────┐      ┌──────────────────────────┐
│       ChromaDB          │      │    Windows Subprocess    │
│   (Vector Database)     │      │   (Local Shell Execution)│
└─────────────────────────┘      └──────────────────────────┘
```

---

## 🛠️ Engineered Subsystems & Technical Implementation

### 1. High-Throughput Event-Driven Streaming API
*   **Networking Architecture:** Built on top of **Server-Sent Events (SSE)** utilizing FastAPI's `StreamingResponse` layered over an `asyncio` event loop.
*   **The POST/SSE Pattern:** Bypassed native HTML5 `EventSource` constraints (which limit network traffic strictly to GET requests) by implementing a browser-side `ReadableStream` reader linked to a POST fetch loop. This permits transmitting heavy prompt/configuration payloads while retaining real-time chunk streaming.
*   **Resource Protection:** Features explicit interception of `asyncio.CancelledByClientError`. The moment a browser connection drops or a user cancels, the backend halts downstream LLM thread computation instantly, preserving token budgets.

### 2. Metadata-Filtered RAG & Vector Mechanics
*   **Token-Driven Chunking:** Rejected fragile character-based string splits (`text[:500]`). Ingested files are compiled using `RecursiveCharacterTextSplitter.from_ticker_encoder` driven by the `cl100k_base` tokenizer (matching GPT-4 specifications).
*   **Constraint Profiles:** Enforced a structural boundary scale of **150 token chunk sizes** with a **25 token slide-window overlap** to guarantee strict context continuity across parsing edges.
*   **Multi-Tenant Isolation:** Databases are configured to map arrays over the **Cosine Distance metric space** (`hnsw:space: cosine`). True multi-tenancy access controls enforce metadata-level pre-filtering (`where={"owner_perm": role}`) *before* executing vector math calculations, preventing privileged document data leakage.

### 3. Composed Declarative Orchestration (LCEL)
*   **Pipeline Compilation:** Assembled multi-step text extraction sequences utilizing LangChain Expression Language (LCEL) over overloaded Python bitwise `|` runnable protocols.
*   **Hallucination Mitigation:** System prompts enforce a rigid constraint boundary, converting the model from a knowledge generator into a context reasoner. The model is structurally banned from relying on base weights if the vector query snapshot yields empty data.
*   **Dual-Type Network Payloads:** Custom async generators stream out incremental text tokens (`type: content`) continuously, while flushing raw vector citation records (`type: metadata`) as a trailing packet once execution maps complete.

### 4. Autonomous TDD Agents with Shell Safety Intercepts
*   **State-Chart Execution:** Implemented with **LangGraph** to manage conditional looping state transitions safely without memory trace leaks.
*   **Deterministic Bracket-Stack Parsing:** Features a custom stack validator (`extract_all_json_blocks`) to bypass regex limitations when extracting structural JSON arrays from noisy model output text blocks. It tracks nested bracket depths accurately, rendering the agent completely immune to the *Nested Bracket Code-Extraction Problem*.
*   **Human-In-The-Loop (HITL) Guardrails:** Built with an in-memory `MemorySaver` checkpointer. When the agent requests a system shell command execution (`execute_script`), LangGraph triggers a native thread interrupt (`interrupt_after=["human_gate_node"]`), pauses computation, and returns state arrays to the client interface to wait for human supervisor authorization.

---

## 💻 Tech Stack Configuration

*   **Backend Framework:** FastAPI (Python 3.11)
*   **Package Manager:** `uv` (Rust-based ultra-fast pip alternative)
*   **Orchestration Core:** LangChain / LangGraph Suite
*   **Local Inference Host:** Ollama running Llama 3 (8B quantized)
*   **Vector Engine:** Persistent ChromaDB Core (Local Directory Mapping)
*   **Frontend Client:** Next.js 14, TypeScript, Tailwind CSS

---

## 🚀 Native Windows Development Bootstrap

### 1. Backend Ingestion System Setup
Ensure you have `uv` installed on your machine, then spin up the isolated virtual workspace environment:
```powershell
cd backend
uv venv --python 3.11
.venv\Scripts\Activate.ps1
uv pip install -r requirements.txt
```

Start the inference host server via your separate shell window:
```powershell
ollama run llama3
```

Execute the Uvicorn engine runner:
```powershell
python main.py
```

### 2. Frontend Interface Deployment
```powershell
cd frontend
npm install
npm run dev
```
Open **`http://localhost:3000`** in your browser cockpit window to monitor active execution pipelines.
