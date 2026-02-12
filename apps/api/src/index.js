import dotenv from "dotenv";
dotenv.config();

import http from "http";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.API_PORT || 4000);

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

/** ---------- Mock market feed helpers ---------- **/

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function roundTo(x, dp = 2) {
  const p = 10 ** dp;
  return Math.round(x * p) / p;
}

// Create per-ticker state for mock data generation
function makeTickerState() {
  // price in [0, 1] like a probability market (fits Kalshi vibes)
  return {
    mid: roundTo(0.50 + (Math.random() - 0.5) * 0.10, 2), // 0.45 - 0.55
    last: null,
  };
}

function nextMid(prevMid) {
  // small random walk
  const step = (Math.random() - 0.5) * 0.02; // +/- 0.01
  const next = clamp(prevMid + step, 0.01, 0.99);
  return roundTo(next, 2);
}

function genBook(mid) {
  const spread = 0.02 + Math.random() * 0.02; // 0.02 - 0.04
  const bestBid = clamp(mid - spread / 2, 0.01, 0.99);
  const bestAsk = clamp(mid + spread / 2, 0.01, 0.99);

  const levels = 10;
  const bids = [];
  const asks = [];

  // Build depth: prices step away from best bid/ask
  for (let i = 0; i < levels; i++) {
    const bidPrice = roundTo(clamp(bestBid - i * 0.01, 0.01, 0.99), 2);
    const askPrice = roundTo(clamp(bestAsk + i * 0.01, 0.01, 0.99), 2);

    // decreasing-ish quantities with randomness
    const bidQty = Math.max(1, Math.floor(200 * Math.exp(-i / 3) + Math.random() * 20));
    const askQty = Math.max(1, Math.floor(200 * Math.exp(-i / 3) + Math.random() * 20));

    bids.push([bidPrice, bidQty]);
    asks.push([askPrice, askQty]);
  }

  return { bids, asks };
}

function genTrade(mid, lastPrice) {
  // trade near mid, slightly biased around last
  const base = lastPrice ?? mid;
  const move = (Math.random() - 0.5) * 0.03; // +/- 0.015
  const price = roundTo(clamp(base + move, 0.01, 0.99), 2);
  const qty = Math.max(1, Math.floor(1 + Math.random() * 50));
  return { price, qty };
}

/** ---------- WebSocket server ---------- **/
wss.on("connection", (ws) => {
  const subs = new Set();               // tickers this client wants
  const stateByTicker = new Map();      // ticker -> { mid, last }

  ws.send(JSON.stringify({ type: "hello", ts: Date.now() }));

  // BOOK loop: frequent updates
  const bookInterval = setInterval(() => {
    if (ws.readyState !== 1) return;        // 1 === OPEN
    if (subs.size === 0) return;

    for (const ticker of subs) {
      let st = stateByTicker.get(ticker);
      if (!st) {
        st = makeTickerState();
        stateByTicker.set(ticker, st);
      }

      st.mid = nextMid(st.mid);
      const { bids, asks } = genBook(st.mid);

      ws.send(
        JSON.stringify({
          type: "book",
          ticker,
          ts: Date.now(),
          mid: st.mid,
          bids,
          asks,
        })
      );
    }
  }, 500);

  // TRADE loop: random prints
  const tradeInterval = setInterval(() => {
    if (ws.readyState !== 1) return;
    if (subs.size === 0) return;

    for (const ticker of subs) {
      // Probability of a trade on each interval per ticker
      if (Math.random() < 0.6) {
        let st = stateByTicker.get(ticker);
        if (!st) {
          st = makeTickerState();
          stateByTicker.set(ticker, st);
        }

        const t = genTrade(st.mid, st.last);
        st.last = t.price;

        ws.send(
          JSON.stringify({
            type: "trade",
            ticker,
            ts: Date.now(),
            price: t.price,
            qty: t.qty,
          })
        );
      }
    }
  }, 700);

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(String(data));
    } catch {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "error", error: "invalid_json", ts: Date.now() }));
      }
      return;
    }

    if (msg.type === "subscribe" && Array.isArray(msg.tickers)) {
      for (const t of msg.tickers) {
        if (typeof t === "string" && t.trim()) {
          const ticker = t.trim();
          subs.add(ticker);
          if (!stateByTicker.has(ticker)) stateByTicker.set(ticker, makeTickerState());
        }
      }
      ws.send(JSON.stringify({ type: "subscribed", tickers: Array.from(subs), ts: Date.now() }));
      return;
    }

    if (msg.type === "unsubscribe" && Array.isArray(msg.tickers)) {
      for (const t of msg.tickers) {
        if (typeof t === "string") {
          const ticker = t.trim();
          subs.delete(ticker);
          // optional: remove state too
          stateByTicker.delete(ticker);
        }
      }
      ws.send(JSON.stringify({ type: "subscribed", tickers: Array.from(subs), ts: Date.now() }));
      return;
    }

    // dev echo to debug
    ws.send(JSON.stringify({ type: "echo", msg, ts: Date.now() }));
  });

  ws.on("close", () => {
    clearInterval(bookInterval);
    clearInterval(tradeInterval);
  });

  ws.on("error", () => {
    clearInterval(bookInterval);
    clearInterval(tradeInterval);
  });
});

server.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log(`WS listening on ws://localhost:${PORT}/ws`);
});
