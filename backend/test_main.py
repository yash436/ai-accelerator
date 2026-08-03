import pytest
from fastapi.testclient import TestClient
from main import app
from agent_engine import extract_all_json_blocks

# Instantiate the standard TestClient for synchronous API endpoints
client = TestClient(app)

# ==========================================
# 1. UNIT TEST: DETRMINISTIC BRACKET STACK PARSER
# ==========================================
def test_extract_all_json_blocks_nested_code():
    """
    Verifies that the balanced-brace parser successfully extracts complete 
    JSON blocks even when code contents contain native nested loops and curly braces.
    """
    raw_llm_output = (
        "Here is the requested script payload text:\n"
        '{"call": "write_file", "filename": "calc.py", "content": "def run():\\n    if True:\\n        return {}"}\n'
        "Please execute it in the next loop."
    )
    
    parsed_blocks = extract_all_json_blocks(raw_llm_output)
    
    assert len(parsed_blocks) == 1
    assert parsed_blocks[0]["call"] == "write_file"
    assert parsed_blocks[0]["filename"] == "calc.py"
    assert "def run():" in parsed_blocks[0]["content"]


# ==========================================
# 2. INTEGRATION TEST: GLOBAL VALIDATION INTERCEPTOR
# ==========================================
def test_stream_endpoint_validation_failure():
    """
    Asserts that our global exception handler middleware catches invalid fields 
    and standardizes them into our machine-readable production JSON format.
    """
    invalid_payload = {
        "client_id": "sr",            # Too short (min_length=3 constraint)
        "stream_type": "analytics",
        "auth_email": "broken-email"  # Invalid EmailStr format
    }
    
    response = client.post("/api/v1/stream", json=invalid_payload)
    
    assert response.status_code == 422
    data = response.json()
    
    assert data["success"] is False
    assert data["error_type"] == "ValidationError"
    assert len(data["details"]) == 2
    
    # Confirm field targeting accuracy
    fields_with_errors = [err["field"] for err in data["details"]]
    assert "client_id" in fields_with_errors
    assert "auth_email" in fields_with_errors


# ==========================================
# 3. ASYNC TEST: LIVE SSE BYTE STREAM READER
# ==========================================
@pytest.mark.asyncio
async def test_asynchronous_sse_stream_pipeline():
    """
    Uses an async HTTP client to read our Server-Sent Events stream line-by-line, 
    verifying accurate SSE formatting and complete chunk propagation.
    """
    valid_payload = {
        "client_id": "test-suite-client",
        "stream_type": "unit_test",
        "auth_email": "tester@domain.com"
    }
    
    # We use httpx AsyncClient to read the live StreamingResponse network chunk blocks
    import httpx
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/api/v1/stream", json=valid_payload)
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/event-stream; charset=utf-8"
        
        chunks_received = 0
        completed_flag_found = False
        
        # Read the raw stream text blocks line by line
        async for line in response.aiter_lines():
            if line.startswith("data: "):
                chunks_received += 1
                if "completed" in line:
                    completed_flag_found = True
                    
        # Our generator loop spits out exactly 10 data processing chunks + 1 final completion packet
        assert chunks_received == 11
        assert completed_flag_found is True
