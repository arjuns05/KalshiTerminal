"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function wsUrlFromApiBase(apiBase) {
  // apiBase like http://localhost:4000
  const u = new URL(apiBase);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = "/ws";
  return u.toString();
}

export default function Home() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const wsUrl = useMemo(() => wsUrlFromApiBase(apiBase), [apiBase]);

  const [status, setStatus] = useState("disconnected");
  const [lastMsg, setLastMsg] = useState(null);
  const [feed, setFeed] = useState([]);

  const wsRef = useRef(null);

  useEffect(() => {
    setStatus("connecting");
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      // Prove we can send messages too
      ws.send(JSON.stringify({ type: "ping", ts: Date.now() }));
    };

    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        msg = { type: "raw", data: String(ev.data) };
      }
      setLastMsg(msg);
      setFeed((prev) => [msg, ...prev].slice(0, 20));
    };

    ws.onclose = () => setStatus("disconnected");
    ws.onerror = () => setStatus("error");

    return () => {
      try {
        ws.close();
      } catch {}
    };
  }, [wsUrl]);

  const sendTest = () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "client_test", text: "hello api", ts: Date.now() }));
  };

  return (
    <main style={{ padding: 16 }}>
      <h1 style={{ margin: "0 0 8px 0" }}>Kalshi Terminal Scaffold</h1>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, minWidth: 320 }}>
          <div><b>API</b>: {apiBase}</div>
          <div><b>WS</b>: {wsUrl}</div>
          <div style={{ marginTop: 8 }}>
            <b>Status</b>: {status}
          </div>
          <button
            onClick={sendTest}
            style={{
              marginTop: 12,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer"
            }}
          >
            Send test message
          </button>
        </div>

        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, flex: 1, minWidth: 320 }}>
          <div style={{ marginBottom: 8 }}><b>Last message</b></div>
          <pre style={{ margin: 0, background: "#fafafa", padding: 12, borderRadius: 8, overflowX: "auto" }}>
            {JSON.stringify(lastMsg, null, 2)}
          </pre>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <div style={{ marginBottom: 8 }}><b>Feed (latest 20)</b></div>
        <div style={{ display: "grid", gap: 8 }}>
          {feed.map((m, idx) => (
            <pre
              key={idx}
              style={{
                margin: 0,
                background: "#fafafa",
                padding: 10,
                borderRadius: 8,
                overflowX: "auto"
              }}
            >
              {JSON.stringify(m)}
            </pre>
          ))}
        </div>
      </div>
    </main>
  );
}
