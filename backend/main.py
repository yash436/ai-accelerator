import asyncio
from typing import AsyncGenerator
from fastapi import FastAPI, Depends, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field, EmailStr
from rag_engine import ProductionRAGEngine

app = FastAPI(title="Enterprise Streaming Engine", version="1.0.0")
rag_service = ProductionRAGEngine() # Instantiate vector core

# Setup CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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
