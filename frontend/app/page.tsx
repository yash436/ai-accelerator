"use client";
import React, { useState } from 'react';

export default function Home() {
  // Panel A Hooks: Web Market Intelligence Agent Hooks
  const [intelTopic, setIntelTopic] = useState("React Frontend Trends and AI Coding Assistants");
  const [intelFile, setIntelFile] = useState("react_trends_2026.md");
  const [intelLogs, setIntelLogs] = useState<string[]>([]);
  const [intelOutput, setIntelOutput] = useState("");
  const [intelLoading, setIntelLoading] = useState(false);

  // Panel B Hooks: Core TDD Workspace Shell Automation Gating Hooks
  const [requirement, setRequirement] = useState("Write a Fibonacci script in calculation.py. Then, create a verification script in verify.py that tests that fibonacci(6) equals 8.");
  const [serializedMsgs, setSerializedMsgs] = useState<string[]>([]);
  const [telemetryLogs, setTelemetryLogs] = useState<string[]>([]);
  const [isCompiling, setIsCompiling] = useState(false);
  const [gateActive, setGateActive] = useState(false);
  const [pendingCommand, setPendingCommand] = useState("");

  const handleIntelAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntelLoading(true);
    setIntelOutput("");
    setIntelLogs(["Deploying web scrape micro-agent...", "Polling DuckDuckGo servers..."]);

    try {
      const res = await fetch('http://localhost:8000/api/v1/agent/intel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search_topic: intelTopic, export_filename: intelFile })
      });
      const data = await res.json();
      if (data.success) {
        setIntelLogs(data.telemetry_history);
        setIntelOutput(data.summary_report);
      } else {
        setIntelLogs(["Micro-agent failed to parse web content safely."]);
      }
    } catch {
      setIntelLogs(["Failed to reach web micro-agent modules safely."]);
    } finally {
      setIntelLoading(false);
    }
  };

  const handleInitAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCompiling(true);
    setGateActive(false);
    setPendingCommand("");
    setTelemetryLogs(["Waking local Llama3...", "Cybernetics graph compilation running..."]);
    try {
      const res = await fetch('http://localhost:8000/api/v1/agent/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement })
      });
      const data = await res.json();
      updateAgentUIState(data);
    } catch {
      setTelemetryLogs(prev => [...prev, "Connection lost."]);
      setIsCompiling(false);
    }
  };

  const handleGateResponse = async (approved: boolean) => {
    setIsCompiling(true);
    setGateActive(false);
    setTelemetryLogs(prev => [...prev, approved ? "Human approved execution. Running script..." : "Human denied execution."]);
    try {
      const res = await fetch('http://localhost:8000/api/v1/agent/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved, history_messages: serializedMsgs })
      });
      const data = await res.json();
      updateAgentUIState(data);
    } catch {
      setIsCompiling(false);
    }
  };

  const updateAgentUIState = (data: any) => {
    setTelemetryLogs(data.execution_history || []);
    setSerializedMsgs(data.messages || []);
    if (data.requires_approval) {
      setGateActive(true);
      setPendingCommand(data.pending_action || "");
    } else {
      setGateActive(false);
      setPendingCommand("");
    }
    setIsCompiling(false);
  };

  return (
    <main className="flex min-h-screen bg-zinc-950 text-zinc-100 p-6 font-mono text-xs">
      <div className="w-full max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Enterprise Multi-Agent Command Deck</h1>
          <p className="text-zinc-500 text-[11px]">Phase 4C — Decoupled Modular Sub-Graphs over Offline Workstations</p>
        </div>

        {/* Layout Master Split System */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* PANEL MODULE A: Web Search Intelligence Agent */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-sky-400 border-b border-zinc-800 pb-1.5">🌐 AGENT MODULE A: WEB INTEL MONITOR</h2>
              <form onSubmit={handleIntelAgent} className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Target Search Concept Criteria</label>
                  <input type="text" value={intelTopic} onChange={e => setIntelTopic(e.target.value)} disabled={intelLoading}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-200 focus:outline-none focus:border-sky-500 text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Export Destination File Name</label>
                  <input type="text" value={intelFile} onChange={e => setIntelFile(e.target.value)} disabled={intelLoading}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-200 focus:outline-none focus:border-sky-500 text-xs font-mono" />
                </div>
                <button type="submit" disabled={intelLoading} className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg uppercase tracking-wider text-[11px]">
                  {intelLoading ? "Scraping live tracking metrics..." : "Run Web Scrape Intelligence Engine"}
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 gap-4 pt-4 mt-2 border-t border-zinc-800">
              <div className="h-32 bg-zinc-950 rounded-lg p-3 overflow-y-auto space-y-1 text-zinc-400 text-[11px]">
                <span className="block text-[10px] uppercase text-zinc-600 font-bold mb-1">» Scrape Step Telemetry:</span>
                {intelLogs.map((log, idx) => <div key={idx} className="text-sky-400">» {log}</div>)}
              </div>
              <div className="h-44 bg-zinc-950 rounded-lg p-3 overflow-y-auto whitespace-pre-wrap text-zinc-300 leading-relaxed text-[11px] border border-zinc-800">
                {intelOutput || <span className="text-zinc-700">Awaiting web agent execution pass... Report content will populate markdown format previews natively here.</span>}
              </div>
            </div>
          </div>

          {/* PANEL MODULE B: Gated TDD Coding Workspace Agent */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-indigo-400 border-b border-zinc-800 pb-1.5">💻 AGENT MODULE B: TDD WORKSPACE SYSTEM</h2>
              <form onSubmit={handleInitAgent} className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Target Engineering Requirement Spec</label>
                  <textarea rows={3} value={requirement} onChange={e => setRequirement(e.target.value)} disabled={isCompiling || gateActive}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-200 focus:outline-none focus:border-indigo-500 text-xs leading-normal" />
                </div>
                <button type="submit" disabled={isCompiling || gateActive} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg uppercase tracking-wider text-[11px]">
                  {isCompiling ? "Compiling source elements..." : "Deploy Gated Workflow Architecture"}
                </button>
              </form>
            </div>

            {gateActive && (
              <div className="bg-amber-950/40 border-2 border-amber-500 rounded-lg p-4 space-y-3 my-2 shadow-xl animate-pulse">
                <h3 className="text-amber-400 font-bold text-[11px] uppercase">⚠️ ADMINISTRATOR CONTROL HOOK INTERCEPT</h3>
                <pre className="bg-zinc-950 p-2.5 rounded text-[10px] text-amber-200 overflow-x-auto">{pendingCommand}</pre>
                <div className="flex gap-2 text-[10px]">
                  <button onClick={() => handleGateResponse(true)} className="flex-1 py-1.5 bg-emerald-600 text-white font-bold rounded">✓ Run Script Natively</button>
                  <button onClick={() => handleGateResponse(false)} className="flex-1 py-1.5 bg-rose-600 text-white font-bold rounded">✗ Block Command</button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 pt-4 mt-2 border-t border-zinc-800">
              <div className="h-32 bg-zinc-950 rounded-lg p-3 overflow-y-auto space-y-1 text-zinc-400 text-[11px]">
                <span className="block text-[10px] uppercase text-zinc-600 font-bold mb-1">» Shell Step Telemetry:</span>
                {telemetryLogs.map((log, idx) => <div key={idx} className="text-emerald-400">» {log}</div>)}
              </div>
              <div className="h-44 bg-zinc-950 rounded-lg p-3 overflow-y-auto text-zinc-300 text-[11px] border border-zinc-800 whitespace-pre-wrap">
                {serializedMsgs.length === 0 ? <span className="text-zinc-700">Awaiting agent activation loop... Memory traces will print details here.</span> : serializedMsgs[serializedMsgs.length - 1]}
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
