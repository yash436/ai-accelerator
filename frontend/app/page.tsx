"use client";
import React, { useState } from 'react';

export default function Home() {
  // Ingestion form state (Left Panel)
  const [docName, setDocName] = useState("api_blueprint.txt");
  const [docContent, setDocContent] = useState("");
  const [ingestStatus, setIngestStatus] = useState("");

  // Chat interface state (Right Panel)
  const [chatInput, setChatInput] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [sourceCitations, setSourceCitations] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIngestStatus("Vectorizing elements...");
    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/rag/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: docName, content: docContent, owner: "admin_level_1" })
      });
      const data = await response.json();
      if (data.success) {
        setIngestStatus(`Success! Indexed ${data.metrics.chunks_indexed} tokens locally.`);
        setDocContent("");
      }
    } catch (err) {
      setIngestStatus("Network failure reaching ingestion server.");
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    setAiResponse("");
    setSourceCitations("");
    setIsGenerating(true);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: chatInput, role: "admin_level_1" })
      });

      if (!response.body) throw new Error("Stream connection failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const rawText = decoder.decode(value);
        const lines = rawText.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonString = line.replace('data: ', '').trim();
            if (!jsonString) continue;

            try {
              const parsed = JSON.parse(jsonString);
              if (parsed.type === 'content') {
                // Real-time incremental token layout appending
                setAiResponse((prev) => prev + parsed.token);
              } else if (parsed.type === 'metadata') {
                // Populate citations drawer separate from text
                setSourceCitations(parsed.raw_context);
              } else if (parsed.type === 'error') {
                setAiResponse((prev) => prev + `\n[Internal Error: ${parsed.message}]`);
              }
            } catch (err) {
              console.error("Chunk decoding fault:", err);
            }
          }
        }
      }
    } catch (err) {
      console.error("Connection broken:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="flex min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="w-full max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Enterprise Offline RAG Workspace</h1>
          <p className="text-zinc-400 text-sm">Phase 3 — Composed LCEL Pipelines over Local Llama3 Core</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel: Ingestion Sandbox */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4 h-fit">
            <h2 className="text-lg font-semibold text-indigo-400">1. Context Injection Core</h2>
            <form onSubmit={handleIngest} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-bold mb-1">Source Label</label>
                <input
                  type="text" value={docName} onChange={e => setDocName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-bold mb-1">Knowledge Content Block</label>
                <textarea
                  rows={8} value={docContent} onChange={e => setDocContent(e.target.value)}
                  placeholder="Paste private documentation data here..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 font-semibold rounded-lg text-sm transition-all shadow">
                Commit Chunks to Vector Storage
              </button>
            </form>
            {ingestStatus && <p className="text-xs bg-zinc-950 p-3 rounded-lg border border-zinc-800 font-mono text-emerald-400">{ingestStatus}</p>}
          </div>

          {/* Right Panel: Live Conversational Chat Stream Terminal */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col justify-between min-h-[500px]">
            <div className="space-y-4 flex-1">
              <h2 className="text-lg font-semibold text-emerald-400">2. Conversational Verification Console</h2>

              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-sm min-h-[250px] whitespace-pre-wrap leading-relaxed">
                {!aiResponse && !isGenerating && <span className="text-zinc-600">Awaiting prompt submission... Context will be stitched automatically.</span>}
                {aiResponse}
                {isGenerating && <span className="animate-pulse text-indigo-400 font-bold"> ▌</span>}
              </div>

              {sourceCitations && (
                <details className="group border border-zinc-800 bg-zinc-950 rounded-lg p-3 transition-all duration-300">
                  <summary className="text-xs font-mono font-bold text-zinc-400 cursor-pointer select-none hover:text-zinc-200 flex justify-between items-center">
                    <span>▼ VIEW CHROMA_DB VECTOR CITATIONS EXTRACTED</span>
                  </summary>
                  <pre className="mt-3 p-3 bg-zinc-900 rounded border border-zinc-800 text-[11px] text-zinc-400 font-mono overflow-x-auto whitespace-pre-wrap leading-normal">
                    {sourceCitations}
                  </pre>
                </details>
              )}
            </div>

            <form onSubmit={handleChatSubmit} className="flex gap-2 mt-4">
              <input
                type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                placeholder="Ask your local LLM about the injected corporate files..."
                disabled={isGenerating}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isGenerating || !chatInput.trim()} 
                className="px-5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-sm font-semibold rounded-lg transition-all text-white shadow"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
