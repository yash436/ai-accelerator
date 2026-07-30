from typing import AsyncGenerator
import json
from langchain_community.llms import Ollama
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from rag_engine import ProductionRAGEngine

class AIOrchestrationEngine:
    def __init__(self):
        # 1. Connect to the local running Ollama instance
        self.llm = Ollama(model="llama3", base_url="http://localhost:11434")
        
        # 2. Instantiate existing Vector Engine
        self.rag_engine = ProductionRAGEngine()
        
        # 3. Formulate a Production-Grade System Prompt
        # Enforces strict groundness to mitigate LLM hallucinations.
        self.prompt_template = ChatPromptTemplate.from_messages([
            ("system", (
                "You are an enterprise AI reasoning assistant. Your task is to answer "
                "the user's question using ONLY the provided verified context chunks.\n\n"
                "CRITICAL INSTRUCTIONS:\n"
                "1. Rely strictly on the clear facts directly mentioned in the context.\n"
                "2. If the context does not contain the answer, state explicitly: 'I cannot find the answer in the provided knowledge base.' Do NOT make up information.\n"
                "3. Keep your response professional, precise, and well-structured.\n\n"
                "VERIFIED CONTEXT:\n{context}"
            )),
            ("human", "{question}")
        ])

    def _get_context_from_db(self, input_data: dict) -> str:
        """Helper to query the vector database and format chunks into a flat text context string."""
        question = input_data["question"]
        user_role = input_data.get("user_role", "admin_level_1")
        
        # Fetch the top 3 vector chunks from ChromaDB
        matches = self.rag_engine.query_knowledge_base(question, required_perm=user_role, limit=3)
        
        if not matches:
            return "No matching background data found."
            
        # Combine content fragments text blocks
        return "\n---\n".join([f"Source: {m['metadata']['source']}\nContent: {m['content']}" for m in matches])

    async def stream_rag_pipeline(self, question: str, user_role: str) -> AsyncGenerator[str, None]:
        """
        Asynchronously executes the LCEL chain, streams generated tokens,
        and cleanly appends the underlying source metadata attributes.
        """
        input_payload = {"question": question, "user_role": user_role}
        
        # Step A: Synchronously extract the background context vectors first
        context_string = self._get_context_from_db(input_payload)
        
        # Step B: Assemble the LCEL Chain declaratively
        # Prompt Template -> Local Ollama LLM Engine -> String Stream Parser
        chain = self.prompt_template | self.llm | StrOutputParser()
        
        try:
            # Step C: Stream chunks from Ollama line-by-line as they generate
            async for token in chain.astream({"context": context_string, "question": question}):
                # Format as an SSE packet payload
                yield f"data: {json.dumps({'token': token, 'type': 'content'})}\n\n"
                
            # Step D: Once text stream terminates, send a final structural packet containing the source citations
            # This allows the React UI to render source expanders nicely.
            yield f"data: {json.dumps({'type': 'metadata', 'raw_context': context_string})}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
