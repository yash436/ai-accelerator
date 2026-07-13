import uuid
import tiktoken
from typing import List, Dict, Any
import chromadb
from chromadb.utils import embedding_functions
from langchain_text_splitters import RecursiveCharacterTextSplitter

class ProductionRAGEngine:
    def __init__(self):
        # 1. Initialize persistent local ChromaDB Client
        self.chroma_client = chromadb.PersistentClient(path="./chroma_db")
        
        # 2. Use a standard local embedding function (Defaulting to all-MiniLM-L6-v2)
        # This computes vector embeddings completely offline on your Windows machine
        self.embed_fn = embedding_functions.DefaultEmbeddingFunction()
        
        # 3. Fetch or create a target vector database collection
        self.collection = self.chroma_client.get_or_create_collection(
            name="knowledge_repository",
            embedding_function=self.embed_fn,
            metadata={"hnsw:space": "cosine"} # Use cosine similarity for retrieval
        )
        
        # 4. Initialize Senior Token-Based Text Splitter
        # Character-based splitting breaks code/words arbitrarily. Token splitting honors LLM contexts.
        self.tokenizer = tiktoken.get_encoding("cl100k_base") # Standard tokenizer used by GPT-4
        self.text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
            encoding_name="cl100k_base",
            chunk_size=150,       # Strict targeted chunk token limits
            chunk_overlap=25     # Slidewindow overlap to maintain contextual continuity
        )

    def process_and_index_document(self, raw_text: str, filename: str, doc_owner: str) -> Dict[str, Any]:
        """
        Parses text, chunks it semantically based on token density, 
        injects system metadata, and indexes it into ChromaDB.
        """
        # Split text into contextual token chunks
        chunks = self.text_splitter.split_text(raw_text)
        
        documents = []
        metadatas = []
        ids = []
        
        for i, chunk in enumerate(chunks):
            documents.append(chunk)
            # Crucial Senior Requirement: Metadata filtering boundaries
            metadatas.append({
                "source": filename,
                "chunk_index": i,
                "owner_perm": doc_owner,
                "total_tokens": len(self.tokenizer.encode(chunk))
            })
            ids.append(f"{filename}_{uuid.uuid4().hex[:8]}_{i}")
        
        # Batch upsert into Vector Store
        if documents:
            self.collection.upsert(
                ids=ids,
                documents=documents,
                metadatas=metadatas
            )
            
        return {"chunks_indexed": len(documents), "assigned_ids": ids}

    def query_knowledge_base(self, query_text: str, required_perm: str, limit: int = 3) -> List[Dict[str, Any]]:
        """
        Queries Vector database with strict metadata permission enforcement.
        """
        results = self.collection.query(
            query_texts=[query_text],
            n_results=limit,
            # Production Guardrail: Ensure users can only retrieve chunks they have permissions to see
            where={"owner_perm": required_perm} 
        )
        
        # Flatten and normalize complex Chroma outputs into a clean JSON layout
        formatted_results = []
        if results and results["documents"]:
            for i in range(len(results["documents"][0])):
                formatted_results.append({
                    "content": results["documents"][0][i],
                    "score": results["distances"][0][i] if results["distances"] else None,
                    "metadata": results["metadatas"][0][i] if results["metadatas"] else {}
                })
        return formatted_results
