"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function wsUrlFromApiBase(apiBase) {
  const u = new URL(apiBase);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = "/ws";
  return u.toString();
}

function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString();
}

export default function Home() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const wsUrl = useMemo(() => wsUrlFromApiBase(apiBase), [apiBase]);

  const wsRef = useRef(null);

  const [status, setStatus] = useState("disconnected");
  const [tickerInput, setTickerInput] = useState("");
  const [subscribed, setSubscribed] = useState([]);

  // ticker -> { bids, asks, mid, ts }
  const [booksByTicker, setBooksByTicker] = useState({});
  // ticker -> [ {ts, price, qty}, ...]
  const [tradesByTicker, setTradesByTicker] = useState({});

  // For debugging / confidence
  const [lastMsg, setLastMsg] = useState(null);

  useEffect(() => {
    setStatus("connecting");
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      // keep a ping so you can see echo messages if you want
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

      if (msg.type === "subscribed" && Array.isArray(msg.tickers)) {
        setSubscribed(msg.tickers);
        return;
      }

      if (msg.type === "book" && typeof msg.ticker === "string") {
        const ticker = msg.ticker;
        setBooksByTicker((prev) => ({
          ...prev,
          [ticker]: {
            bids: Array.isArray(msg.bids) ? msg.bids : [],
            asks: Array.isArray(msg.asks) ? msg.asks : [],
            mid: msg.mid,
            ts: msg.ts,
          },
        }));
        return;
      }

      if (msg.type === "trade" && typeof msg.ticker === "string") {
        const ticker = msg.ticker;
        setTradesByTicker((prev) => {
          const prevArr = prev[ticker] || [];
          const nextArr = [{ ts: msg.ts, price: msg.price, qty: msg.qty }, ...prevArr].slice(0, 30);
          return { ...prev, [ticker]: nextArr };
        });
        return;
      }
    };

    ws.onclose = () => setStatus("disconnected");
    ws.onerror = () => setStatus("error");

    return () => {
      try {
        ws.close();
      } catch {}
    };
  }, [wsUrl]);

const subscribe = () => {
  const ws = wsRef.current;
  if (!ws) {
    alert("WS not initialized yet.");
    return;
  }
  if (ws.readyState !== WebSocket.OPEN) {
    alert(`WS not open (readyState=${ws.readyState}). Wait for Status: connected.`);
    return;
  }

  const tickers = tickerInput
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (tickers.length === 0) {
    alert("Enter at least one ticker (e.g. TEST1).");
    return;
  }

  ws.send(JSON.stringify({ type: "subscribe", tickers, ts: Date.now() }));
  setTickerInput("");
};


  const unsubscribeOne = (ticker) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({ type: "unsubscribe", tickers: [ticker], ts: Date.now() }));

    // optional: clear UI state immediately for that ticker
    setBooksByTicker((prev) => {
      const copy = { ...prev };
      delete copy[ticker];
      return copy;
    });
    setTradesByTicker((prev) => {
      const copy = { ...prev };
      delete copy[ticker];
      return copy;
    });
  };

  const renderBook = (ticker) => {
    const book = booksByTicker[ticker];
    const bids = book?.bids || [];
    const asks = book?.asks || [];

    // show top 10
    const topBids = bids.slice(0, 10);
    const topAsks = asks.slice(0, 10);

    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Bids</div>
          <div style={{ display: "grid", gap: 6 }}>
            {topBids.map(([p, q], i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 8px",
                  border: "1px solid #eee",
                  borderRadius: 8,
                  background: "#fafafa",
                }}
              >
                <span>{p}</span>
                <span style={{ color: "#666" }}>{q}</span>
              </div>
            ))}
            {topBids.length === 0 && <div style={{ color: "#666" }}>No bids yet</div>}
          </div>
        </div>

        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Asks</div>
          <div style={{ display: "grid", gap: 6 }}>
            {topAsks.map(([p, q], i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 8px",
                  border: "1px solid #eee",
                  borderRadius: 8,
                  background: "#fafafa",
                }}
              >
                <span>{p}</span>
                <span style={{ color: "#666" }}>{q}</span>
              </div>
            ))}
            {topAsks.length === 0 && <div style={{ color: "#666" }}>No asks yet</div>}
          </div>
        </div>
      </div>
    );
  };

  const renderTrades = (ticker) => {
    const arr = tradesByTicker[ticker] || [];
    return (
      <div style={{ display: "grid", gap: 6 }}>
        {arr.map((t, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
              padding: "6px 8px",
              border: "1px solid #eee",
              borderRadius: 8,
              background: "#fafafa",
            }}
          >
            <span style={{ color: "#666" }}>{fmtTime(t.ts)}</span>
            <span>{t.price}</span>
            <span style={{ textAlign: "right", color: "#666" }}>{t.qty}</span>
          </div>
        ))}
        {arr.length === 0 && <div style={{ color: "#666" }}>No trades yet</div>}
      </div>
    );
  };

  return (
    <main style={{ padding: 16 }}>
      <h1 style={{ margin: "0 0 8px 0" }}>Kalshi Terminal (Mock Feed)</h1>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, minWidth: 360 }}>
          <div>
            <b>API</b>: {apiBase}
          </div>
          <div>
            <b>WS</b>: {wsUrl}
          </div>
          <div style={{ marginTop: 8 }}>
            <b>Status</b>: {status}
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Subscriptions</div>

            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value)}
                placeholder="Enter tickers, comma-separated (e.g. TEST1, TEST2)"
                style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
              />
              <button
  onClick={subscribe}
  disabled={status !== "connected"}
  style={{
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #ddd",
    background: status === "connected" ? "white" : "#f3f3f3",
    cursor: status === "connected" ? "pointer" : "not-allowed",
    opacity: status === "connected" ? 1 : 0.6
  }}
>
  Subscribe
</button>

            </div>

            <div style={{ marginTop: 10 }}>
              {subscribed.length === 0 ? (
                <div style={{ color: "#666" }}>No active subscriptions</div>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {subscribed.map((t) => (
                    <button
                      key={t}
                      onClick={() => unsubscribeOne(t)}
                      title="Click to unsubscribe"
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "1px solid #ddd",
                        background: "white",
                        cursor: "pointer",
                      }}
                    >
                      {t} ✕
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, flex: 1, minWidth: 360 }}>
          <div style={{ marginBottom: 8 }}>
            <b>Last message</b>
          </div>
          <pre style={{ margin: 0, background: "#fafafa", padding: 12, borderRadius: 8, overflowX: "auto" }}>
            {JSON.stringify(lastMsg, null, 2)}
          </pre>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 16 }}>
        {subscribed.map((ticker) => (
          <div key={ticker} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{ticker}</div>
              <div style={{ color: "#666" }}>
                Mid: {booksByTicker[ticker]?.mid ?? "—"} · Updated:{" "}
                {booksByTicker[ticker]?.ts ? fmtTime(booksByTicker[ticker].ts) : "—"}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginTop: 12 }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Order Book</div>
                {renderBook(ticker)}
              </div>

              <div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Trades</div>
                {renderTrades(ticker)}
              </div>
            </div>
          </div>
        ))}

        {subscribed.length === 0 && (
          <div style={{ color: "#666" }}>
            Subscribe to a ticker (e.g. <code>TEST1</code>) to see a live order book + trade tape.
          </div>
        )}
      </div>
    </main>
  );
}
