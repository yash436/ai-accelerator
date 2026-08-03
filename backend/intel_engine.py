import os
import json
from typing import Dict, Any
from langchain_community.llms import Ollama
from langchain_community.tools import DuckDuckGoSearchRun

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WORKSPACE_DIR = os.path.join(BASE_DIR, "data_storage")

class MarketIntelEngine:
    def __init__(self):
        # Initialize an isolated JSON-constrained local Llama instance
        self.llm = Ollama(model="llama3", base_url="http://localhost:11434", format="json")
        self.search_tool = DuckDuckGoSearchRun()

    def run_intel_workflow(self, topic: str, target_filename: str) -> Dict[str, Any]:
        """
        Queries the live web, extracts core conceptual patterns, 
        and saves a structured markdown report to the local workspace folder.
        """
        try:
            # Step 1: Execute search against live search index
            search_raw_results = self.search_tool.run(f"latest trends update {topic} 2026")
            
            # Step 2: Formulate prompt instructing the model to output a structural data dictionary
            system_prompt = (
                "You are an expert market intelligence analyst. Your job is to parse raw unstructured web search text "
                "and structure it into a clean, comprehensive markdown format.\n\n"
                "You MUST return a single JSON object matching this exact structural blueprint layout:\n"
                '{"title": "Report Title", "summary": "High-level summary text", "key_trends": ["Trend 1", "Trend 2"], "analysis": "Deep analytical text block"}\n\n'
                "CRITICAL: Do not include markdown code block backticks or conversational text. Output ONLY raw JSON."
            )
            
            user_prompt = f"RAW WEB DATA TO ANALYZE:\n{search_raw_results}"
            
            llm_response = self.llm.invoke([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ])
            
            parsed_data = json.loads(llm_response.strip())
            
            # Step 3: Map JSON keys into a cleanly formatted Markdown string
            markdown_content = (
                f"# Market Intelligence Report: {parsed_data.get('title', topic.upper())}\n\n"
                f"## Executive Summary\n{parsed_data.get('summary', 'No summary provided.')}\n\n"
                f"## Key Identified Trends\n" + "\n".join([f"- {trend}" for trend in parsed_data.get("key_trends", [])]) + "\n\n"
                f"## Detailed Analysis\n{parsed_data.get('analysis', 'No comprehensive text analysis compiled.')}\n"
            )
            
            # Step 4: Write the file natively onto your Windows hard drive path
            os.makedirs(WORKSPACE_DIR, exist_ok=True)
            file_path = os.path.join(WORKSPACE_DIR, target_filename)
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(markdown_content)
                
            return {
                "success": True,
                "file_path": file_path,
                "report_preview": markdown_content[:400] + "...\n[Report Continued in File]"
            }
            
        except Exception as e:
            return {"success": False, "error_log": str(e)}
