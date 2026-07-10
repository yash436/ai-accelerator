'use client';

"usereact";
import React, { useState } from 'react';

interface StreamChunk {
  chunk?: number;
  status: string;
  client?: string;
}

export default function Home() {
  const [logs, setLogs] = useState<StreamChunk[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const startStream = async () => {
    setLogs([]);
    setIsStreaming(true);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: "sr-dev-client-01",
          stream_type: "realtime_logs",
          auth_email: "senior@developer.com"
          // auth_email: "not-a-valid-email"
        })
      });

      // Intercept validation/server errors safely before streaming
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Structured Server Error:", errorData);
        
        // Push structured errors straight to the UI log viewer
        if (errorData.details) {
          errorData.details.forEach((err: any) => {
            setLogs((prev) => [...prev, { status: `CRITICAL: [Field: ${err.field}] ${err.message}` }]);
          });
        } else {
          setLogs((prev) => [...prev, { status: "Unknown validation error occurred." }]);
        }
        return;
      }

      if (!response.body) throw new Error("No response body available");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const rawText = decoder.decode(value);
        // SSE formatting separates messages with "data: " and double newlines
        const lines = rawText.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonString = line.replace('data: ', '').trim();
            if (!jsonString) continue;
            
            try {
              const parsed: StreamChunk = JSON.parse(jsonString);
              setLogs((prev) => [...prev, parsed]);
            } catch (e) {
              console.error("Error parsing stream chunk:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Streaming error:", error);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-zinc-950 text-zinc-50">
      <div className="w-full max-w-2xl p-6 bg-zinc-900 rounded-xl border border-zinc-800 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-bold tracking-tight">AI Pipeline Stream Monitor</h1>
          <button
            onClick={startStream}
            disabled={isStreaming}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 text-sm font-semibold rounded-lg transition-colors shadow"
          >
            {isStreaming ? 'Streaming...' : 'Trigger Stream'}
          </button>
        </div>

        <div className="h-64 overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-sm space-y-2">
          {logs.length === 0 && <p className="text-zinc-500">No active streams. Click trigger to begin.</p>}
          {logs.map((log, index) => (
            <div key={index} className="text-emerald-400">
              <span className="text-zinc-600">[{new Date().toLocaleTimeString()}]</span>{' '}
              Status: <span className="text-zinc-200">{log.status}</span> 
              {log.chunk && <> | Chunk: <span className="text-indigo-400">{log.chunk}</span></>}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
