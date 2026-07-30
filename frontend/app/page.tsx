"use client";
import React, { useState } from 'react';

export default function Home() {
  const [requirement, setRequirement] = useState(
    "Write a Fibonacci script in calculation.py. Then, create a verification script in verify.py that imports it and tests that fibonacci(6) equals 8."
  );
  const [serializedMsgs, setSerializedMsgs] = useState<string[]>([]);
  const [telemetryLogs, setTelemetryLogs] = useState<string[]>([]);
  const [isCompiling, setIsCompiling] = useState(false);

  // Guardrail state hooks
  const [gateActive, setGateActive] = useState(false);
  const [pendingCommand, setPendingCommand] = useState("");

  const handleInitAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCompiling(true);
    setGateActive(false);
    setPendingCommand("");
    setTelemetryLogs(["Waking local Llama3...", "Analyzing instructions..."]);

    try {
      const res = await fetch('http://localhost:8000/api/v1/agent/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement })
      });
      const data = await res.json();
      updateAgentUIState(data);
    } catch {
      setTelemetryLogs(prev => [...prev, "Connection to backend lost."]);
      setIsCompiling(false);
    }
  };

  const handleGateResponse = async (approved: boolean) => {
    setIsCompiling(true);
    setGateActive(false); // Hide the gate temporarily while loading
    setTelemetryLogs(prev => [...prev, approved ? "Human approved shell execution. Running script..." : "Human denied execution. Forcing re-planning..."]);

    try {
      const res = await fetch('http://localhost:8000/api/v1/agent/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved: approved,
          history_messages: serializedMsgs // Pass message history back to backend
        })
      });
      const data = await res.json();
      updateAgentUIState(data);
    } catch {
      setTelemetryLogs(prev => [...prev, "Failed to resume runtime execution loop."]);
      setIsCompiling(false);
    }
  };

  const updateAgentUIState = (data: any) => {
    setTelemetryLogs(data.execution_history || []);
    setSerializedMsgs(data.messages || []);

    // Explicitly mapping backend snake_case to frontend state updates
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
    <main className="flex min-h-screen bg-zinc-950 text-zinc-100 p-8 font-mono text-xs">
      <div className="w-full max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-lg font-bold text-white">Gated Autonomous Workspace Terminal</h1>
          <p className="text-zinc-500 text-[11px]">Phase 4B — Human-in-the-Loop Shell Authorization Cockpit</p>
        </div>

        {/* Input Configuration Console */}
        <form onSubmit={handleInitAgent} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
          <label className="block text-[10px] uppercase font-bold text-zinc-400">Target System Spec Instructions</label>
          <textarea
            rows={2} value={requirement} onChange={e => setRequirement(e.target.value)} disabled={isCompiling || gateActive}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-zinc-200 focus:outline-none focus:border-indigo-500 leading-relaxed font-mono text-xs"
          />
          <button type="submit" disabled={isCompiling || gateActive} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 font-bold rounded-lg text-white transition-all">
            {isCompiling ? "AGENT RUNNING ARCHITECTURE LOOPS..." : "DEPLOY GATED WORKFLOW ARCHITECTURE"}
          </button>
        </form>

        {/* ACTIVE HUMAN-IN-THE-LOOP CONTROL GATEWAY PANEL */}
        {gateActive && (
          <div className="bg-amber-950/30 border-2 border-amber-500 rounded-xl p-6 space-y-4 animate-pulse shadow-xl">
            <div className="flex justify-between items-center border-b border-amber-900/60 pb-2">
              <h2 className="text-amber-400 font-bold tracking-wider text-sm">⚠️ SHELL SAFETY GUARDRAIL CHALLENGE</h2>
              <span className="bg-amber-500 text-black font-bold px-2 py-0.5 rounded text-[10px]">INTERCEPT_ACTIVE</span>
            </div>
            <p className="text-zinc-200 text-xs">
              The local autonomous agent is requesting explicit administrator approval to execute a command line process on your Windows workstation machine:
            </p>
            <pre className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 text-amber-300 font-mono text-xs overflow-x-auto leading-normal">
              {pendingCommand}
            </pre>
            <div className="flex gap-4 pt-2">
              <button
                onClick={() => handleGateResponse(true)}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors text-xs uppercase tracking-wider"
              >
                ✓ Approve & Execute Script Natively
              </button>
              <button
                onClick={() => handleGateResponse(false)}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg transition-colors text-xs uppercase tracking-wider"
              >
                ✗ Deny Action & Force Re-Write
              </button>
            </div>
          </div>
        )}

        {/* Real-time Telemetry Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Action Log stream console */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col h-[380px]">
            <h2 className="text-[10px] uppercase font-bold text-indigo-400 mb-2 border-b border-zinc-800 pb-1">📊 Workspace Execution Log Trace</h2>
            <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-zinc-400 overflow-y-auto space-y-1.5 font-mono text-[11px]">
              {telemetryLogs.length === 0 && <div className="text-zinc-600">Terminal offline. Awaiting pipeline start...</div>}
              {telemetryLogs.map((log, idx) => (
                <div key={idx} className="text-emerald-400"><span className="text-zinc-700">»</span> {log}</div>
              ))}
              {isCompiling && <div className="text-indigo-400 animate-pulse">Running compilation cycle on Windows...</div>}
            </div>
          </div>

          {/* Model thought array console */}
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col h-[380px]">
            <h2 className="text-[10px] uppercase font-bold text-emerald-400 mb-2 border-b border-zinc-800 pb-1">🧠 Current Agent Memory State Summary</h2>
            <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-zinc-200 overflow-y-auto whitespace-pre-wrap leading-relaxed font-mono text-xs">
              {serializedMsgs.length === 0 ? (
                <span className="text-zinc-600">Terminal idle. Waiting for compilation deployment execution...</span>
              ) : (
                serializedMsgs[serializedMsgs.length - 1]
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
