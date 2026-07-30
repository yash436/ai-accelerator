import os
import json
import subprocess
from typing import TypedDict, Annotated, Sequence, Dict, Any

from langchain_community.llms import Ollama
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

# Establish clear absolute paths globally across modules
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WORKSPACE_DIR = os.path.join(BASE_DIR, "data_storage")

# --- Core Tools (Cleanly Exported) ---

def write_local_workspace_file(filename: str, content: str) -> str:
    try:
        os.makedirs(WORKSPACE_DIR, exist_ok=True)
        file_path = os.path.join(WORKSPACE_DIR, filename)
        sanitized_content = content.replace("\\n", "\n")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(sanitized_content)
        return f"Success: File '{filename}' written securely with formatted layout."
    except Exception as e:
        return f"Failure writing file: {str(e)}"

def run_python_script_in_workspace(filename: str) -> str:
    """Natively executes a target Python script inside the data_storage folder."""
    file_path = os.path.join(WORKSPACE_DIR, filename)
    if not os.path.exists(file_path):
        return f"Execution Failure: File '{filename}' does not exist on disk."
    try:
        result = subprocess.run(["python", file_path], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            return f"Execution Success:\n{result.stdout or 'Script completed cleanly.'}"
        else:
            return f"Execution Failed:\n{result.stderr}\n{result.stdout}"
    except Exception as e:
        return f"Execution Failure: {str(e)}"


# --- Balanced-Brace Stack Parser ---

def extract_all_json_blocks(text: str) -> list[Dict[str, Any]]:
    found_blocks = []
    stack = []
    start_idx = -1
    for idx, char in enumerate(text):
        if char == "{":
            if len(stack) == 0: start_idx = idx
            stack.append(char)
        elif char == "}":
            if len(stack) > 0:
                stack.pop()
                if len(stack) == 0 and start_idx != -1:
                    try:
                        parsed = json.loads(text[start_idx:idx+1])
                        if "call" in parsed: found_blocks.append(parsed)
                    except: pass
                    start_idx = -1
    return found_blocks


# --- Stateful Graph Definition ---

class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], lambda x, y: x + y]
    agent_logs: Annotated[list, lambda x, y: x + y]
    requires_approval: bool
    pending_action: str

class CodingTDAgent:
    def __init__(self):
        self.llm = Ollama(model="llama3", base_url="http://localhost:11434", format="json")
        self.memory = MemorySaver()
        
        graph = StateGraph(AgentState)
        
        graph.add_node("coder_brain", self._call_coder_brain)
        graph.add_node("write_tool_node", self._execute_safe_writes)
        graph.add_node("human_gate_node", self._execute_human_intercept)
        
        graph.set_entry_point("coder_brain")
        graph.add_conditional_edges(
            "coder_brain",
            self._route_next_action,
            {
                "write": "write_tool_node",
                "execute": "human_gate_node",
                "end": END
            }
        )
        
        graph.add_edge("write_tool_node", "coder_brain")
        graph.add_edge("human_gate_node", "coder_brain")
        
        self.compiled_workflow = graph.compile(
            checkpointer=self.memory,
            interrupt_after=["human_gate_node"]
        )

    def _call_coder_brain(self, state: AgentState) -> Dict[str, Any]:
        messages = list(state["messages"])
        system_prompt = SystemMessage(content=(
            "You are an automated Windows coding bot. You must respond with a single JSON object matching ONE of these schemas:\n\n"
            "To write a file:\n"
            '{"call": "write_file", "filename": "calculation.py", "content": "def fibonacci(n):\\n    if n <= 1:\\n        return n\\n    return fibonacci(n-1) + fibonacci(n-2)"}\n\n'
            "To execute a script:\n"
            '{"call": "execute_script", "filename": "verify.py"}\n\n'
            "To finish the task because everything works:\n"
            '{"call": "final_answer", "report": "WRITE A DETAILED RUN SUMMARY CARDS"}\n\n'
            "CRITICAL: Output ONLY a single raw JSON block tool call. Do not loop write files infinitely. Execute your test script to verify work."
        ))
        response = self.llm.invoke([system_prompt] + messages)
        return {"messages": [AIMessage(content=response)], "agent_logs": ["Brain evaluating next workspace cycle block..."]}

    def _route_next_action(self, state: AgentState) -> str:
        try:
            parsed = json.loads(state["messages"][-1].content.strip())
            call_target = parsed.get("call")
            if call_target == "write_file":
                return "write"
            elif call_target == "execute_script":
                return "execute"
        except: pass
        return "end"

    def _execute_safe_writes(self, state: AgentState) -> Dict[str, Any]:
        last_msg = state["messages"][-1].content.strip()
        parsed = extract_all_json_blocks(last_msg)
        if not parsed:
            return {"requires_approval": False, "pending_action": ""}
        block = parsed[0]
        
        filename = block.get("filename", "unknown.py")
        feedback = write_local_workspace_file(filename, block.get("content", ""))
        
        return {
            "requires_approval": False, "pending_action": "",
            "messages": [HumanMessage(content=f"Environment Feedback: {feedback}")],
            "agent_logs": [f"Executed Action [write_file] -> '{filename}'", f"Feedback: {feedback}"]
        }

    def _execute_human_intercept(self, state: AgentState) -> Dict[str, Any]:
        last_msg = state["messages"][-1].content.strip()
        parsed = extract_all_json_blocks(last_msg)
        if not parsed:
            return {"requires_approval": False, "pending_action": ""}
        block = parsed[0]
        
        filename = block.get("filename", "unknown.py")
        return {
            "requires_approval": True,
            "pending_action": json.dumps(block, indent=2),
            "messages": [],
            "agent_logs": [f"🛡️ SAFETY GATE ENGAGED: Requiring human administrator verification to execute script: {filename}"]
        }
