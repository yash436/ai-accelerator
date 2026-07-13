"use client";
import React, { useState } from 'react';

interface VectorMatch {
  content: string;
  score: number | null;
  metadata: {
    source: string;
    chunk_index: number;
    total_tokens: number;
  };
}

export default function Home() {
  // Ingestion form state
  const [docName, setDocName] = useState("corporate_policy.md");
  const [docContent, setDocContent] = useState("");
  const [ingestStatus, setIngestStatus] = useState("");

  // Search state
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<VectorMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIngestStatus("Chunking and vectorizing elements...");
    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/rag/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: docName, content: docContent, owner: "admin_level_1" })
      });
      const data = await response.json();
      if (data.success) {
        setIngestStatus(`Success! Generated and indexed ${data.metrics.chunks_indexed} semantic tokens.`);
        setDocContent("");
      } else {
        setIngestStatus("Ingestion validation error occurred.");
      }
    } catch (err) {
      setIngestStatus("Network failure reaching ingestion server.");
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/rag/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query, user_role: "admin_level_1" })
      });
      const data = await response.json();
      if (data.success) setMatches(data.results);
    } catch (err) {
      console.error("Vector database connection lost:", err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <main className="flex min-h-screen bg-zinc-950 text-zinc-100 p-8 font-sans">
      <div className="w-full max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Multi-Format Contextual Knowledge Engine</h1>
          <p className="text-zinc-400 text-sm">Enterprise RAG Sandboxing Interface — ChromaDB Context Extraction</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel: Document Ingestion Layer */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-indigo-400">1. Document Ingestion Sandbox</h2>
            <form onSubmit={handleIngest} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-bold mb-1">Virtual File Name</label>
                <input
                  type="text" value={docName} onChange={e => setDocName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-bold mb-1">Raw Text Payload (Paste Data Here)</label>
                <textarea
                  rows={8} value={docContent} onChange={e => setDocContent(e.target.value)}
                  placeholder="Paste a long system documentation, project brief, or logs here to force token chunk boundaries..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 font-semibold rounded-lg text-sm transition-all shadow">
                Execute Chunking & Vector Upsert
              </button>
            </form>
            {ingestStatus && <p className="text-xs bg-zinc-950 p-3 rounded-lg border border-zinc-800 font-mono text-emerald-400">{ingestStatus}</p>}
          </div>

          {/* Right Panel: Semantic Vector Store Query Layer */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-emerald-400">2. Vector Search Engine</h2>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text" value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Ask a question semantically tied to uploaded text..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
              <button type="submit" disabled={isSearching} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-sm font-semibold rounded-lg transition-all shadow">
                {isSearching ? "Searching..." : "Query Core"}
              </button>
            </form>

            <div className="space-y-3 h-[320px] overflow-y-auto pr-1">
              {matches.length === 0 && (
                <div className="h-full flex items-center justify-center border border-dashed border-zinc-800 rounded-lg text-zinc-500 text-sm font-mono">
                  No vectors matches extracted yet.
                </div>
              )}
              {matches.map((match, idx) => (
                <div key={idx} className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-2 text-xs">
                  <div className="flex justify-between text-zinc-400 font-mono border-b border-zinc-900 pb-1.5">
                    <span>Src: <b className="text-zinc-200">{match.metadata.source}</b> (Idx: {match.metadata.chunk_index})</span>
                    <span>Cosine Distance: <b className="text-amber-400">{match.score?.toFixed(4)}</b></span>
                  </div>
                  <p className="text-zinc-300 leading-relaxed font-mono whitespace-pre-wrap">{match.content}</p>
                  <div className="text-right text-[10px] text-zinc-600 font-mono">Tokens: {match.metadata.total_tokens}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
