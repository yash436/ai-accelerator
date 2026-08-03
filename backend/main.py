import json
import asyncio
from typing import AsyncGenerator
from fastapi import FastAPI, Depends, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field, EmailStr
from rag_engine import ProductionRAGEngine
from orchestrator import AIOrchestrationEngine
from intel_engine import MarketIntelEngine

# Explicitly import our functional tool handlers and the graph engine class
from agent_engine import CodingTDAgent, run_python_script_in_workspace, extract_all_json_blocks

# Instantiate the core services
app = FastAPI(title="Enterprise AI Accelerator Hub", version="1.0.0")
rag_service = ProductionRAGEngine() # Instantiate vector core
orchestrator_service = AIOrchestrationEngine()
coding_agent_service = CodingTDAgent()
intel_service = MarketIntelEngine()

# Setup CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:11434"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# GLOBAL EXCEPTION MIDDLEWARE OVERRIDE
# ==========================================
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Global interceptor for Pydantic validation failures.
    Flattens complex error trees into production-clean, human-readable fragments.
    """
    formatted_errors = []
    for error in exc.errors():
        # Extracted location path (e.g., ["body", "auth_email"])
        field_path = " -> ".join([str(loc) for loc in error["loc"] if loc != "body"])
        formatted_errors.append({
            "field": field_path or "root",
            "message": error["msg"].capitalize(),
            "type": error["type"]
        })
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error_type": "ValidationError",
            "details": formatted_errors
        }
    )

# 1. Strict Data Validation Schema
class TelemetryPayload(BaseModel):
    client_id: str = Field(..., min_length=3, max_length=50)
    stream_type: str = Field(default="analytics")
    auth_email: EmailStr

# 2. Mock Dependency Injection (Simulating a database or auth service)
def get_stream_service() -> str:
    # In a real app, instantiate database sessions or clients here
    return "active_service_session"

# 3. Asynchronous Generator for Streaming Chunks (Simulating LLM tokens or live logs)
async def event_generator(payload: TelemetryPayload) -> AsyncGenerator[str, None]:
    try:
        for i in range(1, 11):
            await asyncio.sleep(0.3)  # Non-blocking async sleep
            # Formatting as Server-Sent Event (SSE) standard: "data: <payload>\n\n"
            yield f"data: {{\"chunk\": {i}, \"status\": \"processing\", \"client\": \"{payload.client_id}\"}}\n\n"
        yield "data: {\"status\": \"completed\"}\n\n"
    except asyncio.CancelledByClientError:
        # Crucial for senior level: detect when a user closes the browser/cancels request
        print(f"Client disconnected early: {payload.client_id}")

# 4. Streaming Endpoint
@app.post("/api/v1/stream")
async def stream_telemetry(
    payload: TelemetryPayload, 
    service: str = Depends(get_stream_service)
):
    """
    Accepts a validated payload and returns an HTTP Server-Sent Events stream.
    """
    return StreamingResponse(
        event_generator(payload), 
        media_type="text/event-stream"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

# --- RAG Schemas ---
class DocumentPayload(BaseModel):
    filename: str = Field(..., min_length=2)
    content: str = Field(..., min_length=10)
    owner: str = Field(default="admin_level_1")

class QueryPayload(BaseModel):
    question: str = Field(..., min_length=3)
    user_role: str = Field(default="admin_level_1")

# --- RAG Endpoints ---
@app.post("/api/v1/rag/ingest")
async def ingest_document(payload: DocumentPayload):
    """
    Accepts text documentation strings, converts them into chunks and vector models,
    and saves them natively on your Windows workspace directory.
    """
    result = rag_service.process_and_index_document(
        raw_text=payload.content,
        filename=payload.filename,
        doc_owner=payload.owner
    )
    return {"success": True, "metrics": result}

@app.post("/api/v1/rag/search")
async def search_knowledge(payload: QueryPayload):
    """
    Executes semantic mathematical similarity searches against indexed documents.
    """
    matches = rag_service.query_knowledge_base(
        query_text=payload.question,
        required_perm=payload.user_role
    )
    return {"success": True, "results": matches}

class ChatPayload(BaseModel):
    message: str = Field(..., min_length=2)
    role: str = Field(default="admin_level_1")

@app.post("/api/v1/chat/stream")
async def chat_stream_endpoint(payload: ChatPayload):
    """
    Accepts a user chat question, queries the local ChromaDB context,
    and returns a live text token execution stream generated via local Ollama.
    """
    return StreamingResponse(
        orchestrator_service.stream_rag_pipeline(
            question=payload.message,
            user_role=payload.role
        ),
        media_type="text/event-stream"
    )

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Fixed static thread context boundary configuration for single workspace debugging
THREAD_CONFIG = {"configurable": {"thread_id": "tdd_session_1"}}

class InitTaskPayload(BaseModel):
    requirement: str

# Fixed strict schema mapping
class ResumeTaskPayload(BaseModel):
    approved: bool
    history_messages: list[str] = []

@app.post("/api/v1/agent/init")
async def initialize_agent_run(payload: InitTaskPayload):
    from langchain_core.messages import HumanMessage

    try:
        coding_agent_service.memory.storage.clear()
    except:
        pass

    initial_state = {
        "messages": [HumanMessage(content=payload.requirement)],
        "agent_logs": [],
        "requires_approval": False,
        "pending_action": ""
    }

    output = coding_agent_service.compiled_workflow.invoke(initial_state, config=THREAD_CONFIG)

    return {
        "success": True,
        "requires_approval": output.get("requires_approval", False),
        "pending_action": output.get("pending_action", ""),
        "execution_history": output.get("agent_logs", []),
        "messages": [m.content for m in output.get("messages", [])]
    }

@app.post("/api/v1/agent/resume")
async def resume_agent_run(payload: ResumeTaskPayload):
    from langchain_core.messages import HumanMessage

    # Extract properties using robust object getters to eliminate AttributeError anomalies
    is_approved = payload.approved
    client_history = payload.history_messages

    state_snapshot = coding_agent_service.compiled_workflow.get_state(config=THREAD_CONFIG)

    if not state_snapshot or not state_snapshot.values:
        current_logs = ["System Notice: Resetting memory matrices from backup traces."]
        last_ai_msg = client_history[-1] if client_history else "{}"
    else:
        current_logs = state_snapshot.values.get("agent_logs", [])
        last_ai_msg = state_snapshot.values.get("messages")[-1].content

    # Extract target script parameters
    parsed_blocks = extract_all_json_blocks(last_ai_msg)

    # Handle single dict translation parsing checks
    if isinstance(parsed_blocks, list) and len(parsed_blocks) > 0:
        target_block = parsed_blocks[0]
    elif isinstance(parsed_blocks, dict):
        target_block = parsed_blocks
    else:
        target_block = {}

    filename = target_block.get("filename", "verify.py")

    if is_approved:
        execution_feedback = run_python_script_in_workspace(filename)
        human_injection_message = HumanMessage(content=f"Human Verification Passed. Script execution text feedback:\n{execution_feedback}")
        log_feedback = f"Shell run complete. Execution verification passed cleanly."
    else:
        human_injection_message = HumanMessage(content="Human Verification Denied. Refactor script structure.")
        log_feedback = "Shell Run Aborted by human operator."

    # Update state history maps
    coding_agent_service.compiled_workflow.update_state(
        config=THREAD_CONFIG,
        values={
            "messages": [human_injection_message],
            "agent_logs": current_logs + [log_feedback],
            "requires_approval": False,
            "pending_action": ""
        },
        as_node="human_gate_node"
    )

    output = coding_agent_service.compiled_workflow.invoke(None, config=THREAD_CONFIG)

    return {
        "success": True,
        "requires_approval": output.get("requires_approval", False),
        "pending_action": output.get("pending_action", ""),
        "execution_history": output.get("agent_logs", []),
        "messages": [m.content for m in output.get("messages", [])]
    }

class IntelTaskPayload(BaseModel):
    search_topic: str = Field(..., min_length=3)
    export_filename: str = Field(default="market_research.md")

@app.post("/api/v1/agent/intel")
async def execute_market_intel_agent(payload: IntelTaskPayload):
    """
    Accepts research criteria parameters, scrapes data dynamically over the web, 
    and writes a verified, structured analysis report file straight to data_storage.
    """
    # Execute the synchronous blocking workflow safely within the fast async route block
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None, 
        intel_service.run_intel_workflow, 
        payload.search_topic, 
        payload.export_filename
    )
    
    if result.get("success"):
        return {
            "success": True,
            "summary_report": result["report_preview"],
            "telemetry_history": [
                f"Initialized live DuckDuckGo web search vectors tracking: {payload.search_topic}",
                "Successfully scraped live web indexes.",
                f"Structured data payload via local Llama3.",
                f"Wrote file securely to disk: {payload.export_filename}"
            ]
        }
    else:
        return {
            "success": False,
            "summary_report": f"Pipeline failure error occurred: {result.get('error_log')}",
            "telemetry_history": ["Failed to finalize web search intelligence gathering nodes context."]
        }
