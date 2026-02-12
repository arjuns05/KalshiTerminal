# WebSocket Protocol (web <-> api)

Endpoint: ws://<api-host>/ws

## Server -> Client
- hello
  - { "type": "hello", "ts": <ms> }

- tick (dev-only)
  - { "type": "tick", "ts": <ms> }

- echo (dev-only)
  - { "type": "echo", "msg": <any>, "ts": <ms> }

## Client -> Server (today)
- ping
  - { "type": "ping", "ts": <ms> }

- client_test
  - { "type": "client_test", "text": "...", "ts": <ms> }

## Planned (next)
- subscribe
  - { "type": "subscribe", "tickers": ["KX..."] }

- unsubscribe
  - { "type": "unsubscribe", "tickers": ["KX..."] }

- book
- trade
- status


Progress 02/12:
apps/src
- index.js: this the server that will house the backend for the entire server
- this has the websocket which will eventualy push ticks to the frontend 


apps/web:
- layout.js: frontend for the entire thing

You built the skeleton of a terminal system:

Web UI (client) ⇄ WebSocket gateway (API)

That’s the core pipeline every “terminal” needs. Tomorrow you swap the fake stream with:

Kalshi WebSocket ingestion (either inside API or in a separate ingestor service)

subscription routing (only send updates for tickers the user is watching)

If you want, I can diagram the data flow in 5 lines and tell you exactly which file changes tomorrow to add subscribe/unsubscribe.



## Client -> Server
- subscribe
  - { "type": "subscribe", "tickers": ["TEST1", "TEST2"], "ts": <ms> }

- unsubscribe
  - { "type": "unsubscribe", "tickers": ["TEST1"], "ts": <ms> }

## Server -> Client
- hello
  - { "type": "hello", "ts": <ms> }

- subscribed
  - { "type": "subscribed", "tickers": ["TEST1"], "ts": <ms> }

- book
  - { "type": "book", "ticker": "TEST1", "ts": <ms>, "mid": 0.52,
      "bids": [[price, qty], ...], "asks": [[price, qty], ...] }

- trade
  - { "type": "trade", "ticker": "TEST1", "ts": <ms>, "price": 0.52, "qty": 10 }


